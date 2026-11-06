"""Cycles render of the login street: 할매 in her fish-bread cart on a snowy night.

Run:  blender -b --factory-startup --python tools/blender/render_login.py -- <out.png> [samples] [scale]

Mirrors src/three/CartScene.tsx. three.js (x, y up, z toward camera) maps to Blender (x, -z, y).
Output is a transparent PNG; the page paints the night sky behind it.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else "login-hero.png"
SAMPLES = int(args[1]) if len(args) > 1 else 256
RES_SCALE = float(args[2]) if len(args) > 2 else 1.0
HERE = Path(__file__).resolve().parent

# ---------- grandma from the character script ----------
ns = {"__name__": "halmae", "LIVE": True, "STEP": 4}
src = (HERE / "build_halmae.py").read_text()
exec(compile(src, str(HERE / "build_halmae.py"), "exec"), ns)
grandma_root = bpy.data.objects["HALMAE_V3_ROOT"]
material = ns["material"]
srgb = ns["srgb"]

SCENE_COLL = bpy.data.collections.new("STREET")
bpy.context.scene.collection.children.link(SCENE_COLL)


def t2b(x, y, z):
    """three.js position -> Blender position."""
    return Vector((x, -z, y))


# ---------- materials (matte clay + a little subsurface) ----------

def clay_material(name, hex_color, roughness=0.85, sss=0.0, sheen=0.0, emission=None, strength=0.0):
    mat = material(name, hex_color, roughness)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    if sss and "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = sss
        bsdf.inputs["Subsurface Radius"].default_value = (0.2, 0.1, 0.05)
        bsdf.inputs["Subsurface Scale"].default_value = 0.15
    if sheen and "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    if emission:
        bsdf.inputs["Emission Color"].default_value = srgb(emission)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


RED = clay_material("CartRed", "#D5432A", 0.75)
RED_DEEP = clay_material("CartRedDeep", "#B9371F", 0.8)
SIGN = clay_material("Sign", "#E3703A", 0.8, sheen=0.3)
SIGN_DEEP = clay_material("SignDeep", "#C85A2C", 0.8)
CREAM = clay_material("CreamPanel", "#FFF1DA", 0.85)
STEEL = clay_material("Steel", "#E9E1D6", 0.45)
DARK = clay_material("DarkTray", "#3A302B", 0.6)
SNOW = clay_material("SnowMat", "#DDE3F5", 0.95, sss=0.3)
GROUND = clay_material("Ground", "#9EA8CF", 1.0)
FISH = clay_material("FishBread", "#F6AE48", 0.78, sss=0.3, sheen=0.25)
FISH_FIN = clay_material("FishFin", "#EC9F3C", 0.78, sss=0.3)
FISH_GROOVE = clay_material("FishGroove", "#C97A22", 0.8)
FISH_DARK = clay_material("FishDark", "#7A4514", 0.7)
FISH_SOFT = clay_material("FishSoft", "#E0912E", 0.8, sss=0.3)  # scale/gill relief: only a shade darker than the batter
# baked edge: darken the body toward its silhouette with a facing-based mix
_fb = FISH.node_tree
_bsdf = next(n for n in _fb.nodes if n.type == "BSDF_PRINCIPLED")
_lw = _fb.nodes.new("ShaderNodeLayerWeight")
_lw.inputs["Blend"].default_value = 0.55
_mix = _fb.nodes.new("ShaderNodeMix")
_mix.data_type = "RGBA"
_mix.inputs["A"].default_value = srgb("#D27E26")
_mix.inputs["B"].default_value = srgb("#F6AE48")
_fb.links.new(_lw.outputs["Facing"], _mix.inputs["Factor"])  # Facing is 1 head-on, 0 at the rim -> rim gets A (darker)
_fb.links.new(_mix.outputs["Result"], _bsdf.inputs["Base Color"])
BULB = clay_material("Bulb", "#FFE6A0", 0.4, emission="#FFC24A", strength=8)
LANTERN_A = clay_material("LanternA", "#FFC46B", 0.9, emission="#FFB347", strength=6)
LANTERN_B = clay_material("LanternB", "#FF9E4A", 0.9, emission="#FF8A2A", strength=6)
WINDOW_ON = clay_material("WindowOn", "#FFD27A", 1.0, emission="#FFB347", strength=5)
WINDOW_OFF = clay_material("WindowOff", "#2A2D52", 1.0)
GLASS = bpy.data.materials.new("Glass")
GLASS.use_nodes = True
_g = next(n for n in GLASS.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
_g.inputs["Base Color"].default_value = srgb("#DDEEFF")
_g.inputs["Roughness"].default_value = 0.05
_g.inputs["Transmission Weight"].default_value = 1.0
_g.inputs["IOR"].default_value = 1.2
WALLS = [clay_material(f"Wall{i}", c, 0.95) for i, c in enumerate(["#3F4270", "#4A4474", "#3A3D66", "#524A6E", "#434A78", "#3C3F6C"])]
ROOF = clay_material("HouseRoof", "#5B4B63", 0.95)
POLE = clay_material("Pole", "#2E2A33", 0.6)
STRING = clay_material("String", "#6B5A4A", 0.9)
WHEEL = clay_material("Wheel", "#2B2B2B", 0.7)


# ---------- helpers ----------

def link(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    SCENE_COLL.objects.link(obj)
    return obj


def smooth(obj, subsurf=1):
    if hasattr(obj.data, "shade_smooth"):
        obj.data.shade_smooth()
    if subsurf:
        m = obj.modifiers.new("Subsurf", "SUBSURF")
        m.levels = subsurf
        m.render_levels = subsurf
    return obj


def set_mat(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def box(name, pos, size, mat, bevel=0.04, rot=(0, 0, 0)):
    """three.js box: pos (x,y,z) and size (w,h,d) in three space."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=t2b(*pos), rotation=rot)
    o = bpy.context.active_object
    o.name = name
    w, h, d = size
    o.scale = (w, d, h)
    if bevel:
        m = o.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = 5
    set_mat(o, mat)
    o.data.shade_smooth()
    return link(o)


