"""Cut the empty paper bag into layers so taiyaki can drop into it (src/components/BagStage.tsx).

Usage: python3 tools/art/build_empty_bag_layers.py [source.png] [out_dir]

Outputs, in the 1312x1199 source's pixel coordinates (printed at the end):
  empty.webp       the whole bag; also the empty state on its own, and the back layer behind the fish
  empty-front.webp the front lip and body, drawn over the fish so they look like they sit inside
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/design/ref/bag-empty-source.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/art/bag'
SCALE = 0.5
BOX = (235, 337, 1049, 1091)  # the bag plus a little margin
OPENING_X = (325, 965)  # columns where the opening's front lip is visible; outside them the rim's sides are in front
LIP_SCAN = (400, 540)


def lip_edge(source):
    """Per column, the y of the front lip's top: the strongest dark-to-light step going down through the opening."""
    luma = np.asarray(source.convert('L').filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
    width = luma.shape[1]
    edge = np.zeros(width, dtype=np.float32)
    for x in range(*OPENING_X):
        column = luma[LIP_SCAN[0]:LIP_SCAN[1], x]
        step = column[6:] - column[:-6]
        edge[x] = LIP_SCAN[0] + int(np.argmax(step)) + 3
    inner = edge[OPENING_X[0]:OPENING_X[1]]
    edge[OPENING_X[0]:OPENING_X[1]] = np.convolve(np.pad(inner, 6, mode='edge'), np.ones(13) / 13, mode='valid')
    return edge


def save(image, name):
    x0, y0, x1, y1 = BOX
    crop = image.crop(BOX)
    crop.resize((round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)), Image.LANCZOS).save(
        f'{OUT}/{name}.webp', quality=88, method=6)
    print(f'{name}: x={x0} y={y0} width={x1 - x0} height={y1 - y0}')


def main():
    source = Image.open(SRC).convert('RGBA')
    data = np.asarray(source, dtype=np.float32)
    alpha = np.where(data[..., 3] < 12, 0, data[..., 3])  # drop the faint haze around the bag
    clean = Image.fromarray(np.dstack([data[..., :3], alpha]).astype(np.uint8), 'RGBA')
    save(clean, 'empty')

    edge = lip_edge(source)
    rows = np.arange(alpha.shape[0], dtype=np.float32)[:, None]
    front = np.clip(rows - edge[None, :] + 1, 0, 1)  # 1 on and below the lip, soft by one pixel
    front_alpha = alpha * front
    save(Image.fromarray(np.dstack([data[..., :3], front_alpha]).astype(np.uint8), 'RGBA'), 'empty-front')


if __name__ == '__main__':
    main()
