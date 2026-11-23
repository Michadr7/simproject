import * as T from './vendor/three.module.js';
import {createCharacter} from './character.js';
import {outfit} from './appearance.js';
import {MAP} from './map-definition.js';
import {ID as WHOLESALE_ID} from './eden-wholesale.js';
import {createSlidingDoor,createDoubleDoor} from './doors.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {propInfo,createProp} from './props.js';
// Where each shop's door is and where you stand outside it (see map-definition.js).
export const SHOPS=Object.fromEntries(Object.entries(MAP.shops).map(([kind,shop])=>[kind,{name:shop.name,x:shop.x,z:shop.z}]));
// Interior placements come from the map (both shops share one layout).
const layout=MAP.shops.market.interior;
export const WHOLESALE_INTERIOR=Object.freeze({...layout,origin:Object.freeze({x:460,y:.165,z:1500})});
export const SHOP_ENTRY=layout.spawn,SHOP_EXIT=layout.exit,COUNTER=layout.counter;
export function createShop(kind){const cafe=kind==='cafe',wholesale=kind===WHOLESALE_ID,scene=new T.Group();scene.name=kind+'-interior';const occluders=[],blocks=[],litMeshes=[];
 function box(w,h,d,x,y,z,c,solid=false,occlude=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85}));m.position.set(x,y,z);m.userData.baseColor=m.material.color.clone();scene.add(m);litMeshes.push(m);if(occlude&&y>0)occluders.push(m);if(solid)blocks.push({x,z,hx:w/2,hz:d/2});return m}
 const rw=cafe?14:12,rz0=cafe?-9.8:-5,rz1=5,rd=rz1-rz0,rcz=(rz0+rz1)/2,hw=rw/2;
 box(rw,.2,rd,0,-.1,rcz,cafe?'#ad9271':wholesale?'#a9aaa2':'#c5c5b2');for(let x=-hw;x<=hw;x+=1)box(.015,.004,rd,x,.002,rcz,'#a59d88');
 box(rw,3.4,.16,0,1.7,rz0,cafe?'#d6c7ac':'#d3dccb',true,true);for(const x of [-hw,hw])box(.16,3.4,rd,x,1.7,rcz,cafe?'#d6c7ac':'#b1bfad',true,true);
 if(cafe){
  for(const [w,x] of [[1.7,-6.15],[7.8,0.2],[1.5,6.25]])box(w,3.4,.16,x,1.7,-5,'#d6c7ac',true,true).userData.partition=true; // kitchen & restroom partition walls
  for(const [w,x] of [[1.6,-4.5],[1.4,4.8]])box(w,.7,.16,x,3.05,-5,'#d6c7ac',false,true).userData.partition=true; // doorway lintels
  box(.16,3.4,4.8,2.6,1.7,-7.4,'#d6c7ac',true,true).userData.partition=true; // kitchen / restroom divider
  box(4.25,.04,4.65,4.8,.01,-7.4,'#d8dee0'); // tiled restroom floor
 }
 if(cafe||wholesale)box(rw,.12,rd,0,3.4,rcz,cafe?'#e8e0cf':'#e1dfcf');
 // A real window opening: opaque walls stop at sill and lintel.
 for(const x of cafe?[-4.135,4.135]:[-3.635,3.635])box(cafe?5.73:4.73,.3,.16,x,.15,5,'#b1bfad',false,true); // sill either side of the doorway, not across it
 box(rw,.52,.16,0,3.14,5,'#b1bfad',false,true);
 const glass=[],gw=cafe?5.65:4.65,gx=cafe?4.095:3.595;for(const x of [-gx,gx]){const pane=box(gw,2.6,.025,x,1.6,5,'#c1e0df');pane.name='storefront-glass';pane.material.transparent=true;pane.material.opacity=.14;pane.material.depthWrite=false;pane.material.roughness=.12;pane.material.side=T.FrontSide;pane.renderOrder=2;litMeshes.splice(litMeshes.indexOf(pane),1);glass.push(pane);for(const dx of x<0?[-gw/2,0]:[0,gw/2])box(.065,2.6,.1,x+dx,1.6,5,'#44675c',false,true)}
 const doorBits=[];
 const cw=cafe?6.2:4;
 const counter=box(cw,1,1,0,.5,-3.5,cafe?'#735b45':wholesale?'#2f8154':'#6e8b72',true);counter.name='shop-counter';box(cw+.2,.1,1.15,0,1.05,-3.5,'#ded2b8');const regBox=box(.45,.35,.35,1.2,1.28,-3.5,'#344b49');
 const clerk=createCharacter(cafe?outfit('female','Formal',{hair:'#825337'}):wholesale?outfit('female','Casual'):outfit('male','Casual_2'));clerk.group.position.set(0,.02,-4.35);scene.add(clerk.group);
 const putProp=(id,x,z,yaw=0,solid=true)=>{try{const m=createProp(id,{apply:mat=>mat});m.name=id;m.position.set(x,0,z);m.rotation.y=yaw;scene.add(m);if(solid){const info=propInfo(id),s=Math.round(Math.sin(yaw)),c=Math.round(Math.cos(yaw));for(const b of info.colliders||[])blocks.push({x:x+b.x*c+b.z*s,z:z-b.x*s+b.z*c,hx:s?b.hz:b.hx,hz:s?b.hx:b.hz})}}catch{}};
 if(cafe){
  for(const x of [-3.8,3.8])for(const z of [-.7,2]){putProp('f-table',x,z,0);putProp('f-chair',x,z-.9,0);putProp('f-chair',x,z+.9,Math.PI)}
  for(const x of [-6.1,6.1]){putProp('f-sofa',x,.6,x<0?Math.PI/2:-Math.PI/2);putProp('f-plant',x,-4.1,0);putProp('f-plant',x,4.1,0)}
  // Back kitchen (x: -6.9..2.5, z: -9.7..-5.1)
  box(7.42,.1,.78,-3.19,.05,-9.29,'#544232');const kCounter=box(7.42,.66,.9,-3.19,.43,-9.24,'#735b45',true);kCounter.name='kitchen-counter';box(7.44,.08,.92,-3.19,.8,-9.24,'#ded2b8');box(7.44,.06,.06,-3.19,.87,-9.67,'#ded2b8');
  putProp('f-sink',.96,-9.24,Math.PI);putProp('f-fridge',1.96,-9.28,Math.PI);putProp('f-table',.5,-5.65,0);
  // Restroom (x: 2.7..6.9, z: -9.7..-5.1)
  putProp('f-toilet',6.0,-8.8,Math.PI);putProp('f-bath-sink',3.5,-9.38,Math.PI);box(.9,1.1,.06,3.5,1.65,-9.68,'#c8dfe4');putProp('f-lamp',6.2,-5.8,0);
  const machBox=box(.9,.55,.55,-6.25,1.115,-9.18,'#455953');
  if(globalThis.document?.baseURI){const loader=new GLTFLoader();for(const [file,x,y,z,hide] of [['espresso_machine',-6.25,.84,-9.18,machBox],['coffee_grinder',-5.55,.84,-9.18,null],['cash_register',.85,1.1,-3.5,regBox],['menu_board',0,1.95,-4.88,null],['flat_grill',-2.35,.84,-9.18,null],['pizza_oven',-.8,.84,-9.18,null],['prep_board',-4.05,.84,-9.15,null]])loader.loadAsync(new URL(`./assets/diner/${file}.glb`,document.baseURI).href).then(g=>{g.scene.position.set(x,y,z);scene.add(g.scene);if(hide)hide.visible=false}).catch(()=>{})}
 }else{for(const x of [-4.6,4.6]){box(1.2,1.8,5,x,.9,-.3,'#718575',true);for(const y of [.55,1.15,1.75]){box(1.3,.08,5.1,x,y,-.3,'#b5baa5');for(let z=-2.4;z<2;z+=.65)box(.75,.32,.42,x,y+.2,z,(Math.round(z*10)%2)?'#c6a25f':'#a56e51')}}}
 const customer=cafe?createCharacter(outfit('female','Casual',{skin:'#d9ae8d',hair:'#bca06a'})):null;
 const customers=cafe?[customer,createCharacter(outfit('male','Casual_2')),createCharacter(outfit('female','Formal',{hair:'#5a3a28'})),createCharacter(outfit('male','Casual_Hoodie'))]:[]; // diner D-A2: one pooled customer per table (up to four seated), hidden until the shift seats them
 const usedCup=box(.13,.18,.13,-3.8,.97,-.7,'#eee5d1');usedCup.visible=false;
 const usedCups=[usedCup];if(cafe)for(const [x,z] of [[-3.8,2],[3.8,-.7],[3.8,2]]){const c=box(.13,.18,.13,x,.97,z,'#eee5d1');c.visible=false;usedCups.push(c)} // a used cup on each table that needs clearing
 for(const c of customers){c.group.name='cafe-customer';c.group.visible=false;scene.add(c.group)}
 const exitSpec=(wholesale?WHOLESALE_INTERIOR:MAP.shops[kind].interior).exitDoor,exitDoor=(exitSpec.kind==='double'?createDoubleDoor:createSlidingDoor)({width:exitSpec.width,height:exitSpec.height});exitDoor.group.name=kind+'-exit-door';exitDoor.group.position.set(0,0,exitSpec.z);scene.add(exitDoor.group);
 const zones=cafe?[
  {test:{minX:-7,maxX:7,minZ:-5,maxZ:5},clamp:{minX:-6.57,maxX:6.57,minZ:-4.72,maxZ:4.57}},
  {test:{minX:-7,maxX:2.6,minZ:-10,maxZ:-5},clamp:{minX:-6.57,maxX:2.28,minZ:-9.37,maxZ:-5.28}},
  {test:{minX:2.6,maxX:7,minZ:-10,maxZ:-5},clamp:{minX:2.92,maxX:6.57,minZ:-9.37,maxZ:-5.28}}
 ]:null;
 const bounds={halfW:hw-.43,minZ:rz0+.43,maxZ:rz1-.43,zones};
 return {scene,occluders,glass,doorBits,customer,customers,usedCup,usedCups,clerk,exitDoor,bounds,setLight(scale){const s=Math.max(.05,Math.min(1,scale));for(const m of litMeshes)m.material.color.copy(m.userData.baseColor).multiplyScalar(s)},blocked(x,z){return Math.abs(x)>(cafe?6.55:5.55)||z<(cafe?-9.35:-4.55)||z>4.55||blocks.some(b=>Math.abs(x-b.x)<b.hx+.32&&Math.abs(z-b.z)<b.hz+.32)}};
}
