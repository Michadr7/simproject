# sr90 'Low Poly Farming Pack' catalogue + export (licence: none required, free to use; confirmed by the user).
# Headless Blender 5.2, run from the repo root:
#   blender -b assets-src/Farm/list1_detailed_FARM.blend --python scripts/farm-sr90.py -- sheets [all|vehicles|machinery|...]
#   blender -b assets-src/Farm/list1_detailed_FARM.blend --python scripts/farm-sr90.py -- list <out.txt>
#   blender -b assets-src/Farm/list1_detailed_FARM.blend --python scripts/farm-sr90.py -- export [name ...]
#   blender -b <glb-less> --python scripts/farm-sr90.py -- renderglb <glb> <png-prefix>
# Source facts (verified): Blender Z up, 1 unit = 1 m, all objects scale 1 / rotation 0 under identity empties.
# The whole pack shares ONE colour palette atlas (texture_0, 4096x4096, a grid of flat colour cells) through the material
# 'Universal Shader V10'; there are no painted textures. We therefore convert to flat colours by sampling the atlas at each face's UV.
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'assets-src', 'Farm')
OUT = os.path.join(SRC, 'sr90')
PREV = os.path.join(OUT, 'previews')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = (ARGS + ['list'])[0]

# ------------------------------------------------------------------ colour atlas
_ATLAS = {}
def atlas():
    if 'px' not in _ATLAS:
        img = bpy.data.images['texture_0']; w, h = img.size
        a = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(a)
        _ATLAS['px'] = a.reshape(h, w, 4); _ATLAS['wh'] = (w, h)
    return _ATLAS['px'], _ATLAS['wh']

def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)

def sample_uv(u, v):
    px, (w, h) = atlas()
    return px[min(h - 1, max(0, int(v * h))), min(w - 1, max(0, int(u * w))), :3]

def srgb8(lin):
    return tuple(int(round(float(min(1.0, max(0.0, x))) * 255)) for x in np.asarray(lin))      # image.pixels of this byte sRGB atlas are already sRGB-encoded (verified against the palette PNG)

def hexof(c8): return '%02x%02x%02x' % c8

def face_colours(ob):
    """[(role, (r,g,b) 8-bit sRGB)] per polygon. role: 'solid', 'glass', 'light'."""
    me = ob.data; uvl = me.uv_layers.active.data if me.uv_layers.active else None
    slot_role = []
    for s in ob.material_slots:
        n = s.material.name if s.material else ''
        slot_role.append('glass' if 'Glass' in n else ('light' if 'Emissive' in n else 'solid'))
    out = []
    for p in me.polygons:
        role = slot_role[p.material_index] if p.material_index < len(slot_role) else 'solid'
        if uvl is None: out.append((role, (200, 200, 200))); continue
        cols = [srgb8(sample_uv(uvl[l].uv[0], uvl[l].uv[1])) for l in p.loop_indices]
        uc = sum(uvl[l].uv[0] for l in p.loop_indices) / p.loop_total; vc = sum(uvl[l].uv[1] for l in p.loop_indices) / p.loop_total
        cc = srgb8(sample_uv(uc, vc))
        cnt = {}
        for c in cols: cnt[c] = cnt.get(c, 0) + 1
        best = max(cnt.values()); c = cc if cc in cnt and cnt[cc] == best else [k for k, v in cnt.items() if v == best][0]
        if role == 'light' and ob.material_slots[p.material_index].material.name.endswith('Back'): c = (255, 40, 30)
        out.append((role, c))
    return out

def flat_material(name, c8, alpha=1.0, rough=0.7):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name); m.use_nodes = True
        lin = [((x / 255) / 12.92 if x / 255 <= 0.04045 else ((x / 255 + 0.055) / 1.055) ** 2.4) for x in c8]
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*lin, 1.0); b.inputs['Roughness'].default_value = rough
        b.inputs['Alpha'].default_value = alpha
        m.diffuse_color = (*lin, alpha)
        if alpha < 1.0:
            try: m.surface_render_method = 'BLENDED'
            except Exception: pass
    return m

def sq(a, b): return sum((x - y) ** 2 for x, y in zip(a, b))

def cluster(keys_area, K):
    """keys_area {(role,c8): area/count}; merge the smallest colour into its nearest (same role) until <= K. returns map key->key."""
    cur = dict(keys_area); mp = {k: k for k in cur}
    while len(cur) > K:
        k = min(cur, key=lambda x: cur[x])
        cand = [o for o in cur if o != k and o[0] == k[0]] or [o for o in cur if o != k]
        t = min(cand, key=lambda o: sq(o[1], k[1]))
        cur[t] += cur.pop(k)
        for a in mp:
            if mp[a] == k: mp[a] = t
    return mp

def role_name(key, saturated_big=None):
    role, c = key
    if role == 'glass': return 'Glass'
    if role == 'light': return 'Light'
    return None

def hsv(c8):
    import colorsys
    return colorsys.rgb_to_hsv(*[x / 255 for x in c8])

def assign_flat(ob, K=None, names=None, face_sel=None):
    """Rebuild ob's material slots as flat colour materials from the atlas. K: max colours (None = all). Returns summary dict."""
    fc = face_colours(ob); me = ob.data
    area = {}
    for p, key in zip(me.polygons, fc): area[key] = area.get(key, 0) + p.area
    mp = cluster(area, K) if K else {k: k for k in area}
    final = {}
    for k, v in area.items(): final[mp[k]] = final.get(mp[k], 0) + v
    # names: Glass, Light, Paint (largest saturated), Tire/Trim (darkest), others Flat_hex
    nm = {}
    solids = sorted([k for k in final if k[0] == 'solid'], key=lambda k: -final[k])
    paint = next((k for k in solids if hsv(k[1])[1] > 0.3 and hsv(k[1])[2] > 0.25), None)
    for k in final:
        if k[0] == 'glass': nm[k] = 'Glass'
        elif k[0] == 'light': nm[k] = 'Light'
        elif k == paint: nm[k] = 'Paint'
        else: nm[k] = 'Flat_' + hexof(k[1])
    me.materials.clear(); idx = {}
    for k in final:
        a = 0.45 if k[0] == 'glass' else 1.0
        mname = nm[k] if nm[k] in ('Glass', 'Light', 'Paint') and False else (nm[k] + ('' if nm[k].startswith('Flat_') else '_' + hexof(k[1])))
        mat = flat_material(mname, k[1], a); me.materials.append(mat); idx[k] = len(me.materials) - 1
    for p, key in zip(me.polygons, fc): p.material_index = idx[mp[key]]
    return {'colours_before': len(area), 'colours_after': len(final), 'names': [nm[k] for k in final]}

