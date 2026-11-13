"""Agent 1 - Noise & Attack Detector.

Estimates P(adv) and the attack type from three families of evidence:
  * Fourier analysis  : high-frequency energy ratio / spectral tail
  * Spatial noise     : median-filter residual statistics
  * Feature squeezing : how much the baseline detector's logit moves when the input is
                        squeezed (JPEG, median, bit-depth, blur). Adversarial perturbations are
                        brittle, so a large shift is a strong attack signature.
A gradient-boosted classifier (trained in scripts/train_attack_detector.py) maps features -> {clean, fgsm, pgd}.
"""
import joblib
import numpy as np
import torch

from config import WEIGHTS_DIR
from core.forensics import spectrum_features, residual_features
from core.sanitize import jpeg, median, bit_depth, gaussian

ATTACK_TYPES = ["clean", "fgsm", "pgd"]
FEATURE_NAMES = ["margin", "confidence", "d_jpeg", "d_median", "d_bits", "d_blur", "max_shift",
                 "flip_count", "hf_ratio", "spectral_tail", "residual_std", "residual_mad", "residual_kurt"]
CLF_PATH = WEIGHTS_DIR / "attack_detector.joblib"


@torch.no_grad()
def attack_features(baseline, x):
    """x: (B,3,H,W) on device. Returns (B, F) numpy feature matrix."""
    def margin(inp):
        z = baseline(inp).float()
        return z[:, 1] - z[:, 0]

    m = margin(x)
    squeezed = [jpeg(x, 75), median(x, 3), bit_depth(x, 5), gaussian(x, 0.8)]
    shifts = torch.stack([(margin(s) - m).abs() for s in squeezed], 1)
    flips = torch.stack([(torch.sign(margin(s)) != torch.sign(m)).float() for s in squeezed], 1).sum(1)
    conf = torch.sigmoid(m.abs())
    hf, tail = spectrum_features(x)
    std, mad, kurt = residual_features(x)
    feats = torch.cat([m[:, None], conf[:, None], shifts, shifts.max(1, keepdim=True).values, flips[:, None],
                       hf[:, None], tail[:, None], std[:, None], mad[:, None], kurt.clamp(max=200)[:, None]], 1)
    return feats.cpu().numpy()


class NoiseDetectorAgent:
    name = "Agent 1 - Noise & Attack Detector"

    def __init__(self, zoo):
        self.zoo = zoo
        self.clf = joblib.load(CLF_PATH) if CLF_PATH.exists() else None

    def assess(self, x):
        feats = attack_features(self.zoo.get("baseline"), x)
        if self.clf is None:                      # heuristic fallback before training
            p = np.clip(feats[:, 6] / 6.0, 0, 1)
            probs = np.stack([1 - p, p * 0.5, p * 0.5], 1)
        else:
            probs = self.clf.predict_proba(feats)
        p_adv = 1 - probs[:, 0]
        kinds = [ATTACK_TYPES[i] for i in probs.argmax(1)]
        return {"p_adv": p_adv, "attack_probs": probs, "attack_type": kinds, "features": feats}
