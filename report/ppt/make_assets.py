"""Generate PPT visuals from the real models: attack tiles, Grad-CAM heatmaps, quiz faces, illustrations."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
from PIL import Image

OUT = Path(__file__).resolve().parent / "assets"
OUT.mkdir(exist_ok=True)
CYAN, RED, GREEN, AMBER, TXT, MUTED = "#22D3EE", "#F43F5E", "#22C55E", "#F59E0B", "#F1F5F9", "#94A3B8"
meta = {}


def save_tensor(x, name, size=448):
    from core.data import tensor_to_image
    Image.fromarray(tensor_to_image(x)).resize((size, size), Image.BICUBIC).save(OUT / name)


# ----------------------------------------------------------------- attack tiles (real pipeline)
from agents.orchestrator import AgenticOrchestrator
orch = AgenticOrchestrator()
img = Image.open(ROOT / "samples" / "fake_04.jpg")
for atk in ("fgsm", "pgd"):
    out = orch.analyze_image(img, atk)
    x0, xa = out["x_original"], out["x_input"]
    if atk == "fgsm":
        save_tensor(x0, "face_original.png")
        meta["p_clean"] = orch.baseline_verdict(x0)
    save_tensor(xa, f"face_{atk}.png")
    save_tensor((0.5 + 0.5 * (xa - x0) / (4 / 255)).clamp(0, 1), f"noise_{atk}.png")
    save_tensor(out["x_sanitized"], f"face_{atk}_clean.png")
    meta[atk] = {"trad": out["baseline_p_fake"], "p_adv": out["threat"]["p_adv"], "ours": out["verdict"]["p_fake"]}

# ----------------------------------------------------------------- Grad-CAM: where the traditional model looks
from core.data import load_image_tensor
base = orch.zoo.get("baseline")
acts, grads = {}, {}
layer = base.backbone.conv_head
h1 = layer.register_forward_hook(lambda m, i, o: acts.__setitem__("a", o))
h2 = layer.register_full_backward_hook(lambda m, gi, go: grads.__setitem__("g", go[0]))
for p in base.parameters():
    p.requires_grad_(True)


def gradcam(path, name):
    x = load_image_tensor(Image.open(path)).cuda().requires_grad_(True)
    base.zero_grad()
    logits = base(x)
    pred = int(logits.argmax(1))
    logits[0, pred].backward()
    a, g = acts["a"][0].detach(), grads["g"][0].detach()
    cam = torch.relu((g.mean((1, 2), keepdim=True) * a).sum(0))
    cam = torch.nn.functional.interpolate(cam[None, None], size=(448, 448), mode="bilinear")[0, 0].cpu().numpy()
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    face = np.asarray(Image.open(path).convert("RGB").resize((448, 448))) / 255
    heat = plt.get_cmap("jet")(cam)[..., :3]
    Image.fromarray((np.clip(0.55 * face + 0.45 * heat, 0, 1) * 255).astype(np.uint8)).save(OUT / name)
    return float(torch.softmax(logits, 1)[0, 1])


meta["cam_fake"] = gradcam(ROOT / "samples" / "fake_05.jpg", "cam_fake.png")
meta["cam_real"] = gradcam(ROOT / "samples" / "real_02.jpg", "cam_real.png")
h1.remove(), h2.remove()
for p in base.parameters():
    p.requires_grad_(False)

# ----------------------------------------------------------------- quiz faces (traditional model's scores)
quiz = ["real_07", "fake_02", "real_02", "fake_07", "real_05", "fake_03"]
meta["quiz"] = []
for n in quiz:
    p = float(orch.zoo.p_fake("baseline", load_image_tensor(Image.open(ROOT / "samples" / f"{n}.jpg")).cuda())[0])
    Image.open(ROOT / "samples" / f"{n}.jpg").convert("RGB").resize((360, 360), Image.BICUBIC).save(OUT / f"quiz_{n}.png")
    meta["quiz"].append({"name": n, "truth": n.split("_")[0].upper(), "p_fake": p})


# ----------------------------------------------------------------- illustrations
def style(ax):
    ax.set_facecolor("none")
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_xticks([]), ax.set_yticks([])


# FGSM: one big jump on a curved hill
x = np.linspace(-1, 3.2, 400)
loss = 0.15 + 0.5 * x ** 2 - 0.12 * x ** 3 + 0.08 * np.sin(5 * x)
fig, ax = plt.subplots(figsize=(6, 3.6), dpi=200)
fig.patch.set_alpha(0)
style(ax)
ax.plot(x, loss, color=MUTED, lw=3)
ax.fill_between(x, loss, -0.2, color="#1B2640", alpha=0.8)
x0, x1 = 0.0, 1.9
y0, y1 = np.interp(x0, x, loss), np.interp(x1, x, loss)
ax.annotate("", xy=(x1, y1 + 0.02), xytext=(x0, y0 + 0.05),
            arrowprops=dict(arrowstyle="-|>", color=AMBER, lw=3, connectionstyle="arc3,rad=-0.35", mutation_scale=22))
ax.scatter([x0], [y0], s=180, color=GREEN, zorder=5, edgecolor="white", lw=2)
ax.scatter([x1], [y1], s=180, color=AMBER, zorder=5, edgecolor="white", lw=2)
ax.text(x0, y0 - 0.33, "Correct answer\n(\"FAKE\")", color=GREEN, ha="center", fontsize=12, weight="bold")
ax.text(x1 + 0.1, y1 + 0.45, "ONE big jump\n= FGSM", color=AMBER, ha="center", fontsize=13, weight="bold")
ax.text(2.95, 0.05, "AI's mistake\ngets bigger →", color=MUTED, ha="right", fontsize=10.5, rotation=0)
ax.set_xlim(-1, 3.2), ax.set_ylim(-0.25, 1.85)
fig.savefig(OUT / "illus_fgsm.png", transparent=True, bbox_inches="tight")
plt.close(fig)

# PGD: many small steps inside the fence (projection)
g = np.linspace(-1.6, 1.6, 300)
X, Y = np.meshgrid(g, g)
Z = (X - 1.3) ** 2 * 0.6 + (Y + 0.9) ** 2 + 0.35 * np.sin(3 * X) * np.cos(2 * Y)
fig, ax = plt.subplots(figsize=(4.4, 4.4), dpi=200)
fig.patch.set_alpha(0)
style(ax)
ax.contour(X, Y, -Z, levels=14, colors=MUTED, linewidths=0.8, alpha=0.55)
ax.add_patch(plt.Rectangle((-1, -1), 2, 2, fill=False, ec=CYAN, lw=3, ls="--"))
ax.text(0, 1.12, "the fence: max change ε", color=CYAN, ha="center", fontsize=12, weight="bold")
rng = np.random.default_rng(3)
pts = [np.array([0.0, 0.0]) + rng.uniform(-0.25, 0.25, 2)]
for t in range(9):
    gx, gy = -1.2 * (pts[-1][0] - 1.3) - 1.05 * np.cos(3 * pts[-1][0]), -2 * (pts[-1][1] + 0.9)
    step = 0.32 * np.array([np.sign(gx), np.sign(gy)])
    pts.append(np.clip(pts[-1] + step, -1, 1))
P = np.array(pts)
ax.plot(P[:, 0], P[:, 1], "-", color=RED, lw=2.5)
ax.scatter(P[1:-1, 0], P[1:-1, 1], s=50, color=RED, zorder=5)
ax.scatter([0], [0], s=170, color=GREEN, edgecolor="white", lw=2, zorder=6)
ax.scatter([P[-1, 0]], [P[-1, 1]], s=170, color=RED, edgecolor="white", lw=2, zorder=6, marker="X")
ax.text(0.05, 0.12, "start", color=GREEN, fontsize=12, weight="bold")
ax.text(P[-1, 0] - 0.05, P[-1, 1] - 0.27, "worst point\ninside fence", color=RED, fontsize=11, weight="bold", ha="right")
ax.set_xlim(-1.45, 1.45), ax.set_ylim(-1.45, 1.35), ax.set_aspect("equal")
fig.savefig(OUT / "illus_pgd.png", transparent=True, bbox_inches="tight")
plt.close(fig)

(OUT / "meta.json").write_text(json.dumps(meta, indent=2))
print(json.dumps(meta, indent=1))
