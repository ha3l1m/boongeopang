"""붕어빵 할매 v3 — Blender model built from the confirmed character sheet.

Run headless:  blender -b --factory-startup --python tools/blender/build_halmae.py -- <out.glb> [preview.png]
Run live (MCP): exec(open(path).read(), {"LIVE": True, "STEP": 1..5})

Proportions (total 3.5): hat + face 45%, body + apron 35%, legs + shoes 20%.
Blender is Z-up and the character faces -Y, so after glTF export she faces +Z in three.js.

Pivots the web app animates: PIVOT_Body, PIVOT_Head, PIVOT_ArmL/R, PIVOT_LegL/R.
Expression groups it toggles: EXPR_EyesOpen/Happy/Wink/Wide, EXPR_MouthSmile/O/Laugh.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Vector

LIVE = globals().get("LIVE", False)
STEP = globals().get("STEP", 5)
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_GLB = args[0] if args else "halmae.glb"
PREVIEW = args[1] if len(args) > 1 else None

H = 3.5
LEGS_TOP = 0.2 * H          # 0.70
BODY_TOP = 0.55 * H         # 1.925
F = Vector((0, 0, 2.3))     # face center
FA, FB, FC = 0.66, 0.55, 0.44


# ---------- scene reset ----------

def reset_scene():
    if not LIVE:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        return
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights, bpy.data.cameras):
        for block in list(coll):
            coll.remove(block)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)


reset_scene()

ROOT_COLL = bpy.data.collections.new("HALMAE_V3")
bpy.context.scene.collection.children.link(ROOT_COLL)
COLLS = {}
for name in ("RIG", "BODY", "FACE", "HAIR", "HAT", "CLOTHING"):
    COLLS[name] = bpy.data.collections.new(name)
    ROOT_COLL.children.link(COLLS[name])


# ---------- helpers ----------

def srgb(hex_color):
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    h = hex_color.lstrip("#")
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


_materials = {}


def material(name, hex_color, roughness=0.85):
    """Matte clay: no metal, no gloss."""
    if name in _materials:
        return _materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb(hex_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    _materials[name] = mat
    return mat


def place(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COLLS[coll].objects.link(obj)
    return obj


def finish(obj, mat, coll, subsurf=2):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if hasattr(obj.data, "shade_smooth"):
        obj.data.shade_smooth()
    if subsurf:
        mod = obj.modifiers.new("Subsurf", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf
    return place(obj, coll)


def sphere(name, loc, scale, mat, coll, rot=(0, 0, 0), subsurf=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale if isinstance(scale, tuple) else (scale, scale, scale)
    return finish(obj, mat, coll, subsurf)


def torus(name, loc, major, minor, mat, coll, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=48, minor_segments=14,
                                     location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    return finish(obj, mat, coll, 1)


def bevel_box(name, loc, size, mat, coll, bevel=0.05, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 5
    return finish(obj, mat, coll, 0)


def arc_curve(name, center, radius, start, end, depth, mat, coll, y):
    """Thin round tube along an arc in the XZ plane (brows, smile, closed eyes)."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = depth
    curve.bevel_resolution = 4
    curve.use_fill_caps = True
    spline = curve.splines.new("POLY")
    steps = 16
    spline.points.add(steps)
    for i in range(steps + 1):
        a = start + (end - start) * i / steps
        spline.points[i].co = (center[0] + radius * math.cos(a), y, center[2] + radius * math.sin(a), 1)
    curve.materials.append(mat)
    obj = bpy.data.objects.new(name, curve)
    COLLS[coll].objects.link(obj)
    return obj


def mirror_x(obj):
    """Mirror across the character's centre line (object origin must sit on x = 0)."""
    mod = obj.modifiers.new("Mirror", "MIRROR")
    mod.use_axis[0] = True
    obj.modifiers.move(len(obj.modifiers) - 1, 0)
    return obj


