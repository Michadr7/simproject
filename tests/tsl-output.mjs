// WebGPU T6 direct output (dist/tsl-output.js): on ?webgpu=1 every material grades + sRGB-encodes itself and blends in screen colours, fog mixes after the encode with the encoded
// fog colour, a solid background is cleared already encoded: the WebGL order (three.module.js: tonemapping_fragment, colorspace_fragment, fog_fragment; fogColor and the clear colour
// through getUnlitUniformColorSpace). Checked on a REAL WebGPURenderer (constructed, not initialised: no GPU in Node) and the real node classes; the CPU part pins the numbers.
import assert from 'node:assert/strict';
import * as W from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';
import { installDirectOutputTSL, webglFragment, linearPassFragment, webglAdditive, linearPassAdditive, srgbEncode, srgbDecode } from '../dist/tsl-output.js';
import { grade } from '../dist/daynight.js';

const canvas = { width: 300, height: 150, style: {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; } };

// 1. The renderer: three sees "the canvas needs no output step" (no framebuffer, no output pass, MSAA kept); renderer.toneMapping/outputColorSpace stay the game's own values.
const r = new W.WebGPURenderer({ canvas, antialias: true });
assert.equal(r.needsFrameBufferTarget, true, 'plain WebGPURenderer: framebuffer + output pass');
assert.equal(r.currentSamples, 0, 'plain: no MSAA on the canvas (the WebGL2 backend would ask for a context without antialias)');
const d = installDirectOutputTSL({ THREE: W, TSL, renderer: r });
assert.equal(installDirectOutputTSL({ THREE: W, TSL, renderer: r }), d, 'installing twice changes nothing');
r.toneMapping = W.CustomToneMapping; r.outputColorSpace = W.SRGBColorSpace; // what game.js line 105 and sky.js (installGradeTSL) do
assert.equal(r.toneMapping, W.CustomToneMapping, 'save/restore code (the map bake) reads back what it set');
assert.equal(r.needsFrameBufferTarget, false, 'direct: no framebuffer target, no output pass');
assert.equal(r.currentSamples, 4, 'direct: the canvas keeps 4x MSAA');
assert.equal(typeof r.contextNode.getFlowContextData().getOutput, 'function', 'the getOutput hook is in the renderer context');

// 2. getOutput: every material on the canvas ends with renderOutput(grade, sRGB); toneMapped false = encode only; render targets (shadow maps) stay linear; the display fog is not encoded twice.
const ctx = d.contextFor(W.CustomToneMapping, W.SRGBColorSpace).getFlowContextData();
assert.equal(d.contextFor(W.CustomToneMapping, W.SRGBColorSpace).getFlowContextData().getOutput, ctx.getOutput);
assert.equal(d.contextFor(W.CustomToneMapping, W.SRGBColorSpace), d.contextFor(W.CustomToneMapping, W.SRGBColorSpace), 'one context per setting (no pipeline churn)');
assert.notEqual(d.contextFor(W.NoToneMapping, W.SRGBColorSpace), d.contextFor(W.CustomToneMapping, W.SRGBColorSpace), 'a temporary NoToneMapping gets its own pipelines');
const node = TSL.vec4(1, 0.5, 0.25, 1);
const out = (material, extra = {}) => d.getOutput(node, { material, renderer: { isOutputTarget: true }, fogNode: null, context: ctx, ...extra });
const lit = out(new W.MeshStandardNodeMaterial());
assert(lit.isRenderOutputNode, 'a RenderOutputNode'); assert.equal(lit.getToneMapping(), W.CustomToneMapping); assert.equal(lit.outputColorSpace, W.SRGBColorSpace); assert.equal(lit.premultipliedAlpha, false);
const stars = new W.MeshBasicNodeMaterial(); stars.toneMapped = false;
assert.equal(out(stars).getToneMapping(), W.NoToneMapping, 'toneMapped false: sRGB only, as WebGL');
const pm = new W.MeshBasicNodeMaterial(); pm.premultipliedAlpha = true; assert.equal(out(pm).premultipliedAlpha, true);
assert.equal(out(lit, { renderer: { isOutputTarget: false } }), node, 'render targets keep linear colour');
assert.equal(out(new W.MeshStandardNodeMaterial(), { fogNode: { isDisplayFog: true } }), node, 'fogged: the fog node already encoded it');
const noFog = new W.MeshBasicNodeMaterial(); noFog.fog = false;
assert(out(noFog, { fogNode: { isDisplayFog: true } }).isRenderOutputNode, 'fog:false materials (glow, sky) are encoded here');
// 3. Fog and background, through the render wrapper.
const scene = new W.Scene(); scene.fog = new W.Fog('#b9cbd0', 65, 155); scene.background = new W.Color('#38584e');
const bgObject = scene.background; let seen = null;
const fake = { toneMapping: W.CustomToneMapping, outputColorSpace: W.SRGBColorSpace, render(s) { seen = { bg: [s.background.r, s.background.g, s.background.b], fogNode: s.fogNode, tm: fake.contextNode.getFlowContextData().directToneMapping }; }, compileAsync() { return Promise.resolve(); }, info: { render: { drawCalls: 37, triangles: 1234 } } };
const fd = installDirectOutputTSL({ THREE: W, TSL, renderer: fake });
fake.render(scene, null);
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-4, `${msg}: ${a} vs ${b}`);
[0x38, 0x58, 0x4e].forEach((v, i) => near(seen.bg[i], v / 255, 'the clear colour is the encoded #38584e (WebGL clears in screen colours, no grade)'));
assert.equal(scene.background, bgObject, 'the background object is put back after the render');
assert.equal(seen.tm, W.CustomToneMapping);fake.toneMapping = W.NoToneMapping; fake.render(scene, null); assert.equal(seen.tm, W.NoToneMapping, 'a temporary switch (map bake) renders with its own context');fake.toneMapping = W.CustomToneMapping; fake.render(scene, null); assert.equal(seen.tm, W.CustomToneMapping, 'and back');
assert(seen.fogNode && seen.fogNode.isDisplayFog, 'the scene renders with the display fog node');
const f = fd.fogFor(scene);
[0xb9, 0xcb, 0xd0].forEach((v, i) => near([f.uColor.value.r, f.uColor.value.g, f.uColor.value.b][i], v / 255, 'fog colour in screen colours (WebGL fogColor)'));
assert.equal(f.uNear.value, 65); assert.equal(f.uFar.value, 155);
scene.fog.near = 14; scene.fog.far = 46; fake.render(scene, null); assert.equal(f.uNear.value, 14, 'fog follows the scene every render'); assert.equal(f.uFar.value, 46);
assert.deepEqual(fd.last, { calls: 37, triangles: 1234 }, 'the dev cost line reads the last render (renderer.info is zeroed between frames)');
scene.fog = null; fake.render(scene, null); assert.equal(scene.fogNode, null, 'no fog: the node goes away');

