"""Splash variant 3: a plush puppy chef hugging a kraft paper bag full of fish breads, one popping out.

Run:  blender -b --factory-startup --python tools/blender/render_pup.py -- <out.png> [samples] [scale]

An original character (beige plush puppy, floppy brown ears, chef hat, white apron). Fish breads, clay materials
and helpers come from render_login.py (everything above its cart section); 할매 is loaded there too but hidden here.
Output: transparent PNG with a shadow catcher; the page paints the backdrop.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else "login-pup.png"
SAMPLES = int(args[1]) if len(args) > 1 else 256
RES_SCALE = float(args[2]) if len(args) > 2 else 1.0

kit_src = (HERE / "render_login.py").read_text().split("# ---------- the cart (three.js coordinates) ----------")[0]
kit = {"__name__": "kit", "__file__": str(HERE / "render_login.py")}
exec(compile(kit_src, str(HERE / "render_login.py"), "exec"), kit)
fish = kit["fish"]
srgb = kit["srgb"]
t2b = kit["t2b"]
clay_material = kit["clay_material"]
SCENE_COLL = kit["SCENE_COLL"]
bpy.data.collections["HALMAE_V3"].hide_render = True
bpy.data.collections["HALMAE_V3"].hide_viewport = True


# ---------- materials: felted wool, knit cotton, hand-pressed clay ----------

def _tree(mat):
    nodes = mat.node_tree.nodes
    return nodes, mat.node_tree.links, next(n for n in nodes if n.type == "BSDF_PRINCIPLED")


def _noise_bump(nodes, links, scale, strength, distance, detail=8.0, distortion=0.0, normal_in=None):
    coord = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    if "Distortion" in noise.inputs:
        noise.inputs["Distortion"].default_value = distortion
    links.new(coord.outputs["Object"], noise.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    if normal_in is not None:
        links.new(normal_in, bump.inputs["Normal"])
    return bump


def felt(name, hex_color, sheen_hex="#FFFFFF"):
    """Needle-felted wool: matte, velvety rim sheen, fine fibre relief over soft hand-made lumps, faint glints."""
    mat = clay_material(name, hex_color, 1.0, sss=0.18)
    nodes, links, bsdf = _tree(mat)
    bsdf.inputs["Sheen Weight"].default_value = 1.0
    bsdf.inputs["Sheen Roughness"].default_value = 0.35
    bsdf.inputs["Sheen Tint"].default_value = srgb(sheen_hex)
    lumps = _noise_bump(nodes, links, 6.0, 0.45, 0.08, detail=3.0)
    fuzz = _noise_bump(nodes, links, 90.0, 0.9, 0.03, detail=12.0, distortion=5.0, normal_in=lumps.outputs["Normal"])
    fibres = _noise_bump(nodes, links, 300.0, 0.8, 0.012, detail=14.0, distortion=3.0, normal_in=fuzz.outputs["Normal"])
    links.new(fibres.outputs["Normal"], bsdf.inputs["Normal"])
    # sparse glints, like stray fibres catching the light
    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 380.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
    ramp.color_ramp.elements[1].position = 0.08
    ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
    links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
    bsdf.inputs["Coat Roughness"].default_value = 0.2
    mul = nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 0.8
    links.new(ramp.outputs["Color"], mul.inputs[0])
    links.new(mul.outputs["Value"], bsdf.inputs["Coat Weight"])
    return mat


def knit(name, hex_color):
    """Knit cotton: vertical rib bands plus the felt fibres."""
    mat = felt(name, hex_color)
    nodes, links, bsdf = _tree(mat)
    fibres = bsdf.inputs["Normal"].links[0].from_node
    coord = nodes.new("ShaderNodeTexCoord")
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 28.0
    wave.inputs["Distortion"].default_value = 1.2
    links.new(coord.outputs["Object"], wave.inputs["Vector"])
    rib = nodes.new("ShaderNodeBump")
    rib.inputs["Strength"].default_value = 0.35
    rib.inputs["Distance"].default_value = 0.02
    links.new(wave.outputs["Fac"], rib.inputs["Height"])
    links.new(fibres.outputs["Normal"], rib.inputs["Normal"])
    links.new(rib.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def clay(name, hex_color, roughness=0.72):
    """Smooth hand-pressed clay: soft sheen, faint finger texture (the big crumples are real geometry)."""
    mat = clay_material(name, hex_color, roughness, sss=0.08)
    nodes, links, bsdf = _tree(mat)
    links.new(_noise_bump(nodes, links, 90.0, 0.06, 0.01, detail=4.0).outputs["Normal"], bsdf.inputs["Normal"])
    return mat


PLUSH = felt("PupPlush", "#F5D3A0", "#FFE9C8")
PLUSH_LIGHT = felt("PupMuzzle", "#FFF1DA", "#FFF6E8")
EAR = felt("PupEar", "#A0603A", "#F0C9A6")
NOSE = clay_material("PupNose", "#3B2A24", 0.25)
EYE = clay_material("PupEye", "#1F1714", 0.12)
SHINE = clay_material("PupShine", "#FFFFFF", 0.3)
BLUSH = felt("PupBlush", "#F2A49A")
COTTON = knit("ChefCotton", "#FBF7EF")
KRAFT = clay("Kraft", "#E2A55B")
KRAFT_IN = clay("KraftInside", "#B97A3A", 0.85)
STITCH = clay("Stitch", "#C5481A")

# hand-made unevenness: real displacement on the soft parts (object scale, strength)
LUMPY = {PLUSH.name: (2.6, 0.12), PLUSH_LIGHT.name: (2.6, 0.1), EAR.name: (3.0, 0.08), COTTON.name: (2.4, 0.06),
         KRAFT.name: (1.5, 0.2)}


# ---------- helpers (three.js coordinates in, Blender objects out) ----------

def link(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    SCENE_COLL.objects.link(obj)
    return obj


def finish(obj, mat, subsurf=2):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj.data.shade_smooth()
    lumpy = LUMPY.get(mat.name)
    if subsurf:
        m = obj.modifiers.new("Subsurf", "SUBSURF")
        m.levels = subsurf
        m.render_levels = subsurf + (1 if lumpy else 0)
    if lumpy:
        scale, strength = lumpy
        tex = bpy.data.textures.new(obj.name + "_Lumps", "CLOUDS")
        tex.noise_scale = 1.0 / scale
        tex.noise_depth = 2
        d = obj.modifiers.new("Lumps", "DISPLACE")
        d.texture = tex
        d.texture_coords = "GLOBAL"
        d.strength = strength
        d.mid_level = 0.5
        if mat.name == KRAFT.name:  # paper: add sharper small creases on top of the big folds
            crease = bpy.data.textures.new(obj.name + "_Creases", "CLOUDS")
            crease.noise_scale = 0.18
            crease.noise_type = "HARD_NOISE"
            crease.noise_depth = 1
            c = obj.modifiers.new("Creases", "DISPLACE")
            c.texture = crease
            c.texture_coords = "GLOBAL"
            c.strength = 0.03
            c.mid_level = 0.5
    return link(obj)


def blob(name, pos, scale, mat, rot=(0, 0, 0), subsurf=2):
    """Ellipsoid; scale is (x, y-up, z-toward-camera) in three.js terms."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=1, location=t2b(*pos), rotation=rot)
    o = bpy.context.active_object
    o.name = name
    sx, sy, sz = scale if isinstance(scale, tuple) else (scale, scale, scale)
    o.scale = (sx, sz, sy)
    return finish(o, mat, subsurf)


