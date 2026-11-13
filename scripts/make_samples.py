"""Copy a few held-out Test images into samples/ for the dashboard gallery."""
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import SAMPLES_DIR
from core.data import list_samples

n = int(sys.argv[1]) if len(sys.argv) > 1 else 8
counts = {0: 0, 1: 0}
for path, label in list_samples("Test", 200, seed=99):
    if counts[label] >= n:
        continue
    counts[label] += 1
    shutil.copy(path, SAMPLES_DIR / f"{'fake' if label else 'real'}_{counts[label]:02d}.jpg")
print("samples written to", SAMPLES_DIR)
