// sawmill-pile.js: where the yard's plank stacks and waiting logs lie in the sawmill shed (model coords, deterministic). Pure. Owner request 2026-11-17.
// Model coordinates of the rigged sawmill (assets-src/assets/sawmill_spec.md): main deck x -4.3..4.3, z -3.3..3.3, top y 0.3; the bench is z -0.6..0.6, the feed rails z +-0.95,
// the posts x -4/0/4 at z +-3, the lowest beam over the deck y 2.38. The plank pile fills the deck's back strip (between the rails and the back posts, open to the yard);
// the waiting logs lie on the ground at the feed end (x < -4.3), beside the bench. A stack is PLANKS_PER_STACK planks; layers cross like a real lumber pile.
import {PLANKS_PER_STACK,YARD_MAX_PLANKS,YARD_MAX_LOGS,YARD_MAX_TRUNKS,YARD_MAX_SLABS} from './sawmill-yard.js';
import {PLANK_REST,PLANK_LENGTH} from './carry.js';

export const PLANK_WIDTH=.45,PLANK_PITCH=.12; // a sawmill plank is 1.2 x 0.45 m; planks in a stack are 0.12 m apart (carry.js, sawmill.js)
export const DECK_Y=.3,LAYER_H=PLANKS_PER_STACK*PLANK_PITCH; // a layer of stacks is 0.48 m tall
export const PILE_BOX=Object.freeze({x0:-3.725,x1:3.725,z0:-2.775,z1:-1.125}); // the floor area the pile may use (clear of the rails, the bench, the posts and the deck edge)
export const ROOF_CLEAR=2.38; // the lowest beam above the deck; nothing in the pile reaches it
// Layer 0: planks along x, 6 columns x 3 rows. Layer 1: planks along z, 15 columns, crossing every stack below. Layer 2: along x again, 6 x 2, inside layer 1's span (no overhang).
const A_X=[3.125,1.875,.625,-.625,-1.875,-3.125];
const LAYERS=[{rot:0,xs:A_X,zs:[-2.55,-1.95,-1.35]},{rot:Math.PI/2,xs:Array.from({length:15},(_,i)=>3.5-i*.5),zs:[-1.95]},{rot:0,xs:A_X,zs:[-2.25,-1.65]}];
export const PILE_LAYERS=LAYERS.length,LAYER_SLOTS=LAYERS.map(l=>l.xs.length*l.zs.length); // 18, 15, 12
export const PILE_SLOTS=LAYER_SLOTS.reduce((a,b)=>a+b,0); // 45 stacks = 180 planks of room
export const PILE_STACKS_NEEDED=Math.ceil(YARD_MAX_PLANKS/PLANKS_PER_STACK); // 40 at the 160-plank cap

const int=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
// Slot i (0 = first laid: bottom layer, at the belt end): {x,y,z,rot,layer}; y is the floor the stack stands on; rot 0 = planks along x, PI/2 = along z. Null past PILE_SLOTS.
export function pileSlot(i){
 if(!Number.isInteger(i)||i<0||i>=PILE_SLOTS)return null;
 let layer=0,j=i;while(j>=LAYER_SLOTS[layer]){j-=LAYER_SLOTS[layer];layer++}
 const L=LAYERS[layer],rows=L.zs.length;
 return Object.freeze({x:L.xs[Math.floor(j/rows)],y:DECK_Y+layer*LAYER_H,z:L.zs[j%rows],rot:L.rot,layer});
}
// The floor rectangle a stack covers.
export function slotRect(s){const hx=s.rot?PLANK_WIDTH/2:PLANK_LENGTH/2,hz=s.rot?PLANK_LENGTH/2:PLANK_WIDTH/2;return {x0:s.x-hx,x1:s.x+hx,z0:s.z-hz,z1:s.z+hz}}
// planks -> the stacks to draw: every full stack, plus the odd planks (planks % 4) as a short stack in slot 0 (under the pile), so taking a stack always lifts the TOP one off.
export function pileStacks(planks){
 const p=int(planks,PILE_SLOTS*PLANKS_PER_STACK),full=Math.floor(p/PLANKS_PER_STACK),odd=p%PLANKS_PER_STACK,n=full+(odd?1:0),out=[];
 for(let i=0;i<n;i++)out.push(Object.freeze({...pileSlot(i),slot:i,count:i===0&&odd?odd:PLANKS_PER_STACK}));
 return out;
}
// Every plank as {x,y,z,rot,k} (k: 0 = bottom plank of its stack; y = the plank's centre), in the order the stacks were laid.
export function pilePlanks(planks){const out=[];for(const s of pileStacks(planks))for(let k=0;k<s.count;k++)out.push({x:s.x,y:s.y+PLANK_REST+k*PLANK_PITCH,z:s.z,rot:s.rot,k});return out}
// The top stack (the one a player takes) and the floor rectangle of everything on the pile; null when empty.
export const topStack=planks=>{const s=pileStacks(planks);return s.length?s[s.length-1]:null};
const union=rects=>rects.length?rects.reduce((a,r)=>({x0:Math.min(a.x0,r.x0),x1:Math.max(a.x1,r.x1),z0:Math.min(a.z0,r.z0),z1:Math.max(a.z1,r.z1)})):null;
export const pileBounds=planks=>union(pileStacks(planks).map(slotRect));

