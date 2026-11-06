"""Split the taiyaki bag illustration into layers for the confirm page's bag animation (src/components/BagArt.tsx).

Usage: python3 tools/art/build_bag_layers.py [source.png] [out_dir] [--preview preview.png]

All coordinates are pixels in the 1312x1199 source. The component's SVG viewBox uses the same coordinates, so the
boxes printed at the end map directly to <image> positions. Layers are saved at half resolution.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PREVIEW = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
args = [a for a in sys.argv[1:] if not a.startswith('--') and a != PREVIEW]
SRC = args[0] if len(args) > 0 else 'docs/design/ref/bag-source.png'
OUT = args[1] if len(args) > 1 else 'public/art/bag'
SCALE = 0.5

RIM_X = (276, 1012)  # columns where the rolled rim's front edge hides what's inside the bag
SIDE_TOP = 395  # outside RIM_X the whole column is bag

# Back to front. Each outline is the whole fish, including the belly the rim hides; hidden parts get filled in.
# Edges facing empty space are loose (the source's alpha trims them); edges against another fish follow the crease.
FISH = [
    [(310, 410), (320, 330), (360, 230), (450, 170), (550, 150), (630, 165), (668, 200), (676, 245), (668, 300),
     (675, 380), (670, 430), (650, 480), (580, 520), (450, 550), (350, 510), (315, 460)],
    [(625, 342), (638, 305), (660, 265), (690, 210), (730, 160), (810, 105), (870, 90), (950, 95), (1020, 160),
     (1025, 240), (1005, 310), (1010, 390), (995, 440), (950, 480), (870, 520), (770, 520), (690, 490), (650, 430),
     (635, 380)],
    [(488, 490), (495, 470), (515, 430), (550, 385), (600, 368), (670, 360), (730, 370), (750, 335), (810, 320),
     (860, 340), (887, 380), (890, 420), (870, 455), (840, 480), (830, 510), (790, 560), (720, 595), (630, 600),
     (560, 585), (510, 550), (490, 520)],
]

INTERIOR_BACK = 365  # back rim's top at the middle of the opening (hidden behind the fish in the source)
INTERIOR_INSET = 26



def rounded(polygon, passes=3):
    """Chaikin corner cutting, so the filled-in bellies come out round instead of faceted."""
    points = polygon
    for _ in range(passes):
        nxt = []
        for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
            nxt += [(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by), (0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by)]
        points = nxt
    return points


def polygon_mask(size, polygon, feather=0.0):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(mask, dtype=np.float32) / 255


def rim_edge(pixels, alpha):
    """Per column, the y where the rim's front edge starts: the first long run of pale bag below the orange fish."""
    ratio = pixels[..., 2] / np.maximum(pixels[..., 0], 1)
    fishy = (ratio < 0.32) | (alpha < 0.8)
    width = pixels.shape[1]
    edge = np.full(width, SIDE_TOP, dtype=np.float32)
    for x in range(*RIM_X):
        run = 0
        for y in range(330, 640):
            run = run + 1 if not fishy[y, x] else 0
            if run >= 10:
                edge[x] = y - 9
                break
    # Dark creases in the fish make spikes: a wide median removes them, a box blur smooths the rest.
    inner = edge[RIM_X[0]:RIM_X[1]]
    k = 15
    padded = np.pad(inner, k, mode='edge')
    inner = np.array([np.median(padded[i:i + 2 * k + 1]) for i in range(len(inner))])
    inner = np.convolve(np.pad(inner, 4, mode='edge'), np.ones(9) / 9, mode='valid')
    edge[RIM_X[0]:RIM_X[1]] = inner
    return edge


