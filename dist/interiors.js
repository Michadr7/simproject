// House interiors (0.30). A room is built when you step inside, always from the same data: the house model's size sets the room, its front door sets where you come in, and the layout puts a kitchen run,
// a bathroom, a living area and a bed in it (a two-storey house has stairs and the bedrooms upstairs). Furniture is the Kenney Furniture Kit (props-assets.js, ids f-...), which faces -z: a piece with yaw 0
// looks north, and `face(dx, dz)` gives the quarter-turn yaw that makes it look toward (dx, dz). Room coordinates: the middle is 0, 0; +z is the door side (south); metres.
import * as THREE from './vendor/three.module.js';
import {propInfo,createProp} from './props.js';
import {PROPS} from './props-assets.js';
import {INTERIOR_LAYOUTS} from './interior-layouts.js';

export const FLOOR_HEIGHT=3.4,WALL_HEIGHT=3.1;
// How many floors each house model has (its look from outside).
export const FLOORS={'house-a':1,'house-h':1,'house-j':1,'house-c':2,'house-e':2,'house-l':2,'house-o':2,'house-r':2,'house-t':2};
// What E does at a piece. 'sleep' and 'cook' are the studio's own actions; the rest is furniture to look at until the furniture update.
export const USES={'f-bed-double':'sleep','f-bed-single':'sleep','f-stove':'cook'};
export const NORTH=[0,-1],SOUTH=[0,1],EAST=[1,0],WEST=[-1,0];

const quarter=yaw=>((Math.round(yaw/(Math.PI/2))%4)+4)%4;
export const face=(dx,dz)=>{const q=quarter(Math.atan2(-dx,-dz));return q===3?-Math.PI/2:q*Math.PI/2};
// The footprint of a piece standing at (x, z): its model footprint turned by its quarter-turn yaw (three.js turns about y: (x, z) -> (z, -x) for +90 degrees).
export function footprintOf(item){
 const f=propInfo(item.id).footprint,q=quarter(item.yaw),turn=(x,z)=>q===0?[x,z]:q===1?[z,-x]:q===2?[-x,-z]:[-z,x],
  pts=[[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]].map(([x,z])=>turn(x,z));
 return {x0:item.x+Math.min(...pts.map(p=>p[0])),x1:item.x+Math.max(...pts.map(p=>p[0])),z0:item.z+Math.min(...pts.map(p=>p[1])),z1:item.z+Math.max(...pts.map(p=>p[1]))};
}
const sizeOf=(id,yaw=0)=>{const f=footprintOf({id,x:0,z:0,yaw});return {w:f.x1-f.x0,d:f.z1-f.z0}};

