"""Generate all report figures (300 dpi) into report/figures/."""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Polygon
import numpy as np

OUT = ROOT / "report" / "figures"
OUT.mkdir(parents=True, exist_ok=True)
RES = ROOT / "results"

NAVY, BLUE, SKY, RED, AMBER, PURPLE, GREEN, GREY = "#1F3864", "#2E75B6", "#38BDF8", "#E15759", "#F28E2B", "#9467BD", "#2CA02C", "#7F7F7F"
plt.rcParams.update({"font.family": "serif", "font.serif": ["Times New Roman", "DejaVu Serif"], "font.size": 11,
                     "axes.spines.top": False, "axes.spines.right": False, "axes.titleweight": "bold",
                     "savefig.dpi": 300, "savefig.bbox": "tight"})


# ----------------------------------------------------------------------------- 1. architecture
def box(ax, x, y, w, h, text, fc, ec=NAVY, tc="black", fs=10.5, bold=False, round_=0.08):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle=f"round,pad=0.02,rounding_size={round_}",
                                fc=fc, ec=ec, lw=1.4))
    ax.text(x, y, text, ha="center", va="center", fontsize=fs, color=tc, weight="bold" if bold else "normal", wrap=True)


def arrow(ax, p, q, color=NAVY, text=None, toff=(0, 0), style="-|>", ls="-", rad=0.0, fs=9.5, tcolor=None):
    ax.add_patch(FancyArrowPatch(p, q, arrowstyle=style, mutation_scale=14, color=color, lw=1.4, linestyle=ls,
                                 connectionstyle=f"arc3,rad={rad}"))
    if text:
        ax.text((p[0] + q[0]) / 2 + toff[0], (p[1] + q[1]) / 2 + toff[1], text, fontsize=fs, color=tcolor or color,
                ha="center", va="center", style="italic")


def fig_architecture():
    fig, ax = plt.subplots(figsize=(8.2, 10.2))
    ax.set_xlim(0, 10), ax.set_ylim(0, 13), ax.axis("off")
    box(ax, 5, 12.35, 5.2, 0.7, "User input: image or video", "#DDEBF7", bold=True)
    box(ax, 5, 11.25, 5.8, 0.8, "Media processor\nframe sampling  •  face detection & cropping  •  resize 224×224", "#F2F2F2", fs=10)
    ax.add_patch(FancyBboxPatch((0.35, 1.55), 9.3, 8.95, boxstyle="round,pad=0.02,rounding_size=0.15", fc="#FBFCFE",
                                ec=NAVY, lw=1.2, ls="--"))
    ax.text(0.6, 10.2, "Central Orchestrator\n(LangGraph state graph)", fontsize=9.5, color=NAVY, weight="bold", va="center")
    box(ax, 5, 9.3, 6.6, 1.05, "Agent 1 — Noise & Attack Detector\nFourier energy • noise residual • feature squeezing\n→ P(adv) and attack type",
        "#DDEBF7", fs=10)
    d = Polygon([[5, 8.35], [6.3, 7.75], [5, 7.15], [3.7, 7.75]], closed=True, fc="#FFF2CC", ec=NAVY, lw=1.4)
    ax.add_patch(d)
    ax.text(5, 7.75, "P(adv) > 0.65 ?", ha="center", va="center", fontsize=10, weight="bold")
    box(ax, 8.15, 6.75, 2.75, 1.25, "Agent 2 —\nAdaptive Sanitizer\ncompression • median\nTV smoothing • blur", "#FCE4D6", ec=RED, fs=9.5)
    box(ax, 5, 5.15, 6.4, 0.95, "Agent 3 — Dynamic Model Selector\nquick check  |  full vote  |  attack path", "#DDEBF7", fs=10)
    ys = 3.75
    for i, (name, sub, c) in enumerate([("Traditional", "EfficientNet-B0", "#EDEDED"), ("Robust", "adv.-trained CNN", "#EDEDED"),
                                        ("ViT", "DeiT-Tiny", "#E2F0D9"), ("CLIP", "ViT-B/16 + probe", "#E2F0D9")]):
        x = 1.75 + i * 2.17
        box(ax, x, ys, 1.95, 0.85, f"{name}\n{sub}", c, ec=GREY, fs=9.5)
        arrow(ax, (5, 4.66), (x, ys + 0.45), color=GREY)
        arrow(ax, (x, ys - 0.45), (5, 2.62), color=GREY)
    box(ax, 5, 2.2, 6.4, 0.85, "Agent 4 — Forensic Verifier\nimage clues • model agreement • blink & temporal checks", "#E2F0D9", fs=10)
    box(ax, 5, 0.75, 8.4, 0.85, "Output: REAL / FAKE  +  confidence  +  human-review flag  +  audit report", "#DDEBF7", bold=True, fs=10)
    arrow(ax, (5, 12.0), (5, 11.66))
    arrow(ax, (5, 10.85), (5, 9.84))
    arrow(ax, (5, 8.77), (5, 8.37))
    arrow(ax, (6.3, 7.75), (7.2, 7.4), color=RED, text="yes: attacked", toff=(0.1, 0.32), fs=9.5)
    arrow(ax, (5, 7.15), (5, 5.64), color=GREEN, text="no: clean", toff=(-0.62, 0), fs=9.5)
    arrow(ax, (7.6, 6.12), (7.0, 5.64), color=RED, text="cleaned image", toff=(-0.75, 0.05), fs=9)
    arrow(ax, (9.3, 7.38), (8.35, 8.77), color=RED, ls="--", rad=0.3, text="re-check", toff=(-0.55, 0.1), fs=9)
    arrow(ax, (5, 1.77), (5, 1.2))
    fig.savefig(OUT / "fig_architecture.png")
    plt.close(fig)