def push_pull(rgb, known):
    """Fill unknown pixels with a smooth blend of known ones (coarse-to-fine pyramid average)."""
    if known.all() or not known.any():
        return rgb
    h, w = known.shape
    if min(h, w) <= 2:
        mean = (rgb * known[..., None]).sum((0, 1)) / max(known.sum(), 1)
        return np.where(known[..., None], rgb, mean)
    ph, pw = h + h % 2, w + w % 2
    weight = np.pad(known.astype(np.float32), ((0, ph - h), (0, pw - w)))
    color = np.pad(rgb * known[..., None], ((0, ph - h), (0, pw - w), (0, 0)))
    small_w = weight.reshape(ph // 2, 2, pw // 2, 2).sum((1, 3))
    small_c = color.reshape(ph // 2, 2, pw // 2, 2, 3).sum((1, 3))
    small_known = small_w > 0
    small = push_pull(small_c / np.maximum(small_w, 1e-6)[..., None], small_known)
    coarse = np.asarray(Image.fromarray(small.clip(0, 255).astype(np.uint8)).resize((pw, ph), Image.BILINEAR),
                        dtype=np.float32)[:h, :w]
    return np.where(known[..., None], rgb, coarse)


def save_layer(rgb, alpha, box, name):
    x0, y0, x1, y1 = box
    layer = np.dstack([rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    image = Image.fromarray(layer, 'RGBA')
    image = image.resize((round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)), Image.LANCZOS)
    image.save(f'{OUT}/{name}.webp', quality=88, method=6)
    print(f'{name}: x={x0} y={y0} width={x1 - x0} height={y1 - y0}')


def bbox(alpha, pad=4):
    ys, xs = np.where(alpha > 0.01)
    return (max(xs.min() - pad, 0), max(ys.min() - pad, 0), xs.max() + pad + 1, ys.max() + pad + 1)


def interior(size, edge):
    """The empty bag's opening: a back rim band, then the shaded inner wall down to the front rim."""
    width, height = size
    x = np.arange(width, dtype=np.float32)
    # Inset and dropped at the ends so the opening's corners tuck behind the rolled rim instead of poking out.
    left, right = RIM_X[0] + INTERIOR_INSET, RIM_X[1] - INTERIOR_INSET
    t = np.clip((x - left) / (right - left), 0, 1)
    corner = SIDE_TOP + 40
    back = corner - (corner - INTERIOR_BACK) * np.clip(np.sin(np.pi * t), 0, 1) ** 0.6
    y = np.arange(height, dtype=np.float32)[:, None]
    inside = (y >= back[None, :]) & (y < edge[None, :] + 6) & (x[None, :] > left) & (x[None, :] < right)
    depth = np.clip((y - back[None, :]) / np.maximum(edge[None, :] - back[None, :], 1), 0, 1)
    rim = np.array([247, 196, 128], dtype=np.float32)
    wall = np.array([196, 120, 56], dtype=np.float32)
    deep = np.array([112, 52, 12], dtype=np.float32)
    band = np.clip(depth / 0.12, 0, 1)[..., None]
    rgb = rim * (1 - band) + (wall * (1 - depth[..., None]) + deep * depth[..., None]) * band
    mask = Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    soft = Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    return np.asarray(soft, dtype=np.float32), np.asarray(mask, dtype=np.float32) / 255


def main():
    source = Image.open(SRC).convert('RGBA')
    size = source.size
    data = np.asarray(source, dtype=np.float32)
    pixels, alpha = data[..., :3], data[..., 3] / 255
    height, width = alpha.shape
    edge = rim_edge(pixels, alpha)
    rows = np.arange(height)[:, None]
    below = np.clip(rows - edge[None, :] + 1, 0, 1).astype(np.float32)  # 1 on and under the rim's front edge

    front_alpha = alpha * below
    save_layer(pixels, front_alpha, bbox(front_alpha), 'bag-front')

    back_rgb, back_alpha = interior(size, edge)
    save_layer(back_rgb, back_alpha, bbox(back_alpha), 'bag-inside')

    shapes = [polygon_mask(size, rounded(outline), feather=1.0) for outline in FISH]
    for i, shape in enumerate(shapes):
        covered = np.maximum.reduce([np.zeros_like(shape)] + shapes[i + 1:])
        seen = (shape > 0.5) & (covered < 0.2) & (below < 0.5) & (alpha > 0.9) & (pixels[..., 0] > 185) & (pixels[..., 2] < 0.36 * pixels[..., 0])  # not rim
        x0, y0, x1, y1 = bbox(shape, pad=6)
        filled = pixels.copy()
        filled[y0:y1, x0:x1] = push_pull(pixels[y0:y1, x0:x1], seen[y0:y1, x0:x1])
        save_layer(filled, shape * alpha, (x0, y0, x1, y1), f'fish-{i}')

    if PREVIEW:
        preview = Image.new('RGBA', size, (60, 110, 60, 255))
        preview.alpha_composite(source)
        draw = ImageDraw.Draw(preview)
        draw.line([(x, edge[x]) for x in range(width)], fill='red', width=3)
        for outline in FISH:
            draw.polygon(outline, outline='cyan', width=3)
        preview.save(PREVIEW)


if __name__ == '__main__':
    main()
