# PET1->PET2 v2: improved game cat asset (cleaned mesh <=3500 tris, 24-bone rig, 12 clips + mouth_open shape key).
# Source: ..\Assets Sim Project\cat.blend (READ-ONLY) -> assets-src\cat\cat_v2.blend + cat_v2.glb + preview_v2_*.png
# Usage (Blender 5.2 headless):
#   blender -b --python scripts/cat-v2.py -- build
#   blender -b --python scripts/cat-v2.py -- render
#   blender -b --python scripts/cat-v2.py -- glbcheck
#   blender -b --python scripts/cat-v2.py -- all
import bpy, bmesh, math, os, sys, struct, json
from mathutils import Vector, Matrix, Euler, kdtree

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(REPO), "Assets Sim Project", "cat.blend")
OUT_DIR = os.path.join(REPO, "assets-src", "cat")
DST = os.path.join(OUT_DIR, "cat_v2.blend")
GLB = os.path.join(OUT_DIR, "cat_v2.glb")

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = (ARGS + ['all'])[0]

FPS = 24
BODY_LEN = 0.45
CX = -0.18
SCALE = BODY_LEN / (0.12 - (-0.4998))

def src_to_final(v):
    R = Matrix.Rotation(math.radians(90), 3, 'Z')
    c = Vector(v); c.x -= CX
    return (R @ c) * SCALE

# All bone coordinates directly in final Blender space (nose -Y, left +X, up +Z, feet y=0)
BONES = {
    'root':          (None,            (0.000,  0.000, 0.000), (0.000,  0.000, 0.073)),
    'spine1':        ('root',          (0.000,  0.203, 0.215), (0.000,  0.116, 0.228)),
    'spine2':        ('spine1',        (0.000,  0.116, 0.228), (0.000,  0.022, 0.238)),
    'spine3':        ('spine2',        (0.000,  0.022, 0.238), (0.000, -0.065, 0.252)),
    'neck':          ('spine3',        (0.000, -0.065, 0.252), (0.008, -0.130, 0.288)),
    'head':          ('neck',          (0.008, -0.130, 0.288), (0.024, -0.212, 0.288)),
    'ear.L':         ('head',          (0.048, -0.155, 0.340), (0.064, -0.154, 0.380)),
    'ear.R':         ('head',          (-0.010,-0.182, 0.340), (-0.024,-0.195, 0.380)),
    'tail1':         ('spine1',        (0.000,  0.205, 0.215), (0.000,  0.280, 0.180)),
    'tail2':         ('tail1',         (0.000,  0.280, 0.180), (0.000,  0.350, 0.148)),
    'tail3':         ('tail2',         (0.000,  0.350, 0.148), (0.000,  0.420, 0.135)),
    'tail4':         ('tail3',         (0.000,  0.420, 0.135), (0.000,  0.490, 0.150)),
    'front_upper.L': ('spine3',        (0.047, -0.088, 0.175), (0.046, -0.098, 0.092)),
    'front_lower.L': ('front_upper.L', (0.046, -0.098, 0.092), (0.047, -0.108, 0.042)),
    'front_paw.L':   ('front_lower.L', (0.047, -0.108, 0.042), (0.047, -0.132, 0.008)),
    'front_upper.R': ('spine3',        (-0.047,-0.088, 0.175), (-0.046,-0.098, 0.092)),
    'front_lower.R': ('front_upper.R', (-0.046,-0.098, 0.092), (-0.047,-0.108, 0.042)),
    'front_paw.R':   ('front_lower.R', (-0.047,-0.108, 0.042), (-0.047,-0.132, 0.008)),
    'hind_upper.L':  ('spine1',        (0.068,  0.168, 0.195), (0.076,  0.155, 0.115)),
    'hind_lower.L':  ('hind_upper.L',  (0.076,  0.155, 0.115), (0.079,  0.158, 0.055)),
    'hind_paw.L':    ('hind_lower.L',  (0.079,  0.158, 0.055), (0.080,  0.118, 0.008)),
    'hind_upper.R':  ('spine1',        (-0.068, 0.168, 0.195), (-0.076, 0.155, 0.115)),
    'hind_lower.R':  ('hind_upper.R',  (-0.076, 0.155, 0.115), (-0.079, 0.158, 0.055)),
    'hind_paw.R':    ('hind_lower.R',  (-0.079, 0.158, 0.055), (-0.080, 0.118, 0.008)),
}

ANCHORS = {
    'anchor_mouth': ('head', (0.025, -0.212, 0.268)),
    'anchor_head':  ('head', (0.022, -0.165, 0.345)),
}

# ---------------------------------------------------------------- mesh cleanup & decimation
def connected_components(bm):
    visited = set(); comps = []
    for v in bm.verts:
        if v.index in visited: continue
        stack = [v]; comp = []; visited.add(v.index)
        while stack:
            cur = stack.pop(); comp.append(cur)
            for e in cur.link_edges:
                ov = e.other_vert(cur)
                if ov.index not in visited:
                    visited.add(ov.index); stack.append(ov)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    return comps

