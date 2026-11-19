// TSL ground shader (notes/webgpu-spike.md T4): NodeMaterial twin of ground-shader.js for all 11 kinds.
import * as R from './ground-rules.js';
import { GROUND_UNIFORMS, groundProgramKey, groundQualityHigh } from './ground-shader.js';
import { SKY_HORIZON } from './sky.js';
import { createGroundNoiseTSL, buildGroundDetailTSL } from './tsl-ground-kinds.js';

export function createGroundUniformsTSL({ TSL, wet = GROUND_UNIFORMS.uGdWet.value, amount = GROUND_UNIFORMS.uGdAmount.value, skyHorizon = SKY_HORIZON.value } = {}) {
 return { uGdAmount: TSL.uniform(amount), uGdWet: TSL.uniform(wet), uSkyHorizon: TSL.uniform(skyHorizon) };
}

export function makeGroundMaterialTSL(kind, opts = {}) {
 if (!R.GROUND_KINDS.includes(kind)) throw new Error('unknown ground kind ' + kind);
 const { THREE, TSL, MeshStandardNodeMaterial, NodeMaterial, base = null } = opts;
 const Mat = MeshStandardNodeMaterial || NodeMaterial || THREE?.MeshStandardNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const color = opts.color ?? base?.color ?? 0xffffff, map = opts.map ?? base?.map ?? null;
 const roughness = opts.roughness ?? base?.roughness ?? 1, metalness = opts.metalness ?? base?.metalness ?? 0;
 const vertexColors = opts.vertexColors ?? base?.vertexColors ?? false;
 const polygonOffset = opts.polygonOffset ?? base?.polygonOffset ?? false;
 const polygonOffsetFactor = opts.polygonOffsetFactor ?? base?.polygonOffsetFactor ?? 0;
 const polygonOffsetUnits = opts.polygonOffsetUnits ?? base?.polygonOffsetUnits ?? 0;
 const isHigh = opts.isHigh ?? groundQualityHigh();
 const edgeBox = opts.edgeBox ?? base?.userData?.groundEdge ?? null;
 const gravel = opts.gravel ?? base?.userData?.groundGravel ?? false;
 const edgeCfg = edgeBox && isHigh ? R.edgeOf(kind) : null, edge = !!edgeCfg;

 const {
  Fn, uniform, vec2, vec3, vec4, mat2, float, int,
  max, min, mix, smoothstep, clamp, dot, cross, normalize, length, pow, abs, floor, mod, step, select,
  positionWorld, positionView, cameraPosition, normalView, cameraViewMatrix, screenCoordinate, screenSize, faceDirection, dFdx, dFdy,
  uv, texture, vertexColor, array, Discard, If
 } = TSL;

 const shared = opts.shared || createGroundUniformsTSL({ TSL, wet: opts.wet ?? GROUND_UNIFORMS.uGdWet.value });
 const { uGdAmount, uGdWet, uSkyHorizon } = shared;
 const uGdGravel = uniform(gravel ? 1 : 0);
 const uGdBox = edge ? uniform(new THREE.Vector4(edgeBox.x0, edgeBox.z0, edgeBox.x1, edgeBox.z1)) : null;
 const uGdEdge = edge ? uniform(new THREE.Vector3(edgeCfg.w, edgeCfg.j, 0)) : null;

 const mat = new Mat({ color, map, roughness, metalness, vertexColors: false, polygonOffset, polygonOffsetFactor, polygonOffsetUnits });
 mat.name = 'ground-tsl-' + kind;
 mat.userData.groundKind = kind;
 mat.userData.groundEdge = edgeBox || null;
 mat.userData.groundGravel = !!gravel;
 mat.userData.groundVertexColors = !!vertexColors;
 mat.userData.groundUniforms = { uGdAmount, uGdWet, uSkyHorizon, uGdGravel, uGdBox, uGdEdge };
 mat.userData.groundProgramKey = groundProgramKey(kind, isHigh, edge); // T5: NOT customProgramCacheKey: WebGPURenderer shares one node build per key, so every grass plane would draw with the first one's texture and tint

 const noise = createGroundNoiseTSL(TSL);
 const detail = buildGroundDetailTSL(kind, { TSL, noise, isHigh, uGdGravel, uGdWet });
 const bayerArr = edge ? array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]) : null;
 const dry = R.DRY_KINDS.includes(kind);
 const lin = R.hexToLinear(R.GD_DRY_TINT), luma = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
 const dryHue = vec3(...lin.map(v => v / luma));
 const seedEdge = vec2(...R.GD_SEED_EDGE), seedClod = vec2(...R.GD_SEED_CLOD);
 const seedMacro = vec2(...R.GD_SEED_MACRO), seedMeso = vec2(...R.GD_SEED_MESO), seedNoTile = vec2(...R.GD_SEED_NOTILE);
 const worldXZ = positionWorld.xz;

 const evalEdgeM = () => {
  if (!edge) return float(1.0);
  const d = min(min(worldXZ.x.sub(uGdBox.x), uGdBox.z.sub(worldXZ.x)), min(worldXZ.y.sub(uGdBox.y), uGdBox.w.sub(worldXZ.y)));
  const t = clamp(d.sub(noise.gdNoise(worldXZ.mul(R.GD_EDGE_SCALE).add(seedEdge)).mul(uGdEdge.y)).div(uGdEdge.x), 0.0, 1.0);
  return t.mul(t).mul(float(3.0).sub(t.mul(2.0)));
 };
 const evalDetailFade = () => {
  const camDist = length(positionWorld.sub(cameraPosition));
  return clamp(camDist.sub(R.GD_DETAIL_NEAR).div(R.GD_DETAIL_FAR - R.GD_DETAIL_NEAR), 0.0, 1.0);
 };

 const matTint = uniform(mat.color);
 mat.colorNode = Fn(() => {
  const edgeM = evalEdgeM().toVar();
  if (edge) {
   const a = edgeM.add(noise.gdNoise(worldXZ.mul(R.GD_EDGE_CLOD_SCALE).add(seedClod)));
   const b = float(1.0).sub(edgeM).add(R.GD_EDGE_LOW_H), top = max(a, b).sub(R.GD_BLEND_DEPTH);
   const wu = max(a.sub(top), 0.0), wl = max(b.sub(top), 0.0);
   const bx = floor(mod(screenCoordinate.x, 4.0)), by = floor(mod(screenSize.y.sub(screenCoordinate.y), 4.0)); // T6: flipped to gl_FragCoord rows (TSL counts y from the top)
   const bayer = bayerArr.element(int(by.mul(4.0).add(bx))).add(0.5).div(16.0);
   If(uGdAmount.greaterThan(0.5).and(wu.div(wu.add(wl)).lessThan(bayer)), () => { Discard(); });
  }
  const vCol = vertexColors ? vertexColor().rgb : vec3(1.0);
  const mapUv = map ? uv().mul(vec2(map.repeat.x, map.repeat.y)).add(vec2(map.offset.x, map.offset.y)) : uv();
  const baseMatCol = (map ? texture(map, mapUv).rgb.mul(matTint) : matTint).mul(vCol);
  const diffCol = baseMatCol.toVar();
  if (map && isHigh) {
   const c = Math.cos(R.GD_NOTILE_ROT), s = Math.sin(R.GD_NOTILE_ROT), m2 = mat2(c, s, -s, c);
   const rotUv = m2.mul(mapUv).mul(R.GD_NOTILE_ZOOM).add(vec2(...R.GD_NOTILE_OFFSET));
   const wTile = smoothstep(R.GD_NOTILE_LO, R.GD_NOTILE_HI, noise.gdNoise(worldXZ.mul(R.GD_NOTILE_SCALE).add(seedNoTile)));
   diffCol.assign(mix(diffCol, texture(map, rotUv).rgb.mul(matTint).mul(vCol), wTile));
  }
  const gdFar = evalDetailFade(), gdDet = float(1.0).sub(gdFar);
  const gdMacro = noise.gdNoise(worldXZ.mul(R.GD_MACRO_SCALE).add(seedMacro)), gdMeso = noise.gdNoise(worldXZ.mul(R.GD_MESO_SCALE).add(seedMeso));
  const gdTone = mix(R.GD_DARK, R.GD_LIGHT, gdMacro).mul(mix(1.0, mix(R.GD_MESO_DARK, R.GD_MESO_LIGHT, gdMeso), gdDet));
  const gdColor = diffCol.mul(gdTone).toVar();
  if (dry) gdColor.assign(mix(gdColor, dryHue.mul(dot(gdColor, vec3(0.2126, 0.7152, 0.0722))), gdMacro.mul(R.GD_DRY_AMOUNT)));
  if (edge && detail.isMud) gdColor.mulAssign(mix(R.GD_MUD_RIM_DARK, 1.0, edgeM));
  const gdPlain = gdColor.toVar();
  const gdPud = detail.applyColor(gdColor, worldXZ, edgeM, gdDet);
  gdColor.assign(mix(gdPlain, gdColor, gdDet));
  if (detail.isMud) gdColor.mulAssign(mix(1.0, R.GD_WET_DARK, uGdWet.mul(R.GD_MUD_WET)).mul(mix(1.0, R.GD_PUDDLE_DARK, gdPud)));
  return vec4(mix(diffCol, gdColor, uGdAmount), 1.0);
 })();

 if (detail.hasHeight) {
  mat.normalNode = Fn(() => {
   const camDist = length(positionWorld.sub(cameraPosition));
   const gdNk = float(1.0).sub(smoothstep(R.GD_NORMAL_NEAR, R.GD_NORMAL_FAR, camDist));
   const gdH = detail.heightNode(worldXZ, evalEdgeM());
   const nrm = normalView, gdSx = dFdx(positionView), gdSy = dFdy(positionView);
   const gdA = gdH.mul(gdNk).mul(uGdAmount).mul(R.GD_NORMAL), gdD = vec2(dFdx(gdA), dFdy(gdA));
   const gdR1 = cross(gdSy, nrm), gdR2 = cross(nrm, gdSx), gdDt = dot(gdSx, gdR1).mul(faceDirection);
   const bump = normalize(nrm.mul(abs(gdDt)).sub(TSL.sign(gdDt).mul(gdR1.mul(gdD.x).add(gdR2.mul(gdD.y)))));
   return normalize(mix(nrm, bump, step(1e-12, abs(gdDt))));
  })();
 }
 if (detail.isMud) {
  const mudPud = () => detail.mudPd(worldXZ, evalEdgeM()).mul(float(1.0).sub(evalDetailFade()));
  mat.roughnessNode = Fn(() => {
   const rt = mix(mix(1.0, R.GD_WET_ROUGH, uGdWet.mul(R.GD_MUD_WET)), R.GD_PUDDLE_ROUGH, mudPud());
   return mix(float(roughness), rt, uGdAmount);
  })();
  if (isHigh) {
   mat.emissiveNode = Fn(() => {
    const upView = normalize(cameraViewMatrix.mul(vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    const gdC = clamp(dot(upView, normalize(positionView.negate())), 0.0, 1.0);
    const omc = float(1.0).sub(gdC), omc2 = omc.mul(omc), gdF = float(R.GD_F0).add(float(1.0 - R.GD_F0).mul(omc2.mul(omc2).mul(omc)));
    return pow(max(uSkyHorizon, vec3(1e-5)), vec3(R.GD_SKY_GAMMA)).mul(gdF).mul(R.GD_SHEEN_GAIN).mul(mudPud()).mul(uGdAmount);
   })();
  }
 }
 return mat;
}
