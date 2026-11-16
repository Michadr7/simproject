# PC1: Ironwood police car (Tripo AI model cleaned by the user, licence 'Tripo Pro plan output') -> game GLB. Headless Blender 5.2:
#   blender -b --python scripts/police-finish.py -- rendersrc  (previews of the untouched V1 source into 'IronwoodPD previews\src_*')
#   blender -b --python scripts/police-finish.py -- build      (V1 is only READ -> 'IronwoodPDCar Game.blend' + 'IronwoodPDCar Game.glb')
#   blender -b --python scripts/police-finish.py -- render     (previews of the finished .blend, prefix 'fin_')
#   blender -b --python scripts/police-finish.py -- glbcheck   (re-import the .glb: nodes, tris, bounds, previews prefix 'glb_')
# Source: nose -Y, +X = car's left, Z up, length 1.0. Finished Blender file: same axes, metres. glTF: X, Z, -Y (nose +Z, left +X).
# Node contract copied from the ATV (steer_FL > wheel_FL > WheelMesh_FL, anchor_* empties) so scripts/build-props.mjs 'nodes' + splitWheels:'nodes' can read it.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

DIR = r"C:\Users\Michael\Documents\Projects\Assets Sim Project"
SRC = os.path.join(DIR, "IronwoodPDCarV1.blend")
DST = os.path.join(DIR, "IronwoodPDCar Game.blend")
GLB = os.path.join(DIR, "IronwoodPDCar Game.glb")
PREV = os.path.join(DIR, "IronwoodPD previews")
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = (ARGS + ['rendersrc'])[0]
TEX = int(os.environ.get('PD_TEX', '1024'))
BODY_LEN = 4.95

def bounds(o):
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector([min(v[i] for v in bb) for i in range(3)]), Vector([max(v[i] for v in bb) for i in range(3)])

def render(prefix, center, size, views=None, hide=()):
    os.makedirs(PREV, exist_ok=True)
    sc = bpy.context.scene
    engs = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engs else 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 800
    sc.view_settings.view_transform = 'Standard'
    for o in bpy.data.objects:
        if o.type == 'LIGHT' or o.type == 'CAMERA': bpy.data.objects.remove(o)
    if sc.world is None: sc.world = bpy.data.worlds.new('W')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    if bg: bg.inputs['Color'].default_value = (0.55, 0.6, 0.66, 1); bg.inputs['Strength'].default_value = 0.8
    sun = bpy.data.lights.new('ps', 'SUN'); sun.energy = 2.6
    so = bpy.data.objects.new('ps', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(45), math.radians(10), math.radians(35))
    cd = bpy.data.cameras.new('pc'); cam = bpy.data.objects.new('pc', cd); sc.collection.objects.link(cam); sc.camera = cam
    s = size; c = Vector(center)
    views = views or [
        ('front34', (0.8, -1.2, 0.55), 40), ('side', (1.7, 0, 0.12), 32), ('top', (0, 0, 1.9), 34),
        ('rear34', (-0.8, 1.2, 0.55), 40), ('under', (0, 0, -1.9), 34), ('front', (0, -1.8, 0.22), 36),
        ('low_side', (1.0, -0.8, 0.12), 40),
    ]
    for name, off, lens in views:
        cam.location = c + Vector(off) * s; cd.lens = lens
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        if name == 'under':
            cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'X').to_euler()
        cd.clip_start = 0.01 * s; cd.clip_end = 100 * s
        sc.render.filepath = os.path.join(PREV, prefix + name + '.png')
        bpy.ops.render.render(write_still=True)
    print('rendered', prefix)

def src_render():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    for n in ('PushbarRubber_-1',):
        o = bpy.data.objects.get(n)
        if o: o.hide_render = True
    sc = bpy.context.scene
    render('src_', (0, 0, 0.17), 1.0)