def limb(name, a, b, radius, mat):
    """Soft sausage from point a to point b (three.js coords)."""
    pa, pb = t2b(*a), t2b(*b)
    d = pb - pa
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=1, location=(pa + pb) / 2)
    o = bpy.context.active_object
    o.name = name
    o.scale = (radius, d.length / 2 + radius * 0.6, radius)
    o.rotation_euler = d.to_track_quat("Y", "Z").to_euler()
    return finish(o, mat)


def rounded_box(name, pos, size, mat, bevel=0.12):
    bpy.ops.mesh.primitive_cube_add(size=1, location=t2b(*pos))
    o = bpy.context.active_object
    o.name = name
    w, h, d = size
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat.name in LUMPY:  # enough geometry for the crumple displacement to bite
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=18, use_grid_fill=True)
        bm.to_mesh(o.data)
        bm.free()
    m = o.modifiers.new("Bevel", "BEVEL")
    m.width = bevel
    m.segments = 6
    return finish(o, mat, subsurf=1)


def keep(obj, test):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not test(v.co)], context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()


def arc(name, center, radius, a0, a1, depth, mat):
    """Thin tube arc in the face plane (three.js x/y), at depth z."""
    cx, cy, cz = center
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = depth
    curve.bevel_resolution = 4
    sp = curve.splines.new("POLY")
    steps = 14
    sp.points.add(steps)
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        sp.points[i].co = (*t2b(cx + radius * math.cos(a), cy + radius * math.sin(a), cz), 1)
    curve.materials.append(mat)
    o = bpy.data.objects.new(name, curve)
    SCENE_COLL.objects.link(o)
    return o


