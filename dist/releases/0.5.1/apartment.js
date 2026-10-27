import * as T from './vendor/three.module.js';
export const EXIT={x:0,z:3.3},BED={x:-1.5,z:-1.9};
export function createApartment(){
 const scene=new T.Scene();scene.background=new T.Color('#b8b5a4');scene.add(new T.HemisphereLight('#ffefcf','#8d8b78',2.7));const light=new T.DirectionalLight('#fff2da',2);light.position.set(2,6,1);scene.add(light);
 const colliders=[],solids=[],materials=new Map();
 function box(w,h,d,x,y,z,c,solid=false){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.9}));const m=new T.Mesh(new T.BoxGeometry(w,h,d),materials.get(c));m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);if(solid){colliders.push({x,z,hx:w/2,hz:d/2});solids.push(m)}return m}
 box(9,.2,9,0,-.1,0,'#b6a58c');for(let x=-4;x<=4;x+=.5)box(.015,.005,9,x,.003,0,'#9a8b75');
 box(9,3.2,.18,0,1.6,-4.5,'#dad4c2',true);box(.18,3.2,9,-4.5,1.6,0,'#d1cbb7',true);box(.18,3.2,9,4.5,1.6,0,'#d1cbb7',true);box(9,3.2,.18,0,1.6,4.5,'#dad4c2',true);
 box(1.3,2.5,.1,0,1.25,4.36,'#6e8073');box(.08,.12,.08,.45,1.2,4.27,'#c8af70');
 // Bed along the left wall. The interaction point is in the open aisle.
 box(1.7,.36,2.6,-3.1,.23,-2,'#73614e',true);box(1.65,.22,2.5,-3.1,.52,-2,'#e4e0cf');box(1.65,.12,1.65,-3.1,.68,-1.6,'#78918a');box(1.25,.12,.5,-3.1,.7,-2.9,'#f0e8d5');
 // Kitchenette and small dining table.
 box(2.6,.9,.75,2.6,.45,-3.9,'#9da58e',true);box(2.7,.08,.82,2.6,.94,-3.9,'#ded9c9');box(.65,.02,.48,2,.99,-3.9,'#778984');box(.65,.025,.58,3.25,.99,-3.9,'#424a43');
 box(1,.75,1,2.9,.375,.5,'#89755b',true);box(1.15,.08,1.15,2.9,.8,.5,'#b5a181');
 box(.55,.45,.55,2.9,.225,1.55,'#8b967c',true);box(.55,.5,.08,2.9,.65,1.8,'#8b967c');
 box(2.4,.015,2.2,-.3,.015,-.4,'#8c9a86');
 // A small window, sill and inexpensive shelf.
 box(2,1.3,.04,.3,2,-4.39,'#9bb7b9');for(const x of [-.73,.3,1.33])box(.05,1.4,.08,x,2,-4.32,'#f0ead8');box(2.2,.08,.25,.3,1.3,-4.25,'#eee3cf');
 box(.8,.7,.55,-3.6,.35,2.8,'#927c61',true);box(.4,.08,.3,-3.6,.75,2.8,'#6f887c');
 // Bedside wear is cosmetic; condition affects the displayed utility rate.
 box(.6,.25,.01,-2,1,-4.395,'#c4bfac');
 return {scene,solids,blocked(x,z){return Math.abs(x)>4.05||Math.abs(z)>4.05||colliders.some(b=>Math.abs(x-b.x)<b.hx+.3&&Math.abs(z-b.z)<b.hz+.3)}};
}
