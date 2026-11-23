// TSL sky dome and billboard stars (notes/webgpu-spike.md T2): NodeMaterial twin of dist/sky.js.
import { skyAt, NIGHT_FLOOR, clampNightFloor, clampExposureScale, wrapMinutes } from './daynight.js';
import { INDOOR_EXPOSURE, STAR_COUNT, SUN_DISTANCE, SKY_HORIZON } from './sky.js';
import { installGradeTSL } from './tsl-grade.js';

export const SKY_TSL_STAR_SEED = 20261113;
export const SKY_TSL_STAR_SIZE = 2.2;
export const SKY_TSL_MOON_HEX = '#dfe8ff';

export function buildStarData(count = STAR_COUNT, seed0 = SKY_TSL_STAR_SEED) {
 let seed = seed0 >>> 0;
 const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
 const out = new Float32Array(count * 4);
 for (let i = 0; i < count; i++) {
  const y = .03 + rnd() * .97, r = Math.sqrt(1 - y * y), a = rnd() * Math.PI * 2, b = rnd();
  out[i * 4 + 0] = Math.cos(a) * r;
  out[i * 4 + 1] = y;
  out[i * 4 + 2] = Math.sin(a) * r;
  out[i * 4 + 3] = .25 + b * b * b * .75;
 }
 return out;
}

