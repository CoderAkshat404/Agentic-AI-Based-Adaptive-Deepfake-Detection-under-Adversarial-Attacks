"""Input-purification filters used by the Sanitizer agent (all operate on (B,3,H,W) in [0,1])."""
import io

import numpy as np
import torch
import torch.nn.functional as F
import torchvision.transforms.functional as TF
from PIL import Image


def jpeg(x, quality=75):
    out = []
    for img in x.detach().cpu():
        arr = (img.clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, format="JPEG", quality=int(quality))
        buf.seek(0)
        rec = np.asarray(Image.open(buf).convert("RGB")).copy()
        out.append(torch.from_numpy(rec).permute(2, 0, 1).float() / 255)
    return torch.stack(out).to(x.device)


def gaussian(x, sigma=0.8):
    k = max(3, int(2 * round(3 * sigma) + 1))
    return TF.gaussian_blur(x, kernel_size=k, sigma=sigma)


def median(x, k=3):
    pad = k // 2
    xp = F.pad(x, (pad, pad, pad, pad), mode="reflect")
    patches = xp.unfold(2, k, 1).unfold(3, k, 1)
    return patches.contiguous().view(*x.shape, -1).median(-1).values


def bit_depth(x, bits=5):
    levels = 2 ** bits - 1
    return torch.round(x * levels) / levels


def tv_denoise(x, weight=0.08, n_iter=30):
    """Total-Variation minimisation (Chambolle's projection algorithm), batched on GPU."""
    tau = 0.25
    p = torch.zeros((2,) + x.shape, device=x.device, dtype=x.dtype)
    out = x
    for i in range(n_iter):
        if i > 0:
            d = -p[0] - p[1]
            d[..., 1:, :] += p[0][..., :-1, :]
            d[..., :, 1:] += p[1][..., :, :-1]
            out = x + d
        gx = torch.zeros_like(x)
        gy = torch.zeros_like(x)
        gx[..., :-1, :] = out[..., 1:, :] - out[..., :-1, :]
        gy[..., :, :-1] = out[..., :, 1:] - out[..., :, :-1]
        norm = 1 + (tau / weight) * torch.sqrt(gx ** 2 + gy ** 2)
        p[0] = (p[0] - tau * gx) / norm
        p[1] = (p[1] - tau * gy) / norm
    return out.clamp(0, 1)


# Sanitization "recipes", ordered by strength. Agent 2 escalates through them.
RECIPES = [
    ("Light compression (JPEG)",                    lambda x: jpeg(x, 85)),
    ("Compression + noise filter",                  lambda x: jpeg(median(x, 3), 70)),
    ("Smoothing + compression",                     lambda x: jpeg(tv_denoise(x, 0.06), 70)),
    ("Strong smoothing + blur + compression", lambda x: jpeg(gaussian(tv_denoise(x, 0.12), 0.7), 60)),
]


def psnr(a, b):
    mse = F.mse_loss(a, b).item()
    return 99.0 if mse == 0 else 10 * np.log10(1.0 / mse)
