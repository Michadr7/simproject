import * as T from './vendor/three.module.js';
export const EXIT={x:0,z:4.45},BED={x:-3.6,z:-2.3},ENTRY={x:0,z:3.3};
export function createApartment(){
 const scene=new T.Scene();scene.background=new T.Color('#b8b5a4');scene.add(new T.HemisphereLight('#fff1da','#898878',2.5));const light=new T.DirectionalLight('#fff2da',2);light.position.set(2,6,1);scene.add(light);
 const colliders=[],solids=[],occluders=[],materials=new Map();
 function box(w,h,d,x,y,z,c,solid=false){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.9}));const m=new T.Mesh(new T.BoxGeometry(w,h,d),materials.get(c));m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);if(h>.1&&y>0)occluders.push(m);if(solid){colliders.push({x,z,hx:w/2,hz:d/2});solids.push(m)}return m}
 // More circulation space, with distinct sleeping, living and kitchen zones.
 box(13,.2,11,0,-.1,0,'#b6a58c');for(let x=-6;x<=6;x+=.5)box(.012,.005,11,x,.003,0,'#a4937c');
 box(13,3.4,.18,0,1.7,-5.5,'#e2dbc8',true);box(.18,3.4,11,-6.5,1.7,0,'#cbd1bf',true);box(.18,3.4,11,6.5,1.7,0,'#dad4c3',true);box(13,3.4,.18,0,1.7,5.5,'#e2dbc8',true);
 box(1.3,2.5,.1,0,1.25,5.36,'#6e8073').name='front-door';box(.08,.12,.08,.45,1.2,5.27,'#c8af70');
 // Bed and low shelf define the sleeping area without closing its aisle.
 box(1.8,.36,2.8,-5.15,.23,-2.4,'#73614e',true);box(1.76,.22,2.7,-5.15,.52,-2.4,'#e4e0cf');box(1.76,.12,1.8,-5.15,.68,-1.95,'#78918a');box(1.3,.12,.5,-5.15,.7,-3.4,'#f0e8d5');
 box(1.85,.85,.12,-5.15,.45,-3.9,'#8c785c');box(.65,.65,.6,-3.85,.325,-4,'#947d60',true);box(.3,.12,.3,-3.85,.74,-4,'#698377');
 box(2.7,.95,.45,-4.6,.475,.35,'#9b8b70',true);for(const x of [-5.4,-4.6,-3.8])box(.5,.25,.22,x,.63,.36,'#c4b794');
 // Kitchen and refrigerator, with worktop space between sink and hob.
 box(4.5,.9,.85,3.3,.45,-4.85,'#9da58e',true);box(4.6,.08,.95,3.3,.94,-4.85,'#ded9c9');box(.7,.025,.52,2,.99,-4.8,'#778984');box(.7,.025,.6,4.5,.99,-4.8,'#424a43');
 box(.9,1.85,.8,5.7,.925,-3.55,'#c5c9ba',true);box(.045,.5,.08,5.35,1.25,-3.10,'#758079');
 for(const x of [1.7,2.8,3.9,5]){box(.03,.65,.04,x,.47,-4.4,'#7c8b73');box(.25,.035,.06,x+.2,.7,-4.37,'#626f61')}
 // Dining space has clear routes on both sides.
 box(1.3,.72,1,3.3,.36,-.7,'#89755b',true);box(1.5,.08,1.2,3.3,.8,-.7,'#b5a181');
 for(const z of [-2, .6]){box(.6,.45,.6,3.3,.225,z,'#8b967c',true);box(.6,.5,.08,3.3,.65,z+(z<0?-.25:.25),'#8b967c')}
 // Living area: second-hand sofa, rug, low table and a window bench.
 box(2.7,.42,1,-3.7,.3,3.1,'#819080',true);box(2.7,.6,.22,-3.7,.8,3.5,'#748371');for(const x of [-5.05,-2.35])box(.2,.55,1,x,.58,3.1,'#748371');
 box(3.4,.012,2.6,-3.5,.012,1.9,'#a7ad95');box(1.15,.36,.65,-3.5,.18,1.65,'#9c8566',true);
 // Large window above the empty back-wall work area.
 box(2.6,1.4,.04,-.6,2,-5.39,'#9bb7b9');for(const x of [-1.92,-.6,.72])box(.05,1.5,.08,x,2,-5.32,'#f0ead8');box(2.85,.08,.3,-.6,1.25,-5.2,'#eee3cf');
 for(const z of [-5.35,5.35])box(12.7,.14,.08,0,.08,z,'#b7b49f');
 return {scene,solids,occluders,blocked(x,z){return Math.abs(x)>6.05||Math.abs(z)>5.05||colliders.some(b=>Math.abs(x-b.x)<b.hx+.3&&Math.abs(z-b.z)<b.hz+.3)}};
}
