"""Streamlit dashboard - Agentic AI-Based Adaptive Deepfake Detection under Adversarial Attacks.

    streamlit run app.py
"""
import json
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from PIL import Image

from config import EPS, P_ADV_THRESHOLD, RESULTS_DIR, SAMPLES_DIR, WEIGHTS_DIR
from core.data import tensor_to_image

st.set_page_config(page_title="Agentic Deepfake Shield", page_icon="🛡️", layout="wide")

st.markdown("""
<style>
.block-container {padding-top: 1.6rem;}
.agent-card {border:1px solid rgba(56,189,248,.35); border-radius:12px; padding:.7rem 1rem; margin-bottom:.55rem;
             background:rgba(15,23,42,.55);}
.agent-card b {color:#38bdf8;}
.verdict {border-radius:14px; padding:1rem 1.2rem; font-size:1.25rem; font-weight:700; text-align:center;}
.v-fake {background:rgba(239,68,68,.15); border:1px solid #ef4444; color:#f87171;}
.v-real {background:rgba(34,197,94,.15); border:1px solid #22c55e; color:#4ade80;}
.small {opacity:.75; font-size:.85rem;}
</style>""", unsafe_allow_html=True)


@st.cache_resource(show_spinner="Loading agents and detector pool...")
def get_orchestrator():
    from agents.orchestrator import AgenticOrchestrator
    return AgenticOrchestrator()


def weights_ready():
    return all((WEIGHTS_DIR / f).exists() for f in ("baseline.pt", "robust.pt", "vit.pt", "attack_detector.joblib"))


def gauge(p_fake, title):
    fig = go.Figure(go.Indicator(mode="gauge+number", value=p_fake * 100, number={"suffix": "%"},
                                 title={"text": title},
                                 gauge={"axis": {"range": [0, 100]},
                                        "bar": {"color": "#ef4444" if p_fake >= .5 else "#22c55e"},
                                        "steps": [{"range": [0, 50], "color": "rgba(34,197,94,.15)"},
                                                  {"range": [50, 100], "color": "rgba(239,68,68,.15)"}],
                                        "threshold": {"line": {"color": "white", "width": 2}, "value": 50}}))
    fig.update_layout(height=230, margin=dict(l=20, r=20, t=50, b=10))
    return fig


MODEL_NAMES = {"baseline": "Traditional", "robust": "Robust", "vit": "ViT", "clip": "CLIP"}


def radar(cue_fakeness):
    names = list(cue_fakeness)
    vals = [v * 100 for v in cue_fakeness.values()]
    fig = go.Figure(go.Scatterpolar(r=vals + vals[:1], theta=names + names[:1], fill="toself",
                                    line_color="#f472b6", name="looks fake",
                                    hovertemplate="%{theta}: %{r:.0f} / 100<extra></extra>"))
    fig.update_layout(polar=dict(radialaxis=dict(range=[0, 100], visible=True)), height=330,
                      margin=dict(l=40, r=40, t=40, b=20), title="Agent 4: Image clue check", showlegend=False)
    return fig


def contribution_pie(sel):
    w = sel["weights"]
    fig = go.Figure(go.Pie(labels=[MODEL_NAMES[k] for k in w], values=list(w.values()), hole=.45, sort=False,
                           text=[f"{MODEL_NAMES[k]}<br>vote {w[k]:.0%}<br>says {sel['outputs'][k]:.0%} fake" for k in w],
                           textinfo="text", textposition="outside",
                           hovertemplate="%{label}<extra></extra>"))
    fig.update_layout(height=330, margin=dict(l=40, r=40, t=50, b=30), title="Agent 3: Which models voted",
                      showlegend=False)
    return fig


def show_pipeline(out):
    for agent, msg in out["log"]:
        st.markdown(f"<div class='agent-card'><b>{agent}</b><br>{msg}</div>", unsafe_allow_html=True)


def verdict_box(v):
    cls = "v-fake" if v["label"] == "FAKE" else "v-real"
    review = " · ⚠ flagged for human review" if v["needs_human_review"] else ""
    st.markdown(f"<div class='verdict {cls}'>{v['label']} — P(fake) {v['p_fake']:.1%} · confidence {v['confidence']:.0%}{review}</div>",
                unsafe_allow_html=True)


