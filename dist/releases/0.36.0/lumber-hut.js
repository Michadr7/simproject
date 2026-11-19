// lumber-hut.js: the yard's boards and slabs are kept ONLY in the lumber hut (map 'yard-hut'); owner 2026-11-18, prompts/opus-timber-storage.md. Pure.
// The hut prop (Hut by Quaternius, measured from props-assets.js): a deck 0.6 m high over local x -2.37..2.37, z -3.48..3.46; rails along both long sides at
// |x| 2.08..2.31 (y 1.08..1.37); corner posts at |x| 2.05..2.34, |z| 3.10..3.41; the eaves start at y 1.96 over |x| > 1.47 and rise inward. Its colliders close it,
// so the stacks are worked from outside, over the rail (like the sawmill pile). Boards lie on the east half (x > 0), slabs on the west half (x < 0), all along z.
// Stacks reuse sawmill-pile.js (pileStacks: the odd planks in slot 0, so taking a stack always lifts the top one). Caps: YARD_MAX_PLANKS / YARD_MAX_SLABS.
import {MAP} from './map-definition.js';
import {PLANKS_PER_STACK,YARD_MAX_PLANKS,YARD_MAX_SLABS} from './sawmill-yard.js';
import {PLANK_REST,PLANK_LENGTH} from './carry.js';
import {pileStacks,PLANK_WIDTH,PLANK_PITCH,SLAB_LENGTH,SLAB_WIDTH,SLAB_THICK,SLAB_PITCH} from './sawmill-pile.js';

const freeze=Object.freeze;
export const HUT=MAP.landmarks.find(l=>l.id==='yard-hut');
export const HUT_FLOOR_Y=.6,HUT_DECK=freeze({x0:-2.05,x1:2.05,z0:-3.1,z1:3.1}),HUT_EAVES_Y=1.96,HUT_REACH=2.2; // HUT_REACH: metres from the deck's edge for the E prompts
export const BOARD_HALF=freeze({x0:0,x1:2.05,z0:-3.1,z1:3.1}),SLAB_HALF=freeze({x0:-2.05,x1:0,z0:-3.1,z1:3.1});
// Boards: 4 columns x 5 rows of stacks along z (1.2 m), 2 layers = 40 stacks = YARD_MAX_PLANKS.
export const BOARD_XS=freeze([.35,.8,1.25,1.7]),BOARD_ZS=freeze([-2.44,-1.22,0,1.22,2.44]),BOARD_LAYERS=2,BOARD_LAYER_H=PLANKS_PER_STACK*PLANK_PITCH;
const BOARD_PER_LAYER=BOARD_XS.length*BOARD_ZS.length;
export const BOARD_SLOTS=BOARD_PER_LAYER*BOARD_LAYERS; // 40
export function boardSlot(i){
 if(!Number.isInteger(i)||i<0||i>=BOARD_SLOTS)return null;
 const layer=Math.floor(i/BOARD_PER_LAYER),j=i%BOARD_PER_LAYER;
 return freeze({x:BOARD_XS[j%BOARD_XS.length],y:HUT_FLOOR_Y+layer*BOARD_LAYER_H,z:BOARD_ZS[Math.floor(j/BOARD_XS.length)],rot:Math.PI/2,layer});
}
export const hutStacks=planks=>pileStacks(planks,boardSlot,BOARD_SLOTS);
export const hutPlanks=planks=>hutStacks(planks).flatMap(s=>Array.from({length:s.count},(_,k)=>({x:s.x,y:s.y+PLANK_REST+k*PLANK_PITCH,z:s.z,rot:s.rot,k})));
export const hutTopStack=planks=>{const s=hutStacks(planks);return s.length?s[s.length-1]:null};
export const boardRect=s=>({x0:s.x-PLANK_WIDTH/2,x1:s.x+PLANK_WIDTH/2,z0:s.z-PLANK_LENGTH/2,z1:s.z+PLANK_LENGTH/2});
// Slabs: flat, along z, 4 columns x 2 rows a layer, 10 layers = 80 = YARD_MAX_SLABS.
export const SLAB_XS=freeze([-.35,-.77,-1.19,-1.61]),SLAB_ZS=freeze([-1.25,1.25]),SLAB_LAYERS_HUT=10;
const SLAB_PER_LAYER=SLAB_XS.length*SLAB_ZS.length;
export const HUT_SLAB_SLOTS=SLAB_PER_LAYER*SLAB_LAYERS_HUT; // 80
export function hutSlabSlot(i){
 if(!Number.isInteger(i)||i<0||i>=HUT_SLAB_SLOTS)return null;
 const layer=Math.floor(i/SLAB_PER_LAYER),j=i%SLAB_PER_LAYER;
 return freeze({x:SLAB_XS[j%SLAB_XS.length],y:HUT_FLOOR_Y+SLAB_THICK/2+layer*SLAB_PITCH,z:SLAB_ZS[Math.floor(j/SLAB_XS.length)],layer}); // y: the slab's middle
}
export const hutSlabs=n=>Array.from({length:Number.isFinite(n)?Math.max(0,Math.min(HUT_SLAB_SLOTS,Math.floor(n))):0},(_,i)=>hutSlabSlot(i));
export const slabRect=s=>({x0:s.x-SLAB_WIDTH/2,x1:s.x+SLAB_WIDTH/2,z0:s.z-SLAB_LENGTH/2,z1:s.z+SLAB_LENGTH/2});