if MODE == 'rendersrc': src_render()
def slices():
    """ortho cut-away views of the SOURCE (near geometry clipped away) to find the seats, steering wheel and pedals."""
    bpy.ops.wm.open_mainfile(filepath=SRC)
    o = bpy.data.objects.get('PushbarRubber_-1')
    if o: o.hide_render = True
    sc = bpy.context.scene
    render('tmp_', (0, 0, 0.17), 1.0, views=[('x', (5, 5, 5), 35)])   # sets up engine / sun / world / camera
    cam = sc.camera; cd = cam.data; cd.type = 'ORTHO'; cd.ortho_scale = 1.15
    sc.render.resolution_x, sc.render.resolution_y = 1400, 700
    jobs = [('cut_z28', (0, -0.0, 1.0), (0, 0, -1), 1.0 - 0.28, 0), ('cut_z24', (0, 0, 1.0), (0, 0, -1), 1.0 - 0.24, 0),
            ('cut_z20', (0, 0, 1.0), (0, 0, -1), 1.0 - 0.20, 0), ('cut_x0', (1.0, 0, 0.17), (-1, 0, 0), 1.0 - 0.02, 0),
            ('cut_x09', (1.0, 0, 0.17), (-1, 0, 0), 1.0 - 0.09, 0)]
    for name, loc, d, clip, _ in jobs:
        cam.location = Vector(loc); cd.clip_start = clip; cd.clip_end = 3
        cam.rotation_euler = Vector(d).to_track_quat('-Z', 'Y' if abs(d[2]) < 0.5 else 'Y').to_euler()
        if abs(d[2]) > 0.5: cam.rotation_euler = (0, 0, math.radians(-90))   # top view, nose (-Y) toward the left of the image? set below
        sc.render.filepath = os.path.join(PREV, 'sl_' + name + '.png'); bpy.ops.render.render(write_still=True)
    os.remove(os.path.join(PREV, 'tmp_x.png'))

if MODE == 'slices': slices()
# ---------------------------------------------------------------- build
# anchors in SOURCE coordinates (nose -Y, left +X, Z up, length 1.0, before the origin shift), found by looking at the renders
ANCH_SRC = {
 'anchor_driver_seat': (0.07, -0.05, 0.105), 'anchor_hands_L': (0.09, -0.145, 0.205), 'anchor_hands_R': (0.05, -0.145, 0.205),
 'anchor_foot_L': (0.105, -0.15, 0.045), 'anchor_foot_R': (0.065, -0.17, 0.05),
 'anchor_headlight_L': (0.135, -0.46, 0.165), 'anchor_headlight_R': (-0.135, -0.46, 0.165),
 'anchor_taillight_L': (0.142, 0.482, 0.195), 'anchor_taillight_R': (-0.142, 0.482, 0.195),
 'anchor_exhaust': (-0.102, 0.495, 0.062), 'anchor_fuel_port': (0.19, 0.37, 0.165),
 'anchor_lightbar': (0.0, 0.0535, 0.324), 'anchor_engine_sound': (0.0, -0.30, 0.12),
}
WHEELS = {'wheel_front_left': 'FL', 'wheel_front_right': 'FR', 'wheel_rear_left': 'RL', 'wheel_rear_right': 'RR'}

def islands(bm):
    seen = set(); out = []
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; seen.add(v.index); comp = []
        while st:
            x = st.pop(); comp.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen: seen.add(y.index); st.append(y)
        out.append(comp)
    return out

def is_bar(c):
    mn = [min(v.co[i] for v in c) for i in range(3)]; mx = [max(v.co[i] for v in c) for i in range(3)]
    return mn[2] >= 0.31 and mn[1] >= 0.01 and mx[1] <= 0.095 and mn[0] >= -0.13 and mx[0] <= 0.13