# ============================================================================ sidebar
st.sidebar.title("🛡️ Agentic Deepfake Shield")
st.sidebar.caption("Agentic AI-Based Adaptive Deepfake Detection under Adversarial Attacks")
page = st.sidebar.radio("Navigate", ["🔍 Live Analysis", "📊 Benchmark Results", "🧠 Architecture"])
st.sidebar.markdown("---")
st.sidebar.subheader("Red-team simulator")
attack_kind = st.sidebar.selectbox("Simulate attacker", ["none", "fgsm", "pgd"],
                                   format_func=lambda k: {"none": "No attack (clean)", "fgsm": "FGSM (one-step)",
                                                          "pgd": "PGD (10-step iterative)"}[k])
eps_px = st.sidebar.slider("Perturbation budget ε (×1/255)", 1, 16, int(round(EPS * 255)), disabled=attack_kind == "none")
st.sidebar.caption("The attacker is model-aware: it computes gradients of the traditional detector and adds an "
                   "invisible perturbation to flip its decision.")

if not weights_ready():
    st.error("Trained weights not found in `weights/`. Run `python scripts/train_detectors.py` and "
             "`python scripts/train_attack_detector.py` first (see README).")
    st.stop()

# ============================================================================ pages
if page == "🔍 Live Analysis":
    st.title("Live Forensic Analysis")
    mode = st.radio("Input", ["Image", "Video", "Sample gallery"], horizontal=True)
    img, video_path = None, None
    if mode == "Image":
        f = st.file_uploader("Upload a face image", type=["jpg", "jpeg", "png", "webp", "bmp"])
        if f:
            img = Image.open(f).convert("RGB")
    elif mode == "Video":
        f = st.file_uploader("Upload a video", type=["mp4", "avi", "mov", "mkv"])
        if f:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=Path(f.name).suffix)
            tmp.write(f.read()), tmp.close()
            video_path = tmp.name
            st.video(video_path)
    else:
        files = sorted(SAMPLES_DIR.glob("*.jpg"))
        if not files:
            st.info("No samples yet - run `python scripts/make_samples.py`.")
        else:
            import random
            random.Random(7).shuffle(files)          # fixed mixed order, so position doesn't reveal the label
            names = [p.name for p in files]
            if st.session_state.get("sample_choice") not in names:
                st.session_state["sample_choice"] = names[0]
            show_truth = st.checkbox("Show ground-truth labels under thumbnails", value=False,
                                     help="Hide them to quiz the audience, show them to check answers.")
            st.caption("Held-out test images (never seen during training). Click the button under an image to select it.")
            per_row = 8
            for start in range(0, len(files), per_row):
                cols = st.columns(per_row)
                for col, p in zip(cols, files[start:start + per_row]):
                    with col:
                        selected = p.name == st.session_state["sample_choice"]
                        st.image(str(p), use_container_width=True)
                        label = ("FAKE" if p.name.startswith("fake") else "REAL") if show_truth else f"#{files.index(p) + 1}"
                        if st.button(("✅ " if selected else "") + label, key=f"pick_{p.name}",
                                     type="primary" if selected else "secondary", use_container_width=True):
                            st.session_state["sample_choice"] = p.name
                            st.rerun()
            choice = st.session_state["sample_choice"]
            img = Image.open(SAMPLES_DIR / choice).convert("RGB")
            c_img, c_txt = st.columns([1, 3])
            c_img.image(img, caption=f"Selected: {choice}", use_container_width=True)
            c_txt.markdown(f"**Selected image:** `{choice}`  \n**Ground truth:** "
                           f"**{'FAKE (deepfake)' if choice.startswith('fake') else 'REAL (genuine photo)'}**  \n\n"
                           "Choose an attack in the sidebar, then press **Run agentic pipeline** below.")

    orch = get_orchestrator()
    eps = eps_px / 255

    if img is not None and st.button("🚀 Run agentic pipeline", type="primary"):
        with st.spinner("Agents at work..."):
            out = orch.analyze_image(img, attack_kind, eps)
        v = out["verdict"]
        c1, c2, c3, c4 = st.columns(4)
        c1.image(tensor_to_image(out["x_original"]), caption="Ingested face", use_container_width=True)
        c2.image(tensor_to_image(out["x_input"]), caption=f"Model input ({attack_kind.upper() if attack_kind != 'none' else 'clean'})",
                 use_container_width=True)
        diff = (out["x_input"] - out["x_original"]).abs()
        amp = tensor_to_image((diff / max(float(diff.max()), 1e-6)))
        c3.image(amp, caption="Perturbation (amplified)", use_container_width=True)
        if "x_sanitized" in out and out["threat"]["under_attack"]:
            c4.image(tensor_to_image(out["x_sanitized"]), caption="Sanitized by Agent 2", use_container_width=True)
        else:
            c4.info("Agent 2 bypassed - clean route (saves compute).")

        st.markdown("### Verdict")
        verdict_box(v)
        g1, g2, g3 = st.columns(3)
        g1.plotly_chart(gauge(out["baseline_p_fake"], "Traditional detector P(fake)"), use_container_width=True)
        g2.plotly_chart(gauge(v["p_fake"], "Agentic system P(fake)"), use_container_width=True)
        with g3:
            th = out["threat"]
            st.metric("Adversarial probability P(adv)", f"{th['p_adv']:.1%}",
                      delta="ATTACK DETECTED" if th["under_attack"] else "clean", delta_color="inverse" if th["under_attack"] else "off")
            st.metric("Detected attack type", th["attack_type"].upper())
            st.metric("Total latency", f"{out['timings']['total']:.0f} ms")

        st.markdown("### Agent execution trace")
        show_pipeline(out)
        r1, r2 = st.columns(2)
        r1.plotly_chart(radar(v["cue_fakeness"]), use_container_width=True)
        r1.caption("Six simple image measurements. **0 = looks real, 50 = neutral, 100 = looks fake.** "
                   "A bigger pink shape means more clues look fake. These clues only support the models' decision.")
        r2.plotly_chart(contribution_pie(out["selection"]), use_container_width=True)
        r2.caption("**Slice size = how much that model's vote counts.** The text shows what each model thinks. "
                   "The final answer is the weighted average of the votes.")
        if out.get("sanitization"):
            st.markdown("**Agent 2: Cleaning attempts** (after each attempt, Agent 1 checks again whether the attack is gone)")
            st.dataframe(pd.DataFrame([{
                "Attempt": i + 1,
                "Cleaning method": t["recipe"],
                "Attack still detected after cleaning": f"{t['residual_p_adv']:.0%}",
                "Image quality (dB, above 30 = looks the same)": t["psnr_db"],
                "Time (ms)": t["ms"]} for i, t in enumerate(out["sanitization"])]),
                use_container_width=True, hide_index=True)
        from agents.orchestrator import audit_report
        rep = audit_report(out)
        st.download_button("⬇ Download full report (JSON)", json.dumps(rep, indent=2), "report.json", "application/json")
        with st.expander("Full report (technical details)"):
            st.json(rep)

    if video_path and st.button("🚀 Analyse video", type="primary"):
        bar = st.progress(0.0, "Sampling frames, detecting faces, running agents per frame...")
        res = orch.analyze_video(video_path, attack_kind, eps, n_frames=12, progress=lambda p: bar.progress(p))
        v, s = res["verdict"], res["stats"]
        verdict_box(v)
        m = st.columns(4)
        m[0].metric("Frames analysed", s["frames"])
        m[1].metric("Frames flagged adversarial", s["frames_flagged_adv"])
        m[2].metric("Temporal score flicker (std)", f"{s['temporal_std']:.3f}")
        m[3].metric("Blink rate", f"{s['blinks_per_min']}/min" if s.get("blinks_per_min") is not None else "n/a")
        fig = go.Figure()
        fig.add_scatter(x=res["frame_idx"], y=res["scores"], mode="lines+markers", name="Agentic P(fake)")
        fig.add_scatter(x=res["frame_idx"], y=res["baseline_scores"], mode="lines+markers", name="Traditional P(fake)",
                        line=dict(dash="dot"))
        fig.add_hline(y=.5, line_dash="dash")
        fig.update_layout(title="Temporal analysis across frames", xaxis_title="frame", yaxis_title="P(fake)", height=350)
        st.plotly_chart(fig, use_container_width=True)
        st.markdown("\n".join(f"- {n}" for n in v["notes"]))
        cols = st.columns(6)
        for i, fr in enumerate(res["frames"][:6]):
            cols[i].image(tensor_to_image(fr["x_input"]), caption=f"P(fake) {fr['verdict']['p_fake']:.2f}")

