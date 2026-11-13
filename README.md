# Agentic AI-Based Adaptive Deepfake Detection under Adversarial Attacks

A multi-agent forensic system that detects deepfake faces **and** defends itself against
model-aware adversarial attacks (FGSM / PGD), implemented from the project design deck.

```
User upload -> Media Processor (frame sampling + face crop, OpenCV)
            -> Central Orchestrator (LangGraph StateGraph)
               |- Agent 1  Noise & Attack Detector   -> P(adv), attack type (clean / FGSM / PGD)
               |- if P(adv) > 0.65 -> Agent 2 Adaptive Sanitizer (closed loop, re-checked by Agent 1)
               |- Agent 3  Dynamic Model Selector    -> fast path | robust CNN + ViT ensemble
               '- Agent 4  Forensic Verifier         -> verdict, confidence, explainable audit log
```

## How to run

### First-time setup (after cloning)
```powershell
git clone https://github.com/CoderAkshat404/Agentic-AI-Based-Adaptive-Deepfake-Detection-under-Adversarial-Attacks.git
cd Agentic-AI-Based-Adaptive-Deepfake-Detection-under-Adversarial-Attacks
python -m venv .venv
.\.venv\Scripts\activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126   # NVIDIA GPU (or plain `pip install torch torchvision` for CPU)
pip install -r requirements.txt
```
Tested with Python 3.9 on Windows 11 and an NVIDIA RTX 2050.

### Start the dashboard
```powershell
.\.venv\Scripts\activate
streamlit run app.py
```
or double-click **`run_app.bat`**, then open http://localhost:8501.

The trained models are included in `weights/`, so no training is needed for the demo. The CLIP detector's
encoder is the unchanged public OpenAI model, so the repository stores only its trained final layer
(`weights/clip_head.pt`, 8 KB). The encoder (about 340 MB) is downloaded automatically the first time it is used.

### Report and presentation
* Project report: `report/Agentic_Deepfake_Detection_Report.pdf` (editable `.docx` alongside it)
* Presentation: `report/ppt/Agentic_Deepfake_Detection_Presentation.pptx`

### Re-train / resume everything (optional)
Double-click **`resume.bat`** (or run `python scripts\run_pipeline.py`). Finished stages are skipped and
unfinished ones resume from their last checkpoint, so it is safe to run after a shutdown.

| Stage | Script | Time (RTX 2050) |
|---|---|---|
| Dataset subset (23k images, partial parquet download) | `scripts/download_data.py` | ~4 min |
| Detector pool: baseline / adversarially-trained CNN / ViT | `scripts/train_detectors.py` | ~22 min |
| Agent 1 attack classifier + Agent 4 forensic calibration | `scripts/train_attack_detector.py` | ~20 min |
| Benchmark (Traditional vs Agentic, clean / FGSM / PGD) | `scripts/evaluate.py` | ~13 min |

### REST API (optional)
```powershell
uvicorn api:app --port 8000      # Swagger UI at http://127.0.0.1:8000/docs
```

## Measured results (256 held-out test images, eps = 4/255, PGD 10 steps)

| Condition | Traditional (EfficientNet-B0) | Static JPEG defense | Adv-trained CNN only | **Agentic AI (full)** | Agent 1 flagged |
|---|---|---|---|---|---|
| Clean | 88.7% | 87.5% | 88.3% | **94.1%** | 4.3% (false alarms) |
| FGSM | 33.2% | 14.5% | 53.5% | **84.4%** | 99.2% |
| PGD | 0.4% | 15.2% | 14.1% | **85.5%** | 100.0% |
| PGD-adaptive (targets robust CNN) | 19.9% | 65.6% | 0.0% | **84.0%** | 97.3% |

* Robust accuracy under attack (FGSM + PGD): **85.0%**, vs 16.8% for the traditional detector
* Attack damage prevented: **82% (FGSM), 90% (PGD)**
* Clean AUC-ROC: **0.987**
* Agent 1 attack-detection AUC: **0.9999**
* Latency: ~0.65 s clean vs ~1.2 s when attacked (sanitize + ViT/CLIP ensemble), on a thermally throttled laptop GPU
* Detector pool (validation accuracy): baseline 94.7%, robust CNN 94.3%, ViT 94.1% (fine-tuned 1 epoch each),
  CLIP 91.3% (frozen encoder + linear probe; 87.6% on phone-style images)

### How the system improved (each step chosen on the validation split, never the test split)
| Version | Clean | FGSM | PGD | File |
|---|---|---|---|---|
| v1: first agentic version | 91.8% | 65.6% | 84.0% | `results/benchmark_untuned.json` |
| v2: attack-specific sanitizer recipes + ViT-weighted threat ensemble | 91.8% | 84.0% | 83.6% | `results/benchmark_v2_fastpath_baseline_only.json` |
| v3: ViT cross-check on the clean path + human-review flag | 92.2% | 84.0% | 83.6% | `results/benchmark_v3_before_clip.json` |
| **v4: + CLIP detector and phone-style augmentation (current)** | **94.1%** | **84.4%** | **85.5%** | `results/benchmark.json` |

