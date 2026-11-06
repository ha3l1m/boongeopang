"""Turn the robot-kitchen illustrations into frames and patches for the order-status scene (src/components/BongbotScene.tsx).

Usage: python3 tools/art/build_bongbot_layers.py [ref_dir] [out_dir]

Sources (1536x1024, same camera) live in docs/design/ref/bongbot: received/batter/filling were supplied, the rest were made
with codex image generation by editing received.png (gen/). Coordinates are source pixels; the SVG viewBox reuses them.
- <step>.webp: one full frame per step.
- batter-empty.webp: the batter frame's cavities with the batter painted out, so batter can spread in under a growing mask.
- filling-clean.webp / beans-<n>.webp: the filling frame with the bean column and mounds painted out (batter only),
  each mound on its own, and the bean column joining the left mound to the nozzle (beans-column.webp), so the beans
  appear with the pour. The scene also draws single falling beans.
- bake-<open|closing|closed>.webp: three panels of the embossed baking storyboard (bake-storyboard-embossed.png,
  arrows removed in gen/bake-embossed-clean.png), and bake-baked.webp: the opened mold (bake-open-lid.png), shown one
  after another by the baking step.
- spin-<n>.webp: the closed mold at 0/45/90/135 degrees of its turn (gen/spin-*.png, codex edits of the baking frame),
  cropped with soft edges and played as a flipbook. The plates look alike, so 180+x looks like x and 4 frames loop.
- packed.webp: the close-up packing shot (packed-closeup.png, supplied) with its fish removed (gen/packed-closeup-empty.png,
  a codex edit) and its white motion lines painted out, so the scene can drop the app's own fish (public/art/fish.webp) in.
  packed-front.webp is the pouch below its front lip and packed-fingers.webp the gripper pads: both are drawn over the fish.
- received.png / batter.png were supplied with the fish engraved into the open lid (the plain-lid originals are kept as
  *-plain-lid.png). filling.webp gets the same engraving: the relief (detail above a blur) of received.png's lid, same
  camera, added only where the frame shows bare lid, so the arm and bottle stay in front.
- ready.webp has its kraft bag painted out: the scene draws the clay pouch (public/art/bag/empty*.webp) over it instead.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from build_factory_layers import fill_smooth  # noqa: E402

REF = sys.argv[1] if len(sys.argv) > 1 else 'docs/design/ref/bongbot'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/art/bongbot'

FRAMES = {
    'received': 'received.png',
    'batter': 'batter.png',
    'filling': 'filling.png',
    'baking': 'gen/baking.png',
    'baked': 'gen/baked.png',
    'packed': 'gen/packed-closeup-empty.png',
    'ready': 'gen/ready.png',
}

BATTER_BOX = (740, 630, 1330, 760)
# The falling stream is batter-coloured too; keep it so only the puddles get painted out.
BATTER_STREAM = (830, 600, 862, 688)
# Where batter lands in each cavity: flood seeds, so the peach wall (also batter-coloured) is never picked up.
BATTER_SEEDS = [(880, 712), (1160, 708)]
# Bean piles as ellipses (cx, cy, rx, ry), and the boxes their patches are saved in.
BEAN_PILES = [(872, 704, 82, 38), (1148, 711, 70, 33)]
BEAN_BOXES = [(776, 650, 968, 756), (1062, 662, 1234, 756)]
FILL_BOX = (760, 600, 1250, 770)
# Whole-bean anko (codex edit of filling.png, pixel-aligned with it). Only the mold area is taken from it: the edit
# also redrew the bottle caddy on the left, which other frames show unchanged.
FILLING_BEADS = 'gen/filling-beads.png'
BEADS_BOX = (735, 590, 1350, 805)
BEADS_FEATHER = 24
STREAM_BOX = (815, 600, 875, 700)
# The nozzle's bottom rim, left to right: everything above this line is nozzle and is never painted out. The scene
# clips its falling beans to below the same line so they come out of the opening (keep in sync with BongbotScene).
NOZZLE_RIM = ((812, 634), (850, 619))
MOUND_NECK = 15
# The column's lowest bean, resting on the left mound's top (cx, cy, rx, ry): it belongs to the column.
COLUMN_BEAN = (848, 667, 16, 17)
STREAM_SEED = (845, 645)
# Columns where the stream crosses the left cavity's rim, and the rows to search for the batter's top edge.
RIM_SPAN = (800, 900, 640, 700)
# Baking storyboard with the raised fish on the lid and the glowing round pan (supplied 2x2, arrows removed with
# codex): the first three panels between the white gutters. The opened shot is its own image, with the whole lid in frame.
BAKE_STORYBOARD = 'gen/bake-embossed-clean.png'
BAKE_PANELS = {
    'open': (0, 0, 762, 502),
    'closing': (774, 0, 1536, 502),
    'closed': (0, 513, 762, 1015),
}
BAKE_OPENED = 'bake-open-lid.png'
BAKE_SIZE = 1024
BAKE_SEAM = 28
# The first shot comes from this storyboard instead: its open lid shows the engraved (sunken) fish and the pan already
# glows. Same 2x2 layout, and that panel has no arrows, so it is used as supplied.
BAKE_OPEN_SOURCE = ('bake-storyboard-engraved.png', (0, 0, 762, 502))
SPIN_FRAMES = ['gen/baking.png', 'gen/spin-45.png', 'gen/spin-90.png', 'gen/spin-135.png']
# Wide enough to take in the whole right stand, so the soft edge falls on plain wall where every frame agrees.
SPIN_BOX = (760, 410, 1420, 905)
SPIN_FEATHER = 28
# The 90-degree edit drew its right stand 21px left of everyone else's. Between the upright mold's edge and the real stand
# (x 1337+), its gap is repainted row by row from wall to wall (keeping the axle rod), and the stand itself comes from the
# 0-degree frame, so the stand never jumps or doubles during the spin.
SPIN90_GAP = (1305, 1336)
# Engraving for the filling frame: its box in received.png (same camera, so no scaling or offset).
ENGRAVING_SOURCE = 'received.png'
ENGRAVING_BOX = (815, 355, 1240, 515)
ENGRAVING_CENTRE = (1028, 435)
ENGRAVING_TARGET = (1028, 435)
ENGRAVING_SCALE = 1.0
ENGRAVING_BLUR = 10
ENGRAVING_FEATHER = 24
LID_BOX = (795, 288, 1262, 605)
LID_TOLERANCE = 38
ENGRAVED = ('filling',)
# The `ready` frame's kraft bag: its arm pose matches `received`, so anything that differs is taken from it.
READY_DIFF = 40
# Close-up packing shot: the pouch opening's columns and where to look for its front lip (a dark-to-light step going down),
# and the gripper pads the held fish sits behind.
POUCH_OPENING_X = (520, 1040)
POUCH_LIP_SCAN = (480, 700)
POUCH_BOX = (380, 460, 1160, 1024)
# The white motion lines left of the gripper, painted out of the packed frame.
MOTION_LINES_BOX = (395, 395, 530, 530)
GRIPPER_PADS = [
    [(568, 322), (640, 296), (662, 300), (692, 440), (682, 458), (620, 468), (604, 460)],
    [(842, 222), (910, 176), (930, 180), (992, 292), (988, 312), (930, 348), (912, 342)],
]


def load(name):
    return np.asarray(Image.open(os.path.join(REF, name)).convert('RGB')).astype(np.float32)


def filling_frame():
    """The filling frame with its mold area (soft-edged) swapped for the whole-bean version."""
    base, beads = load(FRAMES['filling']), load(FILLING_BEADS)
    x0, y0, x1, y1 = BEADS_BOX
    ys, xs = np.mgrid[:y1 - y0, :x1 - x0]
    edge = np.minimum.reduce([xs, ys, x1 - x0 - 1 - xs, y1 - y0 - 1 - ys]).astype(np.float32)
    weight = np.zeros(base.shape[:2], dtype=np.float32)
    weight[y0:y1, x0:x1] = np.clip(edge / BEADS_FEATHER, 0, 1)
    return base * (1 - weight[..., None]) + beads * weight[..., None]


def in_box(shape, box):
    x0, y0, x1, y1 = box
    mask = np.zeros(shape[:2], dtype=bool)
    mask[y0:y1, x0:x1] = True
    return mask


def flood(mask, seeds):
    """The parts of `mask` connected to any seed. Seeds outside `mask` are skipped (filling from them would select
    the opposite region)."""
    # copy(): an image wrapping a numpy buffer ignores in-place drawing.
    image = Image.fromarray(mask.astype(np.uint8) * 255).copy()
    for x, y in seeds:
        if mask[y, x]:
            ImageDraw.floodfill(image, (x, y), 128)
    return np.asarray(image) == 128


def ellipse_mask(shape, cx, cy, rx, ry):
    ys, xs = np.mgrid[:shape[0], :shape[1]]
    return ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2 <= 1


def onion_fill(pixels, hole, barrier):
    """Fills `hole` from its edge inward (each ring takes the mean of its known neighbours), then smooths it, so
    big holes end up the colour of what surrounds them instead of a muddy mix of what was there."""
    result = pixels.copy()
    known = ~hole & ~barrier
    todo = hole.copy()
    while todo.any():
        total = np.zeros_like(result)
        count = np.zeros(hole.shape, dtype=np.float32)
        for axis, step in ((0, 1), (0, -1), (1, 1), (1, -1)):
            total += np.roll(result * known[..., None], step, axis)
            count += np.roll(known.astype(np.float32), step, axis)
        ring = todo & (count > 0)
        if not ring.any():
            break
        result[ring] = total[ring] / count[ring][..., None]
        known |= ring
        todo &= ~ring
    return fill_smooth(result, hole, barrier, iterations=300)


def soft_alpha(mask, grow=3, feather=1.5):
    image = Image.fromarray(mask.astype(np.uint8) * 255)
    image = image.filter(ImageFilter.MaxFilter(grow * 2 + 1)).filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(image, dtype=np.float32) / 255


def save_patch(pixels, alpha, box, name):
    """Saves the box of `pixels` with `alpha` as a transparent webp and prints where it goes in the SVG."""
    x0, y0, x1, y1 = box
    rgba = np.dstack([pixels[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, f'{name}.webp'), quality=90)
    print(f'{name}: x={x0} y={y0} width={x1 - x0} height={y1 - y0}')


def batter_empty():
    pixels = load(FRAMES['batter'])
    r, g, b = pixels[..., 0], pixels[..., 1], pixels[..., 2]
    batter = (r > 200) & (g > 175) & (b > 95) & (r - b > 40) & in_box(pixels.shape, BATTER_BOX)
    batter = flood(batter & ~in_box(pixels.shape, BATTER_STREAM), BATTER_SEEDS)
    hole = soft_alpha(batter, grow=4, feather=0) > 0.5
    filled = onion_fill(pixels, hole, in_box(pixels.shape, BATTER_STREAM))
    save_patch(filled, soft_alpha(batter, grow=4) * ~in_box(pixels.shape, BATTER_STREAM), BATTER_BOX, 'batter-empty')


def beans_empty():
    """Clean base for the filling step (batter only, no paste stream, no piles), plus the stream and each pile as
    their own layers. Paste is told from the brown mold by colour: it is redder (green under half of red)."""
    pixels = filling_frame()
    r, g, b = pixels[..., 0], pixels[..., 1], pixels[..., 2]
    area = in_box(pixels.shape, FILL_BOX)
    # Beans stay redder than the mold even in shadow; the closing takes in their pale highlights.
    paste = (r > 44) & (g < 0.48 * r) & area
    closed = Image.fromarray(paste.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    paste = flood((np.asarray(closed) > 127) & area, [(cx, cy + 10) for cx, cy, _, _ in BEAN_PILES] + [STREAM_SEED])
    (rx0, ry0), (rx1, ry1) = NOZZLE_RIM
    xs = np.arange(pixels.shape[1], dtype=np.float32)[None, :]
    ys = np.arange(pixels.shape[0], dtype=np.float32)[:, None]
    nozzle = (ys < ry0 + (xs - rx0) * (ry1 - ry0) / (rx1 - rx0)) & (xs >= rx0 - 20) & (xs <= rx1 + 20)
    hole = (soft_alpha(paste, grow=6, feather=0) > 0.5) & ~nozzle
    near_piles = ellipse_mask(pixels.shape, *grown(BEAN_PILES[0])) | ellipse_mask(pixels.shape, *grown(BEAN_PILES[1]))
    # Piles sit in batter: fill them from batter-coloured pixels only, so no mold brown smears into the cavity, and
    # only inside the batter's outline (its holes closed), so batter never spills over the cavity rim.
    batter = (r > 200) & (g > 170) & (b > 90) & (r - b > 40)
    outline = Image.fromarray(batter.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MinFilter(31))
    inside = ~flood(np.asarray(outline) < 128, [FILL_BOX[:2]])  # closed outline with its holes (the piles) filled
    # Where the stream crosses the cavity rim the closing bridges over it; above the batter's top edge (interpolated
    # across the stream) there is mold, not batter.
    inside &= ~above_batter_edge(batter, hole)
    pile_hole = hole & near_piles & inside
    clean = onion_fill(pixels, pile_hole, ~batter & ~pile_hole)
    # Behind the stream is the mold plate: fill it from mold pixels only (not batter, not the cream nozzle).
    clean = onion_fill(clean, hole & ~pile_hole, batter | pile_hole)
    save_patch(clean, soft_alpha(hole, grow=2, feather=1.5) * ~nozzle, FILL_BOX, 'filling-clean')
    # Each mound alone, without the falling column on top: shrinking the mask breaks the narrow neck between the
    # column's last bean and the mound, then the mound's blob is grown back inside the bean mask, so its outline
    # follows the beans (round) instead of a straight cut. The falling beans are drawn by the scene.
    mound = paste & near_piles & ~ellipse_mask(pixels.shape, *COLUMN_BEAN)
    core = np.asarray(Image.fromarray(mound.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(MOUND_NECK))) > 127
    core = flood(core, [(cx, cy + 14) for cx, cy, _, _ in BEAN_PILES])
    mound &= soft_alpha(core, grow=MOUND_NECK // 2 + 2, feather=0) > 0.5
    piles = soft_alpha(mound, grow=1, feather=1)
    # The column from the left mound up to the nozzle, revealed bottom-up by the scene as the mound builds.
    column = paste & ~mound & in_box(pixels.shape, STREAM_BOX) & ~nozzle
    save_patch(pixels, soft_alpha(column, grow=1, feather=1), STREAM_BOX, 'beans-column')
    for i, box in enumerate(BEAN_BOXES):
        save_patch(pixels, piles * in_box(pixels.shape, box), box, f'beans-{i}')


def above_batter_edge(batter, hole):
    """Pixels above the left cavity's batter top edge in RIM_SPAN, with the edge interpolated across the hole."""
    x0, x1, y0, y1 = RIM_SPAN
    columns = np.arange(x0, x1)
    tops = np.full(len(columns), np.nan)
    for i, x in enumerate(columns):
        rows = np.where(batter[y0:y1, x] & ~hole[y0:y1, x])[0]
        # Trust a column only if nothing painted out sits just above its batter top (then the top is the real rim).
        if len(rows) and not hole[max(y0 + rows.min() - 6, 0):y0 + rows.min(), x].any():
            tops[i] = y0 + rows.min()
    known = ~np.isnan(tops)
    tops = np.interp(columns, columns[known], tops[known])
    mask = np.zeros(batter.shape, dtype=bool)
    for x, top in zip(columns, tops):
        mask[y0:int(round(top)), x] = True
    return mask