elif page == "📊 Benchmark Results":
    st.title("Benchmark: Traditional vs Agentic AI")
    bp = RESULTS_DIR / "benchmark.json"
    if not bp.exists():
        st.info("Run `python scripts/evaluate.py` to produce benchmark results.")
        st.stop()
    b = json.loads(bp.read_text())
    R = b["results"]
    h = b["headline"]
    k = st.columns(4)
    k[0].metric("Robust accuracy under attack", f"{h['robust_accuracy_under_attack']:.1%}")
    k[1].metric("Clean AUC-ROC (agentic)", f"{h['clean_auc']:.3f}")
    k[2].metric("Latency, clean path", f"{h['latency_clean_ms']:.0f} ms")
    k[3].metric("Latency, attack path", f"{h['latency_attacked_ms']:.0f} ms")
    st.caption(f"{b['n_images']} held-out test images · ε = {b['eps']} · PGD {b['pgd_steps']} steps · "
               f"orchestrator: {b['graph_engine']} · routing threshold P(adv) > {b['p_adv_threshold']}")

    SYS_NAMES = {"Traditional (EfficientNet-B0)": "Traditional model",
                 "Static defense (JPEG + baseline)": "Traditional + simple cleaning",
                 "Adv-trained CNN only": "Robust model alone",
                 "Agentic AI (full)": "Agentic AI (our system)"}
    COND_NAMES = {"Clean": "No attack", "FGSM": "FGSM attack", "PGD": "PGD attack",
                  "PGD-adaptive (targets robust CNN)": "PGD attack on Robust model"}
    systems = [s for s in R["Clean"] if not s.startswith("_")]
    conds = list(R)
    fig = go.Figure()
    colors = ["#ef4444", "#f59e0b", "#a855f7", "#38bdf8"]
    for s, c in zip(systems, colors):
        fig.add_bar(name=SYS_NAMES.get(s, s), x=[COND_NAMES.get(cd, cd) for cd in conds],
                    y=[R[cd][s]["accuracy"] * 100 for cd in conds], marker_color=c,
                    text=[f"{R[cd][s]['accuracy'] * 100:.1f}%" for cd in conds], textposition="outside")
    fig.update_layout(barmode="group", yaxis_title="Correct answers (%)", yaxis_range=[0, 110], height=460,
                      legend=dict(orientation="h", y=1.12))
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Detailed results")
    rows = []
    for cd in conds:
        for s in systems:
            rows.append({"Test": COND_NAMES.get(cd, cd), "System": SYS_NAMES.get(s, s),
                         "Correct answers %": round(R[cd][s]["accuracy"] * 100, 1),
                         "Fakes caught %": round(R[cd][s]["fake_detection_rate"] * 100, 1),
                         "Real vs fake separation (1 = perfect)": round(R[cd][s]["auc"], 3)})
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    st.caption("**Correct answers** = out of all test images. **Fakes caught** = out of the fake images only. "
               "**Separation** (AUC) shows how well the system tells real and fake apart: 1 = perfect, 0.5 = guessing.")
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("Agent 1: How often it said \"attacked\"")
        st.dataframe(pd.DataFrame({"Test": [COND_NAMES.get(c, c) for c in conds], "Marked as attacked %":
                                   [round(R[c]["_agent1_flag_rate"] * 100, 1) for c in conds]}), hide_index=True)
        st.caption("For **No attack**, this is a false alarm (lower is better). "
                   "For the attacks, this is how many attacks were caught (higher is better).")
    with c2:
        st.subheader("Damage prevented by our system")
        for c in ("FGSM", "PGD"):
            st.metric(COND_NAMES[c], f"{R[c]['_attack_damage_reduction_pct']:.1f}%")
        st.caption("When the attack lowers the Traditional model's score, this shows how much of that loss "
                   "our system avoids. 100% would mean the attack has no effect at all.")
    MODEL_INFO = {
        "baseline": ("Traditional", "Standard image AI (EfficientNet-B0). This is the model the attacker targets."),
        "robust": ("Robust", "Same AI as Traditional, but also trained on attacked images."),
        "vit": ("ViT", "A different kind of AI that compares all parts of the face with each other."),
        "clip": ("CLIP", "A large AI from OpenAI that has seen 400 million internet photos. We trained only its last layer."),
    }
    meta = {n: json.loads((WEIGHTS_DIR / f"{n}.json").read_text()) for n in MODEL_INFO if (WEIGHTS_DIR / f"{n}.json").exists()}
    if meta:
        st.subheader("Our 4 models")
        st.dataframe(pd.DataFrame([{"Model": MODEL_INFO[n][0], "What it is": MODEL_INFO[n][1],
                                    "Training images": m["train_images"],
                                    "Accuracy on check images %": round(m["best_val_acc"] * 100, 1),
                                    "Training time (min)": m["minutes"] if m["minutes"] else "about 20"}
                                   for n, m in meta.items()]), hide_index=True, use_container_width=True)
        st.caption("**Check images** = a separate set used while building the system (not the final test images).")

