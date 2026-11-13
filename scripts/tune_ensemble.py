"""Choose Agent 3's ensemble weights on the VALIDATION split (never the test split).

Scores every detector on: clean images, PhoneStyle copies (out-of-distribution robustness),
and FGSM / PGD images (crafted against the baseline, then sanitized with Agent 2's starting recipe).
Prints accuracy of candidate weightings so the choice is transparent; saves results/ensemble_tuning.json.
"""
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
import torchvision.transforms as T

from config import DEVICE, EPS, IMG_SIZE, PGD_ALPHA, PGD_STEPS, RESULTS_DIR
from core.attacks import fgsm, pgd
from core.data import PhoneStyle, list_samples
from core.models import ModelZoo
from core.sanitize import RECIPES
from agents.sanitizer import SanitizerAgent

MODELS = ["baseline", "robust", "vit", "clip"]


class DS(Dataset):
    def __init__(self, s, phone):
        self.s, self.phone = s, phone
        self.tf = T.Compose([T.Resize((IMG_SIZE, IMG_SIZE)), T.ToTensor()])

    def __len__(self):
        return len(self.s)

    def __getitem__(self, i):
        img = Image.open(self.s[i][0]).convert("RGB")
        if self.phone:
            random.seed(10_000 + i)
            img = PhoneStyle(p=1.0)(img)
        return self.tf(img), self.s[i][1]


def main(per_class=200):
    zoo = ModelZoo()
    base = zoo.get("baseline")
    s = list_samples("Validation", 1200, seed=3)[-2 * per_class:]       # disjoint from earlier val subsets' seeds
    P = {c: {m: [] for m in MODELS} for c in ("clean", "phone", "fgsm", "pgd")}
    Y = []
    for phone in (False, True):
        for x, y in DataLoader(DS(s, phone), 32, num_workers=4):
            x, y = x.to(DEVICE), y.to(DEVICE)
            if not phone:
                Y.append(y.cpu().numpy())
                conds = {"clean": x,
                         "fgsm": RECIPES[SanitizerAgent.START["fgsm"]][1](fgsm(base, x, y, EPS)),
                         "pgd": RECIPES[SanitizerAgent.START["pgd"]][1](pgd(base, x, y, EPS, PGD_ALPHA, PGD_STEPS))}
            else:
                conds = {"phone": x}
            for c, xc in conds.items():
                for m in MODELS:
                    P[c][m].append(zoo.p_fake(m, xc).cpu().numpy())
    Y = np.concatenate(Y)
    P = {c: {m: np.concatenate(v) for m, v in d.items()} for c, d in P.items()}
    acc = lambda p: float(((p >= 0.5) == Y).mean())
    out = {"single": {c: {m: acc(P[c][m]) for m in MODELS} for c in P}, "clean_path": {}, "threat_path": {}}
    print("single models:")
    for c in P:
        print(f"  {c:6s}", "  ".join(f"{m}={acc(P[c][m]) * 100:.1f}%" for m in MODELS))

    clean_cands = [{"baseline": .4, "vit": .35, "robust": .25}, {"baseline": .3, "vit": .3, "clip": .4},
                   {"baseline": .25, "vit": .25, "robust": .1, "clip": .4}, {"baseline": .2, "vit": .3, "clip": .5},
                   {"baseline": .34, "vit": .33, "clip": .33}, {"vit": .4, "clip": .6}]
    print("clean path (clean / phone-style):")
    for w in clean_cands:
        r = [acc(sum(w[m] * P[c][m] for m in w)) for c in ("clean", "phone")]
        out["clean_path"][json.dumps(w)] = r
        print(f"  {w}: {r[0] * 100:.1f}% / {r[1] * 100:.1f}%")
    threat_cands = [{"robust": .35, "vit": .65}, {"robust": .2, "vit": .4, "clip": .4}, {"vit": .5, "clip": .5},
                    {"robust": .15, "vit": .35, "clip": .5}, {"vit": .35, "clip": .65}]
    print("threat path (fgsm / pgd, after sanitization):")
    for w in threat_cands:
        r = [acc(sum(w[m] * P[c][m] for m in w)) for c in ("fgsm", "pgd")]
        out["threat_path"][json.dumps(w)] = r
        print(f"  {w}: {r[0] * 100:.1f}% / {r[1] * 100:.1f}%")
    (RESULTS_DIR / "ensemble_tuning.json").write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
