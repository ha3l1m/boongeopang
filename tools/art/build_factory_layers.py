"""Split the factory illustration into layers for the animated splash (src/pages/FactoryScene.tsx).

Usage: python3 tools/art/build_factory_layers.py [source.png] [out_dir]

All coordinates are pixels in the 1445x1089 source. The scene's SVG viewBox uses the same coordinates, so the
crop boxes printed at the end map directly to <image> positions.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/design/ref/factory-source.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/art/factory'

CROP = (150, 0, 1220, 1040)  # top 0: the v2 roof fish reaches y=29
FADE = {'left': 65, 'right': 65, 'top': 25, 'bottom': 40}

PRESS_HEAD = [(748, 595), (748, 620), (757, 623), (800, 630), (817, 630), (817, 661), (803, 663), (797, 669), (780, 676),
              (778, 681), (779, 691), (784, 692), (785, 703), (806, 703), (806, 693), (825, 693), (868, 691), (877, 692),
              (892, 691), (893, 688), (888, 676), (873, 663), (854, 661), (854, 629), (920, 625), (921, 600), (917, 590),
              (900, 560), (880, 552), (783, 552), (760, 570), (752, 593)]
PLATE_FISH = [[(702, 718), (743, 702), (783, 713), (800, 732), (737, 735)],
              [(813, 707), (847, 690), (890, 700), (905, 698), (909, 727), (860, 732), (827, 723)]]
PLATE_TOP = 704  # glow wall above, plate below; the two are filled separately so the wall does not bleed into the plate

BELT = [(742, 760), (964, 757), (1075, 858), (858, 872)]  # TL, TR, BR, BL
BELT_FISH_BOX = (815, 750, 1050, 845)
FISH_TOP_OVER_PLATE = (835, 750, 905, 762)  # the first fish's back pokes just above the belt's top edge
TAIL_OVER_RAIL = (1012, 788, 1048, 830)  # the second fish's tail tip overlaps the right rail
RAIL_STEP = (-36, -30)  # one step along that rail, where it is unobstructed

FISH_BOX = (815, 750, 930, 835)
TRAY_FRONT = [(533, 868), (551, 872), (600, 887), (668, 886), (790, 879), (800, 878), (806, 881), (806, 925), (600, 937),
              (533, 914)]


def polygon_mask(size, polygon, grow=0, feather=0.0):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    if grow:
        mask = mask.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(mask, dtype=np.float32) / 255


def fill_smooth(pixels, hole, barrier, iterations=2500):
    """Harmonic fill of `hole`: each pixel becomes the mean of its neighbours, ignoring pixels in `barrier`."""
    ys, xs = np.where(hole)
    y0, y1, x0, x1 = ys.min() - 1, ys.max() + 2, xs.min() - 1, xs.max() + 2
    part, inner, block = pixels[y0:y1, x0:x1].copy(), hole[y0:y1, x0:x1], barrier[y0:y1, x0:x1]
    weight = (~block).astype(np.float32)
    for _ in range(iterations):
        total = np.zeros_like(part)
        count = np.zeros(part.shape[:2], dtype=np.float32)
        for axis, step in ((0, 1), (0, -1), (1, 1), (1, -1)):
            total += np.roll(part * weight[..., None], step, axis)
            count += np.roll(weight, step, axis)
        part[inner] = (total[inner] / np.maximum(count[inner], 1)[..., None])
    result = pixels.copy()
    result[y0:y1, x0:x1] = part
    return result


def homography(quad):
    """Maps the unit square (u, v) to the quad's corners."""
    corners = [(0, 0), (1, 0), (1, 1), (0, 1)]
    rows, values = [], []
    for (u, v), (x, y) in zip(corners, quad):
        rows += [[u, v, 1, 0, 0, 0, -u * x, -v * x], [0, 0, 0, u, v, 1, -u * y, -v * y]]
        values += [x, y]
    return np.append(np.linalg.solve(np.array(rows, float), np.array(values, float)), 1).reshape(3, 3)


