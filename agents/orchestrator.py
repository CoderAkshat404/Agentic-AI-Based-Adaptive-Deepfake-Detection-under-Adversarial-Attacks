"""Central Orchestrator Agent.

Builds the execution graph with LangGraph (StateGraph + conditional edges). If LangGraph is not
installed, an API-compatible minimal state-graph engine is used, so the system always runs.

    ingest -> attack_audit --(P(adv) > 0.65)--> sanitize -> dispatch -> verify -> END
                         \--(clean)----------------------^
"""
import time
from typing import Any, Dict, List, TypedDict

import numpy as np
from PIL import Image

from config import DEVICE, P_ADV_THRESHOLD, EPS, PGD_STEPS
from core.attacks import attack
from core.data import load_image_tensor
from core.face import crop_face, sample_frames, blink_analysis
from core.models import ModelZoo
from agents.noise_detector import NoiseDetectorAgent
from agents.sanitizer import SanitizerAgent
from agents.model_selector import ModelSelectorAgent
from agents.verifier import VerifierAgent

try:
    from langgraph.graph import StateGraph, END
    GRAPH_ENGINE = "LangGraph"
except Exception:                                   # pragma: no cover - fallback engine
    GRAPH_ENGINE = "built-in StateGraph"
    END = "__end__"

    class StateGraph:                               # minimal LangGraph-compatible engine
        def __init__(self, _schema):
            self.nodes, self.edges, self.cond, self.entry = {}, {}, {}, None

        def add_node(self, name, fn): self.nodes[name] = fn
        def set_entry_point(self, name): self.entry = name
        def add_edge(self, a, b): self.edges[a] = b
        def add_conditional_edges(self, a, router, mapping): self.cond[a] = (router, mapping)

        def compile(self):
            graph = self

            class _App:
                def invoke(self, state):
                    node = graph.entry
                    while node != END:
                        state = {**state, **(graph.nodes[node](state) or {})}
                        if node in graph.cond:
                            router, mapping = graph.cond[node]
                            node = mapping[router(state)]
                        else:
                            node = graph.edges[node]
                    return state
            return _App()


class PipelineState(TypedDict, total=False):
    x: Any
    x_sanitized: Any
    ingest: Dict
    threat: Dict
    sanitization: List
    selection: Dict
    verdict: Dict
    log: List
    timings: Dict
    video_stats: Dict


