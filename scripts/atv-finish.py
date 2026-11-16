# ATV V6 finish + V7 polish + V8 underside (own work, licence 'Own work', no credit line). Headless Blender 5.2:
#   blender --background --python scripts/atv-finish.py -- v8       (V7 .blend -> V8 .blend + .glb: engine, exhaust, drivetrain,
#                                                                     skid plates, steering under the body; V7 is only read)
#   blender --background --python scripts/atv-finish.py -- check    (clash + anchor report on the V8 .blend)
#   blender --background --python scripts/atv-finish.py -- render   (preview PNGs into 'ATV V8 previews', u_* = underside views)
#   blender --background --python scripts/atv-finish.py -- glbcheck (re-import the V8 .glb: bounds, lowest points, parents)
#   blender --background --python scripts/atv-finish.py -- polish   (history: V6 .blend -> V7)
#   blender --background --python scripts/atv-finish.py -- build    (history: V4.1 .blend -> V6; the V4.1 and V6 files were deleted
#                                                                     after V7 was verified, so 'build' and 'polish' no longer run)
# Set ATV_VER=7 (or 6) to point check / render / glbcheck at older files. V7 .blend is the source the v8 mode builds from.
# Contract: notes/atv-model-prompt.md. Improve lists: notes/atv-v6-improve-prompt.md, notes/atv-v6-polish-prompt.md.
# Blender axes: nose -Y, +X = vehicle left, Z up (glTF: X, Z, -Y).
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

DIR = r"C:\Users\Michael\Documents\Projects\Assets Sim Project"
SRC = os.path.join(DIR, "ATV Utility - V4.1 Detail Cleanup.blend")
V6_BLEND = os.path.join(DIR, "ATV Utility - V6 Game.blend")
V6_GLB = os.path.join(DIR, "ATV Utility - V6 Game.glb")
V7_BLEND = os.path.join(DIR, "ATV Utility - V7 Game.blend")
V7_GLB = os.path.join(DIR, "ATV Utility - V7 Game.glb")
V8_BLEND = os.path.join(DIR, "ATV Utility - V8 Game.blend")
V8_GLB = os.path.join(DIR, "ATV Utility - V8 Game.glb")
VER = os.environ.get('ATV_VER', '8')
DST = {'6': V6_BLEND, '7': V7_BLEND}.get(VER, V8_BLEND)
GLB = {'6': V6_GLB, '7': V7_GLB}.get(VER, V8_GLB)
PREV = os.path.join(DIR, {'6': "ATV V6 previews", '7': "ATV V7 previews"}.get(VER, "ATV V8 previews"))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = (ARGS + ['check'])[0]

HUB_X, HUB_Y, HUB_Z = 0.465, 0.62, 0.30
TYRE_R, TYRE_W = 0.305, 0.125          # sweep volume used for clearance (lugs reach 0.300, carcass +/-0.118)
STEER = 35.0
CHECK_STEER = float(ARGS[1]) if len(ARGS) > 1 and ARGS[0] == 'check' else STEER
CLEAR = 0.015                          # wanted gap between body and tyre sweep

ANCHORS = {  # contract, glTF axes (X left, Y up, Z forward)
 'anchor_driver_seat': (0, 0.86, -0.30), 'anchor_engine_sound': (0, 0.45, -0.05), 'anchor_exhaust': (-0.27, 0.57, -1.00),
 'anchor_fuel_port': (0.07, 0.835, 0.16), 'anchor_headlight_L': (0.15, 0.52, 0.92), 'anchor_headlight_R': (-0.15, 0.52, 0.92),
 'anchor_taillight_L': (0.34, 0.62, -0.975), 'anchor_taillight_R': (-0.34, 0.62, -0.975), 'anchor_cargo_front': (0, 0.82, 0.66),
 'anchor_cargo_rear': (0, 0.76, -0.82), 'anchor_hands_L': (0.37, 1.05, 0.23), 'anchor_hands_R': (-0.37, 1.05, 0.23),
 'anchor_foot_L': (0.36, 0.35, 0.0), 'anchor_foot_R': (-0.36, 0.35, 0.0), 'anchor_load_left': (0.95, 0, 0),
 'anchor_load_right': (-0.95, 0, 0), 'anchor_load_rear': (0, 0, -1.60)}
def g2b(p): return Vector((p[0], -p[2], p[1]))   # glTF -> Blender

# ---------------------------------------------------------------- helpers
def loose_parts(bm):
    bm.verts.index_update(); bm.verts.ensure_lookup_table(); seen = set(); parts = []
    for v in bm.verts:
        if v.index in seen: continue
        stack = [v]; comp = []; seen.add(v.index)
        while stack:
            x = stack.pop(); comp.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen: seen.add(y.index); stack.append(y)
        parts.append(comp)
    return parts

def bbox(vs):
    return (Vector([min(v.co[i] for v in vs) for i in range(3)]), Vector([max(v.co[i] for v in vs) for i in range(3)]))

def delete_verts(bm, vs):
    bmesh.ops.delete(bm, geom=list(set(vs)), context='VERTS')

def pca(points):
    n = len(points); c = sum(points, Vector()) / n
    cov = [[sum((p[i]-c[i])*(p[j]-c[j]) for p in points)/n for j in range(3)] for i in range(3)]
    v = Vector((1, 0.7, 0.3)).normalized()                 # power iteration for the main axis
    for _ in range(60):
        w = Vector([sum(cov[i][j]*v[j] for j in range(3)) for i in range(3)])
        if w.length < 1e-12: break
        v = w.normalized()
    return c, v

def add_tube(bm, p0, p1, r, sides=8, mat=0):
    ax = (p1 - p0); L = ax.length
    if L < 1e-5: return
    ax.normalize()
    u = ax.orthogonal().normalized(); w = ax.cross(u)
    r0 = []; r1 = []
    for i in range(sides):
        a = 2*math.pi*i/sides; off = (u*math.cos(a) + w*math.sin(a))*r
        r0.append(bm.verts.new(p0 + off)); r1.append(bm.verts.new(p1 + off))
    fs = [bm.faces.new((r0[i], r0[(i+1) % sides], r1[(i+1) % sides], r1[i])) for i in range(sides)]
    fs.append(bm.faces.new(list(reversed(r0)))); fs.append(bm.faces.new(r1))
    for f in fs: f.material_index = mat; f.smooth = True
    return fs

def add_coil(bm, p0, p1, R, wire, turns, seg_per_turn=10, sides=4):
    ax = (p1 - p0); L = ax.length; ax.normalize()
    u = ax.orthogonal().normalized(); w = ax.cross(u)
    n = int(turns * seg_per_turn); rings = []
    for k in range(n + 1):
        t = k / n; a = 2*math.pi*turns*t
        c = p0 + ax*(L*t) + (u*math.cos(a) + w*math.sin(a))*R
        tang = (ax*(L/(2*math.pi*turns)) + (-u*math.sin(a) + w*math.cos(a))*R).normalized()
        nu = (c - (p0 + ax*(L*t))).normalized(); nw = tang.cross(nu)
        rings.append([bm.verts.new(c + (nu*math.cos(2*math.pi*j/sides) + nw*math.sin(2*math.pi*j/sides))*wire) for j in range(sides)])
    fs = []
    for k in range(n):
        a, b = rings[k], rings[k+1]
        for j in range(sides): fs.append(bm.faces.new((a[j], a[(j+1) % sides], b[(j+1) % sides], b[j])))
    fs.append(bm.faces.new(list(reversed(rings[0])))); fs.append(bm.faces.new(rings[-1]))
    for f in fs: f.smooth = True
    return fs

def fix_part_normals(bm):
    """Closed parts with a negative signed volume are flipped; open parts are left alone."""
    flipped = 0
    for comp in loose_parts(bm):
        fs = list({f for v in comp for f in v.link_faces})
        if not fs or any(not e.is_manifold for f in fs for e in f.edges): continue
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        vol = 0.0
        for f in fs:
            vs = [l.vert.co for l in f.loops]
            for i in range(1, len(vs)-1): vol += vs[0].dot(vs[i].cross(vs[i+1]))
        if vol < 0:
            bmesh.ops.reverse_faces(bm, faces=fs); flipped += 1
    return flipped

def mark_sharp(bm, deg):
    lim = math.radians(deg)
    for e in bm.edges:
        if len(e.link_faces) == 2: e.smooth = e.calc_face_angle(0) < lim
        else: e.smooth = False

def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out

def world_bm(o):
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world); return bm

def put_bm(o, bm):
    """bm is in world space; the object is moved to the identity transform under its (identity) parent."""
    o.matrix_world = Matrix.Identity(4)
    bm.to_mesh(o.data); o.data.update()

# ---------------------------------------------------------------- tyre sweep envelope (left side; mirrored)
def build_envelope():
    """For bins of (y, z) in Blender metres: (min x, max x) the tyre volume reaches, front over -35..35 deg steer, rear at 0."""
    env = {}
    def add(key, x):
        a = env.get(key)
        env[key] = (x, x) if a is None else (min(a[0], x), max(a[1], x))
    for hy, angs in ((-HUB_Y, [math.radians(a) for a in range(-35, 36, 5)]), (HUB_Y, [0.0])):
        for iz in range(0, 64):
            z = iz * 0.01; dz = z - HUB_Z
            if abs(dz) > TYRE_R: continue
            D = math.sqrt(TYRE_R**2 - dz*dz)
            for th in angs:
                c, s = math.cos(th), math.sin(th)
                for il in range(-25, 26):
                    lx = TYRE_W * il / 25
                    for idd in range(-30, 31):
                        d = D * idd / 30
                        x = HUB_X + lx*c - d*s; y = hy + lx*s + d*c
                        add((round(y*100), iz), x)
    return env

def env_range(env, y, z, grow=1):
    ky, kz = round(y*100), round(z*100); lo, hi = None, None
    for a in range(ky-grow, ky+grow+1):
        for b in range(kz-grow, kz+grow+1):
            r = env.get((a, b))
            if r: lo = r[0] if lo is None else min(lo, r[0]); hi = r[1] if hi is None else max(hi, r[1])
    return lo, hi

def in_sweep(env, co, m=CLEAR):
    lo, hi = env_range(env, co.y, co.z)
    return lo is not None and lo - m <= abs(co.x) <= hi + m

# ---------------------------------------------------------------- fender
FENDER_PROFILE = [(-1.012, 0.548), (-0.975, 0.612), (-0.93, 0.668), (-0.87, 0.708), (-0.79, 0.727), (-0.62, 0.734),
                  (-0.48, 0.727), (-0.41, 0.708), (-0.35, 0.664), (-0.29, 0.598), (-0.232, 0.522)]  # centre line (y, z), front-left; follows V4.1
FENDER_X = [0.262, 0.33, 0.40, 0.47, 0.525, 0.558, 0.577]
FENDER_T = 0.036