# ----------------------------------------------------------------------------- 2. attack walkthrough
def fig_attack_example():
    from PIL import Image
    from agents.orchestrator import AgenticOrchestrator
    from core.data import tensor_to_image
    orch = AgenticOrchestrator()
    img = Image.open(ROOT / "samples" / "fake_04.jpg")
    fig, axes = plt.subplots(2, 4, figsize=(10, 5.6))
    for r, atk in enumerate(("fgsm", "pgd")):
        out = orch.analyze_image(img, atk)
        x0, xa = out["x_original"], out["x_input"]
        signed = (0.5 + 0.5 * (xa - x0) / (4 / 255)).clamp(0, 1)      # grey = unchanged, light/dark = +/- epsilon
        p_clean = orch.baseline_verdict(x0)
        tiles = [(tensor_to_image(x0), f"Original (fake)\nTraditional: {p_clean:.0%} fake"),
                 (tensor_to_image(xa), f"After {atk.upper()} attack (ε=4/255)\nTraditional: {out['baseline_p_fake']:.0%} fake"),
                 (tensor_to_image(signed), f"Hidden noise (amplified ×32)\nAgent 1: P(adv) = {out['threat']['p_adv']:.0%}"),
                 (tensor_to_image(out["x_sanitized"]), f"Cleaned by Agent 2\nOur system: {out['verdict']['p_fake']:.0%} fake")]
        for c, (im, t) in enumerate(tiles):
            ax = axes[r, c]
            ax.imshow(im), ax.set_xticks([]), ax.set_yticks([])
            for s in ax.spines.values():
                s.set_visible(True), s.set_color(RED if (c == 1) else (GREEN if c == 3 else GREY)), s.set_linewidth(2)
            ax.set_title(t, fontsize=9.5, weight="normal")
        axes[r, 0].set_ylabel(atk.upper(), fontsize=12, weight="bold", color=NAVY)
    fig.tight_layout()
    fig.savefig(OUT / "fig_attack_example.png")
    plt.close(fig)


# ----------------------------------------------------------------------------- 3. phone-style augmentation
def fig_phone_aug():
    from PIL import Image
    from core.data import PhoneStyle
    src = Image.open(ROOT / "samples" / "real_02.jpg").convert("RGB")
    ops = [("Original", None), ("Portrait blur", PhoneStyle.bokeh), ("Skin smoothing", PhoneStyle.smooth),
           ("HDR-style colour", PhoneStyle.tone), ("Low-res upscale + JPEG", PhoneStyle.resample)]
    fig, axes = plt.subplots(1, 5, figsize=(10, 2.5))
    for i, (ax, (t, op)) in enumerate(zip(axes, ops)):
        random.seed(i)
        ax.imshow(src if op is None else op(src)), ax.set_title(t, fontsize=10), ax.axis("off")
    fig.tight_layout()
    fig.savefig(OUT / "fig_phone_aug.png")
    plt.close(fig)


