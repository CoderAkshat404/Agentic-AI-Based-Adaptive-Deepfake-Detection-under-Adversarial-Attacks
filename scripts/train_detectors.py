"""Train the detector pool: baseline (traditional), robust (FGSM-RS adversarial training), vit.

Laptop-friendly and crash-safe:
  * ImageNet-pretrained timm backbones + mixed precision + OneCycle LR (converges in 1 epoch)
  * checkpoint every 100 steps; re-running the command RESUMES where it stopped
  * finished models are skipped (delete weights/<name>.pt to retrain)
  * the robust model starts from the baseline weights and is adversarially fine-tuned
  * --cooldown adds a pause per step to keep a hot laptop GPU from thermal shutdown

    python scripts/train_detectors.py              # all three, ~25 min on an RTX 2050
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import torch
import torch.nn.functional as F
from sklearn.metrics import roc_auc_score
from torch.utils.data import DataLoader, Subset
from tqdm import tqdm

from config import ARCHS, DEVICE, EPS, WEIGHTS_DIR
from core.data import FaceDataset, build_transform, list_samples
from core.models import DetectorNet, weight_path

DEFAULTS = {  # per_class, epochs, lr, batch
    "baseline": (6000, 1, 4e-4, 32),
    "robust":   (6000, 1, 2e-4, 32),
    "vit":      (6000, 1, 1e-4, 32),
}
AMP = DEVICE.type == "cuda"


@torch.no_grad()
def evaluate(model, loader):
    model.eval()
    ps, ys = [], []
    for x, y in loader:
        with torch.autocast("cuda", enabled=AMP):
            p = torch.softmax(model(x.to(DEVICE, non_blocking=True)).float(), 1)[:, 1]
        ps.append(p.cpu()), ys.append(y)
    p, y = torch.cat(ps).numpy(), torch.cat(ys).numpy()
    return float(((p > 0.5) == y).mean()), float(roc_auc_score(y, p))


def fgsm_rs(model, x, y, eps, scaler):
    """'Fast is better than free' (Wong et al. 2020): random start + one FGSM step, alpha=1.25 eps."""
    delta = torch.empty_like(x).uniform_(-eps, eps).requires_grad_(True)
    with torch.autocast("cuda", enabled=AMP):
        loss = F.cross_entropy(model((x + delta).clamp(0, 1)).float(), y)
    g = torch.autograd.grad(scaler.scale(loss), delta)[0]
    delta = (delta + 1.25 * eps * g.sign()).clamp(-eps, eps).detach()
    return (x + delta).clamp(0, 1)


def train(name, per_class, epochs, lr, bs, workers, cooldown):
    if weight_path(name).exists() and weight_path(name).with_suffix(".json").exists():
        print(f"'{name}' already trained - skipping (delete {weight_path(name)} to retrain)")
        return
    robust_aug = name != "baseline"
    tr = FaceDataset(list_samples("Train", per_class, seed=1), build_transform(True, robust_aug))
    va = FaceDataset(list_samples("Validation", 800, seed=2), build_transform(False))
    vl = DataLoader(va, 64, num_workers=workers, pin_memory=True)
    steps_per_epoch = len(tr) // bs
    print(f"\n=== Training '{name}' ({ARCHS[name]}) | {len(tr)} images x {epochs} epoch(s) ===", flush=True)

    model = DetectorNet(ARCHS[name], pretrained=True).to(DEVICE)
    if name == "robust" and weight_path("baseline").exists():
        model.load_state_dict(torch.load(weight_path("baseline"), map_location=DEVICE))
        print("  initialised from baseline weights (adversarial fine-tuning)")
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.05 if name == "vit" else 1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, lr, total_steps=epochs * steps_per_epoch, pct_start=0.15)
    scaler = torch.amp.GradScaler(enabled=AMP)
    ckpt_path = WEIGHTS_DIR / f"{name}_ckpt.pt"
    start_ep, start_step, history, best, minutes_before = 0, 0, [], -1.0, 0.0
    ck = None
    for cand in (ckpt_path, ckpt_path.with_suffix(".prev")):       # fall back if the latest is corrupt
        if cand.exists():
            try:
                ck = torch.load(cand, map_location=DEVICE, weights_only=False)
                break
            except Exception as e:
                print(f"  could not read {cand.name} ({e}); trying backup")
    if ck is not None:
        model.load_state_dict(ck["model"]), opt.load_state_dict(ck["opt"])
        sched.load_state_dict(ck["sched"]), scaler.load_state_dict(ck["scaler"])
        start_ep, start_step, history, best = ck["epoch"], ck["step"], ck["history"], ck["best"]
        minutes_before = ck.get("minutes", 0.0)
        print(f"  RESUMING from epoch {start_ep + 1}, step {start_step}/{steps_per_epoch}", flush=True)
    t_start = time.time()

    last_save = [time.time()]

    def save_ckpt(ep, step):
        """Atomic save: write temp file, keep previous checkpoint as .prev, then swap in."""
        tmp = ckpt_path.with_suffix(".tmp")
        torch.save({"model": model.state_dict(), "opt": opt.state_dict(), "sched": sched.state_dict(),
                    "scaler": scaler.state_dict(), "epoch": ep, "step": step, "history": history, "best": best,
                    "minutes": minutes_before + (time.time() - t_start) / 60}, tmp)
        if ckpt_path.exists():
            os.replace(ckpt_path, ckpt_path.with_suffix(".prev"))
        os.replace(tmp, ckpt_path)
        last_save[0] = time.time()

    for ep in range(start_ep, epochs):
        model.train()
        perm = torch.randperm(len(tr), generator=torch.Generator().manual_seed(ep)).tolist()
        skip = start_step if ep == start_ep else 0
        tl = DataLoader(Subset(tr, perm[skip * bs: steps_per_epoch * bs]), bs, num_workers=workers,
                        pin_memory=True, drop_last=True)
        pbar = tqdm(tl, desc=f"{name} ep{ep + 1}/{epochs}", ncols=100, initial=skip, total=steps_per_epoch)
        step = skip
        for x, y in pbar:
            x = x.to(DEVICE, non_blocking=True)
            y = y.to(DEVICE, non_blocking=True)
            if name == "robust":            # half clean / half adversarial keeps clean accuracy high
                h = x.shape[0] // 2
                x = torch.cat([x[:h], fgsm_rs(model, x[h:], y[h:], EPS, scaler)])
            with torch.autocast("cuda", enabled=AMP):
                loss = F.cross_entropy(model(x).float(), y, label_smoothing=0.05)
            opt.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            scaler.step(opt)
            scaler.update()
            sched.step()
            step += 1
            pbar.set_postfix(loss=f"{loss.item():.3f}")
            if step % 50 == 0 or time.time() - last_save[0] > 90:
                save_ckpt(ep, step)
            if cooldown:
                time.sleep(cooldown / 1000)
        acc, auc = evaluate(model, vl)
        history.append({"epoch": ep + 1, "val_acc": acc, "val_auc": auc})
        print(f"  val acc={acc:.4f}  auc={auc:.4f}", flush=True)
        if acc > best:
            best = acc
            torch.save(model.state_dict(), WEIGHTS_DIR / f"{name}_best.tmp")
            os.replace(WEIGHTS_DIR / f"{name}_best.tmp", WEIGHTS_DIR / f"{name}_best.pt")
        save_ckpt(ep + 1, 0)

    os.replace(WEIGHTS_DIR / f"{name}_best.pt", weight_path(name))
    minutes = round(minutes_before + (time.time() - t_start) / 60, 1)
    meta = {"name": name, "arch": ARCHS[name], "train_images": len(tr), "epochs": epochs,
            "init": "baseline" if name == "robust" else "imagenet",
            "best_val_acc": best, "history": history, "minutes": minutes}
    tmp = weight_path(name).with_suffix(".json.tmp")
    tmp.write_text(json.dumps(meta, indent=2))
    os.replace(tmp, weight_path(name).with_suffix(".json"))          # .json marks the model as finished
    for f in (ckpt_path, ckpt_path.with_suffix(".prev")):
        f.unlink(missing_ok=True)
    print(f"  saved {weight_path(name)} (best val acc {best:.4f}, {minutes} min)", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="all", choices=["all", *DEFAULTS])
    ap.add_argument("--per-class", type=int)
    ap.add_argument("--epochs", type=int)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--cooldown", type=int, default=0, help="ms pause per step (thermal safety)")
    ap.add_argument("--quick", action="store_true", help="tiny run for smoke-testing")
    a = ap.parse_args()
    torch.backends.cudnn.benchmark = True
    for n in (DEFAULTS if a.model == "all" else [a.model]):
        pc, ep, lr, bs = DEFAULTS[n]
        if a.quick:
            pc, ep = 500, 1
        train(n, a.per_class or pc, a.epochs or ep, lr, bs, a.workers, a.cooldown)
