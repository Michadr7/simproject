# sr90 textured assets (barns, houses, shed, trees): bake each face's colour from its texture into a vertex-colour attribute and render a preview.
# Nothing is exported to the game from here; the result and the numbers are written up in notes/sr90-textured-assets.md.
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
    used = {}
    for p in me.polygons:
        img, base = slot[p.material_index] if p.material_index < len(slot) else (None, (0.8, 0.8, 0.8))
        if p.material_index in means: c = means[p.material_index]
        elif img is not None:
            u = sum(uvl[l].uv[0] for l in p.loop_indices) / p.loop_total; v = sum(uvl[l].uv[1] for l in p.loop_indices) / p.loop_total
            c = atl[min(H - 1, max(0, int(v * H))), min(W - 1, max(0, int(u * W))), :3]
        else: c = np.array(base)
        lin = srgb2lin(c); key = tuple(int(round(float(x) * 255)) for x in np.clip(np.asarray(c), 0, 1)); used[key] = used.get(key, 0) + 1
        for l in p.loop_indices: at.data[l].color = (*lin, 1.0)
    me.color_attributes.active_color = at
    return used

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
    render(ob, n)
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = False
