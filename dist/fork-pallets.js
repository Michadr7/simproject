// What the forklift's forks can touch (DESIGN 4.16 I, step 2: physical forks, no E shortcut). Pure: forklift.js drives, this module says what is in the way and what a pallet rests on.
// Room-local metres like the rest of the warehouse. A pallet is 1.04 across by 1.24 along its axis, 0.14 high, and its planks lie on top of it (pallets.js PALLET). Its axis is the way the forks go in:
// a rack pallet's axis is the room's z axis, a floor pallet's is its own yaw. Either end is a mouth.
//   - The tines are two blades 0.22 m either side of the middle, 5 cm thick (TINE); `lift` is the top of them. They are inside a pallet's pocket when the forklift is square to the pallet (8 degrees),
//     its middle is within 8 cm of the pallet's, and the tine tops are 5 to 16 cm above the pallet's base (POCKET). Anywhere else the pallet is solid to the tines: the forklift stops.
//   - Tines in a shelf cell must be square to the shelf, clear of the uprights and under the beam of the level they are at (LANE).
//   - With the tines in the pocket at least 45 cm and the forks raised to 14 cm above the pallet's base, the pallet lifts; it rides 9 cm above the tine tops' resting point (CARRY_DROP) in front of the carriage.
//   - A carried pallet that is lowered until its base meets what is under it (a shelf deck, the floor, an order's staging square) is set down there.
import {toWorld,tipOf,TIP,FORK_POINTS,LIFT_MIN,LIFT_MAX} from './forklift.js';
import {RACK_SLOTS,LEVEL_Y,UNITS,BAYS,BAY_PITCH,WAREHOUSE_STAGING} from './warehouse-layout.js';
import {PALLET} from './pallets.js';

export const POCKET=Object.freeze({lo:.05,hi:.16,liftAt:.14,lateral:.08,yaw:.14,engage:.45}); // tine top above the pallet's base; liftAt: where a pallet comes off the ground; yaw: 8 degrees
export const TINE=Object.freeze({x:.22,t:.05});
export const CARRY_Z=.8+PALLET.d/2,CARRY_DROP=.09; // the middle of a carried pallet ahead of the body's middle; its base is this far below the tine tops
export const LANE=Object.freeze({above:.05,height:1.2,post:.13,yaw:.14}); // tines in a shelf cell: at least 5 cm above the deck, at most 1.2 m (the beam is 1.35 m up), 13 cm from an upright, 8 degrees square
export const SNAP=Object.freeze({along:.15,across:.15,yaw:.14}); // a carried pallet within this of a cell sets down square in it
export const STAGING_BOX=Object.freeze({hx:.7,hz:.625,top:.14}); // an order's staging square (warehouse.js: a 1.4 x 1.25 pallet, .14 high)
export const levelBase=level=>level===1?0:LEVEL_Y[level-1]; // the base of a pallet in a cell of this level (on the floor, or on the shelf deck)
export const planksHeight=count=>Math.ceil(Math.max(0,count)/4)*.092; // forty planks lie ten high
export const heightOf=count=>PALLET.h+planksHeight(count);
const CELLS=new Map(RACK_SLOTS.map(s=>[s.id,s]));
const HALF_X=BAYS*BAY_PITCH/2,POSTS=[...Array(BAYS+1).keys()].map(k=>-HALF_X+k*BAY_PITCH);
const fwd=yaw=>({x:Math.sin(yaw),z:Math.cos(yaw)}),across=yaw=>({x:Math.cos(yaw),z:-Math.sin(yaw)});
// the angle between two axes, folded into -90..90 degrees (a pallet can be entered from either end)
export const axisError=(a,b)=>{let e=((a-b)%Math.PI+Math.PI)%Math.PI;return e>Math.PI/2?e-Math.PI:e};

// the pallets in the room as boxes: {id, kind:'rack'|'floor', slot?, x, z, yaw, base, count}
export function boxesOf(list){
 const out=[];
 for(const p of list){
  if(p.at.rack){const s=CELLS.get(p.at.rack);if(s)out.push({id:p.id,kind:'rack',slot:s.id,x:s.x,z:s.z,yaw:0,base:levelBase(s.level),count:p.count})}
  else if(p.at.floor)out.push({id:p.id,kind:'floor',x:p.at.floor.x,z:p.at.floor.z,yaw:p.at.floor.yaw,base:0,count:p.count});
 }
 return out;
}
const local=(b,x,z)=>{const a=fwd(b.yaw),r=across(b.yaw),dx=x-b.x,dz=z-b.z;return {u:dx*r.x+dz*r.z,v:dx*a.x+dz*a.z}}; // a point in the pallet's own frame: u across, v along its axis
const inFootprint=(b,x,z,pad=.03)=>{const {u,v}=local(b,x,z);return Math.abs(u)<=PALLET.w/2+pad&&Math.abs(v)<=PALLET.d/2+pad};
const tinePoints=s=>[[-TINE.x,TIP],[TINE.x,TIP],[-TINE.x,1.2],[TINE.x,1.2]].map(([x,z])=>toWorld(s,x,z));
const carriagePoints=s=>[[-.32,.8],[.32,.8]].map(([x,z])=>toWorld(s,x,z));