def build():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    for n in ('PushbarRubber_-1', 'Camera', 'Light'):
        o = bpy.data.objects.get(n)
        if o: bpy.data.objects.remove(o)
    body = bpy.data.objects['car_body']
    wheels = {n: bpy.data.objects[n] for n in WHEELS}
    bpy.ops.object.select_all(action='DESELECT')
    for o in [body] + list(wheels.values()): o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY': bpy.data.objects.remove(o)
    # body to world coordinates (source units)
    body.data.transform(body.matrix_world); body.matrix_world = Matrix.Identity(4)
    hubs = {n: w.matrix_world.translation.copy() for n, w in wheels.items()}
    for w in wheels.values(): w.data.transform(Matrix.Diagonal(w.matrix_world.to_scale()).to_4x4()); w.rotation_euler = (0, 0, 0); w.scale = (1, 1, 1)
    # lightbar: whole loose islands that sit above the roof line
    bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table(); bm.verts.index_update()
    isl = islands(bm); bar_idx = {v.index for c in isl if is_bar(c) for v in c}
    print('lightbar islands', sum(1 for c in isl if is_bar(c)), 'verts', len(bar_idx))
    bar_me = body.data.copy(); bar_me.name = 'lightbar'
    bmb = bmesh.new(); bmb.from_mesh(bar_me); bmb.verts.ensure_lookup_table()
    bmesh.ops.delete(bmb, geom=[v for v in bmb.verts if v.index not in bar_idx], context='VERTS'); bmb.to_mesh(bar_me); bmb.free()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in bar_idx], context='VERTS'); bm.to_mesh(body.data); bm.free()
    bar = bpy.data.objects.new('lightbar', bar_me); bpy.context.scene.collection.objects.link(bar)
    body.name = 'car_body'; body.data.name = 'car_body'
    # scale and move: length 4.95, origin on the ground under the wheelbase centre
    bmin, bmax = bounds(body)
    f = BODY_LEN / (bmax.y - bmin.y)
    O = Vector(((hubs['wheel_front_left'].x + hubs['wheel_front_right'].x) / 2, (hubs['wheel_front_left'].y + hubs['wheel_rear_left'].y) / 2, 0.0))
    zmin = min(bounds(w)[0].z for w in wheels.values())
    O.z = zmin
    print('scale', f, 'origin shift', tuple(O))
    T = Matrix.Scale(f, 4) @ Matrix.Translation(-O)
    for o in (body, bar): o.data.transform(T)
    for n, w in wheels.items(): w.data.transform(Matrix.Scale(f, 4))
    # material: one clean material, 512 px (or PD_TEX) basecolour
    mat = body.data.materials[0]
    img = [im for im in bpy.data.images if im.packed_file][0]
    img.scale(TEX, TEX); img.pack(); img.name = 'police_basecolor'
    mat.name = 'PoliceCar'
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type == 'NORMAL_MAP': nt.nodes.remove(n)
    bsdf = nt.nodes['Principled BSDF']; tex = [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0]
    tex.image = img
    for l in list(nt.links):
        if l.to_node == bsdf and l.to_socket.name not in ('Base Color',): nt.links.remove(l)
    if not any(l.to_socket.name == 'Base Color' for l in nt.links): nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = 0.0; bsdf.inputs['Roughness'].default_value = 0.55; bsdf.inputs['Alpha'].default_value = 1.0
    try: mat.surface_render_method = 'DITHERED'
    except Exception: pass
    try: mat.blend_method = 'OPAQUE'
    except Exception: pass
    for o in (bar,): o.data.materials.clear(); o.data.materials.append(mat)
    for w in wheels.values(): w.data.materials.clear(); w.data.materials.append(mat)
    for o in (body, bar): o.location = (0, 0, 0)
    # wheels: steer_XX (front) > wheel_XX > WheelMesh_XX, pivots at the hub
    for n, w in wheels.items():
        k = WHEELS[n]; H = (hubs[n] - O) * f
        w.name = 'WheelMesh_' + k; w.data.name = 'WheelMesh_' + k
        e = bpy.data.objects.new('wheel_' + k, None); bpy.context.scene.collection.objects.link(e)
        if k[0] == 'F':
            s = bpy.data.objects.new('steer_' + k, None); bpy.context.scene.collection.objects.link(s); s.location = H
            e.parent = s; e.location = (0, 0, 0)
        else: e.location = H
        w.parent = e; w.location = (0, 0, 0)
    for name, p in ANCH_SRC.items():
        a = bpy.data.objects.new(name, None); a.empty_display_type = 'PLAIN_AXES'; a.empty_display_size = 0.1
        bpy.context.scene.collection.objects.link(a); a.location = (Vector(p) - O) * f
    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    for c in list(bpy.data.collections):
        if not c.objects and not c.children: bpy.data.collections.remove(c)
    bpy.ops.wm.save_as_mainfile(filepath=DST)
    export_glb()
    print('built; f =', f)

