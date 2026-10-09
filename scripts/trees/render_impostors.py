# Renders Poly Haven trees (CC0) from 8 directions for tree impostors in the woods.
# Run: blender --background <tree>.blend --python render_impostors.py -- <hdr> <outDir> <object> [<object> ...]
# Each object gives <outDir>/<object>_<k>.png for k = 0..7, looking from azimuth k * 45 degrees,
# with a transparent background and the scene's own sky as lighting.
import bpy, sys, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
hdr, out, names = argv[0], argv[1], argv[2:]
os.makedirs(out, exist_ok=True)
W, H = 320, 768  # one frame, tall for a tree

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
    height = (hi.z - lo.z) * 1.03
    cam_data.ortho_scale = height  # the frame's long side is its height
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
