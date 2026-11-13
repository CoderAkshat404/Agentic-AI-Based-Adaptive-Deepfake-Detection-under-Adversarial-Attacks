"""Agent 2 - Adaptive Sanitizer.

Chooses a starting purification strength from the threat assessment (attack type and P(adv)),
applies it, then *re-asks Agent 1* whether the residual perturbation is gone. If not, it escalates
to a stronger recipe (closed-loop self-verification, max 3 rounds). Image quality (PSNR) is logged.
"""
import time

from config import P_ADV_THRESHOLD
from core.sanitize import RECIPES, psnr


class SanitizerAgent:
    name = "Agent 2 - Adaptive Sanitizer"

    def __init__(self, detector_agent, max_rounds=3):
        self.detector = detector_agent
        self.max_rounds = max_rounds

    # Attack-specific starting recipe, chosen on the validation split (scripts/tune notes in README):
    #   FGSM (dense, full-budget sign noise) -> TV denoise + JPEG-70 removes it best
    #   PGD  (fine iterative structure)       -> JPEG-70 + median-3 is enough and preserves detail
    START = {"fgsm": 2, "pgd": 1}

    def start_level(self, attack_type, p_adv):
        level = self.START.get(attack_type, 1)
        return min(level, len(RECIPES) - 1)

    def run(self, x, attack_type, p_adv):
        level = self.start_level(attack_type, p_adv)
        trace = []
        x_s = x
        for _ in range(self.max_rounds):
            t0 = time.perf_counter()
            name, fn = RECIPES[level]
            x_s = fn(x)
            re = self.detector.assess(x_s)
            residual = float(re["p_adv"][0])
            trace.append({"recipe": name, "residual_p_adv": round(residual, 3),
                          "psnr_db": round(psnr(x_s, x), 2), "ms": round((time.perf_counter() - t0) * 1000, 1)})
            if residual < P_ADV_THRESHOLD or level == len(RECIPES) - 1:
                break
            level += 1
        return x_s, trace
