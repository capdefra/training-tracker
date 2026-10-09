#!/usr/bin/env python3
"""Draw short looping placeholder form clips for the ski-plan exercises.

These are original stick figures, not filmed demonstrations. Each file is a
silent WebM under public/form-demos/. To use a real clip, replace that file
(WebM preferred, GIF works too) and update the matching entry in src/lib/demos.ts.

The filmed clips (goblet squat, bench press, incline press, curl, hip thrust)
are not generated here.
"""

from __future__ import annotations

import math
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "form-demos"
W, H = 640, 360
FRAMES = 24
FPS = 12

KEYS = (
    "head",
    "shoulder",
    "hip",
    "knee_f",
    "ankle_f",
    "toe_f",
    "heel_f",
    "knee_b",
    "ankle_b",
    "toe_b",
    "heel_b",
    "elbow_f",
    "wrist_f",
    "elbow_b",
    "wrist_b",
)

Pose = dict[str, tuple[float, float]]


def pose(*pts: tuple[float, float]) -> Pose:
    if len(pts) != len(KEYS):
        raise SystemExit(f"expected {len(KEYS)} points, got {len(pts)}")
    return dict(zip(KEYS, pts, strict=True))


def mix(a: Pose, b: Pose, t: float) -> Pose:
    return {key: (a[key][0] + (b[key][0] - a[key][0]) * t, a[key][1] + (b[key][1] - a[key][1]) * t) for key in KEYS}


def up(src: Pose, dy: float, skip: tuple[str, ...] = ()) -> Pose:
    return {key: (x, y if key in skip else y + dy) for key, (x, y) in src.items()}


# Upright, facing right, feet on the ground line.
STAND = pose(
    (336, 74),
    (338, 106),
    (334, 184),
    (352, 250),
    (348, 310),
    (380, 320),
    (328, 320),
    (314, 252),
    (306, 310),
    (336, 320),
    (286, 320),
    (372, 154),
    (366, 208),
    (306, 156),
    (298, 210),
)