// What one pallet does to the forks: 'clear' (not touching, or the tines pass over or under it), 'pocket' (the tines are in the pocket: {depth, aligned}) or 'blocked' ({reason}).
export function probe(s,b){
 const pts=[...tinePoints(s),...carriagePoints(s)].filter(w=>inFootprint(b,w.x,w.z));
 if(!pts.length)return {state:'clear'};
 const top=b.base+heightOf(b.count),tineBottom=s.lift-TINE.t;
 if(tineBottom>=top||s.lift<=b.base)return {state:'clear'}; // over the planks, or under the pallet
 const f=fwd(s.yaw),a=fwd(b.yaw),sign=Math.sign(f.x*a.x+f.z*a.z)||1,tip=tipOf(s),{u,v}=local(b,tip.x,tip.z);
 const depth=sign*v+PALLET.d/2,err=axisError(s.yaw,b.yaw),aligned=Math.abs(u)<=POCKET.lateral&&Math.abs(err)<=POCKET.yaw,rel=s.lift-b.base;
 if(carriagePoints(s).some(w=>inFootprint(b,w.x,w.z,0)))return {state:'blocked',reason:'The forks are all the way in.',depth,aligned};
 if(aligned&&rel>=POCKET.lo&&rel<=POCKET.hi)return {state:'pocket',depth,aligned,box:b};
 return {state:'blocked',reason:!aligned?'Line up with the pallet.':rel>POCKET.hi?'Forks too high for the pallet.':'Forks too low for the pallet.',depth,aligned};
}
// the pallet the tines are in far enough to lift, or null
export function engagedBox(s,boxes){
 let best=null;for(const b of boxes){if(Math.hypot(b.x-s.x,b.z-s.z)>3.2)continue;const p=probe(s,b);if(p.state==='pocket'&&p.depth>=POCKET.engage&&(!best||p.depth>best.depth))best={box:b,depth:p.depth}}
 return best?best.box:null;
}

// rectangle overlap (separating axes): two pallet footprints, each {x, z, yaw}, grown by `pad`
function rectsOverlap(a,b,pad=0){
 const ha={u:PALLET.w/2+pad,v:PALLET.d/2+pad},hb={u:PALLET.w/2+pad,v:PALLET.d/2+pad};
 for(const base of [a,b])for(const dir of [across(base.yaw),fwd(base.yaw)]){
  const proj=(r,h)=>{const ru=across(r.yaw),rv=fwd(r.yaw);return Math.abs(ru.x*dir.x+ru.z*dir.z)*h.u+Math.abs(rv.x*dir.x+rv.z*dir.z)*h.v};
  if(Math.abs((b.x-a.x)*dir.x+(b.z-a.z)*dir.z)>proj(a,ha)+proj(b,hb))return false;
 }
 return true;
}
export const carriedBox=(s,count)=>{const c=toWorld(s,0,CARRY_Z);return {x:c.x,z:c.z,yaw:s.yaw,base:s.lift-CARRY_DROP,count}};
const corners=b=>{const a=fwd(b.yaw),r=across(b.yaw),hu=PALLET.w/2,hv=PALLET.d/2;return [[-1,-1],[1,-1],[-1,1],[1,1],[0,1]].map(([su,sv])=>({x:b.x+r.x*su*hu+a.x*sv*hv,z:b.z+r.z*su*hu+a.z*sv*hv}))};

// the shelving unit a point is inside (its exact outline), or null
export const unitAt=(x,z,pad=.02)=>UNITS.find(u=>Math.abs(x)<=HALF_X+pad&&Math.abs(z-u.z)<=u.depth/2+pad)||null;
const levelAt=lift=>{for(let l=1;l<=3;l++){const b=levelBase(l);if(lift>=b+LANE.above&&lift<=b+LANE.height)return l}return 0};
// can a point of the forks (or of a carried pallet) be inside a shelving unit at this fork height and heading? Square to the shelf, off the uprights, at a level's height.
export function laneOk(s,w){
 if(Math.abs(axisError(s.yaw,0))>LANE.yaw)return false;
 if(POSTS.some(p=>Math.abs(w.x-p)<LANE.post))return false;
 return levelAt(s.lift)>0;
}

