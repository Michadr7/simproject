// TSL per-kind ground detail and height helpers (notes/webgpu-spike.md T4): twin of ground-shader.js.
import * as R from './ground-rules.js';

export function createGroundNoiseTSL(TSL) {
 const { Fn, vec2, vec3, float, floor, fract, dot, mix, length, sqrt, If } = TSL;
 const gdHash = Fn(([p]) => {
  const q = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
  q.addAssign(dot(q, q.yzx.add(33.33)));
  return fract(q.x.add(q.y).mul(q.z));
 });
 const gdNoise = Fn(([p]) => {
  const i = floor(p), f0 = fract(p), f = f0.mul(f0).mul(vec2(3.0).sub(f0.mul(2.0)));
  return mix(mix(gdHash(i), gdHash(i.add(vec2(1.0, 0.0))), f.x), mix(gdHash(i.add(vec2(0.0, 1.0))), gdHash(i.add(vec2(1.0, 1.0))), f.x), f.y);
 });
 const gdPebble = Fn(([p, occ, rr]) => {
  const i = floor(p), f = fract(p), h0 = gdHash(i), out = vec2(0.0).toVar();
  If(h0.lessThan(occ), () => {
   const r = mix(rr.x, rr.y, gdHash(i.add(5.3)));
   const c = r.add(float(1.0).sub(r.mul(2.0)).mul(vec2(gdHash(i.add(17.1)), gdHash(i.add(43.7)))));
   const d = length(f.sub(c)).div(r);
   If(d.lessThan(1.0), () => { out.assign(vec2(sqrt(float(1.0).sub(d.mul(d))), h0.div(occ))); });
  });
  return out;
 });
 return { gdHash, gdNoise, gdPebble };
}

