"""Split the grandpa illustration into layers for the stomping splash (src/pages/GrandpaScene.tsx).

Usage: python3 tools/art/build_grandpa_layers.py [source.png] [out_dir]

Coordinates are pixels in the 1199x1312 source, which the scene's SVG viewBox reuses.
- shadow: the floor shadow alone, as a transparent layer, so the page's own (adjustable) colour shows around it.
- body: the character above the shoes, cut from the backdrop, so it can lean without dragging the shadow along.
- shoe-l / shoe-r: the shoes, extended a little upward so they stay tucked under the trouser hems.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

SRC = sys.argv[1] if len(sys.argv) > 1 else 'public/art/login-grandpa.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/art/grandpa'

SHOES = {'shoe-l': ((340, 1120, 560, 1232), (450, 1190)), 'shoe-r': ((600, 1116, 822, 1228), (712, 1185))}
SHOE_TUCK = 8  # rows a shoe extends up behind its trouser hem
MARGIN = 70  # columns at each side that are pure backdrop, used to estimate it per row
FLOOR_Y = 1150  # below this only shoes and floor remain; trousers are kept by colour
SIDE_GAP = 4  # pixels beside the character to sample the backdrop from
SHADOW = (92, 52, 24)  # colour of the floor shadow
SHADOW_FROM_Y = 1080  # the shadow lives on the floor; above it the backdrop is left to the page


def shoe_mask(pixels, box, seed):
    """Shoe = dark brown region connected to its centre; trousers (blue) and the light floor stop the fill."""
    x0, y0, x1, y1 = box
    part = pixels[y0:y1, x0:x1]
    luminance = part @ np.array([0.299, 0.587, 0.114])
    brown = (luminance < 145) & (part[..., 0] > part[..., 2] + 25)  # lit shoe rims reach ~140; floor shadow ~150+
    region = Image.fromarray(brown.astype(np.uint8) * 255).filter(ImageFilter.MedianFilter(5))
    ImageDraw.floodfill(region, (seed[0] - x0, seed[1] - y0), 128)
    connected = (np.asarray(region) == 128).astype(np.uint8) * 255
    closed = Image.fromarray(connected).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    # Closing can bridge onto the floor shadow at the sole's corners; trim back to dark pixels, then refill the
    # light scratches inside the shoe, which are enclosed.
    trimmed = (np.asarray(closed) > 127) & (luminance < 150)
    canvas = ImageOps.expand(Image.fromarray(trimmed.astype(np.uint8) * 255), 1, 0)
    ImageDraw.floodfill(canvas, (0, 0), 128)
    shoe = np.asarray(canvas)[1:-1, 1:-1] != 128
    # The sides are near vertical, so nothing should reach wider than the shoe does at mid-height; that cuts the
    # floor shadow that hugs the sole's bottom corners.
    rows = np.where(shoe.any(axis=1))[0]
    middle = shoe[(rows.min() + rows.max()) // 2]
    columns = np.where(middle)[0]
    shoe[:, :max(columns.min() - 2, 0)] = False
    shoe[:, columns.max() + 3:] = False
    mask = np.zeros(pixels.shape[:2], dtype=bool)
    mask[y0:y1, x0:x1] = shoe
    return mask


def character_mask(pixels, shoes):
    """Everything that differs from the per-row backdrop estimate, minus the floor shadow and the shoes."""
    width = pixels.shape[1]
    left = np.median(pixels[:, :MARGIN], axis=1)
    right = np.median(pixels[:, -MARGIN:], axis=1)
    t = np.linspace(0, 1, width)[None, :, None]
    estimate = left[:, None] * (1 - t) + right[:, None] * t
    differs = np.linalg.norm(pixels - estimate, axis=2) > 24
    trousers = pixels[..., 2] > pixels[..., 0] + 10
    differs[FLOOR_Y:] = trousers[FLOOR_Y:]
    differs &= ~shoes
    region = Image.fromarray(differs.astype(np.uint8) * 255).filter(ImageFilter.MedianFilter(5))
    canvas = ImageOps.expand(region, 1, 0)
    ImageDraw.floodfill(canvas, (0, 0), 128)  # anything not reachable from outside is inside the character
    solid = Image.fromarray((np.asarray(canvas)[1:-1, 1:-1] != 128).astype(np.uint8) * 255)
    # Pull the edge in a little: the outermost pixels are mixed with the original yellow and would show as a
    # halo on any other page colour.
    return np.asarray(solid.filter(ImageFilter.MinFilter(3))) > 127


def fill_rows(pixels, hole):
    """Each run of `hole` in a row is blended between the pixels just left and right of it."""
    filled = pixels.copy()
    width = pixels.shape[1]
    for y in np.where(hole.any(axis=1))[0]:
        row = np.concatenate([[False], hole[y], [False]]).astype(np.int8)
        starts, ends = np.where(np.diff(row) == 1)[0], np.where(np.diff(row) == -1)[0]
        for start, end in zip(starts, ends):
            left, right = pixels[y, max(start - SIDE_GAP, 0)], pixels[y, min(end + SIDE_GAP, width - 1)]
            t = np.linspace(0, 1, end - start)[:, None]
            filled[y, start:end] = left * (1 - t) + right * t
    blurred = np.asarray(Image.fromarray(filled.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)),
                         dtype=np.float32)
    return np.where(hole[..., None], blurred, filled)


def soften(mask, radius=0.8):
    image = Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(image, dtype=np.float32) / 255


def save_shadow(backdrop):
    """Floor shadow as dark brown with alpha, so `lit floor * (1 - a) + SHADOW * a` reproduces the backdrop."""
    width = backdrop.shape[1]
    luminance = backdrop @ np.array([0.299, 0.587, 0.114])
    left = np.median(luminance[:, :MARGIN], axis=1)
    right = np.median(luminance[:, -MARGIN:], axis=1)
    lit = left[:, None] + (right - left)[:, None] * np.linspace(0, 1, width)[None, :]
    shade = float(np.dot(SHADOW, [0.299, 0.587, 0.114]))
    alpha = np.clip((lit - luminance) / (lit - shade), 0, 1)
    alpha[:SHADOW_FROM_Y] = 0
    alpha[alpha < 0.02] = 0
    rgb = np.broadcast_to(np.array(SHADOW, dtype=np.float32), backdrop.shape)
    rows = np.where(alpha.any(axis=1))[0]
    save(rgb, alpha, (0, rows.min(), width, rows.max() + 1), 'shadow')


def save(rgb, alpha, box, name, quality=88):
    x0, y0, x1, y1 = box
    layer = np.dstack([rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(layer, 'RGBA').save(f'{OUT}/{name}.webp', quality=quality, method=6)
    print(f'{name}: x={x0} y={y0} width={x1 - x0} height={y1 - y0}')


def main():
    os.makedirs(OUT, exist_ok=True)
    pixels = np.asarray(Image.open(SRC).convert('RGB'), dtype=np.float32)
    height, width = pixels.shape[:2]

    shoes = np.zeros((height, width), dtype=bool)
    for name, (box, seed) in SHOES.items():
        mask = shoe_mask(pixels, box, seed)
        shoes |= mask
        tucked = mask.copy()
        for step in range(1, SHOE_TUCK + 1):
            tucked |= np.roll(mask, -step, axis=0)
        x0, y0, x1, y1 = box
        save(pixels, soften(tucked), (x0, y0 - SHOE_TUCK, x1, y1), name)

    body = character_mask(pixels, shoes)
    save(pixels, soften(body), (0, 0, width, height), 'body', quality=84)

    grown = np.asarray(Image.fromarray((body | shoes).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 127
    save_shadow(fill_rows(pixels, grown))


if __name__ == '__main__':
    main()