// The layout of one house as plain data: room size, door, partition walls and, for each floor, the furniture. Nothing here touches three.js.
export function houseLayout(prop,{saved=true}={}){
 const info=propInfo(prop),floors=FLOORS[prop]??1,W=Math.round((info.width-.8)*4)/4,D=Math.round((info.depth-.8)*4)/4,hw=W/2,hd=D/2,
  doorX=Math.max(-hw+1.5,Math.min(hw-1.5,info.door?.x??0)),ground=[],upper=[];
 const add=(list,id,x,z,yaw,y=0)=>list.push({id,x:+x.toFixed(3),z:+z.toFixed(3),yaw,y});
 const look=(list,id,x,z,toward,y=0)=>add(list,id,x,z,face(toward[0],toward[1]),y);
 // the bathroom in the north-east corner, 2.6 m square, with a door gap in its south wall; the toilet, sink and bath inside
 const bx0=hw-2.6,bz1=-hd+2.6,partitions=[{x0:bx0,z0:bz1,x1:hw-2.1,z1:bz1},{x0:hw-1.2,z0:bz1,x1:hw,z1:bz1},{x0:bx0,z0:-hd,x1:bx0,z1:bz1}];
 look(ground,'f-bath',hw-1.3,-hd+.6,SOUTH);look(ground,'f-toilet',hw-.6,bz1-.75,WEST);look(ground,'f-bath-sink',hw-2.2,-hd+1.5,EAST);
 // the kitchen run along the north wall from the west corner, as long as the bathroom allows (cabinets drop out first)
 const run=['f-cabinet','f-sink','f-cabinet','f-stove','f-cabinet','f-fridge'],length=ids=>ids.reduce((s,id)=>s+sizeOf(id).w,0);
 while(length(run)>W-2.6-.2){const i=run.indexOf('f-cabinet');if(i<0)throw new Error('the kitchen run does not fit '+prop);run.splice(i,1)}
 let cx=-hw+.05;const kitchen={x:0,z:0};
 for(const id of run){const s=sizeOf(id);look(ground,id,cx+s.w/2,-hd+s.d/2+.02,SOUTH);if(id==='f-stove')Object.assign(kitchen,{x:cx+s.w/2,z:-hd+s.d/2+.9});cx+=s.w}
 // stairs against the west wall of a two-storey house, running north-south: the high end at the north, the foot at the south
 let stairs=null;
 if(floors===2){const s=sizeOf('f-stairs',-Math.PI/2),z0=-hd+1.15;add(ground,'f-stairs',-hw+s.w/2+.05,z0+s.d/2,-Math.PI/2);
  stairs={x0:-hw+.05,x1:-hw+s.w+.05,z0,z1:z0+s.d,footZ:z0+s.d+.45,topZ:z0-.45,x:-hw+s.w/2+.05}}

 // the living area: a television on a cabinet against the east wall (two storeys) or the west wall (one), the sofa facing it, a coffee table and a rug
 const S=floors===2?1:-1,zl=S>0?.3:-.2,tvX=S*(hw-.3),towards=[-S,0],tableX=S*(hw-1.75),sofaX=S*(hw-3.25);
 // the dining table and two chairs (rooms 8.5 m wide or more): east of the stairs, or beside the sofa in a single-storey house
 const tx=S>0?Math.max(-hw+.05+length(run)/2,stairs.x1+1.1):sofaX+1.9,tz=-hd+3;
 if(W>=8.5){add(ground,'f-table',tx,tz,0);look(ground,'f-chair',tx,tz-.78,SOUTH);look(ground,'f-chair',tx,tz+.78,NORTH)} // a compact room has no dining table: it would seal the kitchen off
 add(ground,'f-rug',tableX,zl,Math.PI/2);look(ground,'f-tv-cabinet',tvX,zl,towards);look(ground,'f-tv',tvX,zl,towards,.6);
 add(ground,'f-coffee-table',tableX,zl,Math.PI/2);look(ground,'f-sofa',sofaX,zl,[S,0]);look(ground,'f-lamp',sofaX,zl+1.35,SOUTH);
 // a single-storey house: the bed in the south corner away from the door, a wardrobe beside it; a plant in the other corner
 const away=doorX>=0?-1:1;
 if(floors===1){look(ground,'f-bed-double',away*(hw-1.05),hd-1.3,NORTH);const wx=away*(hw-2.5);if(Math.abs(wx-doorX)>1.5)look(ground,'f-wardrobe',wx,hd-.3,NORTH)}
 look(ground,'f-plant',S*(hw-.4),zl+(S>0?1.4:-1.4),SOUTH);
 // upstairs: a double bed and a single bed against the north wall, a desk and chair, a wardrobe, a bookcase, a lamp, a rug and a plant
 if(floors===2){const px=stairs.x1+.25;
  look(upper,'f-bed-double',px+1.05,-hd+1.3,SOUTH);look(upper,'f-bed-single',hw-.7,-hd+1.3,SOUTH);
  look(upper,'f-wardrobe',hw-.3,hd-2.4,WEST);look(upper,'f-bookcase',hw-.3,hd-3.5,WEST);
  look(upper,'f-desk',px+1.3,hd-.55,NORTH);look(upper,'f-desk-chair',px+1.3,hd-1.5,SOUTH);look(upper,'f-lamp',px+3.1,-hd+.4,SOUTH);add(upper,'f-rug',px+1.8,0,0);look(upper,'f-plant',px+3.4,hd-.4,SOUTH)}
 // the point you use the bed from: the open side of it (the foot, or the side facing the room)
 const bedFloor=floors===2?1:0,bed=(bedFloor?upper:ground).find(i=>i.id==='f-bed-double');
 const layout={prop,floors,W,D,doorX,partitions,items:[ground,upper].slice(0,floors),stairs,entry:{x:doorX,z:hd-1.3},exit:{x:doorX,z:hd-.55},bed:floors===2?{x:bed.x,z:bed.z+.55,floor:bedFloor}:{x:bed.x-away*.55,z:bed.z+.1,floor:bedFloor},kitchen};
 return saved?applySaved(layout,INTERIOR_LAYOUTS[prop]):layout; // a layout saved from the dev panel's interior editor (interior-layouts.js) replaces the generated furniture
}