# ----------------------------------------------------------------------------- 4. Agent 1 confusion matrix
def fig_agent1_cm():
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import confusion_matrix
    from sklearn.model_selection import train_test_split
    parts = [np.load(p) for p in sorted((RES / "cache" / "attack_features").glob("b[0-9]*.npz")) if ".tmp" not in p.name]
    X, Y = np.concatenate([p["X"] for p in parts]), np.concatenate([p["Y"] for p in parts])
    Xtr, Xte, ytr, yte = train_test_split(X, Y, test_size=0.2, stratify=Y, random_state=0)
    clf = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, max_leaf_nodes=31,
                                         class_weight={0: 1.0, 1: 1.5, 2: 1.5}, random_state=0).fit(Xtr, ytr)
    cm = confusion_matrix(yte, clf.predict(Xte))
    fig, ax = plt.subplots(figsize=(4.6, 3.9))
    norm = cm / cm.sum(1, keepdims=True)
    ax.imshow(norm, cmap="Blues", vmin=0, vmax=1)
    labs = ["Clean", "FGSM", "PGD"]
    ax.set_xticks(range(3), labs), ax.set_yticks(range(3), labs)
    ax.set_xlabel("Predicted by Agent 1"), ax.set_ylabel("True condition")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, f"{cm[i, j]}\n({norm[i, j]:.1%})", ha="center", va="center", fontsize=9.5,
                    color="white" if norm[i, j] > 0.5 else "black")
    ax.spines[:].set_visible(False)
    fig.savefig(OUT / "fig_agent1_cm.png")
    plt.close(fig)
    return cm.tolist()


# ----------------------------------------------------------------------------- 5. main benchmark
SYS = [("Traditional (EfficientNet-B0)", "Traditional model", RED), ("Static defense (JPEG + baseline)", "Traditional + JPEG cleaning", AMBER),
       ("Adv-trained CNN only", "Robust model alone", PURPLE), ("Agentic AI (full)", "Agentic AI (proposed)", BLUE)]
CONDS = [("Clean", "No attack"), ("FGSM", "FGSM"), ("PGD", "PGD"), ("PGD-adaptive (targets robust CNN)", "PGD on Robust\n(adaptive)")]


def fig_benchmark():
    R = json.load(open(RES / "benchmark.json"))["results"]
    fig, ax = plt.subplots(figsize=(9, 4.2))
    w = 0.2
    x = np.arange(len(CONDS))
    for i, (k, lab, c) in enumerate(SYS):
        vals = [R[cd][k]["accuracy"] * 100 for cd, _ in CONDS]
        b = ax.bar(x + (i - 1.5) * w, vals, w, label=lab, color=c, edgecolor="white")
        for rect, v in zip(b, vals):
            ax.text(rect.get_x() + rect.get_width() / 2, v + 1.2, f"{v:.1f}", ha="center", fontsize=8)
    ax.set_xticks(x, [l for _, l in CONDS]), ax.set_ylim(0, 108), ax.set_ylabel("Accuracy (%)")
    ax.legend(ncol=4, fontsize=8.6, loc="upper center", bbox_to_anchor=(0.5, 1.13), frameon=False)
    ax.grid(axis="y", alpha=0.3)
    fig.savefig(OUT / "fig_benchmark.png")
    plt.close(fig)


# ----------------------------------------------------------------------------- 6. model diversity (validation)
def fig_diversity():
    T = json.load(open(RES / "ensemble_tuning.json"))["single"]
    conds = [("clean", "Clean"), ("phone", "Phone-style"), ("fgsm", "FGSM\n(after cleaning)"), ("pgd", "PGD\n(after cleaning)")]
    models = [("baseline", "Traditional", RED), ("robust", "Robust", PURPLE), ("vit", "ViT", GREEN), ("clip", "CLIP", BLUE)]
    fig, ax = plt.subplots(figsize=(9, 3.9))
    w = 0.2
    x = np.arange(len(conds))
    for i, (m, lab, c) in enumerate(models):
        vals = [T[cd][m] * 100 for cd, _ in conds]
        b = ax.bar(x + (i - 1.5) * w, vals, w, label=lab, color=c, edgecolor="white")
        for rect, v in zip(b, vals):
            ax.text(rect.get_x() + rect.get_width() / 2, v + 1, f"{v:.0f}", ha="center", fontsize=8)
    ax.set_xticks(x, [l for _, l in conds]), ax.set_ylim(40, 103), ax.set_ylabel("Accuracy (%)")
    ax.legend(ncol=4, fontsize=9, loc="upper center", bbox_to_anchor=(0.5, 1.13), frameon=False)
    ax.grid(axis="y", alpha=0.3)
    fig.savefig(OUT / "fig_diversity.png")
    plt.close(fig)