def sphere(name, pos, scale, mat, subsurf=1, rot=(0, 0, 0), half=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1, location=t2b(*pos), rotation=rot)
    o = bpy.context.active_object
    o.name = name
    sx, sy, sz = scale if isinstance(scale, tuple) else (scale, scale, scale)
    o.scale = (sx, sz, sy)
    if half:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.001], context="VERTS")
        bm.to_mesh(o.data)
        bm.free()
    set_mat(o, mat)
    return link(smooth(o, subsurf))


def cylinder(name, pos, radius, depth, mat, rot=(0, 0, 0), axis="y"):
    """Cylinder along the three.js `axis` ('y' = vertical)."""
    r = {"y": (0, 0, 0), "x": (0, math.radians(90), 0), "z": (math.radians(90), 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=depth, location=t2b(*pos), rotation=r)
    o = bpy.context.active_object
    o.name = name
    set_mat(o, mat)
    o.data.shade_smooth()
    if any(rot):
        o.rotation_euler = rot
    return link(o)


def plane_front(name, pos, w, h, mat):
    """Vertical plane facing the camera (-Y in Blender)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=t2b(*pos), rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.scale = (w, h, 1)
    set_mat(o, mat)
    return link(o)


def snow_cap(name, pos, scale):
    return sphere(name, pos, scale, SNOW, half=True)


def fin(name, pts, depth, mat, parent):
    """Flat fin from a 2D outline (x, z) extruded along Blender Y (= three.js z)."""
    bm = bmesh.new()
    verts = [bm.verts.new((x, 0, z)) for x, z in pts]
    bm.faces.new(verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new(name, mesh)
    SCENE_COLL.objects.link(o)
    sol = o.modifiers.new("Solid", "SOLIDIFY")
    sol.thickness = depth
    sol.offset = 0
    bev = o.modifiers.new("Bevel", "BEVEL")
    bev.width = depth * 0.45
    bev.segments = 4
    set_mat(o, mat)
    o.data.shade_smooth()
    o.parent = parent
    return o


BODY_C, BRX, BRY, BRZ = 0.1, 0.55, 0.45, 0.26


def on_body(x, z, side, lift=0.006):
    """Point on the fish body surface (three.js y=z here) for the given flat side."""
    kk = 1 - ((x - BODY_C) / BRX) ** 2 - (z / BRY) ** 2
    return -side * (BRZ * math.sqrt(max(kk, 0)) + lift)


def surface_curve(name, pts, depth, mat, parent, side):
    """Thin raised tube laid along (x, z) points on one flat side of the body."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = depth
    curve.bevel_resolution = 4
    sp = curve.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, (x, z) in zip(sp.points, pts):
        p.co = (x, on_body(x, z, side), z, 1)
    sp.use_endpoint_u = True
    sp.order_u = 3
    curve.materials.append(mat)
    co = bpy.data.objects.new(name, curve)
    SCENE_COLL.objects.link(co)
    co.parent = parent
    return co


def fish(name, pos, rot=(0, 0, 0), scale=1.0):
    """Puffy fish bread facing +X (three.js), flat side toward the camera.

    Mould detail on both flat sides: a gill curve behind the head, overlapping half-circle scales over the back
    two thirds of the body, and radial grooves on the tail and fins. Rim is a touch darker, like the baked edge.
    """
    root = bpy.data.objects.new(name, None)
    SCENE_COLL.objects.link(root)
    body = sphere(name + "_Body", (BODY_C, 0, 0), (BRX, BRY, BRZ), FISH, subsurf=2)
    body.parent = root
    tail_pts = [(-0.38, 0.05), (-0.66, 0.4), (-0.88, 0.33), (-0.8, 0), (-0.88, -0.33), (-0.66, -0.4), (-0.38, -0.05)]
    tail = fin(name + "_Tail", tail_pts, 0.16, FISH_FIN, root)
    dorsal = fin(name + "_Dorsal", [(-0.28, 0.33), (-0.14, 0.56), (0.0, 0.6), (0.12, 0.43)], 0.14, FISH_FIN, root)
    belly = fin(name + "_Belly", [(0.08, -0.4), (-0.04, -0.58), (-0.16, -0.56), (-0.24, -0.36)], 0.14, FISH_FIN, root)
    for side in (-1, 1):
        # gill: a curved line just behind the head
        surface_curve(f"{name}_Gill{side}", [(0.3, 0.3), (0.2, 0.12), (0.19, -0.08), (0.27, -0.28)], 0.013, FISH_SOFT, root, side)
        # scales: staggered rows of small arcs over the back two thirds
        # three staggered rows of big, soft scales; just the exposed lower rim of each one
        def inside(x, z, margin=0.07):
            """True when (x, z) sits well inside the body ellipse (margin keeps the tube clear of the rim)."""
            return ((x - BODY_C) / (BRX - margin)) ** 2 + (z / (BRY - margin)) ** 2 < 1.0

        for row, x0 in enumerate((0.04, -0.14, -0.32)):
            for k in range(-2, 3):
                z0 = k * 0.2 + (0.1 if row % 2 else 0)
                r = 0.1
                pts = [(x0 + r * math.cos(a), z0 + r * math.sin(a)) for a in (math.radians(v) for v in (125, 160, 195, 230, 265, 300, 335))]
                if not all(inside(x, z) for x, z in pts):
                    continue
                surface_curve(f"{name}_Scale{side}_{row}_{k}", pts, 0.011, FISH_SOFT, root, side)
        # tail and fin grooves
        for k, (z0, z1) in enumerate(((0.22, 0.3), (0.0, 0.0), (-0.22, -0.3))):
            curve = bpy.data.curves.new(f"{name}_TailGroove{side}{k}", "CURVE")
            curve.dimensions = "3D"
            curve.bevel_depth = 0.012
            curve.bevel_resolution = 3
            sp = curve.splines.new("POLY")
            sp.points.add(1)
            sp.points[0].co = (-0.46, -side * 0.085, z0 * 0.35, 1)
            sp.points[1].co = (-0.82, -side * 0.085, z1, 1)
            curve.materials.append(FISH_GROOVE)
            co = bpy.data.objects.new(curve.name, curve)
            SCENE_COLL.objects.link(co)
            co.parent = root
        for k in range(2):
            for fin_name, (x0, z0, x1, z1) in (("Dorsal", (-0.2 + k * 0.14, 0.4, -0.12 + k * 0.1, 0.56)), ("Belly", (-0.16 + k * 0.14, -0.42, -0.1 + k * 0.08, -0.56))):
                curve = bpy.data.curves.new(f"{name}_{fin_name}Groove{side}{k}", "CURVE")
                curve.dimensions = "3D"
                curve.bevel_depth = 0.01
                curve.bevel_resolution = 3
                sp = curve.splines.new("POLY")
                sp.points.add(1)
                sp.points[0].co = (x0, -side * 0.075, z0, 1)
                sp.points[1].co = (x1, -side * 0.075, z1, 1)
                curve.materials.append(FISH_GROOVE)
                co = bpy.data.objects.new(curve.name, curve)
                SCENE_COLL.objects.link(co)
                co.parent = root
        eye = sphere(f"{name}_Eye{side}", (0.4, 0.12, side * 0.235), (0.055, 0.055, 0.02), FISH_GROOVE)
        eye.parent = root
        pupil = sphere(f"{name}_Pupil{side}", (0.4, 0.12, side * 0.25), (0.025, 0.025, 0.012), FISH_DARK)
        pupil.parent = root
    for y in (0.02, -0.12):
        lip = sphere(f"{name}_Lip{y}", (0.66, y, 0), (0.07, 0.055, 0.1), FISH_FIN)
        lip.parent = root
    root.location = t2b(*pos)
    root.rotation_euler = rot
    root.scale = (scale, scale, scale)
    return root


# ---------- the cart (three.js coordinates) ----------
box("CartBody", (0, 0.8, 0), (2.6, 0.95, 1.2), RED, bevel=0.08)
box("CartSignPanel", (-0.45, 0.82, 0.62), (1.1, 0.46, 0.06), CREAM, bevel=0.03)
fish("CartSignFish", (-0.45, 0.82, 0.68), scale=0.28)
for x, mat in ((-0.2, CREAM), (0.2, CREAM)):
    box(f"Menu{x}", (0.95 + x, 0.86, 0.62), (0.26, 0.5, 0.04), mat, bevel=0.02)
box("Counter", (0, 1.3, 0), (2.75, 0.08, 1.35), STEEL, bevel=0.03)
for x in (-1.3, 1.3):
    for z in (-0.6, 0.6):
        cylinder(f"Post{x}{z}", (x, 1.95, z), 0.035, 1.3, STEEL)
for x in (-0.9, 0.9):
    cylinder(f"Wheel{x}", (x, 0.26, 0.62), 0.24, 0.14, WHEEL, axis="z")
    cylinder(f"Hub{x}", (x, 0.26, 0.7), 0.12, 0.02, RED_DEEP, axis="z")

# roof + signboard
box("Roof", (0, 2.62, 0), (3.0, 0.14, 1.7), RED, bevel=0.05)
box("RoofSnow", (0, 2.71, -0.05), (3.0, 0.12, 1.5), SNOW, bevel=0.05)
box("SignBoard", (0, 3.08, 0.86), (3.02, 1.0, 0.1), SIGN, bevel=0.04)
box("SignTop", (0, 3.58, 0.86), (3.02, 0.06, 0.12), SIGN_DEEP, bevel=0.02)
for i in range(7):
    x = -1.29 + i * 0.43
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.215, depth=0.1, location=t2b(x, 2.58, 0.86), rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object
    o.name = f"Scallop{i}"
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.001], context="VERTS")  # keep the hanging half
    bm.to_mesh(o.data)
    bm.free()
    set_mat(o, SIGN)
    o.data.shade_smooth()
    link(o)
