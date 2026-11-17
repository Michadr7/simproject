// Company offices (0.35, DESIGN 4.15 E): the interior room and the name sign of an employer's office. Built like a shop room (shops.js) so the game treats it the same way:
// {scene, occluders, glass, clerk, exitDoor, blocked}. The room sits far from the map (MAP.offices[].interior.origin) and is shown only while the player is inside.
// Local frame (the shops' layout): the room is 12 x 10 m, the door in the front wall at z = +5 (the camera looks in from there), the owner behind the counter at the back (z = -3.5),
// the time clock on the right wall, the notice board and lockers on the left wall.
import * as T from './vendor/three.module.js';
import {createCharacter} from './character.js';
import {outfit} from './appearance.js';
import {createSlidingDoor,createDoubleDoor} from './doors.js';
import {addWaterCooler,COOLER_SIZE} from './water-cooler-view.js';

export const OFFICE_CLOCK={x:5.6,z:-.6},OFFICE_BOARD={x:-5.6,z:-.6},OFFICE_COUNTER={x:0,z:-2},OFFICE_STORE={x:4.2,z:-3.3},OFFICE_COOLER={x:5.45,z:1.6}; // OFFICE_STORE: the company store's shelf, at the back right
const makeCanvas=()=>document.createElement('canvas');
// A name board drawn on a canvas, so a renamed company redraws one texture (DESIGN 4.15: names are data, never literals).
export function createNameBoard({width=3.4,height=.7,text,fg='#f5c518',bg='#17301f',makeCanvasFn=makeCanvas}){
 const canvas=makeCanvasFn();canvas.width=1024;canvas.height=Math.round(1024*height/width);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,toneMapped:false}));mesh.name='name-board';
 let shown=null;
 function draw(name){
  if(name===shown)return;shown=name;const g=canvas.getContext('2d');if(!g)return;
  g.fillStyle=bg;g.fillRect(0,0,canvas.width,canvas.height);g.strokeStyle=fg;g.lineWidth=10;g.strokeRect(14,14,canvas.width-28,canvas.height-28);
  let size=Math.round(canvas.height*.46);g.textAlign='center';g.textBaseline='middle';g.fillStyle=fg;
  do{g.font=`bold ${size}px Arial, Helvetica, sans-serif`;size-=4}while(size>20&&g.measureText(name.toUpperCase()).width>canvas.width-90);
  g.fillText(name.toUpperCase(),canvas.width/2,canvas.height/2+4);texture.needsUpdate=true;
 }
 draw(text);
 return {mesh,setName:draw,dispose(){texture.dispose();mesh.geometry.dispose();mesh.material.dispose()}};
}

