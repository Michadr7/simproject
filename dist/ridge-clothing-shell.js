// Grounding helpers, Ironwood Bakery storefront door/windows, and Ridge Clothing see-through exterior showroom.
import * as THREE from './vendor/three.module.js';
import {SURFACE} from './terrain.js';

export function surfaceBaseY(T,x,z,hAt){
 const s=T.surfaceAt(x,z),h=hAt(x,z);
 if(s===SURFACE.PAVEMENT)return Math.max(h,.165);
 if(s===SURFACE.STREET)return Math.max(h,.01);
 if(s===SURFACE.ROAD||s===SURFACE.DRIVEWAY||s===SURFACE.PATH)return h-.045;
 return h;
}

// Attaches a street-facing glazed front door and flanking illuminated pastry display windows to Ironwood Bakery (shop-c local +Z face).
export function attachBakeryStorefront(mesh,fade){
 const g=new THREE.Group();g.name='bakery-storefront';
 const wood=fade.apply(new THREE.MeshStandardMaterial({color:'#5e3b26',roughness:.78}));
 const trim=fade.apply(new THREE.MeshStandardMaterial({color:'#f2e7d5',roughness:.85}));
 const brass=fade.apply(new THREE.MeshStandardMaterial({color:'#d8a94a',roughness:.35,metalness:.65}));
 const warm=new THREE.MeshStandardMaterial({color:'#ffe5b4',emissive:'#ffba66',emissiveIntensity:.42,roughness:.6});
 const glass=new THREE.MeshStandardMaterial({color:'#cce6ef',roughness:.12,metalness:.1,transparent:true,opacity:.36,depthWrite:false});
 const stone=fade.apply(new THREE.MeshStandardMaterial({color:'#8b867d',roughness:.92}));
 const pastryA=fade.apply(new THREE.MeshStandardMaterial({color:'#c9863b',roughness:.75}));
 const pastryB=fade.apply(new THREE.MeshStandardMaterial({color:'#a66024',roughness:.75}));
 const add=(geo,mat,x,y,z,name)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);if(name)m.name=name;g.add(m);return m};

 // Centered on shop-c's +Z storefront facade (x = +0.17, stucco wall at z = 4.20, lower stone base at z = 4.36)
 const cx=.17,wallZ=4.24,doorZ=4.37;
 add(new THREE.BoxGeometry(2.1,.08,.32),stone,cx,.04,4.48,'bakery-step');
 add(new THREE.BoxGeometry(1.76,2.52,.34),wood,cx,1.26,4.29,'bakery-door-frame');
 add(new THREE.BoxGeometry(1.42,2.28,.04),warm,cx,1.20,doorZ+.02,'bakery-door-glow');
 add(new THREE.BoxGeometry(1.40,2.24,.03),glass,cx,1.20,doorZ+.05,'bakery-door-glass');
 add(new THREE.BoxGeometry(.08,2.28,.09),wood,cx,1.20,doorZ+.07);
 add(new THREE.BoxGeometry(1.44,.16,.10),wood,cx,2.38,doorZ+.07);
 for(const s of [-1,1])add(new THREE.BoxGeometry(.05,.38,.08),brass,cx+s*.14,1.12,doorZ+.10);

 // Flanking pastry display windows
 for(const side of [-1,1]){
  const wx=cx+side*2.15;
  add(new THREE.BoxGeometry(1.66,1.62,.14),trim,wx,1.58,wallZ);
  add(new THREE.BoxGeometry(1.52,.12,.22),wood,wx,.82,wallZ+.04);
  add(new THREE.BoxGeometry(1.46,1.38,.04),warm,wx,1.60,wallZ+.01);
  add(new THREE.BoxGeometry(1.44,1.34,.03),glass,wx,1.60,wallZ+.05);
  for(const lx of [-.42,0,.42])add(new THREE.BoxGeometry(.26,.14,.16),lx===0?pastryB:pastryA,wx+lx,1.02,wallZ+.04);
 }
 mesh.add(g);
}