fish("SignFish", (0.05, 3.33, 1.02), rot=(0, 0, 0.04), scale=1.0)
snow_cap("SignSnowL", (-0.9, 3.61, 0.86), (0.4, 0.1, 0.12))
snow_cap("SignSnowR", (1.1, 3.61, 0.86), (0.32, 0.08, 0.12))

# bulbs hanging under the sign
for x in (-1.0, -0.34, 0.34, 1.0):
    cylinder(f"BulbString{x}", (x, 2.44, 0.86), 0.008, 0.28, STRING)
    cylinder(f"BulbCap{x}", (x, 2.28, 0.86), 0.035, 0.05, DARK)
    sphere(f"Bulb{x}", (x, 2.18, 0.86), 0.075, BULB)

# glass case (front, sides, top) with steel frame
w, h, d = 2.5, 1.15, 1.25
cy = 1.34 + h / 2
cz = 0.05
box("GlassFront", (0, cy, cz + d / 2), (w, h, 0.02), GLASS, bevel=0)
for x in (-w / 2, w / 2):
    box(f"GlassSide{x}", (x, cy, cz), (0.02, h, d), GLASS, bevel=0)
box("GlassTop", (0, cy + h / 2, cz), (w, 0.02, d), GLASS, bevel=0)
for x in (-w / 2, w / 2):
    for z in (cz - d / 2, cz + d / 2):
        box(f"Frame{x}{z}", (x, cy, z), (0.05, h, 0.05), STEEL, bevel=0.01)