else:
    from agents.orchestrator import GRAPH_ENGINE
    st.title("System Architecture")
    st.graphviz_chart(f"""
    digraph G {{
      rankdir=TB; bgcolor="transparent"; node [shape=box, style="rounded,filled", fontname="Helvetica", fontcolor="#0f172a"];
      U [label="User upload\\n(image / video)", fillcolor="#bae6fd"];
      M [label="Media Processor\\nframe sampling + face crop (OpenCV)", fillcolor="#fecaca"];
      O [label="Central Orchestrator\\n({GRAPH_ENGINE} state graph)", fillcolor="#bbf7d0"];
      A1 [label="Agent 1: Noise & Attack Detector\\nFFT + residual + feature squeezing → P(adv)", fillcolor="#e0f2fe"];
      A2 [label="Agent 2: Adaptive Sanitizer\\nJPEG / Median / TV / Gaussian, closed-loop", fillcolor="#bbf7d0"];
      A3 [label="Agent 3: Dynamic Model Selector", fillcolor="#e0f2fe"];
      B [label="EfficientNet-B0\\n(fast path)", fillcolor="#f1f5f9"];
      R [label="Adv-trained CNN\\n(FGSM-RS)", fillcolor="#f1f5f9"];
      V [label="Spatial ViT\\n(DeiT-Tiny)", fillcolor="#f1f5f9"];
      A4 [label="Agent 4: Forensic Verifier\\nspectrum · texture · lighting · blink · temporal", fillcolor="#99f6e4"];
      OUT [label="Verdict + confidence + explainable audit log", fillcolor="#bae6fd"];
      U -> M -> O -> A1;
      A1 -> A2 [label="P(adv) > {P_ADV_THRESHOLD}", color="#ef4444", fontcolor="#ef4444"];
      A1 -> A3 [label="clean", color="#22c55e", fontcolor="#22c55e"];
      A2 -> A1 [label="re-check", style=dashed];
      A2 -> A3; A3 -> B; A3 -> R; A3 -> V; B -> A4; R -> A4; V -> A4; A4 -> OUT;
    }}""")
    st.markdown("""
| Agent | Technique | Role |
|---|---|---|
| **1 · Noise Detector** | FFT high-frequency energy, median-residual statistics, *feature squeezing* (logit shift under JPEG/median/bit-depth/blur) → gradient-boosted classifier | Estimates **P(adv)** and attack type (clean / FGSM / PGD) |
| **2 · Sanitizer** | JPEG re-encoding, median filter, Total-Variation (Chambolle) denoising, Gaussian smoothing | Strength picked from threat level, then **re-verified by Agent 1** and escalated if residual noise remains |
| **3 · Model Selector** | EfficientNet-B0, adversarially-trained EfficientNet-B0 (FGSM-RS, ε=4/255), DeiT-Tiny ViT | Clean → fast path; attacked → robust ensemble (the attacked model is bypassed) |
| **4 · Verifier** | Spectral tail, noise residual, texture, lighting asymmetry, temporal flicker, blink rate | Cross-checks, breaks ties, writes the audit log |
""")
