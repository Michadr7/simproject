import * as T from './vendor/three.module.js';
import {createCharacter} from './character.js';
import {defaults} from './appearance.js';
export const SHOPS={market:{name:'Corner Market',x:19,z:-6.3},cafe:{name:'Alder Coffee',x:36,z:-6.3}};
export const SHOP_ENTRY={x:0,z:3.1},SHOP_EXIT={x:0,z:4},COUNTER={x:0,z:-2};
export function createShop(kind){const cafe=kind==='cafe',scene=new T.Scene();scene.background=new T.Color('#b8b5a4');scene.add(new T.HemisphereLight('#fff2dd','#7c8170',2.6));const light=new T.DirectionalLight('#fff0ce',2);light.position.set(2,7,3);scene.add(light);const occluders=[],blocks=[];
 function box(w,h,d,x,y,z,c,solid=false){const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85}));m.position.set(x,y,z);scene.add(m);if(y>0)occluders.push(m);if(solid)blocks.push({x,z,hx:w/2,hz:d/2});return m}
 box(12,.2,10,0,-.1,0,cafe?'#ad9271':'#c5c5b2');for(let x=-6;x<=6;x+=1)box(.015,.004,10,x,.002,0,'#a59d88');
 for(const z of [-5,5])box(12,3.4,.16,0,1.7,z,cafe?'#d6c7ac':'#d3dccb',true);for(const x of [-6,6])box(.16,3.4,10,x,1.7,0,'#b1bfad',true);
 box(1.6,2.5,.12,0,1.25,4.86,'#416459');for(const x of [-3.8,3.8]){box(2.8,1.7,.05,x,1.9,4.84,'#94b8bb');box(2.9,.1,.25,x,1.05,4.7,'#e5deca')}
 box(4,1,1,0,.5,-3.5,cafe?'#735b45':'#6e8b72',true);box(4.2,.1,1.15,0,1.05,-3.5,'#ded2b8');box(.45,.35,.35,1.2,1.28,-3.5,'#344b49');
 const clerk=createCharacter({...defaults,shirt:cafe?'#ab6d51':'#758b73',style:'Bun'});clerk.group.position.set(0,.02,-4.35);scene.add(clerk.group);
 if(cafe){for(const x of [-3.8,3.8])for(const z of [-.7,2]){box(1.25,.1,1.05,x,.82,z,'#a98b61',true);box(.2,.8,.2,x,.4,z,'#4a5950');for(const dz of [-.85,.85]){box(.5,.45,.5,x,.225,z+dz,'#718879',true);box(.5,.45,.07,x,.65,z+dz+(dz<0?-.2:.2),'#718879')}box(.12,.16,.12,x,.95,z,'#eee2cb')}
 box(.9,.55,.55,-1,1.38,-3.5,'#455953');
 }else{for(const x of [-4.6,4.6]){box(1.2,1.8,5,x,.9,-.3,'#718575',true);for(const y of [.55,1.15,1.75]){box(1.3,.08,5.1,x,y,-.3,'#b5baa5');for(let z=-2.4;z<2;z+=.65)box(.75,.32,.42,x,y+.2,z,(Math.round(z*10)%2)?'#c6a25f':'#a56e51')}}}
 return {scene,occluders,blocked(x,z){return Math.abs(x)>5.55||Math.abs(z)>4.55||blocks.some(b=>Math.abs(x-b.x)<b.hx+.32&&Math.abs(z-b.z)<b.hz+.32)}};
}