def catmull(pts, n):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [Vector(p) for p in P[i-1:i+3]]
        for k in range(n):
            t = k / n
            out.append(0.5*((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t*t + (-p0+3*p1-3*p2+p3)*t*t*t))
    out.append(Vector(pts[-1])); return out

def make_fender(sx, sy):
    """sx=+1 left/-1 right, sy=+1 front/-1 rear (rear = the front profile mirrored in y). Returns a new bmesh."""
    bm = bmesh.new()
    cl = catmull(FENDER_PROFILE, 2)
    nrm = []
    for i, p in enumerate(cl):
        a = cl[max(i-1, 0)]; b = cl[min(i+1, len(cl)-1)]; t = (b - a).normalized()
        nrm.append(Vector((-t.y, t.x)) if t.x >= 0 else Vector((t.y, -t.x)))   # points up
    span = FENDER_X[-1] - FENDER_X[0]
    def crown(x):  # gentle roll: the outer edge drops 4 cm, the last 3 cm turn down a little more
        u = (x - FENDER_X[0]) / span
        return -0.040 * u**2 - (0.012 * ((x - 0.547) / 0.03)**2 if x > 0.547 else 0)
    top, bot = [], []
    for i, p in enumerate(cl):
        rt, rb = [], []
        for x in FENDER_X:
            c = Vector((p.x, p.y + crown(x)))
            pt = c + nrm[i]*(FENDER_T/2); pb = c - nrm[i]*(FENDER_T/2)
            rt.append(bm.verts.new((sx*x, sy*pt.x, pt.y))); rb.append(bm.verts.new((sx*x, sy*pb.x, pb.y)))
        top.append(rt); bot.append(rb)
    nu, nx = len(top), len(FENDER_X)
    for i in range(nu-1):
        for j in range(nx-1):
            bm.faces.new((top[i][j], top[i][j+1], top[i+1][j+1], top[i+1][j]))
            bm.faces.new((bot[i][j], bot[i+1][j], bot[i+1][j+1], bot[i][j+1]))
    for j in range(nx-1):
        bm.faces.new((top[0][j], bot[0][j], bot[0][j+1], top[0][j+1]))
        bm.faces.new((top[-1][j], top[-1][j+1], bot[-1][j+1], bot[-1][j]))
    for i in range(nu-1):
        bm.faces.new((top[i][0], top[i+1][0], bot[i+1][0], bot[i][0]))
        bm.faces.new((top[i][-1], bot[i][-1], bot[i+1][-1], top[i+1][-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(50)]
    bmesh.ops.bevel(bm, geom=sharp, offset=0.013, offset_type='OFFSET', segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces: f.smooth = True
    mark_sharp(bm, 60)
    return bm

# ---------------------------------------------------------------- light housing + lens
def make_light(trim_bm, lens_bm, cx, cz, w, h, y_out, s, depth, rim=0.014, recess=0.012, lens_gap=0.003):
    """s = -1 faces the nose (-Y), +1 faces the tail. Housing (trim) with a recessed bezel, lens set into it."""
    hb = bmesh.new()
    bmesh.ops.create_cube(hb, size=1.0)
    for v in hb.verts: v.co = Vector((cx + v.co.x*w, y_out - s*depth/2 + v.co.y*depth, cz + v.co.z*h))
    bmesh.ops.bevel(hb, geom=list(hb.edges), offset=0.006, offset_type='OFFSET', segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    hb.faces.ensure_lookup_table()
    front = max(hb.faces, key=lambda f: (f.normal.y*s, f.calc_area()))
    r1 = bmesh.ops.inset_individual(hb, faces=[front], thickness=rim - 0.006, depth=0)
    r2 = bmesh.ops.inset_individual(hb, faces=[front], thickness=0.002, depth=-recess)
    for f in hb.faces: f.smooth = False
    tmp = bpy.data.meshes.new('tmp_housing'); hb.to_mesh(tmp); trim_bm.from_mesh(tmp); bpy.data.meshes.remove(tmp); hb.free()
    lb = bmesh.new()
    bmesh.ops.create_cube(lb, size=1.0)
    lw, lh = w - 2*rim - 0.004, h - 2*rim - 0.004
    lt = recess - lens_gap
    for v in lb.verts: v.co = Vector((cx + v.co.x*lw, y_out - s*(lens_gap + lt/2) + v.co.y*lt, cz + v.co.z*lh))
    bmesh.ops.bevel(lb, geom=list(lb.edges), offset=0.0025, offset_type='OFFSET', segments=1, profile=0.5, affect='EDGES', clamp_overlap=True)
    tmp = bpy.data.meshes.new('tmp_lens'); lb.to_mesh(tmp); lens_bm.from_mesh(tmp); bpy.data.meshes.remove(tmp); lb.free()

# ---------------------------------------------------------------- tyre lugs
def rebuild_lugs(o):
    bm = bmesh.new(); bm.from_mesh(o.data)   # wheel-local: X axle, the tyre in the Y-Z plane
    parts = loose_parts(bm)
    tyre_mat = 0
    carcass = max((p for p in parts if {f.material_index for v in p for f in v.link_faces} == {tyre_mat}), key=len)
    prof = {}
    for v in carcass:
        r = math.hypot(v.co.y, v.co.z)
        if r > 0.2: k = round(abs(v.co.x), 3); prof[k] = max(prof.get(k, 0), r)
    ks = sorted(prof)
    def rc(a):
        if a <= ks[0]: return prof[ks[0]]
        for k0, k1 in zip(ks, ks[1:]):
            if k0 <= a <= k1: t = (a-k0)/(k1-k0) if k1 > k0 else 0; return prof[k0]*(1-t) + prof[k1]*t
        return prof[ks[-1]]
    old = [p for p in parts if len(p) == 24 and min(math.hypot(v.co.y, v.co.z) for v in p) > 0.26]
    n_old = len(old)
    delete_verts(bm, [v for p in old for v in p])
    A = [0.014, 0.044, 0.074, 0.104]
    newf = []
    for row, sgn, phase in ((0, -1, 90.0), (1, 1, 82.5)):
        for k in range(24):
            phi = math.radians(phase - 15*k)
            top, bot = [], []
            for ia, a in enumerate(A):
                c = rc(a); ro = min(0.300, c + 0.013); ri = c - 0.015
                chev = math.radians(1.6) * (a - A[0]) / (A[-1] - A[0])
                at = a + (0.004 if ia == 0 else -0.004 if ia == len(A)-1 else 0)   # top face a touch smaller: chamfered look
                lt, lb = [], []
                for j, f in enumerate((-1, 0, 1)):
                    ang_t = phi + chev + f*math.radians(4.5)*0.82
                    ang_b = phi + chev + f*math.radians(4.5)
                    lt.append(bm.verts.new((sgn*at, ro*math.cos(ang_t), ro*math.sin(ang_t))))
                    lb.append(bm.verts.new((sgn*a, ri*math.cos(ang_b), ri*math.sin(ang_b))))
                top.append(lt); bot.append(lb)
            fs = []
            for i in range(3):
                for j in range(2):
                    fs.append(bm.faces.new((top[i][j], top[i][j+1], top[i+1][j+1], top[i+1][j])))
                    fs.append(bm.faces.new((bot[i][j], bot[i+1][j], bot[i+1][j+1], bot[i][j+1])))
            for i in range(3):
                fs.append(bm.faces.new((top[i][0], top[i+1][0], bot[i+1][0], bot[i][0])))
                fs.append(bm.faces.new((top[i][2], bot[i][2], bot[i+1][2], top[i+1][2])))
            for j in range(2):
                fs.append(bm.faces.new((top[0][j], bot[0][j], bot[0][j+1], top[0][j+1])))
                fs.append(bm.faces.new((top[3][j], top[3][j+1], bot[3][j+1], bot[3][j])))
            bmesh.ops.recalc_face_normals(bm, faces=fs)
            for f in fs: f.material_index = tyre_mat; f.smooth = False
            newf += fs
    bm.to_mesh(o.data); o.data.update(); bm.free()
    return n_old, len(newf)

# ---------------------------------------------------------------- build
def build():
    assert os.path.normcase(SRC) != os.path.normcase(V6_BLEND)
    bpy.ops.wm.open_mainfile(filepath=SRC)
    log = []
    O = bpy.data.objects
    root = O['ATV_Default_Source']
    assert root.matrix_world == Matrix.Identity(4)

    # 1. materials: fold the '.001' duplicates into the contract names, nothing emissive
    names = ['Paint', 'ATV_Frame', 'ATV_Tire', 'ATV_Rim', 'ATV_Trim', 'ATV_Metal', 'ATV_Headlight', 'ATV_Taillight']
    for o in O:
        if o.type != 'MESH': continue
        for sl in o.material_slots:
            m = sl.material
            if m and '.' in m.name and m.name.split('.')[0] in names:
                sl.material = bpy.data.materials[m.name.split('.')[0]]
    for m in list(bpy.data.materials):
        if '.' in m.name and m.name.split('.')[0] in names and m.users == 0: bpy.data.materials.remove(m)
    for n in names:
        m = bpy.data.materials[n]
        b = m.node_tree.nodes.get('Principled BSDF')
        if b:
            b.inputs['Emission Strength'].default_value = 0.0
            b.inputs['Emission Color'].default_value = (0, 0, 0, 1)
            m.diffuse_color = b.inputs['Base Color'].default_value
    # tail lens a little brighter red, headlight lens bright (both already light, kept)
    bpy.data.materials['ATV_Taillight'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.80, 0.02, 0.025, 1)
    bpy.data.materials['ATV_Taillight'].diffuse_color = (0.80, 0.02, 0.025, 1)

    env = build_envelope()

    # 2. body meshes to the root origin
    body = {n: O[n] for n in ('Body_Paint', 'Body_Frame', 'Body_Trim', 'Body_Metal', 'Body_Headlights', 'Body_Taillights')}

    # 3. Body_Metal: shock axes (for the springs)
    mb = world_bm(body['Body_Metal'])
    shocks = []
    for p in loose_parts(mb):
        lo, hi = bbox(p)
        if 0.58 < abs(lo.y) and abs(hi.y) < 0.66 and hi.z < 0.66 and lo.z > 0.3 and (hi.x - lo.x) > 0.15:
            c, ax = pca([v.co.copy() for v in p])
            ts = [(v.co - c).dot(ax) for v in p]
            e0, e1 = c + ax*min(ts), c + ax*max(ts)
            if e0.z < e1.z: e0, e1 = e1, e0          # e0 = top
            rad = max(((v.co - c) - ax*(v.co - c).dot(ax)).length for v in p)
            # the game steers about the hub centre: swing the shock's lower end 7 cm inboard (still on the A-arm apex)
            # so the steered tyre's inner sidewall no longer cuts through the shock body and spring
            old_e1 = e1.copy()
            tgt = e1 + Vector((-math.copysign(0.07, e1.x), 0, 0))
            R = (e1 - e0).normalized().rotation_difference((tgt - e0).normalized())
            for v in p: v.co = e0 + R @ (v.co - e0)
            e1 = e0 + R @ (e1 - e0)
            shocks.append((e0, e1, rad, old_e1))
    log.append(f"shocks found and re-angled: {len(shocks)}")
    put_bm(body['Body_Metal'], mb); mb.free()

    # 4. Body_Frame: drop the broken spring fragments, turn the degenerate (tetra / prism) tube bits into real tubes, add coil springs
    fb = world_bm(body['Body_Frame'])
    def near_shock(pt):
        for e0, _, r, e1 in shocks:      # the broken spring bits sit round the ORIGINAL shock axis
            ax = e1 - e0; t = max(0, min(1, (pt - e0).dot(ax) / ax.length_squared))
            if (e0 + ax*t - pt).length < r + 0.05: return True
        return False
    drop, tubes = [], []
    for p in loose_parts(fb):
        if len(p) > 7: continue
        c = sum((v.co for v in p), Vector()) / len(p)
        if near_shock(c): drop += p; continue
        cc, ax = pca([v.co.copy() for v in p])
        ts = [(v.co - cc).dot(ax) for v in p]
        perp = max(((v.co - cc) - ax*(v.co - cc).dot(ax)).length for v in p)
        tubes.append((cc + ax*min(ts), cc + ax*max(ts), min(0.022, max(0.008, perp*0.75))))
        drop += p
    delete_verts(fb, drop)
    for p0, p1, r in tubes: add_tube(fb, p0, p1, r, sides=8)
    for e0, e1, r, _ in shocks:
        ax = e1 - e0
        add_coil(fb, e0 + ax*0.08, e0 + ax*0.66, r + 0.008, 0.0055, 5.0)
    log.append(f"frame: removed {len(drop)} verts of broken bits, {len(tubes)} degenerate bits rebuilt as 8-sided tubes, {len(shocks)} coil springs")
    # frame tubes (not the A-arms, springs or anything bolted to a hub) that the steered tyre would cut: ring them every 3 cm
    # and bend the rings inboard just out of the sweep
    hubs = [Vector((sx*HUB_X, sy*HUB_Y, HUB_Z)) for sx in (1, -1) for sy in (1, -1)]
    bent = 0
    for p in loose_parts(fb):
        if len(p) > 24 or any((v.co - h).length < 0.10 for v in p for h in hubs): continue
        if not any(in_sweep(env, v.co, 0) for v in p) and not any(in_sweep(env, (e.verts[0].co + e.verts[1].co)/2, 0) for v in p for e in v.link_edges): continue
        c, ax = pca([v.co.copy() for v in p])
        ts = [(v.co - c).dot(ax) for v in p]
        geom = list({x for v in p for x in [v] + list(v.link_edges) + list(v.link_faces)})
        rad = max(((v.co - c) - ax*(v.co - c).dot(ax)).length for v in p)
        hit = [k/100 for k in range(int(min(ts)*100), int(max(ts)*100) + 1)
               if any(in_sweep(env, c + ax*(k/100) + Vector((dx, 0, dz)), 0) for dx in (-rad, rad) for dz in (-rad, 0, rad))]
        if not hit: continue
        t = max(min(ts) + 0.01, min(hit) - 0.08)
        while t < min(max(ts) - 0.01, max(hit) + 0.08):
            r = bmesh.ops.bisect_plane(fb, geom=geom, dist=1e-6, plane_co=c + ax*t, plane_no=ax)
            geom = list(set(geom) | set(r['geom']))
            t += 0.03
        vs = list({x for x in geom if isinstance(x, bmesh.types.BMVert) and x.is_valid})
        for _ in range(3):
            groups = {}
            for v in vs: groups.setdefault(round((v.co - c).dot(ax) / 0.004), []).append(v)
            for g in groups.values():
                need = 0.0
                for v in g:
                    if in_sweep(env, v.co):
                        lo, hi = env_range(env, v.co.y, v.co.z); need = max(need, abs(v.co.x) - (lo - CLEAR))
                for v in g: v.co.x -= math.copysign(need, v.co.x)
        bent += 1
    log.append(f"frame: {bent} tubes bent inboard out of the steered tyre sweep")
    put_bm(body['Body_Frame'], fb)

    # 5. Body_Paint: remove the 3 old fenders (the front-right one was missing), tuck the cowl sides out of the tyre sweep, 4 new fenders
    pb = world_bm(body['Body_Paint'])
    old = [p for p in loose_parts(pb) if (lambda lo, hi: min(abs(lo.x), abs(hi.x)) > 0.24 and max(abs(lo.x), abs(hi.x)) > 0.55 and lo.x * hi.x > 0)(*bbox(p))]
    log.append(f"paint: {len(old)} old fenders removed")
    delete_verts(pb, [v for p in old for v in p])
    moved = 0; split = 0
    def tuck():
        n = 0
        for v in pb.verts:
            if in_sweep(env, v.co):
                lo, hi = env_range(env, v.co.y, v.co.z)
                v.co.x = math.copysign(max(0.0, lo - CLEAR), v.co.x); n += 1
        return n
    def face_pts(f):
        vs = [v.co for v in f.verts]; c = sum(vs, Vector()) / len(vs)
        return [c] + [(a + b)/2 for a, b in zip(vs, vs[1:] + vs[:1])] + [(a + c)/2 for a in vs]
    for it in range(3):              # tuck, then split the faces that still cross the sweep, and again
        moved += tuck()
        bad = [f for f in pb.faces if any(in_sweep(env, p, CLEAR*0.4) for p in face_pts(f))]
        if not bad: break
        tri = bmesh.ops.triangulate(pb, faces=bad)['faces']
        es = list({e for f in tri for e in f.edges}); split += len(es)
        bmesh.ops.subdivide_edges(pb, edges=es, cuts=1, use_grid_fill=True)
    moved += tuck()
    log.append(f"paint: cowl / tail sides tucked inboard out of the tyre sweep ({moved} vertex moves, {split} edges split)")
    for sx in (1, -1):
        for sy in (1, -1):
            fbm = make_fender(sx, sy)
            tmp = bpy.data.meshes.new('tmp_fender'); fbm.to_mesh(tmp); pb.from_mesh(tmp); bpy.data.meshes.remove(tmp); fbm.free()
    put_bm(body['Body_Paint'], pb)
    from mathutils.bvhtree import BVHTree
    paint_bvh = BVHTree.FromBMesh(pb)

    # 6. lights: housings with a recessed bezel (ATV_Trim), lenses set 3 mm into them
    tb = world_bm(body['Body_Trim'])
    rm = []
    for p in loose_parts(tb):
        lo, hi = bbox(p)
        if lo.y < -0.86 and min(abs(lo.x), abs(hi.x)) > 0.03 and lo.z > 0.44: rm += p           # head housings
        if hi.y > 0.97 and lo.y > 0.9 and min(abs(lo.x), abs(hi.x)) > 0.2: rm += p              # tail housings
    delete_verts(tb, rm)
    hl = bmesh.new()
    tl = world_bm(body['Body_Taillights'])
    delete_verts(tl, [v for p in loose_parts(tl) if (lambda lo, hi: min(abs(lo.x), abs(hi.x)) > 0.2)(*bbox(p)) for v in p])
    for sx in (1, -1):
        make_light(tb, hl, sx*0.150, 0.5195, 0.226, 0.141, -0.926, -1, 0.052)
        make_light(tb, tl, sx*0.340, 0.620, 0.168, 0.108, 0.984, +1, 0.056, rim=0.013)
    # foot platforms: chamfer the front outer corner out of the steered tyre sweep (push those vertices rearward)
    pm = 0
    for p in loose_parts(tb):
        lo, hi = bbox(p)
        if hi.z < 0.36 and (hi.y - lo.y) > 0.5:
            for v in p:
                while v.co.y < 0 and in_sweep(env, v.co, 0.01): v.co.y += 0.003; pm += 1
    # thin upright posts (fender stays) that poked through the new fenders: stop them 6 mm inside the fender underside
    posts = 0
    for p in loose_parts(tb):
        lo, hi = bbox(p)
        if (hi.x - lo.x) < 0.09 and (hi.y - lo.y) < 0.09 and (hi.z - lo.z) > 0.15:
            c = (lo + hi) / 2
            hit, nrm, idx, dist = paint_bvh.ray_cast(Vector((c.x, c.y, lo.z + 0.02)), Vector((0, 0, 1)))
            if hit is not None and hit.z < hi.z + 0.01:
                top = hit.z + 0.006
                for v in p:
                    if v.co.z > top: v.co.z = top
                posts += 1
    log.append(f"trim: {len(rm)} old housing verts replaced; platform corner pushes {pm}; {posts} fender stays trimmed under the fenders")
    put_bm(body['Body_Trim'], tb)
    put_bm(body['Body_Taillights'], tl); tl.free()
    hl.to_mesh(body['Body_Headlights'].data); body['Body_Headlights'].matrix_world = Matrix.Identity(4); hl.free()

    # 7. tyre lugs flush, one mesh per wheel
    for s in ('FL', 'FR', 'RL', 'RR'):
        n_old, n_new = rebuild_lugs(O['WheelMesh_' + s])
        log.append(f"WheelMesh_{s}: {n_old} old lugs -> 48 new flush lugs ({n_new} faces)")

    # 8. handlebar children merged by material (fewer draw calls), still children of the pivot
    hbar = O['handlebar']
    kids = [c for c in hbar.children if c.type == 'MESH']
    groups = {}
    for c in kids: groups.setdefault(c.material_slots[0].material.name, []).append(c)
    inv = hbar.matrix_world.inverted()
    for mname, objs in groups.items():
        bm = bmesh.new()
        for c in objs:
            t = bmesh.new(); t.from_mesh(c.data); t.transform(inv @ c.matrix_world)
            tmp = bpy.data.meshes.new('tmp'); t.to_mesh(tmp); bm.from_mesh(tmp); bpy.data.meshes.remove(tmp); t.free()
        nm = {'ATV_Frame': 'Handlebar_Frame', 'ATV_Trim': 'Handlebar_Trim', 'ATV_Metal': 'Handlebar_Metal'}.get(mname, 'Handlebar_' + mname)
        me = bpy.data.meshes.new(nm); bm.to_mesh(me); bm.free()
        me.materials.append(bpy.data.materials[mname])
        for poly in me.polygons: poly.material_index = 0
        ob = bpy.data.objects.new(nm, me); root.users_collection[0].objects.link(ob)
        ob.parent = hbar; ob.matrix_parent_inverse = Matrix.Identity(4); ob.matrix_basis = Matrix.Identity(4)
    for c in kids: bpy.data.objects.remove(c)
    log.append(f"handlebar: {len(kids)} meshes merged into {len(groups)} ({', '.join(groups)})")

    # 9. cleanliness on every mesh of the vehicle
    flips = 0; merged = 0
    for o in tree(root):
        if o.type != 'MESH': continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        nv = len(bm.verts)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
        merged += nv - len(bm.verts)
        loose = [v for v in bm.verts if not v.link_faces]
        if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
        flips += fix_part_normals(bm)
        bm.to_mesh(o.data); o.data.update(); bm.free()
    log.append(f"cleanup: {merged} duplicate vertices merged, {flips} closed parts had inward normals and were flipped")

    # 10. one collection for the vehicle
    col = bpy.data.collections.get('ATV V6') or bpy.data.collections.new('ATV V6')
    if col.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(col)
    for o in tree(root):
        for c in list(o.users_collection): c.objects.unlink(o)
        col.objects.link(o)

    for o in tree(root):                 # mesh data named like its object (the user's names were 'V3 material split.00x')
        if o.type == 'MESH': o.data.name = o.name
    bpy.ops.wm.save_as_mainfile(filepath=V6_BLEND)
    export(root, V6_GLB)
    for l in log: print('LOG', l)

def export(root, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in tree(root): o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_cameras=False, export_lights=False)

# ---------------------------------------------------------------- V7 polish (notes/atv-v6-polish-prompt.md)
def squircle(a, b, n, p=4.0):
    """n points round a superellipse with half sizes a (x) and b (z); p=2 is an ellipse, higher is squarer."""
    out = []
    for i in range(n):
        t = 2*math.pi*(i + 0.5)/n; c, s = math.cos(t), math.sin(t)
        out.append((a*math.copysign(abs(c)**(2/p), c), b*math.copysign(abs(s)**(2/p), s)))
    return out

def loft(cx, cz, yref, s, rings, n, p=4.0, sharp=40):
    """A closed part lofted through rings (a, b, t): squircle a x b at y = yref + s*t (s=-1: t grows toward the nose).
    A ring with a = 0 is a single centre point (a dome tip). Returns a new bmesh, normals outward, smooth + sharp edges."""
    bm = bmesh.new(); R = []
    for a, b, t in rings:
        y = yref + s*t
        R.append([bm.verts.new((cx, y, cz))] if a <= 1e-5 else [bm.verts.new((cx + u, y, cz + v)) for u, v in squircle(a, b, n, p)])
    for r0, r1 in zip(R, R[1:]):
        for i in range(n):
            j = (i + 1) % n
            if len(r1) == 1: bm.faces.new((r0[i], r0[j], r1[0]))
            elif len(r0) == 1: bm.faces.new((r0[0], r1[j], r1[i]))
            else: bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    if len(R[0]) > 1: bm.faces.new(R[0])
    if len(R[-1]) > 1: bm.faces.new(R[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces: f.smooth = True
    mark_sharp(bm, sharp)
    return bm

def merge_into(dst, src):
    tmp = bpy.data.meshes.new('tmp_merge'); src.to_mesh(tmp); dst.from_mesh(tmp); bpy.data.meshes.remove(tmp); src.free()

def make_headlight(trim_bm, metal_bm, lens_bm, cx, cz, yref, s, A, B, n=24):
    """A real headlight set into a flat cowl face at y=yref (s=-1 faces the nose): a dark bezel housing (sunk 2.5 cm into the
    cowl, its chamfered flange 9 mm proud), a grey reflector ring stepping back into the opening, and a bright lens with a flat
    outer band and a raised dome (the inner step reads as the lamp at 10 to 30 m)."""
    merge_into(trim_bm, loft(cx, cz, yref, s, [
        (A, B, -0.025), (A, B, 0.005), (A - 0.004, B - 0.004, 0.009), (A - 0.012, B - 0.012, 0.010),
        (A - 0.016, B - 0.016, 0.007), (A - 0.016, B - 0.016, -0.013)], n, sharp=50))
    merge_into(metal_bm, loft(cx, cz, yref, s, [
        (A - 0.0165, B - 0.0165, -0.012), (A - 0.0165, B - 0.0165, 0.002), (A - 0.027, B - 0.027, -0.010), (A - 0.027, B - 0.027, -0.012)], n, sharp=30))
    i = A - 0.042; j = B - 0.042
    merge_into(lens_bm, loft(cx, cz, yref, s, [
        (A - 0.026, B - 0.026, -0.012), (A - 0.026, B - 0.026, -0.005), (A - 0.031, B - 0.031, -0.001), (A - 0.040, B - 0.040, -0.001),
        (i, j, 0.004), (i*0.78, j*0.78, 0.0095), (i*0.45, j*0.45, 0.0125), (0, 0, 0.0135)], n, p=3.2, sharp=40))

def make_taillight(trim_bm, lens_bm, cx, cz, yref, s, A, B, n=16):
    """Tail light: a dark bezel 7 mm proud of the tail face, a red lens with a chamfered edge and a raised inner panel."""
    merge_into(trim_bm, loft(cx, cz, yref, s, [
        (A, B, -0.020), (A, B, 0.004), (A - 0.003, B - 0.003, 0.007), (A - 0.009, B - 0.009, 0.0075),
        (A - 0.012, B - 0.012, 0.005), (A - 0.012, B - 0.012, -0.008)], n, p=5, sharp=50))
    merge_into(lens_bm, loft(cx, cz, yref, s, [
        (A - 0.0125, B - 0.0125, -0.008), (A - 0.0125, B - 0.0125, 0.002), (A - 0.016, B - 0.016, 0.0045), (A - 0.024, B - 0.024, 0.0045),
        (A - 0.027, B - 0.027, 0.008), (0, 0, 0.009)], n, p=5, sharp=40))

def strip_hidden(groups, ndir=600):
    """Delete faces no ray can see: from the face centre and from each corner (pulled 20% in), every one of ndir directions
    in the face's outward hemisphere hits the same group within 5 m. Groups move together in the game (the body, the
    handlebar, each wheel), so a face is only ever judged against parts that stay put relative to it."""
    from mathutils.bvhtree import BVHTree
    dirs = []
    for i in range(ndir):
        z = 1 - 2*(i + 0.5)/ndir; r = math.sqrt(1 - z*z); a = i * 2.399963
        dirs.append(Vector((r*math.cos(a), r*math.sin(a), z)))
    out = {}
    for names in groups:
        objs = [bpy.data.objects[n] for n in names]
        allbm = bmesh.new()
        for o in objs:
            t = world_bm(o); merge_into(allbm, t)
        tree = BVHTree.FromBMesh(allbm); allbm.free()
        for o in objs:
            bm = bmesh.new(); bm.from_mesh(o.data); M = o.matrix_world; R3 = M.to_3x3()
            bm.normal_update(); kill = []; tris = 0
            for f in bm.faces:
                nw = (R3 @ f.normal).normalized()
                if nw.length < 0.5: continue
                c = M @ f.calc_center_median()
                pts = [c] + [c + ((M @ v.co) - c)*0.8 for v in f.verts]
                seen = False
                for p in pts:
                    for d in dirs:
                        if d.dot(nw) <= 0.02: continue
                        if tree.ray_cast(p + nw*0.0008 + d*0.0002, d, 5.0)[0] is None: seen = True; break
                    if seen: break
                if seen: continue
                # and every sample point (nudged off the face) lies INSIDE another closed part: odd crossings along +X, +Y
                # and +Z. Faces that are only occluded (in a cavity, behind a rim lip) stay: a slit can show them, and a
                # first try that also removed those opened see-through gaps at the rim lip.
                inside = True
                for p in pts:
                    for d in (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))):
                        q = p + nw*0.0008; k = 0
                        while k < 80:
                            h = tree.ray_cast(q, d, 5.0)
                            if h[0] is None: break
                            k += 1; q = h[0] + d*0.0002
                        if k % 2 == 0: inside = False; break
                    if not inside: break
                if inside: kill.append(f); tris += len(f.verts) - 2
            bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
            loose = [v for v in bm.verts if not v.link_faces]
            if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
            bm.to_mesh(o.data); o.data.update(); bm.free()
            out[o.name] = (len(kill), tris)
    return out

def polish():
    assert os.path.normcase(V6_BLEND) != os.path.normcase(V7_BLEND)
    bpy.ops.wm.open_mainfile(filepath=V6_BLEND)
    from mathutils.bvhtree import BVHTree
    log = []
    O = bpy.data.objects
    root = O['ATV_Default_Source']
    tb = world_bm(O['Body_Trim']); mb = world_bm(O['Body_Metal']); pb = world_bm(O['Body_Paint'])
    paint = BVHTree.FromBMesh(pb)

    # 1. headlights: the V6 pale boxes (Trim housing + flat lens, glued 3 cm proud of the flat cowl face) become real lamps
    rm = []
    for p in loose_parts(tb):
        lo, hi = bbox(p)
        if lo.y < -0.86 and min(abs(lo.x), abs(hi.x)) > 0.03 and lo.z > 0.44 and hi.z < 0.6: rm += p
    delete_verts(tb, rm)
    hl = bmesh.new()
    for sx in (1, -1):
        cx, cz = sx*0.150, 0.520
        hit = paint.ray_cast(Vector((cx, -2.0, cz)), Vector((0, 1, 0)))[0]
        yref = hit.y - 0.004                                   # the lamp's reference plane: 4 mm in front of the cowl face
        make_headlight(tb, mb, hl, cx, cz, yref, -1, 0.104, 0.067)
        log.append(f"headlight {'L' if sx > 0 else 'R'}: cowl face at y {hit.y:+.3f}, lamp {0.208:.3f} x {0.134:.3f} m, lens tip y {yref - 0.0135:+.3f}")
    hl.to_mesh(O['Body_Headlights'].data); O['Body_Headlights'].matrix_world = Matrix.Identity(4); hl.free()
    log.append(f"headlights: {len(rm)} old housing verts removed, new bezel + reflector ring + domed lens per side")

    # 2. tail lights (the two at the anchors + the centre one): V6 had flat lenses in plain boxes, the side ones half sunk
    #    into the rear fender lip. Rebuilt with a bezel and a stepped lens, raised above the fender lip and tilted to the
    #    sloping tail face (plane fitted to the paint under the footprint).
    tl = world_bm(O['Body_Taillights'])
    rmt = [v for v in tl.verts]
    rmh = []
    for p in loose_parts(tb):
        lo, hi = bbox(p)
        if lo.y > 0.9 and lo.z > 0.55 and hi.z < 0.7: rmh += p
    delete_verts(tl, rmt); delete_verts(tb, rmh)
    log.append(f"tail lights: {len(rmt)} old lens verts and {len(rmh)} old housing verts removed")
    for cx, cz, A, B in ((TAIL_X, TAIL_Z, TAIL_A, TAIL_B), (-TAIL_X, TAIL_Z, TAIL_A, TAIL_B), (0.0, 0.650, 0.072, 0.026)):
        pts = []
        for u in (-0.8, 0, 0.8):
            for w in (-0.8, -0.4, 0, 0.4, 0.8):
                h = paint.ray_cast(Vector((cx + u*A, 2.0, cz + w*B)), Vector((0, -1, 0)))[0]
                if h is not None: pts.append(h)
        n = len(pts); mz = sum(p.z for p in pts)/n; my = sum(p.y for p in pts)/n
        slope = sum((p.z - mz)*(p.y - my) for p in pts) / sum((p.z - mz)**2 for p in pts)   # dy/dz of the tail face
        th = math.atan(-slope)                                  # tilt about X so the lamp faces along the surface normal
        resid = max(p.y - (my + slope*(p.z - mz)) for p in pts)
        yref = my + slope*(cz - mz) + max(0.0, resid) + 0.002
        tb2, tl2 = bmesh.new(), bmesh.new()
        make_taillight(tb2, tl2, cx, cz, yref, +1, A, B)
        R = Matrix.Translation((0, yref, cz)) @ Matrix.Rotation(th, 4, 'X') @ Matrix.Translation((0, -yref, -cz))
        for b in (tb2, tl2): b.transform(R); merge_into(tb if b is tb2 else tl, b)
        log.append(f"taillight at x {cx:+.3f} z {cz:.3f}: tail face y {my + slope*(cz - mz):+.3f}, tilt {math.degrees(th):.1f} deg, surface bump {resid*1000:.1f} mm")
    put_bm(O['Body_Taillights'], tl); tl.free()

    extra_fixes(O, tb, mb, pb, log)
    put_bm(O['Body_Trim'], tb); put_bm(O['Body_Metal'], mb); put_bm(O['Body_Paint'], pb)
    tb.free(); mb.free(); pb.free()

    # 3. faces nobody can see (inside other parts, inside the tyre carcass under the rim, overlaps under the cowl)
    body = ['Body_Paint', 'Body_Frame', 'Body_Trim', 'Body_Metal', 'Body_Headlights', 'Body_Taillights']
    # the wheels are left whole: stripping their inside faces changed how the metallic rim looked in close-ups (rim zoom A/B)
    res = strip_hidden([body, ['Handlebar_Frame', 'Handlebar_Trim', 'Handlebar_Metal']])
    log.append("hidden faces removed: " + ", ".join(f"{k} {f} faces / {t} tris" for k, (f, t) in res.items()))

    # 4. same cleanliness pass as V6 (merge doubles, drop loose verts, closed parts outward)
    flips = 0; merged = 0
    for o in tree(root):
        if o.type != 'MESH': continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        nv = len(bm.verts)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
        merged += nv - len(bm.verts)
        loose = [v for v in bm.verts if not v.link_faces]
        if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
        flips += fix_part_normals(bm)
        bm.to_mesh(o.data); o.data.update(); bm.free()
    log.append(f"cleanup: {merged} duplicate vertices merged, {flips} closed parts flipped outward")
    col = bpy.data.collections.get('ATV V6')
    if col: col.name = 'ATV V7'
    for o in tree(root):
        if o.type == 'MESH': o.data.name = o.name
    bpy.ops.wm.save_as_mainfile(filepath=V7_BLEND)
    export(root, V7_GLB)
    for l in log: print('LOG', l)

TAIL_X, TAIL_Z, TAIL_A, TAIL_B = 0.34, 0.648, 0.068, 0.034   # 2.8 cm above the anchor: clear of the rear fender lip

def add_loop_tube(bm, corners, r, bend, seg=4, sides=8):
    """A closed tube through the corner points (in order), each corner rounded with a quadratic bend of size 'bend'."""
    path = []; n = len(corners)
    for i, c in enumerate(corners):
        d1 = (c - corners[i-1]).normalized(); d2 = (corners[(i+1) % n] - c).normalized()
        a, b = c - d1*bend, c + d2*bend
        for k in range(seg + 1):
            t = k/seg; path.append(a*(1-t)**2 + c*(2*t*(1-t)) + b*(t*t))
    rings = []; m = len(path)
    for i, p in enumerate(path):
        tg = (path[(i+1) % m] - path[i-1]).normalized(); up = Vector((0, 0, 1)); sd = tg.cross(up).normalized(); up = sd.cross(tg)
        rings.append([bm.verts.new(p + (up*math.cos(2*math.pi*j/sides) + sd*math.sin(2*math.pi*j/sides))*r) for j in range(sides)])
    fs = []
    for i in range(m):
        a, b = rings[i], rings[(i+1) % m]
        for j in range(sides): fs.append(bm.faces.new((a[j], a[(j+1) % sides], b[(j+1) % sides], b[j])))
    bmesh.ops.recalc_face_normals(bm, faces=fs)
    for f in fs: f.smooth = True
    return fs

def extra_fixes(O, tb, mb, pb, log):
    """Other cheap fixes found in the V6 renders (each one logged)."""
    from mathutils.bvhtree import BVHTree
    paint = BVHTree.FromBMesh(pb)
    fb = world_bm(O['Body_Frame'])
    # a. front rack outer frame: V6 had a 23-vertex diamond-section loop (pointed corner ends, 3.4 cm thick, faceted in every
    #    close view). Rebuilt as a round 8-sided tube (r 1.6 cm) on the same rectangle with bent corners.
    rack = [p for p in loose_parts(fb) if len(p) < 40 and (lambda lo, hi: lo.y < -0.85 and hi.y > -0.45 and hi.x - lo.x > 0.8 and lo.z > 0.74)(*bbox(p))]
    assert len(rack) == 1, len(rack)
    lo, hi = bbox(rack[0]); z = (lo.z + hi.z)/2
    delete_verts(fb, rack[0])
    X, Y0, Y1 = 0.445, -0.415, -0.875
    add_loop_tube(fb, [Vector((X, Y0, z)), Vector((-X, Y0, z)), Vector((-X, Y1, z)), Vector((X, Y1, z))], 0.016, 0.045)
    log.append(f"front rack: diamond loop replaced by a round tube loop x +/-{X} y {Y1}..{Y0} z {z:.3f}")
    # b. front rack posts: the four posts stood at |x| 0.29 / 0.335 under no rail (pegs ending in the air under the rack).
    #    Moved out under the side rails (|x| 0.445), standing on the fender top, ending in the rail.
    moved = 0
    for p in loose_parts(fb):
        lo, hi = bbox(p)
        if (hi.x - lo.x) < 0.03 and (hi.y - lo.y) < 0.03 and (hi.z - lo.z) > 0.09 and -0.85 < lo.y < -0.43 and 0.26 < abs(lo.x) < 0.37 and abs(hi.z - z) < 0.01:
            cx = (lo.x + hi.x)/2; cy = (lo.y + hi.y)/2; nx = math.copysign(X, cx)
            h = paint.ray_cast(Vector((nx, cy, 1.5)), Vector((0, 0, -1)))[0]
            zb = h.z - 0.012
            for v in p:
                v.co.x += nx - cx
                v.co.z = zb + (v.co.z - lo.z) / (hi.z - lo.z) * (z - zb)
            moved += 1
    log.append(f"front rack: {moved} posts moved under the side rails, standing on the fenders")
    put_bm(O['Body_Frame'], fb); fb.free()
    # c. frame / racks / bumper were almost as black as the tyres and the seat (linear 0.045 vs 0.021 / 0.030), so the whole
    #    underside read as one black mass in daylight. One step lighter (still the contract's 'dark grey').
    m = bpy.data.materials['ATV_Frame']; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.072, 0.078, 0.082, 1); m.diffuse_color = (0.072, 0.078, 0.082, 1)
    log.append("ATV_Frame base colour 0.045 -> 0.072 linear (dark grey, separates from tyres and seat)")

# ---------------------------------------------------------------- V8 underside (notes/eval/outbox/atv-v8.md)
# User report 2026-11-15: from below the V7 read as a grey box plus arms. V8 adds a believable low-poly underside, all of it
# merged into the existing body meshes (Body_Frame / Body_Metal / Body_Trim), so meshes, materials and draw calls stay
# 13 / 8 / 21. Everything is static on the body: shafts are round, so a static half-shaft cannot show that the wheel spins.
def lathe(bm, c, ax, u, prof, n, rw=None, caps=True):
    """A closed shell of revolution round the axis ax through c: prof = [(s, r), ...] along ax (r = 0 is a point on the axis).
    u is any vector across the axis; rw (optional) makes the section an ellipse r x r*rw. Faces wound outward by
    construction (w = ax x u, rings counter-clockwise round ax, profile in order along the surface)."""
    ax = ax.normalized(); u = (u - ax*u.dot(ax)).normalized(); w = ax.cross(u); R = []
    for s, r in prof:
        p = c + ax*s
        R.append([bm.verts.new(p)] if r <= 1e-6 else
                 [bm.verts.new(p + (u*math.cos(2*math.pi*i/n) + w*math.sin(2*math.pi*i/n)*(rw or 1.0))*r) for i in range(n)])
    return skin(bm, R, caps)

def skin(bm, R, caps=True):
    """Faces between consecutive rings (each a list of n BMVerts or a single apex vert) plus the end caps."""
    fs = []; n = max(len(r) for r in R)
    for r0, r1 in zip(R, R[1:]):
        for i in range(n):
            j = (i + 1) % n
            if len(r1) == 1: fs.append(bm.faces.new((r0[i], r0[j], r1[0])))
            elif len(r0) == 1: fs.append(bm.faces.new((r0[0], r1[j], r1[i])))
            else: fs.append(bm.faces.new((r0[i], r0[j], r1[j], r1[i])))
    if caps and len(R[0]) > 1: fs.append(bm.faces.new(list(reversed(R[0]))))
    if caps and len(R[-1]) > 1: fs.append(bm.faces.new(R[-1]))
    for f in fs: f.smooth = True
    return fs

def tube(bm, p0, p1, r, n=8, up=Vector((0, 0, 1))):
    ax = p1 - p0
    u = up if abs(ax.normalized().dot(up)) < 0.9 else Vector((1, 0, 0))
    return lathe(bm, p0, ax, u, [(0, r), (ax.length, r)], n)

def path_tube(bm, pts, r, n=8):
    """A round tube along a polyline (parallel-transport frames, so it does not twist)."""
    R = []; u = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = t.orthogonal().normalized() if u is None else (u - t*u.dot(t)).normalized()
        w = t.cross(u)
        R.append([bm.verts.new(p + (u*math.cos(2*math.pi*k/n) + w*math.sin(2*math.pi*k/n))*r) for k in range(n)])
    return skin(bm, R)

def cbox(bm, c, h, ch):
    """Box centred c with half sizes h, every edge chamfered by ch (8-point rings along z)."""
    def rr(z, ix, iy):
        x, y = h.x - ix, h.y - iy
        return [bm.verts.new(c + Vector(v)) for v in ((x, -y + ch, z), (x, y - ch, z), (x - ch, y, z), (-x + ch, y, z),
                                                        (-x, y - ch, z), (-x, -y + ch, z), (-x + ch, -y, z), (x - ch, -y, z))]
    R = [rr(-h.z, ch, ch), rr(-h.z + ch, 0, 0), rr(h.z - ch, 0, 0), rr(h.z, ch, ch)]
    fs = skin(bm, R)
    for f in fs: f.smooth = False
    return fs

def prism(bm, prof, x0, x1):
    """A flat part: the (y, z) outline prof extruded along x from x0 to x1."""
    a = sum((prof[i][0]*prof[i-1][1] - prof[i-1][0]*prof[i][1]) for i in range(len(prof)))
    if a > 0: prof = list(reversed(prof))          # counter-clockwise round +x
    R = [[bm.verts.new((x, y, z)) for y, z in prof] for x in (x0, x1)]
    fs = skin(bm, R)
    for f in fs: f.smooth = False
    return fs

def hull2d(pts):
    pts = sorted(set(pts))
    def half(ps):
        h = []
        for p in ps:
            while len(h) >= 2 and (h[-1][0]-h[-2][0])*(p[1]-h[-2][1]) - (h[-1][1]-h[-2][1])*(p[0]-h[-2][0]) <= 0: h.pop()
            h.append(p)
        return h
    lo, up = half(pts), half(list(reversed(pts)))
    return lo[:-1] + up[:-1]

def offset2d(poly, d):
    """Move every point of a convex counter-clockwise outline inward by d (along the averaged edge normals)."""
    out = []; n = len(poly)
    for i in range(n):
        a, b, c = Vector(poly[i-1]), Vector(poly[i]), Vector(poly[(i+1) % n])
        n1 = Vector((-(b - a).y, (b - a).x)).normalized(); n2 = Vector((-(c - b).y, (c - b).x)).normalized()
        m = (n1 + n2).normalized(); out.append(tuple(b + m*d/max(0.5, m.dot(n1))))
    return out

def fill_exposed_holes(bm, trees, log, name):
    """After parts are deleted, close every open boundary loop of the remaining parts that lay inside / against a deleted
    part (V7's hidden-face strip removed faces that were covered by them)."""
    bnd = {e for e in bm.edges if len(e.link_faces) == 1}
    flagged = set()
    for e in bnd:
        c = (e.verts[0].co + e.verts[1].co)/2
        for t in trees:
            if t.find_nearest(c, 0.004)[0] is not None or point_inside(t, c): flagged.add(e); break
    done = set(); filled = 0; nf = 0
    for e0 in flagged:
        if e0 in done: continue
        comp = set(); st = [e0]
        while st:                                      # the whole boundary loop this edge belongs to
            e = st.pop()
            if e in comp: continue
            comp.add(e)
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in bnd and e2 not in comp: st.append(e2)
        done |= comp
        res = bmesh.ops.holes_fill(bm, edges=list(comp), sides=0)
        fs = res['faces']
        if fs:
            tri = bmesh.ops.triangulate(bm, faces=fs, quad_method='BEAUTY', ngon_method='BEAUTY')
            for f in tri['faces']: f.smooth = False
            filled += 1; nf += len(tri['faces'])
    log.append(f"holes: {name}: {len(flagged)} open edges exposed by the removed parts, {filled} loops closed with {nf} triangles")

def point_inside(t, p):
    k = 0
    for d in (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))):
        q = p; c = 0
        for _ in range(60):
            h = t.ray_cast(q, d, 5.0)
            if h[0] is None: break
            c += 1; q = h[0] + d*0.0002
        k += c % 2
    return k >= 2

def part_tree(bm, verts):
    from mathutils.bvhtree import BVHTree
    nb = bmesh.new(); m = {v: nb.verts.new(v.co) for v in verts}
    for f in {f for v in verts for f in v.link_faces}: nb.faces.new([m[v] for v in f.verts])
    t = BVHTree.FromBMesh(nb); nb.free(); return t

ENG_TILT = 35.0                                     # cylinder leans forward
MUF_X, MUF_Z, MUF_R, MUF_Y0, MUF_Y1 = -0.265, 0.468, 0.060, 0.675, 0.926
TIP_END = Vector((-0.282, 1.035, 0.490))            # exhaust tip: just under the tail, pointing back and slightly up/out

def v8():
    assert os.path.normcase(V7_BLEND) != os.path.normcase(V8_BLEND)
    bpy.ops.wm.open_mainfile(filepath=V7_BLEND)
    from mathutils.bvhtree import BVHTree
    O = bpy.data.objects; root = O['ATV_Default_Source']; log = []
    fb = world_bm(O['Body_Frame']); mb = world_bm(O['Body_Metal']); tb = world_bm(O['Body_Trim']); pb = world_bm(O['Body_Paint'])

    # 1. remove the plain grey engine box and the old exhaust (pipe, muffler, tip: hidden up inside the right rear fender,
    #    nobody saw them, and the muffler went through the rear shock)
    rem = []; trees = []
    for p in loose_parts(mb):
        lo, hi = bbox(p)
        if lo.z < 0.27 and hi.x - lo.x > 0.4 and hi.z > 0.55: what = 'engine box'
        elif hi.x < -0.15 and lo.y > 0.05 and hi.y - lo.y > 0.1 and hi.z < 0.65: what = 'old exhaust'
        else: continue
        rem.append(p); trees.append(part_tree(mb, p))
        log.append(f"removed {what}: {len(p)} verts ({lo.x:+.3f},{lo.y:+.3f},{lo.z:+.3f})..({hi.x:+.3f},{hi.y:+.3f},{hi.z:+.3f})")
    assert len(rem) == 4, len(rem)
    for p in rem: delete_verts(mb, p)
    for bm, nm in ((pb, 'Body_Paint'), (fb, 'Body_Frame'), (tb, 'Body_Trim'), (mb, 'Body_Metal')):
        fill_exposed_holes(bm, trees, log, nm)
    paint = BVHTree.FromBMesh(pb)

    # reference points on the right frame rail (the loose Body_Frame part running the length of the body on -x)
    rail = [p for p in loose_parts(fb) if (lambda lo, hi: hi.y - lo.y > 1.0 and hi.z < 0.3 and hi.x < 0)(*bbox(p))]
    assert len(rail) == 1, len(rail)
    rail = rail[0]
    def rail_at(y):
        vs = []                                       # where the rail's edges cross the plane at y
        for v in rail:
            for e in v.link_edges:
                a, b = e.verts[0].co, e.verts[1].co
                if (a.y - y)*(b.y - y) <= 0 and abs(a.y - b.y) > 1e-6: vs.append(a.lerp(b, (y - a.y)/(b.y - a.y)))
        return Vector((sum(v.x for v in vs)/len(vs), y, max(v.z for v in vs)))
    rail_end = max(rail, key=lambda v: v.co.y).co.copy()

    nb = {'Frame': bmesh.new(), 'Metal': bmesh.new(), 'Trim': bmesh.new()}   # new parts, merged at the end
    F, M, T = nb['Frame'], nb['Metal'], nb['Trim']
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))

    # 2. engine: crankcase + gearbox (stepped), a finned cylinder leaning forward, a CVT cover on the left (+x)
    cbox(M, Vector((0, 0.0, 0.355)), Vector((0.125, 0.17, 0.085)), 0.025)          # crankcase z 0.27..0.44 (top into the tank)
    cbox(M, Vector((0, 0.235, 0.345)), Vector((0.10, 0.08, 0.065)), 0.02)          # gearbox behind it, lower and narrower
    tube(M, Vector((0, -0.16, 0.31)), Vector((0, -0.20, 0.31)), 0.032, 10)          # front output boss
    tube(M, Vector((0, 0.305, 0.31)), Vector((0, 0.345, 0.31)), 0.032, 10)          # rear output boss
    th = math.radians(90 + ENG_TILT)
    cyl = loft(0, 0, 0, 1, [(0.060, 0.060, 0.0), (0.060, 0.060, 0.045), (0.075, 0.075, 0.045), (0.075, 0.075, 0.056),
                            (0.058, 0.058, 0.056), (0.058, 0.058, 0.085), (0.075, 0.075, 0.085), (0.075, 0.075, 0.096),
                            (0.058, 0.058, 0.096), (0.060, 0.060, 0.120), (0.066, 0.066, 0.120), (0.066, 0.066, 0.165),
                            (0.052, 0.052, 0.175)], 12, p=4.0, sharp=40)
    cyl.transform(Matrix.Translation((0, -0.12, 0.40)) @ Matrix.Rotation(th, 4, 'X'))
    merge_into(M, cyl)
    c1, r1, c2, r2 = (-0.12, 0.365), 0.078, (0.13, 0.37), 0.085
    pts = [(c[0] + r*math.cos(2*math.pi*i/20), c[1] + r*math.sin(2*math.pi*i/20)) for c, r in ((c1, r1), (c2, r2)) for i in range(20)]
    out = hull2d(pts); inn = offset2d(out, 0.012)
    R = [[T.verts.new((x, y, z)) for y, z in ring] for x, ring in ((0.118, out), (0.176, out), (0.190, inn))]
    skin(T, R)                                                                       # CVT cover (black), outer face chamfered
    log.append(f"engine: crankcase + gearbox + cylinder (tilt {ENG_TILT:.0f} deg) + CVT cover x 0.118..0.190, outline {len(out)} pts")

    # 3. drivetrain: prop shafts, front and rear differentials, four half-shafts with CV boots
    for y0, y1 in ((-0.20, -0.545), (0.345, 0.535)):
        d = math.copysign(1, y1 - y0); at = lambda y: Vector((0, y, 0.31 - 0.01*(y - y0)/(y1 - y0)))
        tube(F, at(y0 + 0.012*d), at(y1 - 0.012*d), 0.016, 8)            # ends inside the collars (no shared cap planes)
        for a, b in ((y0 - 0.005*d, y0 + 0.03*d), (y1 - 0.03*d, y1 + 0.005*d)):
            tube(M, at(a), at(b), 0.024, 8)
    for sy, R0, W in ((-1, 0.066, 0.058), (1, 0.072, 0.062)):
        c = Vector((0, sy*0.62, 0.30))
        lathe(M, c, X, Z, [(-W, 0), (-W, R0*0.68), (-W + 0.010, R0), (W - 0.010, R0), (W, R0*0.68), (W, 0)], 12)
        lathe(M, c, Y*-sy, Z, [(R0*0.55, 0), (R0*0.55, 0.035), (R0 + 0.022, 0.035), (R0 + 0.022, 0.030), (R0 + 0.045, 0.030), (R0 + 0.045, 0)], 8)
        for sx in (1, -1):
            lathe(M, c + X*sx*(W - 0.01), X*sx, Z, [(0, 0), (0, 0.032), (0.035, 0.032), (0.035, 0)], 8)
            h = Vector((sx*0.085, sy*0.62, 0.30)); a = X*sx
            lathe(T, h, a, Z, [(-0.005, 0), (-0.005, 0.030), (0.008, 0.034), (0.022, 0.026), (0.034, 0.029), (0.057, 0.015), (0.057, 0)], 8)
            lathe(F, h, a, Z, [(0.05, 0), (0.05, 0.013), (0.168, 0.013), (0.168, 0)], 8)
            lathe(T, h, a, Z, [(0.160, 0), (0.160, 0.015), (0.183, 0.029), (0.195, 0.026), (0.209, 0.034), (0.221, 0.031), (0.221, 0)], 8)
            se = 0.241 if sy < 0 else 0.251              # front stubs 1 cm shorter: less of them enters a steered wheel
            lathe(M, h, a, Z, [(0.216, 0), (0.216, 0.027), (se, 0.027), (se, 0)], 8)
    log.append("drivetrain: front + rear prop shaft with joint collars, 2 differentials (pinion nose, side outputs), 4 half-shafts "
               "x 0.085..0.336 at the hub line, ribbed CV boots both ends, hub stub into the wheel hub (static)")

    # 4. steering under the nose: column stub, pitman arm, two tie rods to steering arms on the hub stubs (static)
    tube(F, Vector((0, -0.468, 0.365)), Vector((0, -0.379, 0.600)), 0.018, 8)
    cbox(M, Vector((0, -0.475, 0.37)), Vector((0.052, 0.022, 0.012)), 0.006)
    for sx in (1, -1):
        # the outer end sits close to the steering axis line so the static rod barely enters the steered wheel
        a, b, k = Vector((sx*0.045, -0.48, 0.37)), Vector((sx*0.290, -0.572, 0.31)), Vector((sx*0.306, -0.605, 0.30))
        tube(F, a, b, 0.009, 6)
        tube(F, b, k, 0.011, 6)
        for p in (a, b): tube(M, p - Z*0.013, p + Z*0.013, 0.015, 8)
    log.append("steering: column stub, pitman arm, 2 tie rods (r 9 mm) ending at x +/-0.29 just behind the front hubs, static")

    # 5. skid plates (bent sheet, dark frame grey) under the nose / front differential and under the engine, with bolt heads
    prism(F, [(-0.800, 0.200), (-0.615, 0.200), (-0.600, 0.213), (-0.800, 0.213)], -0.165, 0.165)
    prism(F, [(-0.300, 0.262), (-0.255, 0.205), (0.330, 0.205), (0.330, 0.217), (-0.247, 0.217), (-0.288, 0.268)], -0.190, 0.190)
    for x, y, zb in ((0.13, -0.775, 0.200), (-0.13, -0.775, 0.200), (0.13, -0.635, 0.200), (-0.13, -0.635, 0.200),
                     (0.16, -0.20, 0.205), (-0.16, -0.20, 0.205), (0.16, 0.30, 0.205), (-0.16, 0.30, 0.205)):
        lathe(M, Vector((x, y, zb + 0.0015)), -Z, X, [(0, 0), (0, 0.009), (0.006, 0.009), (0.006, 0)], 6)   # 4.5 mm proud
    log.append("skid plates: front y -0.800..-0.600 x +/-0.165, engine y -0.300..0.330 x +/-0.190 (front lip bent up), bottom z 0.200, 8 bolt heads")

    # 6. exhaust on the right (-x): header from the cylinder head, along the right of the engine above the rail, up past the
    #    inside of the rear shock, into a muffler canister behind the right rear wheel, tip out under the tail
    path = [Vector(p) for p in ((-0.020, -0.225, 0.485), (-0.030, -0.290, 0.445), (-0.090, -0.335, 0.405), (-0.155, -0.300, 0.388),
                                (-0.172, -0.220, 0.385), (-0.172, 0.050, 0.385), (-0.172, 0.300, 0.395), (-0.172, 0.420, 0.452),
                                (-0.175, 0.600, 0.460), (-0.205, 0.685, 0.468), (-0.245, 0.715, 0.468))]
    path = catmull(path, 3)
    path_tube(M, path, 0.020, 8)
    mc = Vector((MUF_X, 0, MUF_Z))
    lathe(M, mc, Y, Z, [(MUF_Y0, 0), (MUF_Y0, 0.040), (MUF_Y0 + 0.010, MUF_R - 0.004), (MUF_Y0 + 0.020, MUF_R),
                        (MUF_Y1 - 0.021, MUF_R), (MUF_Y1 - 0.008, MUF_R - 0.006), (MUF_Y1, 0.042), (MUF_Y1, 0)], 12)
    t0 = Vector((MUF_X - 0.004, MUF_Y1 - 0.03, MUF_Z + 0.002)); ax = TIP_END - t0; L = ax.length
    lathe(M, t0, ax, Z, [(0, 0), (0, 0.020), (L, 0.020), (L, 0.0145), (L - 0.022, 0.0145)], 10, caps=False)  # bore left open
    lathe(T, t0, ax, Z, [(L - 0.022, 0.0145), (L - 0.022, 0)], 10, caps=False)                     # dark bore bottom, same ring
    for yb in (0.720, 0.880):                                                                        # clamp bands
        lathe(F, mc, Y, Z, [(yb - 0.009, 0), (yb - 0.009, MUF_R + 0.003), (yb + 0.009, MUF_R + 0.003), (yb + 0.009, 0)], 12)
    re = rail_end + Vector((0.01, -0.012, -0.004))
    tube(F, Vector((MUF_X + 0.040, 0.720, MUF_Z - 0.045)), re, 0.008, 4)                           # hanger down to the rail end
    hit = paint.ray_cast(Vector((MUF_X, 0.880, MUF_Z)), Z)[0]
    top = hit.z if hit is not None else MUF_Z + 0.08
    tube(F, Vector((MUF_X, 0.880, MUF_Z + MUF_R - 0.002)), Vector((MUF_X, 0.880, top + 0.008)), 0.008, 4)   # tab up to the body
    for y in (-0.05, 0.25):                                                                          # pipe hangers to the rail
        r = rail_at(y)
        tube(F, Vector((-0.172, y, 0.372)), Vector((r.x, y, r.z - 0.006)), 0.007, 4)
    gaps = []
    for ang in range(0, 360, 30):
        q = mc + Vector((math.cos(math.radians(ang))*MUF_R, 0, math.sin(math.radians(ang))*MUF_R))
        for y in (0.70, 0.80, 0.90):
            h = paint.ray_cast(Vector((q.x, y, q.z)), Z, 0.5)[0]
            if h is not None: gaps.append(h.z - q.z)
    log.append(f"exhaust: header + pipe {len(path)} rings r 0.020, muffler r {MUF_R} y {MUF_Y0}..{MUF_Y1} at x {MUF_X} z {MUF_Z} "
               f"(min gap to the body above {min(gaps)*100:.1f} cm), tip end {tuple(round(c, 3) for c in TIP_END)}, "
               f"{(TIP_END - g2b(ANCHORS['anchor_exhaust'])).length*100:.1f} cm from anchor_exhaust; 2 clamps, 2 muffler hangers "
               f"(rail end {tuple(round(c, 3) for c in rail_end)}, body at z {top:.3f}), 2 pipe hangers")

    # 7. report how the new parts sit: lowest point, bounds, and how deep they reach into a steered front wheel
    allv = [v.co for b in nb.values() for v in b.verts]
    lo = Vector([min(v[i] for v in allv) for i in range(3)]); hi = Vector([max(v[i] for v in allv) for i in range(3)])
    log.append(f"new parts: {sum(len(b.faces) for b in nb.values())} faces, bounds ({lo.x:+.3f},{lo.y:+.3f},{lo.z:+.3f})..({hi.x:+.3f},{hi.y:+.3f},{hi.z:+.3f})")
    assert lo.z >= 0.12 and abs(lo.x) <= 0.611 and hi.x <= 0.611 and lo.y >= -1.023 and hi.y <= 1.043
    for ang in (0, 25, 30, 35):
        worst = {}
        for nm, b in nb.items():
            for v in b.verts:
                for sx in (1, -1):
                    for a in (ang, -ang):
                        d = v.co - Vector((sx*HUB_X, -HUB_Y, HUB_Z))
                        lx = sx*(d.x*math.cos(math.radians(a)) + d.y*math.sin(math.radians(a)))
                        ly = -d.x*math.sin(math.radians(a)) + d.y*math.cos(math.radians(a))
                        r = math.hypot(ly, d.z)
                        if r < 0.29 and -0.118 < lx < 0.118 and r > 0.06:   # inside the tyre / rim volume, outside the hub core
                            if lx + 0.118 > worst.get(nm, (0,))[0]: worst[nm] = (lx + 0.118, v.co.copy())
        log.append(f"front wheel at {ang} deg: new parts reach into the wheel (outside the hub core) by up to " +
                   (", ".join(f"{k} {d*100:.1f} cm at ({p.x:+.3f},{p.y:+.3f},{p.z:+.3f})" for k, (d, p) in worst.items()) or "0 cm"))
    for b, key in ((fb, 'Frame'), (mb, 'Metal'), (tb, 'Trim')):
        mark_sharp(nb[key], 40); merge_into(b, nb[key])
    put_bm(O['Body_Frame'], fb); put_bm(O['Body_Metal'], mb); put_bm(O['Body_Trim'], tb); put_bm(O['Body_Paint'], pb)
    for b in (fb, mb, tb, pb): b.free()
    # same hidden-face strip as V7 (face invisible from 600 directions AND inside another closed part): drops the shaft end
    # caps inside boots / collars / hubs, the tops of the engine blocks inside the tank, and so on
    body = ['Body_Paint', 'Body_Frame', 'Body_Trim', 'Body_Metal', 'Body_Headlights', 'Body_Taillights']
    res = strip_hidden([body])
    log.append("hidden faces removed: " + ", ".join(f"{k} {f} faces / {t} tris" for k, (f, t) in res.items()))

    # 8. cleanliness pass as in V7 (merge doubles, drop loose verts, closed parts outward)
    flips = 0; merged = 0
    for o in tree(root):
        if o.type != 'MESH': continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        nv = len(bm.verts)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
        merged += nv - len(bm.verts)
        loose = [v for v in bm.verts if not v.link_faces]
        if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
        flips += fix_part_normals(bm)
        bm.to_mesh(o.data); o.data.update(); bm.free()
    log.append(f"cleanup: {merged} duplicate vertices merged, {flips} closed parts flipped outward")
    col = bpy.data.collections.get('ATV V7')
    if col: col.name = 'ATV V8'
    for o in tree(root):
        if o.type == 'MESH': o.data.name = o.name
    bpy.ops.wm.save_as_mainfile(filepath=V8_BLEND)
    export(root, V8_GLB)
    for l in log: print('LOG', l)