// ── Saved layouts (interior-layouts.js, written by the dev panel's interior editor through scripts/dev-server.mjs) ───────────────────────────────────────────────────────────────────
// A saved layout is {items: [ground floor pieces, upper floor pieces]}, each piece {id, x, z, yaw, y}. The stairs and the bathroom's walls belong to the building, so they always come from the
// generator; everything else is furniture and comes from the file. A saved layout that does not make sense (an unknown piece, a wrong number of floors) is ignored whole.
export const LOCKED=new Set(['f-stairs']);
export function cleanItem(raw){
 if(!raw||typeof raw.id!=='string'||!raw.id.startsWith('f-')||!PROPS[raw.id])return null;
 const x=Number(raw.x),z=Number(raw.z),y=Number(raw.y??0),yaw=Number(raw.yaw??0),q=Math.round(yaw/(Math.PI/2));
 if(![x,z,y,yaw].every(Number.isFinite)||Math.abs(x)>30||Math.abs(z)>30||y<0||y>3||Math.abs(yaw-q*Math.PI/2)>1e-6)return null;
 return {id:raw.id,x:+x.toFixed(3),z:+z.toFixed(3),yaw:q===3?-Math.PI/2:q*Math.PI/2,y:+y.toFixed(3)};
}
// The spots the game uses (the stove to cook at, the bed to sleep in), recomputed from where the pieces are now.
export function deriveSpots(layout){
 const stove=layout.items[0].find(i=>i.id==='f-stove'),bedFloor=layout.floors===2?1:0,bed=(layout.items[bedFloor]||[]).find(i=>i.id==='f-bed-double'),away=layout.doorX>=0?-1:1;
 return {kitchen:stove?{x:stove.x,z:stove.z+.88}:null,bed:bed?(layout.floors===2?{x:bed.x,z:bed.z+.55,floor:bedFloor}:{x:bed.x-away*.55,z:bed.z+.1,floor:bedFloor}):null};
}
export function applySaved(layout,saved){
 if(!saved||!Array.isArray(saved.items)||saved.items.length!==layout.floors)return layout;
 const items=[];
 for(const list of saved.items){if(!Array.isArray(list))return layout;const out=[];for(const raw of list){if(LOCKED.has(raw?.id))continue;const item=cleanItem(raw);if(!item)return layout;out.push(item)}items.push(out)}
 items[0].push(...layout.items[0].filter(i=>LOCKED.has(i.id)));
 layout.items=items;
 const spots=deriveSpots(layout);if(spots.kitchen)Object.assign(layout.kitchen,spots.kitchen);if(spots.bed)layout.bed=spots.bed;
 return layout;
}

// What is wrong with a layout, as plain sentences: an empty list means it works. The same rules as tests/interiors.mjs, so the editor can show them while you move things.
// Pieces must be inside the room, solid pieces must not overlap, the door must be clear, and from the door you must be able to walk to the stove, the bed and the stairs.
export function layoutProblems(layout){
 const out=[],hw=layout.W/2,hd=layout.D/2,name=i=>i.id.replace(/^f-/,'');
 layout.items.forEach((list,f)=>{const fps=list.map(i=>({i,r:footprintOf(i)})),where=layout.floors>1?` (floor ${f})`:'';
  for(const {i,r} of fps){
   if(r.x0<-hw-1e-6||r.x1>hw+1e-6||r.z0<-hd-1e-6||r.z1>hd+1e-6)out.push(`the ${name(i)} is outside the room${where}`);
   if(f===0&&i.y===0&&i.id!=='f-rug'&&r.z1>hd-1.6&&r.x0<layout.doorX+1&&r.x1>layout.doorX-1)out.push(`the ${name(i)} is blocking the door`);
  }
  for(let a=0;a<fps.length;a++)for(let b=a+1;b<fps.length;b++){const p=fps[a],q=fps[b];if(p.i.id==='f-rug'||q.i.id==='f-rug'||p.i.y>0||q.i.y>0)continue;
   if(p.r.x0<q.r.x1-.02&&q.r.x0<p.r.x1-.02&&p.r.z0<q.r.z1-.02&&q.r.z0<p.r.z1-.02)out.push(`the ${name(p.i)} and the ${name(q.i)} overlap${where}`)}});
 const all=layout.items.flat(),has=id=>all.some(i=>i.id===id);
 for(const id of ['f-bed-double','f-stove'])if(!has(id))out.push(`there is no ${id.replace(/^f-/,'').replace('-double',' (double)')}`);
 const reach=(floor,from,targets)=>{const colliders=collidersOf(layout,floor),step=.2,nx=Math.round(layout.W/step),nz=Math.round(layout.D/step),at=(x,z)=>[Math.round((x+hw)/step),Math.round((z+hd)/step)],
   blocked=(x,z)=>Math.abs(x)>hw-.3||Math.abs(z)>hd-.3||colliders.some(c=>Math.abs(x-c.x)<c.hx+.32&&Math.abs(z-c.z)<c.hz+.32);
  if(blocked(from.x,from.z))return [['standing spot',null]];
  const seen=new Uint8Array((nx+1)*(nz+1)),[sx,sz]=at(from.x,from.z),stack=[[sx,sz]];seen[sz*(nx+1)+sx]=1;
  while(stack.length){const [i,j]=stack.pop();for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>nx||b>nz||seen[b*(nx+1)+a])continue;if(blocked(-hw+a*step,-hd+b*step))continue;seen[b*(nx+1)+a]=1;stack.push([a,b])}}
  return targets.filter(([,t,r])=>{for(let dx=-r;dx<=r;dx+=step)for(let dz=-r;dz<=r;dz+=step){if(Math.hypot(dx,dz)>r)continue;const [i,j]=at(t.x+dx,t.z+dz);if(i>=0&&j>=0&&i<=nx&&j<=nz&&seen[j*(nx+1)+i])return false}return true});
 };
 const unreachable=reach(0,layout.entry,[['the door',layout.exit,1.5],['the stove',layout.kitchen,1.5],...(layout.stairs?[['the stairs',{x:layout.stairs.x,z:layout.stairs.footZ},1.5]]:[]),...(layout.bed.floor===0?[['the bed',layout.bed,1.4]]:[])]);
 for(const [what] of unreachable)out.push(what==='standing spot'?'you cannot stand where you come in':`you cannot walk from the door to ${what}`);
 if(layout.stairs&&layout.floors===2)for(const [what] of reach(1,{x:layout.stairs.x,z:layout.stairs.topZ+.1},[['the bed',layout.bed,1.4]]))out.push(`upstairs, you cannot walk from the stairs to ${what==='standing spot'?'the room':what}`);
 return [...new Set(out)];
}

