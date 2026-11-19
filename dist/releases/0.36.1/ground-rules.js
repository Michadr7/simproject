// GD1 (notes/ground-detail-design.md section 1a): the numbers of the ground shader and a JS mirror of its noise (pure; tests use it, the shader is built from the same constants).
export const GROUND_KINDS=['grass','farm','forest','dirt','mud','field','plowed','wheat','green','paving','valley']; // one shader program per kind (the design said at most 10; GD2 added 'valley' = 11, see the GD2 report)
export const DRY_KINDS=['grass','farm','valley']; // only these lean toward the dry tint (the valley's lip is grass colour and must match the planes beside it)
// GD2 soft borders (design 1b): the band lies INSIDE the rectangle (the 0.5 m surface mask in terrain.js stays the truth). w = ramp width in metres, j = how far the ragged noise can pull the edge in.
export const GD_EDGE={mud:{w:1.6,j:1.2},field:{w:.8,j:.5},plowed:{w:.8,j:.5},wheat:{w:.8,j:.5},green:{w:.8,j:.5},farm:{w:4,j:3},forest:{w:4,j:3}};
export const GD_EDGE_SCALE=1/3, GD_EDGE_CLOD_SCALE=1.7; // ragged-edge noise (cycles per metre), clod height noise (about 0.6 m clods)
export const GD_BLEND_DEPTH=.2, GD_EDGE_LOW_H=.5; // Mishkinis depth window; the height the plane below (grass) is given
export const GD_MUD_RIM_DARK=.72; // the wet rim: mud albedo multiplier at the very edge, fading to 1 across the soft band
export const GD_SEED_EDGE=[61.7,23.3], GD_SEED_CLOD=[3.9,87.1];
export const edgeOf=kind=>GD_EDGE[kind]||null;
export const GD_MACRO_SCALE=1/38; // large patches of lighter/darker, drier/greener (cycles per metre)
export const GD_MESO_SCALE=1/6; // smaller clumps
export const GD_DARK=.82, GD_LIGHT=1.12; // macro multiplier range on the albedo
export const GD_MESO_DARK=.92, GD_MESO_LIGHT=1.07; // clump multiplier range (low contrast; fades with distance)
export const GD_DRY_TINT='#a39a62', GD_DRY_AMOUNT=.25; // hue nudge toward dry grass by macro
export const GD_DETAIL_NEAR=25, GD_DETAIL_FAR=60; // metres: clump contrast fades to the plain macro colour between these (stops shimmer; fog takes over at 65 m)
export const GD_NOTILE_SCALE=1/23; // low-frequency noise that blends the two texture reads
export const GD_NOTILE_LO=.35, GD_NOTILE_HI=.65; // smoothstep window of that blend
export const GD_NOTILE_ZOOM=1.13, GD_NOTILE_ROT=.9, GD_NOTILE_OFFSET=[.37,.61]; // the second read: rotated, slightly zoomed and shifted, so the two tilings never line up
export const GD_SEED_MACRO=[11.3,47.9], GD_SEED_MESO=[73.1,5.7], GD_SEED_NOTILE=[29.7,91.3]; // noise offsets so the three noises differ
export const hexToLinear=hex=>{const n=parseInt(hex.slice(1),16),f=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};return [f(n>>16&255),f(n>>8&255),f(n&255)]};
const fract=x=>x-Math.floor(x);
// Hoskins hash12 (no sin), the same arithmetic as the shader.
export function hash2(x,y){let a=fract(x*.1031),b=fract(y*.1031),c=fract(x*.1031);const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);a+=d;b+=d;c+=d;return fract((a+b)*c)}
const smooth=t=>t*t*(3-2*t);
export function valueNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
 const a=hash2(ix,iy),b=hash2(ix+1,iy),c=hash2(ix,iy+1),d=hash2(ix+1,iy+1);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy}
export const macroAt=(x,z)=>valueNoise(x*GD_MACRO_SCALE+GD_SEED_MACRO[0],z*GD_MACRO_SCALE+GD_SEED_MACRO[1]);
export const mesoAt=(x,z)=>valueNoise(x*GD_MESO_SCALE+GD_SEED_MESO[0],z*GD_MESO_SCALE+GD_SEED_MESO[1]);
export const notileAt=(x,z)=>valueNoise(x*GD_NOTILE_SCALE+GD_SEED_NOTILE[0],z*GD_NOTILE_SCALE+GD_SEED_NOTILE[1]);
const mix=(a,b,t)=>a+(b-a)*t;
// The colour multiplier at a world point and a distance from the camera: macro always, clumps fading out between NEAR and FAR.
export function groundTone(x,z,dist=0){const detail=1-Math.min(1,Math.max(0,(dist-GD_DETAIL_NEAR)/(GD_DETAIL_FAR-GD_DETAIL_NEAR)));
 return mix(GD_DARK,GD_LIGHT,macroAt(x,z))*mix(1,mix(GD_MESO_DARK,GD_MESO_LIGHT,mesoAt(x,z)),detail)}
