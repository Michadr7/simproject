// TSL vehicle paint and glass (notes/webgpu-spike.md T4): NodeMaterial twin of paint-shader.js.
import { WEAR_TILE, CRACK_PLACE } from './paint-shader.js';
import { WEAR_PNG, CRACK_PNG } from './damage-textures.js';
import { paintUniforms, colourOf, coloursOf } from './paint.js';

const texCache = new WeakMap();
const blankTex = (THREE) => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; };
function sharedTex(THREE, key, uri, repeat, doc) {
 if (!THREE) return null;
 let entry = texCache.get(THREE);
 if (!entry) { entry = {}; texCache.set(THREE, entry); }
 if (entry[key]) return entry[key];
 const d = doc !== undefined ? doc : (typeof document !== 'undefined' ? document : null);
 if (!d) return (entry[key] = blankTex(THREE));
 const t = new THREE.TextureLoader().load(uri);
 t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
 t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
 return (entry[key] = t);
}

const cloneProps = (base, defaults) => ({
 color: base?.color ?? defaults.color ?? 0xffffff,
 map: base?.map ?? defaults.map ?? null,
 roughness: base?.roughness ?? defaults.roughness ?? 0.5,
 metalness: base?.metalness ?? defaults.metalness ?? 0,
 transparent: base?.transparent ?? defaults.transparent ?? false,
 opacity: base?.opacity ?? defaults.opacity ?? 1,
 side: base?.side ?? defaults.side ?? 0,
 depthWrite: base?.depthWrite ?? defaults.depthWrite ?? true,
 envMapIntensity: base?.envMapIntensity ?? defaults.envMapIntensity ?? 1
});

const vPlaneNode = (TSL) => TSL.Fn(([p, n]) => {
 const a = TSL.abs(n);
 return TSL.select(a.x.greaterThanEqual(a.y).and(a.x.greaterThanEqual(a.z)), TSL.vec2(p.z, p.y), TSL.select(a.y.greaterThanEqual(a.z), TSL.vec2(p.x, p.z), TSL.vec2(p.x, p.y)));
});