def to_center_origin(obj):
    """Bake the object's transform into its mesh so its origin sits at the world origin (for mirroring)."""
    bpy.context.view_layer.update()
    obj.data.transform(obj.matrix_basis.copy())
    obj.matrix_basis.identity()
    return obj


def empty(name, loc, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.location = loc
    COLLS["RIG"].objects.link(obj)
    if parent:
        parent_to(obj, parent)
    return obj


def parent_to(child, parent):
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def edit_verts(obj, fn):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    fn(bm)
    bm.to_mesh(obj.data)
    bm.free()


def keep_where(obj, keep):
    edit_verts(obj, lambda bm: bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co)], context="VERTS"))


def rounded_drum(name, loc, radius, depth, mat, coll, top_scale=1.0, y_scale=1.0, bevel=0.16):
    """Soft drum, narrower at the top: cardigan and apron silhouette."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name

    def shape(bm):
        sides = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > depth * 0.5]
        bmesh.ops.subdivide_edges(bm, edges=sides, cuts=12, use_grid_fill=True)
        for v in bm.verts:
            t = (v.co.z + depth / 2) / depth
            k = 1 + (top_scale - 1) * t
            v.co.x *= k
            v.co.y *= k * y_scale

    edit_verts(obj, shape)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 5
    mod.limit_method = "ANGLE"
    return finish(obj, mat, coll, 1)


def face_y(x, z):
    """Front surface (−Y) of the face ellipsoid, relative to F."""
    k = 1 - (x / FA) ** 2 - (z / FC) ** 2
    return -FB * math.sqrt(max(k, 0))


def hide_by_default(obj):
    for o in [obj] + list(obj.children_recursive):
        o.hide_render = True
        o.hide_viewport = True


# ---------- palette (sheet: 컬러 팔레트) ----------
SKIN = material("Skin", "#F6CDB4", 0.75)
BLUSH = material("Blush", "#F5ABA6", 0.85)
HAIR = material("Hair", "#F4F0EA", 0.8)
HAT = material("HatFelt", "#9A5634", 0.95)
FUR = material("HatFur", "#F3E2C4", 0.95)
CARDIGAN = material("Knit", "#BE5A33", 0.9)
APRON = material("Apron", "#F3E1C0", 0.9)
COLLAR = material("Collar", "#F6E7CC", 0.85)
BUTTON = material("Button", "#F0A23A", 0.6)
PANTS = material("Pants", "#7B4B30", 0.9)
SHOE = material("Shoe", "#5A3524", 0.75)
FRAME = material("Glasses", "#2B2522", 0.6)
EYE = material("Eye", "#231C18", 0.5)
SHINE = material("Shine", "#FFFFFF", 0.4)
NOSE = material("Nose", "#F3A98F", 0.75)
MOUTH = material("Mouth", "#B5433A", 0.7)
TONGUE = material("Tongue", "#E9837A", 0.7)
FISH = material("FishPatch", "#F09A35", 0.8)


def add_bump(mat, kind):
    """Subtle surface relief in Blender renders: felt crackle on the hat, knit rows on the cardigan."""
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    coords = nodes.new("ShaderNodeTexCoord")
    bump = nodes.new("ShaderNodeBump")
    if kind == "felt":
        tex = nodes.new("ShaderNodeTexVoronoi")
        tex.feature = "DISTANCE_TO_EDGE"
        tex.inputs["Scale"].default_value = 9.0
        links.new(coords.outputs["Object"], tex.inputs["Vector"])
        links.new(tex.outputs["Distance"], bump.inputs["Height"])
        bump.inputs["Strength"].default_value = 0.12
        bump.inputs["Distance"].default_value = 0.04
    else:
        tex = nodes.new("ShaderNodeTexWave")
        tex.wave_type = "BANDS"
        tex.bands_direction = "Z"
        tex.inputs["Scale"].default_value = 26.0
        tex.inputs["Distortion"].default_value = 1.5
        links.new(coords.outputs["Object"], tex.inputs["Vector"])
        links.new(tex.outputs["Fac"], bump.inputs["Height"])
        bump.inputs["Strength"].default_value = 0.06
        bump.inputs["Distance"].default_value = 0.02
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


add_bump(HAT, "felt")
add_bump(CARDIGAN, "knit")


def tube_curve(name, points, depth, mat, coll, smooth=True):
    """Round tube along 3D points (apron straps)."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = depth
    curve.bevel_resolution = 5
    curve.use_fill_caps = True
    spline = curve.splines.new("NURBS" if smooth else "POLY")
    spline.points.add(len(points) - 1)
    for pt, co in zip(spline.points, points):
        pt.co = (*co, 1)
    if smooth:
        spline.use_endpoint_u = True
        spline.order_u = 3
    curve.materials.append(mat)
    obj = bpy.data.objects.new(name, curve)
    COLLS[coll].objects.link(obj)
    return obj


