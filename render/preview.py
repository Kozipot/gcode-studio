"""Рендер геометрии из preview/geom.json в PNG для визуальной проверки."""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'preview', 'geom.json')
OUT = os.path.join(ROOT, 'preview')

with open(DATA, encoding='utf-8') as f:
    data = json.load(f)

BG = (12, 12, 14)
GRID = (30, 30, 36)
CUT = (255, 120, 60)
RAPID = (70, 70, 80)
BLANK = (90, 140, 200)
TEXT = (200, 200, 205)

W, H, PAD = 1500, 900, 60


def collect(fig):
    pts = []
    for line in fig.get('polylines', []):
        for p in line:
            pts.append(p)
    for r in fig.get('rapids', []):
        for p in r:
            pts.append(p)
    for d in fig.get('dots', []):
        pts.append(d)
    b = fig.get('bbox')
    if b:
        pts += [[b[0], b[1]], [b[2], b[3]]]
    return pts


def fit(pts, w, h, pad):
    if not pts:
        return lambda p: (pad, pad), 1.0
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    dx = max(maxx - minx, 1e-6)
    dy = max(maxy - miny, 1e-6)
    sc = min((w - 2 * pad) / dx, (h - 2 * pad) / dy)
    ox = (w - dx * sc) / 2 - minx * sc
    oy = (h - dy * sc) / 2 + maxy * sc

    def tf(p):
        return (p[0] * sc + ox, oy - p[1] * sc)
    return tf, sc


def render(fig, path, title, show_rapids=True, show_blank=True):
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    for x in range(PAD, W - PAD, 60):
        d.line([(x, PAD), (x, H - PAD)], fill=GRID)
    for y in range(PAD, H - PAD, 60):
        d.line([(PAD, y), (W - PAD, y)], fill=GRID)

    pts = collect(fig)
    tf, sc = fit(pts, W, H, PAD + 20)

    blank = fig.get('blank')
    if blank and blank.get('enabled') and show_blank:
        x1, y1 = tf([0, blank['h']])
        x2, y2 = tf([blank['w'], 0])
        d.rectangle([x1, y1, x2, y2], outline=BLANK, width=2)
        d.text((x1 + 6, y1 + 4), f"поле {blank['w']:g}x{blank['h']:g} мм", fill=BLANK)

    if show_rapids:
        for r in fig.get('rapids', []):
            d.line([tf(r[0]), tf(r[1])], fill=RAPID, width=1)

    for line in fig.get('polylines', []):
        if len(line) < 2:
            continue
        d.line([tf(p) for p in line], fill=CUT, width=2, joint='curve')

    for p in fig.get('dots', []):
        x, y = tf(p)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=CUT)

    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22)
        small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 16)
    except Exception:
        font = ImageFont.load_default()
        small = font
    d.text((PAD, 18), title, fill=TEXT, font=font)
    d.text((PAD, 46), f"масштаб 1:{1/sc:.1f}   линий: {len(fig.get('polylines', []))}", fill=(140, 140, 145), font=small)
    if fig.get('missing'):
        d.text((PAD, H - 40), 'нет глифов: ' + ' '.join(fig['missing']), fill=(255, 90, 90), font=small)
    img.save(path)
    return path


os.makedirs(OUT, exist_ok=True)
made = []
for fig in data['figures']:
    name = fig['name']
    title = {
        'glyphs-cyrillic': 'Кириллица: прописные, строчные (авто-верхний регистр), пунктуация',
        'glyphs-latin': 'Латиница, цифры, знаки',
    }.get(name, name)
    if name == 'glyphs-cyrillic':
        local = dict(fig)
        b = fig['bbox']
        local['bbox'] = [b[0], -1, b[2], 31]
        made.append(render(local, os.path.join(OUT, name + '.png'), title, show_rapids=False))
    else:
        made.append(render(fig, os.path.join(OUT, name + '.png'), title))

print('\n'.join(made))
