# sr90 textured assets (barns, houses, shed, trees): bake each face's colour from its texture into a vertex-colour attribute and render a preview.
# The preview run exports nothing; the result and the numbers are written up in notes/sr90-textured-assets.md.
# SR2 export: with the environment variable SR90_EXPORT=<dir> the run writes one flat-colour GLB per object instead of rendering (house_brick.glb, house_red.glb; faces fully below ground dropped,
# footprint centre on x/z = 0, ground at z = 0, door side on -Y so it faces +z in the game; one flat material per baked colour, which scripts/build-props.mjs turns into vertex colours):
#   $env:SR90_EXPORT='assets-src/Farm/sr90'; blender -b assets-src/Farm/list1_detailed_FARM.blend --python scripts/farm-sr90-bake.py -- <scratch dir> House_Brick House_Red
#   blender -b assets-src/Farm/list1_detailed_FARM.blend --python scripts/farm-sr90-bake.py -- <out dir> [object ...]
# Method: faces on the palette atlas (texture_0, a grid of flat colour cells) take the colour under their UV centroid (the same lossless conversion as scripts/farm-sr90.py);
# faces on a tiled surface texture (wall planks, stone, shingles, aluminium, foliage) take that texture's mean colour (alpha-weighted for foliage), so one material = one flat colour;
# a material with no image takes its base colour. The preview is a Workbench render with vertex colours (VERTEX) from three sides.
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUTD = ARGS[0]; NAMES = ARGS[1:] or ['Barn_Big', 'Barn_Stone', 'House_Brick', 'House_Red', 'Shed_Open', 'Tree_001', 'Tree_002', 'Tree_003', 'Tree_004', 'Tree_005', 'Tree_006']
os.makedirs(OUTD, exist_ok=True)

def srgb2lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

_img = {}
def pixels(img):
    if img.name not in _img:
        w, h = img.size; a = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(a); _img[img.name] = a.reshape(h, w, 4)
    return _img[img.name]

def mat_info(m):
    img = None; base = (0.8, 0.8, 0.8)
    if m and m.use_nodes:
        for nd in m.node_tree.nodes:
            if nd.type == 'TEX_IMAGE' and nd.image: img = nd.image; break
        b = next((nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
        if b is not None and not b.inputs['Base Color'].is_linked: base = tuple(b.inputs['Base Color'].default_value[:3])
    elif m: base = tuple(m.diffuse_color[:3])
    return img, base

def bake(ob):
    me = ob.data; uvl = me.uv_layers.active.data
    slot = [mat_info(s.material) for s in ob.material_slots]
    means = {}
    for i, (img, base) in enumerate(slot):
        if img is not None and img.name != 'texture_0':      # a tiled surface texture: its mean colour (alpha-weighted)
            px = pixels(img); a = px[..., 3:4]; wsum = max(float(a.sum()), 1e-6); means[i] = (px[..., :3] * a).sum(axis=(0, 1)) / wsum
    atl = pixels(bpy.data.images['texture_0']); H, W = atl.shape[:2]
    at = me.color_attributes.new('Bake', 'BYTE_COLOR', 'CORNER')
    used = {}; polykeys = []
    for p in me.polygons:
        img, base = slot[p.material_index] if p.material_index < len(slot) else (None, (0.8, 0.8, 0.8))
        if p.material_index in means: c = means[p.material_index]
        elif img is not None:
            u = sum(uvl[l].uv[0] for l in p.loop_indices) / p.loop_total; v = sum(uvl[l].uv[1] for l in p.loop_indices) / p.loop_total
            c = atl[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W))), :3]
        else: c = np.array(base)
        lin = srgb2lin(c); key = tuple(int(round(float(x) * 255)) for x in np.clip(np.asarray(c), 0, 1)); used[key] = used.get(key, 0) + 1; polykeys.append(key)
        for l in p.loop_indices: at.data[l].color = (*lin, 1.0)
    me.color_attributes.active_color = at
    ob['polykeys'] = polykeys
    return used

