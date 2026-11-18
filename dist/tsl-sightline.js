// TSL sightline Bayer dither fade (notes/webgpu-spike.md T3): twin of world.js:185-210.
export const SIGHTLINE_FADE = Object.freeze({
 radius: 1.9,
 innerShare: 0.45,
 tMin: 0.02,
 tEnd0: 0.86,
 tEnd1: 0.97,
 maxFade: 0.88,
 minSegLenSq: 1e-4
});
export const BAYER_4X4 = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

export function createSightlineFadeTSL({ THREE, TSL } = {}) {
 const {
  Fn, uniform, array, float, int, clamp, distance, dot, floor, max, mod, smoothstep, step,
  positionWorld, screenCoordinate
 } = TSL;
 const uFadeCamera = uniform(new THREE.Vector3());
 const uFadeTarget = uniform(new THREE.Vector3());
 const uFadeRadius = uniform(SIGHTLINE_FADE.radius);
 const uFadeEnabled = uniform(1);
 const uniforms = { uFadeCamera, uFadeTarget, uFadeRadius, uFadeEnabled };
 const bayerArr = array([...BAYER_4X4]);

 const keepNode = Fn(() => {
  const seg = uFadeTarget.sub(uFadeCamera);
  const segLenSq = max(dot(seg, seg), SIGHTLINE_FADE.minSegLenSq);
  const t = clamp(dot(positionWorld.sub(uFadeCamera), seg).div(segLenSq), 0.0, 1.0);
  const d = distance(positionWorld, uFadeCamera.add(seg.mul(t)));
  const fade = float(1.0).sub(smoothstep(uFadeRadius.mul(SIGHTLINE_FADE.innerShare), uFadeRadius, d))
   .mul(step(SIGHTLINE_FADE.tMin, t))
   .mul(float(1.0).sub(smoothstep(SIGHTLINE_FADE.tEnd0, SIGHTLINE_FADE.tEnd1, t)))
   .mul(uFadeEnabled);
  const bx = floor(mod(screenCoordinate.x, 4.0));
  const by = floor(mod(screenCoordinate.y, 4.0));
  const bayer = bayerArr.element(int(by.mul(4.0).add(bx))).add(0.5).div(16.0);
  return fade.mul(SIGHTLINE_FADE.maxFade).lessThanEqual(bayer);
 })();

 function apply(material) {
  if (!material) return material;
  const prev = material.maskNode;
  material.maskNode = prev ? prev.and(keepNode) : keepNode;
  return material;
 }
 function update(camera, target) {
  uFadeCamera.value.copy(camera.position);
  uFadeTarget.value.copy(target);
 }
 return { uniforms, apply, update, keepNode };
}
