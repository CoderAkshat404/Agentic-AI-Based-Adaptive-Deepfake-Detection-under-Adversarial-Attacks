"""White-box L-inf adversarial attacks (FGSM / PGD), implemented from scratch in PyTorch."""
import torch
import torch.nn.functional as F


def _grad(model, x, y):
    x = x.clone().detach().requires_grad_(True)
    loss = F.cross_entropy(model(x).float(), y)
    return torch.autograd.grad(loss, x)[0]


def fgsm(model, x, y, eps):
    """Fast Gradient Sign Method: one step of size eps along sign(grad)."""
    model.eval()
    return (x + eps * _grad(model, x, y).sign()).clamp(0, 1).detach()


def pgd(model, x, y, eps, alpha, steps, random_start=True):
    """Projected Gradient Descent (Madry et al.): iterative FGSM projected onto the eps-ball."""
    model.eval()
    x0 = x.clone().detach()
    xa = x0.clone()
    if random_start:
        xa = (xa + torch.empty_like(xa).uniform_(-eps, eps)).clamp(0, 1)
    for _ in range(steps):
        xa = xa + alpha * _grad(model, xa, y).sign()
        xa = torch.min(torch.max(xa, x0 - eps), x0 + eps).clamp(0, 1).detach()
    return xa


def attack(kind, model, x, y, eps, alpha=None, steps=10):
    kind = kind.lower()
    if kind in ("none", "clean"):
        return x
    if kind == "fgsm":
        return fgsm(model, x, y, eps)
    if kind == "pgd":
        return pgd(model, x, y, eps, alpha or max(eps / 4, 0.5 / 255), steps)
    raise ValueError(kind)
