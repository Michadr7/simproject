// WebGPU T6 direct output (notes/eval/outbox/webgpu-T6.md; fixes T5 gaps 1 night glow, 2 fog order, 3 background, 5 glass): on the node path every material grades + sRGB-encodes itself, as WebGL does.
// Why: WebGPURenderer normally draws into a linear HalfFloat buffer and runs the grade once at the end, so additive glow and see-through glass blend in linear light and fog mixes before
// the grade. WebGL tone-maps and encodes each fragment, blends in screen colours, and mixes fog AFTER the encode with the fog colour in screen colours. This module makes the node path do
// the same, through three's own hook (renderer.contextNode getOutput, the one DirectRenderPipeline uses): no output pass, no extra buffer, so it is also cheaper. Nothing here runs without
// ?webgpu=1. Pieces: three is told the canvas needs no output step (so it skips its framebuffer); the game's tone mapping and colour space go into a context; getOutput applies them per material
// (toneMapped false = encode only); a display-space fog node per scene; a solid scene.background is handed over already encoded (WebGL's clear colour is not tone-mapped either).
import { grade } from './daynight.js';

export const DIRECT_OUTPUT = Object.freeze({ fog: 'display', background: 'encoded', blend: 'display' });

// CPU mirrors, for tests/tsl-output.mjs (the WebGL formulas the node path now follows; channel values 0..1).
export const srgbEncode = c => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
export const srgbDecode = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// One lit fragment, WebGL order: grade (tone mapping) -> sRGB -> fog mixed with the sRGB fog colour.
export function webglFragment(rgb, { exposure = 1, fog = null, depth = 0, toneMapped = true } = {}) {
 const g = toneMapped ? grade(rgb, exposure) : rgb.map(v => Math.min(1, Math.max(0, v)));
 const enc = g.map(srgbEncode);
 if (!fog) return enc;
 const f = smooth(fog.near, fog.far, depth);
 return enc.map((v, i) => v + (srgbEncode(fog.color[i]) - v) * f);
}
// The T5 node path (one output pass): fog mixed in linear light, then the grade + sRGB.
export function linearPassFragment(rgb, { exposure = 1, fog = null, depth = 0 } = {}) {
 const f = fog ? smooth(fog.near, fog.far, depth) : 0;
 const lin = fog ? rgb.map((v, i) => v + (fog.color[i] - v) * f) : rgb;
 return grade(lin, exposure).map(srgbEncode);
}
// Additive glow over a background: WebGL adds the encoded glow to the encoded background; the T5 pass added in linear light and graded the sum.
export const webglAdditive = (bgLinear, glowLinear, exposure = 1) => webglFragment(bgLinear, { exposure }).map((v, i) => Math.min(1, v + webglFragment(glowLinear, { exposure })[i]));
export const linearPassAdditive = (bgLinear, glowLinear, exposure = 1) => grade(bgLinear.map((v, i) => v + glowLinear[i]), exposure).map(srgbEncode);

