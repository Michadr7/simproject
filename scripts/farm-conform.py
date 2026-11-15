# Farm tractor conform (CC-BY sources, originals never modified). Headless Blender 5.2:
#   blender --background --python scripts/farm-conform.py -- build juff|kidbi|all
#   blender --background --python scripts/farm-conform.py -- render <glb> <png-prefix>
# Reads assets-src/Farm/<model>/scene.gltf, writes assets-src/Farm/conformed/*.glb.
# Contract: notes/farm-vehicle-contract.md. Blender axes: nose -Y, +X = vehicle left, Z up (glTF: X, Z, -Y).
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'assets-src', 'Farm')
OUT = os.path.join(SRC, 'conformed')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = (ARGS + ['build'])[0]
SMOOTH_DEG = 30.0

def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def srgb(r, g, b): return (lin(r), lin(g), lin(b), 1.0)

# flat contract materials: name -> (linear rgba, roughness, metallic)
MATS = {
 'Paint':    (None, 0.55, 0.0), 'Frame': (None, 0.7, 0.0), 'Tire': (None, 0.9, 0.0), 'Rim': (None, 0.6, 0.0),
 'Trim':     (None, 0.8, 0.0), 'Metal': (None, 0.45, 0.6), 'Glass': (None, 0.1, 0.0), 'Light': (None, 0.3, 0.0),
 'Tank':     (None, 0.5, 0.0), 'TowFrame': (None, 0.7, 0.0), 'Wheel': (None, 0.9, 0.0)}   # Wheel = lite files only (tyre+rim, vertex colours)

def material(name, rgba):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rgba
    b.inputs['Roughness'].default_value = MATS[name][1]
    b.inputs['Metallic'].default_value = MATS[name][2]
    b.inputs['Alpha'].default_value = rgba[3]
    m.diffuse_color = rgba
    if rgba[3] < 1.0:
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    return m

def wheel_material():
    """Lite files: ONE material for tyre + rim. White base colour times the 'Col' vertex colours (exported as COLOR_0)."""
    m = material('Wheel', (1.0, 1.0, 1.0, 1.0))
    nt = m.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    nt.links.new(vc.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------- source reading
def src_polys(obj):
    """[(world coords list, material index, uv centroid or None)] for one source mesh."""
    me = obj.data; M = obj.matrix_world; uvl = me.uv_layers.active.data if me.uv_layers.active else None
    out = []
    for p in me.polygons:
        co = [M @ me.vertices[i].co for i in p.vertices]
        uv = None
        if uvl:
            u = sum(uvl[l].uv[0] for l in p.loop_indices) / p.loop_total; v = sum(uvl[l].uv[1] for l in p.loop_indices) / p.loop_total
            uv = (u, v)
        out.append((co, p.material_index, uv))
    return out

def components(polys, tol=1e-4):
    """Group polygons that share positions (UV and normal splits do not break a part)."""
    ids = {}; par = []
    def vid(p):
        k = (round(p[0] / tol), round(p[1] / tol), round(p[2] / tol))
        if k not in ids: ids[k] = len(par); par.append(len(par))
        return ids[k]
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    pv = []
    for co, _, _ in polys:
        v = [vid(p) for p in co]; pv.append(v)
        for a in v[1:]:
            ra, rb = find(v[0]), find(a)
            if ra != rb: par[ra] = rb
    groups = {}
    for i, v in enumerate(pv): groups.setdefault(find(v[0]), []).append(i)
    res = []
    for idx in groups.values():
        pts = [p for i in idx for p in polys[i][0]]
        mn = Vector([min(p[k] for p in pts) for k in range(3)]); mx = Vector([max(p[k] for p in pts) for k in range(3)])
        res.append({'polys': [polys[i] for i in idx], 'min': mn, 'max': mx, 'c': (mn + mx) / 2, 'size': mx - mn})
    return res

def bbox(polys):
    pts = [p for co, *_ in polys for p in co]
    mn = Vector([min(p[k] for p in pts) for k in range(3)]); mx = Vector([max(p[k] for p in pts) for k in range(3)])
    return mn, mx

def extreme(polys, axis, sign, within=0.03):
    """Centroid of the points within `within` of the extreme along axis (sign +1 max, -1 min)."""
    pts = [p for co, *_ in polys for p in co]
    e = max(p[axis] * sign for p in pts)
    sel = [p for p in pts if p[axis] * sign > e - within]
    return sum(sel, Vector()) / len(sel)

# ---------------------------------------------------------------- build helpers
class Frame:
    """Source Blender coords -> conformed Blender coords: p' = s*(p - origin) with a global lift G in z."""
    def __init__(self, s, ox, oy, G): self.s, self.ox, self.oy, self.G = s, ox, oy, G
    def __call__(self, p): return Vector(((p[0] - self.ox) * self.s, (p[1] - self.oy) * self.s, p[2] * self.s + self.G))

def mesh_from(name, polys_by_mat, xf, offset=Vector(), local_inv=None, mats=None):
    """polys_by_mat: {matname: [coords lists in source space]} -> one mesh object with a slot per material."""
    names = [n for n in polys_by_mat if polys_by_mat[n]]
    verts, faces, mi = [], [], []
    for k, n in enumerate(names):
        for co in polys_by_mat[n]:
            base = len(verts)
            for p in co:
                q = xf(p) - offset
                if local_inv is not None: q = local_inv @ q
                verts.append(q)
            faces.append(tuple(range(base, base + len(co)))); mi.append(k)
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces)
    for n in names: me.materials.append(mats[n])
    for p, k in zip(me.polygons, mi): p.material_index = k
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

def mesh_single(name, parts, xf, offset=Vector(), cols=None, mat=None):
    """LITE: several colour roles ({role: [coords]}) in ONE mesh with ONE material slot; the role colour goes into the 'Col' vertex colours."""
    verts, faces, roles = [], [], []
    for role, plist in parts.items():
        for co in plist:
            base = len(verts)
            for p in co: verts.append(xf(p) - offset)
            faces.append(tuple(range(base, base + len(co)))); roles.append(role)
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.materials.append(mat)
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for p, r in zip(me.polygons, roles):
        for li in p.loop_indices: attr.data[li].color = tuple(cols[r])
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