def grown(ellipse, extra=1.25):
    cx, cy, rx, ry = ellipse
    return cx, cy, rx * extra, ry * extra


def bake_panels():
    """Baking shots, square so they cover the nearly square stage with no strips: each shot is scaled to 1024 wide and
    centred on a 1024x1024 canvas (gen/tall/<name>-pad.png), codex fills the empty bands above and below
    (gen/tall/<name>.png), then the original pixels are pasted back over the middle with a soft edge, so the drawn part
    stays exactly as supplied."""
    storyboard = Image.open(os.path.join(REF, BAKE_STORYBOARD)).convert('RGB')
    source, box = BAKE_OPEN_SOURCE
    shots = {name: storyboard.crop(box) for name, box in BAKE_PANELS.items()}
    shots['open'] = Image.open(os.path.join(REF, source)).convert('RGB').crop(box)
    shots['baked'] = Image.open(os.path.join(REF, BAKE_OPENED)).convert('RGB')
    for name, shot in shots.items():
        height = round(shot.height * BAKE_SIZE / shot.width)
        middle = np.asarray(shot.resize((BAKE_SIZE, height), Image.LANCZOS)).astype(np.float32)
        tall = np.asarray(Image.open(os.path.join(REF, f'gen/tall/{name}.png')).convert('RGB').resize((BAKE_SIZE, BAKE_SIZE), Image.LANCZOS)).astype(np.float32)
        top = (BAKE_SIZE - height) // 2
        rows = np.arange(height, dtype=np.float32)[:, None, None]
        weight = np.clip(np.minimum(rows, height - 1 - rows) / BAKE_SEAM, 0, 1)
        tall[top:top + height] = middle * weight + tall[top:top + height] * (1 - weight)
        Image.fromarray(tall.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, f'bake-{name}.webp'), quality=86)
        print(f'bake-{name}: original rows {top}-{top + height} of {BAKE_SIZE}')