// Storefront door + display-window definitions for Ironwood shops whose base models have blank ground walls (+Z facade).
export const SHOP_STOREFRONTS=Object.freeze({
 'alder-barber':Object.freeze({wallZ:3.28,frame:'#243d54',pull:'chrome',winX:2.05,winW:1.35,winH:1.50,winY:1.58,barberPole:true}),
 'alder-pharmacy':Object.freeze({wallZ:3.76,frame:'#2e666e',pull:'chrome',winX:2.15,winW:1.52,winH:1.55,winY:1.58,crossPlaque:true}),
 'alder-bank':Object.freeze({wallZ:3.80,frame:'#2c3a47',pull:'brass',winX:2.08,winW:1.38,winH:1.78,winY:1.56,lintel:true}),
 'alder-books':Object.freeze({wallZ:3.71,frame:'#593824',pull:'brass',winX:2.15,winW:1.52,winH:1.55,winY:1.58,books:true}),
 'alder-cinema':Object.freeze({wallZ:3.37,frame:'#70262b',trim:'#d4a948',pull:'brass',winX:2.35,winW:1.50,winH:1.72,winY:1.62,posters:true})
});

export function attachShopStorefront(mesh,fade,id){
 const spec=SHOP_STOREFRONTS[id];
 if(!spec)return null;
 const g=new THREE.Group();g.name=id+'-storefront';
 const mat=(c,r=.8,extra={})=>fade.apply(new THREE.MeshStandardMaterial({color:c,roughness:r,...extra}));
 const frame=mat(spec.frame,.74);
 const trim=mat(spec.trim||'#ebe4d6',.82);
 const stone=mat('#86898d',.92);
 const handle=spec.pull==='chrome'?mat('#c4cdd4',.3,{metalness:.65}):mat('#d8a94a',.35,{metalness:.65});
 const warm=new THREE.MeshStandardMaterial({color:'#ffe8bc',emissive:'#ffbf6b',emissiveIntensity:.45,roughness:.55});
 const glass=new THREE.MeshStandardMaterial({color:'#cce6ef',roughness:.12,metalness:.1,transparent:true,opacity:.34,depthWrite:false});
 const add=(geo,m,x,y,z,name)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);if(name)o.name=name;g.add(o);return o};

 const wz=spec.wallZ,dz=wz+.08;
 add(new THREE.BoxGeometry(2.05,.08,.30),stone,0,.04,dz+.14);
 add(new THREE.BoxGeometry(1.78,2.50,.22),frame,0,1.25,wz+.05);
 add(new THREE.BoxGeometry(1.44,2.26,.04),warm,0,1.19,dz+.03);
 add(new THREE.BoxGeometry(1.42,2.22,.03),glass,0,1.19,dz+.06,id+'-door-glass');
 add(new THREE.BoxGeometry(.08,2.26,.09),frame,0,1.19,dz+.08);
 add(new THREE.BoxGeometry(1.48,.14,.10),frame,0,2.36,dz+.08);
 for(const s of [-1,1])add(new THREE.BoxGeometry(.05,spec.posters?.55:.38,.08),handle,s*.14,1.12,dz+.11);
 if(spec.lintel)add(new THREE.BoxGeometry(2.05,.20,.30),stone,0,2.58,wz+.08);
 if(spec.crossPlaque){
  add(new THREE.BoxGeometry(.48,.48,.10),trim,0,2.74,wz+.08);
  const emerald=mat('#2ea36b',.6);
  add(new THREE.BoxGeometry(.30,.10,.06),emerald,0,2.74,wz+.12);
  add(new THREE.BoxGeometry(.10,.30,.06),emerald,0,2.74,wz+.12);
 }
 if(spec.barberPole){
  add(new THREE.BoxGeometry(.18,.10,.16),trim,-1.04,2.04,dz+.05);
  add(new THREE.BoxGeometry(.18,.10,.16),trim,-1.04,1.02,dz+.05);
  const poleWhite=mat('#f2f3f5',.5),poleRed=mat('#c93434',.5),poleBlue=mat('#285499',.5);
  add(new THREE.CylinderGeometry(.065,.065,.92,10),poleWhite,-1.04,1.53,dz+.08);
  add(new THREE.CylinderGeometry(.07,.07,.16,10),poleRed,-1.04,1.76,dz+.08);
  add(new THREE.CylinderGeometry(.07,.07,.16,10),poleBlue,-1.04,1.46,dz+.08);
  add(new THREE.CylinderGeometry(.07,.07,.14,10),poleRed,-1.04,1.18,dz+.08);
 }
 for(const side of [-1,1]){
  const wx=side*spec.winX,wy=spec.winY;
  add(new THREE.BoxGeometry(spec.winW+.18,spec.winH+.18,.12),trim,wx,wy,wz+.02);
  add(new THREE.BoxGeometry(spec.winW+.04,.10,.18),frame,wx,wy-spec.winH/2-.03,wz+.05);
  if(spec.posters){
   const postCol=mat(side<0?'#395c8a':'#8a3346',.65);
   add(new THREE.BoxGeometry(spec.winW-.06,spec.winH-.06,.04),postCol,wx,wy,wz+.06);
   add(new THREE.BoxGeometry(spec.winW-.32,spec.winH-.44,.04),warm,wx,wy+.06,wz+.07);
   add(new THREE.BoxGeometry(spec.winW-.08,spec.winH-.08,.03),glass,wx,wy,wz+.09);
  }else{
   add(new THREE.BoxGeometry(spec.winW-.08,spec.winH-.08,.04),warm,wx,wy,wz+.05);
   add(new THREE.BoxGeometry(spec.winW-.08,spec.winH-.10,.03),glass,wx,wy,wz+.08);
   if(spec.books){
    const cols=['#b84239','#2d6a4f','#3b5e8c'].map(c=>mat(c,.78));
    [-0.36,0,0.36].forEach((bx,i)=>add(new THREE.BoxGeometry(.22,.20,.12),cols[i],wx+bx,wy-spec.winH/2+.14,wz+.07));
   }
  }
 }
 mesh.add(g);
 return g;
}