def clean_and_decimate(mesh):
    me = mesh.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()

    # 1. Keep Comp 0 (body), Comp 1 (inner mouth), Comp 3 & 4 (green eyes); drop Comp 2 & floating whiskers/shards
    comps = connected_components(bm)
    keep_verts = set(v.index for i in (0, 1, 3, 4) for v in comps[i])
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep_verts], context='VERTS')
    bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()

    comps = connected_components(bm)
    c0_set = {v.index for v in comps[0]}
    c1_set = {v.index for v in comps[1]}

    # Trim inner rear half of mouth pocket (Comp 1) to save ~300 unseen tris while keeping tongue/front cavity
    del_c1 = [f for f in bm.faces if f.verts[0].index in c1_set and f.calc_center_median().y > -0.185]
    bmesh.ops.delete(bm, geom=del_c1, context='FACES')
    bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()

    # 2. Strip paper-thin double-sided fins on hind thighs, cheek ruff, belly, and inward back-faces on tail
    centers = [f.calc_center_median() for f in bm.faces]
    kd = kdtree.KDTree(len(bm.faces))
    for i, c in enumerate(centers): kd.insert(c, i)
    kd.balance()

    fin_faces = set()
    for i, f in enumerate(bm.faces):
        if f.verts[0].index not in c0_set: continue
        c = centers[i]
        in_lips = (c.y < -0.175 and abs(c.x) < 0.055 and 0.255 < c.z < 0.285)
        if in_lips: continue
        for co, j, dist in kd.find_range(c, 0.005):
            if j <= i or bm.faces[j].verts[0].index not in c0_set: continue
            fj = bm.faces[j]
            if f.normal.dot(fj.normal) < -0.65:
                if (0.12 < c.y <= 0.22 and c.z < 0.22 and abs(c.x) > 0.03) or \
                   (c.y < -0.10 and c.z > 0.24 and c.z < 0.34 and abs(c.x) > 0.065) or \
                   (c.y < -0.12 and 0.18 < c.z <= 0.24 and abs(c.x) > 0.072) or \
                   (-0.10 < c.y < 0.15 and c.z < 0.125):
                    fin_faces.add(f); fin_faces.add(fj)
                elif c.y > 0.24 and dist < 0.0035:
                    axis = Vector((0.0, c.y, 0.145))
                    out_dir = (c - axis)
                    fin_faces.add(f if f.normal.dot(out_dir) < fj.normal.dot(out_dir) else fj)

    # Belly dangling fin
    for f in bm.faces:
        if f.verts[0].index not in c0_set: continue
        c = f.calc_center_median()
        if -0.10 < c.y < 0.15 and 0.095 < c.z < 0.120 and abs(c.x) < 0.034:
            if any(e.is_boundary or not e.is_manifold for e in f.edges) or abs(f.normal.x) > 0.68:
                fin_faces.add(f)

    # Cheek protruding dark blade tips
    for f in bm.faces:
        if f.verts[0].index not in c0_set: continue
        c = f.calc_center_median()
        if abs(c.x) > 0.068 and -0.172 < c.y < -0.140 and 0.18 < c.z < 0.24:
            if any(e.is_boundary for e in f.edges) and f.normal.y < -0.60:
                fin_faces.add(f)

    bmesh.ops.delete(bm, geom=list(fin_faces), context='FACES')

    # Tuck muzzle whisker spike & hanging chest diamond tip smoothly upward
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        if v.co.y < -0.214 and v.co.z < 0.275: v.co.y = -0.210
        if v.co.y < -0.205 and v.co.z < 0.264 and len(v.link_faces) <= 3: v.co.z = 0.266
        if -0.125 < v.co.y < -0.090 and abs(v.co.x) < 0.022 and 0.080 < v.co.z < 0.115:
            v.co.z = 0.116

    # Clean boundary ears in thigh & belly zones
    for _ in range(3):
        bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        ears = []
        for f in bm.faces:
            if not any(v.index in c0_set for v in f.verts): continue
            c = f.calc_center_median()
            if (0.12 < c.y <= 0.22 and c.z < 0.22 and abs(c.x) > 0.03) or \
               (-0.10 < c.y < 0.15 and 0.095 < c.z < 0.122 and abs(c.x) < 0.036):
                if sum(1 for e in f.edges if e.is_boundary) >= 2:
                    ears.append(f)
        if not ears: break
        bmesh.ops.delete(bm, geom=ears, context='FACES')

    bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    loose_v = [v for v in bm.verts if not v.link_faces]
    if loose_v: bmesh.ops.delete(bm, geom=loose_v, context='VERTS')

    # Weld narrow belly midline seam
    bm.edges.ensure_lookup_table()
    belly_b = [e for e in bm.edges if e.is_boundary and -0.09 < e.verts[0].co.y < 0.14 and 0.10 < e.verts[0].co.z < 0.130]
    bverts_mid = list({v for e in belly_b for v in e.verts if abs(v.co.x) < 0.015})
    for v in bverts_mid: v.co.x = 0.0
    if bverts_mid: bmesh.ops.remove_doubles(bm, verts=bverts_mid, dist=0.005)

    # Fill tight small pinholes (not mouth)
    bm.edges.ensure_lookup_table()
    seen_e = set()
    for e in bm.edges:
        if not e.is_boundary or e.index in seen_e: continue
        loop_e = []; cur_e = e; cur_v = e.verts[0]
        for _ in range(200):
            if cur_e.index in seen_e: break
            seen_e.add(cur_e.index); loop_e.append(cur_e)
            nxt_v = cur_e.other_vert(cur_v)
            nxt_es = [ee for ee in nxt_v.link_edges if ee.is_boundary and ee != cur_e]
            if not nxt_es: break
            cur_e = nxt_es[0]; cur_v = nxt_v
        if len(loop_e) >= 3:
            pts = [v.co for ee in loop_e for v in ee.verts]
            dx = max(p.x for p in pts) - min(p.x for p in pts)
            dy = max(p.y for p in pts) - min(p.y for p in pts)
            dz = max(p.z for p in pts) - min(p.z for p in pts)
            cy = sum(p.y for p in pts)/len(pts)
            if cy > -0.170 and max(dx, dy, dz) < 0.020:
                bmesh.ops.holes_fill(bm, edges=loop_e, sides=8)

    bm.to_mesh(me); bm.free(); me.update()
    me.calc_loop_triangles()

    # Uniform Decimate to ~3,320 triangles (strictly <= 3,500)
    dec = mesh.modifiers.new('Dec', 'DECIMATE')
    dec.decimate_type = 'COLLAPSE'
    dec.ratio = 3320.0 / len(me.loop_triangles)
    dec.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.modifier_apply(modifier='Dec')

    # Drop any tiny <15-vert detached fragments left over after decimate
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    comps = connected_components(bm)
    tiny = [v for c in comps if len(c) < 15 for v in c]
    if tiny: bmesh.ops.delete(bm, geom=tiny, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()

    # Clamp feet strictly to z=0.000
    min_z = min(v.co.z for v in me.vertices)
    for v in me.vertices: v.co.z -= min_z
    me.update()
    me.calc_loop_triangles()
    print(f"CLEANED MESH: tris={len(me.loop_triangles)}, verts={len(me.vertices)}")

# ---------------------------------------------------------------- shape key for Meow
def add_mouth_shape_key(mesh):
    me = mesh.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    comps = connected_components(bm)
    # Identify inner mouth component (Comp 1, around y=-0.20..-0.17, z=0.27..0.296)
    c1_set = set()
    for c in comps[1:]:
        cy = sum(v.co.y for v in c)/len(c); cz = sum(v.co.z for v in c)/len(c)
        if cy < -0.16 and cz < 0.298:
            c1_set.update(v.index for v in c)
    bm.free()

    mesh.shape_key_add(name='Basis', from_mix=False)
    sk = mesh.shape_key_add(name='mouth_open', from_mix=False)
    hinge = Vector((0.025, -0.162, 0.273))
    rot = Matrix.Rotation(math.radians(32), 3, 'X') # +rx rotates front -Y downward (-Z) to open jaw
    for v in me.vertices:
        p = v.co.copy()
        w = 0.0
        if v.index in c1_set:
            # Lower half of mouth pocket moves with lower jaw
            if p.z < 0.279:
                w = min(1.0, max(0.0, (0.279 - p.z) / 0.007))
        else:
            # Lower chin/jaw on body mesh: below upper lip line (z < 0.273) and front of chin (y < -0.168)
            if p.y < -0.166 and 0.228 < p.z < 0.273 and abs(p.x - 0.024) < 0.036:
                wy = min(1.0, max(0.0, (-0.166 - p.y) / 0.024))
                wz = min(1.0, max(0.0, (0.273 - p.z) / 0.008)) * min(1.0, max(0.0, (p.z - 0.228) / 0.020))
                wx = min(1.0, max(0.0, (0.036 - abs(p.x - 0.024)) / 0.012))
                w = wy * wz * wx
        if w > 0.0:
            q = hinge + (rot @ (p - hinge))
            sk.data[v.index].co = p.lerp(q, w)
        else:
            sk.data[v.index].co = p
    me.update()

# ---------------------------------------------------------------- region-aware smooth weights
RADIUS = {
    'root': 0.05, 'spine1': 0.095, 'spine2': 0.10, 'spine3': 0.10,
    'neck': 0.068, 'head': 0.075,
    'tail1': 0.052, 'tail2': 0.048, 'tail3': 0.045, 'tail4': 0.042,
}
def bone_radius(n):
    if n in RADIUS: return RADIUS[n]
    if n.startswith('ear'): return 0.022
    if 'paw' in n: return 0.028
    return 0.036

def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length

def compute_weights(mesh, arm):
    me = mesh.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    comps = connected_components(bm)
    # Eyes + mouth pocket locked to head
    head_locked = set(v.index for c in comps[1:] for v in c)
    # Neighbor map for edge-based smoothing
    nbrs = {v.index: [e.other_vert(v).index for e in v.link_edges] for v in bm.verts}
    bm.free()

    segs = {n: (Vector(h), Vector(t)) for n, (par, h, t) in BONES.items() if n != 'root'}
    bone_names = list(BONES.keys())
    for n in bone_names: mesh.vertex_groups.new(name=n)

    wmap = [{} for _ in range(len(me.vertices))]
    for v in me.vertices:
        p = v.co
        if v.index in head_locked:
            wmap[v.index] = {'head': 1.0}
            continue
        # Anatomical region filter to avoid cross-limb/belly bleeding in curled sleep
        is_tail = (p.y > 0.210 and p.z > 0.075)
        is_front_leg = (p.z < 0.115 and p.y < -0.04)
        is_hind_leg = (p.z < 0.115 and p.y > 0.04)
        ws = []
        for n, (a, b) in segs.items():
            if n.endswith('.L') and p.x < -0.01: continue
            if n.endswith('.R') and p.x > 0.01: continue
            if is_tail and not (n.startswith('tail') or n == 'spine1'): continue
            if not is_tail and p.y < 0.195 and n.startswith('tail'): continue
            if is_front_leg and not n.startswith('front_'): continue
            if is_hind_leg and not n.startswith('hind_'): continue
            if n.startswith('ear') and p.z < 0.330: continue
            d = seg_dist(p, a, b)
            # Bias ear bones strictly to vertices close to ear cone
            if n.startswith('ear') and d > 0.028: continue
            val = 1.0 / (d / bone_radius(n) + 0.28) ** 4
            ws.append((val, n))
        if not ws:
            ws = [(1.0, 'spine2')]
        ws.sort(reverse=True); ws = ws[:4]
        tot = sum(w for w, _ in ws)
        wmap[v.index] = {n: w / tot for w, n in ws}

    # 2 passes of edge-neighbor Laplacian smoothing (preserving head_locked & L/R separation)
    for _ in range(2):
        nxt = [None] * len(me.vertices)
        for i, v in enumerate(me.vertices):
            if i in head_locked or not nbrs[i]:
                nxt[i] = dict(wmap[i]); continue
            acc = {k: val * 2.0 for k, val in wmap[i].items()}
            for nb in nbrs[i]:
                if nb in head_locked: continue
                for k, val in wmap[nb].items():
                    if k.endswith('.L') and v.co.x < -0.01: continue
                    if k.endswith('.R') and v.co.x > 0.01: continue
                    acc[k] = acc.get(k, 0.0) + val
            items = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
            tot = sum(val for _, val in items)
            nxt[i] = {k: val / tot for k, val in items}
        wmap = nxt

    for i, wd in enumerate(wmap):
        for n, val in wd.items():
            mesh.vertex_groups[n].add([i], val, 'REPLACE')

    mod = mesh.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    mesh.parent = arm
    mesh.matrix_parent_inverse = arm.matrix_world.inverted()

# ---------------------------------------------------------------- animation helpers
S = math.sin; C = math.cos; TAU = 2 * math.pi
def clamp01(x): return max(0.0, min(1.0, x))
def smoothstep(x): t = clamp01(x); return t * t * (3 - 2 * t)
def bump(t, a, b): return S(math.pi * clamp01((t - a) / (b - a))) ** 2 if a <= t <= b else 0.0

def lerp_dict(d0, d1, alpha):
    keys = set(d0.keys()) | set(d1.keys())
    out = {}
    for k in keys:
        if k in ('_scale', '_loc', '_mouth'): continue
        a = d0.get(k, (0, 0, 0)); b = d1.get(k, (0, 0, 0))
        out[k] = tuple(a[i] + (b[i] - a[i]) * alpha for i in range(3))
    # _loc
    l0 = d0.get('_loc', {}).get('root', (0, 0, 0))
    l1 = d1.get('_loc', {}).get('root', (0, 0, 0))
    out['_loc'] = {'root': tuple(l0[i] + (l1[i] - l0[i]) * alpha for i in range(3))}
    # _scale
    s0 = d0.get('_scale', {}); s1 = d1.get('_scale', {})
    skeys = set(s0.keys()) | set(s1.keys())
    if skeys:
        out['_scale'] = {}
        for sk in skeys:
            v0 = s0.get(sk, 1.0); v1 = s1.get(sk, 1.0)
            v0 = (v0, v0, v0) if isinstance(v0, (int, float)) else v0
            v1 = (v1, v1, v1) if isinstance(v1, (int, float)) else v1
            out['_scale'][sk] = tuple(v0[i] + (v1[i] - v0[i]) * alpha for i in range(3))
    return out

def tail_wave(p, amp, lag=0.6):
    return {f'tail{i+1}': (0, 0, amp * (0.7 + 0.3 * i) * S(p - lag * i)) for i in range(4)}

# ---------------------------------------------------------------- 12 clips
def pose_idle(t): # 3.0 s loop
    p = TAU * t; br = S(TAU * 2 * t)
    d = {'spine2': (0.8 * br, 0, 0), 'spine3': (-0.8 * br, 0, 0),
         'head': (1.5 * S(p), 0, 3 * S(p + 1)), 'neck': (0, 0, 2 * S(p + 1))}
    fl = bump(t, 0.30, 0.65) * S(TAU * 3 * (t - 0.30) / 0.35)
    for i in range(4): d[f'tail{i+1}'] = (0, 0, 4 * S(p - 0.6 * i) + (10 + 4 * i) * fl)
    et = bump(t, 0.72, 0.80)
    d['ear.L'] = (0, 0, 14 * et); d['ear.R'] = (0, 0, 0)
    d['_scale'] = {'spine2': 1 + 0.012 * br}
    return d

def pose_walk(t): # 1.0 s loop, diagonal gait, paws never dip below y=0
    p = TAU * t; d = {}
    for name, ph in (('front', 0.0), ('hind', math.pi)):
        for s in ('L', 'R'):
            q = p + ph + (math.pi if s == 'R' else 0.0)
            swing = S(q)
            lift = max(0.0, -C(q)) # lifted forward swing
            if name == 'front':
                th = 24 * swing
                d['front_upper.' + s] = (th, 0, 0)
                d['front_lower.' + s] = (-6 + 34 * lift, 0, 0)
                d['front_paw.' + s]   = (-th * 0.45 - 12 * lift, 0, 0)
            else:
                th = 18 * swing
                # Knee bends smoothly forward when lifted, and keeps planted leg short enough not to dip
                d['hind_upper.' + s] = (-th, 0, 0)
                d['hind_lower.' + s] = (14 - 32 * lift + 6 * max(0.0, swing), 0, 0)
                d['hind_paw.' + s]   = (th * 0.25 + 14 * lift - 6 * max(0.0, swing), 0, 0)
    d['spine1'] = (0, 0, 2.5 * S(p)); d['spine2'] = (0, 0, -1.5 * S(p)); d['spine3'] = (0, 0, -2.5 * S(p))
    d['neck'] = (0, 0, 2 * S(p)); d['head'] = (-2 + 2 * S(2 * p), 0, 2 * S(p))
    d.update(tail_wave(p, 5, 0.7))
    d['_loc'] = {'root': (0, 0, 0.016 + 0.006 * S(2 * p + 0.6))}
    return d

def pose_run(t): # 0.667 s (16 frames) loop, bounding feline gallop (~2.4 m/cycle)
    p = TAU * t; d = {}
    # Bounding spine flex/extend
    bound = C(p) # +1 = tucked/gathered, -1 = extended flight
    d['spine1'] = (-10 * bound, 0, 0)
    d['spine2'] = (-12 * bound, 0, 0)
    d['spine3'] = (10 * bound, 0, 0)
    d['neck']   = (14 * bound - 4, 0, 0)
    d['head']   = (8 * bound - 6, 0, 0)
    # Front pair (slight L/R lead offset 0.14 cycle)
    for s, off in (('L', 0.0), ('R', 0.14 * TAU)):
        q = p - off
        reach = -S(q) # +1 = reach forward, -1 = push back
        lift = max(0.0, -C(q))
        d['front_upper.' + s] = (-38 * reach - 6, 0, 0)
        d['front_lower.' + s] = (26 + 28 * lift - 16 * max(0.0, reach), 0, 0)
        d['front_paw.' + s]   = (14 * reach - 12 * lift, 0, 0)
    # Hind pair (opposite phase to front pair, slight L/R lead)
    for s, off in (('L', 0.0), ('R', 0.14 * TAU)):
        q = p + math.pi - off
        push = S(q) # +1 = kick backward, -1 = tuck forward under belly
        lift = max(0.0, -C(q))
        d['hind_upper.' + s] = (40 * push + 6, 0, 0)
        d['hind_lower.' + s] = (-28 - 24 * lift, 0, 0)
        d['hind_paw.' + s]   = (-10 * push + 18 * lift, 0, 0)
    for i in range(4):
        d[f'tail{i+1}'] = (8 + 8 * S(p - 0.5 * i), 0, 4 * S(p - 0.5 * i))
    d['_loc'] = {'root': (0, 0, 0.044 - 0.020 * bound)}
    return d

def pose_eat(t): # 2.0 s loop, crouched front stance so anchor_mouth reaches ~6 cm bowl with paws at z=0
    p = TAU * t; ch = S(TAU * 4 * t)
    d = {
        'spine1': (2, 0, 0), 'spine2': (4, 0, 0), 'spine3': (8, 0, 0),
        'neck': (46 + 2.5 * ch, 0, 0), 'head': (22 + 5 * ch, 0, -2),
        # Slight crouch in front legs (forward -rx, bend elbow +rx, paw flat -rx)
        'front_upper.L': (-28, 0, 4), 'front_upper.R': (-28, 0, -4),
        'front_lower.L': (52, 0, 0),  'front_lower.R': (52, 0, 0),
        'front_paw.L':   (-24, 0, 0), 'front_paw.R':   (-24, 0, 0),
        # Slight knee bend on hind legs to keep level
        'hind_upper.L':  (-16, 0, 0), 'hind_upper.R':  (-16, 0, 0),
        'hind_lower.L':  (30, 0, 0),  'hind_lower.R':  (30, 0, 0),
        'hind_paw.L':    (-14, 0, 0), 'hind_paw.R':    (-14, 0, 0),
    }
    d.update(tail_wave(p, 5, 0.7))
    d['ear.L'] = (0, 0, 10 * bump(t, 0.55, 0.65)); d['ear.R'] = (0, 0, 0)
    d['_scale'] = {'spine2': 1 + 0.008 * S(p)}
    d['_loc'] = {'root': (0, 0, 0.010)}
    return d

def pose_pet(t): # 2.0 s loop
    p = TAU * t; pur = S(TAU * 12 * t)
    d = {'head': (-12 + 1.0 * pur, 0, 8 * S(p)), 'neck': (-7, 0, 5 * S(p)),
         'spine3': (-3, 0, -3 * S(p)), 'spine1': (0, 0, 2 * S(p))}
    d.update(tail_wave(p, 9, 0.8))
    et = bump(t, 0.15, 0.25) + bump(t, 0.62, 0.72)
    d['ear.L'] = (0, 0, 14 * et); d['ear.R'] = (0, 0, -12 * et)
    d['_scale'] = {'spine2': (1 + 0.012 * pur, 1 + 0.012 * pur, 1 - 0.03 - 0.015 * S(p)),
                   'spine3': (1 + 0.008 * pur, 1 + 0.008 * pur, 1 - 0.02)}
    return d

def pose_sleep(t): # 4.0 s loop: real curled-up sleeping cat, head tucked near front paws, tail wrapped around same side
    p = TAU * t; br = S(TAU * 2 * t)
    d = {
        # +rz curls spine/neck/head toward cat's RIGHT (-X); -rz on tail wraps around the SAME right side!
        'spine1': (6, 8, 28),
        'spine2': (6 + 1.0 * br, 6, 34),
        'spine3': (12 - 0.8 * br, 4, 34),
        'neck':   (24, -4, 32),
        'head':   (14, -10, 26),
        # Front legs folded flat forward/under chest (-rx forward, +rx fold lower back, -rx flat paw)
        'front_upper.L': (-78, 6, -6),  'front_upper.R': (-76, -6, 8),
        'front_lower.L': (146, 0, 0),   'front_lower.R': (142, 0, 0),
        'front_paw.L':   (-68, 0, 0),   'front_paw.R':   (-66, 0, 0),
        # Hind legs folded flat forward against belly (-rx thigh forward, +rx shin back, -rx paw flat)
        'hind_upper.L':  (-74, -8, 6),  'hind_upper.R':  (-70, 8, -8),
        'hind_lower.L':  (138, 0, 0),   'hind_lower.R':  (134, 0, 0),
        'hind_paw.L':    (-64, 0, 0),   'hind_paw.R':    (-64, 0, 0),
        # Tail wraps around the right flank toward the paws (-rz on tail matches +rz on spine!)
        'tail1': (-8, 0, -34),
        'tail2': (-4, 0, -40),
        'tail3': (0, 0, -38),
        'tail4': (4, 0, -32 + 2.5 * S(p)),
        'ear.L': (4, 0, 6 * bump(t, 0.45, 0.55)),
        'ear.R': (4, 0, 0),
    }
    d['_scale'] = {'spine2': (1 + 0.020 * br, 1 + 0.020 * br, 1 + 0.028 * br),
                   'spine3': (1 + 0.012 * br, 1 + 0.012 * br, 1 + 0.018 * br)}
    d['_loc'] = {'root': (0, 0, -0.095)}
    return d

def pose_lie_down(t): # 1.25 s one-shot: idle(0) -> drop chest/hips -> curl into sleep(0)
    a = pose_idle(0.0); b = pose_sleep(0.0)
    u_drop = smoothstep(t / 0.72)
    u_curl = smoothstep((t - 0.15) / 0.85)
    d = lerp_dict(a, b, u_curl)
    for k in ('front_upper.L','front_upper.R','front_lower.L','front_lower.R','front_paw.L','front_paw.R',
              'hind_upper.L','hind_upper.R','hind_lower.L','hind_lower.R','hind_paw.L','hind_paw.R'):
        v0 = a.get(k, (0,0,0)); v1 = b.get(k, (0,0,0))
        d[k] = tuple(v0[i] + (v1[i] - v0[i]) * u_drop for i in range(3))
    l0 = a.get('_loc',{}).get('root',(0,0,0)); l1 = b.get('_loc',{}).get('root',(0,0,0))
    d['_loc'] = {'root': tuple(l0[i] + (l1[i] - l0[i]) * u_drop for i in range(3))}
    return d

def pose_get_up(t): # 1.25 s one-shot: sleep(0) -> lift head & push front up -> stand into idle(0)
    a = pose_sleep(0.0); b = pose_idle(0.0)
    u_head = smoothstep(t / 0.65)
    u_legs = smoothstep((t - 0.20) / 0.80)
    d = lerp_dict(a, b, u_legs)
    for k in ('neck', 'head', 'spine3', 'tail1', 'tail2', 'tail3', 'tail4'):
        v0 = a.get(k, (0,0,0)); v1 = b.get(k, (0,0,0))
        d[k] = tuple(v0[i] + (v1[i] - v0[i]) * u_head for i in range(3))
    return d

def pose_sit(t): # 3.0 s loop: hindquarters seated on floor, upright chest, alert head, tail curled beside
    p = TAU * t; br = S(TAU * 2 * t)
    d = {
        'spine1': (-16, 0, 0),
        'spine2': (-18 + 0.8 * br, 0, 0),
        'spine3': (-10 - 0.8 * br, 0, 0),
        'neck':   (24, 0, 2.5 * S(p)),
        'head':   (20 + 1.5 * S(p), 0, 3 * S(p + 0.8)),
        # Front legs angled straight down to floor in front of chest
        'front_upper.L': (36, 0, 0), 'front_upper.R': (36, 0, 0),
        'front_lower.L': (6, 0, 0),  'front_lower.R': (6, 0, 0),
        'front_paw.L':   (2, 0, 0),  'front_paw.R':   (2, 0, 0),
        # Hind legs folded FORWARD under haunch (-rx thigh forward, +rx shin back, -rx paw flat)
        'hind_upper.L':  (-68, 0, 6),  'hind_upper.R':  (-68, 0, -6),
        'hind_lower.L':  (124, 0, 0),  'hind_lower.R':  (124, 0, 0),
        'hind_paw.L':    (-56, 0, 0),  'hind_paw.R':    (-56, 0, 0),
        # Tail lifted slightly & curled gracefully around side (+rx lifts tail up!)
        'tail1': (-14, 0, 20), 'tail2': (10, 0, 30), 'tail3': (10, 0, 28), 'tail4': (6, 0, 20 + 4 * S(p)),
        'ear.L': (0, 0, 12 * bump(t, 0.60, 0.70)),
        'ear.R': (0, 0, 0),
    }
    d['_scale'] = {'spine2': 1 + 0.012 * br}
    d['_loc'] = {'root': (0, 0, -0.056)}
    return d

def pose_sit_groom(t): # 3.0 s loop: Sit(0) -> lift front left paw -> 3 licks -> lower back to Sit(0)
    base = pose_sit(t)
    w = smoothstep(min(t / 0.22, (1.0 - t) / 0.22))
    lick = S(TAU * 3 * clamp01((t - 0.20) / 0.60)) if 0.20 <= t <= 0.80 else 0.0
    if w > 0:
        d = dict(base)
        d['front_upper.L'] = (36 - 86 * w, 0, -8 * w)
        d['front_lower.L'] = (6 + 96 * w + 8 * lick * w, 0, -6 * w)
        d['front_paw.L']   = (2 + 24 * w, 0, 0)
        nx, ny, nz = base['neck']; hx, hy, hz = base['head']
        d['neck'] = (nx + 16 * w, ny, nz + 8 * w)
        d['head'] = (hx + 18 * w + 7 * lick * w, hy - 8 * w, hz + 10 * w)
        d['ear.L'] = (0, 0, 8 * w)
        return d
    return base

def pose_stretch(t): # 2.0 s one-shot: idle(0) -> deep front bow stretch, tail curled UP -> return to idle(0)
    base = pose_idle(0.0)
    if t < 0.28: w = smoothstep(t / 0.28)
    elif t < 0.68: w = 1.0
    else: w = smoothstep((1.0 - t) / 0.32)
    stretch_pose = {
        'spine1': (-8, 0, 0), 'spine2': (12, 0, 0), 'spine3': (26, 0, 0),
        'neck': (-22, 0, 0), 'head': (-18, 0, 0),
        # Front legs stretched forward (-rx) and lowered to elbows/paws
        'front_upper.L': (-62, 0, 0), 'front_upper.R': (-62, 0, 0),
        'front_lower.L': (36, 0, 0),  'front_lower.R': (36, 0, 0),
        'front_paw.L':   (26, 0, 0),  'front_paw.R':   (26, 0, 0),
        # Hind legs planted tall
        'hind_upper.L':  (10, 0, 0),  'hind_upper.R':  (10, 0, 0),
        'hind_lower.L':  (-16, 0, 0), 'hind_lower.R':  (-16, 0, 0),
        'hind_paw.L':    (6, 0, 0),   'hind_paw.R':    (6, 0, 0),
        # +rx curls tail UPWARD in a happy question-mark arc!
        'tail1': (18, 0, 0), 'tail2': (22, 0, 0), 'tail3': (20, 0, 0), 'tail4': (14, 0, 0),
        '_loc': {'root': (0, 0, 0.008)},
    }
    return lerp_dict(base, stretch_pose, w)

def pose_meow(t): # 1.0 s one-shot: head lifts, mouth_open opens smoothly, ears perk -> return to idle(0)
    base = pose_idle(0.0)
    w = bump(t, 0.0, 1.0)
    m = bump(t, 0.10, 0.88)
    d = dict(base)
    d['neck'] = (-10 * w, 0, 0)
    d['head'] = (-16 * w, 0, 0)
    d['ear.L'] = (6 * w, 0, 8 * w)
    d['ear.R'] = (6 * w, 0, -8 * w)
    d['tail1'] = (-8 * w, 0, 0); d['tail2'] = (-6 * w, 0, 0)
    d['_scale'] = {'spine2': 1 + 0.015 * w}
    d['_mouth'] = m
    return d

# (duration_s, pose_fn, frame_step, is_loop)
CLIPS = {
    'idle':      (3.0,   pose_idle,      3, True),
    'walk':      (1.0,   pose_walk,      1, True),
    'eat':       (2.0,   pose_eat,       2, True),
    'pet':       (2.0,   pose_pet,       1, True),
    'sleep':     (4.0,   pose_sleep,     4, True),
    'Lie_Down':  (1.25,  pose_lie_down,  2, False),
    'Get_Up':    (1.25,  pose_get_up,    2, False),
    'Sit':       (3.0,   pose_sit,       3, True),
    'Sit_Groom': (3.0,   pose_sit_groom, 2, True),
    'Stretch':   (2.0,   pose_stretch,   2, False),
    'Meow':      (1.0,   pose_meow,      1, False),
    'Run':       (0.667, pose_run,       1, True),
}

def posebone(arm, n): return arm.pose.bones[n]
def rot_key(pb, rx, ry, rz, frame):
    Rb = pb.bone.matrix_local.to_3x3()
    Rw = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ').to_matrix()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (Rb.inverted() @ Rw @ Rb).to_quaternion()
    pb.keyframe_insert('rotation_quaternion', frame=frame)
def loc_key(pb, d, frame):
    Rb = pb.bone.matrix_local.to_3x3()
    pb.location = Rb.inverted() @ Vector(d)
    pb.keyframe_insert('location', frame=frame)
def scl_key(pb, s, frame):
    pb.scale = s
    pb.keyframe_insert('scale', frame=frame)

def make_actions(arm, mesh):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    arm.animation_data_create()
    kb = mesh.data.shape_keys
    kb.animation_data_create()
    sk = kb.key_blocks['mouth_open']

    for name, (dur, fn, step, is_loop) in CLIPS.items():
        for pb in arm.pose.bones:
            pb.location = (0,0,0); pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1,0,0,0); pb.scale = (1,1,1)
        sk.value = 0.0

        act = bpy.data.actions.new(name); act.use_fake_user = True
        arm.animation_data.action = act

        has_mouth = (name == 'Meow')
        sact = None
        if has_mouth:
            sact = bpy.data.actions.new(name + '_sk'); sact.use_fake_user = True
            kb.animation_data.action = sact

        n = int(round(dur * FPS))
        frames = list(range(0, n + 1, step))
        if frames[-1] != n: frames.append(n)
        for f in frames:
            t = (f % n) / n if (is_loop and f < n) else (0.0 if is_loop else f / n)
            d = fn(t)
            scl = d.pop('_scale', {}); loc = d.pop('_loc', {}); mouth = d.pop('_mouth', 0.0)
            for pb in arm.pose.bones:
                rx, ry, rz = d.get(pb.name, (0, 0, 0))
                rot_key(pb, rx, ry, rz, f)
                if pb.name in loc: loc_key(pb, loc[pb.name], f)
                if pb.name in scl:
                    s = scl[pb.name]; scl_key(pb, (s, s, s) if isinstance(s, float) else s, f)
            if has_mouth:
                sk.value = mouth
                sk.keyframe_insert('value', frame=f)

        act.frame_range = (0, n); act.use_frame_range = True; act.use_cyclic = is_loop
        tr = arm.animation_data.nla_tracks.new(); tr.name = name
        st = tr.strips.new(name, 0, act); st.name = name
        arm.animation_data.action = None

        if has_mouth:
            sact.frame_range = (0, n); sact.use_frame_range = True; sact.use_cyclic = False
            strk = kb.animation_data.nla_tracks.new(); strk.name = name
            sst = strk.strips.new(name, 0, sact); sst.name = name
            kb.animation_data.action = None

    bpy.ops.object.mode_set(mode='OBJECT')