export function buildGroundDetailTSL(kind, { TSL, noise, isHigh, uGdGravel, uGdWet }) {
 const { vec2, vec3, float, floor, fract, abs, min, max, mix, sin, step, smoothstep, select, length } = TSL;
 const { gdHash, gdNoise, gdPebble } = noise;
 const seedDet = vec2(...R.GD_SEED_DETAIL), seedClump = vec2(...R.GD_SEED_CLUMP);
 const seedPeb = vec2(...R.GD_SEED_PEBBLE), seedCrk = vec2(...R.GD_SEED_CRACK);
 const seedPud = vec2(...R.GD_SEED_PUDDLE), seedPud2 = vec2(...R.GD_SEED_PUDDLE2);
 const hasDetail = R.GD_DETAIL_KINDS.includes(kind);
 const hasHeight = isHigh && hasDetail && kind !== 'paving';

 const dirtData = (q) => {
  const pc = mix(R.GD_PEBBLE_CELL, R.GD_GRAVEL_CELL, uGdGravel);
  const pb = gdPebble(q.div(pc).add(seedPeb), mix(R.GD_PEBBLE_OCC, R.GD_GRAVEL_OCC, uGdGravel), mix(vec2(...R.GD_PEBBLE_R), vec2(...R.GD_GRAVEL_R), uGdGravel));
  let ck = float(0.0);
  if (isHigh) {
   const wp = q.div(R.GD_CRACK_CELL).add(vec2(gdNoise(q.mul(0.9).add(seedCrk)), gdNoise(q.mul(0.9).add(seedCrk).add(31.0))).sub(0.5).mul(R.GD_CRACK_WARP * 2.0));
   const fr = abs(fract(wp).sub(0.5)), eg = float(0.5).sub(max(fr.x, fr.y));
   ck = float(1.0).sub(smoothstep(0.0, R.GD_CRACK_W, eg)).mul(smoothstep(R.GD_CRACK_COVER, R.GD_CRACK_COVER + 0.1, gdNoise(q.mul(R.GD_CRACK_MASK_SCALE).add(seedCrk)))).mul(float(1.0).sub(uGdGravel));
  }
  return { pb, ck };
 };
 const mudPd = (q, edgeM) => {
  const low = gdNoise(q.mul(R.GD_PUDDLE_SCALE).add(seedPud)).mul(1.0 - R.GD_PUDDLE_MIX2).add(gdNoise(q.mul(R.GD_PUDDLE_SCALE2).add(seedPud2)).mul(R.GD_PUDDLE_MIX2));
  const lv = float(R.GD_PUDDLE_LEVEL).mul(uGdWet);
  return float(1.0).sub(smoothstep(lv.sub(R.GD_PUDDLE_SOFT), lv.add(R.GD_PUDDLE_SOFT), low)).mul(edgeM);
 };
 const mudRidge = (q) => {
  const rg = float(1.0).sub(abs(gdNoise(q.div(R.GD_MUD_RIDGE_CELL).add(seedDet)).mul(2.0).sub(1.0)));
  return mix(gdNoise(q.mul(R.GD_MUD_CLOD_SCALE).add(seedPeb)), rg, R.GD_MUD_RIDGE);
 };
 const forestMask = (q) => {
  const lc = q.div(R.GD_LITTER_CELL), li = floor(lc), lh = gdHash(li.add(seedDet));
  const lm = step(lh, R.GD_LITTER).mul(float(1.0).sub(smoothstep(0.28, 0.4, length(fract(lc).sub(0.5)))));
  return { li, lh, lm };
 };

 function applyColor(gdColor, q, edgeM, gdDet) {
  if (kind === 'grass' || kind === 'farm' || kind === 'valley') {
   const cl = gdNoise(q.div(R.GD_CLUMP_CELL).add(seedClump));
   gdColor.mulAssign(mix(R.GD_CLUMP_DARK, 1.0, smoothstep(0.25, 0.6, cl)));
   if (isHigh) {
    const fc = q.div(R.GD_FLECK_CELL), fh = gdHash(floor(fc).add(seedDet));
    gdColor.mulAssign(mix(1.0, R.GD_FLECK_GAIN, step(1.0 - R.GD_FLECK_FILL, fh).mul(step(length(fract(fc).sub(0.5)), 0.3))));
   }
  } else if (kind === 'forest') {
   const { li, lh, lm } = forestMask(q), ls = lh.div(R.GD_LITTER);
   const c0 = vec3(...R.hexToLinear(R.GD_LITTER_COLORS[0])), c1 = vec3(...R.hexToLinear(R.GD_LITTER_COLORS[1])), c2 = vec3(...R.hexToLinear(R.GD_LITTER_COLORS[2]));
   const lcol = select(ls.lessThan(0.34), c0, select(ls.lessThan(0.67), c1, c2));
   gdColor.assign(mix(gdColor, lcol.mul(float(0.8).add(gdHash(li.add(7.7)).mul(0.4))), lm.mul(R.GD_LITTER_MIX)));
  } else if (kind === 'dirt') {
   const { pb, ck } = dirtData(q), pin = step(0.0001, pb.x);
   const shD = mix(1.0, mix(R.GD_PEBBLE_RIM, 1.0 + R.GD_PEBBLE_TOP, pb.x), pin);
   const t0 = vec3(...R.GD_GRAVEL_TINTS[0]), t1 = vec3(...R.GD_GRAVEL_TINTS[1]), t2 = vec3(...R.GD_GRAVEL_TINTS[2]);
   const tint = select(pb.y.lessThan(0.34), t0, select(pb.y.lessThan(0.67), t1, t2));
   const shG = mix(vec3(R.GD_GRAVEL_GAP), tint.mul(float(1.0).add(pb.x.mul(R.GD_PEBBLE_TOP))), pin);
   gdColor.mulAssign(mix(vec3(shD), shG, uGdGravel));
   if (isHigh) gdColor.mulAssign(float(1.0).sub(ck.mul(R.GD_CRACK)));
  } else if (kind === 'plowed') {
   const fs = sin(q.y.mul(Math.PI * 2 / R.GD_FURROW_PERIOD)), cr = smoothstep(0.2, 1.0, fs), ch = gdNoise(q.div(R.GD_CLOD_CELL).add(seedDet));
   gdColor.mulAssign(float(1.0).add(fs.mul(R.GD_FURROW_AMP * 0.3)).add(cr.mul(ch.sub(0.5)).mul(0.25)));
  } else if (kind === 'paving') {
   const sc = q.div(R.GD_SLAB);
   gdColor.mulAssign(float(1.0).add(gdHash(floor(sc).add(seedDet)).sub(0.5).mul(2.0 * R.GD_SLAB_JITTER)));
   if (isHigh) {
    const sf = fract(sc).mul(R.GD_SLAB), se = min(sf, float(R.GD_SLAB).sub(sf));
    gdColor.mulAssign(mix(1.0, R.GD_SLAB_EDGE_DARK, float(1.0).sub(smoothstep(0.0, R.GD_SLAB_EDGE, min(se.x, se.y)))));
   }
  } else if (kind === 'mud') {
   const pd = mudPd(q, edgeM);
   if (isHigh) gdColor.mulAssign(float(1.0).add(mudRidge(q).sub(0.5).mul(0.3)));
   return pd.mul(gdDet);
  }
  return float(0.0);
 }

 function heightNode(q, edgeM) {
  if (kind === 'grass' || kind === 'farm' || kind === 'valley') return gdNoise(q.div(R.GD_CLUMP_CELL).add(seedClump)).mul(R.GD_GRASS_H);
  if (kind === 'forest') return forestMask(q).lm.mul(R.GD_LITTER_H);
  if (kind === 'dirt') { const { pb, ck } = dirtData(q); return pb.x.mul(mix(R.GD_PEBBLE_H, R.GD_GRAVEL_H, uGdGravel)).sub(ck.mul(R.GD_CRACK_H)); }
  if (kind === 'plowed') {
   const fs = sin(q.y.mul(Math.PI * 2 / R.GD_FURROW_PERIOD)), cr = smoothstep(0.2, 1.0, fs), ch = gdNoise(q.div(R.GD_CLOD_CELL).add(seedDet));
   return fs.mul(0.5 * R.GD_FURROW_H).add(cr.mul(ch).mul(R.GD_CLOD_H));
  }
  if (kind === 'mud') return mix(mudRidge(q).mul(R.GD_MUD_H), 0.0, mudPd(q, edgeM));
  return float(0.0);
 }

 return { hasDetail, hasHeight, isMud: kind === 'mud', applyColor, heightNode, mudPd };
}
