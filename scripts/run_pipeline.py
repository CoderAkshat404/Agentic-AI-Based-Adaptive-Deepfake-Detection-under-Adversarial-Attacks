"""Run (or RESUME) the whole pipeline. Safe to re-run any time, e.g. after the laptop shuts down:
finished stages are skipped and unfinished ones continue from their last checkpoint/cache.

    python scripts/run_pipeline.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable
W, R = ROOT / "weights", ROOT / "results"

STAGES = [
    ("1/5 dataset", lambda: (ROOT / "data/raw/Dataset/Test").exists(), ["scripts/download_data.py"]),
    ("2/5 detector pool", lambda: all((W / f"{n}.json").exists() for n in ("baseline", "robust", "vit")),
     ["scripts/train_detectors.py", "--model", "all", "--cooldown", "150"]),
    ("2b/5 CLIP detector", lambda: (W / "clip.json").exists(), ["scripts/train_clip_detector.py"]),
    ("3/5 Agent 1 + Agent 4", lambda: (W / "attack_detector.joblib").exists() and (W / "verifier.joblib").exists(),
     ["scripts/train_attack_detector.py"]),
    ("4/5 benchmark", lambda: (R / "benchmark.json").exists(), ["scripts/evaluate.py"]),
    ("5/5 demo samples", lambda: any((ROOT / "samples").glob("*.jpg")), ["scripts/make_samples.py"]),
]

for name, done, cmd in STAGES:
    if done():
        print(f"[skip] {name} - already complete")
        continue
    print(f"[run ] {name}", flush=True)
    rc = subprocess.call([PY, "-u", *cmd], cwd=ROOT)
    if rc != 0 or not done():
        sys.exit(f"[fail] {name} (exit {rc}) - just re-run this script to resume")
print("\nAll stages complete. Start the dashboard with:  streamlit run app.py")
