// Oak Street Apartments ground-floor lobby, elevator directory & residential hallways (Step 1).
import * as T from './vendor/three.module.js';
import {createDoubleDoor} from './doors.js';
import {propInfo,createProp} from './props.js';
import {createCharacter} from './character.js';
import {outfit} from './appearance.js';
import {unitsOnFloor,STUDIO_DOOR_X} from './apartment-visits.js';

export const LOBBY_ORIGIN=Object.freeze({x:420,y:0.165,z:1200});
export const LOBBY_ENTRY=Object.freeze({x:0,z:4.5});
export const LOBBY_EXIT=Object.freeze({x:0,z:5.6});
export const LOBBY_DESK=Object.freeze({x:-3.2,z:-1.8});
export const LOBBY_MAILBOXES=Object.freeze({x:-5.8,z:1.2});
export const LOBBY_ELEVATOR=Object.freeze({x:2.8,z:-4.6});

export const HALLWAY_ORIGIN=Object.freeze({x:420,y:0.165,z:1260});
export const HALLWAY_ENTRY=Object.freeze({x:0,z:1.75});
export const HALLWAY_ELEVATOR=Object.freeze({x:0,z:2.35});

export const ELEVATOR_UNITS=Object.freeze([
 {floor:1,id:'lobby',label:'Floor 1 · Lobby (Oak Street Exit)'},
 {floor:2,id:'studio',label:'Floor 2 · Studio 2B (Your Apartment)'},
 {floor:3,id:'npc-3a',label:'Floor 3 · Unit 3A (Alex Rivera)',npc:'Alex Rivera',note:'Alex is out on his afternoon walk. Left a spare key note by the mailboxes.'},
 {floor:4,id:'npc-4b',label:'Floor 4 · Unit 4B (Samira Patel)',npc:'Samira Patel',note:'Samira is at work in Ironwood. Leave a note anytime.'}
]);

export function elevatorChoices({rented=false,otherPlayers=[]}={}){
 const list=[
  {floor:2,id:'studio',label:rented?'Floor 2 · Studio 2B (Your Apartment)':'Floor 2 · Studio 2B (Rent at Desk first)',locked:!rented},
  ...ELEVATOR_UNITS.filter(u=>u.floor>=3)
 ];
 for(const p of otherPlayers){
  if(p?.name)list.push({floor:5,id:'player:'+p.id,label:`Floor 5 · ${p.name}'s Studio (Co-op)`,player:p});
 }
 return list;
}

function addLobbyFrontWall(parent,zFront,{occluders=null,blocks=null,lintelColor='#d7cfbe',sillColor='#c2b9a7'}={}){
 const door=createDoubleDoor({width:2.3,height:2.55,glass:true});
 door.group.position.set(0,0,zFront);parent.add(door.group);
 const frameMat=new T.MeshStandardMaterial({color:'#25413c',roughness:.6});
 const sillMat=new T.MeshStandardMaterial({color:sillColor,roughness:.85});
 const lintelMat=new T.MeshStandardMaterial({color:lintelColor,roughness:.85});
 const glassMat=new T.MeshStandardMaterial({color:'#b9dcd9',roughness:.12,metalness:.12,transparent:true,opacity:.2,depthWrite:false});
 const part=(w,h,d,x,y,z,mat,solid=false,occlude=false)=>{
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);
  if(occlude&&occluders)occluders.push(m);
  if(solid&&blocks)blocks.push({x,z,hx:w/2,hz:d/2});
  return m;
 };
 const glass=[];
 // Continuous transom header across front bay (y: 2.65..3.45)
 part(14,.8,.18,0,3.05,zFront,lintelMat,false,true);
 // Framed glass sidelights flanking the double door (x = +-1.66)
 for(const s of [-1,1]){
  const gp=part(.6,2.43,.03,s*1.66,1.275,zFront,glassMat,false,false);
  gp.name='lobby-storefront-glass';gp.renderOrder=2;glass.push(gp);
  part(.08,2.6,.12,s*2.0,1.3,zFront,frameMat,false,true);
  part(.68,.08,.1,s*1.66,.04,zFront,frameMat,false,true);
  part(.68,.12,.12,s*1.66,2.59,zFront,frameMat,false,true);
 }
 // Wide picture windows on both sides of the entrance (x = +-4.50)
 for(const s of [-1,1]){
  part(4.9,.36,.18,s*4.5,.18,zFront,sillMat,true,true);
  const gp=part(4.82,2.24,.03,s*4.5,1.48,zFront,glassMat,false,false);
  gp.name='lobby-storefront-glass';gp.renderOrder=2;glass.push(gp);
  part(4.9,.08,.12,s*4.5,.36,zFront,frameMat,false,true);
  part(4.9,.12,.12,s*4.5,2.59,zFront,frameMat,false,true);
  part(.08,2.3,.12,s*4.5,1.48,zFront,frameMat,false,true);
  part(.08,2.3,.12,s*6.95,1.48,zFront,frameMat,false,true);
 }
 return {door,glass};
}

