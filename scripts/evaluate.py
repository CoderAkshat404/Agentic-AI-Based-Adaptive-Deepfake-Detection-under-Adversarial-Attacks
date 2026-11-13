"""Benchmark: Traditional detector vs Agentic framework under FGSM / PGD (held-out Test split).

Threat model (as in the design doc): the attacker is model-aware and crafts L-inf perturbations
(eps = 4/255, invisible) against the deployed traditional detector. We also report a harder
'adaptive' stress test where PGD targets the adversarially-trained model directly.

    python scripts/evaluate.py --per-class 300
"""
import argparse
import json
import os
import pickle
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.metrics import roc_auc_score
from torch.utils.data import DataLoader
from tqdm import tqdm

from config import DEVICE, EPS, PGD_ALPHA, PGD_STEPS, RESULTS_DIR, P_ADV_THRESHOLD
from core.attacks import fgsm, pgd
from core.data import FaceDataset, build_transform, list_samples
from core.sanitize import jpeg
from agents.orchestrator import AgenticOrchestrator, GRAPH_ENGINE


def main(per_class, eps):
    torch.manual_seed(0)
    orch = AgenticOrchestrator()
    zoo = orch.zoo
    base, robust = zoo.get("baseline"), zoo.get("robust")
    ds = FaceDataset(list_samples("Test", per_class, seed=123), build_transform(False))
    dl = DataLoader(ds, 16, num_workers=2)

    conds = {"Clean": lambda x, y: x,
             "FGSM": lambda x, y: fgsm(base, x, y, eps),
             "PGD": lambda x, y: pgd(base, x, y, eps, PGD_ALPHA, PGD_STEPS),
             "PGD-adaptive (targets robust CNN)": lambda x, y: pgd(robust, x, y, eps, PGD_ALPHA, PGD_STEPS)}
    systems = ["Traditional (EfficientNet-B0)", "Static defense (JPEG + baseline)", "Adv-trained CNN only", "Agentic AI (full)"]
    P = {c: {s: [] for s in systems} for c in conds}
    flagged = {c: [] for c in conds}
    lat = {c: [] for c in conds}
    labels = []

    # Resumable: every batch's results are cached, so a shutdown loses at most one batch.
    cache = RESULTS_DIR / "cache" / f"eval_eps{round(eps * 255)}_n{per_class}"
    cache.mkdir(parents=True, exist_ok=True)
    for bi, (x, y) in enumerate(tqdm(dl, desc="benchmark", ncols=100)):
        f = cache / f"b{bi:04d}.pkl"
        if not f.exists():
            torch.manual_seed(bi)
            x, y = x.to(DEVICE), y.to(DEVICE)
            rec = {"y": y.cpu().numpy(), "P": {}, "flag": {}, "lat": {}}
            for c, fn in conds.items():
                xa = fn(x, y)
                rec["P"][c] = {systems[0]: zoo.p_fake("baseline", xa).cpu().numpy(),
                               systems[1]: zoo.p_fake("baseline", jpeg(xa, 75)).cpu().numpy(),
                               systems[2]: zoo.p_fake("robust", xa).cpu().numpy()}
                ag, fl, lt = [], [], []
                for i in range(xa.shape[0]):
                    if DEVICE.type == "cuda":
                        torch.cuda.synchronize()
                    out = orch.run_tensor(xa[i:i + 1])
                    lt.append(out["timings"]["total"])
                    ag.append(out["verdict"]["p_fake"])
                    fl.append(out["threat"]["under_attack"])
                rec["P"][c][systems[3]] = np.array(ag)
                rec["flag"][c], rec["lat"][c] = fl, lt
            tmp = f.with_suffix(".tmp")
            tmp.write_bytes(pickle.dumps(rec))
            os.replace(tmp, f)
        rec = pickle.loads(f.read_bytes())
        labels.append(rec["y"])
        for c in conds:
            for s in systems:
                P[c][s].append(rec["P"][c][s])
            flagged[c] += rec["flag"][c]
            lat[c] += rec["lat"][c]

    y = np.concatenate(labels)
    res = {"n_images": int(len(y)), "eps": f"{round(eps * 255)}/255", "pgd_steps": PGD_STEPS,
           "graph_engine": GRAPH_ENGINE, "p_adv_threshold": P_ADV_THRESHOLD, "results": {}}
    for c in conds:
        res["results"][c] = {}
        for s in systems:
            p = np.concatenate(P[c][s])
            pred = p >= 0.5
            res["results"][c][s] = {
                "accuracy": float((pred == y).mean()),
                "fake_detection_rate": float(pred[y == 1].mean()),
                "auc": float(roc_auc_score(y, p)),
            }
        res["results"][c]["_agent1_flag_rate"] = float(np.mean(flagged[c]))
        res["results"][c]["_latency_ms_mean"] = float(np.mean(lat[c]))
    trad, agen = systems[0], systems[3]
    for c in ("FGSM", "PGD"):
        asr_t = res["results"]["Clean"][trad]["accuracy"] - res["results"][c][trad]["accuracy"]
        asr_a = res["results"]["Clean"][agen]["accuracy"] - res["results"][c][agen]["accuracy"]
        res["results"][c]["_attack_damage_reduction_pct"] = float(100 * (1 - asr_a / max(asr_t, 1e-6)))
    robust_acc = np.mean([res["results"][c][agen]["accuracy"] for c in ("FGSM", "PGD")])
    res["headline"] = {"robust_accuracy_under_attack": float(robust_acc),
                       "clean_auc": res["results"]["Clean"][agen]["auc"],
                       "latency_clean_ms": res["results"]["Clean"]["_latency_ms_mean"],
                       "latency_attacked_ms": res["results"]["PGD"]["_latency_ms_mean"]}
    (RESULTS_DIR / "benchmark.json").write_text(json.dumps(res, indent=2))

    # ---- console table
    print(f"\nBenchmark on {len(y)} held-out test images, eps={res['eps']}, graph engine: {GRAPH_ENGINE}")
    print(f"{'Condition':36s}" + "".join(f"{s[:24]:>27s}" for s in systems) + f"{'Agent1 flags':>14s}")
    for c in conds:
        row = "".join(f"{res['results'][c][s]['accuracy'] * 100:26.1f}%" for s in systems)
        print(f"{c:36s}{row}{res['results'][c]['_agent1_flag_rate'] * 100:13.1f}%")
    print("headline:", json.dumps(res["headline"], indent=1))

    # ---- chart like the design-doc figure (real numbers)
    rows = [("Clean (Traditional)", res["results"]["Clean"][trad]["accuracy"], "#22c55e"),
            ("Clean (Agentic AI)", res["results"]["Clean"][agen]["accuracy"], "#16a34a"),
            ("FGSM (Traditional)", res["results"]["FGSM"][trad]["accuracy"], "#ef4444"),
            ("FGSM (Agentic AI)", res["results"]["FGSM"][agen]["accuracy"], "#3b82f6"),
            ("PGD (Traditional)", res["results"]["PGD"][trad]["accuracy"], "#ef4444"),
            ("PGD (Agentic AI)", res["results"]["PGD"][agen]["accuracy"], "#3b82f6")]
    fig, ax = plt.subplots(figsize=(9, 4.2))
    names, vals, cols = zip(*rows)
    ax.barh(names[::-1], [v * 100 for v in vals[::-1]], color=cols[::-1])
    for i, v in enumerate(vals[::-1]):
        ax.text(v * 100 + 1, i, f"{v * 100:.1f}%", va="center")
    ax.set_xlim(0, 110)
    ax.set_xlabel("Accuracy (%)")
    ax.set_title(f"Traditional vs Agentic detection under attack (eps={res['eps']}, n={len(y)})")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "benchmark_bar.png", dpi=160)
    print("saved", RESULTS_DIR / "benchmark.json", "and benchmark_bar.png")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=128)
    ap.add_argument("--eps", type=float, default=EPS * 255)
    a = ap.parse_args()
    main(a.per_class, a.eps / 255)