// Everything the forks may not be in: ctx = {boxes, blockedOther(x, z) (walls, tables and the like: not shelving, staging squares or floor pallets), carried (planks on the forks, or 0)}
export function forksClear(s,ctx){
 const pts=[...FORK_POINTS.map(p=>toWorld(s,p.x,p.z))];
 if(ctx.carried>0)pts.push(...corners(carriedBox(s,ctx.carried)));
 for(const w of pts){
  if(ctx.blockedOther(w.x,w.z))return false;
  if(unitAt(w.x,w.z)&&!laneOk(s,w))return false;
 }
 if(ctx.carried>0){
  const c=carriedBox(s,ctx.carried),top=c.base+heightOf(ctx.carried);
  for(const b of ctx.boxes){if(Math.hypot(b.x-c.x,b.z-c.z)>2.2)continue;if(c.base<b.base+heightOf(b.count)-.01&&top>b.base+.01&&rectsOverlap(c,b))return false}
  return true;
 }
 for(const b of ctx.boxes){if(Math.hypot(b.x-s.x,b.z-s.z)>3.6)continue;if(probe(s,b).state==='blocked')return false}
 return true;
}

// What a carried pallet is over and rests on: {kind:'rack', slot, surface} | {kind:'staging', index, surface} | {kind:'floor', x, z, yaw, surface} | {kind:'blocked', reason, surface}.
// `surface` is the height its base meets there. ctx also has: occupied(slot) -> bool, solidAt(x, z) -> bool (walls and furniture, no margin), stagingTaken(index) -> bool.
// (While a pallet is pushed into a shelf cell the shelf lane (laneOk) already keeps the forks from dropping below the deck, so only the cell it can really be set in is a target.)
export function restingOn(s,ctx){
 const c=carriedBox(s,ctx.carried||1),base=c.base;
 // a shelf cell: the middle of the pallet within 15 cm of the middle of an empty cell (and square to it), at that cell's level
 for(const cell of RACK_SLOTS){
  const dx=c.x-cell.x,dz=c.z-cell.z;if(Math.abs(dx)>SNAP.across||Math.abs(dz)>SNAP.along)continue;
  const lvl=levelBase(cell.level);if(base<lvl-.05||base>lvl+LANE.height||ctx.occupied(cell.id))continue;
  if(Math.abs(axisError(s.yaw,0))<=SNAP.yaw)return {kind:'rack',slot:cell.id,surface:lvl};
 }
 // an order's staging square (the carried pallet lowers onto it and the order takes its planks)
 for(let i=0;i<WAREHOUSE_STAGING.length;i++){
  const p=WAREHOUSE_STAGING[i];if(Math.abs(c.x-p.x)>STAGING_BOX.hx||Math.abs(c.z-p.z)>STAGING_BOX.hz)continue;
  return ctx.stagingTaken(i)?{kind:'staging',index:i,surface:STAGING_BOX.top}:{kind:'blocked',reason:'No order is waiting on that square.',surface:STAGING_BOX.top};
 }
 // inside a shelving unit but not square to a free cell: it cannot be set down
 if(unitAt(c.x,c.z,.05))return {kind:'blocked',reason:'Line up with the bay.',surface:0};
 // the floor, if no wall or furniture is under it
 if(corners(c).some(w=>ctx.solidAt(w.x,w.z)))return {kind:'blocked',reason:'No room to set it down here.',surface:0};
 return {kind:'floor',x:c.x,z:c.z,yaw:s.yaw,surface:0};
}// the lowest the forks may go: a carried pallet cannot sink below what it rests on
export function liftRange(s,ctx){
 if(!(ctx.carried>0))return [LIFT_MIN,LIFT_MAX];
 const r=restingOn(s,ctx);return [Math.max(LIFT_MIN,Math.min(LIFT_MAX,r.surface+CARRY_DROP)),LIFT_MAX];
}
// a pallet to lift: forks empty, tines in the pocket far enough and raised to the lift height
export const liftsNow=(s,boxes)=>{const b=engagedBox(s,boxes);return b&&s.lift-b.base>=POCKET.liftAt?b:null};
// set a carried pallet down: the forks are lowered until its base meets the surface (the caller is lowering). Returns the resting place, or null while it is still above it
export function settles(s,ctx){const r=restingOn(s,ctx);return r.kind!=='blocked'&&carriedBox(s,ctx.carried).base<=r.surface+.005?r:null}

// A line for the vehicle panel: why the forks are stopped, or what to do next. '' when there is nothing to say.
export function forkHint(s,ctx){
 if(ctx.carried>0){const r=restingOn(s,ctx);if(r.kind==='blocked')return r.reason;if(r.kind==='rack')return `Lower the pallet into rack ${r.slot}.`;if(r.kind==='staging')return 'Lower the pallet onto the order’s square.';return '';}
 for(const b of ctx.boxes){
  if(Math.hypot(b.x-s.x,b.z-s.z)>3.8)continue;
  const p=probe(s,b);
  if(p.state==='blocked')return p.reason;
  if(p.state==='pocket')return p.depth>=POCKET.engage?'Raise the forks to lift the pallet.':'Drive in a little further.';
 }
 return '';
}
