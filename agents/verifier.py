"""Agent 4 - Forensic Verifier.

Computes independent, signal-level forensic cues (spectrum, noise residual, texture, lighting) and a
calibrated forensic score (logistic model trained on clean validation data). It
  * cross-checks the model verdict and lowers confidence on disagreement,
  * breaks ties when the ensemble is uncertain (0.35 < p < 0.65),
  * for videos, adds temporal consistency + blink-rate physiology checks,
and writes the final explainable audit log.
"""
import joblib
import numpy as np

from config import WEIGHTS_DIR, CLASS_NAMES
from core.forensics import forensic_cues, CUE_NAMES

VERIFIER_PATH = WEIGHTS_DIR / "verifier.joblib"


class VerifierAgent:
    name = "Agent 4 - Forensic Verifier"

    def __init__(self):
        self.bundle = joblib.load(VERIFIER_PATH) if VERIFIER_PATH.exists() else None

    def cue_report(self, x):
        cues = forensic_cues(x)[0]
        if self.bundle is None:
            return cues, None, [0.5] * len(cues)
        mu_r, sd_r, mu_f, sd_f = (self.bundle[k] for k in ("mu_real", "sd_real", "mu_fake", "sd_fake"))
        # per-cue "fakeness" in [0,1]: Gaussian likelihood ratio under the class-conditional stats
        lr = (-((cues - mu_f) / sd_f) ** 2 + ((cues - mu_r) / sd_r) ** 2) / 2 + np.log(sd_r / sd_f)
        per_cue = 1 / (1 + np.exp(-np.clip(lr, -10, 10)))
        p_forensic = float(self.bundle["clf"].predict_proba(cues[None])[0, 1])
        return cues, p_forensic, per_cue.tolist()

    def run(self, x_used, p_model, selector_out, video_stats=None):
        cues, p_forensic, per_cue = self.cue_report(x_used)
        p_final = p_model
        notes = []
        if p_forensic is not None and 0.35 < p_model < 0.65:
            p_final = 0.6 * p_model + 0.4 * p_forensic
            notes.append("The models were unsure, so the image clue check helped decide.")
        outs = list(selector_out["outputs"].values())
        agreement = 1 - (max(outs) - min(outs)) if len(outs) > 1 else 1.0
        if p_forensic is not None and (p_forensic > 0.5) != (p_model > 0.5):
            notes.append("The image clue check disagrees with the models.")
        if video_stats:
            if video_stats.get("temporal_std", 0) > 0.25:
                notes.append("Scores jump a lot between frames, which is common in deepfake videos.")
            bpm = video_stats.get("blinks_per_min")
            if bpm is not None and bpm < 4:
                notes.append(f"Very low blink rate ({bpm} per minute). People normally blink 8-30 times per minute.")
        label = int(p_final >= 0.5)
        confidence = abs(p_final - 0.5) * 2
        confidence *= 0.85 + 0.15 * agreement
        if p_forensic is not None and (p_forensic > 0.5) != bool(label):
            confidence *= 0.85
        disagreement = bool(selector_out.get("disagreement"))
        if disagreement:
            confidence *= 0.6
            notes.insert(0, "The models strongly disagree. This photo may look different from the training photos "
                            "(for example phone portrait mode or a beauty filter), so a person should check it.")
        return {
            "label": CLASS_NAMES[label], "p_fake": float(p_final), "confidence": float(confidence),
            "p_forensic": p_forensic, "model_agreement": float(agreement),
            "cues": dict(zip(CUE_NAMES, map(float, cues))),
            "cue_fakeness": dict(zip(CUE_NAMES, per_cue)),
            "notes": notes or ["The image clue check agrees with the models."],
            "needs_human_review": confidence < 0.3 or disagreement,
        }