class AgenticOrchestrator:
    def __init__(self, device=DEVICE):
        self.zoo = ModelZoo(device)
        self.device = device
        self.agent1 = NoiseDetectorAgent(self.zoo)
        self.agent2 = SanitizerAgent(self.agent1)
        self.agent3 = ModelSelectorAgent(self.zoo)
        self.agent4 = VerifierAgent()
        self.app = self._build_graph()

    # ------------------------------------------------------------------ graph nodes
    def _attack_audit(self, s):
        t0 = time.perf_counter()
        r = self.agent1.assess(s["x"])
        p_adv, kind = float(r["p_adv"][0]), r["attack_type"][0]
        under = p_adv > P_ADV_THRESHOLD
        threat = {"p_adv": p_adv, "attack_type": kind if under else "clean", "under_attack": under,
                  "attack_probs": dict(zip(["clean", "fgsm", "pgd"], map(float, r["attack_probs"][0])))}
        msg = (f"Chance of attack: {p_adv:.0%} -> " +
               (f"ATTACKED ({kind.upper()}). Sending the image to Agent 2 for cleaning." if under
                else "no attack found. Sending the image straight to the models."))
        return {"threat": threat, "log": s["log"] + [(self.agent1.name, msg)],
                "timings": {**s["timings"], "attack_audit": (time.perf_counter() - t0) * 1000}}

    def _sanitize(self, s):
        t0 = time.perf_counter()
        x_s, trace = self.agent2.run(s["x"], s["threat"]["attack_type"], s["threat"]["p_adv"])
        msg = " -> ".join(f"{t['recipe']} (attack still detected: {t['residual_p_adv']:.0%}, image quality {t['psnr_db']:.0f} dB)"
                         for t in trace)
        return {"x_sanitized": x_s, "sanitization": trace, "log": s["log"] + [(self.agent2.name, msg)],
                "timings": {**s["timings"], "sanitize": (time.perf_counter() - t0) * 1000}}

    def _dispatch(self, s):
        t0 = time.perf_counter()
        under = s["threat"]["under_attack"]
        sel = self.agent3.run(s["x"], s.get("x_sanitized", s["x"]), under)
        from agents.model_selector import NAMES
        outs = ", ".join(f"{NAMES[k]} {v:.0%}" for k, v in sel["outputs"].items())
        return {"selection": sel, "log": s["log"] + [(self.agent3.name, f"{sel['route']}. Fake score: {outs}")],
                "timings": {**s["timings"], "dispatch": (time.perf_counter() - t0) * 1000}}

    def _verify(self, s):
        t0 = time.perf_counter()
        x_used = s.get("x_sanitized", s["x"]) if s["threat"]["under_attack"] else s["x"]
        v = self.agent4.run(x_used, s["selection"]["p_fake"], s["selection"], s.get("video_stats"))
        msg = f"FINAL ANSWER: {v['label']} (fake score {v['p_fake']:.0%}, confidence {v['confidence']:.0%}). " + " ".join(v["notes"])
        return {"verdict": v, "log": s["log"] + [(self.agent4.name, msg)],
                "timings": {**s["timings"], "verify": (time.perf_counter() - t0) * 1000}}

    def _build_graph(self):
        g = StateGraph(PipelineState)
        g.add_node("attack_audit", self._attack_audit)
        g.add_node("sanitize", self._sanitize)
        g.add_node("dispatch", self._dispatch)
        g.add_node("verify", self._verify)
        g.set_entry_point("attack_audit")
        g.add_conditional_edges("attack_audit", lambda s: "sanitize" if s["threat"]["under_attack"] else "dispatch",
                                {"sanitize": "sanitize", "dispatch": "dispatch"})
        g.add_edge("sanitize", "dispatch")
        g.add_edge("dispatch", "verify")
        g.add_edge("verify", END)
        return g.compile()

    # ------------------------------------------------------------------ public API
    def run_tensor(self, x, ingest_info=None, video_stats=None):
        """x: (1,3,224,224) in [0,1]."""
        t0 = time.perf_counter()
        state = {"x": x.to(self.device), "ingest": ingest_info or {}, "log": [], "timings": {}}
        if video_stats:
            state["video_stats"] = video_stats
        out = self.app.invoke(state)
        out["timings"]["total"] = (time.perf_counter() - t0) * 1000
        return out

    def baseline_verdict(self, x):
        """What a traditional single-model detector would say."""
        return float(self.zoo.p_fake("baseline", x.to(self.device))[0])

    def simulate_attack(self, x, kind, eps=EPS, steps=PGD_STEPS, target_label=None):
        """Attacker crafts a perturbation against the traditional (baseline) detector.
        By default it pushes the image toward the opposite of the baseline's current decision."""
        if kind == "none":
            return x
        x = x.to(self.device)
        if target_label is None:
            target_label = int(self.baseline_verdict(x) >= 0.5)
        import torch
        y = torch.tensor([target_label], device=self.device)
        return attack(kind, self.zoo.get("baseline"), x, y, eps, steps=steps)

    def analyze_image(self, img: Image.Image, attack_kind="none", eps=EPS):
        face, info = crop_face(img)
        x = load_image_tensor(face).to(self.device)
        x_adv = self.simulate_attack(x, attack_kind, eps)
        out = self.run_tensor(x_adv, info)
        out["x_original"], out["x_input"] = x, x_adv
        out["baseline_p_fake"] = self.baseline_verdict(x_adv)
        out["ingest"] = {**info, "graph_engine": GRAPH_ENGINE, "attack_simulated": attack_kind, "eps": eps}
        return out

    def analyze_video(self, path, attack_kind="none", eps=EPS, n_frames=12, progress=None):
        frames, fps, total, idxs = sample_frames(path, n_frames)
        blink = blink_analysis(path)
        per_frame = []
        for i, fr in enumerate(frames):
            r = self.analyze_image(fr, attack_kind, eps)
            per_frame.append(r)
            if progress:
                progress((i + 1) / len(frames))
        scores = np.array([r["selection"]["p_fake"] for r in per_frame])
        stats = {"temporal_mean": float(scores.mean()), "temporal_std": float(scores.std()),
                 "frames": len(frames), "fps": fps, "total_frames": total,
                 "frames_flagged_adv": int(sum(r["threat"]["under_attack"] for r in per_frame)), **blink}
        # final temporal fusion through the verifier with the video statistics
        rep = per_frame[int(np.argmin(np.abs(scores - np.median(scores))))]
        sel = {**rep["selection"], "p_fake": float(np.mean(scores))}
        x_used = rep.get("x_sanitized", rep["x"]) if rep["threat"]["under_attack"] else rep["x"]
        verdict = self.agent4.run(x_used, sel["p_fake"], sel, stats)
        return {"frames": per_frame, "scores": scores.tolist(), "frame_idx": idxs, "stats": stats, "verdict": verdict,
                "baseline_scores": [r["baseline_p_fake"] for r in per_frame]}


def audit_report(out) -> Dict:
    """JSON-serialisable audit log."""
    return {
        "ingest": out.get("ingest"),
        "threat_assessment": out.get("threat"),
        "sanitization": out.get("sanitization", []),
        "model_selection": out.get("selection"),
        "verdict": out.get("verdict"),
        "traditional_baseline_p_fake": out.get("baseline_p_fake"),
        "agent_log": [{"agent": a, "message": m} for a, m in out.get("log", [])],
        "latency_ms": {k: round(v, 1) for k, v in out.get("timings", {}).items()},
    }
