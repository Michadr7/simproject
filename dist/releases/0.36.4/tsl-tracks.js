// TSL tyre-tracks material (notes/webgpu-spike.md T3): NodeMaterial twin of dist/tracks.js:14.
import { TRACK_FADE_FROM, TRACK_DRAW_NEAR, TRACK_DRAW_FAR } from './tracks-rules.js';

export const TRACK_SHADER = Object.freeze({ sideInner: 0.55, sideOuter: 1.0, alphaCut: 0.01, vertexCut: 0.004 });

export function createTracksMaterialTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial } = {}) {
 const Mat = MeshBasicNodeMaterial || NodeMaterial || THREE?.MeshBasicNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const {
  Fn, uniform, varying, vec4, float, abs, distance, smoothstep, select,
  attribute, positionLocal, modelWorldMatrix, cameraPosition, modelViewProjection
 } = TSL;
 const uTime = uniform(0);
 const aInfo = attribute('aInfo', 'vec4');
 const age = uTime.sub(aInfo.x);
 const t = select(aInfo.y.greaterThan(0.0), age.div(aInfo.y), float(2.0));
 const fade = select(
  age.lessThan(0.0).or(t.greaterThanEqual(1.0)),
  float(0.0),
  select(t.lessThanEqual(TRACK_FADE_FROM), float(1.0), float(1.0).sub(t).div(1 - TRACK_FADE_FROM))
 );
 const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1.0)).xyz;
 const cd = distance(worldPos, cameraPosition);
 const vAExpr = aInfo.z.mul(fade).mul(float(1.0).sub(smoothstep(TRACK_DRAW_NEAR, TRACK_DRAW_FAR, cd)));
 const vA = varying(vAExpr, 'vTrackA');
 const vSide = varying(aInfo.w, 'vTrackSide');

 const material = new Mat({
  color: '#ffffff',
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  alphaTest: TRACK_SHADER.alphaCut,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2
 });
 material.name = 'tyre-tracks-tsl';
 if (!material.isMeshBasicNodeMaterial) material.lights = false;
 material.vertexNode = select(vAExpr.lessThan(TRACK_SHADER.vertexCut), vec4(3.0, 3.0, 3.0, 1.0), modelViewProjection);
 material.opacityNode = Fn(() => vA.mul(float(1.0).sub(smoothstep(TRACK_SHADER.sideInner, TRACK_SHADER.sideOuter, abs(vSide)))))();

 return { material, uniforms: { uTime } };
}