for yy in (cy - h / 2, cy + h / 2):
    box(f"FrameH{yy}", (0, yy, cz + d / 2), (w + 0.05, 0.05, 0.05), STEEL, bevel=0.01)

# mold + tray with fish
cylinder("Mold", (-0.6, 1.33, 0.1), 0.47, 0.14, DARK)
for i in range(4):
    a = i * math.pi / 2 + 0.4
    fish(f"MoldFish{i}", (-0.6 + math.cos(a) * 0.25, 1.42, 0.1 + math.sin(a) * 0.25), rot=(math.radians(-90), 0, -a), scale=0.2)
box("Tray", (0.7, 1.36, 0.1), (0.95, 0.1, 0.62), DARK, bevel=0.03)
for i, x in enumerate((-0.28, 0, 0.28)):
    fish(f"TrayFish{i}", (0.7 + x, 1.53, 0.1 + (0.08 if i == 1 else -0.08)), rot=(math.radians(-20), 0, i * 0.4 - 0.4), scale=0.26)

# grandma inside the case, waving
grandma_root.location = t2b(-0.15, 0.3, -0.45)
grandma_root.scale = (0.62, 0.62, 0.62)
arm_r = bpy.data.objects["PIVOT_ArmR"]
arm_r.rotation_euler = (0, 0, math.radians(-150))
arm_l = bpy.data.objects["PIVOT_ArmL"]
arm_l.rotation_euler = (0, 0, math.radians(8))
for name, on in (("EXPR_EyesOpen", False), ("EXPR_EyesHappy", True)):
    g = bpy.data.objects[name]
    for o in [g] + list(g.children_recursive):
        o.hide_render = not on
        o.hide_viewport = not on