export function makePaintMaterialTSL(opts = {}) {
 const { THREE, TSL, MeshStandardNodeMaterial, NodeMaterial, base = null } = opts;
 const Mat = MeshStandardNodeMaterial || NodeMaterial || THREE?.MeshStandardNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const { Fn, uniform, varying, vec2, vec3, vec4, float, abs, clamp, dot, fract, max, min, mix, normalize, select, smoothstep, step, positionLocal, normalLocal, materialColor, texture, If } = TSL;
 const u = {
  uPaint: uniform(new THREE.Vector4(-1, 1, 1, 0)),
  uBand: uniform(0),
  uWear: uniform(new THREE.Vector2(0, 0)),
  uHit: uniform(new THREE.Vector4(0, 0, 0, 0)),
  uExt: uniform(new THREE.Vector2(1, 2.2)),
  uWearTex: opts.wearTex || sharedTex(THREE, 'wear', WEAR_PNG, true, opts.doc)
 };
 const vPlane = vPlaneNode(TSL);
 const pRgb2hsv = Fn(([c]) => {
  const K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  const p = mix(vec4(c.b, c.g, K.w, K.z), vec4(c.g, c.b, K.x, K.y), step(c.b, c.g));
  const q = mix(vec4(p.x, p.y, p.w, c.r), vec4(c.r, p.y, p.z, p.x), step(p.x, c.r));
  const d = q.x.sub(min(q.w, q.y)), e = float(1e-10);
  return vec3(abs(q.z.add(q.w.sub(q.y).div(d.mul(6.0).add(e)))), d.div(q.x.add(e)), q.x);
 });
 const pHsv2rgb = Fn(([c]) => {
  const p = abs(fract(vec3(c.x).add(vec3(1.0, 2.0 / 3.0, 1.0 / 3.0))).mul(6.0).sub(3.0));
  return c.z.mul(mix(vec3(1.0), clamp(p.sub(1.0), 0.0, 1.0), c.y));
 });

 const mat = new Mat(cloneProps(base, { roughness: 0.45, metalness: 0.1 }));
 mat.name = base?.name ? base.name + '-tsl' : 'vehicle-paint-tsl';
 mat.userData.paint = u;
 const vWPos = positionLocal, vWNrm = varying(normalLocal, 'vWNrm');

 mat.colorNode = Fn(() => {
  const col = materialColor.rgb.toVar();
  If(u.uBand.greaterThan(0.0), () => {
   const h = pRgb2hsv(col), dh = abs(fract(h.x.sub(u.uPaint.w).add(0.5)).sub(0.5));
   const m = float(1.0).sub(smoothstep(u.uBand.mul(0.6), u.uBand, dh)).mul(smoothstep(0.12, 0.25, h.y));
   If(m.greaterThan(0.0), () => {
    const nh = select(u.uPaint.x.greaterThanEqual(0.0), fract(u.uPaint.x.add(h.x.sub(u.uPaint.w).mul(0.4))), h.x);
    col.assign(mix(col, pHsv2rgb(vec3(nh, clamp(h.y.mul(u.uPaint.y), 0.0, 1.0), h.z.mul(u.uPaint.z))), m));
   });
  });
  If(u.uWear.y.greaterThan(0.0), () => {
   const w = u.uWear.y, n = normalize(vWNrm), pp = vPlane(vWPos, vWNrm).div(WEAR_TILE);
   const t = texture(u.uWearTex, pp).rgb, t2 = texture(u.uWearTex, vec2(pp.y, pp.x).mul(1.35).add(vec2(0.31, 0.17))).rgb;
   const lum = dot(col, vec3(0.3, 0.59, 0.11));
   col.assign(mix(col, vec3(lum), w.mul(0.1)).mul(float(1.0).sub(w.mul(0.06))));
   const zf = max(smoothstep(0.4, 0.85, n.z), smoothstep(0.45, 0.8, vWPos.z.div(u.uExt.y)).mul(0.6));
   const zr = max(smoothstep(0.4, 0.85, n.z.negate()), smoothstep(0.45, 0.8, vWPos.z.negate().div(u.uExt.y)).mul(0.6));
   const zl = smoothstep(0.4, 0.85, n.x), zt = smoothstep(0.4, 0.85, n.x.negate());
   const loc = max(max(u.uHit.x.mul(zf), u.uHit.y.mul(zr)), max(u.uHit.z.mul(zl), u.uHit.w.mul(zt)));
   const s = clamp(loc.mul(float(0.5).add(w.mul(0.5))).mul(float(0.4).add(float(0.6).mul(float(1.0).sub(smoothstep(0.5, 1.8, vWPos.y))))), 0.0, 1.0);
   const cr = smoothstep(0.05, 0.3, float(1.0).sub(max(max(abs(n.x), abs(n.y)), abs(n.z))));
   const thr = float(0.74).sub(s.mul(0.46)), pat = smoothstep(thr, thr.add(0.04), t2.g), rim = pat.mul(float(1.0).sub(smoothstep(thr.add(0.04), thr.add(0.12), t2.g)));
   const scorch = smoothstep(0.3, 0.6, t.g).mul(smoothstep(0.15, 0.6, s));
   col.mulAssign(float(1.0).sub(scorch.mul(0.55).mul(float(1.0).sub(pat))));
   col.assign(mix(col, vec3(0.24, 0.25, 0.29).mul(float(0.8).add(t.r.mul(0.5))), pat.mul(0.95)));
   col.assign(mix(col, vec3(0.12, 0.12, 0.14), rim.mul(0.6)));
   const fk = smoothstep(float(0.95).sub(s.mul(0.6)).sub(cr.mul(s).mul(0.3)), float(1.0).sub(s.mul(0.6)).sub(cr.mul(s).mul(0.3)), t.b).mul(smoothstep(0.1, 0.45, s));
   col.assign(mix(col, vec3(0.26, 0.27, 0.3), fk.mul(0.9)));
   const sa = smoothstep(0.03, 0.3, s), halo = smoothstep(0.08, 0.3, max(t.r, t2.r.mul(0.8))).mul(float(1.0).sub(smoothstep(0.3, 0.6, t.r))).mul(sa);
   const sc = smoothstep(0.5, 0.8, max(t.r, t2.r.mul(smoothstep(0.4, 0.9, s)))).mul(sa);
   col.assign(mix(col, col.mul(0.45), halo.mul(0.7)));
   col.assign(mix(col, vec3(0.9, 0.91, 0.94), sc));
  });
  return vec4(col, 1.0);
 })();
 return { material: mat, uniforms: u };
}

