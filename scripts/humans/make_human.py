# Builds one MakeHuman figure with MPFB in headless Blender, dresses it in Viking clothing
# made from the body itself, and exports a skinned glTF.
# Run: blender --background --python make_human.py -- <spec.json> <out.glb>
#
# Garments are built in two ways:
# - shells: a copy of the body surface in one region (torso and arms, legs, feet), pushed out
#   along the normals. They keep the body's skin weights, so they move exactly with it.
# - rings: flared tubes for skirts, fitted around the body's outline. Their weights blend
#   from the pelvis at the top to the thighs at the hem, so a step pulls the cloth along.
# The body faces hidden under clothing are deleted, so skin never pokes through.
import bpy, bmesh, sys, json, os, math
from mathutils import Vector
from bl_ext.user_default.mpfb.services.humanservice import HumanService

argv = sys.argv[sys.argv.index("--") + 1:]
spec = json.load(open(argv[0]))
out = argv[1]

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

info = HumanService._create_default_human_info_dict()
info.update(spec["info"])
settings = HumanService.get_default_deserialization_settings()
settings.update({"subdiv_levels": 0, "mask_helpers": True, "detailed_helpers": True, "extra_vertex_groups": True, "load_clothes": True})
basemesh = HumanService.deserialize_from_dict(info, settings)

rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = next(o for o in bpy.data.objects if o.type == "MESH" and o.name != basemesh.name and info["proxy"].split(".")[0] in o.name)

# MPFB delete groups under beards and hair would cut holes in the face. The body is trimmed below instead.
for o in bpy.data.objects:
    for m in list(o.modifiers):
        if m.type == "MASK" and m.name.startswith("Delete."):
            o.modifiers.remove(m)

bpy.context.view_layer.update()
# ---------------- body analysis ----------------
mw = body.matrix_world
names = [g.name for g in body.vertex_groups]
def bone_pos(name, tail=False):
    b = rig.data.bones[name]
    return rig.matrix_world @ (b.tail_local if tail else b.head_local)

BONES = set(b.name for b in rig.data.bones)
def dominant(v):
    best, bw = None, 0.0
    for g in v.groups:
        if names[g.group] in BONES and g.weight > bw:
            best, bw = names[g.group], g.weight
    return best

verts = body.data.vertices
WPOS = [mw @ v.co for v in verts]
DOM = [dominant(v) for v in verts]
Z = lambda name, tail=False: bone_pos(name, tail).z

hipZ = Z("pelvis", True)                     # top of the pelvis bone, about the navel
beltZ = hipZ - 0.02
kneeZ = Z("calf_l")
ankleZ = Z("foot_l")
neckZ = Z("neck_01")
armpitZ = Z("upperarm_l") - 0.09
print("DBG", rig.location, rig.delta_location, rig.scale, rig.rotation_euler, rig.matrix_world.to_scale(), (rig.matrix_world @ rig.pose.bones["foot_l"].head), rig.data.bones["foot_l"].head_local, rig.matrix_basis.translation, [round(x,3) for x in rig.matrix_world.col[3]])
exec(open("/opt/tools/out/dbg.py").read()) if spec.get("dbg") else None
print("LEVELS hip %.3f knee %.3f ankle %.3f neck %.3f" % (hipZ, kneeZ, ankleZ, neckZ))

ARM = {"clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"}
TORSO = {"spine_01", "spine_02", "spine_03"}
LEG = {"thigh_l", "thigh_r", "calf_l", "calf_r"}
FOOT = {"foot_l", "foot_r", "ball_l", "ball_r"}

# ---------------- helpers ----------------
def new_object(name, me):
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for n in names:
        o.vertex_groups.new(name=n)
    o.parent = rig
    o.matrix_world = mw.copy()
    mod = o.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    return o

