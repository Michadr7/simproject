// The company warehouse interior (0.35 step 2b, DESIGN 4.16 C). Built like the office (office.js) so the game treats it the same way: {scene, occluders, glass, clerk, exitDoor, board, blocked}.
// The room stands far from the map (MAP.offices[].interior.origin) and is shown only while the player is inside. The floor plan is in warehouse-layout.js: a 36 x 24 x 7 m hall, three
// shelving units with 4 m aisles (a forklift turns in 3.5 m), three shelf levels, the person door in the front wall at z = +12 (the camera looks in from there), the dock's roller door
// and the delivery pile at the front right, the order table at the front left and three staging pallets between.
import * as T from './vendor/three.module.js';
import {createCharacter} from './character.js';
import {outfit} from './appearance.js';
import {createDoubleDoor,createSlidingDoor} from './doors.js';
import {createNameBoard} from './office.js';
import {HALL,RACK_SLOTS,UNITS,BAYS,LEVELS,BAY_PITCH,LEVEL_Y,FRAME_HEIGHT,WAREHOUSE_PILE,WAREHOUSE_TABLE,WAREHOUSE_STAGING,DOCK_DOOR} from './warehouse-layout.js';

export {RACK_SLOTS,WAREHOUSE_PILE,WAREHOUSE_TABLE,WAREHOUSE_STAGING};
export const RACK_CAP=40,PILE_CAP=40;
const BOARD={w:.22,t:.088,l:1.2},COLS=4,TONES=['#c99f63','#bf9358','#d3ab6e','#b78a50'].map(c=>new T.Color(c));
// board i of a pile: 4 across and as many high as it takes; local to the pile's centre, the height above the surface it lies on
export const boardAt=i=>({x:((i%COLS)-(COLS-1)/2)*(BOARD.w+.02),y:BOARD.t/2+Math.floor(i/COLS)*(BOARD.t+.004)});

