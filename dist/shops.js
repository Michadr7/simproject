import * as T from './vendor/three.module.js';
import {createCharacter} from './character.js';
import {outfit} from './appearance.js';
import {MAP} from './map-definition.js';
import {createSlidingDoor} from './doors.js';
// Where each shop's door is and where you stand outside it (see map-definition.js).
export const SHOPS=Object.fromEntries(Object.entries(MAP.shops).map(([kind,shop])=>[kind,{name:shop.name,x:shop.x,z:shop.z}]));
// Interior placements come from the map (both shops share one layout).
const layout=MAP.shops.market.interior;
export const SHOP_ENTRY=layout.spawn,SHOP_EXIT=layout.exit,COUNTER=layout.counter;
export function createShop(kind){const cafe=kind==='cafe',scene=new T.Group();scene.name=kind+'-interior';const occluders=[],blocks=[];
 function box(w,h,d,x,y,z,c,solid=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85}));m.position.set(x,y,z);scene.add(m);if(y>0)occluders.push(m);if(solid)blocks.push({x,z,hx:w/2,hz:d/2});return m}
 box(12,.2,10,0,-.1,0,cafe?'#ad9271':'#c5c5b2');for(let x=-6;x<=6;x+=1)box(.015,.004,10,x,.002,0,'#a59d88');
 for(const z of [-5])box(12,3.4,.16,0,1.7,z,cafe?'#d6c7ac':'#d3dccb',true);for(const x of [-6,6])box(.16,3.4,10,x,1.7,0,'#b1bfad',true);
 // A real window opening: opaque walls stop at sill and lintel.
 for(const x of [-3.65,3.65])box(4.7,.3,.16,x,.15,5,'#b1bfad'); // sill either side of the doorway, not across it
 box(12,.45,.16,0,3.175,5,'#b1bfad');
 const glass=[];for(const x of [-3.55,3.55]){const pane=box(4.6,2.65,.025,x,1.625,5,'#c1e0df');pane.name='storefront-glass';pane.material.transparent=true;pane.material.opacity=.16;pane.material.depthWrite=false;pane.material.roughness=.12;occluders.splice(occluders.indexOf(pane),1);glass.push(pane);for(const dx of [-2.3,0,2.3])box(.065,2.7,.1,x+dx,1.65,5,'#44675c')}
 const door=box(1.7,2.7,.025,0,1.65,5,'#b8d8d5');door.name='glass-door';door.material.transparent=true;door.material.opacity=.12;door.material.depthWrite=false;occluders.splice(occluders.indexOf(door),1);glass.push(door);for(const x of [-.9,.9])box(.08,2.9,.13,x,1.6,5,'#44675c');box(.07,.35,.09,.62,1.35,5.06,'#d9c899');
 box(4,1,1,0,.5,-3.5,cafe?'#735b45':'#6e8b72',true);box(4.2,.1,1.15,0,1.05,-3.5,'#ded2b8');box(.45,.35,.35,1.2,1.28,-3.5,'#344b49');
 const clerk=createCharacter(cafe?outfit('female','Formal',{hair:'#825337'}):outfit('male','Casual_2'));clerk.group.position.set(0,.02,-4.35);scene.add(clerk.group);
 if(cafe){for(const x of [-3.8,3.8])for(const z of [-.7,2]){box(1.25,.1,1.05,x,.82,z,'#a98b61',true);box(.2,.8,.2,x,.4,z,'#4a5950');for(const dz of [-.85,.85]){box(.5,.45,.5,x,.225,z+dz,'#718879',true);box(.5,.45,.07,x,.65,z+dz+(dz<0?-.2:.2),'#718879')}box(.12,.16,.12,x,.95,z,'#eee2cb')}
 box(.9,.55,.55,-1,1.38,-3.5,'#455953');
 }else{for(const x of [-4.6,4.6]){box(1.2,1.8,5,x,.9,-.3,'#718575',true);for(const y of [.55,1.15,1.75]){box(1.3,.08,5.1,x,y,-.3,'#b5baa5');for(let z=-2.4;z<2;z+=.65)box(.75,.32,.42,x,y+.2,z,(Math.round(z*10)%2)?'#c6a25f':'#a56e51')}}}
 const customer=cafe?createCharacter(outfit('female','Casual',{skin:'#d9ae8d',hair:'#bca06a'})):null;
 const usedCup=box(.13,.18,.13,-3.8,.97,-.7,'#eee5d1');usedCup.visible=false;
 if(customer){customer.group.name='cafe-customer';customer.group.visible=false;scene.add(customer.group)}
 const exitSpec=MAP.shops[kind].interior.exitDoor,exitDoor=createSlidingDoor({width:exitSpec.width,height:exitSpec.height});exitDoor.group.position.set(0,0,exitSpec.z);scene.add(exitDoor.group);
 return {scene,occluders,glass,customer,usedCup,clerk,exitDoor,blocked(x,z){return Math.abs(x)>5.55||Math.abs(z)>4.55||blocks.some(b=>Math.abs(x-b.x)<b.hx+.32&&Math.abs(z-b.z)<b.hz+.32)}};
}