def box_smooth(values, radius):
    kernel = np.ones(radius * 2 + 1) / (radius * 2 + 1)
    padded = np.pad(values, ((radius, radius), (0, 0)), mode='edge')
    return np.stack([np.convolve(padded[:, c], kernel, mode='valid') for c in range(values.shape[1])], axis=1)


def profile_at(profile, position):
    """Linearly samples an (n, 3) profile at positions in 0..1."""
    grid = (np.arange(len(profile)) + 0.5) / len(profile)
    return np.dstack([np.interp(position, grid, profile[:, c]) for c in range(3)])


def median_by_bin(values, inside, bin_index, bins):
    """Median per bin; a bin with no usable pixels (under a rail, say) borrows from the nearest one that has some."""
    filled = {i: np.median(values[inside & (bin_index == i)], axis=0) for i in range(bins) if (inside & (bin_index == i)).any()}
    return np.stack([filled[min(filled, key=lambda f: abs(f - i))] for i in range(bins)])


def empty_belt(pixels, fish):
    """Belt with fish and slat grooves wiped, keeping its light falloff; the grooves are redrawn and animated in SVG."""
    height, width = pixels.shape[:2]
    inverse = np.linalg.inv(homography(BELT))
    ys, xs = np.mgrid[0:height, 0:width]
    w = inverse[2, 0] * xs + inverse[2, 1] * ys + inverse[2, 2]
    u = (inverse[0, 0] * xs + inverse[0, 1] * ys + inverse[0, 2]) / w
    v = (inverse[1, 0] * xs + inverse[1, 1] * ys + inverse[1, 2]) / w

    v_bins, u_bins = 56, 90
    inside = (u > 0.03) & (u < 0.97) & (v >= 0) & (v < 1) & ~fish
    v_bin, u_bin = np.clip((v * v_bins).astype(int), 0, v_bins - 1), np.clip((u * u_bins).astype(int), 0, u_bins - 1)
    v_profile = box_smooth(median_by_bin(pixels, inside, v_bin, v_bins), 6)
    ratio = pixels / np.maximum(profile_at(v_profile, v), 1)
    u_profile = box_smooth(median_by_bin(ratio, inside, u_bin, u_bins), 5)
    return profile_at(v_profile, v) * profile_at(u_profile, u)