export function createWarehouse({name,spec}){
 const scene=new T.Group();scene.name='warehouse-interior';const occluders=[],blocks=[];
 const mats=new Map(),mat=c=>{if(!mats.has(c))mats.set(c,new T.MeshStandardMaterial({color:c,roughness:.85}));return mats.get(c)};
 function box(w,h,d,x,y,z,c,solid=false,wall=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),wall?new T.MeshStandardMaterial({color:c,roughness:.85}):mat(c));m.position.set(x,y,z);scene.add(m);if(wall)occluders.push(m);if(solid)blocks.push({x,z,hx:w/2,hz:d/2});return m}
 // many boxes of one colour as one InstancedMesh (the shelving's posts, beams and decks): [{x,y,z,w,h,d}]
 const unit=new T.BoxGeometry(1,1,1),m4=new T.Matrix4(),q0=new T.Quaternion(),p0=new T.Vector3(),s0=new T.Vector3();
 function instanced(list,colour,nm){const mesh=new T.InstancedMesh(unit,mat(colour),Math.max(1,list.length));mesh.name=nm;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
  list.forEach((b,i)=>{m4.compose(p0.set(b.x,b.y,b.z),q0,s0.set(b.w,b.h,b.d));mesh.setMatrixAt(i,m4)});mesh.count=list.length;scene.add(mesh);return mesh}
 const {halfW:W,halfD:D,height:H}=HALL;
 // floor: concrete with painted aisle lines and a forklift bay; walls: pale grey-green plaster over a dark skirting; the front wall has the person-door gap and the dock's roller door
 box(W*2,.2,D*2,0,-.1,0,'#8f8c84');
 for(const z of [-8.6,-1.4,5.4])box(W*2-4,.004,.14,0,.003,z,'#d9b82c'); // aisle centre lines
 for(const z of [3,7])box(7,.004,.14,-13.5,.003,z,'#d9b82c');for(const x of [-17,-10])box(.14,.004,4,x,.003,5,'#d9b82c'); // the forklift parking bay (the forklift parks here: forklift.js BAY)
 box(W*2,H,.16,0,H/2,-D,'#c3c8b8',true,true);for(const x of [-W,W])box(.16,H,D*2,x,H/2,0,'#b4baa8',true,true);
 box(W*2,.35,.2,0,.175,-D+.05,'#4f4a3f');for(const x of [-W+.05,W-.05])box(.2,.35,D*2,x,.175,0,'#4f4a3f');
 const gap=spec?.exitDoor?.width||2.2,fz=D;
 box(W-gap/2,H,.16,-(gap/2+(W-gap/2)/2),H/2,fz,'#b4baa8',true,true);box(W-gap/2,H,.16,gap/2+(W-gap/2)/2,H/2,fz,'#b4baa8',true,true);box(gap,H-2.7,.16,0,2.7+(H-2.7)/2,fz,'#b4baa8',true,true);
 // the dock's roller door on the front wall (shut): a corrugated panel in a steel frame, with a dock light; the delivery pile stands in front of it
 {const x=DOCK_DOOR.x,w=DOCK_DOOR.width;box(w,3.6,.1,x,1.8,fz-.1,'#8a948f');for(let i=0;i<14;i++)box(w-.1,.05,.04,x,.2+i*.25,fz-.16,'#7a847f');box(w+.2,.16,.16,x,3.68,fz-.12,'#4d5654');for(const s of [-1,1])box(.16,3.8,.16,x+s*(w/2+.1),1.9,fz-.12,'#4d5654');const l=box(.2,.14,.2,x,4.1,fz-.2,'#f3e7b0');l.material=new T.MeshStandardMaterial({color:'#f3e7b0',emissive:new T.Color('#f1d98a'),emissiveIntensity:.9})}
 // the shelving: per unit, uprights at every bay boundary at the front and back of the cell rows (and down the spine of a double unit), a slatted deck and a beam at each level above the floor, a top
 // beam. Each unit is its own set of instanced meshes and joins the occluders, so a unit between the camera and you fades like a wall (its planks fade with it: they are per unit too).
 const unitMeshes=new Map();
 for(const u of UNITS){const span=BAYS*BAY_PITCH,x0=-span/2,z0=u.z-u.depth/2+.04,z1=u.z+u.depth/2-.04,posts=[],beams=[],slats=[];
  for(let k=0;k<=BAYS;k++){const x=x0+k*BAY_PITCH;for(const z of [z0,z1])posts.push({x,y:FRAME_HEIGHT/2,z,w:.09,h:FRAME_HEIGHT,d:.09});if(u.faces.length===2)posts.push({x,y:FRAME_HEIGHT/2,z:u.z,w:.09,h:FRAME_HEIGHT,d:.09})}
  for(const y of [LEVEL_Y[1],LEVEL_Y[2],FRAME_HEIGHT]){for(const z of [z0,z1])beams.push({x:0,y:y-.07,z,w:span+.09,h:.1,d:.07});if(y<FRAME_HEIGHT)for(let x=x0+.15;x<x0+span;x+=.3)slats.push({x,y:y-.03,z:u.z,w:.14,h:.04,d:u.depth-.1})} // the deck is slatted: the shelf below stays visible from above
  for(const [list,colour,nm] of [[posts,'#d28a1e','shelf-posts'],[beams,'#c46a1c','shelf-beams'],[slats,'#8a6a40','shelf-slats']]){const m=instanced(list,colour,nm+'-'+u.id);occluders.push(m)}
  const cap=u.faces.length*BAYS*LEVELS*RACK_CAP,bm=new T.InstancedMesh(new T.BoxGeometry(BOARD.w,BOARD.t,BOARD.l),new T.MeshStandardMaterial({color:'#ffffff',roughness:.9}),cap);bm.name='warehouse-boards-'+u.id;bm.count=0;bm.castShadow=bm.receiveShadow=true;bm.frustumCulled=false;
  bm.boundingBox=new T.Box3(new T.Vector3(x0-.1,0,u.z-u.depth/2),new T.Vector3(x0+span+.1,FRAME_HEIGHT,u.z+u.depth/2));scene.add(bm);occluders.push(bm);unitMeshes.set(u.id,{mesh:bm,faces:u.faces});
  blocks.push({x:0,z:u.z,hx:span/2+.05,hz:u.depth/2});
 }
 const stagingBoards=new T.InstancedMesh(new T.BoxGeometry(BOARD.w,BOARD.t,BOARD.l),new T.MeshStandardMaterial({color:'#ffffff',roughness:.9}),WAREHOUSE_STAGING.length*PILE_CAP);stagingBoards.name='warehouse-boards-staging';stagingBoards.count=0;stagingBoards.castShadow=stagingBoards.receiveShadow=true;stagingBoards.frustumCulled=false;scene.add(stagingBoards); // the planks staged on the three pallets
 const unitOfFace=face=>UNITS.find(u=>u.faces.includes(face)).id;
 const pileBoards=new T.InstancedMesh(new T.BoxGeometry(BOARD.w,BOARD.t,BOARD.l),new T.MeshStandardMaterial({color:'#ffffff',roughness:.9}),PILE_CAP);pileBoards.name='warehouse-boards-pile';pileBoards.count=0;pileBoards.castShadow=pileBoards.receiveShadow=true;pileBoards.frustumCulled=false;scene.add(pileBoards); // the delivery pile: a pallet by the roller door
 box(1.4,.14,1.25,WAREHOUSE_PILE.x,.07,WAREHOUSE_PILE.z,'#7c5d38',true);
 // the order table (tickets arrive in step 3): a counter with a printer, a clipboard and a lamp; a yard hand stands behind it
 box(2.4,.95,.9,WAREHOUSE_TABLE.x,.475,WAREHOUSE_TABLE.z,'#5a4430',true);box(2.55,.08,1.05,WAREHOUSE_TABLE.x,.98,WAREHOUSE_TABLE.z,'#d8c8a8');box(.5,.24,.4,WAREHOUSE_TABLE.x-.6,1.14,WAREHOUSE_TABLE.z,'#2f3d3b');box(.34,.02,.26,WAREHOUSE_TABLE.x+.6,1.03,WAREHOUSE_TABLE.z,'#efe6cf');
 const lamp=box(.05,.14,.14,WAREHOUSE_TABLE.x-.3,1.3,WAREHOUSE_TABLE.z-.3,'#3a9a52');lamp.material=new T.MeshStandardMaterial({color:'#3a9a52',emissive:new T.Color('#2f9a4a'),emissiveIntensity:.8});
 box(.9,2.2,.5,-16.2,1.1,11.5,'#5f7a72',true);box(.9,2.2,.5,-15.2,1.1,11.5,'#5f7a72',true); // two lockers
 // staging: three pallets on painted squares (a ticket's planks wait here until the order is loaded)
 for(const p of WAREHOUSE_STAGING){box(1.7,.004,1.6,p.x,.004,p.z,'#d9b82c');box(1.4,.14,1.25,p.x,.07,p.z,'#7c5d38',true)}
 // the company name on the back wall, a bench and a hard hat by the door, a plant, a stack of empty pallets in the back-left corner
 const board=createNameBoard({text:name,width:7,height:1.3});board.mesh.position.set(0,5.6,-D+.1);scene.add(board.mesh);
 box(.5,.5,2.2,-3.6,.25,10.4,'#7a5f3e',true);box(.3,.2,.34,-3.6,.6,10,'#d8b429');box(.55,.7,.55,3.6,.35,10.6,'#8c6a4c');box(.45,.55,.45,3.6,.95,10.6,'#4f7d4c');
 for(let i=0;i<5;i++)box(1.2,.14,1.0,-15.6,.07+i*.15,-9.4,'#7c5d38',i===0);
 const clerk=createCharacter(outfit('male','Worker',{hair:'#3a2a1c',skin:'#c99a78'}));clerk.group.name='warehouse-hand';clerk.group.position.set(WAREHOUSE_TABLE.x,.02,WAREHOUSE_TABLE.z-.95);scene.add(clerk.group);
 const exitSpec=spec?.exitDoor||{kind:'double',z:11.96,width:2.2,height:2.7,near:{halfWidth:2.4,z:9.7},trigger:{halfWidth:.9,z:11.3}},exitDoor=(exitSpec.kind==='double'?createDoubleDoor:createSlidingDoor)({width:exitSpec.width,height:exitSpec.height});exitDoor.group.position.set(0,0,exitSpec.z);scene.add(exitDoor.group);

 // the planks on the shelves and on the delivery pile: one board per plank (racks: {B4-1: n, ...}; pile: the yard stock, at most PILE_CAP drawn)
 const pos=new T.Vector3(),q=new T.Quaternion(),one=new T.Vector3(1,1,1);let shown='';
 function set(racks,pile,staged){
  const key=JSON.stringify([racks,pile,staged]);if(key===shown)return;shown=key;
  const fill=(mesh,spots)=>{let n=0;for(const {cx,cz,base,count,seed} of spots)for(let i=0;i<count;i++){const b=boardAt(i),wob=(i*7+seed)%5-2;pos.set(cx+b.x+wob*.004,base+b.y,cz);m4.compose(pos,q,one);mesh.setMatrixAt(n,m4);mesh.setColorAt(n,TONES[(i+seed)%TONES.length]);n++}mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true};
  for(const [id,{mesh}] of unitMeshes)fill(mesh,RACK_SLOTS.map((s,k)=>({s,k})).filter(({s})=>unitOfFace(s.face)===id&&(racks?.[s.id]||0)>0).map(({s,k})=>({cx:s.x,cz:s.z,base:s.y,count:Math.min(RACK_CAP,racks[s.id]),seed:k})));
  fill(pileBoards,[{cx:WAREHOUSE_PILE.x,cz:WAREHOUSE_PILE.z,base:.14,count:Math.min(PILE_CAP,pile||0),seed:3}]);
  fill(stagingBoards,WAREHOUSE_STAGING.map((p,i)=>({cx:p.x,cz:p.z,base:.14,count:Math.min(PILE_CAP,staged?.[i]||0),seed:i+5})));
 }
 set({},0,[0,0,0]); return {scene,occluders,glass:[],clerk,exitDoor,board,lamp,blocked(x,z){return Math.abs(x)>W-.45||Math.abs(z)>D-.45||blocks.some(b=>Math.abs(x-b.x)<b.hx+.32&&Math.abs(z-b.z)<b.hz+.32)},setStock:set,boards:()=>[...unitMeshes.values()].reduce((n,u)=>n+u.mesh.count,pileBoards.count+stagingBoards.count)};
}

