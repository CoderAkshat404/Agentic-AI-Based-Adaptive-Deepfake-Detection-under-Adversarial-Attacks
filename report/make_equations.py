"""Render report equations with matplotlib mathtext and record all image sizes (figures/sizes.json)."""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

OUT = Path(__file__).resolve().parent / "figures"
plt.rcParams.update({"mathtext.fontset": "stix", "font.family": "STIXGeneral"})

EQ = {
    "eq_fgsm": r"$x_{adv} = \mathrm{clip}_{[0,1]}\left(x + \epsilon \cdot \mathrm{sign}\left(\nabla_x \mathcal{L}(f(x), y)\right)\right)$",
    "eq_pgd": r"$x^{t+1} = \Pi_{\mathcal{B}_\epsilon(x)}\left(x^{t} + \alpha \cdot \mathrm{sign}\left(\nabla_x \mathcal{L}(f(x^{t}), y)\right)\right),\quad x^{0} = x + \mathcal{U}(-\epsilon, \epsilon)$",
    "eq_threat": r"$\max_{\|\delta\|_\infty \leq \epsilon} \; \mathcal{L}\left(f(x + \delta), y\right), \qquad \epsilon = 4/255$",
    "eq_squeeze": r"$\Delta_s(x) = \left| z(x) - z(s(x)) \right|, \qquad z(x) = f_{fake}(x) - f_{real}(x)$",
    "eq_hf": r"$E_{HF}(x) = \frac{\sum_{r(u,v) > 0.5} |\mathcal{F}(u,v)|^2}{\sum_{u,v} |\mathcal{F}(u,v)|^2}$",
    "eq_tv": r"$u^{*} = \arg\min_{u} \; \frac{1}{2}\|u - x\|_2^2 + \lambda \sum_{i,j} \|\nabla u_{i,j}\|_2$",
    "eq_psnr": r"$\mathrm{PSNR}(u, x) = 10 \log_{10} \frac{1}{\mathrm{MSE}(u, x)} \;\; \mathrm{dB}$",
    "eq_ensemble": r"$p_{fake}(x) = \sum_{m \in \mathcal{M}} w_m \, p_m(x), \qquad \sum_{m} w_m = 1$",
    "eq_conf": r"$c = 2\,|p - 0.5| \cdot (0.85 + 0.15\,a) \cdot \gamma_f \cdot \gamma_d, \qquad a = 1 - (\max_m p_m - \min_m p_m)$",
    "eq_fgsmrs": r"$\delta = \mathrm{clip}_{[-\epsilon,\epsilon]}\left(\delta_0 + 1.25\,\epsilon \cdot \mathrm{sign}\left(\nabla_{\delta}\mathcal{L}(f(x + \delta_0), y)\right)\right), \quad \delta_0 \sim \mathcal{U}(-\epsilon, \epsilon)$",
    "eq_clip": r"$p_{clip}(x) = \sigma\left(\mathbf{w}^{\top} \phi_{CLIP}(x) + b\right), \qquad \phi_{CLIP} \; \mathrm{fixed}$",
    "eq_damage": r"$D = 1 - \frac{A^{ours}_{clean} - A^{ours}_{attack}}{A^{trad}_{clean} - A^{trad}_{attack}}$",
    "eq_cue": r"$s_k(x) = \sigma\left(\log \frac{\mathcal{N}(c_k(x);\, \mu_k^{fake}, \sigma_k^{fake})}{\mathcal{N}(c_k(x);\, \mu_k^{real}, \sigma_k^{real})}\right)$",
}

for name, tex in EQ.items():
    fig = plt.figure(figsize=(0.01, 0.01))
    fig.text(0, 0, tex, fontsize=15)
    fig.savefig(OUT / f"{name}.png", dpi=300, bbox_inches="tight", pad_inches=0.04, transparent=False, facecolor="white")
    plt.close(fig)

sizes = {p.stem: Image.open(p).size for p in OUT.glob("*.png")}
(OUT / "sizes.json").write_text(json.dumps(sizes, indent=1))
print(len(EQ), "equations;", len(sizes), "images sized")