def decimate_polys(polys, ratio, log=None, label=''):
    """Blender Decimate (collapse) on a list of polygon coordinate lists (source space); returns triangles in the same space."""
    ids = {}; vl = []; faces = []
    for co in polys:
        f = []
        for p in co:
            k = (round(p[0] / 1e-5), round(p[1] / 1e-5), round(p[2] / 1e-5))
            if k not in ids: ids[k] = len(vl); vl.append(tuple(p))
            f.append(ids[k])
        if len(set(f)) >= 3: faces.append(tuple(f))
    me = bpy.data.meshes.new('dec'); me.from_pydata(vl, [], faces); me.update()
    ob = bpy.data.objects.new('dec', me); bpy.context.scene.collection.objects.link(ob)
    md = ob.modifiers.new('d', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = ratio; md.use_collapse_triangulate = True
    bpy.context.view_layer.update()
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); m2 = ev.to_mesh()
    out = [[Vector(m2.vertices[i].co) for i in p.vertices] for p in m2.polygons]
    ev.to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    if log is not None:
        before = sum(len(co) - 2 for co in polys); log.append('LITE decimate %s: %d -> %d triangles (ratio %.2f)' % (label, before, len(out), ratio))
    return out

def decimate_roles(items, ratio, protect_below=0, log=None, label=''):
    """items: [(coords, role)] of ONE welded object (so the parts stay connected and can collapse). Decimates the whole thing, then gives every
    new triangle the role of the nearest original polygon. protect_below: loose parts with fewer triangles keep their shape (vertex group)."""
    from mathutils.kdtree import KDTree
    ids = {}; vl = []; faces = []; froles = []; seenf = set()
    for co, role in items:
        f = []
        for p in co:
            k = (round(p[0] / 1e-5), round(p[1] / 1e-5), round(p[2] / 1e-5))
            if k not in ids: ids[k] = len(vl); vl.append(tuple(p))
            f.append(ids[k])
        if len(set(f)) >= 3 and frozenset(f) not in seenf:                 # drop degenerate and duplicate polygons (the source has about 970 of them)
            seenf.add(frozenset(f)); faces.append(tuple(f)); froles.append(role)
    me = bpy.data.meshes.new('dec'); me.from_pydata(vl, [], faces); me.update()
    ob = bpy.data.objects.new('dec', me); bpy.context.scene.collection.objects.link(ob)
    md = ob.modifiers.new('d', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = ratio; md.use_collapse_triangulate = True
    if protect_below:
        par = list(range(len(vl)))
        def find(a):
            while par[a] != a: par[a] = par[par[a]]; a = par[a]
            return a
        for f in faces:
            for a in f[1:]: par[find(a)] = find(f[0])
        cnt = {}
        for f in faces: cnt[find(f[0])] = cnt.get(find(f[0]), 0) + 1
        vg = ob.vertex_groups.new(name='keep')
        for i in range(len(vl)): vg.add([i], 1.0 if cnt.get(find(i), 0) < protect_below else 0.0, 'REPLACE')
        md.vertex_group = 'keep'
    bpy.context.view_layer.update()
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); m2 = ev.to_mesh()
    kd = KDTree(len(faces)); cents = []
    for i, f in enumerate(faces): kd.insert(sum((Vector(vl[j]) for j in f), Vector()) / len(f), i)
    kd.balance(); out = []
    for p in m2.polygons:
        co = [Vector(m2.vertices[i].co) for i in p.vertices]; c = sum(co, Vector()) / len(co)
        out.append((co, froles[kd.find(c)[1]]))
    ev.to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    if log is not None: log.append('LITE decimate %s: %d -> %d triangles (%d after dropping duplicates; ratio %.2f, parts under %d triangles protected)' % (label, sum(len(co) - 2 for co, _ in items), len(out), sum(len(f) - 2 for f in faces), ratio, protect_below))
    return out

def repin(polys, ref_min_z, hub):
    """Decimation can move the lowest lug up or down by a few mm: restretch the lower half of the tyre so the ground contact stays exact."""
    mnz = min(p[2] for co in polys for p in co)
    if abs(mnz - ref_min_z) < 0.0002: return polys
    k = (hub[2] - ref_min_z) / (hub[2] - mnz)                          # stretch / squash the lower half vertically so the lowest point is exactly where it was
    return [[Vector((p[0], p[1], hub[2] - (hub[2] - p[2]) * k if p[2] < hub[2] else p[2])) for p in co] for co in polys]

def wheel_mesh(name, parts, wf, offset, mats, lite, cols, log=None, ratio=None, hub_src=None):
    """Normal: slots Tire + Rim. Lite: one 'Wheel' material with vertex colours; the tyre may be decimated (ratio) to cut the lugs."""
    if not lite: return mesh_from(name, parts, wf, offset=offset, mats=mats)
    parts = dict(parts)
    if ratio:
        ref = min(p[2] for co in parts['Tire'] for p in co)
        parts['Tire'] = repin(decimate_polys(parts['Tire'], ratio, log, name), ref, hub_src)
    return mesh_single(name, parts, wf, offset=offset, cols=cols, mat=mats['Wheel'])

# ---- plain geometry in conformed Blender coordinates (metres; nose -Y, +X vehicle left, Z up)
def outward(faces, centre):
    """Flip any face whose normal points toward `centre` (convex solids)."""
    res = []
    for f in faces:
        n = Vector((0, 0, 0))
        for i in range(1, len(f) - 1): n += (f[i] - f[0]).cross(f[i + 1] - f[0])
        c = sum(f, Vector()) / len(f)
        res.append(f if n.dot(c - centre) >= 0 else list(reversed(f)))
    return res

def solid_box(x0, x1, y0, y1, z0, z1, tilt=0.0, hinge=Vector()):
    V = lambda x, y, z: Vector((x, y, z))
    fs = [[V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), V(x0, y0, z1)], [V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0)],
          [V(x0, y0, z0), V(x0, y0, z1), V(x1, y0, z1), V(x1, y0, z0)], [V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)],
          [V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)], [V(x0, y0, z1), V(x0, y1, z1), V(x1, y1, z1), V(x1, y0, z1)]]
    c = V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    if tilt:
        R = Matrix.Rotation(tilt, 3, 'X'); fs = [[hinge + R @ (p - hinge) for p in f] for f in fs]; c = hinge + R @ (c - hinge)
    return outward(fs, c)

def solid_prism(p0, p1, r0, r1=None, n=8, spin=0.0):
    """Closed n-sided prism / frustum from p0 (radius r0) to p1 (radius r1); caps are n-gons, a radius of 0 gives a point."""
    r1 = r0 if r1 is None else r1
    a = (p1 - p0).normalized(); ref = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
    u = a.cross(ref).normalized(); w = a.cross(u)
    ring = lambda c, r, i: c + (u * math.cos(2 * math.pi * i / n + spin) + w * math.sin(2 * math.pi * i / n + spin)) * r
    fs = []
    for i in range(n):
        j = (i + 1) % n
        if r0 > 0 and r1 > 0: fs.append([ring(p0, r0, i), ring(p0, r0, j), ring(p1, r1, j), ring(p1, r1, i)])
        elif r0 > 0: fs.append([ring(p0, r0, i), ring(p0, r0, j), p1.copy()])
        else: fs.append([p0.copy(), ring(p1, r1, j), ring(p1, r1, i)])
    if r0 > 0: fs.append([ring(p0, r0, i) for i in range(n)])
    if r1 > 0: fs.append([ring(p1, r1, i) for i in range(n)])
    return outward(fs, (p0 + p1) / 2)

