import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PROPS} from '../dist/props-assets.js';
import {MAP} from '../dist/map-definition.js';
import {houseLayout,buildHouseRoom,collidersOf,footprintOf,face,FLOORS,USES,FLOOR_HEIGHT} from '../dist/interiors.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};

const HOUSE_PROPS=[...new Set(MAP.landmarks.filter(l=>l.plot&&/^house-/.test(l.prop)).map(l=>l.prop).concat('house-t'))];
assert.deepEqual(HOUSE_PROPS.sort(),Object.keys(FLOORS).sort(),'every house model in the world has an interior');
assert.equal(face(0,-1),0);assert.equal(face(1,0),-Math.PI/2);assert.equal(face(0,1),Math.PI);assert.equal(face(-1,0),Math.PI/2);

let rooms=0,pieces=0;
for(const prop of HOUSE_PROPS){
 const L=houseLayout(prop),hw=L.W/2,hd=L.D/2,info=PROPS[prop];
 assert.equal(L.floors,FLOORS[prop],prop+' floors');assert.equal(L.items.length,L.floors);
 assert(Math.abs(L.W-(info.width-.8))<.3&&Math.abs(L.D-(info.depth-.8))<.3,`${prop}: the room is the house less its walls (${L.W} x ${L.D})`);
 // every piece is a known furniture model, inside the room, and no two solid pieces overlap; the door zone is clear
 L.items.forEach((list,f)=>{const fps=list.map(i=>({i,r:footprintOf(i)}));
  for(const {i,r} of fps){assert(PROPS[i.id]&&i.id.startsWith('f-'),`${prop}: ${i.id} is a furniture model`);assert(r.x0>=-hw-1e-6&&r.x1<=hw+1e-6&&r.z0>=-hd-1e-6&&r.z1<=hd+1e-6,`${prop} f${f}: ${i.id} is inside the room`);pieces++;
   if(f===0&&i.y===0&&i.id!=='f-rug')assert(!(r.z1>hd-1.6&&r.x0<L.doorX+1&&r.x1>L.doorX-1),`${prop}: ${i.id} leaves the door clear`)}
  for(let a=0;a<fps.length;a++)for(let b=a+1;b<fps.length;b++){const p=fps[a],q=fps[b];if(p.i.id==='f-rug'||q.i.id==='f-rug'||p.i.y>0||q.i.y>0)continue;assert(!(p.r.x0<q.r.x1-.02&&q.r.x0<p.r.x1-.02&&p.r.z0<q.r.z1-.02&&q.r.z0<p.r.z1-.02),`${prop} f${f}: ${p.i.id} and ${q.i.id} do not overlap`)}});
 // a bed, a stove, a sink and a fridge, a bathroom, and a way upstairs when there is an upstairs
 const all=L.items.flat(),has=id=>all.some(i=>i.id===id);for(const id of ['f-bed-double','f-stove','f-sink','f-fridge','f-toilet','f-bath','f-sofa','f-tv',...(L.W>=8.5?['f-table']:[])])assert(has(id),`${prop} has a ${id}`);
 assert.equal(!!L.stairs,L.floors===2,prop+': stairs exactly when there are two floors');assert.equal(L.bed.floor,L.floors-1===1?1:0,'the bed is upstairs in a two-storey house');
 assert(L.items[L.bed.floor].some(i=>i.id==='f-bed-double'));assert(Math.abs(L.entry.x-L.doorX)<1e-9&&L.entry.z<hd&&L.exit.z<hd,'you come in at the door');
 // the room can be walked: from the entry you can reach the exit, the stove, the bed, and the stairs; on the second floor from the landing you reach the bed
 const walk=(floor,from,targets,label)=>{const colliders=collidersOf(L,floor),step=.2,nx=Math.round(L.W/step),nz=Math.round(L.D/step),at=(x,z)=>[Math.round((x+hw)/step),Math.round((z+hd)/step)],
   blocked=(x,z)=>Math.abs(x)>hw-.3||Math.abs(z)>hd-.3||colliders.some(c=>Math.abs(x-c.x)<c.hx+.32&&Math.abs(z-c.z)<c.hz+.32),seen=new Uint8Array((nx+1)*(nz+1)),[sx,sz]=at(from.x,from.z);
   assert(!blocked(from.x,from.z),`${prop}: you can stand where you ${label}`);const stack=[[sx,sz]];seen[sz*(nx+1)+sx]=1;
   while(stack.length){const [i,j]=stack.pop();for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>nx||b>nz||seen[b*(nx+1)+a])continue;const x=-hw+a*step,z=-hd+b*step;if(blocked(x,z))continue;seen[b*(nx+1)+a]=1;stack.push([a,b])}}
   for(const [name,t,reach] of targets){let ok=false;for(let dx=-reach;dx<=reach&&!ok;dx+=step)for(let dz=-reach;dz<=reach&&!ok;dz+=step){if(Math.hypot(dx,dz)>reach)continue;const [i,j]=at(t.x+dx,t.z+dz);if(i>=0&&j>=0&&i<=nx&&j<=nz&&seen[j*(nx+1)+i])ok=true}assert(ok,`${prop} floor ${floor}: you can walk to the ${name}`)}};
 walk(0,L.entry,[['door',L.exit,1.5],['stove',L.kitchen,1.5],...(L.stairs?[['foot of the stairs',{x:L.stairs.x,z:L.stairs.footZ},1.5]]:[]),...(L.bed.floor===0?[['bed',L.bed,1.4]]:[])],'come in'); // the same reach the game uses for each prompt
 if(L.stairs)walk(1,{x:L.stairs.x,z:L.stairs.topZ+.1},[['bed',L.bed,1.4],['stairs landing',{x:L.stairs.x,z:L.stairs.topZ},1.5]],'arrive upstairs');
 // built: a scene with one group per floor, one mesh per piece, walls that block, a door you can leave by
 const room=buildHouseRoom(prop);rooms++;
 assert(room.scene instanceof THREE.Scene);assert.equal(room.scene.children.filter(c=>c.name?.startsWith('floor-')).length,L.floors);
 let meshes=0;room.scene.traverse(o=>{if(o.name?.startsWith('f:'))meshes++});assert.equal(meshes,all.length,`${prop}: one model per piece`);
 assert(room.occluders.length>=4&&room.scene.getObjectByName('front-door'),'walls (that fade) and a front door');
 assert(room.blocked(0,hd-.1)&&room.blocked(hw-.1,0)&&room.blocked(-hw+.1,0),'the walls stop you');assert(!room.blocked(room.ENTRY.x,room.ENTRY.z),'the entry is free');assert(!room.blocked(room.EXIT.x,room.EXIT.z),'so is the spot by the door');
 assert.equal(room.floor,0);if(L.stairs){room.setFloor(1);assert.equal(room.floor,1);assert(!room.blocked(L.stairs.x,L.stairs.topZ+.1),'the landing is free');room.setFloor(0)}
 assert.equal(room.FLOOR_HEIGHT,FLOOR_HEIGHT);assert.deepEqual(room.BED,{x:L.bed.x,z:L.bed.z});assert.equal(room.BED_FLOOR,L.bed.floor);
}
assert.deepEqual(USES,{'f-bed-double':'sleep','f-bed-single':'sleep','f-stove':'cook'});
// the same house gives the same room every time
assert.deepEqual(houseLayout('house-c'),houseLayout('house-c'));
console.log(`Interiors: ${rooms} house rooms (${pieces} pieces of furniture): every piece inside its room, nothing overlapping, the door clear; you can walk from the door to the stove, the bed and the stairs on every floor; built rooms have a scene per floor, a model per piece and walls that stop you.`);