def shell(name, keep, offset, offset_fn=None, smooth=0, flat_sole=False, cut=None, edge_smooth=8, hem=0.008):
    """Copy of the body faces whose vertices all pass keep(i), smoothed to lose body detail
    such as toes and muscles, then pushed out along the normals."""
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    ok = [keep(i) for i in range(len(bm.verts))]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(ok[v.index] for v in f.verts)], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    orig = {v: v.co.copy() for v in bm.verts}
    inner = [v for v in bm.verts if not v.is_boundary]
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # smooth the cut edges, which follow the body's quads in steps
    edge = [v for v in bm.verts if v.is_boundary]
    for _ in range(edge_smooth):
        new = {}
        for v in edge:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                new[v] = v.co * 0.4 + (nb[0].co + nb[1].co) * 0.3
        for v, co in new.items():
            v.co = co
    bm.normal_update()
    for v in bm.verts:
        d = offset_fn(mw @ orig[v], offset) if offset_fn else offset
        v.co += v.normal * d
        if flat_sole and v.co.z < 0.012:
            v.co.z = 0.004
    # turn the cut edges inward, so the cloth shows a thickness instead of a paper edge
    if hem:
        ret = bmesh.ops.extrude_edge_only(bm, edges=[e for e in bm.edges if e.is_boundary])
        for v in (g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)):
            n = sum((f.normal for f in v.link_faces), Vector()) if v.link_faces else Vector()
            src = [e.other_vert(v) for e in v.link_edges if e.other_vert(v) not in ret["geom"]]
            nn = src[0].normal if src else Vector((0, 0, 1))
            v.co -= nn * hem
    for f in bm.faces:
        f.smooth = True
    # the body UVs are scaled to the skin texture. Rescale them to about one unit per meter,
    # so all cloth shares one texture scale.
    uvl = bm.loops.layers.uv.active
    if uvl:
        L3 = L2 = 0.0
        for f in bm.faces:
            for l in f.loops:
                n = l.link_loop_next
                L3 += (l.vert.co - n.vert.co).length
                L2 += (l[uvl].uv - n[uvl].uv).length
        k = L3 / max(L2, 1e-9)
        for f in bm.faces:
            for l in f.loops:
                l[uvl].uv = l[uvl].uv * k
    if cut:
        for v in bm.verts:
            if v.is_boundary:
                p = mw @ v.co
                zc = cut(p)
                if abs(p.z - zc) < 0.03:
                    v.co.z = (mw.inverted() @ Vector((p.x, p.y, zc))).z
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return new_object(name, me)

def envelope(z0, z1, cx, cy, bins=36, exclude=ARM | {"hand_l", "hand_r"}):
    if z1 > envelope.arm_above:
        exclude = exclude - {"upperarm_l", "upperarm_r", "clavicle_l", "clavicle_r"}
    """Largest radius of the body in each direction around (cx, cy), for z0 <= z < z1."""
    r = [0.0] * bins
    for i, p in enumerate(WPOS):
        if z0 <= p.z < z1 and DOM[i] not in exclude and not (DOM[i] or "").startswith(("index", "middle", "ring", "pinky", "thumb")):
            a = math.atan2(p.y - cy, p.x - cx)
            k = int(((a + math.pi) / (2 * math.pi)) * bins) % bins
            r[k] = max(r[k], math.hypot(p.x - cx, p.y - cy))
    # fill gaps and smooth, keeping the outline convex enough to hang like cloth
    for _ in range(3):
        r = [max(r[k], 0.5 * (r[k - 1] + r[(k + 1) % bins])) for k in range(bins)]
    return r

envelope.arm_above = 99.0

def ring_skirt(name, top, hem, margin, flare, weights, bins=48, rows=None, pleats=0.0, span=None):
    """Flared tube from z=top down to z=hem. weights(t, x, y) gives [(bone, w)]."""
    cx = 0.0
    cy = sum(WPOS[i].y for i in range(len(WPOS)) if top - 0.1 < WPOS[i].z < top) / max(1, sum(1 for p in WPOS if top - 0.1 < p.z < top))
    rows = rows or max(4, int((top - hem) / 0.035))
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    dl = bm.verts.layers.deform.verify()
    uv = bm.loops.layers.uv.verify()
    grid = []
    running = [0.0] * bins
    for j in range(rows + 1):
        t = j / rows
        z = top + (hem - top) * t
        env = envelope(z - 0.03, z + 0.03, cx, cy, bins)
        # cloth does not follow the body back in below the widest point
        running = [max(running[k], env[k]) for k in range(bins)]
        row = []
        for k in range(bins):
            a = -math.pi + (k + 0.5) / bins * 2 * math.pi
            rr = running[k] + margin + flare * t * t + pleats * t * (math.sin(a * 9 + 1.3) * 0.6 + math.sin(a * 5 + 0.4) * 0.4)
            p = Vector((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z))
            v = bm.verts.new(mw.inverted() @ p)
            for bone, w in weights(t, p.x, p.y - cy):
                if w > 0.001:
                    v[dl][names.index(bone)] = w
            row.append(v)
        grid.append(row)
    ks = range(bins) if span is None else [k for k in range(bins) if span(-math.pi + (k + 0.5) / bins * 2 * math.pi) and span(-math.pi + (k + 1.5) / bins * 2 * math.pi)]
    for j in range(rows):
        for k in ks:
            a, b = grid[j][k], grid[j][(k + 1) % bins]
            c, d = grid[j + 1][(k + 1) % bins], grid[j + 1][k]
            f = bm.faces.new((a, d, c, b))
            f.smooth = True
            for loop, (u, vv) in zip(f.loops, ((k, j), (k, j + 1), (k + 1, j + 1), (k + 1, j))):
                loop[uv].uv = (u / bins * 1.3, -vv / rows * (top - hem))
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.uv_layers[0].name = body.data.uv_layers[0].name   # one UV set after joining with shells
    o = new_object(name, me)
    o.matrix_world = mw.copy()
    return o