def add_quads(ob, quads):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for q in quads:
        try: bm.faces.new([bm.verts.new(p) for p in q])
        except ValueError: pass
    bm.to_mesh(ob.data); bm.free()

def counts(root):
    tris = meshes = draws = 0; mats = set()
    for o in tree(root):
        if o.type != 'MESH': continue
        used = {p.material_index for p in o.data.polygons}
        meshes += 1; draws += len(used); mats |= {o.data.materials[i].name for i in used}
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return tris, meshes, len(mats), draws

def wheel_floor_report(root, log, label):
    bpy.context.view_layer.update(); worst = []
    for o in tree(root):
        if o.type == 'MESH' and 'wheel_' in o.name:
            worst.append('%s %.4f' % (o.name.replace('_mesh', ''), min((o.matrix_world @ v.co).z for v in o.data.vertices)))
    log.append('%s lowest point per wheel (m): %s' % (label, ', '.join(worst)))

def loose_parts(bm):
    seen = set(); parts = []
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; comp = []; seen.add(v.index)
        while st:
            x = st.pop(); comp.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen: seen.add(y.index); st.append(y)
        parts.append(comp)
    return parts

def fix_part_normals(bm):
    flipped = 0
    bm.verts.index_update()
    for comp in loose_parts(bm):
        fs = list({f for v in comp for f in v.link_faces})
        if not fs or any(not e.is_manifold for f in fs for e in f.edges): continue
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        vol = 0.0
        for f in fs:
            vs = [l.vert.co for l in f.loops]
            for i in range(1, len(vs) - 1): vol += vs[0].dot(vs[i].cross(vs[i + 1]))
        if vol < 0: bmesh.ops.reverse_faces(bm, faces=fs); flipped += 1
    return flipped

def clean(ob, stats):
    bm = bmesh.new(); bm.from_mesh(ob.data); n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    stats['merged'] += n0 - len(bm.verts)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    deg = [f for f in bm.faces if f.calc_area() < 1e-10]
    if deg: bmesh.ops.delete(bm, geom=deg, context='FACES')
    stats['flipped'] += fix_part_normals(bm)
    lim = math.radians(SMOOTH_DEG)
    for f in bm.faces: f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2: e.smooth = e.calc_face_angle(0) < lim
        else: e.smooth = False
    bm.to_mesh(ob.data); ob.data.update(); bm.free()

def empty(name, loc, parent, kind='PLAIN_AXES', size=0.06):
    e = bpy.data.objects.new(name, None); e.empty_display_type = kind; e.empty_display_size = size
    e.location = loc; bpy.context.scene.collection.objects.link(e); e.parent = parent
    return e

def torus(R, r, nu=20, nv=6):
    """Torus about local Y (ring in the XZ plane): list of quad coords."""
    quads = []
    def P(i, j):
        a = 2 * math.pi * i / nu; b = 2 * math.pi * j / nv
        return Vector(((R + r * math.cos(b)) * math.cos(a), r * math.sin(b), (R + r * math.cos(b)) * math.sin(a)))
    for i in range(nu):
        for j in range(nv): quads.append([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)])
    return quads

def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out

def export(root, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in tree(root): o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_cameras=False, export_lights=False, export_texcoords=False)

def ground_report(root, label, log):
    bpy.context.view_layer.update()
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in tree(root):
        if o.type != 'MESH': continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for k in range(3): mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
    log.append("%s bounds glTF x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f  (length %.2f m, width %.2f m, height %.2f m)" % (
        label, mn.x, mx.x, mn.z, mx.z, -mx.y, -mn.y, mx.y - mn.y, mx.x - mn.x, mx.z - mn.z))

def tris_of(root):
    t = 0
    for o in tree(root):
        if o.type == 'MESH': t += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return t

# ---------------------------------------------------------------- JUFF low-poly tractor
def juff_extras():
    """Parts the source tractor lacks (user decisions 2026-11-17): driver seat, rear hitch bracket + drawbar, PTO stub.
    Conformed Blender coords (nose -Y). Seat hip anchor (0, -0.326, 1.076); hitch_rear (0, 0.524, 0.576); pto (0, 0.494, 0.806)."""
    V = Vector
    seat_trim = (solid_box(-0.22, 0.22, -0.55, -0.17, 0.91, 1.00)                          # cushion (top 7.6 cm under the hip anchor)
                 + solid_box(-0.21, 0.21, -0.20, -0.13, 1.00, 1.50, tilt=-0.16, hinge=V((0, -0.165, 1.0))))   # backrest, leans back 9 degrees
    seat_metal = solid_box(-0.10, 0.10, -0.44, -0.28, 0.50, 0.91) + solid_box(-0.18, 0.18, -0.50, -0.22, 0.49, 0.54)   # pedestal + base plate on the cab floor (0.506)
    frame = (solid_box(-0.17, 0.17, 0.205, 0.265, 0.48, 0.70)                              # bracket plate bolted to the rear wall (y 0.222)
             + solid_box(-0.045, 0.045, 0.205, 0.62, 0.505, 0.555)                         # drawbar
             + solid_box(-0.045, 0.045, 0.58, 0.62, 0.555, 0.60) + solid_box(-0.045, 0.045, 0.46, 0.62, 0.60, 0.64)   # clevis post + upper strap (eye slot z 0.555..0.60)
             + solid_prism(V((-0.10, 0.25, 0.68)), V((-0.04, 0.46, 0.555)), 0.012, n=4) + solid_prism(V((0.10, 0.25, 0.68)), V((0.04, 0.46, 0.555)), 0.012, n=4))   # two braces
    metal = (solid_prism(V((0, 0.524, 0.50)), V((0, 0.524, 0.66)), 0.014)                 # hitch pin through the eye slot (axis = anchor_hitch_rear)
             + solid_prism(V((0, 0.26, 0.806)), V((0, 0.494, 0.806)), 0.022)               # PTO shaft, tip at anchor_pto
             + solid_prism(V((0, 0.26, 0.806)), V((0, 0.33, 0.806)), 0.05, n=10)           # PTO collar / guard ring
             + solid_prism(V((0, 0.46, 0.806)), V((0, 0.494, 0.806)), 0.028, n=6))         # splined tip
    return {'Trim': seat_trim, 'Metal': seat_metal + metal, 'Frame': frame}