def export_flat(ob, outdir, outname):
    """Copy the baked object to a fresh mesh with one flat material per baked colour and write it as a GLB (see the header)."""
    import bmesh
    keys = [tuple(int(x) for x in k) for k in ob['polykeys']]; mw = ob.matrix_world.copy()
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(mw); bm.faces.ensure_lookup_table()
    palette = sorted(set(keys)); lay = bm.faces.layers.int.new('ck')
    for f in bm.faces: f[lay] = palette.index(keys[f.index])
    n0 = len(bm.faces)
    cut = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)   # ground = z 0: everything below it is buried, so it goes
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.faces.ensure_lookup_table(); kept = [palette[f[lay]] for f in bm.faces]; drop = range(n0 - len(bm.faces)) if n0 > len(bm.faces) else []
    xs =[v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
    bmesh.ops.translate(bm, verts=bm.verts, vec=(-cx, -cy, 0))
    for f in bm.faces: f.material_index = 0
    me = bpy.data.meshes.new(outname); bm.to_mesh(me); bm.free()
    while me.color_attributes: me.color_attributes.remove(me.color_attributes[0])
    order = sorted(set(kept), key=lambda k: -kept.count(k)); mats = []
    for i, k in enumerate(order):
        m = bpy.data.materials.new('%s_%02d_%02x%02x%02x' % (outname, i, *k)); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*srgb2lin(np.array(k) / 255.0), 1.0); b.inputs['Roughness'].default_value = 0.7
        me.materials.append(m); mats.append(k)
    for p, k in zip(me.polygons, kept): p.material_index = mats.index(k)
    new = bpy.data.objects.new(outname, me); bpy.context.scene.collection.objects.link(new)
    for o in bpy.context.scene.objects: o.select_set(False)
    new.select_set(True); bpy.context.view_layer.objects.active = new
    path = os.path.join(outdir, outname + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_cameras=False, export_lights=False, export_texcoords=False, export_image_format='NONE')
    d = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(0, min(zs)))
    print('EXPORT', outname, path, 'faces', len(me.polygons), 'faces removed by the ground cut (net)', len(drop), 'materials', len(mats), 'size x y z (m)', [round(x, 2) for x in d], 'lowest z kept', round(min(zs), 3))

def render(ob, prefix):
    sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type == 'MESH' and o is not ob: o.hide_render = True; o.hide_viewport = True
    ob.hide_render = False; ob.hide_viewport = False
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for c in ob.bound_box:
        w = ob.matrix_world @ Vector(c)
        for k in range(3): mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
    ctr = (mn + mx) / 2; size = (mx - mn).length
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_shadows = True
    sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x = 900; sc.render.resolution_y = 650
    w = bpy.data.worlds.new('w'); w.color = (0.6, 0.65, 0.7); sc.world = w
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
    for n, d in (('front34', (1, -1.3, 0.7)), ('back34', (-1, 1.3, 0.7)), ('side', (1, 0, 0.1))):
        d = Vector(d).normalized(); cam.location = ctr + d * size * 2; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        cam.data.ortho_scale = size * 0.9; cam.data.clip_start = 0.01; cam.data.clip_end = size * 8
        sc.render.filepath = os.path.join(OUTD, '%s_%s.png' % (prefix, n)); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)

for n in NAMES:
    ob = bpy.data.objects[n]; used = bake(ob)
    top = sorted(used.items(), key=lambda kv: -kv[1])[:6]
    print('BAKE', n, 'faces', len(ob.data.polygons), 'distinct face colours', len(used), 'top', top)
    if os.environ.get('SR90_EXPORT'): export_flat(ob, os.environ['SR90_EXPORT'], {'House_Brick': 'house_brick', 'House_Red': 'house_red'}.get(n, n.lower()))
    else: render(ob, n)
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = False