function populateLobbyInterior(parent,{blocks=null,occluders=null,warmGlow=false}={}){
 const box=(w,h,d,x,y,z,c,solid=false,occlude=false)=>{
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85,...(warmGlow?{emissive:'#352d22',emissiveIntensity:.45}:{})}));
  m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);
  if(occlude&&occluders)occluders.push(m);
  if(solid&&blocks)blocks.push({x,z,hx:w/2,hz:d/2});
  return m;
 };
 // Floor & interior perimeter walls (14 x 12 m)
 box(14,.2,12,0,-.1,0,'#c8bfae');
 if(warmGlow)box(14,.14,12,0,3.38,0,'#efe9dc');
 box(14,3.4,.18,0,1.7,-6,'#e3dccd',true,true);
 box(.18,3.4,12,-7,1.7,0,'#d7cfbe',true,true);
 box(.18,3.4,12,7,1.7,0,'#d7cfbe',true,true);

 // Elevator alcove on north wall (x: 2.8, z: -5.85)
 box(2.4,2.8,.2,2.8,1.4,-5.85,'#4e575e',true);
 box(1.8,2.4,.08,2.8,1.2,-5.72,'#9aa4ab');
 box(.04,2.4,.09,2.8,1.2,-5.7,'#384047');
 box(.16,.36,.08,1.5,1.25,-5.8,'#d9c48c'); // call panel

 // Mailboxes on west wall
 box(.4,1.6,2.4,-6.7,1.1,1.2,'#6b747a',true);
 for(let r=0;r<3;r++)for(let c=0;c<3;c++)box(.06,.24,.55,-6.48,1.55-r*.32,0.5+c*.7,'#b5bcc2');

 // Real Kenney furniture props
 const put=(id,x,z,yaw=0,solid=true)=>{
  try{
   const m=createProp(id,{apply:mat=>mat});m.position.set(x,0,z);m.rotation.y=yaw;parent.add(m);
   if(solid&&blocks){const info=propInfo(id),s=Math.round(Math.sin(yaw)),c=Math.round(Math.cos(yaw));
    for(const b of info.colliders||[])blocks.push({x:x+b.x*c+b.z*s,z:z-b.x*s+b.z*c,hx:s?b.hz:b.hx,hz:s?b.hx:b.hz});}
  }catch{}
 };
 put('f-desk',-3.4,-2.8,0);
 put('f-desk-chair',-2.35,-3.95,-0.5);
 put('f-sofa',3.8,1.2,-Math.PI/2);
 put('f-coffee-table',2.1,1.2,0);
 put('f-rug',2.8,1.2,0,false);
 put('f-plant',-5.8,-4.8,0);
 put('f-plant',5.8,-4.8,0);
 put('f-lamp',5.6,2.6,0);

 // Lobby concierge behind desk
 const clerk=createCharacter(outfit('female','Formal',{hair:'#3e2b20'}));
 clerk.group.position.set(-3.4,.02,-3.65);parent.add(clerk.group);
 return clerk;
}