def build_juff(log, lite=False):
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'low-poly_tractor_Blue', 'scene.gltf'))
    objs = {o.data.materials[0].name: o for o in bpy.context.scene.objects if o.type == 'MESH'}
    comp = {n: components(src_polys(o)) for n, o in objs.items()}
    tyres = comp['Material']; assert len(tyres) == 4, len(tyres)
    def wheel_key(c): return ('F' if c['c'].y < 0 else 'R') + ('L' if c['c'].x > 0.1 else 'R')
    tyre = {wheel_key(c): c for c in tyres}
    rimsrc = {k: [] for k in tyre}; roof = []
    for c in comp['Material.002']:
        if c['c'].z > 2.0: roof.append(c); continue
        rimsrc[wheel_key(c)].append(c)
    # source scale and frame
    S = 1.0
    rear_y = tyre['RL']['c'].y; ox = tyre['RL']['c'].x * 0 + (tyre['RL']['c'].x + tyre['RR']['c'].x) / 2
    G = max(-c['min'].z for c in tyres) * S
    xf = Frame(S, ox, rear_y, G)
    log.append('JUFF source bbox before: x %.3f..%.3f y %.3f..%.3f z %.3f..%.3f' % tuple(
        v for k in range(3) for v in (min(c['min'][k] for n in comp for c in comp[n]), max(c['max'][k] for n in comp for c in comp[n]))))
    # wheels (tyre Tire + rim Rim), hub = tyre bbox centre; extra drop so each tyre touches y=0 exactly
    wheels = {}; extra = {}
    for k, c in tyre.items():
        hub = xf(c['c']); lift = c['min'].z * S + G      # bottom height after the global lift
        hub.z -= lift; extra[k] = lift
        parts = {'Tire': [co for co, *_ in c['polys']], 'Rim': [co for r in rimsrc[k] for co, *_ in r['polys']]}
        # shift the polys down by `lift` by wrapping the frame for this wheel
        wheels[k] = (hub, parts)
    body = {m: [] for m in ('Paint', 'Frame', 'Trim', 'Metal', 'Glass', 'Light')}
    for c in comp['Material.001']: body['Paint'] += [co for co, *_ in c['polys']]
    for c in comp['Material.003']: body['Glass'] += [co for co, *_ in c['polys']]
    for n in ('Material.004', 'Material.006'):
        for c in comp[n]: body['Light'] += [co for co, *_ in c['polys']]
    for c in roof: body['Trim'] += [co for co, *_ in c['polys']]
    for c in comp['Material.005']:
        isexh = c['size'].z > 1.0 and c['c'].x < 0 and c['c'].y < -0.5
        iscap = c['size'].z > 0.2 and c['size'].x < 0.2 and abs(c['c'].y + 0.27) < 0.05 and c['c'].z > 1.3
        body['Metal' if (isexh or iscap) else 'Frame'] += [co for co, *_ in c['polys']]
    mats = {'Paint': material('Paint', (0.075, 0.126, 0.8, 1)), 'Frame': material('Frame', (0.015, 0.015, 0.015, 1)),
            'Tire': material('Tire', (0.0, 0.0, 0.0, 1)), 'Rim': material('Rim', (0.8, 0.8, 0.8, 1)),
            'Trim': material('Trim', (0.8, 0.8, 0.8, 1)), 'Metal': material('Metal', (0.02, 0.02, 0.025, 1)),
            'Glass': material('Glass', (0.0, 0.0, 0.0, 0.45)), 'Light': material('Light', (1, 1, 1, 1))}
    # steering wheel (the source has none): a ring in a tilted plane + a short column, added by this script
    tilt = math.radians(25)
    n = Vector((0, math.cos(tilt), math.sin(tilt)))                      # disc normal, toward the driver and up
    piv_src = Vector((ox, 0.20, 1.40 - G / S))
    x_ax = Vector((1, 0, 0)); z_ax = x_ax.cross(n).normalized()        # local Y = n
    rot = Matrix(((x_ax.x, n.x, z_ax.x), (x_ax.y, n.y, z_ax.y), (x_ax.z, n.z, z_ax.z)))
    ring = [[piv_src + rot @ p for p in q] for q in torus(0.19, 0.016)]
    col = []
    for i in range(8):
        a0, a1 = 2 * math.pi * i / 8, 2 * math.pi * (i + 1) / 8
        for (y0, y1) in ((0.0, -0.22),):
            P = lambda a, y: piv_src + rot @ Vector((0.025 * math.cos(a), y, 0.025 * math.sin(a)))
            col.append([P(a0, y0), P(a1, y0), P(a1, y1), P(a0, y1)])
    spokes = []
    for sgn in (1, -1):
        spokes.append([piv_src + rot @ Vector(p) for p in ((0.02 * sgn, 0, -0.02), (0.19 * sgn, 0, -0.02), (0.19 * sgn, 0, 0.02), (0.02 * sgn, 0, 0.02))])
    spokes.append([piv_src + rot @ Vector(p) for p in ((-0.02, 0, -0.19), (0.02, 0, -0.19), (0.02, 0, -0.02), (-0.02, 0, -0.02))])
    sw_world = xf(piv_src)
    steering = (sw_world, rot, {'Trim': ring + col + spokes})
    # anchors (source coords of the original model; converted by the frame)
    A = lambda x, y, z: xf(Vector((x, y, z)))
    cx = ox
    anchors = {
     'seat': A(cx, 0.60, 1.05), 'anchor_driver_seat': A(cx, 0.60, 1.05), 'anchor_engine_sound': A(cx, -0.70, 0.80),
     'exhaust': A(-0.22, -0.72, 2.27), 'anchor_exhaust': A(-0.22, -0.72, 2.27),
     'anchor_headlight_L': A(0.25, -1.42, 0.77), 'anchor_headlight_R': A(-0.05, -1.42, 0.77),
     'anchor_taillight_L': A(0.79, 1.39, 1.29), 'anchor_taillight_R': A(-0.59, 1.39, 1.29),
     'anchor_hitch_front': A(cx, -1.50, 0.55), 'anchor_hitch_rear': A(cx, 1.45, 0.55), 'anchor_pto': A(cx, 1.42, 0.78),
     'anchor_hands_L': A(cx + 0.19 * 0.9, 0.20 + 0.0, 1.40 - 0.06), 'anchor_hands_R': A(cx - 0.19 * 0.9, 0.20 + 0.0, 1.40 - 0.06),
     'anchor_foot_L': A(cx + 0.12, 0.30, 0.95), 'anchor_foot_R': A(cx - 0.12, 0.30, 0.95)}
    # wheels were built with `xf` but each needs its own extra drop: use a per-wheel frame
    stats = {'merged': 0, 'flipped': 0}
    root = bpy.data.objects.new('Tractor_JUFF_LowPoly_Source', None); root.empty_display_size = 0.2
    bpy.context.scene.collection.objects.link(root)
    bodyobs = {}
    for m, polys in body.items():
        if not polys: continue
        ob = mesh_from('Body_' + m, {m: polys}, xf, mats=mats); ob.parent = root; clean(ob, stats); bodyobs[m] = ob
    for m, quads in juff_extras().items():                                # seat, hitch bracket + drawbar, PTO (same meshes, same materials)
        add_quads(bodyobs[m], quads); clean(bodyobs[m], stats)
    cols = {'Tire': tuple(mats['Tire'].diffuse_color), 'Rim': tuple(mats['Rim'].diffuse_color)}
    if lite: mats['Wheel'] = wheel_material()
    for k, (hub, parts) in wheels.items():
        wf = Frame(S, ox, rear_y, G - extra[k])
        par = root
        if k in ('FL', 'FR'): par = empty('steer_' + k, hub, root, size=0.08)
        w = empty('wheel_' + k, hub if par is root else Vector(), par, kind='ARROWS', size=0.1)
        ob = wheel_mesh('wheel_%s_mesh' % k, parts, wf, hub, mats, lite, cols); ob.parent = w; clean(ob, stats)
    e = empty('steering_wheel', sw_world, root, kind='ARROWS', size=0.08); e.rotation_mode = 'QUATERNION'; e.rotation_quaternion = rot.to_quaternion()
    inv = (Matrix.Translation(sw_world) @ rot.to_4x4()).inverted()
    ob = mesh_from('steering_wheel_mesh', steering[2], xf, local_inv=inv, mats=mats); ob.parent = e; clean(ob, stats)
    for nme, p in anchors.items(): empty(nme, p, root)
    log.append('JUFF scale applied %.2f, global lift %.3f m, per-wheel extra drop %s' % (S, G, {k: round(v - G, 3) for k, v in extra.items()}))
    log.append('JUFF cleanup: %d duplicate vertices merged, %d closed parts flipped' % (stats['merged'], stats['flipped']))
    ground_report(root, 'JUFF', log)
    return root