# ---------- puppy chef (three.js coords; total height ~3.3) ----------
for side in (-1, 1):
    blob(f"Leg{side}", (side * 0.32, 0.28, 0.05), (0.26, 0.3, 0.26), PLUSH)
    blob(f"Foot{side}", (side * 0.34, 0.12, 0.2), (0.27, 0.13, 0.32), PLUSH_LIGHT)
body = blob("Body", (0, 1.1, 0), (0.74, 0.84, 0.62), PLUSH)

apron = blob("Apron", (0, 1.06, 0.02), (0.78, 0.86, 0.66), COTTON, subsurf=0)
keep(apron, lambda c: c.y < -0.35 and c.z < 0.62)
apron.modifiers.new("Thick", "SOLIDIFY").thickness = 0.03
m = apron.modifiers.new("Subsurf", "SUBSURF")
m.levels = m.render_levels = 2
bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.035, location=t2b(0, 1.72, 0))
neck = bpy.context.active_object
neck.name = "ApronNeck"
finish(neck, COTTON, subsurf=1)

head = blob("Head", (0, 2.18, 0.05), (0.64, 0.56, 0.56), PLUSH)
blob("Muzzle", (0, 2.02, 0.5), (0.3, 0.22, 0.2), PLUSH_LIGHT)
blob("Nose", (0, 2.1, 0.69), (0.09, 0.07, 0.06), NOSE)
arc("Smile", (0, 1.97, 0.68), 0.07, math.radians(200), math.radians(340), 0.012, NOSE)
for side in (-1, 1):
    blob(f"Eye{side}", (side * 0.22, 2.3, 0.575), (0.055, 0.066, 0.03), EYE)
    blob(f"EyeShine{side}", (side * 0.22 + 0.018, 2.325, 0.6), 0.016, SHINE, subsurf=1)
    blob(f"Blush{side}", (side * 0.4, 2.08, 0.42), (0.1, 0.06, 0.03), BLUSH)
    blob(f"Ear{side}", (side * 0.66, 1.98, 0.12), (0.17, 0.42, 0.1), EAR, rot=(0, math.radians(side * -16), 0))

# chef hat: cotton band plus a puffy top
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.44, depth=0.26, location=t2b(0, 2.66, 0.02))
band = bpy.context.active_object
band.name = "HatBand"
bev = band.modifiers.new("Bevel", "BEVEL")
bev.width = 0.06
bev.segments = 4
finish(band, COTTON, subsurf=1)
for i, (x, y, z, r) in enumerate(((0, 3.02, 0.02, 0.36), (-0.3, 2.94, 0.05, 0.27), (0.3, 2.94, 0.05, 0.27),
                                   (0, 2.94, 0.3, 0.26), (0, 2.96, -0.26, 0.26), (-0.16, 3.14, 0.14, 0.22), (0.16, 3.14, -0.06, 0.22))):
    blob(f"HatPuff{i}", (x, y, z), r, COTTON)