def tri_count(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)

def world_bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])

# ------------------------------------------------------------------ catalogue sheets
GROUPS = {
 'vehicles': ['ATV', 'Combine_Harvester', 'Combine_Header', 'Pickup_Truck', 'Tractor_Big', 'Tractor_Old'],
 'machinery': ['Baler_Round', 'Cart_Small', 'Cultivator', 'Harrow', 'Mower_Bar', 'Mower_Yellow', 'Rake_Tedder', 'Seeder', 'Sprayer', 'Trailer_Grain', 'Trailer_Red', 'Trailer_Tank'],
 'buildings': ['Barn_Big', 'Barn_Stone', 'Greenhouse', 'House_Brick', 'House_Red', 'Shed_Open', 'FeedBin', 'GrainBin', 'GrainBin_Rusty', 'Silo_Tall', 'Silo_Tall_Rusty', 'WaterTower', 'WindPump', 'Windmill_Dutch', 'Windmill_Wooden'],
 'misc': ['Fence_%03d' % i for i in range(1, 11)] + ['RanchGate_A', 'RanchGate_B', 'Sign_Farm_A', 'Sign_Farm_B', 'Path_Curve_A', 'Path_Curve_B', 'Path_Straight_A', 'Path_Straight_B', 'Path_Straight_Short', 'Tree_001', 'Tree_002', 'Tree_003', 'Tree_004', 'Tree_005', 'Tree_006', 'Farmer_A', 'Farmer_B', 'Ladder', 'PowerLine', 'Tire_A', 'Tire_B'],
}

def shelf_layout(obs, max_w, tsize, gap=0.5):
    """3/4 view: returns {name: (cx, cy)} (footprint centre, y grows away from camera) and total size."""
    items = []
    for ob in obs:
        mn, mx = world_bbox(ob); items.append((ob, mx.x - mn.x, mx.y - mn.y, mx.z - mn.z))
    pos = {}; x = 0; y = 0; row = []; rowh = 0; rows = []
    for it in items:
        if row and x + it[1] > max_w: rows.append(row); row = []; x = 0
        row.append(it); x += it[1] + gap
    if row: rows.append(row)
    y = tsize * 4; W = 0
    for row in rows:
        x = 0; depth = max(i[2] for i in row); hmax = max(i[3] for i in row)
        for ob, w, d, h in row:
            pos[ob.name] = (x + w / 2, y + d / 2); x += w + gap
        W = max(W, x); y += depth + gap + hmax * 0.9 + tsize * 5
    return pos, W, y

def clear_scene_objects(keep):
    for ob in list(bpy.data.objects):
        if ob.name not in keep and ob.type in ('MESH', 'FONT', 'CAMERA', 'LIGHT') and not ob.name.startswith('__'):
            pass