// The person door on the warehouse's outside wall (the building model has only the loading door): a steel frame and a door slab with a small window, a canopy and a lamp. Local frame:
// the origin is on the wall face, +z points out into the yard; the game turns it by the door's yaw. Static: the doors you walk through are the fade to the interior.
export function createWarehouseDoorway(){
 const g=new T.Group();g.name='warehouse-doorway';const part=(w,h,d,x,y,z,c,emit)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.7,...(emit?{emissive:new T.Color(emit),emissiveIntensity:.9}:{})}));m.position.set(x,y,z);m.castShadow=true;g.add(m);return m};
 part(.14,2.3,.2,-.62,1.15,.1,'#3d4442');part(.14,2.3,.2,.62,1.15,.1,'#3d4442');part(1.4,.14,.2,0,2.3,.1,'#3d4442');
 part(1.1,2.15,.08,0,1.08,.04,'#46605a');part(.5,.5,.09,0,1.5,.045,'#9fb7c2');part(.06,.18,.1,.4,1.05,.06,'#c8af70');
 part(1.9,.08,1,0,2.62,.5,'#4d5654');for(const s of [-1,1])part(.06,.3,.06,s*.85,2.45,.9,'#4d5654');
 part(.16,.1,.16,0,2.5,.12,'#f3e7b0','#f1d98a');
 return g;
}
