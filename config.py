"""Global configuration for the Agentic Deepfake Shield project."""
from pathlib import Path
import torch

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "raw"
WEIGHTS_DIR = ROOT / "weights"
RESULTS_DIR = ROOT / "results"
SAMPLES_DIR = ROOT / "samples"
for _d in (WEIGHTS_DIR, RESULTS_DIR, SAMPLES_DIR):
    _d.mkdir(parents=True, exist_ok=True)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMG_SIZE = 224
CLASS_NAMES = ["REAL", "FAKE"]          # label 1 = deepfake

# Detector pool (Agent 3 chooses among these)
ARCHS = {
    "baseline": "efficientnet_b0",          # traditional detector (standard training)
    "robust":   "efficientnet_b0",          # adversarially-trained CNN (FGSM-RS)
    "vit":      "deit_tiny_patch16_224",    # spatial Vision Transformer
    "clip":     "vit_base_patch16_clip_224.openai",  # frozen CLIP encoder + linear probe (generalisation)
}

# Threat model (L-inf, pixel range [0,1])
EPS = 4 / 255
PGD_STEPS = 10
PGD_ALPHA = 1 / 255

# Orchestrator routing threshold, P(adv) > 0.65 -> sanitize (from design doc)
P_ADV_THRESHOLD = 0.65
