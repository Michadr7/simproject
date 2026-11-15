# Makes the two small vehicle damage textures with headless Blender (VD3). Run by scripts/build-damage-textures.mjs:
#   blender --background --python scripts/make-damage-textures.py -- <outDir>
# wear.png  128x128 RGB, TILEABLE: R = scratches (thin bright streaks), G = grime (soft blotches, 32 levels), B = paint chips (sparse specks).
# crack.png 256x256 grey (drawn at 512, averaged down): a spider-web impact (radial cracks, branches, broken rings) on black; not tiled. Seeded: the same files every run. Own work (no credit line).
import sys, os
import numpy as np
import bpy

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(7)

def save(name, rgb):
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    px = np.ones((h, w, 4), dtype=np.float32)
    px[:, :, :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(px[::1].ravel())
    img.file_format = 'PNG'
    img.filepath_raw = os.path.join(out, name + '.png')
    img.save()

def splat(a, x, y, v, wrap):
    h, w = a.shape
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    for dx, dy, k in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi, yi = x0 + dx, y0 + dy
        if wrap:
            xi %= w; yi %= h
            ok = np.ones_like(xi, bool)
        else:
            ok = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
        np.maximum.at(a, (yi[ok], xi[ok]), (k * v)[ok])

def line(a, p, q, v, wrap):
    n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1])) * 2) + 2
    t = np.linspace(0, 1, n)
    x = p[0] + (q[0] - p[0]) * t
    y = p[1] + (q[1] - p[1]) * t
    vv = v * np.ones(n) if np.isscalar(v) else v
    splat(a, x, y, vv, wrap)

def blobs(n, cutoff, sx=1.0, sy=1.0):  # periodic noise (so it tiles): white noise filtered in the Fourier domain. VD7a: sx, sy stretch the cutoff per axis: sy < 1 smooths along y (the picture's up), giving vertical streaks like road spray and runoff
    f = np.fft.fft2(rng.standard_normal((n, n)))
    fy = np.fft.fftfreq(n)[:, None]; fx = np.fft.fftfreq(n)[None, :]
    r = np.sqrt((fx / sx) ** 2 + (fy / sy) ** 2) + 1e-6
    g = np.real(np.fft.ifft2(f * np.exp(-(r / cutoff) ** 2) / r ** .6))
    g = (g - g.min()) / (g.max() - g.min())
    return g

# ---- wear: 128, tileable
N = 128
scr = np.zeros((N, N), np.float32)
for _ in range(80):  # long thin streaks, mostly one way (a door being dragged along a wall) with a few across
    cx, cy = rng.uniform(0, N, 2)
    ang = rng.normal(0.15, 0.25) if rng.random() < .8 else rng.uniform(0, np.pi)
    ln = rng.uniform(8, 48)
    d = np.array([np.cos(ang), np.sin(ang)])
    p = np.array([cx, cy]) - d * ln / 2
    q = np.array([cx, cy]) + d * ln / 2
    v = rng.uniform(.5, 1.0)
    line(scr, p, q, v, True)
    if rng.random() < .6:  # a second pass beside it makes the streak two pixels wide
        line(scr, p + np.array([0, 1.0]), q + np.array([0, 1.0]), v * .8, True)
# VD7a: grime is FINER and DIRECTIONAL (long vertical streaks plus a fine speckle), and LOW contrast (it ranges about .15 to .75, not 0 to 1), so it reads as road film, not camouflage blotches
g = blobs(N, .16, 1.0, .22) * .65 + blobs(N, .42, 1.0, .5) * .35
g = (g - g.min()) / (g.max() - g.min())
g = np.clip(.15 + (g - .25) * .9, 0, .75)
g = np.round(g * 15) / 15  # 16 levels: PNG packs it much smaller
chips = np.zeros((N, N), np.float32)
for _ in range(6):  # VD7a: 6 small chips (was 16 larger ones that looked like pepper)
    x, y = rng.uniform(0, N, 2)
    r = rng.uniform(.5, 1.3)
    for _k in range(int(r * 5)):
        splat(chips, np.array([x + rng.normal(0, r)]), np.array([y + rng.normal(0, r * .7)]), .6 + rng.random() * .4, True)
rgb = np.stack([scr, g, chips], axis=-1)
save('wear', rgb)

# ---- crack: 512, one impact
M = 512
c = np.zeros((M, M), np.float32)
ctr = np.array([M * .5, M * .45])
rays = []
n = 11
for i in range(n):
    ang = (i + rng.uniform(-.3, .3)) / n * 2 * np.pi
    pts = [ctr.copy()]
    pos = ctr.copy()
    length = rng.uniform(.28, .5) * M
    steps = 14
    a = ang
    for s in range(steps):
        a += rng.normal(0, .12)
        pos = pos + np.array([np.cos(a), np.sin(a)]) * length / steps
        pts.append(pos.copy())
        if s > 2 and rng.random() < .25:  # a branch
            ba = a + rng.choice([-1, 1]) * rng.uniform(.4, .9)
            bp = pos.copy()
            for _b in range(int(rng.integers(3, 8))):
                ba += rng.normal(0, .15)
                nb = bp + np.array([np.cos(ba), np.sin(ba)]) * rng.uniform(6, 16)
                line(c, bp, nb, max(.25, .7 - _b * .08), False)
                bp = nb
    rays.append(pts)
    for j in range(len(pts) - 1):
        line(c, pts[j], pts[j + 1], 1.0 - j * .045, False)
for k in range(1, 4):  # broken rings joining neighbouring rays
    idx = 2 + k * 3
    for i in range(n):
        if rng.random() < .75:
            a, b = rays[i][min(idx, 14)], rays[(i + 1) % n][min(idx, 14)]
            mid = (a + b) / 2 + rng.normal(0, 3, 2)
            line(c, a, mid, .7 - k * .1, False)
            line(c, mid, b, .7 - k * .1, False)
# a small white star at the impact and a soft haze around it
yy, xx = np.mgrid[0:M, 0:M]
d = np.hypot(xx - ctr[0], yy - ctr[1])
c = np.maximum(c, np.exp(-(d / 5.0) ** 2))
c = np.maximum(c, .22 * np.exp(-(d / 30.0) ** 2))
# one pass of blur to take the stair-steps off
k = np.pad(c, 1, mode='edge')
c = (k[1:-1, 1:-1] * 4 + k[:-2, 1:-1] + k[2:, 1:-1] + k[1:-1, :-2] + k[1:-1, 2:]) / 8
c = c.reshape(256, 2, 256, 2).mean(axis=(1, 3))
c = np.round(np.clip(c * 1.5, 0, 1) * 15) / 15  # 16 levels
save('crack', np.stack([c, c, c], axis=-1))
print('textures written to', out)
