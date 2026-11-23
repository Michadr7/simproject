// Shared WebGL + WebGPU renderer mock for Node boot tests (notes/webgpu-spike.md T1).
// T5 (tests/webgpu-flag.mjs): backend 'auto' picks the WebGPU backend only when navigator.gpu exists (as the library does); webgpuModule: the URL of a REAL three.webgpu.js
// to re-export (real NodeMaterials; only WebGPURenderer is the mock). Loading the mock three.webgpu.js counts in globalThis.__webgpuModuleLoads.
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultThreeURL = pathToFileURL(resolve('dist/vendor/three.module.js')).href;

// Synthetic frame pumps do not yield to the sawmill's asynchronous GLB decode.
export async function waitForSawmill(scene) {
 await scene.getObjectByName('prop-sawmill-v4').userData.ready;
}

export async function writeMockRenderer(dir, vendorThreeURL = defaultThreeURL, { backend = 'webgl', webgpuModule = null } = {}) {
 const gpuExpr = backend === 'auto' ? '!!globalThis.navigator?.gpu' : String(backend === 'webgpu');
 const rendererBody = `
  constructor(opts = {}) {
   this.domElement = opts.canvas || { width: 1400, height: 900 };
   this.shadowMap = { enabled: false, type: 0 };
   this.info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
   this.toneMapping = 0;
   this.toneMappingExposure = 1;
   this._pixelRatio = 1;
   this._toneMappings = new Map();
   this.library = { addToneMapping: (fn, key) => { this._toneMappings.set(key, fn); } };
   const forceGL = !!opts.forceWebGL;
   const gpu = ${gpuExpr};
   this.options = opts;
   this.backend = { isWebGPUBackend: !forceGL && gpu, isWebGLBackend: forceGL || !gpu };
   this.initialized = false;
  }
  async init() { await Promise.resolve(); this.initialized = true; return this; }
  setPixelRatio(r) { this._pixelRatio = r ?? 1; }
  getPixelRatio() { return this._pixelRatio; }
  setSize() {}
  setViewport() {}
  setScissorTest() {}
  setScissor() {}
  clear() {}
  clearDepth() {}
  compile() {}
  dispose() {}
 `;

 await writeFile(join(dir, 'vendor/three.module.js'),
  `export * from '${vendorThreeURL}';
export class WebGLRenderer {
 ${rendererBody}
 render(scene, camera) {
  if (scene.name !== 'menu-scene') globalThis.__renders = (globalThis.__renders || 0) + 1;
  if (scene.name === 'menu-scene') globalThis.__menuScene = scene;
  else { globalThis.__renderScene = scene; globalThis.__renderCamera = camera; }
 }
}
`, 'utf8');

 const nodeClasses = webgpuModule ? `export * from '${webgpuModule}';` : `export * from '${vendorThreeURL}';
class BaseNodeMat { constructor(p = {}) { Object.assign(this, p); } }
export class NodeMaterial extends BaseNodeMat {}
export class MeshBasicNodeMaterial extends BaseNodeMat {}
export class MeshLambertNodeMaterial extends BaseNodeMat {}
export class MeshStandardNodeMaterial extends BaseNodeMat {}
export class PointsNodeMaterial extends BaseNodeMat {}
export class SpriteNodeMaterial extends BaseNodeMat {}
export class RenderPipeline {
 constructor(r) { this.r = r; }
 render() { if (!this.r.initialized) throw new Error('WebGPURenderer: init() must be awaited before RenderPipeline.render()'); }
 dispose() {}
}`;
 await writeFile(join(dir, 'vendor/three.webgpu.js'),
  `${nodeClasses}
globalThis.__webgpuModuleLoads = (globalThis.__webgpuModuleLoads || 0) + 1;
export class WebGPURenderer {
 ${rendererBody}
 render(scene, camera) {
  if (!this.initialized) throw new Error('WebGPURenderer: init() must be awaited before render()');
  globalThis.__webgpuRenderer = this;
  if (scene.name !== 'menu-scene') globalThis.__renders = (globalThis.__renders || 0) + 1;
  if (scene.name === 'menu-scene') globalThis.__menuScene = scene;
  else { globalThis.__renderScene = scene; globalThis.__renderCamera = camera; }
 }
 compute() {
  if (!this.initialized) throw new Error('WebGPURenderer: init() must be awaited before compute()');
 }
 get compile() { return undefined; } // the real WebGPURenderer has only compileAsync
 async compileAsync(...args) {
  if (!this.initialized) throw new Error('WebGPURenderer: init() must be awaited before compileAsync()');
  return globalThis.__mockCompileAsync?.(...args);
 }
}
`, 'utf8');
}