export function createApartmentLobby(){
 const scene=new T.Scene();scene.name='oak-lobby';scene.background=new T.Color('#9fc1d6');
 scene.add(new T.HemisphereLight('#fff1da','#898878',1.9));
 const sun=new T.DirectionalLight('#fff2da',1.8);sun.position.set(2,6,3);scene.add(sun);
 scene.position.set(LOBBY_ORIGIN.x,LOBBY_ORIGIN.y,LOBBY_ORIGIN.z);
 const occluders=[],blocks=[];
 const clerk=populateLobbyInterior(scene,{blocks,occluders,warmGlow:false});
 const front=addLobbyFrontWall(scene,6,{occluders,blocks});

 // Exterior Oak Street vista visible outside the see-through entrance doors & lobby windows (z > 6)
 const vista=(w,h,d,x,y,z,c)=>{
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.9}));
  m.position.set(x,y,z);scene.add(m);return m;
 };
 vista(44,.16,4.6,0,-.08,8.4,'#b7b6a8'); // front sidewalk
 vista(44,.16,12,0,-.18,16.7,'#535d60'); // Oak Street asphalt
 for(let x=-16;x<=16;x+=8)vista(3,.02,.18,x,-.09,16.7,'#d9d5bb'); // lane dashes
 vista(44,.16,4,0,-.08,24.7,'#b7b6a8'); // far sidewalk
 vista(18,11,12,-10,5.5,33,'#c4b298'); // across-street buildings
 vista(17,14,12,12,7,34,'#929e9a');
 for(const px of [-6.0,6.0]){
  vista(1.4,.65,.7,px,.33,7.1,'#b4ab94');
  for(const dx of [-.4,0,.4]){const pl=new T.Mesh(new T.IcosahedronGeometry(.42,1),new T.MeshStandardMaterial({color:'#607a4d'}));pl.position.set(px+dx,.88,7.1);scene.add(pl)}
 }

 const blocked=(x,z)=>Math.abs(x)>6.5||z<-5.4||z>5.6||blocks.some(b=>Math.abs(x-b.x)<b.hx+.3&&Math.abs(z-b.z)<b.hz+.3);
 return {scene,occluders,glass:front.glass,exitDoor:front.door,clerk,blocked};
}

export function buildOakLobbyExterior(scene,originX=1,frontZ=-8.5){
 const group=new T.Group();group.name='oak-lobby-exterior';
 group.position.set(originX,.165,frontZ-6);
 const clerk=populateLobbyInterior(group,{warmGlow:true});
 const front=addLobbyFrontWall(group,6,{lintelColor:'#d6d2c4',sillColor:'#c9c3b4'});
 scene.add(group);
 return {group,door:front.door,glass:front.glass,clerk};
}

function makeDoorPlaque(label,bg='#2b3f3b',fg='#f1ebd9'){
 if(typeof document!=='undefined'&&typeof document.createElement==='function'){
  try{
   const c=document.createElement('canvas');c.width=256;c.height=64;
   const g=c.getContext?.('2d');
   if(g){
    g.fillStyle=bg;g.fillRect(0,0,256,64);
    g.strokeStyle='#d9c48c';g.lineWidth=4;g.strokeRect(4,4,248,56);
    g.fillStyle=fg;g.font='bold 28px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.fillText(label,128,33);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
    return new T.MeshStandardMaterial({map:tex,roughness:.5});
   }
  }catch{}
 }
 return new T.MeshStandardMaterial({color:'#d9c48c',roughness:.5});
}

