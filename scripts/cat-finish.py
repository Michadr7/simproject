# PET1: cat (Tripo AI model, licence 'Tripo Pro plan output') -> rigged game GLB. Headless Blender 5.2:
#   blender -b --python scripts/cat-finish.py -- build     (cat.blend is only READ -> 'cat game.blend' + 'Cat Game.glb')
#   blender -b --python scripts/cat-finish.py -- render    (previews of poses / clip frames into 'cat previews')
#   blender -b --python scripts/cat-finish.py -- glbcheck  (re-import 'Cat Game.glb': nodes, skins, clips, bounds)
# Source mesh faces -X in Blender (Z up). The game GLB faces +Z (glTF), Y up, feet on y=0, origin under the body centre.
# Blender axes of the finished file: nose -Y, +X = cat's left, Z up (glTF: X, Z, -Y).
import bpy, math, os, sys
from mathutils import Vector, Matrix, Euler

DIR = r"C:\Users\Michael\Documents\Projects\Assets Sim Project"
SRC = os.path.join(DIR, "cat.blend")
DST = os.path.join(DIR, "cat game.blend")
GLB = os.path.join(DIR, "Cat Game.glb")
PREV = os.path.join(DIR, "cat previews")
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = (ARGS + ['build'])[0]

FPS = 24
BODY_LEN = 0.45                  # nose to tail base, metres
CX = -0.18                       # source x of the body centre (between the paws); the tail base is at about x = +0.12
SCALE = BODY_LEN / (0.12 - (-0.4998))
def P(x, y, z):
    """source coordinates (nose -X, lateral Y, up Z) -> final Blender coordinates (nose -Y, left +X)."""
    return Vector((-y * SCALE, (x - CX) * SCALE, z * SCALE))

# name: (parent, head, tail) in SOURCE coordinates. Left (+X final) = source y < 0.
def side(n, s): return n + ('.L' if s < 0 else '.R')
BONES = {
    'root':    (None,     (CX, 0, 0.0),        (CX, 0, 0.10)),
    'spine1':  ('root',   (0.10, 0, 0.31),     (-0.02, 0, 0.32)),
    'spine2':  ('spine1', (-0.02, 0, 0.32),    (-0.15, 0, 0.33)),
    'spine3':  ('spine2', (-0.15, 0, 0.33),    (-0.27, 0, 0.35)),
    'neck':    ('spine3', (-0.27, 0, 0.35),    (-0.36, 0, 0.40)),
    'head':    ('neck',   (-0.36, 0, 0.40),    (-0.49, 0, 0.40)),
    'tail1':   ('spine1', (0.10, 0, 0.32),     (0.22, 0, 0.31)),
    'tail2':   ('tail1',  (0.22, 0, 0.31),     (0.33, 0, 0.27)),
    'tail3':   ('tail2',  (0.33, 0, 0.27),     (0.43, 0, 0.24)),
    'tail4':   ('tail3',  (0.43, 0, 0.24),     (0.50, 0, 0.22)),
}
for s in (-1, 1):
    BONES[side('ear', s)] = ('head', (-0.41, s * 0.045, 0.49), (-0.40, s * 0.055, 0.545))
    BONES[side('front_upper', s)] = ('spine3', (-0.30, s * 0.065, 0.24), (-0.31, s * 0.06, 0.12))
    BONES[side('front_lower', s)] = (side('front_upper', s), (-0.31, s * 0.06, 0.12), (-0.325, s * 0.06, 0.055))
    BONES[side('front_paw', s)] = (side('front_lower', s), (-0.325, s * 0.06, 0.055), (-0.355, s * 0.06, 0.012))
    BONES[side('hind_upper', s)] = ('spine1', (0.10, s * 0.075, 0.27), (0.07, s * 0.07, 0.165))
    BONES[side('hind_lower', s)] = (side('hind_upper', s), (0.07, s * 0.07, 0.165), (0.06, s * 0.065, 0.085))
    BONES[side('hind_paw', s)] = (side('hind_lower', s), (0.06, s * 0.065, 0.085), (0.0, s * 0.065, 0.012))