def svg(name: str, body: Pose, prop: str, tool: str, hands: str) -> str:
    front = "#1e4d3a"
    back = "#8aa898"
    weight = "#c4491d"
    parts: list[str] = [
        f'<rect width="{W}" height="{H}" fill="#f3efe6"/>',
        '<text x="22" y="30" font-family="DejaVu Sans, sans-serif" font-size="15" font-weight="700" fill="#8a4b12" letter-spacing="1.4">PLACEHOLDER</text>',
        f'<text x="22" y="52" font-family="DejaVu Sans, sans-serif" font-size="16" font-weight="650" fill="#5e584e">{escape(name)}</text>',
        '<line x1="36" y1="328" x2="604" y2="328" stroke="#ddd4c4" stroke-width="4" stroke-linecap="round"/>',
    ]
    if prop == "box":
        parts.append('<rect x="430" y="252" width="92" height="76" rx="8" fill="#e7f0ea" stroke="#1e4d3a" stroke-width="4"/>')
    elif prop == "bench":
        parts.append('<rect x="168" y="248" width="96" height="18" rx="6" fill="#5e584e"/>')
        parts.append('<rect x="184" y="266" width="12" height="62" fill="#5e584e"/>')
        parts.append('<rect x="236" y="266" width="12" height="62" fill="#5e584e"/>')
    elif prop == "bench-long":
        parts.append('<rect x="150" y="188" width="150" height="16" rx="6" fill="#5e584e"/>')
        parts.append('<rect x="168" y="204" width="12" height="40" fill="#5e584e"/>')
    elif prop == "incline":
        parts.append('<polygon points="210,150 430,250 430,268 210,168" fill="#5e584e"/>')
        parts.append('<rect x="414" y="250" width="14" height="78" fill="#5e584e"/>')

    def seg(a: str, b: str, color: str, width: int = 8) -> None:
        x1, y1 = body[a]
        x2, y2 = body[b]
        parts.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
        )

    seg("hip", "knee_b", back)
    seg("knee_b", "ankle_b", back)
    seg("heel_b", "ankle_b", back, 6)
    seg("ankle_b", "toe_b", back, 6)
    seg("shoulder", "elbow_b", back)
    seg("elbow_b", "wrist_b", back)
    seg("shoulder", "hip", front, 9)
    seg("hip", "knee_f", front)
    seg("knee_f", "ankle_f", front)
    seg("heel_f", "ankle_f", front, 6)
    seg("ankle_f", "toe_f", front, 6)
    seg("shoulder", "elbow_f", front)
    seg("elbow_f", "wrist_f", front)
    hx, hy = body["head"]
    sx, sy = body["shoulder"]
    parts.append(f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{hx:.1f}" y2="{hy + 14:.1f}" stroke="{front}" stroke-width="8" stroke-linecap="round"/>')
    parts.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="16" fill="#fffcf7" stroke="{front}" stroke-width="6"/>')

    targets: list[str] = []
    if hands == "both":
        targets = ["wrist_f", "wrist_b"]
    elif hands == "front":
        targets = ["wrist_f"]
    elif hands == "back":
        targets = ["wrist_b"]
    for key in targets:
        x, y = body[key]
        if tool == "kb":
            parts.append(f'<circle cx="{x:.1f}" cy="{y + 16:.1f}" r="12" fill="{weight}"/>')
            parts.append(f'<rect x="{x - 8:.1f}" y="{y + 4:.1f}" width="16" height="6" rx="2" fill="#1c1915"/>')
        else:
            parts.append(f'<line x1="{x - 16:.1f}" y1="{y:.1f}" x2="{x + 16:.1f}" y2="{y:.1f}" stroke="#1c1915" stroke-width="4" stroke-linecap="round"/>')
            parts.append(f'<circle cx="{x - 16:.1f}" cy="{y:.1f}" r="8" fill="{weight}"/>')
            parts.append(f'<circle cx="{x + 16:.1f}" cy="{y:.1f}" r="8" fill="{weight}"/>')

    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">' + "".join(parts) + "</svg>"


def escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;")


def phase(index: int) -> float:
    return math.sin(math.pi * index / (FRAMES - 1))


# name, file slug, start, end, prop, tool, hands
CLIPS: list[tuple[str, str, Pose, Pose, str, str, str]] = []


def add(slug: str, label: str, start: Pose, end: Pose, prop: str = "", tool: str = "db", hands: str = "both") -> None:
    CLIPS.append((slug, label, start, end, prop, tool, hands))


add(
    "bulgarian-split-squat",
    "Bulgarian split squat",
    pose((348, 78), (350, 112), (346, 188), (410, 236), (448, 308), (478, 318), (426, 318), (250, 228), (214, 246), (240, 244), (192, 250), (386, 158), (380, 214), (314, 160), (306, 214)),
    pose((332, 112), (334, 146), (328, 230), (430, 268), (448, 308), (478, 318), (426, 318), (246, 286), (214, 250), (240, 248), (192, 254), (372, 190), (366, 242), (300, 192), (292, 244)),
    "bench",
)
add(
    "step-up",
    "Step-up",
    pose((300, 108), (302, 140), (298, 210), (400, 196), (456, 244), (484, 244), (434, 250), (270, 250), (262, 308), (292, 318), (242, 318), (336, 186), (330, 236), (274, 188), (266, 238)),
    pose((430, 48), (432, 80), (428, 150), (456, 214), (470, 244), (498, 244), (448, 250), (360, 196), (330, 230), (352, 236), (308, 240), (466, 118), (460, 168), (400, 120), (394, 170)),
    "box",
)
add(
    "dumbbell-romanian-deadlift",
    "Dumbbell Romanian deadlift",
    STAND,
    pose((470, 168), (430, 176), (334, 190), (360, 252), (352, 310), (384, 320), (332, 320), (300, 256), (292, 310), (322, 320), (272, 320), (390, 230), (378, 286), (360, 236), (348, 290)),
)
add(
    "side-plank",
    "Side plank",
    pose((132, 168), (176, 188), (330, 196), (450, 214), (548, 228), (572, 236), (530, 236), (450, 230), (548, 244), (572, 250), (530, 250), (176, 250), (196, 300), (210, 150), (236, 112)),
    pose((132, 156), (176, 176), (330, 168), (450, 198), (548, 220), (572, 228), (530, 228), (450, 214), (548, 236), (572, 242), (530, 242), (176, 246), (196, 300), (214, 132), (244, 96)),
    "",
    "none",
    "none",
)
add(
    "chest-supported-row",
    "Chest-supported row",
    pose((196, 118), (250, 150), (390, 230), (470, 268), (500, 308), (528, 318), (480, 318), (450, 280), (470, 308), (498, 318), (450, 318), (250, 210), (246, 268), (236, 214), (230, 270)),
    pose((196, 118), (250, 150), (390, 230), (470, 268), (500, 308), (528, 318), (480, 318), (450, 280), (470, 308), (498, 318), (450, 318), (300, 150), (286, 168), (214, 168), (198, 176)),
    "incline",
)
add(
    "standing-calf-raise",
    "Standing calf raise",
    STAND,
    up(STAND, -28, ("toe_f", "toe_b")),
)
add(
    "one-arm-dumbbell-row",
    "One-arm dumbbell row",
    pose((456, 150), (410, 164), (300, 196), (330, 252), (326, 308), (356, 318), (306, 318), (270, 250), (250, 308), (280, 318), (230, 318), (430, 230), (424, 292), (360, 210), (340, 250)),
    pose((456, 150), (410, 164), (300, 196), (330, 252), (326, 308), (356, 318), (306, 318), (270, 250), (250, 308), (280, 318), (230, 318), (390, 150), (360, 158), (360, 210), (340, 250)),
    "",
    "db",
    "front",
)
add(
    "half-kneeling-one-arm-overhead-press",
    "Half-kneeling press",
    pose((348, 70), (350, 104), (346, 186), (430, 240), (456, 308), (486, 318), (434, 318), (270, 292), (230, 314), (258, 320), (210, 318), (386, 130), (378, 112), (310, 150), (300, 200)),
    pose((348, 70), (350, 104), (346, 186), (430, 240), (456, 308), (486, 318), (434, 318), (270, 292), (230, 314), (258, 320), (210, 318), (392, 96), (396, 58), (310, 150), (300, 200)),
    "",
    "db",
    "front",
)
add(
    "rear-delt-raise",
    "Rear-delt raise",
    pose((430, 156), (390, 168), (300, 196), (328, 252), (324, 308), (354, 318), (304, 318), (274, 254), (258, 308), (288, 318), (238, 318), (410, 220), (404, 274), (360, 224), (354, 276)),
    pose((430, 156), (390, 168), (300, 196), (328, 252), (324, 308), (354, 318), (304, 318), (274, 254), (258, 308), (288, 318), (238, 318), (360, 140), (300, 124), (330, 168), (270, 150)),
)
add(
    "overhead-triceps-extension",
    "Overhead triceps extension",
    pose((336, 108), (338, 140), (334, 210), (352, 262), (348, 310), (380, 320), (328, 320), (314, 264), (306, 310), (336, 320), (286, 320), (360, 86), (364, 40), (314, 90), (310, 44)),
    pose((336, 108), (338, 140), (334, 210), (352, 262), (348, 310), (380, 320), (328, 320), (314, 264), (306, 310), (336, 320), (286, 320), (358, 84), (330, 118), (312, 88), (286, 122)),
)
add(
    "dead-bug",
    "Dead bug",
    pose((168, 168), (220, 188), (340, 196), (400, 150), (450, 130), (468, 118), (438, 142), (400, 230), (460, 250), (478, 258), (444, 258), (250, 150), (290, 130), (250, 220), (290, 240)),
    pose((168, 168), (220, 188), (340, 196), (430, 120), (530, 112), (552, 104), (516, 124), (390, 188), (430, 186), (452, 184), (414, 196), (160, 120), (110, 108), (250, 210), (280, 230)),
    "",
    "none",
    "none",
)
add(
    "kettlebell-swing",
    "Kettlebell swing",
    pose((430, 176), (390, 180), (320, 196), (348, 256), (344, 310), (376, 320), (324, 320), (292, 258), (280, 310), (310, 320), (260, 320), (300, 230), (270, 268), (280, 232), (250, 270)),
    pose((336, 64), (338, 98), (334, 176), (352, 246), (348, 310), (380, 320), (328, 320), (314, 248), (306, 310), (336, 320), (286, 320), (400, 118), (430, 100), (370, 128), (400, 112)),
    "",
    "kb",
    "front",
)
add(
    "single-leg-romanian-deadlift",
    "Single-leg Romanian deadlift",
    STAND,
    pose((470, 160), (424, 170), (334, 188), (358, 252), (350, 310), (382, 320), (330, 320), (250, 160), (160, 130), (132, 118), (148, 146), (400, 220), (392, 276), (360, 214), (340, 250)),
    "",
    "db",
    "front",
)
add(
    "reverse-lunge",
    "Reverse lunge",
    STAND,
    pose((318, 108), (320, 142), (300, 220), (392, 262), (400, 310), (432, 320), (380, 320), (230, 286), (176, 310), (206, 320), (154, 320), (352, 186), (346, 236), (276, 190), (268, 238)),
)
add(
    "single-leg-hip-thrust",
    "Single-leg hip thrust",
    pose((196, 150), (230, 168), (360, 230), (450, 188), (470, 308), (496, 318), (450, 318), (430, 150), (520, 120), (544, 112), (508, 132), (250, 150), (270, 120), (214, 186), (200, 210)),
    pose((188, 112), (214, 128), (360, 150), (470, 150), (490, 308), (516, 318), (470, 318), (450, 90), (540, 64), (564, 56), (528, 76), (236, 110), (250, 84), (196, 146), (180, 168)),
    "bench-long",
    "none",
    "none",
)
add(
    "push-up",
    "Push-up",
    pose((150, 176), (210, 196), (360, 214), (470, 228), (560, 242), (584, 250), (540, 250), (470, 242), (560, 256), (584, 262), (540, 262), (188, 250), (168, 308), (230, 246), (214, 300)),
    pose((156, 230), (214, 248), (360, 250), (470, 256), (560, 258), (584, 264), (540, 264), (470, 266), (560, 270), (584, 276), (540, 276), (196, 278), (168, 308), (236, 280), (214, 308)),
    "",
    "none",
    "none",
)
add(
    "suitcase-carry",
    "Suitcase carry",
    pose((336, 78), (338, 110), (334, 188), (390, 246), (410, 308), (440, 318), (390, 318), (280, 252), (250, 308), (280, 318), (230, 318), (372, 168), (368, 236), (306, 160), (298, 214)),
    pose((336, 70), (338, 102), (334, 180), (280, 242), (250, 308), (280, 318), (230, 318), (390, 246), (410, 308), (440, 318), (390, 318), (372, 160), (368, 230), (306, 152), (298, 206)),
    "",
    "db",
    "front",
)


def render() -> None:
    if ffmpeg_missing():
        raise SystemExit("ffmpeg is required to encode the placeholder clips")
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="form-ph-") as tmp:
        root = Path(tmp)
        for slug, label, start, end, prop, tool, hands in CLIPS:
            folder = root / slug
            folder.mkdir()
            for index in range(FRAMES):
                frame = mix(start, end, phase(index))
                (folder / f"f_{index:02d}.svg").write_text(svg(label, frame, prop, tool, hands), encoding="utf-8")
            dest = OUT / f"{slug}.webm"
            subprocess.check_call(
                [
                    "ffmpeg",
                    "-y",
                    "-framerate",
                    str(FPS),
                    "-i",
                    str(folder / "f_%02d.svg"),
                    "-an",
                    "-map_metadata",
                    "-1",
                    "-c:v",
                    "libvpx-vp9",
                    "-pix_fmt",
                    "yuv420p",
                    "-crf",
                    "36",
                    "-b:v",
                    "0",
                    "-row-mt",
                    "1",
                    "-cpu-used",
                    "4",
                    "-deadline",
                    "good",
                    str(dest),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print(f"{dest.name:48} {dest.stat().st_size:7d}")


def ffmpeg_missing() -> bool:
    return subprocess.call(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0


if __name__ == "__main__":
    render()