# Verify ground clearance and measure anchor_mouth during eat!
def audit_poses(arm, mesh):
    dg = bpy.context.evaluated_depsgraph_get()
    for name in ('idle', 'walk', 'run', 'eat', 'sit', 'sleep'):
        clip_name = 'Run' if name == 'run' else ('Sit' if name == 'sit' else name)
        act = bpy.data.actions[clip_name]
        n = int(act.frame_range[1])
        arm.animation_data.action = act
        min_z = 999.0; mouth_zs = []
        for f in range(0, n + 1, max(1, n // 8)):
            bpy.context.scene.frame_set(f)
            bpy.context.view_layer.update()
            ev_mesh = mesh.evaluated_get(dg)
            me_ev = ev_mesh.to_mesh()
            zs = [(mesh.matrix_world @ v.co).z for v in me_ev.vertices]
            min_z = min(min_z, min(zs))
            ev_mesh.to_mesh_clear()
            anc = bpy.data.objects['anchor_mouth']
            mouth_zs.append(round(anc.matrix_world.translation.z, 4))
        print(f"AUDIT {clip_name:10s}: min_z={min_z:+.4f}, mouth_z=({min(mouth_zs):.4f}..{max(mouth_zs):.4f})")
        arm.animation_data.action = None

def build():
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=SRC)
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o)

    mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    mesh.name = 'Cat'; mesh.data.name = 'Cat'
    mesh.vertex_groups.clear()
    for m in list(mesh.modifiers): mesh.modifiers.remove(m)

    for v in mesh.data.vertices:
        v.co = src_to_final(v.co)
    mesh.data.update()

    img = bpy.data.images['tripo_image_41ed4cd2_0']
    img.scale(512, 512); img.pack()

    clean_and_decimate(mesh)

    # Armature
    arm_d = bpy.data.armatures.new('CatArmature'); arm = bpy.data.objects.new('CatRig', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n, (par, h, t) in BONES.items():
        b = arm_d.edit_bones.new(n); b.head = Vector(h); b.tail = Vector(t); eb[n] = b
    for n, (par, h, t) in BONES.items():
        if par: eb[n].parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT')

    compute_weights(mesh, arm)
    add_mouth_shape_key(mesh)

    # Anchors
    for n, (bone, pos) in ANCHORS.items():
        e = bpy.data.objects.new(n, None); e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 0.02
        bpy.context.scene.collection.objects.link(e)
        e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = bone
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.Translation(Vector(pos))

    make_actions(arm, mesh)
    audit_poses(arm, mesh)

    bpy.ops.wm.save_as_mainfile(filepath=DST)
    export(arm, mesh)

def export(arm, mesh):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm, mesh] + [o for o in bpy.data.objects if o.type == 'EMPTY']: o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    kw = dict(
        filepath=GLB, export_format='GLB', use_selection=True,
        export_yup=True, export_apply=False, export_cameras=False, export_lights=False,
        export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_image_format='JPEG', export_image_quality=88,
        export_draco_mesh_compression_enable=False, export_def_bones=False,
        export_frame_rate=FPS, export_force_sampling=True,
        export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=True,
    )
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = {k: v for k, v in kw.items() if k in props or k in ('filepath', 'export_format')}
    bpy.ops.export_scene.gltf(**kw)
    print(f"EXPORTED {GLB} ({os.path.getsize(GLB)} bytes)")