const bayer4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export const bayerAt=(px,py)=>(bayer4[(Math.floor(px)&3)+(Math.floor(py)&3)*4]+.5)/16; // the same 4x4 matrix as the shader
// GD2: how much of the upper plane survives at a point (JS mirror of the shader). d = metres inside the rectangle's edge (negative outside), x,z = world point. Returns {m: soft mask 0..1, cover: 0..1 chance the fragment is kept}.
export function edgeCover(kind,d,x,z){const e=GD_EDGE[kind];if(!e)return {m:1,cover:1};
 const jit=valueNoise(x*GD_EDGE_SCALE+GD_SEED_EDGE[0],z*GD_EDGE_SCALE+GD_SEED_EDGE[1]),t=Math.min(1,Math.max(0,(d-jit*e.j)/e.w)),m=t*t*(3-2*t);
 const h=valueNoise(x*GD_EDGE_CLOD_SCALE+GD_SEED_CLOD[0],z*GD_EDGE_CLOD_SCALE+GD_SEED_CLOD[1]),a=m+h,b=1-m+GD_EDGE_LOW_H,top=Math.max(a,b)-GD_BLEND_DEPTH,wu=Math.max(a-top,0),wl=Math.max(b-top,0);
 return {m,cover:wu/(wu+wl)}}