def spin_frames():
    x0, y0, x1, y1 = SPIN_BOX
    ys, xs = np.mgrid[:y1 - y0, :x1 - x0]
    edge = np.minimum.reduce([xs, ys, x1 - x0 - 1 - xs, y1 - y0 - 1 - ys]).astype(np.float32)
    alpha = np.zeros((1024, 1536), dtype=np.float32)
    alpha[y0:y1, x0:x1] = np.clip(edge / SPIN_FEATHER, 0, 1)
    rest = load(SPIN_FRAMES[0])
    for i, name in enumerate(SPIN_FRAMES):
        pixels = load(name)
        if name.endswith('spin-90.png'):
            pixels = with_rest_stand(pixels, rest)
        save_patch(pixels, alpha, SPIN_BOX, f'spin-{i}')


def with_rest_stand(pixels, rest):
    """The 90-degree frame with the resting frame's right stand and a clean gap between it and the upright mold."""
    left, right = SPIN90_GAP
    pixels = pixels.copy()
    pixels[:, right:] = rest[:, right:]
    t = ((np.arange(left, right) - left) / (right - left))[None, :, None]
    pixels[:, left:right] = pixels[:, left - 1:left] * (1 - t) + rest[:, right:right + 1] * t
    return pixels


def packed_layers():
    """Pouch front (below the lip; whole columns beside the opening) and gripper pads, cut from the empty close-up."""
    pixels = without_motion_lines(load(FRAMES['packed']))
    luminance = np.asarray(Image.fromarray(pixels.astype(np.uint8)).convert('L').filter(ImageFilter.GaussianBlur(2)),
                           dtype=np.float32)
    x0, x1 = POUCH_OPENING_X
    lip = np.full(pixels.shape[1], POUCH_BOX[1], dtype=np.float32)
    for x in range(x0, x1):
        column = luminance[POUCH_LIP_SCAN[0]:POUCH_LIP_SCAN[1], x]
        lip[x] = POUCH_LIP_SCAN[0] + int(np.argmax(column[6:] - column[:-6])) + 3
    lip[x0:x1] = np.convolve(np.pad(lip[x0:x1], 8, mode='edge'), np.ones(17) / 17, mode='valid')
    rows = np.arange(pixels.shape[0], dtype=np.float32)[:, None]
    front = np.clip(rows - lip[None, :] + 1, 0, 1) * in_box(pixels.shape, POUCH_BOX)
    save_patch(pixels, front, POUCH_BOX, 'packed-front')
    pads = Image.new('L', (pixels.shape[1], pixels.shape[0]), 0)
    for pad in GRIPPER_PADS:
        ImageDraw.Draw(pads).polygon(pad, fill=255)
    alpha = np.asarray(pads.filter(ImageFilter.GaussianBlur(1)), dtype=np.float32) / 255
    save_patch(pixels, alpha, (560, 170, 1000, 475), 'packed-fingers')