# ----------------------------------------------------------------------------- 7. versions
def fig_versions():
    files = ["benchmark_untuned.json", "benchmark_v2_fastpath_baseline_only.json", "benchmark_v3_before_clip.json", "benchmark.json"]
    labels = ["v1\nfirst agentic", "v2\ntuned cleaning\n+ ViT-weighted", "v3\nViT cross-check", "v4\n+ CLIP & phone\naugmentation"]
    series = [("Clean", "No attack", GREEN), ("FGSM", "FGSM", AMBER), ("PGD", "PGD", RED), ("PGD-adaptive (targets robust CNN)", "PGD on Robust", PURPLE)]
    data = [json.load(open(RES / f))["results"] for f in files]
    fig, ax = plt.subplots(figsize=(8.6, 3.9))
    ends = []
    for k, lab, c in series:
        v = [d[k]["Agentic AI (full)"]["accuracy"] * 100 for d in data]
        ax.plot(range(4), v, "-o", color=c, label=lab, lw=2)
        ends.append([v[-1], v[-1], c])
    ends.sort(key=lambda e: e[0])                      # spread end labels so they never overlap
    for i in range(1, len(ends)):
        ends[i][1] = max(ends[i][1], ends[i - 1][1] + 1.6)
    for val, ypos, c in ends:
        ax.text(3.1, ypos, f"{val:.1f}", color=c, va="center", fontsize=9, weight="bold")
    ax.set_xticks(range(4), labels, fontsize=9), ax.set_ylabel("Agentic accuracy (%)"), ax.set_ylim(60, 100)
    ax.set_xlim(-0.2, 3.4), ax.grid(alpha=0.3), ax.legend(ncol=4, fontsize=9, loc="lower right", frameon=False)
    fig.savefig(OUT / "fig_versions.png")
    plt.close(fig)


# ----------------------------------------------------------------------------- 8. eps sweep
def fig_eps():
    p = RES / "eps_sweep.json"
    if not p.exists():
        return False
    S = json.load(open(p))["results"]
    e = sorted(int(k) for k in S)
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    ax.plot(e, [S[str(k)]["traditional"] * 100 for k in e], "-o", color=RED, lw=2, label="Traditional model")
    ax.plot(e, [S[str(k)]["agentic"] * 100 for k in e], "-o", color=BLUE, lw=2, label="Agentic AI (proposed)")
    ax.plot(e, [S[str(k)]["agent1_flag_rate"] * 100 for k in e], "--s", color=GREY, lw=1.5, label="Agent 1: marked as attacked")
    ax.axvline(4, color=NAVY, ls=":", lw=1)
    ax.text(4.2, 15, "main setting\n(ε = 4/255)", fontsize=9, color=NAVY)
    ax.set_xlabel("Attack strength ε (× 1/255)"), ax.set_ylabel("Percentage (%)"), ax.set_ylim(-3, 103)
    ax.set_xticks(e), ax.grid(alpha=0.3), ax.legend(fontsize=9, frameon=False, loc="center", bbox_to_anchor=(0.6, 0.45))
    fig.savefig(OUT / "fig_eps.png")
    plt.close(fig)
    return True


if __name__ == "__main__":
    which = sys.argv[1:] or ["arch", "example", "aug", "cm", "bench", "div", "ver", "eps"]
    if "arch" in which: fig_architecture()
    if "aug" in which: fig_phone_aug()
    if "cm" in which: print("confusion matrix", fig_agent1_cm())
    if "bench" in which: fig_benchmark()
    if "div" in which: fig_diversity()
    if "ver" in which: fig_versions()
    if "eps" in which: print("eps figure", fig_eps())
    if "example" in which: fig_attack_example()
    print("figures written to", OUT)