ANCHORS = {'anchor_mouth': ('head', (-0.49, 0, 0.37)), 'anchor_head': ('head', (-0.40, 0, 0.47))}

def clean():
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o)

def build():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    clean()
    mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    mesh.name = 'Cat'; mesh.data.name = 'Cat'
    mesh.vertex_groups.clear()
    for m in list(mesh.modifiers): mesh.modifiers.remove(m)
    # transform the vertices: centre, face -Y, scale (the source mesh is at the identity transform)
    R = Matrix.Rotation(math.radians(90), 3, 'Z')
    for v in mesh.data.vertices:
        c = v.co.copy(); c.x -= CX
        v.co = (R @ c) * SCALE
    mesh.data.update()
    # texture 512 x 512, one material
    img = bpy.data.images['tripo_image_41ed4cd2_0']
    img.scale(512, 512); img.pack()
    # armature
    arm_d = bpy.data.armatures.new('CatArmature'); arm = bpy.data.objects.new('CatRig', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n, (par, h, t) in BONES.items():
        b = arm_d.edit_bones.new(n); b.head = P(*h); b.tail = P(*t); eb[n] = b
    for n, (par, h, t) in BONES.items():
        if par: eb[n].parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    # weights: Blender's automatic weights gave the ear bone 1,670 vertices and left 79 without weight, so they are computed here
    arm_apply_weights(mesh, arm)
    weights_report(mesh)
    # anchors
    for n, (bone, pos) in ANCHORS.items():
        e = bpy.data.objects.new(n, None); e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 0.02
        bpy.context.scene.collection.objects.link(e)
        e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = bone
        # bone-parented: the parent matrix includes the bone tail offset; set the world position through the matrix
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.Translation(P(*pos))
    bpy.ops.object.mode_set(mode='OBJECT')
    make_actions(arm)
    bpy.ops.wm.save_as_mainfile(filepath=DST)
    export(arm, mesh)

RADIUS = {'root': 0.05, 'spine1': 0.11, 'spine2': 0.11, 'spine3': 0.11, 'neck': 0.07, 'head': 0.075, 'tail1': 0.06, 'tail2': 0.055,
          'tail3': 0.05, 'tail4': 0.045}
def bone_radius(n):
    if n in RADIUS: return RADIUS[n]
    if n.startswith('ear'): return 0.025
    if n.endswith('paw.L') or n.endswith('paw.R'): return 0.03
    return 0.04
def seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length
def arm_apply_weights(mesh, arm):
    segs = {n: (P(*h), P(*t)) for n, (par, h, t) in BONES.items() if n != 'root'}
    for n in BONES: mesh.vertex_groups.new(name=n)
    for v in mesh.data.vertices:
        ws = []
        for n, (a, b) in segs.items():
            if n.endswith('.L') and v.co.x < -0.02: continue
            if n.endswith('.R') and v.co.x > 0.02: continue
            d = seg_dist(v.co, a, b); ws.append((1.0 / (d / bone_radius(n) + 0.3) ** 4, n))
        ws.sort(reverse=True); ws = ws[:4]; tot = sum(w for w, _ in ws)
        for w, n in ws: mesh.vertex_groups[n].add([v.index], w / tot, 'REPLACE')
    mod = mesh.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    mesh.parent = arm
    mesh.matrix_parent_inverse = arm.matrix_world.inverted()

def weights_report(mesh):
    me = mesh.data; names = [g.name for g in mesh.vertex_groups]
    none = 0; cnt = {n: 0 for n in names}
    for v in me.vertices:
        if not v.groups: none += 1
        for g in v.groups:
            if g.weight > 0.01: cnt[names[g.group]] += 1
    print('WEIGHTS groups', len(names), 'verts without weight', none, 'of', len(me.vertices))
    print('WEIGHTS counts', cnt)

# ---------------------------------------------------------------- animation
def posebone(arm, n): return arm.pose.bones[n]
def rot_key(pb, rx, ry, rz, frame):
    Rb = pb.bone.matrix_local.to_3x3()
    Rw = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (Rb.inverted() @ Rw @ Rb).to_quaternion()
    pb.keyframe_insert('rotation_quaternion', frame=frame)
def loc_key(pb, d, frame):
    Rb = pb.bone.matrix_local.to_3x3()
    pb.location = Rb.inverted() @ Vector(d); pb.keyframe_insert('location', frame=frame)
def scl_key(pb, s, frame):
    pb.scale = s; pb.keyframe_insert('scale', frame=frame)

S = math.sin; C = math.cos; TAU = 2 * math.pi
def clamp01(x): return max(0.0, min(1.0, x))
def bump(t, a, b):  # 0 -> 1 -> 0 between a and b (smooth)
    return S(math.pi * clamp01((t - a) / (b - a))) ** 2 if a <= t <= b else 0.0

def tail_wave(p, amp, lag=0.6):
    return {'tail%d' % (i + 1): (0, 0, amp * (0.7 + 0.3 * i) * S(p - lag * i)) for i in range(4)}

def pose_idle(t):          # t in 0..1 over 3 s: two breaths, one tail flick, one ear twitch, a slow head look
    p = TAU * t; br = S(TAU * 2 * t)
    d = {'spine2': (0.8 * br, 0, 0), 'spine3': (-0.8 * br, 0, 0), 'head': (1.5 * S(p), 0, 3 * S(p + 1)), 'neck': (0, 0, 2 * S(p + 1))}
    fl = bump(t, 0.30, 0.65) * S(TAU * 3 * (t - 0.30) / 0.35)
    for i in range(4): d['tail%d' % (i + 1)] = (0, 0, 4 * S(p - 0.6 * i) + (10 + 4 * i) * fl)
    et = bump(t, 0.72, 0.80)
    d['ear.L'] = (0, 0, 14 * et); d['ear.R'] = (0, 0, 0)
    d['_scale'] = {'spine2': 1 + 0.012 * br}
    return d

def pose_walk(t):          # 1 s cycle, diagonal gait
    p = TAU * t; d = {}
    for name, ph in (('front', 0.0), ('hind', math.pi)):
        for s in ('L', 'R'):
            q = p + ph + (math.pi if (s == 'R') else 0.0)   # L front with R hind in phase: front L ph 0, hind R ph 0
            th = (26 if name == 'front' else 20) * S(q)       # + = foot back
            lift = max(0.0, -C(q))                            # foot is moving forward (lifted)
            if name == 'front':
                d['front_upper.' + s] = (th, 0, 0); d['front_lower.' + s] = (-8 + 38 * lift, 0, 0); d['front_paw.' + s] = (-th * 0.4 - 12 * lift, 0, 0)
            else:
                d['hind_upper.' + s] = (-th, 0, 0); d['hind_lower.' + s] = (10 - 30 * lift, 0, 0); d['hind_paw.' + s] = (th * 0.1 + 12 * lift, 0, 0)
    d['spine1'] = (0, 0, 2.5 * S(p)); d['spine2'] = (0, 0, -1.5 * S(p)); d['spine3'] = (0, 0, -2.5 * S(p))
    d['neck'] = (0, 0, 2 * S(p)); d['head'] = (-2 + 2 * S(2 * p), 0, 2 * S(p))
    d.update(tail_wave(p, 5, 0.7))
    d['_loc'] = {'root': (0, 0, 0.014 + 0.008 * S(2 * p + 0.6))}
    return d

def pose_eat(t):           # 2 s loop, head down at a bowl, chewing 4 times
    p = TAU * t; ch = S(TAU * 4 * t)
    d = {'spine3': (8, 0, 0), 'neck': (48 + 2 * ch, 0, 0), 'head': (38 + 5 * ch, 0, 0), 'spine2': (4, 0, 0),
         'front_upper.L': (-4, 0, 0), 'front_upper.R': (-4, 0, 0), 'front_lower.L': (10, 0, 0), 'front_lower.R': (10, 0, 0), 'front_paw.L': (-8, 0, 0), 'front_paw.R': (-8, 0, 0)}
    d.update(tail_wave(p, 6, 0.7))
    et = bump(t, 0.55, 0.65)
    d['ear.L'] = (0, 0, 10 * et); d['ear.R'] = (0, 0, 0)
    d['_scale'] = {'spine2': 1 + 0.008 * S(p)}
    return d

def pose_pet(t):           # 2 s loop, leaning into a hand, purr (fast tiny pulses), ear twitch, slow tail
    p = TAU * t; pur = S(TAU * 12 * t)
    d = {'head': (-10 + 1.0 * pur, 0, 8 * S(p) ), 'neck': (-6, 0, 5 * S(p)), 'spine3': (-2, 0, -3 * S(p)), 'spine1': (0, 0, 2 * S(p))}
    d.update(tail_wave(p, 9, 0.8))
    et = bump(t, 0.15, 0.25) + bump(t, 0.62, 0.72)
    d['ear.L'] = (0, 0, 14 * et); d['ear.R'] = (0, 0, -12 * et)
    d['_scale'] = {'spine2': (1 + 0.012 * pur, 1 + 0.012 * pur, 1 - 0.03 - 0.015 * S(p)), 'spine3': (1 + 0.008 * pur, 1 + 0.008 * pur, 1 - 0.02)}
    return d

def pose_sleep(t):         # 4 s loop; rest pose, head dropped, slow breathing (see report: no curl, the weights would not hold it)
    p = TAU * t; br = S(TAU * 2 * t)
    d = {'neck': (14, 0, 0), 'head': (14, 0, 6), 'spine2': (1.0 * br, 0, 0)}
    d.update(tail_wave(p, 2.5, 0.8))
    d['_scale'] = {'spine2': (1 + 0.018 * br, 1 + 0.018 * br, 1 + 0.025 * br), 'spine3': (1 + 0.01 * br, 1 + 0.01 * br, 1 + 0.015 * br)}
    d['_loc'] = {'root': (0, 0, -0.012)}
    return d

CLIPS = {'idle': (3.0, pose_idle, 3), 'walk': (1.0, pose_walk, 1), 'eat': (2.0, pose_eat, 2), 'pet': (2.0, pose_pet, 1), 'sleep': (4.0, pose_sleep, 4)}

def make_actions(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    arm.animation_data_create()
    for name, (dur, fn, step) in CLIPS.items():
        for pb in arm.pose.bones:
            pb.location = (0, 0, 0); pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
        act = bpy.data.actions.new(name); act.use_fake_user = True
        arm.animation_data.action = act
        n = int(round(dur * FPS))
        for f in range(0, n + 1, step):
            d = fn((f % n) / n if f < n else 0.0)
            scl = d.pop('_scale', {}); loc = d.pop('_loc', {})
            for pb in arm.pose.bones:
                rx, ry, rz = d.get(pb.name, (0, 0, 0))
                rot_key(pb, rx, ry, rz, f)
                if pb.name in loc: loc_key(pb, loc[pb.name], f)
                if pb.name in scl:
                    s = scl[pb.name]; scl_key(pb, (s, s, s) if isinstance(s, float) else s, f)
        act.frame_range = (0, n)
        act.use_frame_range = True; act.use_cyclic = True
        # push to its own NLA track named like the clip (the glTF exporter writes one clip per track)
        tr = arm.animation_data.nla_tracks.new(); tr.name = name
        st = tr.strips.new(name, 0, act); st.name = name
        arm.animation_data.action = None
    # 'idle' as the visible default
    bpy.ops.object.mode_set(mode='OBJECT')

def export(arm, mesh):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm, mesh] + [o for o in bpy.data.objects if o.type == 'EMPTY']: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    kw = dict(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=False, export_cameras=False,
              export_lights=False, export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
              export_image_format='JPEG', export_image_quality=88, export_draco_mesh_compression_enable=False, export_def_bones=False,
              export_frame_rate=FPS, export_force_sampling=True, export_optimize_animation_size=False)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = {k: v for k, v in kw.items() if k in props or k in ('filepath', 'export_format')}
    for k in ('export_optimize_animation_keep_anim_armature',):
        if k in props: kw[k] = True
    print('EXPORT args', sorted(kw))
    bpy.ops.export_scene.gltf(**kw)

# ---------------------------------------------------------------- previews
def render_setup(res=(640, 480)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = res
    cam = bpy.data.objects.get('PrevCam')
    if not cam:
        cam = bpy.data.objects.new('PrevCam', bpy.data.cameras.new('PrevCam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.0; sc.camera = cam
    return cam

def shot(cam, name, view='side'):
    if view == 'side':   # from the cat's left (+X): the cat faces the left of the picture? camera at +X looking -X: nose -Y is on the right
        cam.location = (3, 0, 0.2); cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    elif view == 'front':
        cam.location = (0, -3, 0.2); cam.rotation_euler = (math.radians(90), 0, 0)
    else:
        cam.location = (0, 0, 3); cam.rotation_euler = (0, 0, 0)
    bpy.context.scene.render.filepath = os.path.join(PREV, name + '.png')
    bpy.ops.render.render(write_still=True)

def render():
    bpy.ops.wm.open_mainfile(filepath=DST)
    os.makedirs(PREV, exist_ok=True)
    cam = render_setup()
    arm = bpy.data.objects['CatRig']
    jobs = [('rest', None, 0), ('idle', 'idle', 25), ('walk_a', 'walk', 7), ('walk_b', 'walk', 19), ('eat', 'eat', 20), ('pet', 'pet', 12), ('sleep', 'sleep', 26)]
    sel = ARGS[1:] if len(ARGS) > 1 else None
    for nm, clip, fr in jobs:
        if sel and nm not in sel: continue
        for pb in arm.pose.bones:
            pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
        arm.animation_data.action = bpy.data.actions[clip] if clip else None
        for t in arm.animation_data.nla_tracks: t.mute = True
        bpy.context.scene.frame_set(fr)
        bpy.context.view_layer.update()
        shot(cam, 'cat_' + nm)
        if nm in ('walk_a', 'eat', 'pet'): shot(cam, 'cat_' + nm + '_top', 'top')

def glbcheck():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    print('GLB size', os.path.getsize(GLB))
    tris = 0; verts = 0
    for o in bpy.data.objects:
        print('NODE', o.name, o.type, 'parent', o.parent.name if o.parent else None, 'parent_bone', o.parent_bone)
        if o.type == 'MESH':
            me = o.data; me.calc_loop_triangles(); tris += len(me.loop_triangles); verts += len(me.vertices)
            ws = [len([g for g in v.groups if g.weight > 0]) for v in me.vertices]
            print('MESH', o.name, 'tris', len(me.loop_triangles), 'verts', len(me.vertices), 'groups', len(o.vertex_groups), 'max influences', max(ws), 'materials', len(me.materials))
            vs = [o.matrix_world @ v.co for v in me.vertices]
            print('BOUNDS', [(round(min(v[i] for v in vs), 3), round(max(v[i] for v in vs), 3)) for i in range(3)])
        if o.type == 'ARMATURE':
            print('ARMATURE', o.name, 'bones', len(o.data.bones))
    print('IMAGES', [(i.name, i.size[:]) for i in bpy.data.images])
    for a in bpy.data.actions:
        fr = a.frame_range
        chans = {fc.data_path.split('"')[1] for fc in a.fcurves} if hasattr(a, 'fcurves') else set()
        print('CLIP', a.name, 'frames', tuple(fr), 'seconds', round((fr[1] - fr[0]) / FPS, 3), 'bones animated', len(chans))
    print('TOTAL tris', tris, 'verts', verts)

if MODE == 'build': build()
elif MODE == 'render': render()
elif MODE == 'glbcheck': glbcheck()
