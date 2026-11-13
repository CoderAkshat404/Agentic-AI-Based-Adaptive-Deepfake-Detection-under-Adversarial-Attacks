"""Agent 3 - Dynamic Model Selector.

Clean path     : two architecturally different detectors give a quick cross-check.
                 If they agree and are confident -> fast answer.
                 If they disagree or are unsure  -> full ensemble, and a strong disagreement is reported
                 so Agent 4 lowers confidence / requests human review.
                 (Validation: baseline alone 93.4%, 3-model ensemble 95.1%; on strong baseline-vs-ViT
                  disagreements the baseline is right only 45% of the time, so it must never decide alone.)
Perturbed path : the baseline is considered compromised (the attacker targeted it), so the
                 sanitized input is routed to models that do not share its weights.

Ensemble weights are chosen on the VALIDATION split by scripts/tune_ensemble.py and stored in
weights/ensemble.json; built-in defaults are used if that file is absent.
"""
import json

from config import WEIGHTS_DIR

NAMES = {"baseline": "Traditional", "robust": "Robust", "vit": "ViT", "clip": "CLIP"}
DEFAULT = {
    "fast_pair": ["baseline", "vit"],
    "clean": {"baseline": 0.4, "vit": 0.35, "robust": 0.25},
    "threat": {"robust": 0.35, "vit": 0.65},
}


class ModelSelectorAgent:
    name = "Agent 3 - Dynamic Model Selector"

    def __init__(self, zoo):
        self.zoo = zoo
        cfg_path = WEIGHTS_DIR / "ensemble.json"
        self.cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else DEFAULT
        avail = set(zoo.available())
        if not all(m in avail for k in ("clean", "threat") for m in self.cfg[k]) or not set(self.cfg["fast_pair"]) <= avail:
            self.cfg = DEFAULT                     # fall back safely if a configured model is missing

    def _p(self, name, x, cache):
        if name not in cache:
            cache[name] = float(self.zoo.p_fake(name, x)[0])
        return cache[name]

    def run(self, x_clean_path, x_sanitized, under_attack):
        outputs = {}
        if not under_attack:
            a, b = self.cfg["fast_pair"]
            pa, pb = self._p(a, x_clean_path, outputs), self._p(b, x_clean_path, outputs)
            if (pa >= 0.5) == (pb >= 0.5) and abs(pa - 0.5) > 0.35 and abs(pb - 0.5) > 0.2:
                w = {a: 0.5, b: 0.5}
                return {"route": f"Quick check: {NAMES[a]} and {NAMES[b]} agree", "outputs": outputs,
                        "weights": w, "p_fake": 0.5 * pa + 0.5 * pb, "disagreement": False}
            w = self.cfg["clean"]
            for n in w:
                self._p(n, x_clean_path, outputs)
            vals = [outputs[n] for n in w]
            disagreement = max(vals) - min(vals) > 0.5
            route = (f"Models disagree: all {len(w)} models vote, a person should check" if disagreement
                     else f"Models unsure: all {len(w)} models vote")
        else:
            w = self.cfg["threat"]
            for n in w:
                self._p(n, x_sanitized, outputs)
            vals = [outputs[n] for n in w]
            disagreement = max(vals) - min(vals) > 0.5
            route = "Attack path: " + " and ".join(NAMES[n] for n in w) + " check the cleaned image"
        p = sum(w[n] * outputs[n] for n in w)
        return {"route": route, "outputs": outputs, "weights": w, "p_fake": p, "disagreement": disagreement}