// THREE: the WebGPU build's namespace (constants + Color). TSL: three.tsl.js. renderer: a WebGPURenderer, BEFORE init() (so the WebGL2 backend asks for an antialiased context).
// Returns {syncScene, getOutput, fogFor, contextFor, last, warmHidden} (tests), or the earlier result when called twice.
export function installDirectOutputTSL({ THREE, TSL, renderer }) {
 if (!renderer) return null;
 if (renderer.__directOutput) return renderer.__directOutput;
 const { Fn, vec4, mix, uniform, renderOutput, output, rangeFogFactor, context } = TSL;
 const NO = THREE.NoToneMapping, LINEAR = THREE.ColorManagement?.workingColorSpace || THREE.LinearSRGBColorSpace;
 // three asks these two (needsFrameBufferTarget, currentSamples) whether it needs its framebuffer + output pass: on the canvas the answer is now "no". renderer.toneMapping and
 // outputColorSpace stay the game's own values (code that saves and restores them, like the map bake, keeps working); each material reads them through its context below.
 Object.defineProperty(renderer, 'currentToneMapping', { configurable: true, get: () => NO });
 Object.defineProperty(renderer, 'currentColorSpace', { configurable: true, get: () => LINEAR });
 const toneFor = (m, ctx) => (m && m.toneMapped === false) ? NO : ctx.directToneMapping;
 const encode = (node, builder, premultiplied) => { const o = renderOutput(node, toneFor(builder.material, builder.context), builder.context.directColorSpace); o.premultipliedAlpha = premultiplied; return o; };
 // Every material's last step (three.tsl.js NodeMaterial.setup: after fog and premultiply, before MRT). Render targets (shadow maps, the map bake) stay linear.
 const getOutput = (node, builder) => {
  const m = builder.material;
  if (builder.renderer && builder.renderer.isOutputTarget === false) return node;
  if (m && m.fog === true && builder.fogNode && builder.fogNode.isDisplayFog === true) return node; // the display fog already graded and encoded it
  return encode(node, builder, !!(m && m.premultipliedAlpha === true));
 };
 // One context per (tone mapping, colour space) the game renders with: the context is part of three's pipeline cache key, so a temporary switch never reuses the wrong shader.
 const base = renderer.contextNode, contexts = new Map();
 const contextFor = (tm, cs) => {
  const key = tm + '|' + cs;
  let c = contexts.get(key);
  if (!c) { const data = { getOutput, directToneMapping: tm, directColorSpace: cs }; c = base && typeof base.context === 'function' ? base.context(data) : context(data); contexts.set(key, c); }
  return c;
 };
 renderer.contextNode = contextFor(renderer.toneMapping ?? NO, renderer.outputColorSpace ?? THREE.SRGBColorSpace);
 // Fog: one node per scene with its own uniforms, mixed in screen colours with the encoded fog colour (WebGL's fog_fragment after colorspace_fragment).
 const fogs = new WeakMap();
 const fogFor = scene => {
  let f = fogs.get(scene);
  if (f) return f;
  const uColor = uniform(new THREE.Color()), uLinear = uniform(new THREE.Color()), uNear = uniform(1), uFar = uniform(2);
  const node = Fn((_, builder) => {
   const factor = rangeFogFactor(uNear, uFar);
   if (builder.renderer && builder.renderer.isOutputTarget === false) return vec4(mix(output.rgb, uLinear, factor), output.a);
   const o = encode(output, builder, false); // setupFog hands over the colour before premultiply
   return vec4(mix(o.rgb, uColor, factor), o.a);
  })();
  node.isDisplayFog = true;
  f = { node, uColor, uLinear, uNear, uFar };
  fogs.set(scene, f);
  return f;
 };
 const syncScene = scene => {
  if (!scene || scene.isScene !== true) return;
  const fog = scene.fog;
  if (fog && fog.isFog) {
   const f = fogFor(scene);
   fog.color.getRGB(f.uColor.value, renderer.outputColorSpace); f.uLinear.value.copy(fog.color); f.uNear.value = fog.near; f.uFar.value = fog.far;
   if (scene.fogNode !== f.node) scene.fogNode = f.node;
  } else if (scene.fogNode && scene.fogNode.isDisplayFog) scene.fogNode = null; // FogExp2 or no fog: three's own
 };
 const bg = new THREE.Color();
 // last: the draw calls and triangles of the last render() (three's own loop zeroes renderer.info between frames, so the dev cost line reads this; T5 gap 8)
 const last = { calls: 0, triangles: 0 };
 const wrap = name => {
  const fn = renderer[name];
  if (typeof fn !== 'function') return;
  const call = fn.bind(renderer), counts = name === 'render';
  renderer[name] = (scene, ...rest) => {
   renderer.contextNode = contextFor(renderer.toneMapping, renderer.outputColorSpace); syncScene(scene); syncScene(rest[1]); // compileAsync(object, camera, targetScene)
   const was = scene && scene.isScene ? scene.background : null, solid = !!(was && was.isColor);
   if (solid) { was.getRGB(bg, renderer.outputColorSpace); scene.background = bg; }
   try { return call(scene, ...rest); } finally {
    if (solid) scene.background = was;
    const info = counts && renderer.info && renderer.info.render;
    if (info) { last.calls = info.drawCalls ?? info.calls ?? 0; last.triangles = info.triangles ?? 0; }
   }
  };
 };
 wrap('render'); wrap('compileAsync');
 // T5 gap 9: compileAsync skips hidden objects, so the TSL effects that are hidden until they are needed (night glow, smoke, debris, tracks: names ending '-tsl') are compiled one by
 // one with the scene's lights, shown only while three collects them (synchronously). Wait for every pipeline attempt to settle.
 const warmHidden = (scene, camera) => {
  if (typeof renderer.compileAsync !== 'function' || !scene) return Promise.resolve([]);
  const jobs = [];
  const hidden = [];
  scene.traverse(o => { if (o.visible === false && (o.isMesh || o.isSprite || o.isPoints) && [].concat(o.material || []).some(m => m && m.isNodeMaterial && /-tsl$/.test(m.name || ''))) hidden.push(o); });
  for (const o of hidden) {
   o.visible = true;
   try { jobs.push(renderer.compileAsync(o, camera, scene)); } catch (error) { jobs.push(Promise.reject(error)); } finally { o.visible = false; }
  }
  return Promise.allSettled(jobs);
 };
 const result = { syncScene, getOutput, fogFor, contextFor, last, warmHidden };
 renderer.__directOutput = result;
 return result;
}