export function createOffice({name,ownerName='Walt Hargrove',spec}){
 const scene=new T.Group();scene.name='office-interior';const occluders=[],blocks=[];
 function box(w,h,d,x,y,z,c,solid=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85}));m.position.set(x,y,z);scene.add(m);if(y>0)occluders.push(m);if(solid)blocks.push({x,z,hx:w/2,hz:d/2});return m}
 // floor: boards; walls: pale green plaster over a wood skirting; the front wall has the door gap
 box(12,.2,10,0,-.1,0,'#8d6f4d');for(let x=-6;x<=6;x+=1)box(.015,.004,10,x,.002,0,'#76593b');
 box(12,3.4,.16,0,1.7,-5,'#cbd2b3',true);for(const x of [-6,6])box(.16,3.4,10,x,1.7,0,'#b8c1a0',true);
 box(12,.35,.2,0,.175,-4.95,'#5f4630');for(const x of [-5.95,5.95])box(.2,.35,10,x,.175,0,'#5f4630');
 const gap=spec?.exitDoor?.width||2.2;for(const side of [-1,1])box(6-gap/2,3.4,.16,side*(6-(6-gap/2)/2),1.7,5,'#b8c1a0',true);box(gap,.7,.16,0,3.05,5,'#b8c1a0');
 // the owner's counter and the shelves behind it
 box(4.4,1,.9,0,.5,-3.2,'#5a4430',true);box(4.6,.1,1.05,0,1.05,-3.2,'#d8c8a8');box(.5,.32,.36,-1.4,1.26,-3.2,'#2f3d3b');box(.34,.04,.26,.6,1.12,-3.2,'#efe6cf');
 for(const x of [-4.2,4.2])box(1.6,2,.5,x,1,-4.6,'#6b563d',true);for(const x of [-4.2,4.2])for(const y of [.6,1.2,1.8])box(1.5,.06,.46,x,y,-4.6,'#a58b63');
 // the company store: a glass-fronted display of tools on the back-right shelf (the chainsaws, in a rack)
 box(1.7,.12,.7,4.2,.06,-4.1,'#4b3a28');box(.05,.9,.5,3.6,.75,-4.45,'#3d3d3a');box(.05,.9,.5,4.8,.75,-4.45,'#3d3d3a');for(const x of [3.9,4.5])box(.4,.12,.14,x,1.05,-4.5,'#c9702a');
 // the time clock on the right wall: a grey box, a green light and a card rack
 const clock=box(.2,.7,.5,OFFICE_CLOCK.x+.2,1.5,OFFICE_CLOCK.z,'#4d5654');const lamp=box(.05,.12,.12,OFFICE_CLOCK.x+.07,1.7,OFFICE_CLOCK.z,'#3a9a52');lamp.material.emissive=new T.Color('#2f9a4a');lamp.material.emissiveIntensity=.8;box(.05,.34,.34,OFFICE_CLOCK.x+.07,1.3,OFFICE_CLOCK.z,'#d2d0c4');
 // the notice board on the left wall, with notes pinned to it; lockers beside it
 box(.1,1.2,2.2,OFFICE_BOARD.x-.2,1.7,OFFICE_BOARD.z,'#7d5f3d');box(.06,1,2,OFFICE_BOARD.x-.14,1.7,OFFICE_BOARD.z,'#a9794c');
 for(const [dz,dy,c] of [[-.6,1.95,'#f1ebd9'],[.1,1.9,'#e9d27a'],[.7,1.6,'#f1ebd9'],[-.2,1.5,'#9fc4a2']])box(.03,.3,.24,OFFICE_BOARD.x-.1,dy,OFFICE_BOARD.z+dz,c);
 for(let i=0;i<4;i++)box(.5,2,.6,-5.7,1,-3.7+i*.65-1.1+1.1,'#5f7a72',true);
 // the water cooler on the right wall (the project owner's model, water-cooler-view.js; a hidden box is its collider)
 box(COOLER_SIZE.d,COOLER_SIZE.h,COOLER_SIZE.w,OFFICE_COOLER.x,COOLER_SIZE.h/2,OFFICE_COOLER.z,'#e8ebe9',true).visible=false;addWaterCooler(scene,{x:OFFICE_COOLER.x,z:OFFICE_COOLER.z,yaw:-Math.PI/2});
 // a bench and a hard hat by the door, a rug, a plant
 box(.5,.5,2.2,3.6,.25,3.8,'#7a5f3e',true);box(.3,.2,.34,3.6,.6,3.4,'#d8b429');box(3,.02,1.8,0,.01,2.2,'#5f7466');box(.55,.7,.55,-4.8,.35,3.9,'#8c6a4c');box(.45,.55,.45,-4.8,.95,3.9,'#4f7d4c');
 // the company name on the back wall
 const board=createNameBoard({text:name,width:4.2,height:.8});board.mesh.position.set(0,2.65,-4.9);scene.add(board.mesh);
 const clerk=createCharacter(outfit('male','Suit',{hair:'#a8aaa5',skin:'#d9ae8d'}));clerk.group.name='office-owner';clerk.group.position.set(0,.02,-4.15);scene.add(clerk.group);
 const exitSpec=spec?.exitDoor||{kind:'double',z:4.96,width:2.2,height:2.7,near:{halfWidth:2.4,z:2.7},trigger:{halfWidth:.9,z:4.3}},exitDoor=(exitSpec.kind==='double'?createDoubleDoor:createSlidingDoor)({width:exitSpec.width,height:exitSpec.height});exitDoor.group.position.set(0,0,exitSpec.z);scene.add(exitDoor.group);
 const interior={blocked(x,z){return Math.abs(x)>5.55||Math.abs(z)>4.55||blocks.some(b=>Math.abs(x-b.x)<b.hx+.32&&Math.abs(z-b.z)<b.hz+.32)}};
 return {scene,occluders,glass:[],clerk,exitDoor,board,blocked:interior.blocked,lamp,ownerName};
}