# ground, snowdrifts, stools
bpy.ops.mesh.primitive_circle_add(vertices=96, radius=30, fill_type="NGON", location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "Ground"
set_mat(ground, GROUND)
link(ground)
for i, (x, z, r, hh) in enumerate(((-2.3, 1.2, 0.9, 0.16), (2.4, 1.0, 0.8, 0.14), (1.6, 2.1, 0.7, 0.12), (-1.4, 2.3, 0.6, 0.1),
                                   (2.8, -0.9, 0.9, 0.14), (-2.7, -0.8, 0.8, 0.12), (0.3, 2.6, 0.9, 0.12),
                                   (-1.6, 3.6, 1.3, 0.18), (1.9, 3.9, 1.1, 0.16), (0.2, 4.6, 1.5, 0.2), (-3.4, 2.4, 1.0, 0.14), (3.6, 2.2, 1.1, 0.15))):
    snow_cap(f"Drift{i}", (x, 0, z), (r, hh, r * 0.8))
for i, (x, z) in enumerate(((1.9, 1.3), (2.55, 0.6))):
    cylinder(f"StoolSeat{i}", (x, 0.4, z), 0.21, 0.08, RED)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        cylinder(f"StoolLeg{i}{k}", (x + math.cos(a) * 0.15, 0.2, z + math.sin(a) * 0.15), 0.028, 0.4, RED_DEEP)
    snow_cap(f"StoolSnow{i}", (x + 0.08, 0.44, z - 0.04), (0.1, 0.03, 0.08))

# town behind, lantern string, street lamp
for i, (x, hw, hh, hd) in enumerate(((-6.2, 2.0, 2.6, 2.2), (-3.6, 2.6, 3.4, 2.4), (-0.9, 2.2, 2.9, 2.0), (1.6, 2.8, 3.6, 2.3), (4.4, 2.2, 3.0, 2.1), (6.9, 2.5, 2.6, 2.2))):
    zpos = -8.5
    box(f"House{i}", (x, hh / 2, zpos), (hw, hh, hd), WALLS[i % len(WALLS)], bevel=0.04)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=hw * 0.78, depth=0.9, location=t2b(x, hh + 0.45, zpos), rotation=(0, 0, math.radians(45)))
    roof = bpy.context.active_object
    roof.name = f"HouseRoof{i}"
    set_mat(roof, ROOF)
    link(roof)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=hw * 0.72, depth=0.5, location=t2b(x, hh + 0.56, zpos), rotation=(0, 0, math.radians(45)))
    rs = bpy.context.active_object
    rs.name = f"HouseRoofSnow{i}"
    set_mat(rs, SNOW)
    link(rs)
    box(f"HouseEave{i}", (x, hh + 0.02, zpos), (hw + 0.2, 0.14, hd + 0.2), SNOW, bevel=0.05)
    cols = max(2, round(hw / 0.9))
    rows = max(1, round((hh - 0.8) / 1.0))
    for r in range(rows):
        for c in range(cols):
            on = (r * 3 + c + i) % 4 != 0
            plane_front(f"Win{i}_{r}_{c}", (x - hw / 2 + (c + 0.5) * (hw / cols), 0.7 + r * 1.0, zpos + hd / 2 + 0.01), 0.34, 0.44, WINDOW_ON if on else WINDOW_OFF)

