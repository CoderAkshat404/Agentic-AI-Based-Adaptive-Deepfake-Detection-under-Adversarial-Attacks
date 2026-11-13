"""Signal-level forensic measurements (frequency, noise residual, texture, lighting)."""
import numpy as np
import torch

from core.sanitize import median


def _gray(x):
    return (0.299 * x[:, 0] + 0.587 * x[:, 1] + 0.114 * x[:, 2])


def _radius(h, w, device):
    yy, xx = torch.meshgrid(torch.linspace(-1, 1, h, device=device),
                            torch.linspace(-1, 1, w, device=device), indexing="ij")
    return torch.sqrt(xx ** 2 + yy ** 2) / np.sqrt(2)


@torch.no_grad()
def spectrum_features(x):
    """High-frequency energy ratio and log-spectral slope of a batch."""
    g = _gray(x)
    f = torch.fft.fftshift(torch.fft.fft2(g - g.mean((1, 2), keepdim=True)), dim=(-2, -1))
    power = f.abs() ** 2
    r = _radius(g.shape[1], g.shape[2], x.device)
    total = power.sum((1, 2)) + 1e-8
    hf_ratio = power[:, r > 0.5].sum(1) / total
    mid = torch.log(power[:, (r > 0.2) & (r < 0.4)].mean(1) + 1e-8)
    high = torch.log(power[:, r > 0.7].mean(1) + 1e-8)
    return hf_ratio, high - mid            # spectral tail (GAN upsampling leaves bumps here)


@torch.no_grad()
def residual_features(x):
    """Noise residual (image - median3): std, mean |r|, kurtosis."""
    g = _gray(x).unsqueeze(1)
    r = (g - median(g, 3)).flatten(1)
    std = r.std(1)
    mad = r.abs().mean(1)
    kurt = ((r - r.mean(1, keepdim=True)) ** 4).mean(1) / (std ** 4 + 1e-12)
    return std, mad, kurt


@torch.no_grad()
def texture_lighting(x):
    """Laplacian variance (skin-texture smoothness) and left/right illumination asymmetry."""
    g = _gray(x).unsqueeze(1)
    k = torch.tensor([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=x.dtype, device=x.device).view(1, 1, 3, 3)
    lap = torch.nn.functional.conv2d(g, k, padding=1).flatten(1).var(1)
    w = g.shape[-1]
    left, right = g[..., : w // 2].mean((1, 2, 3)), g[..., w // 2:].mean((1, 2, 3))
    asym = (left - right).abs() / (left + right + 1e-6)
    top, bottom = g[..., : g.shape[-2] // 2, :].mean((1, 2, 3)), g[..., g.shape[-2] // 2:, :].mean((1, 2, 3))
    return lap, asym, top / (bottom + 1e-6)


@torch.no_grad()
def forensic_cues(x):
    """Cue vector used by the Verifier agent. Returns (B, 6) numpy array + names."""
    hf, tail = spectrum_features(x)
    std, _, kurt = residual_features(x)
    lap, asym, tb = texture_lighting(x)
    feats = torch.stack([hf, tail, std, kurt.clamp(max=200), torch.log(lap + 1e-8), asym], 1)
    return feats.cpu().numpy()


# Simple display names (technical: HF energy, spectral tail, noise residual, residual kurtosis, log-Laplacian texture, lighting asymmetry)
CUE_NAMES = ["Fine detail", "Hidden patterns", "Camera grain", "Grain shape", "Skin smoothness", "Lighting balance"]