def engraving():
    """The lid relief, scaled and placed in frame coordinates, with a feathered box alpha."""
    source = Image.open(os.path.join(REF, ENGRAVING_SOURCE)).convert('RGB')
    blurred = np.asarray(source.filter(ImageFilter.GaussianBlur(ENGRAVING_BLUR)), dtype=np.float32)
    relief = np.asarray(source, dtype=np.float32) - blurred
    x0, y0, x1, y1 = ENGRAVING_BOX
    ys, xs = np.mgrid[:y1 - y0, :x1 - x0]
    edge = np.minimum.reduce([xs, ys, x1 - x0 - 1 - xs, y1 - y0 - 1 - ys]).astype(np.float32)
    alpha = np.clip(edge / ENGRAVING_FEATHER, 0, 1)
    width, height = round((x1 - x0) * ENGRAVING_SCALE), round((y1 - y0) * ENGRAVING_SCALE)
    channels = [Image.fromarray(relief[y0:y1, x0:x1, c]).resize((width, height), Image.BICUBIC) for c in range(3)]
    patch = np.dstack([np.asarray(c, dtype=np.float32) for c in channels])
    patch_alpha = np.asarray(Image.fromarray(alpha).resize((width, height), Image.BILINEAR), dtype=np.float32)
    cx, cy = ENGRAVING_CENTRE
    tx, ty = ENGRAVING_TARGET
    left = round(tx - (cx - x0) * ENGRAVING_SCALE)
    top = round(ty - (cy - y0) * ENGRAVING_SCALE)
    full = np.zeros((1024, 1536, 3), dtype=np.float32)
    full_alpha = np.zeros((1024, 1536), dtype=np.float32)
    full[top:top + height, left:left + width] = patch
    full_alpha[top:top + height, left:left + width] = patch_alpha
    return full, full_alpha