# ---------------------------------------------------------------- KidBi tractor + tank
def classify_kidbi(rgb):
    r, g, b = rgb; mx, mn = max(rgb), min(rgb)
    if r > 0.55 and g < 0.3 and b < 0.15: return 'Paint'
    if r > 0.9 and g > 0.6 and b < 0.2: return 'TowFrame'
    if b > r + 0.2: return 'Tank'
    if r - b > 0.12 and r > g > b:                                  # warm: brown or tan
        return 'Rim' if mx > 0.6 else 'Frame'
    if mx < 0.20: return 'Trim'
    if mx < 0.285 and mx - mn < 0.1 and abs(r - 0.26) < 0.03 and abs(b - 0.14) < 0.03: return 'Trim'
    return 'Metal'

LITE_EXHAUST_RATIO = 0.62       # KidBi exhaust (4,346 triangles, 3,401 after duplicate polygons are dropped) collapse ratio on the welded object
LITE_EXHAUST_KEEP = 260        # loose parts under this many triangles (bolts, washers, elbows, brackets) are protected, so thin parts keep their shape
LITE_TYRE_RATIO = 0.50          # KidBi tyre lugs (tread only; the rim is never touched)

def find_lens_spot(paint_ob, anchor, rear=False):
    """Locate the red Paint ring of a headlight (loose part cluster around the anchor) in conformed coords.
    Returns (centre x, centre z, front y, outer radius). rear=True: the fender trailing edge near the taillight anchor."""
    bm = bmesh.new(); bm.from_mesh(paint_ob.data); bm.verts.ensure_lookup_table()
    sel = []
    for comp in loose_parts(bm):
        mn = Vector([min(v.co[k] for v in comp) for k in range(3)]); mx = Vector([max(v.co[k] for v in comp) for k in range(3)])
        c = (mn + mx) / 2; s = mx - mn
        if rear:
            if abs(c.x - anchor.x) < 0.2 and c.y > 0.3 and c.z > 0.9 and s.x < 0.3: sel.append((mn, mx))
        elif abs(c.x - anchor.x) < 0.14 and abs(c.z - anchor.z) < 0.14 and abs(c.y - anchor.y) < 0.26 and max(s.x, s.z) < 0.22 and c.y < -1.7: sel.append((mn, mx))
    bm.free()
    assert sel, 'no matching Paint part near anchor %s (rear=%s)' % (tuple(anchor), rear)
    mn = Vector([min(m[0][k] for m in sel) for k in range(3)]); mx = Vector([max(m[1][k] for m in sel) for k in range(3)])
    return (mn + mx) / 2, mn, mx

def lens_solid(cx, cz, y_pole, y_front, y_back, r_front, r_back, n=12, sign=-1):
    """One closed lens along Y: domed pole, front ring, back ring, flat back. sign -1 faces the nose (-Y), +1 faces the rear."""
    P = lambda y, r, i: Vector((cx + r * math.cos(2 * math.pi * i / n), y, cz + r * math.sin(2 * math.pi * i / n)))
    fs = []
    for i in range(n):
        j = (i + 1) % n
        fs.append([Vector((cx, y_pole, cz)), P(y_front, r_front, j), P(y_front, r_front, i)])
        fs.append([P(y_front, r_front, i), P(y_front, r_front, j), P(y_back, r_back, j), P(y_back, r_back, i)])
    fs.append([P(y_back, r_back, i) for i in range(n)])
    return outward(fs, Vector((cx, (y_pole + y_back) / 2, cz)))