# ---------------------------------------------------------------- previews
def render():
    bpy.ops.wm.open_mainfile(filepath=DST)
    os.makedirs(OUT_DIR, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 640, 480
    cam = bpy.data.objects.get('PrevCam')
    if not cam:
        cam = bpy.data.objects.new('PrevCam', bpy.data.cameras.new('PrevCam')); sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.85; sc.camera = cam

    arm = bpy.data.objects['CatRig']
    mesh = bpy.data.objects['Cat']
    kb = mesh.data.shape_keys

    for t in arm.animation_data.nla_tracks: t.mute = True
    for t in kb.animation_data.nla_tracks: t.mute = True

    def snap(clip, frame, tag, views=('front', 'side', 'rear')):
        for pb in arm.pose.bones:
            pb.location = (0,0,0); pb.rotation_quaternion = (1,0,0,0); pb.scale = (1,1,1)
        kb.key_blocks['mouth_open'].value = 0.0
        arm.animation_data.action = bpy.data.actions[clip] if clip else None
        kb.animation_data.action = bpy.data.actions.get(clip + '_sk') if clip else None
        sc.frame_set(frame)
        bpy.context.view_layer.update()

        cam.data.ortho_scale = 0.65 if tag == 'meow' else 0.85
        for v in views:
            if v == 'side':
                cam.location = (3, 0.08, 0.18); cam.rotation_euler = (math.radians(90), 0, math.radians(90))
            elif v == 'front':
                cam.location = (0, -3, 0.18); cam.rotation_euler = (math.radians(90), 0, 0)
            elif v == 'rear':
                cam.location = (0, 3, 0.18); cam.rotation_euler = (math.radians(90), 0, math.radians(180))
            elif v == 'top':
                cam.location = (0, 0.08, 3); cam.rotation_euler = (0, 0, 0)
            sc.render.filepath = os.path.join(OUT_DIR, f"preview_v2_{tag}_{v}.png")
            bpy.ops.render.render(write_still=True)

    # Required: Idle, Sit, Walk, Eat, Sleep (curled), Meow (front, side, rear) + extras for visual check
    snap('idle',       0,  'idle',      ('front', 'side', 'rear'))
    snap('Sit',        0,  'sit',       ('front', 'side', 'rear'))
    snap('walk',       6,  'walk',      ('front', 'side', 'rear'))
    snap('eat',       12,  'eat',       ('front', 'side', 'rear'))
    snap('sleep',     12,  'sleep',     ('front', 'side', 'rear', 'top'))
    snap('Meow',      12,  'meow',      ('front', 'side', 'rear'))
    snap('Sit_Groom', 36,  'sit_groom', ('front', 'side'))
    snap('Stretch',   22,  'stretch',   ('side', 'front'))
    snap('Run',        4,  'run_bound', ('side',))
    snap('Run',       12,  'run_tuck',  ('side',))
    snap('Lie_Down',  15,  'lie_down',  ('side',))
    snap('Get_Up',    15,  'get_up',    ('side',))
    snap('pet',       24,  'pet',       ('side',))

    # Wireframe showing topology in Idle
    arm.animation_data.action = bpy.data.actions['idle']
    kb.animation_data.action = None
    sc.frame_set(0); bpy.context.view_layer.update()
    wf = mesh.copy(); wf.data = mesh.data.copy()
    sc.collection.objects.link(wf)
    wm = wf.modifiers.new('Wire', 'WIREFRAME'); wm.thickness = 0.0012; wm.use_replace = True
    mat = bpy.data.materials.new('WireMat'); mat.diffuse_color = (0.05, 0.9, 0.9, 1.0)
    wf.data.materials.clear(); wf.data.materials.append(mat)
    cam.data.ortho_scale = 0.85
    cam.location = (3, 0.08, 0.18); cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    sc.render.filepath = os.path.join(OUT_DIR, "preview_v2_wireframe.png")
    bpy.ops.render.render(write_still=True)

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
            zero_w = sum(1 for c in ws if c == 0)
            print('MESH', o.name, 'tris', len(me.loop_triangles), 'verts', len(me.vertices),
                  'groups', len(o.vertex_groups), 'max influences', max(ws), 'unweighted', zero_w,
                  'materials', len(me.materials), 'shape_keys', len(me.shape_keys.key_blocks) if me.shape_keys else 0)
            vs = [o.matrix_world @ v.co for v in me.vertices]
            print('BOUNDS', [(round(min(v[i] for v in vs), 4), round(max(v[i] for v in vs), 4)) for i in range(3)])
        if o.type == 'ARMATURE':
            print('ARMATURE', o.name, 'bones', len(o.data.bones))
    print('IMAGES', [(i.name, i.size[:]) for i in bpy.data.images])
    with open(GLB, 'rb') as f:
        f.read(12); clen, _ = struct.unpack('<II', f.read(8))
        gjson = json.loads(f.read(clen))
    print('GLB JSON meshes:', [m['name'] for m in gjson.get('meshes', [])], 'nodes:', len(gjson.get('nodes', [])))
    for a in gjson.get('animations', []):
        max_t = 0.0
        for s in a.get('samplers', []):
            acc = gjson['accessors'][s['input']]
            if 'max' in acc: max_t = max(max_t, acc['max'][0])
        paths = {c['target']['path'] for c in a['channels']}
        print(f"GLB CLIP {a['name']:12s} dur={max_t:.3f}s ({round(max_t*FPS):2d}f) channels={len(a['channels'])} paths={sorted(paths)}")
    print('TOTAL tris', tris, 'verts', verts)

if MODE == 'build': build()
elif MODE == 'render': render()
elif MODE == 'glbcheck': glbcheck()
elif MODE == 'all':
    build()
    render()
    glbcheck()