def export_glb():
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type in ('MESH', 'EMPTY'): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
        export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=False, export_image_format='AUTO')

def markers():
    sc = bpy.context.scene
    m = bpy.data.materials.new('mk'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (1, 0, 0.8, 1); b.inputs['Emission Color'].default_value = (1, 0, 0.8, 1); b.inputs['Emission Strength'].default_value = 3
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY' and (o.name.startswith('anchor_') or o.name.startswith('wheel_') or o.name.startswith('steer_')):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=o.matrix_world.translation, segments=12, ring_count=8)
            s = bpy.context.object; s.data.materials.append(m); s.name = 'mk_' + o.name

def render_fin(glb=False):
    if glb:
        bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=GLB)
    else: bpy.ops.wm.open_mainfile(filepath=DST)
    if os.environ.get('PD_MARK'): markers()
    pre = ('glb_' if glb else 'fin_') + ('mk_' if os.environ.get('PD_MARK') else '')
    render(pre, (0, 0, 0.8), 4.95, views=[
        ('front34', (0.8, -1.2, 0.35), 40), ('side', (1.7, 0, 0.06), 32), ('top', (0, 0, 1.9), 34),
        ('rear34', (-0.8, 1.2, 0.35), 40), ('under', (0, 0, -1.9), 34), ('front', (0, -1.8, 0.1), 36)])

def glbcheck():
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=GLB)
    tris = 0; mats = set()
    for o in bpy.data.objects:
        info = ''
        if o.type == 'MESH':
            t = sum(len(p.vertices) - 2 for p in o.data.polygons); tris += t; mats |= {m.name for m in o.data.materials if m}
            mn, mx = bounds(o); info = 'tris %d  bounds (blender xyz) %s .. %s' % (t, tuple(round(x, 3) for x in mn), tuple(round(x, 3) for x in mx))
        print('NODE', o.name, o.type, 'parent=' + (o.parent.name if o.parent else '-'), 'world', tuple(round(x, 3) for x in o.matrix_world.translation), info)
    allm = [o for o in bpy.data.objects if o.type == 'MESH']
    lo = Vector([min(bounds(o)[0][i] for o in allm) for i in range(3)]); hi = Vector([max(bounds(o)[1][i] for o in allm) for i in range(3)])
    print('TOTAL tris', tris, 'materials', mats, 'meshes', len(allm))
    print('BOUNDS blender (x left, y -nose, z up)', tuple(round(x, 3) for x in lo), tuple(round(x, 3) for x in hi))
    print('SIZE x %.3f y(length) %.3f z(height) %.3f' % tuple(hi - lo))
    for o in allm:
        if o.name.startswith('WheelMesh'):
            mn, mx = bounds(o); print('WHEEL', o.name, 'dia %.3f width %.3f' % (mx.z - mn.z, mx.x - mn.x))
    print('IMAGES', [(i.name, i.size[:]) for i in bpy.data.images])

if MODE == 'build': build()
elif MODE == 'render': render_fin()
elif MODE == 'glbrender': render_fin(True)
elif MODE == 'glbcheck': glbcheck()