def kidbi_lenses(paint_ob, anchors, log):
    """Two headlight lenses set into the red ring openings and two taillight lenses on the rear fender trailing edges ('Light' material).
    Moves anchor_headlight_* onto the ring centre (the old ones sat 6 cm off it) and anchor_taillight_* onto the lenses
    (the old ones were inside the rear tyres, so no light could ever show there)."""
    quads = []
    for s in ('L', 'R'):
        c, mn, mx = find_lens_spot(paint_ob, anchors['anchor_headlight_' + s], False)
        yf = mn.y; cx, cz = c.x, c.z                                                     # ring front face (most negative y), ring centre
        quads += lens_solid(cx, cz, yf + 0.002, yf + 0.009, yf + 0.055, 0.071, 0.050)    # covers the grey reflector disc; pole 2 mm behind the ring face, barrel into the bowl
        old = anchors['anchor_headlight_' + s]; anchors['anchor_headlight_' + s] = Vector((cx, yf + 0.002, cz))
        log.append('KidBi headlight %s: ring centre x %.3f z %.3f front y %.3f, anchor moved from %s' % (s, cx, cz, yf, tuple(round(v, 3) for v in old)))
        # taillight: round lens on the trailing edge of the rear fender (edge y max near x 0.56..0.79, z 1.06..1.13)
        sx = 1.0 if s == 'L' else -1.0
        vs = [v.co for v in paint_ob.data.vertices if 0.5 < sx * v.co.x < 0.8 and 1.0 < v.co.z < 1.2 and v.co.y > 0.3]
        yb = max(v.y for v in vs); edge = [v for v in vs if v.y > yb - 0.012]
        tx = sx * (min(sx * v.x for v in edge) + max(sx * v.x for v in edge)) / 2; tz = (min(v.z for v in edge) + max(v.z for v in edge)) / 2
        quads += lens_solid(tx, tz, yb + 0.024, yb + 0.019, yb - 0.025, 0.030, 0.028, n=10)      # pole 2.4 cm behind the edge (faces +Y), back 2.5 cm inside the fender
        old = anchors['anchor_taillight_' + s]; anchors['anchor_taillight_' + s] = Vector((tx, yb + 0.024, tz))
        log.append('KidBi taillight %s: fender edge y %.3f, lens at x %.3f z %.3f, anchor moved from %s' % (s, yb, tx, tz, tuple(round(v, 3) for v in old)))
    return quads