// 4. Warm-up of hidden TSL twins: compiled one by one with the scene, shown only during the call.
const hidden = new W.Mesh(new W.PlaneGeometry(), new W.MeshBasicNodeMaterial()); hidden.material.name = 'night-sprites-tsl'; hidden.visible = false;
const plain = new W.Mesh(new W.PlaneGeometry(), new W.MeshBasicNodeMaterial()); plain.material.name = 'door'; plain.visible = false;
scene.add(hidden, plain); const calls = [];
const fresh = { render() {}, compileAsync: (o, cam, target) => { calls.push({ o, visible: o.visible, target }); return Promise.resolve(); } };
const wd = installDirectOutputTSL({ THREE: W, TSL, renderer: fresh });
assert.equal(wd.warmHidden(scene, {}), 1, 'one hidden twin'); assert.equal(calls[0].o, hidden); assert.equal(calls[0].visible, true); assert.equal(calls[0].target, scene); assert.equal(hidden.visible, false, 'hidden again');

// 5. The numbers: one night pixel (lamp glow over dark ground) and one fogged pixel, WebGL formula vs the T5 linear pass. The direct path computes exactly the WebGL formula.
const lv = x => Math.round(x * 255);
const bg = [0.006, 0.007, 0.009], glow = [0.35, 0.22, 0.08], nightExposure = 0.9;
const gl = webglAdditive(bg, glow, nightExposure).map(lv), lin = linearPassAdditive(bg, glow, nightExposure).map(lv);
assert(gl[0] - lin[0] >= 15, `the linear pass made the halo weaker (T5 gap 1): WebGL ${gl} vs linear ${lin}`);
// independent check of the WebGL additive: encoded background + encoded glow, each through daynight.grade
const manual = bg.map((v, i) => Math.min(1, srgbEncode(grade(bg, nightExposure)[i]) + srgbEncode(grade(glow, nightExposure)[i])));
manual.forEach((v, i) => assert.equal(lv(v), gl[i]));
const fog = { color: [0.48, 0.6, 0.63].map(srgbDecode), near: 14, far: 46 };
const pine = [0.03, 0.05, 0.02], fgl = webglFragment(pine, { fog, depth: 30 }).map(lv), flin = linearPassFragment(pine, { fog, depth: 30 }).map(lv);
assert(Math.abs(fgl[1] - flin[1]) >= 5, `fog order changes a menu pine at 30 m (T5 gap 2): WebGL ${fgl} vs linear ${flin}`);
assert.deepEqual(webglFragment(pine, { fog, depth: 0 }), webglFragment(pine), 'no fog in front of fog.near');
console.log(`night halo pixel: WebGL ${gl} vs T5 linear pass ${lin}; menu pine at 30 m: WebGL ${fgl} vs T5 ${flin}`);
console.log('PASS tsl-output: real WebGPURenderer runs without framebuffer/output pass (MSAA kept), per-material grade + sRGB with toneMapped honoured, render targets linear, display fog (encoded colour, follows the scene), encoded clear colour, hidden-twin warm-up, last draw calls.');