export function makeGlassMaterialTSL(opts = {}) {
 const { THREE, TSL, MeshStandardNodeMaterial, NodeMaterial, base = null, model = 'default' } = opts;
 const Mat = MeshStandardNodeMaterial || NodeMaterial || THREE?.MeshStandardNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const { Fn, uniform, varying, vec3, vec4, float, max, min, mix, smoothstep, step, positionLocal, normalLocal, materialColor, materialOpacity, texture, If } = TSL;
 const place = CRACK_PLACE[model] || CRACK_PLACE.default;
 const u = { uCrack: uniform(0), uCrackMap: uniform(new THREE.Vector3(...place)), uCrackTex: opts.crackTex || sharedTex(THREE, 'crack', CRACK_PNG, false, opts.doc) };
 const mat = new Mat(cloneProps(base, { transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 }));
 mat.name = base?.name ? base.name + '-tsl' : 'vehicle-glass-tsl';
 mat.userData.crack = u;
 const vPlane = vPlaneNode(TSL), vWPos = positionLocal, vWNrm = varying(normalLocal, 'vWNrm');
 const crackK = () => {
  const cp = vPlane(vWPos, vWNrm).sub(u.uCrackMap.xy).div(u.uCrackMap.z).add(0.5);
  const k0 = texture(u.uCrackTex, cp).r.mul(step(0.0, cp.x)).mul(step(cp.x, 1.0)).mul(step(0.0, cp.y)).mul(step(cp.y, 1.0)).mul(step(0.3, vWNrm.z));
  return smoothstep(0.12, 0.55, k0.mul(float(0.5).add(u.uCrack.mul(0.9))));
 };
 mat.colorNode = Fn(() => {
  const rgb = materialColor.rgb.toVar();
  If(u.uCrack.greaterThan(0.0), () => { rgb.assign(mix(rgb, vec3(0.95, 0.97, 1.0), crackK())); });
  return vec4(rgb, 1.0);
 })();
 mat.opacityNode = Fn(() => {
  const a = (mat.map ? materialColor.a.mul(materialOpacity) : materialOpacity).toVar();
  If(u.uCrack.greaterThan(0.0), () => { a.assign(min(1.0, max(a, crackK().mul(0.92)).add(u.uCrack.mul(0.08)))); });
  return a;
 })();
 return { material: mat, uniforms: u };
}

export function setPaintUniformsTSL(u, model, colourId) {
 const n = paintUniforms(model, colourId);
 u.uPaint.value.set(n.hue, n.sat, n.val, n.src); u.uBand.value = n.band;
}
export function setLookUniformsTSL({ paintUniforms: paints = [], glassUniforms: glass = [] }, look, model = 'default', ext = null) {
 for (const u of paints) {
  if (u.uWear.value.y !== look.wear) u.uWear.value.y = look.wear;
  const h = look.hit || [0, 0, 0, 0];
  if (u.uHit.value.x !== h[0] || u.uHit.value.y !== h[1] || u.uHit.value.z !== h[2] || u.uHit.value.w !== h[3]) u.uHit.value.set(h[0], h[1], h[2], h[3]);
  if (ext && (u.uExt.value.x !== ext[0] || u.uExt.value.y !== ext[1])) u.uExt.value.set(ext[0], ext[1]);
 }
 const p = CRACK_PLACE[model] || CRACK_PLACE.default;
 for (const u of glass) {
  if (u.uCrack.value !== look.crack) u.uCrack.value = look.crack;
  if (u.uCrackMap.value.z !== p[2] || u.uCrackMap.value.x !== p[0] || u.uCrackMap.value.y !== p[1]) u.uCrackMap.value.set(p[0], p[1], p[2]);
 }
 return { colourOf, coloursOf };
}