pts = []
n = 9
for i in range(n + 1):
    t = i / n
    pts.append((-5.2 + t * 10.4, 5.0 - math.sin(t * math.pi) * 0.7, -4.5))
curve = bpy.data.curves.new("LanternWire", "CURVE")
curve.dimensions = "3D"
curve.bevel_depth = 0.012
sp = curve.splines.new("POLY")
sp.points.add(len(pts) - 1)
for p, (x, y, z) in zip(sp.points, pts):
    p.co = (*t2b(x, y, z), 1)
curve.materials.append(STRING)
wire = bpy.data.objects.new("LanternWire", curve)
SCENE_COLL.objects.link(wire)
for i, (x, y, z) in enumerate(pts[1:-1]):
    sphere(f"Lantern{i}", (x, y - 0.22, z), 0.16, LANTERN_B if i % 2 else LANTERN_A)
    cylinder(f"LanternCap{i}", (x, y - 0.06, z), 0.07, 0.06, RED_DEEP)
cylinder("LampPole", (3.6, 1.9, -2.6), 0.06, 3.8, POLE)
sphere("LampHead", (3.6, 3.95, -2.6), 0.22, BULB)
snow_cap("LampSnow", (3.6, 4.12, -2.6), (0.26, 0.1, 0.26))

# ---------- lights, world, camera, render ----------
scene = bpy.context.scene
world = bpy.data.worlds.new("Night")
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = srgb("#1E2650")
bg.inputs[1].default_value = 0.15
scene.world = world


def area(name, pos, energy, size, color="#FFFFFF", target=(0, 1.3, 0)):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.size = size
    light.color = srgb(color)[:3]
    o = bpy.data.objects.new(name, light)
    o.location = t2b(*pos)
    o.rotation_euler = (t2b(*target) - o.location).to_track_quat("-Z", "Y").to_euler()
    SCENE_COLL.objects.link(o)
    return o


def point(name, pos, energy, color, radius=0.3):
    light = bpy.data.lights.new(name, "POINT")
    light.energy = energy
    light.color = srgb(color)[:3]
    light.shadow_soft_size = radius
    o = bpy.data.objects.new(name, light)
    o.location = t2b(*pos)
    SCENE_COLL.objects.link(o)
    return o


area("Moon", (-4, 8, 5), 220, 6, "#BFD0FF")
area("Fill", (5, 4, 7), 70, 6, "#8FA0E0")
point("CartWarm", (0, 2.45, 0.55), 55, "#FFB85C", 0.9)
point("CartFront", (0, 1.0, 1.8), 50, "#FF9A45", 0.4)
point("CartBack", (-0.2, 2.5, -1.6), 6, "#FFC27A", 1.2)
point("TownWarm", (0, 2.2, -7), 150, "#FFB85C", 0.8)
point("LampLight", (3.6, 3.9, -2.6), 80, "#FFC27A", 0.3)
point("SignFill", (0.4, 4.3, 3.2), 45, "#FFD9A8", 1.0)

cam_data = bpy.data.cameras.new("Cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(40)
cam = bpy.data.objects.new("Cam", cam_data)
SCENE_COLL.objects.link(cam)
if len(args) > 3 and args[3] == "closeup":
    cam.location = t2b(0.3, 3.4, 4.6)
    cam.rotation_euler = (t2b(0.05, 3.3, 1.0) - cam.location).to_track_quat("-Z", "Y").to_euler()
else:
    cam.location = t2b(0, 3.6, 12.2)
    cam.rotation_euler = (t2b(0, 1.55, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons.get("cycles")
if prefs:
    try:
        prefs.preferences.compute_device_type = "METAL"
        prefs.preferences.get_devices()
        for dev in prefs.preferences.devices:
            dev.use = True
        scene.cycles.device = "GPU"
    except Exception as exc:  # noqa: BLE001 - fall back to CPU
        print("GPU unavailable:", exc)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.render.resolution_x = int(1125 * RES_SCALE)
scene.render.resolution_y = int(2200 * RES_SCALE)
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
scene.view_settings.look = "AgX - Medium High Contrast" if scene.view_settings.view_transform == "AgX" else "None"
scene.view_settings.exposure = 0.0
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