def build_kidbi(log, kind, lite=False):
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'tractor_with_tank_low_poly_3d_model', 'scene.gltf'))
    img = bpy.data.images['Material_baseColor.png']; W, H = img.size; px = list(img.pixels)
    def sample(uv):
        x = min(W - 1, max(0, int(uv[0] * W))); y = min(H - 1, max(0, int(uv[1] * H))); i = (y * W + x) * 4
        return tuple(px[i:i + 3])
    objs = {}
    for o in bpy.context.scene.objects:
        if o.type != 'MESH': continue
        n = o.name.lower()
        for a, b in (('arri', 'arriere'), ('��', '')): pass
        objs[n] = o
    def find(*keys):
        r = [o for n, o in objs.items() if all(k in n for k in keys)]
        return r
    def polys_of(o): return src_polys(o)
    # roles per part (face colour for the mixed parts)
    def roles(o, fixed=None):
        out = {}
        for co, mi, uv in src_polys(o):
            role = fixed or classify_kidbi(sample(uv))
            out.setdefault(role, []).append(co)
        return out
    def merge(a, b):
        for k, v in b.items(): a.setdefault(k, []).extend(v)
    # wheels
    tw = {}; trailer_w = {}
    for n, o in objs.items():
        if 'pneu' in n or 'jante' in n:
            trailer = 'trailer' in n
            side = 'L' if 'gauche' in n else 'R'
            if trailer: axle = 'F' if ' 1' in n else 'R'
            else: axle = 'F' if 'avant' in n else 'R'
            key = axle + side
            d = trailer_w if trailer else tw
            d.setdefault(key, {'Tire': [], 'Rim': []})
            d[key]['Tire' if 'pneu' in n else 'Rim'] += [co for co, *_ in src_polys(o)]
    def hubof(parts):
        mn, mx = bbox([(c,) for c in parts['Tire']]); return (mn + mx) / 2, mn, mx
    S = 1.6
    rr = {k: hubof(v) for k, v in tw.items()}
    ox = (rr['RL'][0].x + rr['RR'][0].x) / 2; oy = (rr['RL'][0].y + rr['RR'][0].y) / 2
    allw = list(tw.values()) + list(trailer_w.values())
    G = max(-hubof(v)[1].z for v in allw) * S
    xf = Frame(S, ox, oy, G)
    pts = []
    # body parts
    body = {}
    names = {'capot': None, 'chassis_material_0': None}
    seat_dbg = None
    chassis_polys = None; tank_polys = {}; echap = None; volant = None; tankchas = None; tankshell = None
    trailer_parts = {}                                                 # polys by role for the trailer body
    for n, o in objs.items():
        if 'pneu' in n or 'jante' in n: continue
        if 'volant' in n: volant = o; continue
        if n.startswith('logo'):
            r = {}
            for co, mi, uv in src_polys(o):
                role = 'Trim' if sum(sample(uv)) < 0.6 else 'Metal'
                r.setdefault(role, []).append(co)
            merge(body, r); continue
        if n.startswith('trailer_chassis.001'):
            merge(trailer_parts, roles(o, 'Trim')); continue
        if n.startswith('trailer_chassis'):
            merge(trailer_parts, roles(o)); tankchas = o; continue
        if n.startswith('trailer_tank'):
            merge(trailer_parts, roles(o, 'Tank'));
            if '.001' not in n: tankshell = o
            continue
        if n.startswith('chassis'): chassis_polys = src_polys(o)
        if n.startswith('echappement'):
            echap = src_polys(o)
            if lite and kind != 'tank':                                      # LITE: decimate the exhaust only (whole welded object, thin loose parts protected)
                items = [(co, classify_kidbi(sample(uv))) for co, mi, uv in src_polys(o)]
                out = {}
                for co, role in decimate_roles(items, LITE_EXHAUST_RATIO, LITE_EXHAUST_KEEP, log, 'KidBi exhaust'): out.setdefault(role, []).append(co)
                merge(body, out); continue
        if n.startswith('pare soleil') or n.startswith('fan'): merge(body, roles(o, 'Metal')); continue
        if n.startswith('garde'): merge(body, roles(o, 'Paint')); continue
        if n.startswith('radiateur') or n.startswith('marche'): merge(body, roles(o, 'Trim')); continue
        merge(body, roles(o))
    # seat probe: highest chassis point near the seat zone
    seat = [p for co, *_ in chassis_polys for p in co if abs(p.x - ox) < 0.12 and 0.45 < p.y < 0.85]
    seat_top = max(seat, key=lambda p: p.z) if seat else None
    log.append('KidBi seat probe (source coords): top %s from %d points' % (tuple(round(v, 3) for v in seat_top) if seat_top else None, len(seat)))
    # steering wheel
    vp = src_polys(volant); vmn, vmx = bbox(vp); vc = (vmn + vmx) / 2
    import numpy as np
    pts3 = np.array([[p.x, p.y, p.z] for co, *_ in vp for p in co]); cov = np.cov((pts3 - pts3.mean(0)).T)
    w_, v_ = np.linalg.eigh(cov); nrm = Vector(tuple(v_[:, 0])).normalized()
    if nrm.y < 0: nrm = -nrm                                            # toward the driver (+Y rear)
    x_ax = Vector((1, 0, 0)); z_ax = x_ax.cross(nrm).normalized(); x_ax = nrm.cross(z_ax).normalized()
    rotS = Matrix(((x_ax.x, nrm.x, z_ax.x), (x_ax.y, nrm.y, z_ax.y), (x_ax.z, nrm.z, z_ax.z)))
    log.append('KidBi steering wheel centre %s normal %s' % (tuple(round(v, 3) for v in vc), tuple(round(v, 3) for v in nrm)))
    sw_world = xf(vc)
    steering = (sw_world, rotS, roles(volant, 'Trim'))
    mats = {'Paint': material('Paint', srgb(0.82, 0.165, 0.06)), 'Frame': material('Frame', srgb(0.40, 0.245, 0.16)),
            'Tire': material('Tire', srgb(0.25, 0.25, 0.25)), 'Rim': material('Rim', srgb(0.72, 0.55, 0.41)),
            'Trim': material('Trim', srgb(0.17, 0.15, 0.13)), 'Metal': material('Metal', srgb(0.50, 0.50, 0.50)),
            'Tank': material('Tank', srgb(0.02, 0.34, 0.73)), 'TowFrame': material('TowFrame', srgb(0.99, 0.72, 0.0)),
            'Light': material('Light', srgb(1.0, 0.93, 0.70))}               # bright warm lens colour, never black, nothing emissive
    wcols = {'Tire': tuple(mats['Tire'].diffuse_color), 'Rim': tuple(mats['Rim'].diffuse_color)}
    if lite: mats['Wheel'] = wheel_material()
    # anchors
    A = lambda x, y, z: xf(Vector((x, y, z)))
    hitch_r = extreme(chassis_polys, 1, +1)
    hitch_t = extreme(src_polys(tankchas), 1, -1)
    tipE = extreme(echap, 2, +1)
    st = seat_top if seat_top else Vector((ox, 0.68, 0.80))
    anchors = {
     'seat': A(ox, st.y, st.z - 0.04), 'anchor_driver_seat': A(ox, st.y, st.z - 0.04), 'anchor_engine_sound': A(ox, -0.25, 0.60),
     'exhaust': A(tipE.x, tipE.y, tipE.z), 'anchor_exhaust': A(tipE.x, tipE.y, tipE.z),
     'anchor_headlight_L': A(ox + 0.23, -0.61, 0.62), 'anchor_headlight_R': A(ox - 0.23, -0.61, 0.62),
     'anchor_taillight_L': A(ox + 0.46, 0.93, 0.58), 'anchor_taillight_R': A(ox - 0.46, 0.93, 0.58),
     'anchor_hitch_front': A(ox, -0.56, 0.30), 'anchor_hitch_rear': A(hitch_r.x, hitch_r.y, hitch_r.z),
     'anchor_pto': A(ox, hitch_r.y - 0.05, 0.42),
     'anchor_hands_L': A(vc.x + 0.12, vc.y, vc.z), 'anchor_hands_R': A(vc.x - 0.12, vc.y, vc.z),
     'anchor_foot_L': A(ox + 0.13, 0.22, 0.46), 'anchor_foot_R': A(ox - 0.13, 0.22, 0.46)}
    log.append('KidBi hitch_rear source %s, trailer tongue source %s' % (tuple(round(v, 3) for v in hitch_r), tuple(round(v, 3) for v in hitch_t)))
    stats = {'merged': 0, 'flipped': 0}
    # trailer frame
    ty = (hubof(trailer_w['FL'])[0].y + hubof(trailer_w['RL'])[0].y) / 2
    tank_origin = Vector(((ox - ox) * S, (ty - oy) * S, 0.0))           # ground point between the trailer axles (tractor frame)
    def tank_children(parent, grouped):
        """Trailer body + wheels + anchors under `parent`, positions relative to tank_origin.
        grouped (the `tank` child group of the combined file) prefixes every name with tank_ so names stay unique."""
        off = tank_origin
        pre = 'tank_' if grouped else ''
        apre = 'tank_' if grouped else 'anchor_'
        for m, polys in trailer_parts.items():
            if not polys: continue
            ob = mesh_from('Tank_Body_' + m, {m: polys}, xf, offset=off, mats=mats); ob.parent = parent; clean(ob, stats)
        for k, parts in trailer_w.items():
            hub, mn, mx = hubof(parts); extra = mn.z * S + G
            wf = Frame(S, ox, oy, G - extra); hubc = xf(hub) - Vector((0, 0, extra)) - off
            w = empty(pre + 'wheel_' + k, hubc, parent, kind='ARROWS', size=0.1)
            ob = wheel_mesh('%swheel_%s_mesh' % (pre, k), parts, wf, off + hubc, mats, lite, wcols, log, LITE_TYRE_RATIO, hub); ob.parent = w; clean(ob, stats)
        tm = bbox([(c,) for c in [p for m in ('Tank',) for p in trailer_parts[m]]])
        fill = extreme(src_polys(tankshell), 2, +1, 0.02)
        loc = lambda p: xf(p) - off
        tc = (tm[0] + tm[1]) / 2
        for nme, p in {'tank_fill': loc(fill), apre + 'cargo': loc(tc), apre + 'hitch_front': loc(hitch_t),
                       apre + 'drain': loc(Vector((ox, tm[1].y, tm[0].z + 0.15)))}.items():
            empty(nme, p, parent)
    res = {}
    if kind in ('tractor', 'combined'):
        wheels = {k: None for k in tw}
        root = bpy.data.objects.new('Tractor_KidBi_Tank_Source', None); root.empty_display_size = 0.2
        bpy.context.scene.collection.objects.link(root)
        paint_ob = None
        for m, polys in body.items():
            if not polys: continue
            if lite and m == 'Rim':                                       # LITE: the tan steering column shares the wheel material (vertex colour)
                ob = mesh_single('Body_Rim', {'Rim': polys}, xf, cols=wcols, mat=mats['Wheel'])
            else: ob = mesh_from('Body_' + m, {m: polys}, xf, mats=mats)
            ob.parent = root; clean(ob, stats)
            if m == 'Paint': paint_ob = ob
        lens = kidbi_lenses(paint_ob, anchors, log)                       # headlight + taillight lenses ('Light'), anchors moved onto them
        lob = bpy.data.objects.new('Body_Light', bpy.data.meshes.new('Body_Light')); bpy.context.scene.collection.objects.link(lob)
        lob.data.materials.append(mats['Light']); lob.parent = root; add_quads(lob, lens); clean(lob, stats)
        for p in lob.data.polygons: p.material_index = 0
        for k, parts in tw.items():
            hub, mn, mx = hubof(parts); extra = mn.z * S + G
            wf = Frame(S, ox, oy, G - extra); hubc = xf(hub) - Vector((0, 0, extra))
            par = root
            if k in ('FL', 'FR'): par = empty('steer_' + k, hubc, root, size=0.08)
            w = empty('wheel_' + k, hubc if par is root else Vector(), par, kind='ARROWS', size=0.1)
            ob = wheel_mesh('wheel_%s_mesh' % k, parts, wf, hubc, mats, lite, wcols, log, LITE_TYRE_RATIO, hub); ob.parent = w; clean(ob, stats)
        e = empty('steering_wheel', sw_world, root, kind='ARROWS', size=0.08); e.rotation_mode = 'QUATERNION'; e.rotation_quaternion = rotS.to_quaternion()
        inv = (Matrix.Translation(sw_world) @ rotS.to_4x4()).inverted()
        ob = mesh_from('steering_wheel_mesh', steering[2], xf, local_inv=inv, mats=mats); ob.parent = e; clean(ob, stats)
        for nme, p in anchors.items(): empty(nme, p, root)
        if kind == 'combined':
            tg = empty('tank', tank_origin, root, kind='CUBE', size=0.15); tank_children(tg, True)
        res['root'] = root
    else:                                                              # tank only: root at the ground between the axles
        root = bpy.data.objects.new('Tow_Tank_Source', None); root.empty_display_size = 0.2
        bpy.context.scene.collection.objects.link(root); tank_children(root, False); res['root'] = root
    log.append('KidBi %s: scale applied %.2f, global lift %.4f m, %d dup vertices merged, %d closed parts flipped' % (kind, S, G, stats['merged'], stats['flipped']))
    ground_report(res['root'], 'KidBi ' + kind, log)
    return res['root']