def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def skirt_weights(t, x, y):
    # pelvis at the waist, thighs by side toward the hem. The middle splits between both legs.
    leg = 0.85 * smoothstep(0.1, 1.0, t)
    side = smoothstep(-0.05, 0.05, x)
    return [("pelvis", 1 - leg), ("thigh_l", leg * side), ("thigh_r", leg * (1 - side))]

def long_skirt_weights(t, x, y):
    # a long dress: the lower half hangs mostly from the pelvis so it does not tear between the legs
    leg = 0.55 * smoothstep(0.05, 0.6, t) - 0.25 * smoothstep(0.6, 1.0, t)
    side = smoothstep(-0.06, 0.06, x)
    return [("pelvis", 1 - leg), ("thigh_l", leg * side), ("thigh_r", leg * (1 - side))]

# ---------------- garments ----------------
g = spec.get("garments", {})
covered = set()   # body vertex indices hidden under clothing

def region(i, groups, zmin=-9, zmax=9):
    return DOM[i] in groups and zmin <= WPOS[i].z <= zmax

wristTrim = lambda i: not (DOM[i] in {"lowerarm_l", "lowerarm_r"} and (WPOS[i] - bone_pos(DOM[i], True)).length < 0.035)
if g.get("tunic") or g.get("underdress"):
    name = "tunic" if g.get("tunic") else "underdress"
    # a round neckline, lower at the front (MakeHuman's front is -y)
    nc = bone_pos("neck_01")
    def in_neck_hole(p):
        dz = p.z - (nc.z + 0.02)
        dzf = dz + 0.045 * smoothstep(0.0, -0.08, p.y - nc.y)   # dips lower at the front
        return (p.x / 0.085) ** 2 + ((p.y - nc.y + 0.01) / 0.075) ** 2 + (min(0.0, dzf) / 0.05) ** 2 < 1.0
    keep = lambda i: (region(i, TORSO | ARM) or region(i, {"pelvis"}, beltZ - 0.06)) and wristTrim(i) and not in_neck_hole(WPOS[i])
    loose = lambda p, d: d + (0.012 * smoothstep(beltZ + 0.2, beltZ + 0.02, p.z) if p.z > beltZ - 0.07 else 0)
    shell(name, keep, 0.012, loose, smooth=6 if name == "tunic" else 14)
    covered |= {i for i in range(len(WPOS)) if keep(i)}
if g.get("trousers"):
    keep = lambda i: region(i, LEG | {"pelvis"}, ankleZ + 0.05, beltZ + 0.02)
    shell("trousers", keep, 0.007, smooth=3)
    covered |= {i for i in range(len(WPOS)) if keep(i)}
if g.get("wraps"):
    keep = lambda i: region(i, {"calf_l", "calf_r"}, ankleZ + 0.02, kneeZ - 0.07)
    shell("wraps", keep, 0.013, smooth=4)
