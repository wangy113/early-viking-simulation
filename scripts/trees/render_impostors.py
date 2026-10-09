# Renders Poly Haven trees (CC0) from 8 directions for tree impostors in the woods.
# Run: blender --background <tree>.blend --python render_impostors.py -- <hdr> <outDir> <object> [<object> ...]
# Each object gives <outDir>/<object>_<k>.png for k = 0..7, looking from azimuth k * 45 degrees,
# with a transparent background and the scene's own sky as lighting.
# FRAME=WxH sets the frame size in pixels (default 320x768, tall for a tree). A square frame
# suits low, wide plants such as ferns.
import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
hdr, out, names = argv[0], argv[1], argv[2:]
os.makedirs(out, exist_ok=True)
W, H = (int(v) for v in os.environ.get("FRAME", "320x768").split("x"))

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"

# the scene's sky as the only light
world = bpy.data.worlds.new("sky")
world.use_nodes = True
nt = world.node_tree
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(hdr)
nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
scene.world = world

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

for o in bpy.data.objects:
    if o.type in ("MESH", "CURVE"):
        o.hide_render = True

for name in names:
    tree = bpy.data.objects[name]
    tree.hide_render = False
    corners = [tree.matrix_world @ Vector(c) for c in tree.bound_box]
    lo = Vector([min(c[i] for c in corners) for i in range(3)])
    hi = Vector([max(c[i] for c in corners) for i in range(3)])
    # the trunk base sits at the bottom middle of the frame
    base = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    # a tall frame fits the tree's height. A square frame also fits a low plant's widest spread.
    spread = max((Vector((c.x, c.y, 0)) - Vector((base.x, base.y, 0))).length for c in corners) * 2
    height = max(hi.z - lo.z, spread * H / W if W >= H else 0) * 1.03
    cam_data.ortho_scale = height * max(1, W / H)  # ortho scale spans the frame's long side
    for k in range(8):
        a = k * math.pi / 4
        d = Vector((math.sin(a), -math.cos(a), 0))
        cam.location = base + Vector((0, 0, height / 2)) + d * 60
        cam.rotation_euler = (math.pi / 2, 0, a)
        scene.render.filepath = os.path.join(out, f"{name}_{k}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", name, k)
    # keep the height and width in meters, for sizing the impostor
    with open(os.path.join(out, f"{name}.txt"), "w") as f:
        f.write(f"{height:.3f} {height * W / H:.3f}\n")
    tree.hide_render = True
