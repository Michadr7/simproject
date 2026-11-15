# ATV V6 finish (own work, licence 'Own work', no credit line). Headless Blender 5.2:
#   blender --background --python scripts/atv-finish.py -- build    (V4.1 .blend -> V6 .blend + .glb)
#   blender --background --python scripts/atv-finish.py -- check    (clash + anchor report on the V6 .blend)
#   blender --background --python scripts/atv-finish.py -- render   (preview PNGs into 'ATV V6 previews')
# The source 'ATV Utility - V4.1 Detail Cleanup.blend' is only READ; everything is saved as V6.
# Contract: notes/atv-model-prompt.md. Improve list: notes/atv-v6-improve-prompt.md.
# Blender axes: nose -Y, +X = vehicle left, Z up (glTF: X, Z, -Y).
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

DIR = r"C:\Users\Michael\Documents\Projects\Assets Sim Project"
SRC = os.path.join(DIR, "ATV Utility - V4.1 Detail Cleanup.blend")
DST = os.path.join(DIR, "ATV Utility - V6 Game.blend")
GLB = os.path.join(DIR, "ATV Utility - V6 Game.glb")
PREV = os.path.join(DIR, "ATV V6 previews")
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = (ARGS + ['build'])[0]

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
    assert os.path.normcase(SRC) != os.path.normcase(DST)
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
    bpy.ops.wm.save_as_mainfile(filepath=DST)
    export(root)
    for l in log: print('LOG', l)

def export(root):
    bpy.ops.object.select_all(action='DESELECT')
    for o in tree(root): o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_cameras=False, export_lights=False)

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
    ]
    for name, loc, tgt, fov, steer in views:
        for s in ('steer_FL', 'steer_FR'): bpy.data.objects[s].rotation_euler = (0, 0, math.radians(steer))
        cam.location = loc
        cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler() if name != 'top' else (0, 0, 0)
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

{'build': build, 'check': check, 'render': render, 'glbcheck': glbcheck}[MODE]()
