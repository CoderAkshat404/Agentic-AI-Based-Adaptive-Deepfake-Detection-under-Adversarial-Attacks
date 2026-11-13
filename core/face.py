"""Face detection / cropping and video frame sampling (OpenCV)."""
import cv2
import numpy as np
from PIL import Image

_FACE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
_EYE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")


def crop_face(img: Image.Image, margin=0.3):
    """Return (face_crop, info). If the image is already a tight face crop, keep it."""
    rgb = np.asarray(img.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    faces = _FACE.detectMultiScale(gray, 1.1, 5, minSize=(max(40, w // 10), max(40, h // 10)))
    if len(faces) == 0:
        return img.convert("RGB"), {"face_found": False, "box": None}
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    if fw * fh > 0.45 * w * h:              # already a face crop (dataset style)
        return img.convert("RGB"), {"face_found": True, "box": [0, 0, w, h]}
    m = int(margin * max(fw, fh))
    x0, y0, x1, y1 = max(0, x - m), max(0, y - m), min(w, x + fw + m), min(h, y + fh + m)
    return Image.fromarray(rgb[y0:y1, x0:x1]), {"face_found": True, "box": [int(x0), int(y0), int(x1), int(y1)]}


def eyes_visible(face_rgb: np.ndarray) -> bool:
    gray = cv2.cvtColor(face_rgb, cv2.COLOR_RGB2GRAY)
    upper = gray[: gray.shape[0] * 3 // 5]
    eyes = _EYE.detectMultiScale(upper, 1.1, 6, minSize=(upper.shape[1] // 12, upper.shape[1] // 12))
    return len(eyes) > 0


def sample_frames(video_path, n_frames=16):
    """Return (frames as PIL, fps, total_frames, sampled frame indices)."""
    cap = cv2.VideoCapture(str(video_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    idxs = np.linspace(0, total - 1, min(n_frames, total)).astype(int)
    frames = []
    for i in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, frame = cap.read()
        if ok:
            frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
    cap.release()
    return frames, fps, total, idxs.tolist()


def blink_analysis(video_path, max_seconds=20, stride=2):
    """Blink-rate proxy: transitions of eye visibility over consecutive frames."""
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    states, i = [], 0
    while i < fps * max_seconds:
        ok, frame = cap.read()
        if not ok:
            break
        if i % stride == 0:
            face, info = crop_face(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
            if info["face_found"]:
                states.append(eyes_visible(np.asarray(face)))
        i += 1
    cap.release()
    if len(states) < 10:
        return {"blinks_per_min": None, "frames_analysed": len(states)}
    blinks = sum(1 for a, b in zip(states, states[1:]) if a and not b)
    minutes = (len(states) * stride / fps) / 60
    return {"blinks_per_min": round(blinks / max(minutes, 1e-6), 1), "frames_analysed": len(states)}