export function createSkyTSL({ THREE, TSL, NodeMaterial, scene, renderer, sun, hemi }) {
 const NM = NodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const {
  Fn, uniform, varying, vec3, vec4, float, max, mix, smoothstep, dot, normalize, length, pow,
  positionGeometry, modelViewMatrix, cameraProjectionMatrix, screenSize, uv, instanceIndex, instancedArray
 } = TSL;
 const graded = !!installGradeTSL({ THREE, TSL, renderer });

 const uTop = uniform(new THREE.Color()), uHorizon = uniform(new THREE.Color());
 const uSunDir = uniform(new THREE.Vector3(0, 1, 0)), uSunColor = uniform(new THREE.Color());
 const uMoonDir = uniform(new THREE.Vector3(0, -1, 0)), uMoonColor = uniform(new THREE.Color(SKY_TSL_MOON_HEX));
 const uSunDisc = uniform(0), uMoonDisc = uniform(0), uSunGlow = uniform(0);

 const viewRotPos = modelViewMatrix.mul(vec4(positionGeometry, 0.0)).xyz;
 const clipPos = cameraProjectionMatrix.mul(vec4(viewRotPos, 1.0));
 const vDir = varying(positionGeometry, 'vSkyDir');

 const domeMat = new NM();
 domeMat.name = 'sky-dome-tsl';
 domeMat.side = THREE.BackSide;
 domeMat.depthTest = false;
 domeMat.depthWrite = false;
 domeMat.fog = false;
 domeMat.lights = false;
 domeMat.vertexNode = vec4(clipPos.x, clipPos.y, 0.0, clipPos.w);
 domeMat.colorNode = Fn(() => {
  const d = normalize(vDir), up = max(d.y, 0.0), low = float(1.0).sub(up);
  const col = mix(uTop, uHorizon, low.mul(low).mul(low)).toVar();
  const s = max(dot(d, uSunDir), 0.0), m = max(dot(d, uMoonDir), 0.0), above = smoothstep(-0.01, 0.02, d.y);
  col.addAssign(uSunColor.mul(pow(s, 6.0)).mul(low.mul(low)).mul(uSunGlow).mul(0.45));
  col.addAssign(uSunColor.mul(smoothstep(0.9993, 0.9996, s).mul(6.0).add(pow(s, 220.0).mul(0.6))).mul(uSunDisc).mul(above));
  col.addAssign(uMoonColor.mul(smoothstep(0.99955, 0.9998, m).mul(1.4).add(pow(m, 900.0).mul(0.15))).mul(uMoonDisc).mul(above));
  return col;
 })();

 const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), domeMat);
 dome.name = 'sky-dome'; dome.renderOrder = -3; dome.frustumCulled = false; dome.matrixAutoUpdate = false;

 const starBuf = instancedArray(buildStarData(STAR_COUNT), 'vec4');
 const uStars = uniform(0), uSize = uniform(SKY_TSL_STAR_SIZE);
 const starMat = new NM();
 starMat.name = 'sky-stars-tsl';
 starMat.blending = THREE.AdditiveBlending;
 starMat.depthTest = false;
 starMat.depthWrite = false;
 starMat.fog = false;
 starMat.lights = false;
 starMat.toneMapped = false;
 const sd = starBuf.element(instanceIndex);
 const starClip = cameraProjectionMatrix.mul(vec4(modelViewMatrix.mul(vec4(sd.xyz, 0.0)).xyz, 1.0));
 const pxOff = positionGeometry.xy.mul(uSize.mul(float(0.6).add(sd.w))).mul(2.0).div(screenSize).mul(starClip.w);
 starMat.vertexNode = vec4(starClip.xy.add(pxOff), 0.0, starClip.w);
 starMat.colorNode = Fn(() => {
  const a = smoothstep(0.5, 0.15, length(uv().sub(0.5)));
  const sb = sd.w.mul(smoothstep(0.02, 0.22, sd.y));
  return vec3(0.85, 0.9, 1.0).mul(sb).mul(uStars).mul(a);
 })();
 const stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), starMat, STAR_COUNT);
 stars.name = 'sky-stars'; stars.renderOrder = -2; stars.frustumCulled = false; stars.matrixAutoUpdate = false; stars.visible = false;
 scene.add(dome, stars);

 const DAY = skyAt(720), tuned = { minutes: null, nightFloor: NIGHT_FLOOR, exposureScale: 1 }, last = { x: 0, z: 0 };
 let hills = null, now = DAY;
 function update(minutes, { target = null, indoors = false, weather = null } = {}) {
  const s = now = skyAt(tuned.minutes ?? minutes, weather ? { ...tuned, weather } : tuned), L = indoors ? DAY : s;
  if (target) { last.x = target.x; last.z = target.z; }
  sun.color.setRGB(L.lightColor[0], L.lightColor[1], L.lightColor[2]); sun.intensity = L.lightStrength;
  sun.position.set(last.x + L.lightDir[0] * SUN_DISTANCE, L.lightDir[1] * SUN_DISTANCE, last.z + L.lightDir[2] * SUN_DISTANCE);
  sun.target.position.set(last.x, 0, last.z); sun.target.updateMatrixWorld();
  hemi.color.setRGB(L.hemiSky[0], L.hemiSky[1], L.hemiSky[2]); hemi.groundColor.setRGB(L.hemiGround[0], L.hemiGround[1], L.hemiGround[2]); hemi.intensity = L.hemiStrength;
  if (scene.fog) { scene.fog.color.setRGB(s.horizon[0], s.horizon[1], s.horizon[2]); scene.fog.near = s.fogNear; scene.fog.far = s.fogFar; }
  if (scene.background?.isColor) scene.background.setRGB(s.horizon[0], s.horizon[1], s.horizon[2]);
  renderer.toneMappingExposure = indoors ? INDOOR_EXPOSURE : s.exposure;
  SKY_HORIZON.value.setRGB(s.horizon[0], s.horizon[1], s.horizon[2]);
  uTop.value.setRGB(s.top[0], s.top[1], s.top[2]); uHorizon.value.setRGB(s.horizon[0], s.horizon[1], s.horizon[2]);
  uSunDir.value.set(s.sunDir[0], s.sunDir[1], s.sunDir[2]); uMoonDir.value.set(s.moonDir[0], s.moonDir[1], s.moonDir[2]);
  {
   const k = 1 + (s.weights.dawn + s.weights.dusk) * .6, w = s.weights.day, a = DAY.lightColor, b = s.sunHeight >= 0 ? s.lightColor : a;
   uSunColor.value.setRGB((a[0] * w + b[0] * (1 - w)) * k, (a[1] * w + b[1] * (1 - w)) * k * (1 - .25 * s.sunGlow), (a[2] * w + b[2] * (1 - w)) * k * (1 - .55 * s.sunGlow));
  }
  uSunDisc.value = s.sunDisc; uMoonDisc.value = s.moonDisc; uSunGlow.value = s.sunGlow;
  stars.visible = s.stars > .02; uStars.value = s.stars; uSize.value = SKY_TSL_STAR_SIZE * (renderer.getPixelRatio?.() || 1);
  if (!hills) hills = scene.getObjectByName('distant-hills') || null;
  if (hills) hills.material.color.setRGB(s.horizon[0] / DAY.horizon[0], s.horizon[1] / DAY.horizon[1], s.horizon[2] / DAY.horizon[2]);
  return s;
 }
 function tune(values = {}) {
  if ('minutes' in values) tuned.minutes = values.minutes === null || !Number.isFinite(values.minutes) ? null : wrapMinutes(values.minutes);
  if ('nightFloor' in values) tuned.nightFloor = values.nightFloor === null ? NIGHT_FLOOR : clampNightFloor(values.nightFloor);
  if ('exposureScale' in values) tuned.exposureScale = values.exposureScale === null ? 1 : clampExposureScale(values.exposureScale);
  return { ...tuned };
 }
 update(720);
 return {
  dome, stars, graded, update, tune, tuning: () => ({ ...tuned }), state: () => now,
  uniforms: { uTop, uHorizon, uSunDir, uSunColor, uMoonDir, uMoonColor, uSunDisc, uMoonDisc, uSunGlow, uStars, uSize }
 };
}