def cloud(name, lobes, mat, coll, threshold=0.5):
    """Smooth white hair: a few big lobes merged into one soft clay mass (not a grape cluster)."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = 0.035
    mb.threshold = threshold
    for loc, r in lobes:
        el = mb.elements.new()
        el.co = loc
        el.radius = r
    tmp = bpy.data.objects.new(name + "_meta", mb)
    COLLS[coll].objects.link(tmp)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.metaballs.remove(mb)
    obj = bpy.data.objects.new(name, mesh)
    COLLS[coll].objects.link(obj)
    finish(obj, mat, coll, subsurf=0)
    smooth = obj.modifiers.new("Smooth", "SMOOTH")
    smooth.iterations = 14
    smooth.factor = 0.8
    return obj


def apron_bib(name, mat, coll, torso_r, z_top, z_wide, z_bottom, w_top, w_wide, w_bottom, y_scale):
    """Bib apron wrapped around the torso front: narrow bib, wide skirt, rounded bottom corners."""
    bm = bmesh.new()
    rows, cols = 40, 28
    grid = []
    for i in range(rows + 1):
        z = z_top + (z_bottom - z_top) * i / rows
        if z > z_wide:
            w = w_top + (w_wide - w_top) * (z_top - z) / (z_top - z_wide)
        else:
            w = w_wide + (w_bottom - w_wide) * (z_wide - z) / (z_wide - z_bottom)
        corner = 0.16
        if z < z_bottom + corner:
            t = (z - z_bottom) / corner
            w -= corner * (1 - math.sqrt(max(0.0, 1 - (1 - t) ** 2)))
        row = []
        for j in range(cols + 1):
            x = -w + 2 * w * j / cols
            r = torso_r(z)
            y = -math.sqrt(max(r * r - x * x, 0.0)) * y_scale - 0.035
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(rows):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    COLLS[coll].objects.link(obj)
    obj.data.materials.append(mat)
    obj.data.shade_smooth()
    obj.modifiers.new("Thickness", "SOLIDIFY").thickness = 0.04
    obj.modifiers["Thickness"].offset = 1
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.015
    bev.segments = 3
    obj.modifiers.new("Subsurf", "SUBSURF").levels = 1
    return obj


# ---------- measured layout (sheet 정면, total height 3.5) ----------
CHIN = 1.68
F = Vector((0, 0, 2.16))
FA, FB, FC = 0.70, 0.60, 0.50
TORSO_BOTTOM, TORSO_TOP = 0.42, 1.74
TORSO_R = 0.68


def torso_radius(z):
    t = (z - TORSO_BOTTOM) / (TORSO_TOP - TORSO_BOTTOM)
    return TORSO_R * (1 - 0.16 * max(0.0, min(1.0, t)))


# ---------- rig pivots ----------
root = empty("HALMAE_V3_ROOT", (0, 0, 0))
p_body = empty("PIVOT_Body", (0, 0, 0), root)
p_leg_l = empty("PIVOT_LegL", (-0.26, 0, 0.5), root)
p_leg_r = empty("PIVOT_LegR", (0.26, 0, 0.5), root)
p_head = empty("PIVOT_Head", (0, 0, CHIN), root)
p_arm_l = empty("PIVOT_ArmL", (-0.56, 0, 1.56), root)
p_arm_r = empty("PIVOT_ArmR", (0.56, 0, 1.56), root)

# ================= STEP 1: base forms =================
for side, pivot in ((-1, p_leg_l), (1, p_leg_r)):
    tag = "L" if side < 0 else "R"
    leg = sphere(f"Leg_{tag}", (side * 0.26, 0, 0.4), (0.23, 0.23, 0.26), PANTS, "BODY")
    shoe = sphere(f"Shoe_{tag}", (side * 0.27, -0.05, 0.14), (0.25, 0.3, 0.14), SHOE, "BODY")
    parent_to(leg, pivot)
    parent_to(shoe, pivot)

torso = rounded_drum("Torso", (0, 0, (TORSO_TOP + TORSO_BOTTOM) / 2), TORSO_R, TORSO_TOP - TORSO_BOTTOM, CARDIGAN,
                     "BODY", top_scale=0.84, y_scale=0.86, bevel=0.32)
parent_to(torso, p_body)

for side, pivot in ((-1, p_arm_l), (1, p_arm_r)):
    tag = "L" if side < 0 else "R"
    shoulder = sphere(f"Shoulder_{tag}", (side * 0.5, 0, 1.5), (0.19, 0.18, 0.2), CARDIGAN, "BODY")
    arm = sphere(f"Arm_{tag}", (side * 0.66, 0, 1.18), (0.17, 0.17, 0.36), CARDIGAN, "BODY",
                 rot=(0, math.radians(side * 10), 0))
    hand = sphere(f"Hand_{tag}", (side * 0.72, -0.03, 0.8), (0.14, 0.13, 0.13), SKIN, "BODY")
    for o in (shoulder, arm, hand):
        parent_to(o, pivot)

# wide, short mochi face: lower half a little wider, round chin
head = sphere("Head", F, (FA, FB, FC), SKIN, "BODY", subsurf=2)
to_center_origin(head)
edit_verts(head, lambda bm: [setattr(v.co, "x", v.co.x * (1 + 0.12 * max(0.0, F.z - v.co.z) / FC)) for v in bm.verts])
parent_to(head, p_head)

# hat dome (chestnut felt) and brim base
HAT_Z = 2.78
hat_main = sphere("Hat_Main", (0, 0.03, HAT_Z), (0.72, 0.7, 0.58), HAT, "HAT", subsurf=2)
keep_where(hat_main, lambda c: c.z > -0.28)
parent_to(hat_main, p_head)

# ================= STEP 2: face =================
if STEP >= 2:
    EYE_Z = 0.08
    EX = 0.27
    EY = face_y(EX, EYE_Z)

    def dot_eyes(name, parent, sides=(-1, 1)):
        for side in sides:
            tag = "L" if side < 0 else "R"
            eye = sphere(f"{name}_{tag}", F + Vector((side * EX, EY + 0.006, EYE_Z)), (0.038, 0.018, 0.054), EYE, "FACE")
            shine = sphere(f"{name}Shine_{tag}", F + Vector((side * EX + 0.011, EY - 0.012, EYE_Z + 0.018)),
                           0.009, SHINE, "FACE", subsurf=1)
            parent_to(eye, parent)
            parent_to(shine, parent)

    def arc_eyes(name, parent, sides=(-1, 1)):
        for side in sides:
            tag = "L" if side < 0 else "R"
            arc = arc_curve(f"{name}_{tag}", (side * EX, 0, F.z + EYE_Z - 0.02), 0.045, math.radians(20),
                            math.radians(160), 0.012, EYE, "FACE", y=EY + 0.004)
            parent_to(arc, parent)

    eyes_open = empty("EXPR_EyesOpen", F, p_head)
    eyes_happy = empty("EXPR_EyesHappy", F, p_head)
    eyes_wink = empty("EXPR_EyesWink", F, p_head)
    eyes_wide = empty("EXPR_EyesWide", F, p_head)
    dot_eyes("Eyes", eyes_open)
    arc_eyes("EyesHappy", eyes_happy)
    dot_eyes("EyesWink", eyes_wink, sides=(-1,))
    arc_eyes("EyesWinkClosed", eyes_wink, sides=(1,))
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        wide = sphere(f"EyesWide_{tag}", F + Vector((side * EX, EY + 0.006, EYE_Z)), (0.046, 0.02, 0.06), EYE, "FACE")
        parent_to(wide, eyes_wide)

    # big thin black round lenses, nearly touching at the bridge, hugging the face
    glasses = to_center_origin(torus("Glasses", F + Vector((EX, EY - 0.02, EYE_Z)), 0.2, 0.016, FRAME, "FACE",
                                     rot=(math.radians(90), 0, math.radians(18))))
    mirror_x(glasses)
    parent_to(glasses, p_head)
    bridge = arc_curve("Glasses_Bridge", (0, 0, F.z + EYE_Z - 0.03), 0.07, math.radians(40), math.radians(140), 0.014,
                       FRAME, "FACE", y=face_y(0, EYE_Z + 0.03) - 0.02)
    parent_to(bridge, p_head)

    brow = arc_curve("Eyebrows", (EX + 0.02, 0, F.z + 0.3), 0.1, math.radians(55), math.radians(125), 0.024, HAIR,
                     "FACE", y=face_y(EX, 0.36) - 0.01)
    mirror_x(brow)
    parent_to(brow, p_head)

    nose = sphere("Nose", F + Vector((0, face_y(0, -0.02) + 0.008, -0.02)), (0.055, 0.04, 0.048), NOSE, "FACE")
    parent_to(nose, p_head)

    cheeks = to_center_origin(sphere("Cheeks", F + Vector((0.5, face_y(0.5, -0.08) + 0.02, -0.08)),
                                     (0.15, 0.025, 0.09), BLUSH, "FACE", rot=(0, 0, math.radians(30))))
    mirror_x(cheeks)
    parent_to(cheeks, p_head)

    MOUTH_Z = -0.2
    MY = face_y(0, MOUTH_Z) + 0.004
    mouth_smile = empty("EXPR_MouthSmile", F, p_head)
    mouth_o = empty("EXPR_MouthO", F, p_head)
    mouth_laugh = empty("EXPR_MouthLaugh", F, p_head)
    parent_to(arc_curve("Mouth", (0, 0, F.z + MOUTH_Z + 0.07), 0.095, math.radians(225), math.radians(315), 0.012,
                        MOUTH, "FACE", y=MY), mouth_smile)
    parent_to(sphere("MouthO", F + Vector((0, MY, MOUTH_Z)), (0.032, 0.015, 0.04), MOUTH, "FACE"), mouth_o)
    laugh = sphere("MouthLaugh", F + Vector((0, MY + 0.003, MOUTH_Z + 0.015)), (0.07, 0.022, 0.055), MOUTH, "FACE")
    keep_where(laugh, lambda c: c.z < 0.15)
    tongue = sphere("Tongue", F + Vector((0, MY - 0.008, MOUTH_Z - 0.015)), (0.036, 0.01, 0.02), TONGUE, "FACE")
    parent_to(laugh, mouth_laugh)
    parent_to(tongue, mouth_laugh)
    for group in (eyes_happy, eyes_wink, eyes_wide, mouth_o, mouth_laugh):
        hide_by_default(group)

# ================= STEP 3: hair and hat =================
if STEP >= 3:
    # white hair: soft lobed cloud at each side and across the back, tucked under the brim
    side_lobes = []
    for side in (-1, 1):
        side_lobes += [((side * 0.6, -0.14, 0.02), 0.25), ((side * 0.66, 0.06, -0.14), 0.26),
                       ((side * 0.56, -0.12, -0.3), 0.22), ((side * 0.62, 0.26, -0.26), 0.24)]
    back_lobes = []
    for i in range(6):
        a = math.radians(125 + i * 26)
        back_lobes.append(((math.sin(a) * 0.54, -math.cos(a) * 0.5, 0.02 if i % 2 else -0.1), 0.26))
    for i in range(5):
        a = math.radians(138 + i * 26)
        back_lobes.append(((math.sin(a) * 0.48, -math.cos(a) * 0.46, -0.32), 0.24))
    top_lobes = []
    for i in range(7):
        a = math.radians(118 + i * 21)
        top_lobes.append(((math.sin(a) * 0.5, -math.cos(a) * 0.48, 0.2), 0.24))
    hair = cloud("Hair", [(F + Vector(l), r) for l, r in side_lobes + back_lobes + top_lobes], HAIR, "HAIR",
                 threshold=0.42)
    parent_to(hair, p_head)

    # smooth hair cap under the brim: covers the scalp at the back and sides so no skin shows between brim and lobes
    cap = sphere("Hair_Cap", F + Vector((0, 0.04, 0.03)), (FA + 0.06, FB + 0.06, FC + 0.05), HAIR, "HAIR")
    to_center_origin(cap)
    keep_where(cap, lambda c: (c.y - F.y) > -0.08 or abs(c.x) > 0.56)
    parent_to(cap, p_head)

    # thick cream brim that droops at the sides (bucket-like), covering the ears
    brim = torus("Hat_Trim", (0, 0.03, HAT_Z - 0.14), 0.64, 0.27, FUR, "HAT", scale=(1.0, 0.95, 0.92))
    to_center_origin(brim)

    def droop(bm):
        for v in bm.verts:
            k = min(1.0, abs(v.co.x) / 0.89)
            v.co.z -= 0.42 * k ** 2.5
            v.co.x *= 1 - 0.04 * k
    edit_verts(brim, droop)
    brim.modifiers["Subsurf"].levels = 2
    parent_to(brim, p_head)

    pom = sphere("Pompom", (0, 0.04, HAT_Z + 0.54), 0.23, FUR, "HAT")
    parent_to(pom, p_head)

# ================= STEP 4: clothing =================
if STEP >= 4:
    collar = to_center_origin(sphere("Collar", (0.2, -0.3, CHIN - 0.03), (0.24, 0.1, 0.1), COLLAR, "CLOTHING",
                                     rot=(math.radians(-20), 0, math.radians(-14))))
    mirror_x(collar)
    button = sphere("Button", (0, -0.49, CHIN - 0.17), (0.045, 0.025, 0.045), BUTTON, "CLOTHING")

    apron = apron_bib("Apron", APRON, "CLOTHING", torso_radius, z_top=1.52, z_wide=1.16, z_bottom=0.4,
                      w_top=0.3, w_wide=0.6, w_bottom=0.66, y_scale=0.86)
    for side in (-1, 1):
        tag = "L" if side < 0 else "R"
        y0 = -math.sqrt(max(torso_radius(1.52) ** 2 - 0.3 ** 2, 0)) * 0.86 - 0.03
        strap = tube_curve(f"Apron_Strap_{tag}", [
            (side * 0.28, y0, 1.5), (side * 0.3, y0 + 0.02, 1.64), (side * 0.32, -0.16, 1.8), (side * 0.33, 0.1, 1.82)],
            0.035, APRON, "CLOTHING")
        parent_to(strap, p_body)
    pocket = bevel_box("Apron_Pocket", (0, -0.6, 0.8), (0.56, 0.06, 0.4), APRON, "CLOTHING", bevel=0.07,
                       rot=(math.radians(-6), 0, 0))
    fish_c = Vector((0, -0.64, 0.82))
    fish_body = sphere("Fish_Patch", fish_c + Vector((-0.03, 0, 0)), (0.13, 0.04, 0.09), FISH, "CLOTHING")
    fish_tail = sphere("Fish_Patch_Tail", fish_c + Vector((0.13, 0.004, 0)), (0.05, 0.03, 0.07), FISH, "CLOTHING")
    fish_eye = sphere("Fish_Patch_Eye", fish_c + Vector((-0.1, -0.038, 0.022)), 0.014, EYE, "CLOTHING", subsurf=1)

    ties = torus("Apron_Ties", (0, 0.02, 1.3), 0.575, 0.03, APRON, "CLOTHING", scale=(1, 0.86, 1))
    loops = to_center_origin(torus("Back_Ribbon", (0.17, 0.5, 1.26), 0.13, 0.05, APRON, "CLOTHING",
                                   rot=(math.radians(90), 0, 0), scale=(1.35, 1, 0.8)))
    mirror_x(loops)
    tails = to_center_origin(bevel_box("Back_Ribbon_Tails", (0.1, 0.52, 1.02), (0.09, 0.035, 0.32), APRON,
                                       "CLOTHING", bevel=0.02, rot=(0, math.radians(-16), 0)))
    mirror_x(tails)
    knot = sphere("Back_Ribbon_Knot", (0, 0.54, 1.26), 0.075, APRON, "CLOTHING")
    for o in (collar, button, apron, pocket, fish_body, fish_tail, fish_eye, ties, loops, tails, knot):
        parent_to(o, p_body)
    for side, pivot in ((-1, p_arm_l), (1, p_arm_r)):
        tag = "L" if side < 0 else "R"
        cuff = torus(f"Cuff_{tag}", (side * 0.7, 0, 0.9), 0.13, 0.04, CARDIGAN, "CLOTHING",
                     rot=(0, math.radians(side * 10), 0))
        parent_to(cuff, pivot)


# ================= STEP 5: studio light and color management =================

def setup_studio():
    scene = bpy.context.scene
    studio = bpy.data.collections.new("STUDIO")
    scene.collection.children.link(studio)
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        scene.view_settings.view_transform = "Filmic"
    scene.view_settings.exposure = -0.35
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = srgb("#F7E9DD")
    bg.inputs[1].default_value = 0.6
    scene.world = world
    for name, loc, energy, size in (("Key", (-3, -4, 5), 380, 6), ("Fill", (4, -3, 3), 160, 6),
                                    ("Rim", (0, 4, 4), 200, 5)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 1.6)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        studio.objects.link(obj)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 70
    cam = bpy.data.objects.new("Cam", cam_data)
    studio.objects.link(cam)
    scene.camera = cam
    return cam


bpy.context.view_layer.update()

if STEP >= 5 or not LIVE:
    cam = setup_studio()

# ---------- export ----------
if not LIVE:
    for obj in ROOT_COLL.all_objects:
        obj.hide_viewport = False  # alternate expressions are exported; hide_render keeps them out of the preview
    layer = bpy.context.view_layer
    layer.update()
    layer.active_layer_collection = layer.layer_collection.children[ROOT_COLL.name]
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", export_apply=True, export_yup=True,
                              use_active_collection=True, use_active_collection_with_nested=True,
                              export_cameras=False, export_lights=False)
    print("EXPORTED", OUT_GLB)

    if PREVIEW:
        scene = bpy.context.scene
        scene.render.resolution_x = 900
        scene.render.resolution_y = 1000
        for name, loc in (("", (0, -8.4, 2.0)), ("-back", (0, 8.4, 2.0)), ("-side", (-8.4, 0, 2.0))):
            cam.location = loc
            cam.rotation_euler = (Vector((0, 0, 1.78)) - cam.location).to_track_quat("-Z", "Y").to_euler()
            scene.render.filepath = PREVIEW.replace(".png", f"{name}.png")
            bpy.ops.render.render(write_still=True)
        print("RENDERED", PREVIEW)