export function createApartmentHallway(floor=2){
 const scene=new T.Scene();scene.name='oak-hallway-'+floor;scene.background=new T.Color('#b8b5a4');
 scene.add(new T.HemisphereLight('#fff2df','#898878',1.95));
 const sun=new T.DirectionalLight('#fff2da',1.65);sun.position.set(1.5,6,2.5);scene.add(sun);
 scene.position.set(HALLWAY_ORIGIN.x,HALLWAY_ORIGIN.y,HALLWAY_ORIGIN.z);
 const occluders=[],blocks=[];
 const box=(w,h,d,x,y,z,c,solid=false,occlude=false)=>{
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85}));
  m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);
  if(occlude)occluders.push(m);
  if(solid)blocks.push({x,z,hx:w/2,hz:d/2});
  return m;
 };

 // Floor, woven carpet runner, and corridor perimeter (14 x 6.4 m)
 box(14,.2,6.4,0,-.1,0,'#c8bfae');
 box(12.4,.015,2.4,0,.008,-.2,'#b59a72');
 box(12.2,.02,2.1,0,.012,-.2,'#6d4c41');
 box(14,3.4,.18,0,1.7,-3.2,'#e3dccd',true,true);
 box(14,3.4,.18,0,1.7,3.2,'#d7cfbe',true,true);
 box(.18,3.4,6.4,-7,1.7,0,'#d7cfbe',true,true);
 box(.18,3.4,6.4,7,1.7,0,'#d7cfbe',true,true);

 // Baseboards & warm wall sconces
 for(const z of [-3.09,3.09])box(13.8,.14,.04,0,.07,z,'#8c7a62');
 for(const x of [-4.5,0,4.5]){
  box(.22,.28,.12,x,2.25,3.06,'#3a3530');
  box(.16,.14,.08,x,2.35,3.04,'#ffe7b3');
 }
 {
  const flPlaque=new T.Mesh(new T.BoxGeometry(.85,.28,.04),makeDoorPlaque('FLOOR '+floor));
  flPlaque.position.set(1.5,1.95,3.08);scene.add(flPlaque);
 }

 // Elevator alcove on south wall (x = 0, z = 3.05)
 box(2.4,2.8,.2,0,1.4,3.05,'#4e575e',true);
 box(1.8,2.4,.08,0,1.2,2.93,'#9aa4ab');
 box(.04,2.4,.09,0,1.2,2.91,'#384047');
 box(.16,.36,.08,-1.35,1.25,2.99,'#d9c48c');

 // Corner plants (clear of all doors and standing zones)
 for(const [px,pz] of [[-6.0,2.2],[6.0,2.2],[-6.0,-2.2],[6.0,-2.2]]){
  try{
   const m=createProp('f-plant',{apply:mat=>mat});m.position.set(px,0,pz);scene.add(m);
   const info=propInfo('f-plant');for(const b of info.colliders||[])blocks.push({x:px+b.x,z:pz+b.z,hx:b.hx,hz:b.hz});
  }catch{}
 }

 // Numbered apartment doors along the north wall (z = -3.08)
 const specs=unitsOnFloor(floor).map(u=>({kind:'npc',unitId:u.id,personId:u.personId,unit:u.unit,name:u.name,x:u.doorX,color:'#7d563c'}));
 if(floor===2)specs.push({kind:'studio',unitId:'studio',personId:null,unit:'2B',name:'Studio 2B',x:STUDIO_DOOR_X,color:'#4b6b6c'});

 const doors=specs.map(s=>{
  const x=s.x,z=-3.08,standZ=-2.05;
  box(1.16,2.28,.06,x,1.14,z-.02,'#4a3c30'); // warm dark recess behind opened leaf
  box(.1,2.35,.14,x-.58,1.175,z+.02,'#3b2d23');
  box(.1,2.35,.14,x+.58,1.175,z+.02,'#3b2d23');
  box(1.26,.12,.14,x,2.35,z+.02,'#3b2d23');
  box(1.05,.018,.6,x,.009,-2.45,'#57463b'); // welcome mat
  const plaque=new T.Mesh(new T.BoxGeometry(.82,.22,.04),makeDoorPlaque(s.kind==='studio'?'STUDIO 2B':'UNIT '+s.unit));
  plaque.position.set(x,2.56,z+.04);scene.add(plaque);

  const pivot=new T.Group();pivot.position.set(x-.54,0,z+.03);
  const leaf=new T.Mesh(new T.BoxGeometry(1.08,2.24,.07),new T.MeshStandardMaterial({color:s.color,roughness:.75}));
  leaf.position.set(.54,1.12,0);pivot.add(leaf);
  const knob=new T.Mesh(new T.BoxGeometry(.1,.05,.12),new T.MeshStandardMaterial({color:'#d9c48c',roughness:.35}));
  knob.position.set(.96,1.0,.05);pivot.add(knob);
  scene.add(pivot);
  const setOpen=open=>{pivot.rotation.y=open?1.15:0};
  return {kind:s.kind,unitId:s.unitId,personId:s.personId,unit:s.unit,name:s.name,x,z,standZ,setOpen};
 });

 // Reusable doorway resident avatar revealed when someone answers a knock
 const doorNpc=createCharacter(outfit('female','Casual_2',{}));
 doorNpc.group.visible=false;scene.add(doorNpc.group);
 const hideDoorNpc=()=>{doorNpc.group.visible=false;doorNpc.setMotion(0);for(const d of doors)d.setOpen(false)};
 const showDoorNpc=(look,door)=>{
  hideDoorNpc();
  if(look)doorNpc.apply(look);
  doorNpc.group.position.set(door.x,.02,door.z+.46);
  doorNpc.group.rotation.y=0;
  doorNpc.group.visible=true;
  door.setOpen(true);
 };

 const blocked=(x,z)=>Math.abs(x)>6.45||z<-2.55||z>2.65||blocks.some(b=>Math.abs(x-b.x)<b.hx+.3&&Math.abs(z-b.z)<b.hz+.3);
 return {scene,storey:floor,occluders,doors,doorNpc,showDoorNpc,hideDoorNpc,blocked};
}