// Waiting logs (the carried log: 1.15 m long, 0.24 m across): along x at the feed end, nested rows of 12, 11, 10, 9 (a log deck), on the ground (y 0).
export const LOG_LENGTH=1.15,LOG_RADIUS=.12,LOG_PITCH=.25,LOG_X=-5.05,LOG_Z0=-.4,LOG_ROWS=[12,11,10,9];
export const LOG_SLOTS=LOG_ROWS.reduce((a,b)=>a+b,0); // 42
const LOG_RISE=LOG_PITCH*Math.sqrt(3)/2; // a nested row sits in the grooves of the row below
// Log slot i: {x,y,z,layer} (y = the log's axis). Null past LOG_SLOTS.
export function logSlot(i){
 if(!Number.isInteger(i)||i<0||i>=LOG_SLOTS)return null;
 let layer=0,j=i;while(j>=LOG_ROWS[layer]){j-=LOG_ROWS[layer];layer++}
 return Object.freeze({x:LOG_X,y:LOG_RADIUS+layer*LOG_RISE,z:LOG_Z0-layer*LOG_PITCH/2-j*LOG_PITCH,layer});
}
export const logPile=logs=>Array.from({length:int(logs,LOG_SLOTS)},(_,i)=>logSlot(i));
export const logBounds=logs=>union(logPile(logs).map(s=>({x0:s.x-LOG_LENGTH/2,x1:s.x+LOG_LENGTH/2,z0:s.z-LOG_RADIUS,z1:s.z+LOG_RADIUS})));
export const LOGS_NEEDED=YARD_MAX_LOGS; // 40

// Timber redesign T-B (owner 2026-11-18: boards keep the whole deck strip; trunks and slabs go on the ground at the feed end, west of the log deck, clear of the switch at (-4, 3.9)).
// Waiting trunks (2.25 m long, 0.35 m across): along x at x -6.8, nested rows of 6, 5, 5, 4 from z -0.4 southward (the log deck's side), on the ground.
export const TRUNK_LENGTH=2.25,TRUNK_RADIUS=.175,TRUNK_PITCH=.4,TRUNK_X=-6.8,TRUNK_Z0=-.4,TRUNK_ROWS=[6,5,5,4];
export const TRUNK_SLOTS=TRUNK_ROWS.reduce((a,b)=>a+b,0); // 20 = YARD_MAX_TRUNKS
const TRUNK_RISE=TRUNK_PITCH*Math.sqrt(3)/2;
export function trunkSlot(i){
 if(!Number.isInteger(i)||i<0||i>=TRUNK_SLOTS)return null;
 let layer=0,j=i;while(j>=TRUNK_ROWS[layer]){j-=TRUNK_ROWS[layer];layer++}
 return Object.freeze({x:TRUNK_X,y:TRUNK_RADIUS+layer*TRUNK_RISE,z:TRUNK_Z0-layer*TRUNK_PITCH/2-j*TRUNK_PITCH,layer});
}
export const trunkPile=trunks=>Array.from({length:int(trunks,TRUNK_SLOTS)},(_,i)=>trunkSlot(i));
export const trunkBounds=trunks=>union(trunkPile(trunks).map(s=>({x0:s.x-TRUNK_LENGTH/2,x1:s.x+TRUNK_LENGTH/2,z0:s.z-TRUNK_RADIUS,z1:s.z+TRUNK_RADIUS})));
// Slabs (2.25 m long, 0.36 m wide, 0.06 m thick) lie flat in 6 columns along x at x -6.2, z 0.6..2.6 (the north side of the log deck), stacked up to 14 high (0.07 m pitch).
export const SLAB_LENGTH=2.25,SLAB_WIDTH=.36,SLAB_THICK=.06,SLAB_PITCH=.07,SLAB_X=-6.2,SLAB_Z0=.6,SLAB_COLS=6,SLAB_COL_PITCH=.4,SLAB_LAYERS=14;
export const SLAB_SLOTS=SLAB_COLS*SLAB_LAYERS; // 84 >= YARD_MAX_SLABS (80)
export function slabSlot(i){
 if(!Number.isInteger(i)||i<0||i>=SLAB_SLOTS)return null;
 const layer=Math.floor(i/SLAB_COLS),j=i%SLAB_COLS;
 return Object.freeze({x:SLAB_X,y:SLAB_THICK/2+layer*SLAB_PITCH,z:SLAB_Z0+j*SLAB_COL_PITCH,layer});
}
export const slabPile=slabs=>Array.from({length:int(slabs,SLAB_SLOTS)},(_,i)=>slabSlot(i));
export const slabBounds=slabs=>union(slabPile(slabs).map(s=>({x0:s.x-SLAB_LENGTH/2,x1:s.x+SLAB_LENGTH/2,z0:s.z-SLAB_WIDTH/2,z1:s.z+SLAB_WIDTH/2})));