def engraved(pixels, relief, alpha):
    """Adds the relief where the frame shows bare lid (close to the lid's median colour), so the arm stays in front."""
    lid_box = in_box(pixels.shape, LID_BOX)
    lid_colour = np.median(pixels[lid_box], axis=0)
    bare = (np.abs(pixels - lid_colour).max(axis=2) < LID_TOLERANCE) & lid_box
    bare = np.asarray(Image.fromarray(bare.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(5))
                      .filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32) / 255
    return pixels + relief * (alpha * bare)[..., None]


def without_motion_lines(pixels):
    lines = (pixels.min(axis=2) > 200) & in_box(pixels.shape, MOTION_LINES_BOX)
    return onion_fill(pixels, soft_alpha(lines, grow=4, feather=0) > 0.5, np.zeros(lines.shape, dtype=bool))


def without_bag(step):
    pixels = load(FRAMES[step])
    received = load(FRAMES['received'])
    changed = np.abs(pixels - received).max(axis=2) > READY_DIFF
    alpha = soft_alpha(changed, grow=6, feather=3)[..., None]
    return pixels * (1 - alpha) + received * alpha


def main():
    os.makedirs(OUT, exist_ok=True)
    relief, relief_alpha = engraving()
    for step, name in FRAMES.items():
        frame = Image.open(os.path.join(REF, name)).convert('RGB')
        if step == 'ready':
            frame = Image.fromarray(without_bag(step).clip(0, 255).astype(np.uint8))
        if step == 'filling':
            frame = Image.fromarray(filling_frame().clip(0, 255).astype(np.uint8))
        if step == 'packed':
            frame = Image.fromarray(without_motion_lines(load(name)).clip(0, 255).astype(np.uint8))
        if step in ENGRAVED:
            pixels = np.asarray(frame, dtype=np.float32)
            frame = Image.fromarray(engraved(pixels, relief, relief_alpha).clip(0, 255).astype(np.uint8))
        frame.save(os.path.join(OUT, f'{step}.webp'), quality=82)
    batter_empty()
    beans_empty()
    spin_frames()
    bake_panels()
    packed_layers()


if __name__ == '__main__':
    main()
