// GD4 ground cover rules (notes/ground-detail-design.md 2a, 2b and decision 6): which cover kind grows where, how dense, which Quaternius MegaKit model and scale, level-of-detail distances, the per-chunk cap and the deterministic placement coverFor(); pure, no DOM, no three.js.
import {macroAt,valueNoise,groundTone} from './ground-rules.js';
export const COVER_CHUNK=100; // metres: a chunk (chunks.js CHUNK)
export const COVER_TIERS=['low','medium','high'];
export const SURF=Object.freeze({GRASS:1,STREET:2,ROAD:3,DIRT:4,PAVEMENT:5,WATER:6,BANK:7,BRIDGE:8,WHEAT:9,PLOWED:10,GREEN:11,DRIVEWAY:12,PATH:13,MUD:14,GRAVEL:15}); // mirror of terrain.js SURFACE (a test checks they agree; kept local so this file stays standalone)
// Per tier: density multiplier, reach (full size inside near, gone at far, metres), kinds drawn, model variants per kind, hard instance cap per chunk (tier total 6k/25k/60k from the design table over about 4 chunks in reach).
export const COVER_TIER=Object.freeze({
 low:{density:.4,near:12,far:20,kinds:['grass'],variants:1,chunkCap:1500},
 medium:{density:.65,near:20,far:32,kinds:['grass','fern','crop'],variants:1,chunkCap:6250},
 high:{density:1,near:40,far:60,kinds:['grass','tallgrass','clover','fern','flower','bush','pebble','rock','mushroom','reed','crop'],variants:1,chunkCap:15000}});
export const COVER_FOG_CAP=64; // no kind reaches past this (fog starts 65 m)
export const COVER_ORDER=['bush','rock','mushroom','flower','fern','reed','pebble','clover','tallgrass','crop','grass']; // output order and cap priority: big and rare first, the dense grass is thinned first
// Rule fields: cell = jitter-grid cell in metres (max possible density = 100/cell^2 per 100 m2); surf = density per 100 m2 by surface id (High); biome = multiplier by biome name from sampler.biomeAt; maxSlope = rise/run; roadMin/buildMin/waterMin = metres clear of road edge, building and water; waterBand = [lo,hi] metres from water (reeds); macro = [lo,hi] smoothstep window on the ground macro noise (meadow patches); clump 0..1 = how strongly a 14 m noise bunches the density; scale = range on the model's native size; reach = multiplier on the tier reach; models = MegaKit glTF names (null = code-made fallback, the kit has no reeds or crop).
export const COVER_RULES=Object.freeze({
 grass:{cell:1.2,surf:{1:36,11:30,7:10},biome:{forest:.4,farm:1.3},maxSlope:.9,roadMin:.3,buildMin:.3,waterMin:0,clump:.3,macro:null,scale:[.7,1.3],reach:1,models:['Grass_Common_Short','Grass_Wispy_Short']},
 tallgrass:{cell:1.8,surf:{1:14,11:8},biome:{forest:.3,farm:1.2},maxSlope:.7,roadMin:1.2,buildMin:1,waterMin:0,clump:.6,macro:[.4,.65],scale:[.8,1.2],reach:1,models:['Grass_Common_Tall','Grass_Wispy_Tall']},
 clover:{cell:2.5,surf:{1:8,11:6},biome:{forest:.2},maxSlope:.5,roadMin:.5,buildMin:.5,waterMin:0,clump:.7,macro:null,scale:[.8,1.3],reach:.6,models:['Clover_1','Clover_2']},
 fern:{cell:2,surf:{1:1.5},biome:{forest:8,farm:.3},maxSlope:.8,roadMin:1,buildMin:1,waterMin:.5,clump:.5,macro:null,scale:[.7,1.2],reach:.9,models:['Fern_1']}, // forest ground 12 per 100 m2, open grass 1.5
 flower:{cell:2,surf:{1:12},biome:{forest:.1},maxSlope:.5,roadMin:1.5,buildMin:1.5,waterMin:1.5,clump:.4,macro:[.6,.74],scale:[.8,1.2],reach:.8,models:['Flower_3_Group','Flower_4_Group','Flower_3_Single','Flower_4_Single']}, // meadow patches only (macro above .6; user decision 4)
 bush:{cell:3.5,surf:{1:2.4},biome:{forest:1.5,farm:.2},maxSlope:.6,roadMin:2.5,buildMin:2,waterMin:2,clump:.8,macro:null,scale:[.7,1.3],reach:1.3,models:['Bush_Common','Bush_Common_Flowers']},
 pebble:{cell:2,surf:{4:16,13:10,14:6,15:16,7:12,1:.8},biome:{},maxSlope:1.2,roadMin:0,buildMin:.5,waterMin:0,clump:.5,macro:null,scale:[.5,1.4],reach:.5,models:['Pebble_Round_1','Pebble_Round_2','Pebble_Round_3','Pebble_Square_1','Pebble_Square_2','Pebble_Square_3']},
 rock:{cell:5,surf:{1:.5,4:1,7:1.2,15:.8},biome:{forest:1.4},maxSlope:2,roadMin:2.5,buildMin:2,waterMin:.5,clump:.9,macro:null,scale:[.6,1.5],reach:1.2,models:['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3']},
 mushroom:{cell:3,surf:{1:.8},biome:{forest:6},maxSlope:.5,roadMin:1,buildMin:1,waterMin:1,clump:.9,macro:null,scale:[.7,1.3],reach:.5,models:['Mushroom_Common','Mushroom_Laetiporus']},
 reed:{cell:1.5,surf:{1:25,7:27},biome:{},maxSlope:.5,roadMin:.5,buildMin:1,waterMin:.5,waterBand:[.5,4],clump:.6,macro:null,scale:[.9,1.5],reach:1,models:[null]}, // code-made, only 0.5 to 4 m from water
 crop:{cell:.8,surf:{9:120},biome:{},maxSlope:.5,roadMin:.3,buildMin:.5,waterMin:0,clump:.2,macro:null,scale:[.9,1.15],reach:1,models:[null]}}); // standing wheat: code-made stalks, 1.2 per m2 (design 3.0: see report)
