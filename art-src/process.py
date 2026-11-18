#!/usr/bin/env python3
"""Turn Canva exports (character on white) into game sprites.

  python3 art-src/process.py mara-idle mara-walk ...   (names of PNGs in art-src/)

For each image: remove the white background connected to the border (soft edge),
crop to the character, scale to SPRITE_H tall (max), and write public/sprites/<name>.png.
Also updates public/sprites/manifest.json with size + anchor (feet position) per sprite.
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '..', 'public', 'sprites')
SPRITE_H = 440  # max output height in px (game draws them smaller; keeps detail on big screens)


def cut(path, holes=False):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    # background colour = median of the border pixels (white or the light grey of concept images)
    border_px = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bgc = np.median(border_px, axis=0)
    dist = np.abs(a - bgc).max(axis=2)
    mx, mn = a.max(axis=2), a.min(axis=2)
    whiteish = (dist < 26) | ((mn > 232) & ((mx - mn) < 20))
    lab, n = ndimage.label(whiteish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    if holes:
        # enclosed background pockets (e.g. between arms): large, very white components
        pure = (mn > 238) & ((mx - mn) < 14)
        lab3, n3 = ndimage.label(pure & ~bg)
        if n3:
            sizes = ndimage.sum(np.ones_like(lab3), lab3, range(1, n3 + 1))
            big = np.zeros(n3 + 1, bool); big[1:] = sizes > 1500
            bg |= ndimage.binary_dilation(big[lab3], iterations=2)
    # also drop tiny islands of non-bg noise
    fg = ~bg
    lab2, n2 = ndimage.label(fg)
    if n2 > 1:
        sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
        keep = np.zeros(n2 + 1, bool)
        keep[1:] = sizes > max(400, sizes.max() * 0.004)
        fg = keep[lab2]
    # soft edge: alpha from distance into the foreground + whiteness fade at the rim
    alpha = (fg * 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    rgba = im.convert('RGBA')
    rgba.putalpha(alpha_img)
    # de-fringe: darken near-white rim pixels slightly so they don't glow on the dark stage
    arr = np.asarray(rgba).copy()
    if not (bgc[1] > bgc[0] + 60 and bgc[1] > bgc[2] + 60):
        rim = (arr[..., 3] > 0) & (arr[..., 3] < 250)
        arr[rim, :3] = (arr[rim, :3].astype(np.float32) * 0.8).astype(np.uint8)
    # green-screen despill: pull green down to the red/blue level on greenish pixels
    if bgc[1] > bgc[0] + 60 and bgc[1] > bgc[2] + 60:
        rgb = arr[..., :3].astype(np.int16)
        lim = np.maximum(rgb[..., 0], rgb[..., 2])
        g = rgb[..., 1]
        spill = g > lim
        rgb[..., 1] = np.where(spill, lim, g)
        arr[..., :3] = rgb.clip(0, 255).astype(np.uint8)
        # soft alpha from green dominance near the edge (keeps the wolf's glow translucent)
        dom = (g - lim).clip(0, 255)
        arr[..., 3] = np.minimum(arr[..., 3], (255 - dom * 3).clip(0, 255)).astype(np.uint8)
    rgba = Image.fromarray(arr)
    bbox = rgba.getbbox()
    rgba = rgba.crop(bbox)
    return rgba


def anchor_x(img):
    """Horizontal anchor: halfway between the head (top 15%) and the feet (bottom 8%)."""
    a = np.asarray(img)[..., 3] > 128
    h, w = a.shape

    def med(band):
        ys, xs = np.nonzero(band)
        return float(np.median(xs)) / w if len(xs) else 0.5

    return (med(a[: max(4, int(h * 0.15))]) + med(a[int(h * 0.92):])) / 2


def main(names):
    os.makedirs(OUT, exist_ok=True)
    mpath = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for arg in names:
        name, _, flag = arg.partition(':')
        img = cut(os.path.join(ROOT, name + '.png'), holes=(flag == 'holes'))
        src_h = img.height
        s = min(1.0, SPRITE_H / img.height)
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
        img.save(os.path.join(OUT, name + '.png'), optimize=True)
        prev = manifest.get(name, {})
        manifest[name] = {
            'w': img.width, 'h': img.height, 'srcH': src_h,
            'ax': prev.get('axOverride', round(anchor_x(img), 3)),
            **({'axOverride': prev['axOverride']} if 'axOverride' in prev else {}),
        }
        print(f'{name}: {img.width}x{img.height} (src h {src_h}) ax={manifest[name]["ax"]}')
    json.dump(manifest, open(mpath, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main(sys.argv[1:])
