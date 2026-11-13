"""Train the CLIP-based detector (UnivFD-style, Ojha et al., CVPR 2023).

A frozen OpenAI CLIP ViT-B/16 image encoder (pre-trained on 400M internet image-text pairs) gives
general-purpose features; only a linear layer is trained on top. Because the backbone is not fine-tuned
on our small dataset, it does not overfit to dataset-specific artefacts and generalises better to
unseen photo styles (e.g. smartphone portrait mode). Training data mixes clean images with
PhoneStyle-augmented copies of BOTH classes.

Crash-safe: features are cached per batch; re-running resumes.
    python scripts/train_clip_detector.py
"""
import json
import os
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import timm
import torch
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from torch.utils.data import DataLoader, Dataset
import torchvision.transforms as T

from config import ARCHS, DEVICE, IMG_SIZE, RESULTS_DIR, WEIGHTS_DIR
from core.data import PhoneStyle, list_samples
from core.models import DetectorNet, weight_path

ARCH = ARCHS["clip"]
CACHE = RESULTS_DIR / "cache" / "clip_features"


class FeatDataset(Dataset):
    """Deterministic per-index augmentation so cached batches are reproducible after a resume."""

    def __init__(self, samples, phone):
        self.samples, self.phone = samples, phone
        self.tf = T.Compose([T.Resize((IMG_SIZE, IMG_SIZE)), T.ToTensor()])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, i):
        path, label = self.samples[i]
        img = Image.open(path).convert("RGB")
        if self.phone:
            random.seed(i)
            img = PhoneStyle(p=1.0)(img)
        return self.tf(img), label


@torch.no_grad()
def extract(model, samples, phone, tag):
    d = CACHE / tag
    d.mkdir(parents=True, exist_ok=True)
    dl = DataLoader(FeatDataset(samples, phone), 64, num_workers=6)
    n_done = 0
    for bi, (x, y) in enumerate(dl):
        f = d / f"b{bi:04d}.npz"
        if not f.exists():
            x = x.to(DEVICE)
            with torch.autocast("cuda", enabled=DEVICE.type == "cuda"):
                feats = model((x - model.mean) / model.std).float().cpu().numpy()
            tmp = d / f"b{bi:04d}.tmp.npz"
            np.savez(tmp, F=feats, Y=y.numpy())
            os.replace(tmp, f)
        n_done += len(y)
        print(f"\r  {tag}: {n_done}/{len(samples)}", end="", flush=True)
    print()
    parts = [np.load(d / f"b{bi:04d}.npz") for bi in range(len(dl))]
    return np.concatenate([p["F"] for p in parts]), np.concatenate([p["Y"] for p in parts])


def main():
    torch.manual_seed(0)
    enc = timm.create_model(ARCH, pretrained=True, num_classes=0).to(DEVICE).eval()
    cfg = enc.pretrained_cfg
    enc.mean = torch.tensor(cfg["mean"], device=DEVICE).view(1, 3, 1, 1)
    enc.std = torch.tensor(cfg["std"], device=DEVICE).view(1, 3, 1, 1)
    # first 8000 of a fixed shuffled order (balanced by construction of the shuffle); a frozen encoder + linear
    # probe saturates quickly, so more images give little extra accuracy for a lot of extraction time.
    tr, va = list_samples("Train", None, seed=1)[:8000], list_samples("Validation", 800, seed=2)
    print(f"CLIP encoder {ARCH}; train {len(tr)} images (+ phone-style copies), val {len(va)}")
    Ftr_c, Ytr_c = extract(enc, tr, False, "train_clean")
    Ftr_p, Ytr_p = extract(enc, tr, True, "train_phone")
    Fva_c, Yva_c = extract(enc, va, False, "val_clean")
    Fva_p, Yva_p = extract(enc, va, True, "val_phone")
    Ftr, Ytr = np.concatenate([Ftr_c, Ftr_p]), np.concatenate([Ytr_c, Ytr_p])

    mu, sd = Ftr.mean(0), Ftr.std(0) + 1e-6
    z = lambda F: (F - mu) / sd
    best = None
    for C in (0.02, 0.05, 0.1, 0.3, 1.0):
        lr = LogisticRegression(C=C, max_iter=3000).fit(z(Ftr), Ytr)
        acc_c = (lr.predict(z(Fva_c)) == Yva_c).mean()
        acc_p = (lr.predict(z(Fva_p)) == Yva_p).mean()
        print(f"  C={C:<5} val clean acc {acc_c:.4f} | val phone-style acc {acc_p:.4f}")
        if best is None or acc_c + acc_p > best[0]:
            best = (acc_c + acc_p, C, lr, acc_c, acc_p)
    _, C, lr, acc_c, acc_p = best
    auc = roc_auc_score(Yva_c, lr.predict_proba(z(Fva_c))[:, 1])

    # fold the standardisation into a single linear head: logit = (w/sd).f + (b - sum(w*mu/sd))
    w = lr.coef_[0] / sd
    b = lr.intercept_[0] - float((lr.coef_[0] * mu / sd).sum())
    det = DetectorNet(ARCH, pretrained=True)
    head = det.backbone.get_classifier()
    with torch.no_grad():
        head.weight.zero_(), head.bias.zero_()
        head.weight[1] = torch.tensor(w, dtype=head.weight.dtype)
        head.bias[1] = float(b)
    tmp = WEIGHTS_DIR / "clip.tmp"
    torch.save(det.state_dict(), tmp)
    os.replace(tmp, weight_path("clip"))
    # The encoder is the unchanged public CLIP model, so the trained part fits in a tiny file (git-friendly).
    torch.save(head.state_dict(), WEIGHTS_DIR / "clip_head.pt")
    meta = {"name": "clip", "arch": ARCH, "train_images": int(len(Ytr)), "epochs": 0, "init": "CLIP (frozen) + linear probe",
            "best_val_acc": float(acc_c), "val_phone_style_acc": float(acc_p), "val_auc": float(auc), "C": C, "minutes": 0}
    weight_path("clip").with_suffix(".json").write_text(json.dumps(meta, indent=2))
    print(f"saved {weight_path('clip')}  (val clean {acc_c:.4f}, phone-style {acc_p:.4f}, AUC {auc:.4f})")


if __name__ == "__main__":
    main()