export const COVER_KINDS=Object.keys(COVER_RULES);
const fract=x=>x-Math.floor(x);
const sat=v=>v<0?0:v>1?1:v;
const smooth=(a,b,x)=>{const t=sat((x-a)/(b-a));return t*t*(3-2*t)};
const num=(v,d)=>Number.isFinite(v)?v:d;
export const tierOf=t=>COVER_TIERS.includes(t)?t:'low'; // junk tier = the cheapest
export const maxDensity=kind=>{const r=COVER_RULES[kind];return r?100/(r.cell*r.cell):0}; // per 100 m2 the jitter grid can hold
// Deterministic integer hash of up to four ints (+ seed): 0..1.
export function cellRand(a,b,c,d){let h=Math.imul(a|0,0x27d4eb2d)^Math.imul(b|0,0x165667b1)^Math.imul(c|0,0x85ebca6b)^Math.imul(d|0,0xc2b2ae35);h^=h>>>15;h=Math.imul(h,0x2c1b3c6d);h^=h>>>12;h=Math.imul(h,0x297a2d39);h^=h>>>15;return (h>>>0)/4294967296}
const DEF_SAMPLER={surfaceAt:()=>SURF.GRASS,slopeAt:()=>0,roadDist:()=>Infinity,buildingDist:()=>Infinity,waterDist:()=>Infinity,biomeAt:()=>'open'};
const fnOr=(f,d)=>typeof f==='function'?f:d;
// The density (per 100 m2, tier multiplier NOT applied) a kind has at a point, 0 if anything excludes it. s = a sampler (missing functions use defaults).
export function densityAt(kind,x,z,s=DEF_SAMPLER){const r=COVER_RULES[kind];if(!r||!Number.isFinite(x)||!Number.isFinite(z))return 0;
 const surf=fnOr(s&&s.surfaceAt,DEF_SAMPLER.surfaceAt)(x,z),base=r.surf[surf];if(!(base>0))return 0;
 const slope=num(fnOr(s.slopeAt,DEF_SAMPLER.slopeAt)(x,z),0);if(slope>r.maxSlope)return 0;
 const rd=fnOr(s.roadDist,DEF_SAMPLER.roadDist)(x,z);if(rd<r.roadMin)return 0;
 const bd=fnOr(s.buildingDist,DEF_SAMPLER.buildingDist)(x,z);if(bd<r.buildMin)return 0;
 const wd=fnOr(s.waterDist,DEF_SAMPLER.waterDist)(x,z);if(wd<r.waterMin)return 0;if(r.waterBand&&!(wd>=r.waterBand[0]&&wd<=r.waterBand[1]))return 0;
 const biome=fnOr(s.biomeAt,DEF_SAMPLER.biomeAt)(x,z),bm=r.biome[biome];
 let d=base*(bm===undefined?1:bm);if(r.macro)d*=smooth(r.macro[0],r.macro[1],macroAt(x,z));
 return d*(1-r.clump+r.clump*2*valueNoise(x/14+3.1,z/14+9.7))}