// GD3 per-surface detail and wet mud (design 1c, 1d). All heights are metres; all cells metres. JS mirrors below use the same arithmetic as the shader (tests use them).
export const GD_NORMAL=.5, GD_NORMAL_NEAR=15, GD_NORMAL_FAR=40; // bump strength; the fake normals fade out between these distances (High only; colour detail fades at GD_DETAIL_NEAR..FAR)
export const GD_SEED_DETAIL=[17.3,59.1], GD_SEED_PEBBLE=[5.7,31.1], GD_SEED_CRACK=[43.9,7.3], GD_SEED_PUDDLE=[91.7,13.9], GD_SEED_PUDDLE2=[27.1,66.3], GD_SEED_CLUMP=[3.3,52.7];
// dirt and path: pebbles (a jittered dome in each cell, radius as a share of the cell) and dry cracks
export const GD_PEBBLE_CELL=.28, GD_PEBBLE_FILL=.12, GD_PEBBLE_R=[.12,.3], GD_PEBBLE_H=.05, GD_PEBBLE_TOP=.3, GD_PEBBLE_RIM=.8; // FILL = share of the ground covered by pebbles
export const GD_CRACK=.5, GD_CRACK_CELL=1.4, GD_CRACK_W=.03, GD_CRACK_WARP=.35, GD_CRACK_MASK_SCALE=1/9, GD_CRACK_COVER=.45, GD_CRACK_H=.015; // CRACK = how dark the cracks are (0..1); cracks only where a low noise is above COVER
// gravel roads (R3a: same 'dirt' program, chosen by the per-material uniform uGdGravel): dense pebbles, two greys and a brown
export const GD_GRAVEL_CELL=.16, GD_GRAVEL_FILL=.6, GD_GRAVEL_R=[.37,.5], GD_GRAVEL_H=.04, GD_GRAVEL_GAP=.78;
export const GD_GRAVEL_TINTS=[[.82,.82,.84],[1.1,1.09,1.05],[.86,.74,.58]]; // multipliers on the gravel colour (grey, light grey, brown)
export const pebbleOccupancy=(fill,r)=>Math.min(1,fill/(Math.PI*(r[0]*r[0]+r[0]*r[1]+r[1]*r[1])/3)); // chance a cell holds a pebble, from the wanted coverage
export const GD_PEBBLE_OCC=pebbleOccupancy(GD_PEBBLE_FILL,GD_PEBBLE_R), GD_GRAVEL_OCC=pebbleOccupancy(GD_GRAVEL_FILL,GD_GRAVEL_R);
// forest litter
export const GD_LITTER=.35, GD_LITTER_CELL=.35, GD_LITTER_COLORS=['#7b603c','#5d6a33','#8a5a2e'], GD_LITTER_MIX=.55, GD_LITTER_H=.02;
// grass and farm: darker clumps and light flecks (flecks High only)
export const GD_CLUMP_CELL=.7, GD_CLUMP_DARK=.9, GD_FLECK_CELL=.25, GD_FLECK_FILL=.18, GD_FLECK_GAIN=1.12, GD_GRASS_H=.012;
// plowed: furrows run along x (as the canvas stripes do); the texture period is 16 px of 256 over 6 m
export const GD_FURROW_PERIOD=.375, GD_FURROW_AMP=.35, GD_FURROW_H=.07, GD_CLOD_CELL=.22, GD_CLOD_H=.04;
// pavement: colour jitter per slab and a faint dirty seam
export const GD_SLAB=2, GD_SLAB_JITTER=.06, GD_SLAB_EDGE=.05, GD_SLAB_EDGE_DARK=.88;
// wet mud and puddles (puddles ONLY in mud patches and ruts: user decision). GD_WET_DEFAULT is the dormant env.wet hook (shared uniform uGdWet, 0..1; rain later sets it, setGroundWet in ground-shader.js)
export const GD_WET_DEFAULT=1, GD_MUD_WET=.85, GD_WET_DARK=.62, GD_WET_ROUGH=.35, GD_PUDDLE_ROUGH=.06, GD_PUDDLE_DARK=.5;
export const GD_PUDDLE_LEVEL=.32, GD_PUDDLE_SOFT=.03, GD_PUDDLE_SCALE=1/2.4, GD_PUDDLE_SCALE2=1/.9, GD_PUDDLE_MIX2=.3; // a low-frequency noise is the fake height; below the level (x wet) it is a puddle
export const GD_MUD_RIDGE=.45, GD_MUD_RIDGE_CELL=.4, GD_MUD_CLOD_SCALE=1/.3, GD_MUD_H=.05;
export const GD_F0=.02, GD_SHEEN_GAIN=1.6, GD_SKY_GAMMA=2.2; // puddle sky sheen: Schlick fresnel x the shared sky horizon colour (display-space colour, so lifted by the gamma)
export const GD_DETAIL_KINDS=['grass','farm','forest','dirt','mud','plowed','paving','valley']; // kinds with their own detail code (the others only get GD1/GD2; RV1: the valley has the grass clumps and flecks, so the dug river ground matches the grass beside it)
// JS mirrors
export function pebbleAt(x,z,cell=GD_PEBBLE_CELL,occ=GD_PEBBLE_OCC,r=GD_PEBBLE_R){const px=x/cell+GD_SEED_PEBBLE[0],pz=z/cell+GD_SEED_PEBBLE[1],ix=Math.floor(px),iz=Math.floor(pz),fx=px-ix,fz=pz-iz,h0=hash2(ix,iz);
 if(h0>=occ)return {h:0,id:0};const rr=mix(r[0],r[1],hash2(ix+5.3,iz+5.3)),cx=rr+(1-2*rr)*hash2(ix+17.1,iz+17.1),cz=rr+(1-2*rr)*hash2(ix+43.7,iz+43.7),d=Math.hypot(fx-cx,fz-cz)/rr;
 return d<1?{h:Math.sqrt(1-d*d),id:h0/occ}:{h:0,id:0}}
export const puddleAt=(x,z)=>valueNoise(x*GD_PUDDLE_SCALE+GD_SEED_PUDDLE[0],z*GD_PUDDLE_SCALE+GD_SEED_PUDDLE[1])*(1-GD_PUDDLE_MIX2)+valueNoise(x*GD_PUDDLE_SCALE2+GD_SEED_PUDDLE2[0],z*GD_PUDDLE_SCALE2+GD_SEED_PUDDLE2[1])*GD_PUDDLE_MIX2; // the fake height of the mud (low = puddle)
export function puddleMask(low,wet=GD_WET_DEFAULT){const l=GD_PUDDLE_LEVEL*wet,t=Math.min(1,Math.max(0,(low-(l-GD_PUDDLE_SOFT))/(2*GD_PUDDLE_SOFT)));return 1-t*t*(3-2*t)}
export const schlick=cos=>GD_F0+(1-GD_F0)*Math.pow(1-Math.min(1,Math.max(0,cos)),5); // 1 = looking along the surface
export const furrowAt=z=>Math.sin(z*2*Math.PI/GD_FURROW_PERIOD); // -1 trough .. 1 crest
export const slabTone=(x,z)=>1+(hash2(Math.floor(x/GD_SLAB)+GD_SEED_DETAIL[0],Math.floor(z/GD_SLAB)+GD_SEED_DETAIL[1])-.5)*2*GD_SLAB_JITTER;