# ---------------------------------------------------------------- check
def samples(o, step=0.01):
    """Points on every triangle, tagged with the loose part they belong to."""
    me = o.data; M = o.matrix_world; pts = []
    bm = bmesh.new(); bm.from_mesh(me); pid = {}
    for k, comp in enumerate(loose_parts(bm)):
        for v in comp: pid[v.index] = k
    bm.free()
    me.calc_loop_triangles()
    for t in me.loop_triangles:
        a, b, c = [M @ me.vertices[i].co for i in t.vertices]
        L = max((a-b).length, (b-c).length, (c-a).length); n = max(1, int(L/step))
        k = pid[t.vertices[0]]
        for i in range(n+1):
            for j in range(n+1-i): pts.append((a + (b-a)*(i/n) + (c-a)*(j/n), k))
    return pts

def check():
    bpy.ops.wm.open_mainfile(filepath=DST)
    O = bpy.data.objects; root = O['ATV_Default_Source']
    meshes = [o for o in tree(root) if o.type == 'MESH']
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles(); n = len(o.data.loop_triangles); tris += n
        print(f"MESH {o.name:18s} parent={o.parent.name:16s} tris={n:6d} mats={[m.name for m in o.data.materials]}")
    print("TOTAL tris", tris, "meshes", len(meshes), "draw calls (mesh x material)", sum(len(o.data.materials) for o in meshes))
    print("MATERIALS", sorted({m.name for o in meshes for m in o.data.materials}))
    # tyre clearance: body points inside a wheel's tyre annulus (r 0.17..0.305, |lx| < 0.125) at 0 and +/-35 deg
    body = [o for o in meshes if not o.name.startswith('WheelMesh')]
    S = {o.name: samples(o) for o in body}
    for side in ('FL', 'FR', 'RL', 'RR'):
        for ang in ((0, CHECK_STEER, -CHECK_STEER) if side[0] == 'F' else (0,)):
            if side[0] == 'F': O['steer_' + side].rotation_euler = (0, 0, math.radians(ang))
            bpy.context.view_layer.update()
            Mi = O['wheel_' + side].matrix_world.inverted()
            for n, pts in S.items():
                bad = {}
                for p, k in pts:
                    l = Mi @ p; r = math.hypot(l.y, l.z)
                    if abs(l.x) < 0.125 and 0.17 < r < 0.305:
                        depth = min(0.305 - r, 0.125 - abs(l.x), r - 0.17)   # how far inside the tyre rubber
                        bad.setdefault(k, []).append((p, depth))
                for k, bp in bad.items():
                    ps = [p for p, d in bp]; dmax = max(d for p, d in bp)
                    lo = [min(p[i] for p in ps) for i in range(3)]; hi = [max(p[i] for p in ps) for i in range(3)]
                    print(f"CLASH {side} {ang:+.0f}: {n} part{k} {len(ps)} pts depth {dmax*100:.1f} cm ({lo[0]:.3f},{lo[1]:.3f},{lo[2]:.3f})..({hi[0]:.3f},{hi[1]:.3f},{hi[2]:.3f})")
            if side[0] == 'F': O['steer_' + side].rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    # ground
    for o in meshes:
        zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
        print(f"LOWZ {o.name:18s} {min(zs):+.4f}")
    # anchors vs contract and vs the real parts
    for n, p in ANCHORS.items():
        a = O.get(n)
        print(f"ANCHOR {n:20s} " + ("MISSING" if a is None else f"off contract by {(a.matrix_world.translation - g2b(p)).length*1000:.1f} mm"))
    def part_centre(objname, sel):
        o = O[objname]; bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
        best = None
        for p in loose_parts(bm):
            lo, hi = bbox(p)
            if sel(lo, hi): best = (lo, hi) if best is None or (hi-lo).length > (best[1]-best[0]).length else best
        bm.free(); return best
    def rep(name, actual):
        a = O[name].matrix_world.translation
        d = actual - a
        print(f"PART {name:20s} part at ({actual.x:+.3f},{actual.y:+.3f},{actual.z:+.3f}) anchor ({a.x:+.3f},{a.y:+.3f},{a.z:+.3f}) diff {d.length*100:.1f} cm ({d.x*100:+.1f},{d.y*100:+.1f},{d.z*100:+.1f}) [Blender axes]")
    for sx, nm in ((1, 'L'), (-1, 'R')):
        lo, hi = part_centre('Handlebar_Trim', lambda lo, hi: min(sx*lo.x, sx*hi.x) > 0.29 and max(sx*lo.x, sx*hi.x) > 0.4)
        # grip: Handlebar_Trim merged; its loose part spanning |x| 0.31..0.43
        rep('anchor_hands_' + nm, (lo + hi)/2)
        lo, hi = part_centre('Body_Trim', lambda lo, hi: hi.z < 0.37 and sx*lo.x > 0.1 and (hi.y-lo.y) > 0.5)
        rep('anchor_foot_' + nm, Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, hi.z)))
        lo, hi = part_centre('Body_Headlights', lambda lo, hi: sx*lo.x > 0)
        rep('anchor_headlight_' + nm, (lo + hi)/2)
        lo, hi = part_centre('Body_Taillights', lambda lo, hi: sx*lo.x > 0.2)
        rep('anchor_taillight_' + nm, (lo + hi)/2)
    # seat top under the seat anchor (ray down)
    seat = O['Body_Trim']; a = O['anchor_driver_seat'].matrix_world.translation
    ok, loc, nrm, idx = seat.ray_cast(seat.matrix_world.inverted() @ (a + Vector((0, 0, 0.5))), Vector((0, 0, -1)))
    if ok: rep('anchor_driver_seat', seat.matrix_world @ loc)
    print("CHECK DONE")