if g.get("shoes"):
    keep = lambda i: region(i, FOOT) or region(i, {"calf_l", "calf_r"}, -9, ankleZ + 0.075)
    o = shell("shoes", keep, 0.01, smooth=4, flat_sole=True)
    for side in "lr":
        idx = [i for i in range(len(WPOS)) if DOM[i] in {"foot_" + side, "ball_" + side}]
        lo = Vector([min(WPOS[i][a] for i in idx) for a in range(3)])
        hi = Vector([max(WPOS[i][a] for i in idx) for a in range(3)])
        c = (lo + hi) / 2
        rad = Vector(((hi.x - lo.x) / 2 * 1.12, (hi.y - lo.y) / 2 * 1.06, (hi.z - lo.z) / 2 * 1.15))
        for v in o.data.vertices:
            p = mw @ v.co
            if (p.x > 0) != (side == "l") or p.z > ankleZ + 0.03:
                continue
            d = p - c
            n = Vector((d.x / rad.x, d.y / rad.y, d.z / rad.z))
            if n.length < 1e-6:
                continue
            target = c + Vector((n.x * rad.x, n.y * rad.y, n.z * rad.z)) / n.length
            w = 0.85 * smoothstep(ankleZ + 0.03, ankleZ - 0.01, p.z)
            q = p.lerp(target, w)
            q.z = max(q.z, 0.004)
            v.co = mw.inverted() @ q
    covered |= {i for i in range(len(WPOS)) if keep(i)}
if g.get("tunic"):
    ring_skirt("skirt", beltZ + 0.03, kneeZ + 0.07, 0.022, 0.07, skirt_weights, pleats=0.012)
    ring_skirt("belt", beltZ + 0.018, beltZ - 0.018, 0.042, 0.0, lambda t, x, y: [("pelvis", 1.0)], rows=1)
if g.get("underdress"):
    ring_skirt("underskirt", beltZ + 0.03, ankleZ + 0.02, 0.018, 0.08, long_skirt_weights, rows=22, pleats=0.006)
    covered |= {i for i in range(len(WPOS)) if region(i, LEG | {"pelvis"}, ankleZ + 0.02)}
if g.get("apron"):
    ring_skirt("apron", armpitZ + 0.02, ankleZ + 0.1, 0.045, 0.11, lambda t, x, y: [(b, w * (1 - smoothstep(0.0, 0.3, t))) for b, w in [("spine_03", 1.0)]] + [(b, w * smoothstep(0.0, 0.3, t)) for b, w in long_skirt_weights(max(0, (t - 0.3) / 0.7), x, y)], rows=26)
if g.get("cloak"):
    # a rectangular wool cloak: it hangs from the shoulders down the back and wraps the
    # sides, open at the front, where a ringed pin holds it at the right shoulder
    shTop = Z("upperarm_l") + 0.05
    envelope.arm_above = shTop - 0.04
    def cloak_w(t, x, y):
        up = 1 - smoothstep(0.0, 0.3, t)
        return [("spine_03", 0.8 * up), ("clavicle_l", 0.1 * up), ("clavicle_r", 0.1 * up), ("spine_02", (1 - up) * 0.45), ("spine_01", (1 - up) * 0.3), ("pelvis", (1 - up) * 0.25)]
    span = lambda a: math.sin(a) > -0.45   # MakeHuman's back is +y, so this keeps the back and sides
    ring_skirt("cloak", shTop, kneeZ + 0.05, 0.035, 0.05, cloak_w, rows=24, pleats=0.012, span=span)
    envelope.arm_above = 99.0
if g.get("straps"):
    # apron dress straps over the shoulders, front and back
    keep = lambda i: DOM[i] in TORSO | {"clavicle_l", "clavicle_r"} and WPOS[i].z > armpitZ - 0.01 and 0.07 < abs(WPOS[i].x) < 0.11
    shell("apronstraps", keep, 0.02, smooth=2, hem=0.0)
if g.get("shawl"):
    keep = lambda i: (DOM[i] in TORSO | {"clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r"} and WPOS[i].z > armpitZ + 0.01 and not in_neck_hole(WPOS[i]))
    shell("shawl", keep, 0.024, smooth=6)
if g.get("cap"):
    browZ = Z("head") + 0.075
    keep = lambda i: DOM[i] == "head" and WPOS[i].z > browZ
    shell("cap", keep, 0.02)