def render_sheet(names, png, scaled=False, max_w=None):
    sc = bpy.context.scene
    obs = [bpy.data.objects[n] for n in names]
    allm = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in allm: o.hide_render = o.name not in names; o.hide_viewport = o.hide_render
    for o in obs:
        if not o.data.get('flat_done'): o.data['flat_done'] = 1; assign_flat(o)
    orig = {o.name: (o.location.copy(), o.scale.copy()) for o in obs}
    created = []
    real = {o.name: (o.dimensions.copy(), tri_count(o)) for o in obs}
    gstep = 1.0
    if scaled:                                           # small items: enlarged into fixed cells, true size in the label
        CELL = 2.0; cols = 6; nrows = (len(obs) + cols - 1) // cols; tsize = 0.12; gstep = CELL
        pos = {}; W = cols * CELL; D = nrows * CELL; k = {}
        for i, o in enumerate(obs):
            r, c = divmod(i, cols); pos[o.name] = (c * CELL + CELL / 2, (nrows - 1 - r) * CELL + 1.15)
            k[o.name] = 0.8 / max(max(o.dimensions), 1e-6)
            o.scale = (k[o.name],) * 3
    else:
        tot = sum((world_bbox(o)[1].x - world_bbox(o)[0].x) * (world_bbox(o)[1].y - world_bbox(o)[0].y) for o in obs)
        maxw0 = max(world_bbox(o)[1].x - world_bbox(o)[0].x for o in obs)
        max_w = max_w or max(maxw0 * 1.05, math.sqrt(tot) * 2.0)
        tsize = max(0.12, max_w / 85)
        pos, W, D = shelf_layout(obs, max_w, tsize)
        k = {o.name: 1.0 for o in obs}
    bpy.context.view_layer.update()
    maxdim = max(o.dimensions.z for o in obs)
    tm = bpy.data.materials.new('txt'); tm.diffuse_color = (0.02, 0.02, 0.02, 1)
    pm = bpy.data.materials.new('pole'); pm.diffuse_color = (0.9, 0.1, 0.1, 1)
    for o in obs:
        mn, mx = world_bbox(o); cx, cy = pos[o.name]
        o.location += Vector((cx - (mn.x + mx.x) / 2, cy - (mn.y + mx.y) / 2, -mn.z))
        bpy.context.view_layer.update()
        d, tr = real[o.name]; sd = o.dimensions
        bpy.ops.object.text_add(location=(cx - (0.8 if scaled else sd.x / 2), cy - sd.y / 2 - tsize * 0.3, 0.003))
        t = bpy.context.active_object
        t.data.body = '%s\n%.2f x %.2f x %.2f m\n%d tris%s' % (o.name, d.x, d.y, d.z, tr, ('  (x%.1f)' % k[o.name]) if scaled else '')
        t.data.size = tsize; t.data.align_x = 'LEFT'; t.data.align_y = 'TOP'; t.data.space_line = 1.0
        t.data.materials.append(tm); created.append(t)
        if not scaled:
            bpy.ops.mesh.primitive_cylinder_add(radius=tsize * 0.05, depth=1.0, location=(cx - sd.x / 2 - tsize * 0.5, cy - sd.y / 2, 0.5)); p = bpy.context.active_object
            p.data.materials.append(pm); created.append(p)
    # grid 1 m (wireframe plane)
    gx, gy = int(math.ceil(W + 2)), int(math.ceil(D + 2))
    bm = bmesh.new(); lw = max(0.012, W / 1200)
    def quad(x0, y0, x1, y1): bm.faces.new([bm.verts.new((x0, y0, 0.004)), bm.verts.new((x1, y0, 0.004)), bm.verts.new((x1, y1, 0.004)), bm.verts.new((x0, y1, 0.004))])
    for i in range(-1, int(gx / gstep) + 2): quad(i * gstep - lw, -1, i * gstep + lw, gy)
    for j in range(-1, int(gy / gstep) + 2): quad(-1, j * gstep - lw, gx, j * gstep + lw)
    gm = bpy.data.meshes.new('grid'); bm.to_mesh(gm); bm.free(); go = bpy.data.objects.new('__grid', gm); sc.collection.objects.link(go)
    gmat =bpy.data.materials.new('gridm'); gmat.diffuse_color = (0.30, 0.31, 0.32, 1); gm.materials.append(gmat)
    bpy.ops.mesh.primitive_plane_add(size=1, location=((gx - 1) / 2, (gy - 1) / 2, -0.01)); fl = bpy.context.active_object; fl.scale = (gx + 2, gy + 2, 1)
    fm = bpy.data.materials.new('flr'); fm.diffuse_color = (0.50, 0.51, 0.52, 1); fl.data.materials.append(fm); created += [go, fl]
    # camera
    az, el = (0.0, math.radians(50)) if scaled else (math.radians(22), math.radians(38))
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam = bpy.data.objects.new('__cam', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
    centre = Vector((W / 2, D / 2, 0)); cam.location = centre + d * (W + D + 50)
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.data.clip_start = 0.1; cam.data.clip_end = 2000
    right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0)); up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
    cam.matrix_world = Matrix.Translation(cam.location) @ cam.rotation_euler.to_matrix().to_4x4()
    right = cam.rotation_euler.to_matrix() @ Vector((1, 0, 0)); up = cam.rotation_euler.to_matrix() @ Vector((0, 1, 0))
    bbs = [world_bbox(o) for o in obs]
    bx0 = min(b[0].x for b in bbs) - 1.0; bx1 = max(b[1].x for b in bbs) + 1.0; by0 = min(b[0].y for b in bbs) - tsize * 4; by1 = max(b[1].y for b in bbs) + 0.5
    pts = [Vector((x, y, z)) for x in (bx0, bx1) for y in (by0, by1) for z in (0, maxdim)]
    us = [(p - centre).dot(right) for p in pts]; vs = [(p - centre).dot(up) for p in pts]
    wpx = (max(us) - min(us)) + 2; hpx = (max(vs) - min(vs)) + 2
    RX = 2600; RY = int(RX * hpx / wpx); RY = min(max(RY, 700), 3600)
    sc.render.resolution_x = RX; sc.render.resolution_y = RY; M = max(RX, RY); cam.data.ortho_scale = max(wpx * M / RX, hpx * M / RY)
    cam.data.shift_x = ((max(us) + min(us)) / 2) / cam.data.ortho_scale; cam.data.shift_y = ((max(vs) + min(vs)) / 2) / cam.data.ortho_scale
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); w.color = (0.55, 0.57, 0.60); sc.world = w
    sc.render.filepath = png; bpy.ops.render.render(write_still=True)
    for c in created:
        bpy.data.objects.remove(c)
    for o in obs: o.location, o.scale = orig[o.name]
    return W, D