// The collision boxes of a floor in room coordinates: every solid piece turned and moved to its place, and the partition walls.
export function collidersOf(layout,floor){
 const out=[];
 for(const item of layout.items[floor]){const q=quarter(item.yaw);for(const c of propInfo(item.id).colliders){const [x,z]=q===0?[c.x,c.z]:q===1?[c.z,-c.x]:q===2?[-c.x,-c.z]:[-c.z,c.x],odd=q%2===1;out.push({x:item.x+x,z:item.z+z,hx:odd?c.hz:c.hx,hz:odd?c.hx:c.hz,id:item.id})}}
 for(const p of floor===0?layout.partitions:[])out.push({x:(p.x0+p.x1)/2,z:(p.z0+p.z1)/2,hx:Math.max(.1,Math.abs(p.x1-p.x0)/2),hz:Math.max(.1,Math.abs(p.z1-p.z0)/2),id:'wall'});
 return out;
}

// Builds the room: walls with a door gap on the south side, a floor and furniture for each storey, lights, collision and the spots that matter (bed, stove, door, stairs).
export function buildHouseRoom(prop){
 const layout=houseLayout(prop),{W,D,doorX}=layout,hw=W/2,hd=D/2,scene=new THREE.Scene();scene.name='house-'+prop;scene.background=new THREE.Color('#b8b5a4');
 scene.add(new THREE.HemisphereLight('#fff1da','#898878',1.9));const sun=new THREE.DirectionalLight('#fff2da',1.8);sun.position.set(2,6,3);scene.add(sun);
 const materials=new Map(),occluders=[],fade={apply:m=>m};
 const mat=c=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.9}));return materials.get(c)};
 const floors=[];
 for(let f=0;f<layout.floors;f++){
  const group=new THREE.Group();group.name='floor-'+f;group.position.y=f*FLOOR_HEIGHT;scene.add(group);
  const box=(w,h,d,x,y,z,c,wall=false)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.receiveShadow=true;group.add(m);if(wall)occluders.push(m);return m};
  box(W+.4,.2,D+.4,0,-.1,0,'#b99a73');box(2.6,.02,2.6,hw-1.3,.005,-hd+1.3,'#c6d3d4'); // the floor, tiles in the bathroom
  box(W+.4,WALL_HEIGHT,.2,0,WALL_HEIGHT/2,-hd-.1,'#e9e1cf',true);box(.2,WALL_HEIGHT,D,-hw-.1,WALL_HEIGHT/2,0,'#e2dac6',true);box(.2,WALL_HEIGHT,D,hw+.1,WALL_HEIGHT/2,0,'#e2dac6',true);
  // the south wall, with the door gap (1.4 m wide, 2.2 m high) at doorX on the ground floor; windows on every floor
  const g0=doorX-.75,g1=doorX+.75;
  if(f===0){box(g0+hw+.2,WALL_HEIGHT,.2,(-hw-.2+g0)/2,WALL_HEIGHT/2,hd+.1,'#e9e1cf',true);box(hw+.2-g1,WALL_HEIGHT,.2,(g1+hw+.2)/2,WALL_HEIGHT/2,hd+.1,'#e9e1cf',true);box(g1-g0,WALL_HEIGHT-2.2,.2,doorX,2.2+(WALL_HEIGHT-2.2)/2,hd+.1,'#e9e1cf',true);
   const door=box(1.4,2.2,.06,doorX,1.1,hd+.1,'#6e8073',true);door.name='front-door'}
  else box(W+.4,WALL_HEIGHT,.2,0,WALL_HEIGHT/2,hd+.1,'#e9e1cf',true);
  for(const [x,z,rot] of [[-hw*.5,-hd-.005,0],[hw*.3,hd+.205,0],[-hw-.005,hd*.45,Math.PI/2]]){const w=box(1.5,1.2,.04,0,1.7,0,'#b9d8e4');w.position.set(x,1.7,z);w.rotation.y=rot;w.material=new THREE.MeshStandardMaterial({color:'#b9d8e4',roughness:.2,transparent:true,opacity:.55})}
  // partitions (the bathroom) on the ground floor
  if(f===0)for(const p of layout.partitions){const w=Math.abs(p.x1-p.x0)||.12,d=Math.abs(p.z1-p.z0)||.12;box(w,WALL_HEIGHT-.4,d,(p.x0+p.x1)/2,(WALL_HEIGHT-.4)/2,(p.z0+p.z1)/2,'#dfe6e3',true)}
  // the furniture is added by furnish() below, so the editor can rebuild it
  floors.push(group);
 }
 // Furniture: one model per piece, named f:<id> and numbered by its place in layout.items[floor] (userData.index). refresh() rebuilds all of it from the layout, which the dev panel's editor changes in place.
 const furnish=f=>{const group=floors[f];for(const old of group.children.filter(c=>c.name?.startsWith('f:')))group.remove(old);layout.items[f].forEach((item,i)=>{const m=createProp(item.id,fade);m.position.set(item.x,item.y,item.z);m.rotation.y=item.yaw;m.name='f:'+item.id;m.userData.index=i;m.castShadow=false;group.add(m)})};
 layout.items.forEach((_,f)=>furnish(f));
 let floor=0,colliders=layout.items.map((_,f)=>collidersOf(layout,f));
 const blocked=(x,z)=>Math.abs(x)>hw-.3||Math.abs(z)>hd-.3||colliders[floor].some(c=>Math.abs(x-c.x)<c.hx+.32&&Math.abs(z-c.z)<c.hz+.32);
 const marker=new THREE.Box3Helper(new THREE.Box3(),0xffc83d);marker.visible=false;marker.name='selection';scene.add(marker);
 const room={scene,occluders,layout,blocked,get floor(){return floor},setFloor(n){floor=n;return n},FLOOR_HEIGHT,
  ENTRY:{x:layout.entry.x,z:layout.entry.z},EXIT:{x:layout.exit.x,z:layout.exit.z},BED:{x:layout.bed.x,z:layout.bed.z},BED_FLOOR:layout.bed.floor,KITCHEN:layout.kitchen,STAIRS:layout.stairs,
  // Rebuild every piece and every collision box from layout.items, and move the bed and kitchen spots to where the bed and stove are now.
  refresh(){layout.items.forEach((_,f)=>furnish(f));colliders=layout.items.map((_,f)=>collidersOf(layout,f));const spots=deriveSpots(layout);if(spots.kitchen)Object.assign(layout.kitchen,spots.kitchen);if(spots.bed){layout.bed=spots.bed;Object.assign(room.BED,{x:spots.bed.x,z:spots.bed.z})}},
  // A yellow box around one piece (its floor and its place in layout.items; null hides the box), for the editor.
  highlight(f,index){const mesh=f==null?null:floors[f].children.find(c=>c.name?.startsWith('f:')&&c.userData.index===index);marker.visible=!!mesh;if(mesh){scene.updateMatrixWorld(true);marker.box.setFromObject(mesh)}}};
 return room;
}