def fish_matte(pixels):
    """Fish alpha: saturated orange separates it from the brown belt; enclosed creases and the eye are filled solid."""
    x0, y0, x1, y1 = FISH_BOX
    part = pixels[y0:y1, x0:x1]
    solid = Image.fromarray(((part[..., 1] - part[..., 2]) >= 64).astype(np.uint8) * 255)
    closed = solid.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    canvas = ImageOps.expand(closed, 1, 0)
    ImageDraw.floodfill(canvas, (0, 0), 128)  # background reached from outside; anything else enclosed becomes fish
    body = Image.fromarray((np.asarray(canvas)[1:-1, 1:-1] != 128).astype(np.uint8) * 255).copy()
    ImageDraw.floodfill(body, (body.width // 2, body.height // 2), 200)  # stray belt specks are not connected to the body
    silhouette = (np.asarray(body) == 200).astype(np.uint8) * 255
    matte = Image.fromarray(silhouette).filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.MinFilter(3))
    alpha = np.zeros(pixels.shape[:2], dtype=np.float32)
    alpha[y0:y1, x0:x1] = np.asarray(matte.filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) / 255
    return alpha


def save_backdrop(plate):
    """Three-times-larger backdrop made only from the image's rim, so the page continues the illustration's background."""
    x0, y0, x1, y1 = CROP
    crop = plate[y0:y1, x0:x1]
    t = np.linspace(0, 1, y1 - y0)[:, None, None]
    fill = crop[1:2] * (1 - t) + crop[-2:-1] * t
    edge = 12
    fill[:, :edge] = crop[:, :edge]
    fill[:, -edge:] = crop[:, -edge:]
    pad_y, pad_x = y1 - y0, x1 - x0
    full = np.pad(fill, ((pad_y, pad_y), (pad_x, pad_x), (0, 0)), mode='edge')
    image = Image.fromarray(full.clip(0, 255).astype(np.uint8)).resize((full.shape[1] // 4, full.shape[0] // 4), Image.BOX)
    image.filter(ImageFilter.GaussianBlur(26)).save(f'{OUT}/backdrop.webp', quality=88, method=6)
    print(f'backdrop: x={x0 - pad_x} y={y0 - pad_y} width={full.shape[1]} height={full.shape[0]}')


def save_cutout(rgb, alpha, box, name, quality=90):
    x0, y0, x1, y1 = box
    layer = np.dstack([rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(layer, 'RGBA').save(f'{OUT}/{name}.webp', quality=quality, method=6)
    print(f'{name}: x={x0} y={y0} width={x1 - x0} height={y1 - y0}')


def edge_fade(height, width):
    x = np.arange(width)[None, :]
    y = np.arange(height)[:, None]
    left = np.clip((x - CROP[0]) / FADE['left'], 0, 1)
    right = np.clip((CROP[2] - x) / FADE['right'], 0, 1)
    top = np.clip((y - CROP[1]) / FADE['top'], 0, 1)
    bottom = np.clip((CROP[3] - y) / FADE['bottom'], 0, 1)
    return (left * right) * (top * bottom)


def main():
    source = Image.open(SRC).convert('RGB')
    size = source.size
    pixels = np.asarray(source, dtype=np.float32)
    height, width = pixels.shape[:2]
    warmth = pixels[..., 0] - pixels[..., 2]

    # Cut-outs come from the untouched source.
    save_cutout(pixels, fish_matte(pixels), FISH_BOX, 'fish')
    save_cutout(pixels, polygon_mask(size, PRESS_HEAD, feather=0.7), (740, 545, 930, 710), 'press')
    save_cutout(pixels, polygon_mask(size, TRAY_FRONT, feather=0.6), (525, 860, 815, 945), 'tray-front')

    # Clean plate: empty the arch and the belt.
    press_hole = polygon_mask(size, PRESS_HEAD, grow=4) > 0.5
    fish_hole = np.zeros((height, width), dtype=bool)
    for polygon in PLATE_FISH:
        fish_hole |= polygon_mask(size, polygon, grow=5) > 0.5
    hole = press_hole | fish_hole
    rows = np.arange(height)[:, None] < PLATE_TOP
    plate = fill_smooth(pixels, hole & rows, hole & ~rows)
    plate = fill_smooth(plate, hole & ~rows, hole & rows)

    x0, y0, x1, y1 = BELT_FISH_BOX
    belt_fish = np.zeros((height, width), dtype=bool)
    belt_fish[y0:y1, x0:x1] = (pixels[y0:y1, x0:x1, 1] - pixels[y0:y1, x0:x1, 2]) >= 64
    grown = Image.fromarray((belt_fish * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))
    belt_fish_grown = np.asarray(grown) > 127

    quad = polygon_mask(size, BELT, feather=1.2)[..., None]
    x0, y0, x1, y1 = FISH_TOP_OVER_PLATE
    fish_top = np.zeros((height, width), dtype=bool)
    fish_top[y0:y1, x0:x1] = polygon_mask(size, BELT)[y0:y1, x0:x1] < 0.5
    plate = fill_smooth(plate, fish_top, np.zeros((height, width), dtype=bool), iterations=400)
    x0, y0, x1, y1 = TAIL_OVER_RAIL
    tail = np.zeros((height, width), dtype=np.uint8)
    tail[y0:y1, x0:x1] = ((pixels[y0:y1, x0:x1, 1] - pixels[y0:y1, x0:x1, 2]) >= 85) * 255
    tail_mask = Image.fromarray(tail).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    tail_alpha = (np.asarray(tail_mask, dtype=np.float32) / 255)[..., None]
    plate = plate * (1 - tail_alpha) + np.roll(plate, (-RAIL_STEP[1], -RAIL_STEP[0]), (0, 1)) * tail_alpha

    # Only blend under the belt: far from it the homography is undefined and would spread NaN through the image.
    plate = np.where(quad > 0, plate * (1 - quad) + empty_belt(pixels, belt_fish_grown) * quad, plate)

    save_cutout(plate, edge_fade(height, width), CROP, 'plate', quality=86)
    save_backdrop(plate)


if __name__ == '__main__':
    main()