# ---------------- anchors for small metal fittings ----------------
# Empty nodes parented to bones. The app hangs brooches, buckles and pins on them.
from mathutils import Matrix
def front_y(x, z, extra):
    ys = [p.y for i, p in enumerate(WPOS) if abs(p.x - x) < 0.025 and abs(p.z - z) < 0.025 and DOM[i] not in ARM]
    return (min(ys) if ys else -0.12) - extra
def anchor(name, pos, bone):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.parent = rig
    e.parent_type = "BONE"
    e.parent_bone = bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(pos)
if g.get("tunic"):
    anchor("anchor_buckle", Vector((0, front_y(0, beltZ, 0.045), beltZ)), "pelvis")
    anchor("anchor_knife", Vector((0.11, front_y(0.11, beltZ, 0.035), beltZ)), "pelvis")
if g.get("tunic"):
    # woven bands at the cuffs and neckline, shown only on outfits with trim
    for side in "lr":
        a, b = bone_pos("lowerarm_" + side), bone_pos("lowerarm_" + side, True)
        anchor("anchor_cuff_" + side, b + (a - b).normalized() * 0.045, "lowerarm_" + side)
    anchor("anchor_neck", Vector((0, nc.y + 0.005, nc.z - 0.005)), "spine_03")
if g.get("apron"):
    zb = armpitZ + 0.0
    for side, x in (("l", 0.09), ("r", -0.09)):
        anchor("anchor_brooch_" + side, Vector((x, front_y(x, zb, 0.04), zb)), "spine_03")
    anchor("anchor_beads", Vector((0, front_y(0, zb - 0.05, 0.04), zb - 0.05)), "spine_03")
if g.get("shawl"):
    zs = armpitZ + 0.06
    anchor("anchor_shawlpin", Vector((0, front_y(0, zs, 0.05), zs)), "spine_03")
if g.get("cloak"):
    zc = Z("upperarm_l") + 0.0
    anchor("anchor_cloakpin", Vector((-0.12, front_y(-0.12, zc, 0.06), zc)), "spine_03")

# trim the body under the clothing, keeping a margin row so seams stay closed
if covered:
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    gone = [f for f in bm.faces if all(v.index in covered for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(body.data)
    bm.free()

# ---------------- tidy up for the web ----------------
# Stable names that the app uses to pick materials, fewer meshes, and lighter geometry.
bpy.data.objects.remove(basemesh, do_unlink=True)
hair_name = (info.get("hair") or "").split(".")[0]
beards = [c.split(".")[0] for c in info.get("clothes", [])]
rename = {}
for o in list(bpy.data.objects):
    if o.type != "MESH":
        continue
    n = o.name
    if o == body: rename[o] = "body"
    elif "eyebrow" in n: rename[o] = "brows"
    elif "eyelash" in n: rename[o] = "lashes"
    elif "low-poly" in n or "high-poly" in n: rename[o] = "eyes"
    elif hair_name and hair_name in n: rename[o] = "hair"
    elif any(b in n for b in beards): rename[o] = "beard"
for o, n in rename.items():
    o.name = n

def join(target, *others):
    objs = [bpy.data.objects.get(n) for n in (target,) + others]
    objs = [o for o in objs if o]
    if len(objs) < 2:
        if objs: objs[0].name = target
        return
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = target

join("tunic", "skirt")
join("underdress", "underskirt")
join("leather", "shoes", "belt")
join("apron", "apronstraps")

ratio = spec.get("decimate", 0.55)
for o in bpy.data.objects:
    if o.type == "MESH" and o.name in ("body", "tunic", "underdress", "trousers", "leather", "apron", "cap", "wraps", "cloak", "shawl") and ratio < 1:
        m = o.modifiers.new("Decimate", "DECIMATE")
        m.ratio = ratio
        # keep the face detailed: protect the head with a vertex group
        if o.name == "body" and "head" in o.vertex_groups:
            m.vertex_group = "head"
            m.invert_vertex_group = True
            m.vertex_group_factor = 1.0

rig.name = "rig"
rig["mh"] = json.dumps({"hair": hair_name, "beard": beards[0] if beards else "", "skin": spec.get("skin", "m")})

for o in bpy.data.objects:
    n = len(o.data.polygons) if o.type == "MESH" else 0
    print("OBJ", o.name, o.type, n)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_skins=True,
    export_animations=False, export_morph=False, export_materials="NONE", export_yup=True, export_extras=True)
print("WROTE", out, os.path.getsize(out))