// Hut-local (x, z) -> world, the way props are placed (rotation.y = yaw, quarter turns; the same as sawmill.js anchorWorld).
export function hutWorld(lx,lz,hut=HUT){const c=Math.round(Math.cos(hut.yaw)),s=Math.round(Math.sin(hut.yaw));return {x:hut.x+lx*c+lz*s,z:hut.z-lx*s+lz*c}}
// A hut-local rectangle -> a world box {x,z,hx,hz}.
export function hutRect(r,hut=HUT){const a=hutWorld(r.x0,r.z0,hut),b=hutWorld(r.x1,r.z1,hut),x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),z0=Math.min(a.z,b.z),z1=Math.max(a.z,b.z);return {x:(x0+x1)/2,z:(z0+z1)/2,hx:(x1-x0)/2,hz:(z1-z0)/2}}
// The prompt point for a player at (px, pz): the nearest spot of the box (world). null for a missing box.
export const nearestOn=(b,px,pz)=>b?{x:Math.max(b.x-b.hx,Math.min(b.x+b.hx,px)),z:Math.max(b.z-b.hz,Math.min(b.z+b.hz,pz))}:null;
export const nearHut=(px,pz,reach=HUT_REACH)=>{const p=nearestOn(hutRect(HUT_DECK),px,pz);return Math.hypot(p.x-px,p.z-pz)<=reach};

// The timber yard (the sawmill, its log and trunk decks and the hut): boards and slabs are not put down on the ground here, they go into the hut (owner 2026-11-18).
export const TIMBER_YARD=freeze({x0:92,x1:136,z0:-292,z1:-264});
export const inTimberYard=(x,z)=>x>=TIMBER_YARD.x0&&x<=TIMBER_YARD.x1&&z>=TIMBER_YARD.z0&&z<=TIMBER_YARD.z1;
// X with boards or a slab in the hands: 'store' (at the hut), 'refuse' (elsewhere in the timber yard: carry them to the hut), 'ground' (anywhere else, as before).
export function putDownRule(kind,x,z){
 if(kind!=='planks'&&kind!=='slab')return 'ground';
 if(nearHut(x,z))return 'store';
 return inTimberYard(x,z)?'refuse':'ground';
}
export const HUT_CAPS=freeze({planks:YARD_MAX_PLANKS,slabs:YARD_MAX_SLABS});
