"""Train Agent 1's attack classifier (clean / FGSM / PGD) and Agent 4's forensic calibration.

Clean class includes JPEG-recompressed and blurred images so ordinary compressed uploads
are not mistaken for attacks. Attacks use random eps in [2,8]/255 to generalise across strengths.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib
import numpy as np
import torch
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader
from tqdm import tqdm

from config import DEVICE, RESULTS_DIR
from core.attacks import fgsm, pgd
from core.data import FaceDataset, build_transform, list_samples
from core.forensics import forensic_cues
from core.models import ModelZoo
from core.sanitize import jpeg, gaussian
from agents.noise_detector import attack_features, CLF_PATH, ATTACK_TYPES
from agents.verifier import VERIFIER_PATH

EPS_CHOICES = [2, 3, 4, 6, 8]


CACHE = RESULTS_DIR / "cache" / "attack_features"


def batch_features(base, x, y, rng):
    b = x.shape[0]
    X, Y = [], []
    # clean (+ benign compression / blur variants)
    q = int(rng.integers(55, 96))
    for cv in (x, jpeg(x, q), gaussian(x, float(rng.uniform(0.4, 1.0)))):
        X.append(attack_features(base, cv)), Y.extend([0] * b)
    eps = rng.choice(EPS_CHOICES) / 255
    X.append(attack_features(base, fgsm(base, x, y, eps))), Y.extend([1] * b)
    eps = rng.choice(EPS_CHOICES) / 255
    X.append(attack_features(base, pgd(base, x, y, eps, eps / 4, int(rng.integers(5, 16))))), Y.extend([2] * b)
    return np.concatenate(X), np.array(Y), forensic_cues(x), y.cpu().numpy()


def main(per_class=900):
    """Resumable: each batch's features are cached to disk, so a shutdown loses at most one batch."""
    CACHE.mkdir(parents=True, exist_ok=True)
    zoo = ModelZoo()
    base = zoo.get("baseline")
    ds = FaceDataset(list_samples("Validation", per_class, seed=7), build_transform(False))
    dl = DataLoader(ds, 32, num_workers=4)
    done = len(list(CACHE.glob("b*.npz")))
    if done:
        print(f"resuming: {done} batches already cached")
    for i, (x, y) in enumerate(tqdm(dl, desc="building attack-detector features", ncols=100)):
        f = CACHE / f"b{i:04d}.npz"
        if f.exists():
            continue
        torch.manual_seed(i)
        rng = np.random.default_rng(i)
        Xb, Yb, Cb, Lb = batch_features(base, x.to(DEVICE), y.to(DEVICE), rng)
        tmp = CACHE / f"b{i:04d}.tmp.npz"
        np.savez(tmp, X=Xb, Y=Yb, C=Cb, L=Lb)
        os.replace(tmp, f)
    parts = [np.load(p) for p in sorted(CACHE.glob("b[0-9]*.npz")) if ".tmp" not in p.name]
    X, Y = np.concatenate([p["X"] for p in parts]), np.concatenate([p["Y"] for p in parts])
    C, L = [p["C"] for p in parts], [p["L"] for p in parts]
    Xtr, Xte, ytr, yte = train_test_split(X, Y, test_size=0.2, stratify=Y, random_state=0)
    clf = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, max_leaf_nodes=31,
                                         class_weight={0: 1.0, 1: 1.5, 2: 1.5}, random_state=0)
    clf.fit(Xtr, ytr)
    pr = clf.predict_proba(Xte)
    print(classification_report(yte, pr.argmax(1), target_names=ATTACK_TYPES, digits=4))
    print("binary adversarial-vs-clean AUC:", round(roc_auc_score(yte > 0, 1 - pr[:, 0]), 4))
    clf.fit(X, Y)
    joblib.dump(clf, CLF_PATH)
    print("saved", CLF_PATH)

    # ---- Agent 4 forensic calibration (clean images only)
    C, L = np.concatenate(C), np.concatenate(L)
    vclf = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5))
    vclf.fit(C, L)
    acc = (vclf.predict(C) == L).mean()
    bundle = {"clf": vclf,
              "mu_real": C[L == 0].mean(0), "sd_real": C[L == 0].std(0) + 1e-6,
              "mu_fake": C[L == 1].mean(0), "sd_fake": C[L == 1].std(0) + 1e-6,
              "train_acc": float(acc)}
    joblib.dump(bundle, VERIFIER_PATH)
    print(f"saved {VERIFIER_PATH} (forensic-only accuracy {acc:.3f})")


if __name__ == "__main__":
    main()