// Builds the Ridge Clothing exterior building on store's exact footprint (-6.5..6.5 x -8.3..8.3 x 6.96 m) with crystal-clear storefront windows and visible interior racks/mannequins.
export function buildRidgeClothingExterior(fade){
 const g=new THREE.Group();g.name='prop-store';
 const mat=(c,r=.86,extra={})=>fade.apply(new THREE.MeshStandardMaterial({color:c,roughness:r,...extra}));
 const wall=mat('#c2beb2',.9),trim=mat('#2b353d',.75),teal=mat('#215866',.72),plinth=mat('#828588',.94);
 const wood=mat('#c9ab84',.8),innerWall=mat('#ece8df',.88),chrome=mat('#b7c0c7',.35,{metalness:.65});
 const brass=mat('#d9b15f',.35,{metalness:.6}),skin=mat('#dfc3ab',.7);
 const glass=new THREE.MeshStandardMaterial({color:'#cce6ef',roughness:.1,metalness:.1,transparent:true,opacity:.20,depthWrite:false});
 const glow=new THREE.MeshStandardMaterial({color:'#fff5dd',emissive:'#ffe8b3',emissiveIntensity:.55,roughness:.4});
 const garmentCols=['#2f6f7e','#c44e43','#e0a83d','#394b63','#5e8554','#b86b86'];
 const add=(geo,m,x,y,z,shadow=true)=>{const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=true;g.add(mesh);return mesh};

 // Flush foundation slab anchoring into grass/sidewalk (-0.19..+0.01 so showroom floor & glass doors remain unobstructed), upper facade stucco (3.40..6.20), parapet roof (6.20..6.96)
 add(new THREE.BoxGeometry(13.0,.20,16.6),plinth,0,-.09,0,false);
 add(new THREE.BoxGeometry(13.0,6.15,.35),wall,0,3.08,-8.13); // back (-Z)
 add(new THREE.BoxGeometry(.35,6.15,16.6),wall,-6.33,3.08,0); // side -X (world east)
 add(new THREE.BoxGeometry(.35,6.15,14.5),wall,6.33,3.08,-.95); // side +X (rear of corner column)
 add(new THREE.BoxGeometry(13.0,2.80,.35),wall,0,4.80,8.13); // upper front wall
 add(new THREE.BoxGeometry(13.2,.82,16.8),trim,0,6.55,0); // roof fascia & crown
 add(new THREE.BoxGeometry(12.6,.22,16.2),trim,0,6.25,0,false); // roof deck

 // Signature deep-teal corner column matching Ridge Clothing architecture (world right corner with yaw=PI -> local +X/+Z)
 add(new THREE.BoxGeometry(2.15,6.40,1.95),teal,5.42,3.02,7.38);
 add(new THREE.BoxGeometry(.38,1.15,2.20),trim,6.42,5.35,7.38);

 // Storefront framing, bulkhead below glass, central recessed double glass doors & two wide display windows
 add(new THREE.BoxGeometry(10.8,.16,.40),trim,0,3.38,8.12);
 add(new THREE.BoxGeometry(4.45,.42,.36),wall,-4.08,.21,8.14); // left bulkhead
 add(new THREE.BoxGeometry(2.90,.42,.36),wall,2.92,.21,8.14); // right bulkhead
 add(new THREE.BoxGeometry(2.95,.18,.65),trim,0,2.78,7.95); // door transom header
 for(const x of [-1.52,1.52])add(new THREE.BoxGeometry(.16,3.40,.42),trim,x,1.70,8.05);
 for(const x of [-6.05,-3.80,4.28])add(new THREE.BoxGeometry(.14,3.00,.36),trim,x,1.90,8.14);

 // Recessed glazed entrance doors + chrome handles
 add(new THREE.BoxGeometry(2.88,2.68,.06),glass,0,1.35,7.80,false);
 add(new THREE.BoxGeometry(.08,2.70,.10),trim,0,1.35,7.80,false);
 for(const s of [-1,1])add(new THREE.BoxGeometry(.05,.45,.10),chrome,s*.16,1.15,7.86,false);

 // Crystal-clear storefront display windows
 add(new THREE.BoxGeometry(4.35,2.85,.04),glass,-3.80,1.86,8.14,false);
 add(new THREE.BoxGeometry(2.70,2.85,.04),glass,2.92,1.86,8.14,false);

 // Visible interior showroom behind glass (z = +1.8..+7.6)
 add(new THREE.BoxGeometry(10.5,.06,6.1),wood,-.8,.03,4.7,false);
 add(new THREE.BoxGeometry(10.6,3.35,.22),teal,-.8,1.70,1.75,false); // teal interior back accent wall
 add(new THREE.BoxGeometry(.22,3.35,6.0),innerWall,-6.0,1.70,4.7,false);
 add(new THREE.BoxGeometry(.22,3.35,6.0),innerWall,4.3,1.70,4.7,false);
 for(const z of [3.5,5.8])add(new THREE.BoxGeometry(7.2,.08,.55),glow,-.8,3.26,z,false); // glowing interior light bars

 // Counter visible at rear of showroom + coat racks + sweaters/packs on shelves
 add(new THREE.BoxGeometry(3.8,.95,.85),teal,-.2,.48,2.7,false);
 add(new THREE.BoxGeometry(4.0,.08,.98),wood,-.2,.99,2.7,false);
 add(new THREE.BoxGeometry(.55,.32,.40),trim,-.2,1.18,2.7,false);
 for(const x of [-4.6,2.8]){
  add(new THREE.BoxGeometry(1.7,.12,1.1),chrome,x,.08,4.6,false);
  add(new THREE.BoxGeometry(.06,1.45,.06),chrome,x-.75,.78,4.6,false);
  add(new THREE.BoxGeometry(.06,1.45,.06),chrome,x+.75,.78,4.6,false);
  add(new THREE.BoxGeometry(1.55,.05,.05),chrome,x,1.48,4.6,false);
  for(let i=0;i<5;i++){
   add(new THREE.BoxGeometry(.18,.78,.42),mat(garmentCols[(i+(x>0?2:0))%garmentCols.length],.8),x-.55+i*.27,1.06,4.6,false);
  }
 }

 // Window display mannequins visible right through front glass
 for(const [mx,coatHex] of [[-3.7,'#215866'],[-2.5,'#c44e43'],[2.85,'#d99b38']]){
  add(new THREE.BoxGeometry(.55,.06,.55),trim,mx,.03,6.9,false);
  add(new THREE.BoxGeometry(.14,.75,.14),trim,mx-.10,.45,6.9,false);
  add(new THREE.BoxGeometry(.14,.75,.14),trim,mx+.10,.45,6.9,false);
  add(new THREE.BoxGeometry(.44,.65,.24),mat(coatHex,.7),mx,1.15,6.9,false);
  add(new THREE.BoxGeometry(.22,.24,.22),skin,mx,1.62,6.9,false);
 }
 return g;
}
