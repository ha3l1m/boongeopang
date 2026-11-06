"""Splash variant 2: 할매 hugging an armful of big fish breads, studio clay shot on a plain backdrop.

Run:  blender -b --factory-startup --python tools/blender/render_hug.py -- <out.png> [samples] [scale]

Reuses the character, materials and fish-bread builder from render_login.py (everything above its cart section),
so both splash variants share one fish bread and one 할매. Output is a transparent PNG with a shadow catcher;
the page paints the backdrop colour behind it.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else "login-hug.png"
SAMPLES = int(args[1]) if len(args) > 1 else 256
RES_SCALE = float(args[2]) if len(args) > 2 else 1.0

# ---------- shared kit: 할매 + materials + fish() from the street render ----------
kit_src = (HERE / "render_login.py").read_text().split("# ---------- the cart (three.js coordinates) ----------")[0]
kit = {"__name__": "kit", "__file__": str(HERE / "render_login.py")}
exec(compile(kit_src, str(HERE / "render_login.py"), "exec"), kit)
fish = kit["fish"]
srgb = kit["srgb"]
t2b = kit["t2b"]
SCENE_COLL = kit["SCENE_COLL"]
grandma_root = kit["grandma_root"]

# ---------- pose: arms wrapped around the bundle, happy face ----------
grandma_root.location = (0, 0, 0)
grandma_root.scale = (1, 1, 1)
arm_l = bpy.data.objects["PIVOT_ArmL"]
arm_r = bpy.data.objects["PIVOT_ArmR"]
arm_l.rotation_euler = (math.radians(-74), 0, math.radians(36))
arm_r.rotation_euler = (math.radians(-74), 0, math.radians(-36))
head = bpy.data.objects["PIVOT_Head"]
head.rotation_euler = (math.radians(4), 0, math.radians(-6))
for name, on in (("EXPR_EyesOpen", False), ("EXPR_EyesHappy", True), ("EXPR_MouthSmile", False), ("EXPR_MouthLaugh", True)):
    group = bpy.data.objects[name]
    for o in [group] + list(group.children_recursive):
        o.hide_render = not on
        o.hide_viewport = not on

# ---------- three big fish breads standing up in her arms (three.js coords: y up, z toward camera) ----------
fish("HugFishL", (-0.3, 1.24, 0.42), rot=(math.radians(6), math.radians(-64), math.radians(-6)), scale=0.66)
fish("HugFishR", (0.32, 1.26, 0.4), rot=(math.radians(-6), math.radians(-114), math.radians(8)), scale=0.66)
fish("HugFishC", (0.0, 1.18, 0.55), rot=(0, math.radians(-88), 0), scale=0.72)

# ---------- floor that only catches shadow ----------
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "ShadowCatcher"
floor.is_shadow_catcher = True
kit["link"](floor)

# ---------- studio light ----------
scene = bpy.context.scene
world = bpy.data.worlds.new("Studio")
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = srgb("#FFF3E6")
bg.inputs[1].default_value = 0.55
scene.world = world


def area(name, pos, energy, size, color="#FFFFFF", target=(0, 1.8, 0)):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.size = size
    light.color = srgb(color)[:3]
    o = bpy.data.objects.new(name, light)
    o.location = t2b(*pos)
    o.rotation_euler = (t2b(*target) - o.location).to_track_quat("-Z", "Y").to_euler()
    SCENE_COLL.objects.link(o)


area("Key", (-4, 6, 6), 900, 6, "#FFF1DE")
area("Fill", (5, 3, 6), 300, 7, "#E8EEFF")
area("Rim", (2, 5, -5), 450, 4, "#FFE0B8")

cam_data = bpy.data.cameras.new("Cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(27)
cam = bpy.data.objects.new("Cam", cam_data)
SCENE_COLL.objects.link(cam)
cam.location = t2b(0.6, 2.4, 9.0)
cam.rotation_euler = (t2b(0, 1.75, 0) - cam.location).to_track_quat("-Z", "Y").to_euler()
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
scene.view_settings.exposure = -0.2
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