// Level of detail: size multiplier 0..1 and thinning fraction 0..1 for a kind at a distance from the camera (a tier's reach scaled by the kind, never past the fog). An instance is kept if its rank < lodKeep and drawn at lodScale.
export function coverReach(kind,tier){const T=COVER_TIER[tierOf(tier)],r=COVER_RULES[kind],m=r?r.reach:1;return {near:Math.min(T.near*m,COVER_FOG_CAP-8),far:Math.min(T.far*m,COVER_FOG_CAP)}}
export function lodKeep(kind,dist,tier){const R=coverReach(kind,tier);return 1-smooth(R.near,R.far,num(dist,Infinity))}
export const lodScale=(kind,dist,tier)=>Math.min(1,lodKeep(kind,dist,tier)*2);
export const lodVisible=(kind,dist,tier,rank)=>rank<lodKeep(kind,dist,tier);
// The deterministic placement for one chunk. chunkX, chunkZ = chunk indices (origin chunkX*100 unless opts.bounds {x0,z0,x1,z1} is given, as chunks.js chunkBounds). sampler = {surfaceAt(x,z), slopeAt, roadDist, buildingDist, waterDist, biomeAt}, all optional. Returns [{kind,model,variant,x,z,scale,yaw,tint:[r,g,b],rank,phase}] grouped in COVER_ORDER, at most the tier's chunkCap, identical for the same arguments. Cells are a global grid, so a neighbour chunk agrees along the border.
export function coverFor(chunkX,chunkZ,seed,sampler,opts){opts=opts||{};const tier=tierOf(opts.tier),T=COVER_TIER[tier];
 const b=opts.bounds||{x0:chunkX*COVER_CHUNK,z0:chunkZ*COVER_CHUNK,x1:(chunkX+1)*COVER_CHUNK,z1:(chunkZ+1)*COVER_CHUNK};
 if(!Number.isFinite(b.x0)||!Number.isFinite(b.z0)||!Number.isFinite(b.x1)||!Number.isFinite(b.z1)||b.x1<=b.x0||b.z1<=b.z0)return [];
 const sd=Number.isFinite(seed)?Math.floor(seed)|0:0,s=sampler||DEF_SAMPLER,groups=[];
 for(const kind of COVER_ORDER){if(!T.kinds.includes(kind))continue;const r=COVER_RULES[kind],ki=COVER_KINDS.indexOf(kind),dmax=maxDensity(kind),nv=Math.max(1,Math.min(r.models.length,T.variants)),list=[],cell=r.cell;
  const i0=Math.floor(b.x0/cell),i1=Math.ceil(b.x1/cell),j0=Math.floor(b.z0/cell),j1=Math.ceil(b.z1/cell);
  const bound=Math.max(...Object.values(r.surf))*Math.max(1,...Object.values(r.biome))*(1+r.clump)*T.density/dmax; // cheap pre-filter: most candidates stop here, before any sampler call
  for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++){const u=cellRand(i,j,ki*7+1,sd);if(u>=bound)continue;
   const x=(i+cellRand(i,j,ki*7+2,sd))*cell,z=(j+cellRand(i,j,ki*7+3,sd))*cell;if(x<b.x0||x>=b.x1||z<b.z0||z>=b.z1)continue;
   const p=densityAt(kind,x,z,s)*T.density/dmax;if(!(u<p))continue;
   const v=Math.min(nv-1,Math.floor(cellRand(i,j,ki*7+4,sd)*nv)),n=valueNoise(x/9+17.3,z/9+4.1),sc=(r.scale[0]+(r.scale[1]-r.scale[0])*cellRand(i,j,ki*7+5,sd))*(.88+.24*n),tone=groundTone(x,z,0),m=macroAt(x,z),hue=(cellRand(i,j,ki*7+6,sd)-.5)*.12;
   list.push({kind,model:r.models[v],variant:v,x,z,scale:sc,yaw:cellRand(i,j,ki*7+7,sd)*Math.PI*2,tint:[tone*(1+.08*m+hue),tone*(1+hue*.5),tone*(1-.08*m-hue)],rank:cellRand(i,j,ki*7+8,sd),phase:cellRand(i,j,ki*7+9,sd)*Math.PI*2})}
  groups.push(list)}
 let room=Math.min(T.chunkCap,Number.isFinite(opts.cap)?Math.max(0,Math.floor(opts.cap)):Infinity),out=[];
 for(const list of groups){if(room<=0)break;if(list.length<=room){for(const e of list)out.push(e);room-=list.length}else{const keep=list.slice().sort((a,c)=>a.rank-c.rank).slice(0,room);keep.sort((a,c)=>a.x-c.x||a.z-c.z);for(const e of keep)out.push(e);room=0}}
 return out}
// Cost summary of a placement: instance count per kind and the draw calls if the view makes one InstancedMesh per (kind, model) per chunk.
export function coverStats(list){const byKind={},draws=new Set();for(const e of list){byKind[e.kind]=(byKind[e.kind]||0)+1;draws.add(e.kind+'|'+e.model)}return {total:list.length,byKind,drawCalls:draws.size,kindDrawCalls:Object.keys(byKind).length}}
