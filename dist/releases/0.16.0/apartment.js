import * as T from './vendor/three.module.js';
export const EXIT={x:0,z:4.45},BED={x:-3.6,z:-2.3},ENTRY={x:0,z:3.3};
export function createApartment(){
 const scene=new T.Scene();scene.background=new T.Color('#b8b5a4');scene.add(new T.HemisphereLight('#fff1da','#898878',1.9));const light=new T.DirectionalLight('#fff2da',2);light.position.set(2,6,1);scene.add(light);
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
 // Kitchen fronts share one line, with a narrow gap beside the refrigerator.
 box(3.9,.9,.85,3.1,.45,-4.85,'#94a28e',true).name='kitchen-base';box(4,.08,.95,3.1,.94,-4.85,'#e5dfce');box(3.8,.12,.12,3.1,.08,-4.4,'#6c7c67');
 // Recessed sink, raised rim and a distinct faucet.
 box(.64,.025,.42,2,.99,-4.8,'#4c6667').name='sink-basin';for(const x of [1.64,2.36])box(.055,.04,.52,x,1,-4.8,'#b9c6bd');for(const z of [-5.04,-4.56])box(.76,.04,.05,2,1,z,'#b9c6bd');
 box(.055,.32,.055,2,1.16,-5.08,'#adbdb5').name='sink-faucet';box(.055,.055,.25,2,1.32,-4.98,'#adbdb5');box(.055,.09,.055,2,1.29,-4.86,'#adbdb5');box(.15,.04,.05,2.17,1.04,-5.05,'#adbdb5');
 box(.75,.03,.6,4.2,.99,-4.8,'#364943');for(const x of [4,4.4]){const ring=new T.Mesh(new T.TorusGeometry(.12,.018,5,16),new T.MeshStandardMaterial({color:'#697b70',roughness:.6}));ring.rotation.x=Math.PI/2;ring.position.set(x,1.018,-4.8);scene.add(ring)}
 box(.95,1.95,.9,5.6,.975,-4.85,'#c8cbbd',true).name='refrigerator';box(.89,1.3,.045,5.6,.72,-4.375,'#d5d8ca').name='fridge-door';box(.89,.51,.045,5.6,1.66,-4.375,'#d5d8ca');box(.055,.45,.075,5.28,1.02,-4.32,'#687f71');box(.055,.24,.075,5.28,1.66,-4.32,'#687f71');
 for(const x of [1.2,2.2,3.2,4.2,5])box(.022,.7,.025,x,.48,-4.415,'#6c806b');for(const x of [1.7,2.7,3.7,4.6])box(.22,.035,.06,x,.74,-4.38,'#596d60');
 // Furniture has slim supports and separate seats rather than solid pedestals.
 box(1.5,.09,1.2,3.3,.8,-.7,'#bca786');for(const x of [2.72,3.88])for(const z of [-1.12,-.28])box(.09,.75,.09,x,.375,z,'#8c795d');colliders.push({x:3.3,z:-.7,hx:.75,hz:.6});
 for(const z of [-2,.6]){const back=z+(z<0?-.29:.29);box(.65,.1,.65,3.3,.46,z,'#97a38b');box(.62,.4,.075,3.3,.78,back,'#83957b');for(const x of [3.06,3.54])for(const dz of [-.24,.24])box(.065,.43,.065,x,.215,z+dz,'#6f8168');for(const x of [3.06,3.54])box(.055,.48,.06,x,.67,back,'#6f8168');colliders.push({x:3.3,z,hx:.325,hz:.325})}
 // Living area: second-hand sofa, rug, low table and a window bench.
 box(2.7,.32,1,-3.7,.25,3.1,'#71826f',true);for(const x of [-4.35,-3.05])box(1.25,.18,.8,x,.49,3.05,'#93a18b');box(2.7,.6,.22,-3.7,.8,3.5,'#748371');for(const x of [-5.05,-2.35])box(.2,.55,1,x,.58,3.1,'#748371');
 box(3.4,.012,2.6,-3.5,.012,1.9,'#a7ad95');box(1.15,.07,.65,-3.5,.4,1.65,'#b5a181');for(const x of [-3.94,-3.06])for(const z of [1.43,1.87])box(.06,.36,.06,x,.18,z,'#826d53');colliders.push({x:-3.5,z:1.65,hx:.575,hz:.325});
 // Large window above the empty back-wall work area.
 box(2.6,1.4,.04,-.6,2,-5.39,'#9bb7b9');for(const x of [-1.92,-.6,.72])box(.05,1.5,.08,x,2,-5.32,'#f0ead8');box(2.85,.08,.3,-.6,1.25,-5.2,'#eee3cf');
 for(const z of [-5.35,5.35])box(12.7,.14,.08,0,.08,z,'#b7b49f');
 return {scene,solids,occluders,blocked(x,z){return Math.abs(x)>6.05||Math.abs(z)>5.05||colliders.some(b=>Math.abs(x-b.x)<b.hx+.3&&Math.abs(z-b.z)<b.hz+.3)}};
}
