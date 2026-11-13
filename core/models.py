"""Detector backbones (timm) with built-in normalisation so attacks work in [0,1] pixel space."""
import json

import timm
import torch
import torch.nn as nn

from config import ARCHS, WEIGHTS_DIR, DEVICE


class DetectorNet(nn.Module):
    def __init__(self, arch: str, pretrained: bool = True):
        super().__init__()
        self.backbone = timm.create_model(arch, pretrained=pretrained, num_classes=2)
        cfg = self.backbone.pretrained_cfg
        self.register_buffer("mean", torch.tensor(cfg.get("mean", (0.485, 0.456, 0.406))).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor(cfg.get("std", (0.229, 0.224, 0.225))).view(1, 3, 1, 1))

    def forward(self, x):           # x in [0,1]
        return self.backbone((x - self.mean) / self.std)


def weight_path(name):
    return WEIGHTS_DIR / f"{name}.pt"


def head_path(name):
    """Trained classifier layer only (used for CLIP, whose encoder is the unchanged public OpenAI model)."""
    return WEIGHTS_DIR / f"{name}_head.pt"


def is_available(name):
    return weight_path(name).exists() or head_path(name).exists()


def load_detector(name: str, device=DEVICE) -> DetectorNet:
    if weight_path(name).exists():
        model = DetectorNet(ARCHS[name], pretrained=False)
        model.load_state_dict(torch.load(weight_path(name), map_location="cpu"))
    else:
        # Frozen encoder: download the public pretrained weights, then attach our trained linear layer.
        model = DetectorNet(ARCHS[name], pretrained=True)
        model.backbone.get_classifier().load_state_dict(torch.load(head_path(name), map_location="cpu"))
    return model.to(device).eval()


class ModelZoo:
    """Lazy-loading pool of trained detectors."""

    def __init__(self, device=DEVICE):
        self.device = device
        self._models = {}

    def available(self):
        return [n for n in ARCHS if is_available(n)]

    def get(self, name) -> DetectorNet:
        if name not in self._models:
            m = load_detector(name, self.device)
            for p in m.parameters():
                p.requires_grad_(False)
            self._models[name] = m
        return self._models[name]

    @torch.no_grad()
    def logits(self, name, x):
        return self.get(name)(x.to(self.device)).float()

    @torch.no_grad()
    def p_fake(self, name, x):
        return torch.softmax(self.logits(name, x), 1)[:, 1]

    @staticmethod
    def meta(name):
        p = WEIGHTS_DIR / f"{name}.json"
        return json.loads(p.read_text()) if p.exists() else {}
