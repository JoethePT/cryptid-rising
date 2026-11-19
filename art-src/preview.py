"""Preview sprites at in-game size, feet on a baseline, anchor marked: python3 art-src/preview.py out.png name..."""
import json, re, sys
from PIL import Image, ImageDraw
man = json.load(open('public/sprites/manifest.json'))
src = open('src/gfx/Sprites.ts').read()
H = {k: float(v) for k, v in re.findall(r"'([a-z-]+)': \{ h: ([0-9.]+)", src)}
names = sys.argv[2:]
Z = 2  # preview zoom
ims = []
for n in names:
    im = Image.open(f'public/sprites/a3/{n}.png'); s = H[n] * Z / im.height
    ims.append((n, im.resize((max(1, int(im.width * s)), int(im.height * s)), Image.LANCZOS), man[n]['ax']))
W = sum(i.width for _, i, _ in ims) + 60 * len(ims) + 40
base = max(i.height for _, i, _ in ims) + 40
sheet = Image.new('RGBA', (W, base + 30), (18, 36, 46, 255)); d = ImageDraw.Draw(sheet)
d.line([(0, base), (W, base)], fill=(90, 140, 80), width=3)
x = 40
for n, im, ax in ims:
    sheet.alpha_composite(im, (x, base - im.height))
    axp = x + int(ax * im.width); d.line([(axp, base - 10), (axp, base + 10)], fill=(255, 80, 80), width=3)
    d.text((x, base + 12), n, fill=(255, 255, 255)); x += im.width + 60
sheet.save(sys.argv[1])
