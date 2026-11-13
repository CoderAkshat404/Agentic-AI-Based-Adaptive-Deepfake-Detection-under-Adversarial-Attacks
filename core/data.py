"""Dataset utilities: balanced subsets of the Kaggle 'Deepfake and Real Images' dataset."""
import io
import random
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter
from torch.utils.data import Dataset
import torchvision.transforms as T

from config import DATA_DIR, IMG_SIZE

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def find_split(split: str) -> Path:
    """Locate e.g. data/raw/**/Train containing Fake/ and Real/ sub-folders."""
    for d in DATA_DIR.rglob("*"):
        if d.is_dir() and d.name.lower() == split.lower():
            subs = {s.name.lower() for s in d.iterdir() if s.is_dir()}
            if {"fake", "real"} <= subs:
                return d
    raise FileNotFoundError(f"Split '{split}' not found under {DATA_DIR}. Run scripts/download_data.py first.")


def list_samples(split: str, per_class: int = None, seed: int = 0):
    """Return a balanced, shuffled list of (path, label) with label 1 = fake."""
    root = find_split(split)
    rng = random.Random(seed)
    out = []
    for sub in root.iterdir():
        if not sub.is_dir() or sub.name.lower() not in ("fake", "real"):
            continue
        label = 1 if sub.name.lower() == "fake" else 0
        files = sorted(p for p in sub.iterdir() if p.suffix.lower() in IMG_EXT)
        rng.shuffle(files)
        if per_class:
            files = files[:per_class]
        out += [(str(p), label) for p in files]
    rng.shuffle(out)
    return out


class RandomJPEG:
    """Re-encode as JPEG with random quality: makes models tolerant to sanitized inputs."""

    def __init__(self, p=0.5, q=(50, 95)):
        self.p, self.q = p, q

    def __call__(self, img):
        if random.random() >= self.p:
            return img
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=random.randint(*self.q))
        buf.seek(0)
        return Image.open(buf).convert("RGB")


class RandomBlur:
    def __init__(self, p=0.25, r=(0.3, 1.2)):
        self.p, self.r = p, r

    def __call__(self, img):
        if random.random() >= self.p:
            return img
        return img.filter(ImageFilter.GaussianBlur(radius=random.uniform(*self.r)))


class PhoneStyle:
    """Simulates modern smartphone processing, applied to REAL and FAKE alike so it carries no label signal:
    portrait-mode background blur, beauty/skin smoothing, HDR-style tone & saturation, low-res upscaling + JPEG.
    Teaches detectors that 'smooth / blurry / vivid' does not mean 'deepfake'."""

    def __init__(self, p=0.5):
        self.p = p

    @staticmethod
    def bokeh(img):
        w, h = img.size
        blurred = img.filter(ImageFilter.GaussianBlur(random.uniform(2, 5)))
        mask = Image.new("L", (w, h), 0)
        from PIL import ImageDraw
        rx, ry = w * random.uniform(0.28, 0.4), h * random.uniform(0.36, 0.48)
        ImageDraw.Draw(mask).ellipse([w / 2 - rx, h / 2 - ry, w / 2 + rx, h / 2 + ry], fill=255)
        return Image.composite(img, blurred, mask.filter(ImageFilter.GaussianBlur(w * 0.06)))

    @staticmethod
    def smooth(img):
        import cv2
        a = np.asarray(img)
        s = cv2.bilateralFilter(a, 7, random.uniform(40, 90), 7)
        k = random.uniform(0.5, 1.0)
        return Image.fromarray((a * (1 - k) + s * k).astype(np.uint8))

    @staticmethod
    def tone(img):
        from PIL import ImageEnhance
        img = ImageEnhance.Color(img).enhance(random.uniform(0.95, 1.45))
        img = ImageEnhance.Contrast(img).enhance(random.uniform(0.85, 1.25))
        img = ImageEnhance.Brightness(img).enhance(random.uniform(0.9, 1.15))
        g = random.uniform(0.8, 1.2)
        return img.point(lambda v: int(255 * (v / 255) ** g))

    @staticmethod
    def resample(img):
        w, h = img.size
        s = random.uniform(0.4, 0.75)
        img = img.resize((max(32, int(w * s)), max(32, int(h * s))), Image.BILINEAR).resize((w, h), Image.BICUBIC)
        return RandomJPEG(p=1.0, q=(60, 95))(img)

    def __call__(self, img):
        if random.random() >= self.p:
            return img
        for op in random.sample([self.bokeh, self.smooth, self.tone, self.resample], k=random.randint(1, 3)):
            img = op(img)
        return img


def build_transform(train: bool, robust_aug: bool = False):
    if not train:
        return T.Compose([T.Resize((IMG_SIZE, IMG_SIZE)), T.ToTensor()])
    ops = [T.RandomResizedCrop(IMG_SIZE, scale=(0.8, 1.0), ratio=(0.9, 1.1)),
           T.RandomHorizontalFlip(),
           T.ColorJitter(0.15, 0.15, 0.1, 0.02)]
    if robust_aug:
        ops += [RandomJPEG(), RandomBlur()]
    ops.append(T.ToTensor())       # pixels in [0,1]; normalisation lives inside the model
    return T.Compose(ops)


class FaceDataset(Dataset):
    def __init__(self, samples, transform):
        self.samples, self.transform = samples, transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, i):
        path, label = self.samples[i]
        img = Image.open(path).convert("RGB")
        return self.transform(img), label


def load_image_tensor(img: Image.Image) -> torch.Tensor:
    """PIL -> (1,3,H,W) float tensor in [0,1]."""
    img = img.convert("RGB").resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
    return torch.from_numpy(np.asarray(img).copy()).permute(2, 0, 1).float().div(255).unsqueeze(0)


def tensor_to_image(x: torch.Tensor) -> np.ndarray:
    """(1,3,H,W) or (3,H,W) tensor in [0,1] -> HxWx3 uint8."""
    if x.dim() == 4:
        x = x[0]
    return (x.detach().clamp(0, 1).permute(1, 2, 0).cpu().numpy() * 255).round().astype(np.uint8)
