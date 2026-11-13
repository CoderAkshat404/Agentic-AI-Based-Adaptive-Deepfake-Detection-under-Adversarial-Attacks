"""Robustness curve: accuracy vs perturbation budget (PGD-10 against the traditional detector).
Held-out Test split, cached per (eps, batch) so it can resume. Writes results/eps_sweep.json."""
import json
import os
import pickle
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import torch
from torch.utils.data import DataLoader

from config import DEVICE, RESULTS_DIR
from core.attacks import pgd
from core.data import FaceDataset, build_transform, list_samples
from agents.orchestrator import AgenticOrchestrator

EPS_LIST = [0, 1, 2, 4, 8, 12]


def main(per_class=48):
    orch = AgenticOrchestrator()
    base = orch.zoo.get("baseline")
    dl = DataLoader(FaceDataset(list_samples("Test", per_class, seed=321), build_transform(False)), 16, num_workers=0)
    cache = RESULTS_DIR / "cache" / "eps_sweep"
    cache.mkdir(parents=True, exist_ok=True)
    out = {}
    for e in EPS_LIST:
        trad, agen, flag = [], [], []
        for bi, (x, y) in enumerate(dl):
            f = cache / f"e{e}_b{bi}.pkl"
            if not f.exists():
                torch.manual_seed(bi)
                x, y = x.to(DEVICE), y.to(DEVICE)
                xa = x if e == 0 else pgd(base, x, y, e / 255, max(e / 4, 0.5) / 255, 10)
                t = ((orch.zoo.p_fake("baseline", xa) >= 0.5).long() == y).cpu().numpy()
                a, fl = [], []
                for i in range(xa.shape[0]):
                    r = orch.run_tensor(xa[i:i + 1])
                    a.append(int((r["verdict"]["p_fake"] >= 0.5) == bool(y[i].item())))
                    fl.append(int(r["threat"]["under_attack"]))
                tmp = f.with_suffix(".tmp")
                tmp.write_bytes(pickle.dumps((t, np.array(a), np.array(fl))))
                os.replace(tmp, f)
            t, a, fl = pickle.loads(f.read_bytes())
            trad.append(t), agen.append(a), flag.append(fl)
        out[e] = {"traditional": float(np.concatenate(trad).mean()), "agentic": float(np.concatenate(agen).mean()),
                  "agent1_flag_rate": float(np.concatenate(flag).mean())}
        print(e, out[e], flush=True)
    (RESULTS_DIR / "eps_sweep.json").write_text(json.dumps({"n_images": 2 * per_class, "attack": "PGD-10 on traditional",
                                                             "results": out}, indent=2))


if __name__ == "__main__":
    main()