Key findings:
* **Model diversity defeats transfer attacks:** under attack the best pair is ViT + CLIP, two models that share no
  weights with the attacked CNN (validation: 88.8% FGSM / 91.8% PGD, vs 86.8% / 89.5% with the robust CNN + ViT).
* **Generalisation:** smartphone photos (portrait blur, skin smoothing, HDR) fool CNNs trained on one dataset.
  Adding CLIP raised validation accuracy on phone-style images from 90.5% to 94.8%.
* **Safe failure:** when detectors with different architectures strongly disagree, confidence is reduced and the
  result is flagged for human review instead of a confident wrong answer.

## Project structure
| Path | What it does |
|---|---|
| `agents/orchestrator.py` | LangGraph state graph, conditional routing (P(adv) > 0.65), image/video analysis, audit report |
| `agents/noise_detector.py` | Agent 1: FFT + noise-residual + feature-squeezing features -> gradient boosting -> P(adv) |
| `agents/sanitizer.py` | Agent 2: adaptive JPEG / median / TV / Gaussian purification with a self-verification loop |
| `agents/model_selector.py` | Agent 3: routes between EfficientNet-B0, adversarially-trained CNN, DeiT-Tiny ViT and CLIP (weights in `weights/ensemble.json`) |
| `scripts/train_clip_detector.py` | CLIP ViT-B/16 frozen encoder + linear probe, with phone-style augmentation |
| `scripts/tune_ensemble.py` | Chooses ensemble weights on the validation split |
| `agents/verifier.py` | Agent 4: forensic cues, tie-breaking, temporal and blink-rate checks, confidence |
| `core/attacks.py` | FGSM and PGD written from scratch in PyTorch |
| `core/sanitize.py` | Purification filters (batched GPU Total-Variation via Chambolle's algorithm) |
| `core/forensics.py` | Fourier / residual / texture / lighting measurements |
| `core/face.py` | OpenCV face detection, video frame sampling, eye-visibility blink analysis |
| `app.py` / `api.py` | Streamlit dashboard / FastAPI service |
| `results/benchmark.json`, `results/benchmark_bar.png` | Measured results (use these in the report / PPT) |

## Method (what to explain in the viva)
* **Dataset:** *Deepfake and Real Images* (OpenForensics face crops, 256x256). Balanced subset:
  12k train, 1.6k validation, held-out test split from a separate part of the dataset.
* **Fast training:** ImageNet-pretrained `timm` backbones, mixed precision (AMP), OneCycle LR, 1 epoch each.
  Training is crash-safe: atomic checkpoints every 50 steps, with automatic resume.
* **Adversarial training (robust CNN):** "Fast is better than free" FGSM with random start (Wong et al., 2020)
  at eps = 4/255, fine-tuned from the baseline. Half of each batch is clean and half adversarial, plus JPEG/blur
  augmentation so it stays accurate on sanitized inputs.
* **Attack detection (Agent 1):** adversarial perturbations are brittle. Squeezing the input (JPEG, median,
  5-bit, blur) moves the attacked model's logit far more than it moves a natural image's logit
  (Xu et al., *Feature Squeezing*, NDSS 2018). These shifts, plus FFT high-frequency energy and noise-residual
  statistics, go into a gradient-boosted classifier that outputs clean / FGSM / PGD. JPEG-compressed and
  blurred clean images are labelled clean to keep false alarms low.
* **Adaptive sanitization (Agent 2):** the starting recipe depends on the attack type (PGD gets stronger
  filtering). After each recipe Agent 1 re-scores the image, and the agent escalates until residual P(adv) < 0.65.
* **Dynamic routing (Agent 3):** the attacker targeted the deployed detector, so on the threat path it is
  bypassed. The sanitized face goes to the adversarially-trained CNN plus the ViT. Clean inputs take a fast
  single-model path, which keeps latency low.
* **Verification (Agent 4):** independent signal-level cues (spectral tail, noise residual, texture, lighting
  asymmetry; temporal flicker and blink rate for videos) cross-check the verdict, break ties, and produce
  the audit log.

## Threat model and limitations (be honest in the viva)
* Main benchmark: a **gray-box, model-aware attacker** who crafts eps = 4/255 perturbations against the deployed
  (traditional) detector, as in the design deck.
* **PGD-adaptive** row: the attacker targets the robust CNN directly (a harder stress test).
* A fully adaptive attacker who differentiates through the whole agent pipeline (BPDA/EOT) is future work.
* Lip-sync needs audio, and a 3D-CNN temporal model needs a video deepfake dataset (e.g. FaceForensics++,
  which requires a signed access request). Video is handled by per-frame agentic analysis plus temporal
  consistency and blink-rate checks.
