"""Hand-designed PGD illustration: random start, small re-checked steps, projection back to the fence."""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).resolve().parent / "assets"
CYAN, RED, GREEN, AMBER, MUTED = "#22D3EE", "#F43F5E", "#22C55E", "#F59E0B", "#94A3B8"

fig, ax = plt.subplots(figsize=(5.8, 4.7), dpi=200)
fig.patch.set_alpha(0)
ax.set_facecolor("none")
for s in ax.spines.values():
    s.set_visible(False)
ax.set_xticks([]), ax.set_yticks([])

g = np.linspace(-1.7, 1.9, 300)
X, Y = np.meshgrid(g, g)
Z = (X - 1.6) ** 2 * 0.7 + (Y + 1.3) ** 2 + 0.25 * np.sin(3 * X) * np.cos(2 * Y)
ax.contour(X, Y, -Z, levels=12, colors=MUTED, linewidths=0.7, alpha=0.35)
ax.add_patch(plt.Rectangle((-1, -1), 2, 2, fill=False, ec=CYAN, lw=3, ls="--"))
ax.text(-1, 1.1, "The fence: no pixel may change more than ε", color=CYAN, fontsize=13.5, weight="bold")

def arrow(p, q, color, ls="-", lw=2.6):
    ax.annotate("", xy=q, xytext=p, arrowprops=dict(arrowstyle="-|>", color=color, lw=lw, ls=ls, mutation_scale=16))

start, rnd = (0, 0), (0.18, 0.12)
steps = [rnd, (0.42, -0.1), (0.62, -0.36), (0.78, -0.62), (1.22, -0.82)]
ax.scatter(*start, s=190, color=GREEN, edgecolor="white", lw=2, zorder=6)
ax.text(-0.08, 0.13, "original\nimage", color=GREEN, fontsize=13, weight="bold", ha="right")
arrow(start, rnd, AMBER, ls=":")
ax.text(0.27, 0.27, "① random start", color=AMBER, fontsize=13, weight="bold")
for p, q in zip(steps[:-2], steps[1:-1]):
    arrow(p, q, RED)
    ax.scatter(*q, s=45, color=RED, zorder=5)
ax.text(-0.93, -0.3, "② small step,\n   re-check direction,\n   repeat (×10)", color=RED, fontsize=13, weight="bold", va="top")
arrow(steps[-2], steps[-1], RED, ls="--", lw=2)
ax.scatter(*steps[-1], s=60, color=RED, alpha=0.5, zorder=5)
proj = (1.0, -0.82)
arrow(steps[-1], proj, CYAN, lw=3)
ax.text(1.08, -0.6, "③ crossed the\n   fence → pulled\n   back (projection)", color=CYAN, fontsize=13, weight="bold")
arrow(proj, (1.0, -1.0), RED)
ax.scatter(1.0, -1.0, s=210, color=RED, edgecolor="white", lw=2, marker="X", zorder=7)
ax.text(0.92, -1.27, "attacked image: AI fooled", color=RED, fontsize=13, weight="bold", ha="right")
ax.set_xlim(-1.35, 1.95), ax.set_ylim(-1.4, 1.3), ax.set_aspect("equal")
fig.savefig(OUT / "illus_pgd.png", transparent=True, bbox_inches="tight")
print("ok")
