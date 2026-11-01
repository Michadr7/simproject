// Reset safety net: find the nearest place a character can actually stand. Pure: it only needs a blocked(x, z) test, so the game can pass the
// outdoor, shop or home version and the tests can pass a toy world.
// A spot counts as clear when the point and a ring around it are open (the 0.31 spawn was inside a parked car's box, so every step out was refused)
// and, outdoors, when it is not a closed pocket: a spot inside a house's walls is open ground but is a trap. A pocket is a region you can walk around in
// that covers less than OPEN_AREA square metres (the Kenney houses are about 80; the smallest thing that is really open country is far bigger).
// STEP is also the coarsest grid that cannot hop a wall: blocked() pads every box by 0.33 m a side, so a wall blocks at least 0.66 m.
export const STEP=.5,MAX_SEARCH=30,CLEAR_RADIUS=.75,OPEN_AREA=300;

// Candidate offsets on a half-metre grid, nearest first. Built once (about 11,500 entries), the first time a search runs.
let OFFSETS=null;
function offsets(){
 if(OFFSETS)return OFFSETS;
 const n=Math.round(MAX_SEARCH/STEP),list=[];
 for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++){const d=Math.hypot(i,j)*STEP;if(d<=MAX_SEARCH)list.push([i,j,d])}
 list.sort((a,b)=>a[2]-b[2]||a[0]-b[0]||a[1]-b[1]); // ties broken the same way every time
 return OFFSETS=list;
}
const RING=Array.from({length:8},(_,k)=>[Math.cos(k*Math.PI/4)*CLEAR_RADIUS,Math.sin(k*Math.PI/4)*CLEAR_RADIUS]);
export function isClearSpot(blocked,x,z){
 if(blocked(x,z))return false;
 for(const [dx,dz] of RING)if(blocked(x+dx,z+dz))return false;
 return true;
}

// Is the region around (x, z) at least `area` square metres? A breadth-first flood over open half-metre cells that stops as soon as it is big enough.
// `sealed` collects every cell of a pocket that turned out to be closed in, so a search never floods the same courtyard twice.
function isOpenGround(blocked,x,z,area,sealed){
 const key=(ix,iz)=>(ix+4096)*8192+(iz+4096),ix0=Math.round(x/STEP),iz0=Math.round(z/STEP),enough=area/(STEP*STEP);
 if(sealed.has(key(ix0,iz0)))return false;
 const seen=new Set([key(ix0,iz0)]),queue=[[ix0,iz0]];
 for(let head=0;head<queue.length;head++){
  const [ix,iz]=queue[head];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=ix+dx,nz=iz+dz,k=key(nx,nz);
   if(seen.has(k)||blocked(nx*STEP,nz*STEP))continue;
   seen.add(k);queue.push([nx,nz]);
   if(seen.size>=enough)return true;
  }
 }
 for(const k of seen)sealed.add(k);
 return false;
}

// Returns {x, z, distance} (distance from the point you asked about, 0 if it was already fine) or null when nothing within maxRadius qualifies.
// openArea: the smallest region (square metres) that counts as open ground; 0 skips the check (inside a shop or a home the room is the whole world).
export function findNearestClearSpot(blocked,x,z,{maxRadius=MAX_SEARCH,openArea=OPEN_AREA}={}){
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 const sealed=new Set(),good=(px,pz)=>isClearSpot(blocked,px,pz)&&(openArea<=0||isOpenGround(blocked,px,pz,openArea,sealed));
 if(good(x,z))return {x,z,distance:0};
 const cx=Math.round(x/STEP),cz=Math.round(z/STEP);
 for(const [i,j,d] of offsets()){
  if(d>maxRadius)break;
  const px=(cx+i)*STEP,pz=(cz+j)*STEP;
  if(blocked(px,pz))continue; // the cheap test first: one call per candidate
  if(good(px,pz))return {x:px,z:pz,distance:Math.hypot(px-x,pz-z)};
 }
 return null;
}
