// Shared WebGL + WebGPU renderer mock for Node boot tests (notes/webgpu-spike.md T1).
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultThreeURL = pathToFileURL(resolve('dist/vendor/three.module.js')).href;

export async function writeMockRenderer(dir, vendorThreeURL = defaultThreeURL, { backend = 'webgl' } = {}) {
 const useWebGPU = backend === 'webgpu';
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
   this.backend = { isWebGPUBackend: !forceGL && ${useWebGPU}, isWebGLBackend: forceGL || ${!useWebGPU} };
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

 await writeFile(join(dir, 'vendor/three.webgpu.js'),
  `export * from '${vendorThreeURL}';
export class WebGPURenderer {
 ${rendererBody}
 render(scene, camera) {
  if (!this.initialized) throw new Error('WebGPURenderer: init() must be awaited before render()');
  if (scene.name !== 'menu-scene') globalThis.__renders = (globalThis.__renders || 0) + 1;
  if (scene.name === 'menu-scene') globalThis.__menuScene = scene;
  else { globalThis.__renderScene = scene; globalThis.__renderCamera = camera; }
 }
 compute() {
  if (!this.initialized) throw new Error('WebGPURenderer: init() must be awaited before compute()');
 }
}
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
}
`, 'utf8');
}