# ---------------------------------------------------------------- render
def render(glb, prefix):
    reset(); bpy.ops.import_scene.gltf(filepath=glb)
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH': pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    c = (mn + mx) / 2; size = (mx - mn).length
    for o in bpy.context.scene.objects:                                # lite files: show the vertex colours (Workbench 'material' colour ignores them)
        if o.type == 'MESH' and o.data.color_attributes:
            at = o.data.color_attributes[0]; cache = {}; o.data.materials.clear()
            for p in o.data.polygons:
                col = tuple(round(v, 3) for v in at.data[p.loop_indices[0]].color)
                if col not in cache:
                    m = bpy.data.materials.new('vc'); m.diffuse_color = col; o.data.materials.append(m); cache[col] = len(o.data.materials) - 1
                p.material_index = cache[col]
    if '-bright' in ARGS:                                              # diagnostic: lift near-black materials so shapes can be judged (render only)
        for m in bpy.data.materials:
            d = m.diffuse_color
            if max(d[0], d[1], d[2]) < 0.1: m.diffuse_color = {'Frame': (0.30, 0.22, 0.17, 1), 'Metal': (0.45, 0.50, 0.55, 1), 'Tire': (0.14, 0.14, 0.14, 1)}.get(m.name, (0.2, 0.2, 0.2, 1))
    if '-cut' in ARGS:                                                 # diagnostic: slice away everything at x > 0.03 to see inside the cab
        bpy.context.view_layer.update()
        for o in list(bpy.context.scene.objects):
            if o.type != 'MESH': continue
            bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0.03, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
            wm = o.matrix_world.copy(); o.parent = None; o.matrix_world = Matrix.Identity(4); bm.to_mesh(o.data); bm.free()
    if '-anchors' in ARGS:                                          # diagnostic: a red ball on every anchor empty, blue on pivots
        am = bpy.data.materials.new('am'); am.diffuse_color = (1, 0, 0, 1); pm2 = bpy.data.materials.new('pm'); pm2.diffuse_color = (0, 0.6, 1, 1)
        for o in list(bpy.context.scene.objects):
            if o.type == 'EMPTY' and o.name.split('.')[0] not in ('Tractor_JUFF_LowPoly_Source',):
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045, location=o.matrix_world.translation, segments=8, ring_count=6)
                s = bpy.context.active_object; s.data.materials.append(pm2 if o.name.startswith(('wheel', 'steer')) else am)
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True
    try: sh.show_backface_culling = ('-cull' in ARGS)
    except Exception: pass
    sc.render.resolution_x = 960; sc.render.resolution_y = 640
    w = bpy.data.worlds.new('w'); w.color = (0.62, 0.68, 0.75); sc.world = w
    bpy.ops.mesh.primitive_plane_add(size=size * 3, location=(c.x, c.y, 0))
    pl = bpy.context.active_object; pm = bpy.data.materials.new('floor'); pm.diffuse_color = (0.35, 0.36, 0.34, 1); pl.data.materials.append(pm)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
    views = {'front34': (1, -1.3, 0.7), 'side': (1, 0, 0.04), 'rear34': (-1, 1.3, 0.7), 'top': (0, 0.001, 1), 'front': (0, -1, 0.05)}
    scale = {n: 1.7 if n == 'top' else 1.1 for n in views}; centre = {n: c for n in views}
    closes = [a[6:] for a in ARGS if a.startswith('close=')]             # close=name:cx,cy,cz:size:dx,dy,dz  (conformed Blender coords)
    if closes:
        views = {}; scale = {}; centre = {}
        for s in closes:
            nm, cc, sz, dd = s.split(':'); views[nm] = tuple(float(v) for v in dd.split(',')); centre[nm] = Vector([float(v) for v in cc.split(',')]); scale[nm] = float(sz)
    for name, d in views.items():
        d = Vector(d).normalized(); cam.location = centre[name] + d * size * 2
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = size * scale[name] if not closes else scale[name]
        cam.data.clip_start = 0.01; cam.data.clip_end = size * 8
        sc.render.filepath = prefix + '_' + name + '.png'; bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- main
if MODE == 'build':
    os.makedirs(OUT, exist_ok=True)
    which = (ARGS + ['build', 'all'])[1]
    log = []
    def done(r, label, p):
        export(r, p); t, m, ma, d = counts(r)
        log.append('%s: %d triangles, %d meshes, %d materials, %d draw calls -> %s' % (label, t, m, ma, d, p)); wheel_floor_report(r, log, label)
    for lite in (False, True):
        sfx = '_lite' if lite else ''
        if which in ('juff', 'all'):
            done(build_juff(log, lite), 'JUFF' + sfx, os.path.join(OUT, 'tractor_juff_lowpoly%s.glb' % sfx))
        if which in ('kidbi', 'all'):
            for kind, fn in (('combined', 'tractor_kidbi_tank'), ('tractor', 'tractor_kidbi_only'), ('tank', 'tow_kidbi_tank')):
                done(build_kidbi(log, kind, lite), 'KidBi %s%s' % (kind, sfx), os.path.join(OUT, fn + sfx + '.glb'))
    for l in log: print('LOG', l)
elif MODE == 'render':
    render(ARGS[1], ARGS[2])
