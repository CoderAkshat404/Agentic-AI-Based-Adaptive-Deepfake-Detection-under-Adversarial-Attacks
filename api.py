"""REST API (FastAPI) for the agentic detector.

    uvicorn api:app --port 8000      ->  docs at http://127.0.0.1:8000/docs
"""
import io

from fastapi import FastAPI, File, Form, UploadFile
from PIL import Image

from agents.orchestrator import AgenticOrchestrator, audit_report
from config import EPS

app = FastAPI(title="Agentic Deepfake Shield API", version="1.0")
orch = AgenticOrchestrator()


@app.get("/health")
def health():
    return {"status": "ok", "models": orch.zoo.available()}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), attack: str = Form("none"), eps: float = Form(EPS * 255)):
    """Analyse an image. `attack` in {none, fgsm, pgd} optionally simulates an attacker (eps in 1/255 units)."""
    img = Image.open(io.BytesIO(await file.read())).convert("RGB")
    return audit_report(orch.analyze_image(img, attack, eps / 255))