def do_sheets(which):
    os.makedirs(PREV, exist_ok=True)
    for grp in ('vehicles', 'machinery', 'buildings', 'misc'):
        if which not in ('all', grp): continue
        if grp == 'misc':
            names = GROUPS[grp]
            for i in range(0, len(names), 24):
                render_sheet(names[i:i + 24], os.path.join(PREV, 'misc_%d.png' % (i // 24 + 1)))
        else:
            render_sheet(GROUPS[grp], os.path.join(PREV, grp + '.png'))
    for kind, pre in (('Crop_', 'crops'), ('Prop_', 'props')):
        if which not in ('all', pre): continue
        names = sorted(o.name for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(kind))
        for i in range(0, len(names), 24):
            render_sheet(names[i:i + 24], os.path.join(PREV, '%s_%02d.png' % (pre, i // 24 + 1)), scaled=True)

# ------------------------------------------------------------------ export
import json

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
    flipped = 0; bm.verts.index_update()
    for comp in loose_parts(bm):
        fs = list({f for v in comp for f in v.link_faces})
        if not fs or any(not e.is_manifold for f in fs for e in f.edges): continue
        bmesh.ops.recalc_face_normals(bm, faces=fs); vol = 0.0
        for f in fs:
            vs = [l.vert.co for l in f.loops]
            for i in range(1, len(vs) - 1): vol += vs[0].dot(vs[i].cross(vs[i + 1]))
        if vol < 0: bmesh.ops.reverse_faces(bm, faces=fs); flipped += 1
    return flipped

def clean(ob, st, smooth=True):
    """weld, drop loose verts / degenerate + duplicate faces, orient closed parts, smooth by 30 degrees. st collects counts."""
    bm = bmesh.new(); bm.from_mesh(ob.data); n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002); st['merged'] = st.get('merged', 0) + n0 - len(bm.verts)
    deg = [f for f in bm.faces if f.calc_area() < 1e-9]
    if deg: bmesh.ops.delete(bm, geom=deg, context='FACES'); st['degenerate'] = st.get('degenerate', 0) + len(deg)
    seen = {}; dup = []
    for f in bm.faces:
        k = frozenset(v.index for v in f.verts)
        if k in seen: dup.append(f)
        else: seen[k] = f
    if dup: bmesh.ops.delete(bm, geom=dup, context='FACES'); st['doubled'] = st.get('doubled', 0) + len(dup)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    st['flipped'] = st.get('flipped', 0) + fix_part_normals(bm)
    st['nonmanifold'] = st.get('nonmanifold', 0) + sum(1 for e in bm.edges if len(e.link_faces) != 2)
    st['edges'] = st.get('edges', 0) + len(bm.edges)
    lim = math.radians(30)
    for f in bm.faces: f.smooth = smooth
    for e in bm.edges: e.smooth = (len(e.link_faces) == 2 and e.calc_face_angle(0) < lim) if smooth else False
    bm.to_mesh(ob.data); ob.data.update(); bm.free()

def mesh_arrays(ob):
    me = ob.data
    V = np.empty(len(me.vertices) * 3, dtype=np.float32); me.vertices.foreach_get('co', V); V = V.reshape(-1, 3).astype(np.float64)
    F = [tuple(p.vertices) for p in me.polygons]
    return V, F

def weld_components(V, F):
    key = {}; vid = np.empty(len(V), dtype=int)
    for i, v in enumerate(V): vid[i] = key.setdefault((round(v[0] / 1e-4), round(v[1] / 1e-4), round(v[2] / 1e-4)), len(key))
    par = list(range(len(key)))
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for f in F:
        r = find(vid[f[0]])
        for j in f[1:]:
            rj = find(vid[j])
            if rj != r: par[rj] = r
    return [find(vid[f[0]]) for f in F], vid, find

def detect_wheels(V, F, log, ring_fallback=False):
    """Wheel = a welded component that touches the ground and is round when seen along X (height ~ length, 0.2..1.0 m wide).
    Parts fully inside the wheel cylinder (rim, hub, axle stub) join it. ring_fallback: wheels welded to the body are found from the ground
    circle (the circle tangent to the ground that most vertices lie on, covering it all around)."""
    zmin = V[:, 2].min(); fcomp, vid, find = weld_components(V, F); out = []
    comps = {}
    for i, f in enumerate(F): comps.setdefault(fcomp[i], []).append(i)
    cinfo = {}
    for c, fi in comps.items():
        idx = sorted({j for i in fi for j in F[i]}); P = V[idx]; cinfo[c] = (P.min(0), P.max(0), len(idx))
    cands = []
    for c, (mn, mx, n) in cinfo.items():
        dx, dy, dz = mx - mn
        if mn[2] < zmin + 0.012 and n >= 100 and 0.12 <= dx <= 1.0 and dz >= 0.3 and abs(dy - dz) <= 0.15 * max(dy, dz): cands.append(c)
    def make(xc0, xc1, yc, R, base_faces):
        hub = np.array([(xc0 + xc1) / 2, yc, zmin + R]); sel = set(base_faces)
        for c, fi in comps.items():
            if c in cands: continue
            for i in fi:
                if i in sel: continue
                if all(xc0 - 0.04 <= V[j][0] <= xc1 + 0.04 and math.hypot(V[j][1] - yc, V[j][2] - hub[2]) <= R + 0.02 for j in F[i]) and (cinfo[c][1][1] - cinfo[c][0][1]) < 2 * R and (cinfo[c][1][2] - cinfo[c][0][2]) < 2 * R: sel.add(i)
        xs = [V[j][0] for i in sel for j in F[i]]
        return {'xc': (min(xs) + max(xs)) / 2, 'yc': yc, 'zc': hub[2], 'R': R, 'width': max(xs) - min(xs), 'faces': sorted(sel)}
    for c in cands:
        mn, mx, n = cinfo[c]; w = make(mn[0], mx[0], (mn[1] + mx[1]) / 2, (mx[2] - mn[2]) / 2, comps[c]); out.append(w)
        log.append('  wheel (component) x %.2f y %.2f R %.3f width %.2f faces %d' % (w['xc'], w['yc'], w['R'], w['width'], len(w['faces'])))
    if ring_fallback:
        low = V[V[:, 2] < zmin + 0.05]; cl = []
        for p in low:
            for c in cl:
                if abs(c[0] - p[0]) < 0.5 and abs(c[1] - p[1]) < 0.6: c[2].append(p); break
            else: cl.append([p[0], p[1], [p]])
        for c in cl:
            a = np.array(c[2]); x0, x1, y0, y1 = a[:, 0].min(), a[:, 0].max(), a[:, 1].min(), a[:, 1].max()
            if len(a) < 8 or a[:, 2].min() > zmin + 0.012 or not (0.2 <= x1 - x0 <= 0.75): continue
            if any(abs(w['xc'] - (x0 + x1) / 2) < 0.4 and abs(w['yc'] - (y0 + y1) / 2) < 0.5 for w in out): continue
            yc = (y0 + y1) / 2; S = V[(V[:, 0] > x0 - 0.05) & (V[:, 0] < x1 + 0.05)]; best = (0, 0)
            for R in np.arange(0.15, 1.5, 0.005):
                d = np.hypot(S[:, 1] - yc, S[:, 2] - zmin - R); m = np.abs(d - R) < 0.012; cnt = int(m.sum())
                if cnt < 12: continue
                ang = np.arctan2(S[m, 2] - zmin - R, S[m, 1] - yc); bins = len(set(((ang + math.pi) / (math.pi / 9)).astype(int)))
                if bins >= 10 and cnt >= best[0]: best = (cnt, R)
            if not best[0]: continue
            R = best[1]; cents_ok = [i for i, f in enumerate(F) if x0 - 0.08 <= V[list(f)][:, 0].mean() <= x1 + 0.08 and all(math.hypot(V[j][1] - yc, V[j][2] - zmin - R) <= R + 0.03 for j in f)]
            xs = [V[j][0] for i in cents_ok for j in F[i]]
            w = {'xc': (min(xs) + max(xs)) / 2, 'yc': yc, 'zc': zmin + R, 'R': R, 'width': max(xs) - min(xs), 'faces': cents_ok}; out.append(w)
            log.append('  wheel (ring fit, welded to body) x %.2f y %.2f R %.3f width %.2f faces %d' % (w['xc'], yc, R, w['width'], len(cents_ok)))
    return out
def name_wheels(ws):
    xmid = sum(w['xc'] for w in ws) / len(ws)
    ws = sorted(ws, key=lambda w: (round(w['yc'] / 0.3), -w['xc']))
    axles = []
    for w in sorted(ws, key=lambda w: w['yc']):
        for a in axles:
            if abs(a[0]['yc'] - w['yc']) < 0.3: a.append(w); break
        else: axles.append([w])
    if all(len(a) == 2 for a in axles):
        tags = {1: [''], 2: ['f', 'r'], 3: ['f', 'm', 'r'], 4: ['f', 'm', 'n', 'r']}.get(len(axles))
        if tags:
            for tag, a in zip(tags, axles):
                for w in a: w['name'] = 'wheel_%s%s' % (tag, 'l' if w['xc'] > xmid else 'r') if tag else 'wheel_%s' % ('l' if w['xc'] > xmid else 'r')
            return ws
    for i, w in enumerate(sorted(ws, key=lambda w: (w['yc'], w['xc']))): w['name'] = 'wheel_%02d' % (i + 1)
    return ws

def wheel_vc_material():
    m = bpy.data.materials.get('Wheel')
    if m is None:
        m = bpy.data.materials.new('Wheel'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
        b.inputs['Roughness'].default_value = 0.85; m.diffuse_color = (0.3, 0.3, 0.3, 1)
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'; nt.links.new(vc.outputs['Color'], b.inputs['Base Color'])
    return m

def build_model(src, out_name, opts, log):
    """opts: wheels(bool), K, root ('Tow'|'Vehicle'), anchors(callable V,F->dict), scale (real-size rescale about the base centre), split(callable (V,F,ob) -> set of face indices that get their own node 'unload_auger')."""
    ob = bpy.data.objects[src]; V, F = mesh_arrays(ob); fc = face_colours(ob)
    if opts.get('scale'):                                # SR90-IMPORT: real-size rescale about the base centre (bales); origin stays on the ground
        pv0 = np.array([(V[:, 0].min() + V[:, 0].max()) / 2, (V[:, 1].min() + V[:, 1].max()) / 2, V[:, 2].min()]); V = pv0 + (V - pv0) * opts['scale']
    aug = opts['split'](V, F, ob) if opts.get('split') else None      # SR90-IMPORT: faces of a part that gets its own node (the combine's unloading auger)
    wheels = detect_wheels(V, F, log, opts.get('ring', False)) if opts.get('wheels') else []
    wheels = name_wheels(wheels) if wheels else []
    wface = {}
    for wi, w in enumerate(wheels):
        for i in w['faces']: wface[i] = wi
    # colour budget
    area = {}
    for i, f in enumerate(F):
        a = ob.data.polygons[i].area; area[fc[i]] = area.get(fc[i], 0) + a
    roles = {r: {k: v for k, v in area.items() if k[0] == r} for r in ('solid', 'glass', 'light')}
    mp = {}
    nl = min(2, len(roles['light'])); ng = min(1, len(roles['glass'])); Ks = max(2, opts.get('K', 8) - nl - ng)
    for r, K in (('solid', Ks), ('glass', 1), ('light', 2)):
        if roles[r]: mp.update(cluster(roles[r], K))
    final = {}
    for k, v in area.items(): final[mp[k]] = final.get(mp[k], 0) + v
    names = {}
    mp_face_override = {}; wareas = {}
    for i in wface:
        k = mp[fc[i]]; wareas[k] = wareas.get(k, 0) + ob.data.polygons[i].area
    solids = [k for k in final if k[0] == 'solid']
    wmap = {}                                           # wheel faces get ONLY two colours: tyre = largest, rim = next largest; the rest snaps to the nearer
    if wareas:
        wsol = sorted([k for k in wareas if k[0] == 'solid'], key=lambda k: -wareas[k])
        if wsol:
            tire = wsol[0]; rim = wsol[1] if len(wsol) > 1 else wsol[0]
            if hsv(rim[1])[2] < hsv(tire[1])[2]: tire, rim = rim, tire
            names[tire] = 'Tire'
            if rim != tire: names[rim] = 'Rim'
            for k in wsol: wmap[k] = tire if sq(k[1], tire[1]) <= sq(k[1], rim[1]) else rim
            for i in wface:
                k = mp[fc[i]]
                if k in wmap: mp_face_override[i] = wmap[k]
    bodysol = sorted([k for k in solids if k not in names], key=lambda k: -final[k])
    paint = next((k for k in bodysol if hsv(k[1])[1] > 0.3 and hsv(k[1])[2] > 0.25), None)
    if paint: names[paint] = 'Paint'
    li = 0
    for k in final:
        if k in names: continue
        if k[0] == 'glass': names[k] = 'Glass'
        elif k[0] == 'light': names[k] = 'Light' if li == 0 else 'Light_' + hexof(k[1]); li += 1
        else: names[k] = 'Flat_' + hexof(k[1])
    mats = {}
    for k in final:
        old = bpy.data.materials.get(opts.get('mat_prefix', '') + names[k])
        if old is not None: bpy.data.materials.remove(old)
        mats[k] = flat_material(opts.get('mat_prefix', '') + names[k], k[1], 0.45 if k[0] == 'glass' else 1.0, 0.5 if k[0] == 'glass' else 0.75)
    log.append('  materials: ' + ', '.join('%s=#%s' % (names[k], hexof(k[1])) for k in final))
    # origin
    if wheels:
        ox = sum(w['xc'] for w in wheels) / len(wheels); oy = sum(w['yc'] for w in wheels) / len(wheels)
        if opts.get('origin_axle') == 'largest':
            big = [w for w in wheels if w['R'] > max(x['R'] for x in wheels) - 0.05]; ox = sum(w['xc'] for w in big) / len(big); oy = sum(w['yc'] for w in big) / len(big)
    else:
        ox = (V[:, 0].min() + V[:, 0].max()) / 2 if opts.get('centre_x', True) else 0.0; oy = (V[:, 1].min() + V[:, 1].max()) / 2
    zmin = V[:, 2].min(); off = np.array([ox, oy, zmin])
    log.append('  origin from source local (%.3f, %.3f, %.3f); colours before %d after %d' % (ox, oy, zmin, len(area), len(final)))
    reset_scene_for_build()
    root = bpy.data.objects.new('%s_%s_Source' % (opts.get('root', 'Tow'), out_name), None); root.empty_display_size = 0.2; bpy.context.scene.collection.objects.link(root)
    st = {}
    def mk(name, fidx, parent, local_off=None, lite_mesh=False):
        vm = {}; verts = []; faces = []; fm = []
        for i in fidx:
            f = []
            for j in F[i]:
                if j not in vm: vm[j] = len(verts); verts.append(tuple(V[j] - off - (local_off if local_off is not None else 0)))
                f.append(vm[j])
            faces.append(f); fm.append(mp_face_override.get(i, mp[fc[i]]))
        if lite_mesh:
            me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.materials.append(wheel_vc_material())
            at = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
            for p, k in zip(me.polygons, fm):
                lin = [((x / 255) / 12.92 if x / 255 <= 0.04045 else ((x / 255 + 0.055) / 1.055) ** 2.4) for x in k[1]]
                for li in p.loop_indices: at.data[li].color = (*lin, 1.0)
            o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.parent = parent; clean(o, st); return o
        used = []
        for k in fm:
            if k not in used: used.append(k)
        me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces)
        for k in used: me.materials.append(mats[k])
        for p, k in zip(me.polygons, fm): p.material_index = used.index(k)
        o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.parent = parent; clean(o, st); return o
    body_idx = [i for i in range(len(F)) if i not in wface and not (aug and i in aug)]
    groups = {}
    for i in body_idx: groups.setdefault(mp[fc[i]], []).append(i)
    order = sorted(groups, key=lambda k: -len(groups[k]))
    for k in order: mk('Body_' + names[k], groups[k], root)
    ae = None; pvl = None
    if aug:                                              # own node 'unload_auger': pivot at the base (front end) of the tube, swing axis = glTF Y
        AV = V[[j for i in aug for j in F[i]]]; e0 = AV[:, 1].min(); ends = AV[AV[:, 1] < e0 + 0.15]
        pv = np.array([ends[:, 0].mean(), e0, (ends[:, 2].min() + ends[:, 2].max()) / 2]); pvl = pv
        ae = empty('unload_auger', Vector(pv - off), root, 'ARROWS', 0.2)
        ga = {}
        for i in aug: ga.setdefault(mp[fc[i]], []).append(i)
        for k in sorted(ga, key=lambda k: -len(ga[k])): mk('Auger_' + names[k], ga[k], ae, local_off=pv - off)
    wobjs = {}
    for wi, w in enumerate(wheels):
        hub = np.array([w['xc'], w['yc'], w['zc']]) - off
        e = empty(w['name'], Vector(hub), root, 'ARROWS', 0.12); w['hub'] = hub
        mk(w['name'] + '_mesh', [i for i in wface if wface[i] == wi], e, local_off=hub, lite_mesh=opts.get('lite', False))
        wobjs[w['name']] = e
    anchors = opts['anchors'](V, F, ob, wheels, fc) if opts.get('anchors') else {}
    for n, (p, status) in anchors.items():
        if ae is not None and n == 'unload_auger_tip': empty(n, Vector(np.array(p) - pvl), ae, 'PLAIN_AXES', 0.1)      # the tip rides on the swinging auger
        else: empty(opts.get('node_prefix', '') + n, Vector(np.array(p) - off), root, 'PLAIN_AXES', 0.1)
    return root, st, wheels, off, anchors

def empty(name, loc, parent, kind='PLAIN_AXES', size=0.06):
    e = bpy.data.objects.new(name, None); e.empty_display_type = kind; e.empty_display_size = size
    e.location = loc; bpy.context.scene.collection.objects.link(e); e.parent = parent
    return e

def reset_scene_for_build():
    pass

def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out

def counts(root):
    tris = meshes = draws = 0; mats = set(); mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    bpy.context.view_layer.update()
    for o in tree(root):
        if o.type != 'MESH': continue
        used = {p.material_index for p in o.data.polygons}; meshes += 1; draws += len(used); mats |= {o.data.materials[i].name for i in used}
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for k in range(3): mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
    return {'tris': tris, 'meshes': meshes, 'materials': len(mats), 'draws': draws, 'size': (round(mx.x - mn.x, 2), round(mx.z - mn.z, 2), round(mx.y - mn.y, 2)), 'min_y': round(mn.z, 4), 'minmax': (tuple(round(x, 3) for x in mn), tuple(round(x, 3) for x in mx))}

def export_glb(root, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in tree(root): o.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_cameras=False, export_lights=False, export_texcoords=False, export_image_format='NONE')

def extreme_pt(V, axis, sign, within=0.04, mask=None):
    P = V if mask is None else V[mask]
    e = (P[:, axis] * sign).max(); sel = P[P[:, axis] * sign > e - within]
    return sel.mean(axis=0)

def A_hitch(V, F, ob, ws=None, fc=None):
    return {'anchor_hitch_front': (extreme_pt(V, 1, -1), 'exact')}

def A_hitch3(V, F, ob, ws=None, fc=None):             # three-point mounted: the -Y extreme is only an approximation of the lower-link pins
    return {'anchor_hitch_front': (extreme_pt(V, 1, -1), 'estimate')}

def A_tank(V, F, ob, ws=None, fc=None):
    a = A_hitch(V, F, ob)
    P = V[(np.abs(V[:, 0]) < 0.4) & (V[:, 2] > V[:, 2].max() - 0.25)]
    a['tank_fill'] = (P.mean(axis=0), 'estimate'); ymin, ymax = V[:, 1].min(), V[:, 1].max()
    a['anchor_cargo'] = (np.array([0.0, (ymin + ymax) / 2 + 0.3, 1.95]), 'estimate')
    a['anchor_drain'] = (np.array([0.0, ymax - 0.1, 0.8]), 'estimate'); return a

def A_tipper(V, F, ob, ws=None, fc=None):
    a = A_hitch(V, F, ob); a['anchor_cargo'] = (np.array([0.0, 1.05, 1.9]), 'estimate'); return a

def A_cart(V, F, ob, ws=None, fc=None):
    a = A_hitch(V, F, ob); a['anchor_cargo'] = (np.array([0.0, 0.33, 0.95]), 'estimate'); return a

def A_spreader(V, F, ob, ws=None, fc=None):
    a = A_hitch(V, F, ob); a['anchor_spread'] = (np.array([0.0, V[:, 1].max() - 0.45, 0.7]), 'estimate'); return a

def A_combine(V, F, ob, ws=None, fc=None):
    a = A_hitch(V, F, ob); del a['anchor_hitch_front']
    P = V[(V[:, 1] < V[:, 1].min() + 0.25) & (V[:, 2] < 1.6)]
    a['anchor_header_mount'] = (np.array([P[:, 0].mean(), P[:, 1].min(), (P[:, 2].min() + P[:, 2].max()) / 2]), 'exact (front face of the feeder house)')
    Q = V[V[:, 1] > V[:, 1].max() - 0.15]; Q = Q[Q[:, 2] > 2.5]
    a['unload_auger_tip'] = (Q.mean(axis=0), 'exact (end of the tube; spout opening not modelled)')
    g = [i for i, (r, c) in enumerate(fc) if r == 'glass']
    if g:
        G = V[[j for i in g for j in F[i]]]; a['seat'] = (np.array([G[:, 0].mean(), G[:, 1].mean() + 0.1, G[:, 2].min() + 0.45]), 'estimate (from the cab glass box)')
        a['anchor_driver_seat'] = a['seat']
    return a

def A_header(V, F, ob, ws=None, fc=None):
    P = V[V[:, 1] > V[:, 1].max() - 0.05]
    return {'anchor_mount': (np.array([P[:, 0].mean(), P[:, 1].max(), (P[:, 2].min() + P[:, 2].max()) / 2]), 'exact (rear plate centre)')}

def auger_split(V, F, ob):
    """Faces of the combine's unloading auger (tube + spout), cut BY POSITION: welded groups of faces on the +x side above z 2.4 whose own box lies at y >= 2.4,
    z >= 3.0 and x in [-28.9, -28.3] (world; the object sits at a translation only). Measured 2026-11-17: x -28.88..-28.38, y 2.5..11.1, z 3.1..4.13."""
    loc = np.array(ob.matrix_world.translation); W = V + loc
    cand = [i for i, f in enumerate(F) if W[list(f)].mean(axis=0)[0] > -28.8 and W[list(f)].mean(axis=0)[2] > 2.4]
    key = {}; par = []
    def vid(v):
        k = tuple(np.round(W[v] * 100).astype(int))
        if k not in key: key[k] = len(par); par.append(len(par))
        return key[k]
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    fv = {}
    for i in cand:
        ids = [vid(v) for v in F[i]]; fv[i] = ids
        for a in ids[1:]: par[find(a)] = find(ids[0])
    comp = {}
    for i in cand: comp.setdefault(find(fv[i][0]), []).append(i)
    out = set()
    for fs in comp.values():
        P = W[[j for i in fs for j in F[i]]]; lo = P.min(axis=0); hi = P.max(axis=0)
        if lo[1] >= 2.4 and lo[2] >= 3.0 and lo[0] >= -28.9 and hi[0] <= -28.3 and len(fs) >= 30: out.update(fs)
    return out

SPECS = {
 'Seeder': dict(out='seeder', anchors=A_hitch3), 'Cultivator': dict(out='cultivator', anchors=A_hitch3), 'Harrow': dict(out='harrow', anchors=A_hitch3),
 'Baler_Round': dict(out='baler_round', wheels=True, anchors=A_hitch), 'Mower_Bar': dict(out='mower_bar', anchors=A_hitch3),
 'Mower_Yellow': dict(out='mower_yellow', anchors=A_hitch3), 'Rake_Tedder': dict(out='rake_tedder', wheels=True, anchors=A_hitch),
 'Sprayer': dict(out='sprayer', wheels=True, anchors=A_hitch), 'Trailer_Grain': dict(out='trailer_grain', wheels=True, anchors=A_spreader),
 'Trailer_Red': dict(out='trailer_red', wheels=True, anchors=A_tipper), 'Trailer_Tank': dict(out='trailer_tank', wheels=True, anchors=A_tank),
 'Cart_Small': dict(out='cart_small', wheels=True, anchors=A_cart),
 'Combine_Harvester': dict(out='combine_harvester', root='Vehicle', wheels=True, ring=True, origin_axle='largest', anchors=A_combine, split=auger_split),
 'Combine_Header': dict(out='combine_header', anchors=A_header), 'WaterTower': dict(out='water_tower', root='Prop', anchors=None),
}

def build_combined(log):
    """Combine + header in ONE file: the header is a child node 'header' placed so its anchor_mount sits on the combine's anchor_header_mount."""
    sc, sh = SPECS['Combine_Harvester'], SPECS['Combine_Header']
    root, st, wheels, off, anc = build_model('Combine_Harvester', 'CombineWithHeader', sc, log)
    h, st2, _, offh, anch = build_model('Combine_Header', 'Hdr', dict(sh, mat_prefix='hdr_', node_prefix=''), log)
    for o in tree(h):
        if o is not h: o.name = 'header_' + o.name
    h.name = 'header'; h.parent = root
    mc = np.array(anc['anchor_header_mount'][0]) - off; mh = np.array(anch['anchor_mount'][0]) - offh
    d = mc - mh
    if d[2] < 0: log.append('  header would sit %.3f m below the ground: raised to z 0 (mount points then differ by that much)' % -d[2]); d[2] = 0.0
    h.location = Vector(d)
    log.append('  header node offset in combine frame (Blender xyz): %s; header ground clearance %.3f m' % (tuple(round(x, 3) for x in (mc - mh)), (mc - mh)[2]))
    return root, st, st2, anc, anch, d
def purge_build():
    for o in list(bpy.data.objects):
        if o.name.startswith(('Tow_', 'Vehicle_', 'Prop_Src_', 'Body_', 'wheel_', 'anchor_')) or o.type == 'EMPTY' and o.parent is not None and o.name.split('.')[0] not in ('Vehicles', 'Machinery'):
            if o.type in ('EMPTY',) or o.type == 'MESH' and o.name.startswith(('Body_', 'wheel_')): bpy.data.objects.remove(o)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)

COMB = {}
def do_export(names):
    os.makedirs(OUT, exist_ok=True); results = {}
    for src in names:
        sp = SPECS[src]; log = ['== %s -> %s.glb' % (src, sp['out'])]
        root, st, wheels, off, anchors = build_model(src, sp['out'].title().replace('_', ''), sp, log)
        if src == 'Combine_Harvester': COMB['anc'] = anchors
        path = os.path.join(OUT, sp['out'] + '.glb'); export_glb(root, path); c = counts(root)
        c.update({'clean': st, 'wheels': [(w['name'], round(w['R'], 3), round(w['width'], 2)) for w in wheels], 'anchors': {n: s for n, (p, s) in anchors.items()}})
        results[src] = c; log.append('  ' + json.dumps(c)); print('LOG', '\n'.join(log))
        for o in tree(root): bpy.data.objects.remove(o)
        purge_build()
        if c['draws'] > 20 and wheels:                       # lite variant: tyre + rim share ONE material (vertex colours), as scripts/farm-conform.py does
            log = ['== %s LITE -> %s_lite.glb' % (src, sp['out'])]
            root, st, wheels, off, anchors = build_model(src, sp['out'].title().replace('_', ''), dict(sp, lite=True), log)
            path = os.path.join(OUT, sp['out'] + '_lite.glb'); export_glb(root, path); c2 = counts(root)
            c2.update({'clean': st, 'wheels': c['wheels'], 'anchors': c['anchors']}); results[src + '_lite'] = c2; print('LOG', '\n'.join(log), '\n  ' + json.dumps(c2))
            for o in tree(root): bpy.data.objects.remove(o)
            purge_build()
    if 'Combine_Harvester' in names and 'Combine_Header' in names:
        log = ['== combined -> combine_harvester_with_header.glb']; root, st, st2, anc, anch, offv = build_combined(log)
        path = os.path.join(OUT, 'combine_harvester_with_header.glb'); export_glb(root, path); c = counts(root); c['clean'] = st; c['header_offset'] = [round(float(x), 3) for x in offv]
        results['Combine_with_header'] = c; print('LOG', '\n'.join(log), '\n  ' + json.dumps(c))
    json.dump(results, open(os.path.join(os.environ.get('SR90_TMP', OUT), 'export-results.json'), 'w'), indent=1)

# props worth having on a ranch (identified from the contact sheets): out file name -> source object
PROPS = {
 'bale_round_hay': 'Crop_035', 'bale_round_strapped': 'Crop_045', 'bale_square_large': 'Crop_036', 'bale_square_small': 'Crop_037',
 'bale_square_green_a': 'Crop_172', 'bale_square_straw': 'Crop_173', 'bale_square_green_b': 'Crop_174', 'bale_square_flat_green': 'Crop_175', 'bale_large_green': 'Crop_180',
 'crate_plastic_tall': 'Prop_058', 'crate_plastic_mid': 'Prop_059', 'crate_plastic_low': 'Prop_060', 'crate_wood_large_bin': 'Prop_061', 'crate_wood': 'Prop_062',
 'box_wood_small': 'Prop_063', 'pallet_wood': 'Prop_064',
 'barrel_drum_lid': 'Prop_056', 'barrel_drum_open': 'Prop_057', 'barrel_wood_cradle': 'Prop_156', 'barrel_wood_closed': 'Prop_157', 'barrel_wood_open': 'Prop_158',
 'trough_metal': 'Prop_160', 'trough_metal_hay': 'Prop_161', 'manger_wood': 'Prop_162', 'manger_wood_hay': 'Prop_163', 'trough_wood': 'Prop_164', 'trough_wood_hay': 'Prop_165', 'rack_v_unclear': 'Prop_159',
 'bag_feed_green': 'Prop_025', 'bag_feed_open': 'Prop_027', 'sack_closed': 'Prop_053', 'sack_open_large': 'Prop_054', 'sack_tied': 'Prop_055',
 'bucket_metal': 'Prop_100', 'bucket_wood': 'Prop_102', 'milk_can': 'Prop_104', 'wheelbarrow': 'Prop_070',
}
BALE_SCALE = {'bale_round_hay': 0.76, 'bale_round_strapped': 0.76, 'bale_square_large': 0.35, 'bale_square_small': 0.68,    # real size (SR90-IMPORT): round about 1.5 m across x 1.25 m wide, square about 0.9 m long
              'bale_square_green_a': 0.8, 'bale_square_straw': 0.8, 'bale_square_green_b': 0.8, 'bale_square_flat_green': 0.8, 'bale_large_green': 0.75}   # silage blocks and the wrapped bale: judgement (about 1.2 m)

def do_export_props(names):
    os.makedirs(OUT, exist_ok=True); results = {}
    for out, src in PROPS.items():
        if names and out not in names: continue
        log = ['== %s -> %s.glb' % (src, out)]
        root, st, wheels, off, anchors = build_model(src, out.title().replace('_', ''), dict(out=out, root='Prop', K=6, anchors=None, scale=BALE_SCALE.get(out)), log)
        export_glb(root, os.path.join(OUT, out + '.glb')); c = counts(root); c.update({'src': src, 'clean': st}); results[out] = c
        print('LOG', '\n'.join(log), '\n  ' + json.dumps(c))
        for o in tree(root): bpy.data.objects.remove(o)
        purge_build()
    json.dump(results, open(os.path.join(os.environ.get('SR90_TMP', OUT), 'export-props.json'), 'w'), indent=1)

if MODE == 'exportprops':
    do_export_props(ARGS[1:])

def render_glb(glb, prefix, tint=True, views=('front34', 'side', 'rear34')):
    """Verification renders of an exported glb: wheel nodes tinted red, anchors as blue balls."""
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
    sc = bpy.context.scene; pts = []
    wm = bpy.data.materials.new('wheelred'); wm.diffuse_color = (0.9, 0.1, 0.1, 1); am = bpy.data.materials.new('anch'); am.diffuse_color = (0.1, 0.3, 1, 1)
    for o in list(sc.objects):
        if o.type == 'MESH':
            if tint and o.parent is not None and o.parent.name.startswith(('wheel_', 'unload_auger')):
                o.data.materials.clear(); o.data.materials.append(wm)
            else:
                for i, m in enumerate(o.data.materials):
                    if m: m.diffuse_color = (*[v for v in m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3]], m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value)
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
        elif o.type == 'EMPTY' and (o.name.startswith(('anchor', 'seat', 'tank_', 'header', 'unload'))):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=o.matrix_world.translation, segments=8, ring_count=6); b = bpy.context.active_object; b.data.materials.append(am)
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    c = (mn + mx) / 2; size = (mx - mn).length
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True
    sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x = 1100; sc.render.resolution_y = 750
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    bpy.ops.mesh.primitive_plane_add(size=size * 3, location=(c.x, c.y, 0)); pl = bpy.context.active_object
    pm = bpy.data.materials.new('f'); pm.diffuse_color = (0.4, 0.42, 0.4, 1); pl.data.materials.append(pm)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
    V = {'front34': (1, -1.3, 0.7), 'side': (1, 0, 0.04), 'rear34': (-1, 1.3, 0.7), 'top': (0, 0.001, 1), 'front': (0, -1, 0.05)}
    for n in views:
        d = Vector(V[n]).normalized(); cam.location = c + d * size * 2; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = size * 1.05; cam.data.clip_start = 0.01; cam.data.clip_end = size * 8
        sc.render.filepath = prefix + '_' + n + '.png'; bpy.ops.render.render(write_still=True)

if MODE == 'renderglb':
    render_glb(ARGS[1], ARGS[2], views=tuple((ARGS[3:] or ['front34', 'side', 'rear34'])))
if MODE == 'export':
    do_export(ARGS[1:] or list(SPECS))
if MODE == 'sheets':
    do_sheets((ARGS + ['sheets', 'all'])[1])