# ---------------------------------------------------------------- render
def render():
    bpy.ops.wm.open_mainfile(filepath=DST)
    os.makedirs(PREV, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 960
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.view_settings.exposure = 0.0
    for o in bpy.data.objects:
        if o.type == 'LIGHT': o.hide_render = True          # the file's own area lights: replaced by one sun + sky for the previews
    if sc.world is None: sc.world = bpy.data.worlds.new('W')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    if bg: bg.inputs['Color'].default_value = (0.42, 0.47, 0.52, 1); bg.inputs['Strength'].default_value = 0.45
    for o in list(bpy.data.objects):
        if o.type == 'CAMERA': bpy.data.objects.remove(o)
    sun = bpy.data.lights.new('preview_sun', 'SUN'); sun.energy = 3.2; sun.angle = math.radians(3)
    so = bpy.data.objects.new('preview_sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(40), math.radians(10), math.radians(35))
    cd = bpy.data.cameras.new('pc'); cam = bpy.data.objects.new('pc', cd); sc.collection.objects.link(cam); sc.camera = cam
    views = [
        ('front34', (2.3, -3.2, 1.7), (0, 0, 0.5), 40, 0),
        ('side', (4.6, 0, 0.75), (0, 0, 0.5), 35, 0),
        ('rear34', (-2.4, 3.2, 1.8), (0, 0, 0.5), 40, 0),
        ('top', (0, 0, 5.5), (0, 0, 0), 35, 0),
        ('front_close_steer35', (1.45, -2.05, 1.25), (0.25, -0.62, 0.45), 38, STEER),
        ('front_steer35_from_front', (0.6, -2.6, 0.9), (0.15, -0.6, 0.45), 40, STEER),
        ('tyre_close', (1.5, -1.3, 0.55), (0.47, -0.62, 0.3), 30, 0),
        ('handlebar_close', (0.9, 0.6, 1.6), (0, -0.3, 0.95), 35, 0),
        ('lights_front_close', (0.55, -1.9, 0.75), (0.1, -0.9, 0.52), 30, 0),
        ('low_front', (1.1, -4.2, 0.55), (0, -0.2, 0.5), 32, 0),
        ('low_beside', (3.2, -1.4, 0.6), (0, -0.1, 0.5), 35, 0),
        ('rider_view', (0, 0.42, 1.55), (0, -0.75, 0.80), 70, 0),
        ('tail_close', (-0.55, 2.0, 0.85), (0.12, 0.95, 0.62), 32, 0),
        ('front_far_20m', (6.0, -19.0, 1.7), (0, 0, 0.5), 50, 0),
        ('fender_close', (1.5, -1.25, 0.75), (0.5, -0.75, 0.6), 30, 0),
        ('fender_side_close', (2.2, -0.75, 0.62), (0.5, -0.75, 0.6), 22, 0),
        # V8 underside: camera below the floor plane (floor hidden, a weak fill sun from below so the parts read)
        ('u_straight', (0, 0, -4.2), (0, 0, 0.3), 38, 0),
        ('u_rear_low', (-0.9, 3.1, -0.7), (0, 0.1, 0.3), 40, 0),
        ('u_front_low', (0.9, -3.1, -0.7), (0, -0.1, 0.3), 40, 0),
        ('u_side_left', (3.6, 0.4, -0.9), (0, 0, 0.3), 36, 0),
        ('u_side_right', (-3.6, -0.4, -0.9), (0, 0, 0.3), 36, 0),
        ('u_jump_34', (2.4, -2.2, -1.4), (0, 0, 0.3), 40, 0),
        ('u_close_rear', (-0.5, 1.6, -0.35), (-0.05, 0.2, 0.3), 45, 0),
        ('u_close_front', (0.45, -1.6, -0.3), (0.0, -0.35, 0.3), 45, 0),
        ('u_steer35', (1.2, -1.7, -0.5), (0.2, -0.55, 0.3), 40, STEER),
        ('g_low_rear', (-0.7, 3.2, 0.14), (0, 0.2, 0.32), 36, 0),
        ('g_low_side', (3.4, 0.2, 0.12), (0, 0, 0.32), 36, 0),
        ('g_low_right', (-3.0, 1.4, 0.16), (0, 0.1, 0.35), 36, 0),
    ]
    floor = bpy.data.objects.get('Preview floor')
    sun2 = bpy.data.lights.new('preview_fill', 'SUN'); sun2.energy = 0.0
    so2 = bpy.data.objects.new('preview_fill', sun2); sc.collection.objects.link(so2); so2.rotation_euler = (math.radians(150), math.radians(-15), math.radians(20))
    for name, loc, tgt, fov, steer in views:
        if len(ARGS) > 1 and name not in ARGS[1:]: continue      # '-- render tail_close side' renders just those
        under = name.startswith('u_')
        if floor: floor.hide_render = under
        sun2.energy = 2.0 if under else 0.0
        for s in ('steer_FL', 'steer_FR'): bpy.data.objects[s].rotation_euler = (0, 0, math.radians(steer))
        cam.location = loc
        cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        if name == 'top': cam.rotation_euler = (0, 0, 0)
        if name == 'u_straight': cam.rotation_euler = (math.pi, 0, 0)      # looking straight up, nose at the top of the image
        cd.angle = math.radians(fov)
        sc.render.filepath = os.path.join(PREV, name + '.png')
        bpy.ops.render.render(write_still=True)
    print("RENDER DONE")

def glbcheck():
    """Re-import the exported .glb into an empty scene: world bounds in glTF axes, lowest points, node names."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    bpy.context.view_layer.update()
    allp = []; low = {}
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        ps = [o.matrix_world @ v.co for v in o.data.vertices]; allp += ps
        low[o.name] = min(p.z for p in ps)
    lo = [min(p[i] for p in allp) for i in range(3)]; hi = [max(p[i] for p in allp) for i in range(3)]
    # Blender (x, y, z) -> glTF (x, z, -y)
    print(f"GLB bounds glTF: x {lo[0]:+.3f}..{hi[0]:+.3f}  y {lo[2]:+.3f}..{hi[2]:+.3f}  z {-hi[1]:+.3f}..{-lo[1]:+.3f}")
    print(f"GLB size: width {hi[0]-lo[0]:.3f} height {hi[2]-lo[2]:.3f} length {hi[1]-lo[1]:.3f}")
    for n, z in sorted(low.items()): print(f"GLB low {n:18s} {z:+.4f}")
    noparts = [o.name for o in bpy.data.objects if o.type == 'MESH' and o.name not in ('Body_Paint', 'Body_Frame', 'Body_Trim', 'Body_Metal', 'Body_Headlights', 'Body_Taillights', 'Handlebar_Frame', 'Handlebar_Trim', 'Handlebar_Metal') and not o.name.startswith('WheelMesh')]
    print("GLB unexpected meshes", noparts)
    print("GLB parents", {o.name: o.parent.name if o.parent else None for o in bpy.data.objects if o.name.startswith(('wheel_', 'steer_', 'Handlebar', 'WheelMesh'))})
    print("GLB DONE")

{'build': build, 'polish': polish, 'v8': v8, 'check': check, 'render': render, 'glbcheck': glbcheck}[MODE]()