# ---------- kraft bag hugged to the chest, full of fish breads ----------
BAG = (0, 0.86, 0.78)
rounded_box("Bag", BAG, (0.9, 0.74, 0.58), KRAFT, bevel=0.13)
# rolled-over lip: a fat torus squashed to the bag's footprint
bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=0.15, major_segments=64, minor_segments=18,
                                 location=t2b(BAG[0], BAG[1] + 0.38, BAG[2]))
rim = bpy.context.active_object
rim.name = "BagRim"
rim.scale = (0.47, 0.31, 0.62)
finish(rim, KRAFT, subsurf=1)
bpy.ops.mesh.primitive_plane_add(size=1, location=t2b(BAG[0], BAG[1] + 0.42, BAG[2]))
inside = bpy.context.active_object
inside.name = "BagInside"
inside.scale = (0.84, 0.52, 1)
inside.data.materials.append(KRAFT_IN)
link(inside)
blob("BagFishStamp", (0.0, 0.8, BAG[2] + 0.31), (0.12, 0.085, 0.02), STITCH)
blob("BagFishStampTail", (0.14, 0.8, BAG[2] + 0.31), (0.05, 0.065, 0.02), STITCH)

fish("BagFishL", (-0.24, 1.42, BAG[2] - 0.08), rot=(math.radians(8), math.radians(-70), math.radians(-6)), scale=0.38)
fish("BagFishC", (0.02, 1.48, BAG[2] + 0.06), rot=(0, math.radians(-92), 0), scale=0.4)
fish("BagFishR", (0.27, 1.42, BAG[2] - 0.04), rot=(math.radians(-6), math.radians(-112), math.radians(6)), scale=0.38)
fish("PopFish", (1.1, 2.62, 0.9), rot=(math.radians(-8), math.radians(-30), math.radians(-14)), scale=0.4)

# arms reaching round the bag, paws on its front corners
for side in (-1, 1):
    limb(f"Arm{side}", (side * 0.64, 1.45, 0.1), (side * 0.47, 0.98, 1.0), 0.15, PLUSH)
    blob(f"Paw{side}", (side * 0.44, 0.94, 1.1), (0.15, 0.14, 0.12), PLUSH_LIGHT)

# ---------- floor, light, camera ----------
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "ShadowCatcher"
floor.is_shadow_catcher = True
link(floor)

scene = bpy.context.scene
world = bpy.data.worlds.new("Studio")
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = srgb("#FFF4DC")
bg.inputs[1].default_value = 0.55
scene.world = world


def area(name, pos, energy, size, color="#FFFFFF", target=(0, 1.7, 0)):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.size = size
    light.color = srgb(color)[:3]
    o = bpy.data.objects.new(name, light)
    o.location = t2b(*pos)
    o.rotation_euler = (t2b(*target) - o.location).to_track_quat("-Z", "Y").to_euler()
    SCENE_COLL.objects.link(o)


area("Key", (-4, 6, 6), 900, 6, "#FFF1DE")
area("Fill", (5, 3, 6), 320, 7, "#EEF1FF")
area("Rim", (2, 5, -5), 500, 4, "#FFE0B8")

cam_data = bpy.data.cameras.new("Cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(27)
cam = bpy.data.objects.new("Cam", cam_data)
SCENE_COLL.objects.link(cam)
if len(args) > 3 and args[3] == "closeup":
    cam.location = t2b(0.5, 2.0, 4.6)
    cam.rotation_euler = (t2b(0.05, 1.6, 0.4) - cam.location).to_track_quat("-Z", "Y").to_euler()
else:
    cam.location = t2b(0.9, 2.3, 9.2)
    cam.rotation_euler = (t2b(0.12, 1.65, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
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
scene.render.resolution_x = int(1125 * RES_SCALE)
scene.render.resolution_y = int(1400 * RES_SCALE)
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
transforms = [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items]
scene.view_settings.view_transform = "AgX" if "AgX" in transforms else "Filmic"
scene.view_settings.exposure = 0.1
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
