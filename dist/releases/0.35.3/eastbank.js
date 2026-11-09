// Eastbank Works scenery (0.33), built from the map's data (map-definition.js: `paving`, `bayRows`, `yards`; the buildings are ordinary landmarks, placed by world.js):
//  - the paving (truck yards, aprons, the forecourt, the depot, driveway cuts) as ONE merged mesh on the asphalt ground layer, and the pump island as a second, lighter one;
//  - the painted bays as one instanced mesh of thin bars;
//  - each yard as a CHUNK: one InstancedMesh per prop model in it (props.js createPropInstances), shown only while the player is within `cull` metres of the yard's rectangle. The solid
//    boxes of every prop are added to the world's colliders once and stay (they are cheap; the meshes are what costs). Caps on the numbers live in validateMap (YARD_CAPS).
import * as THREE from './vendor/three.module.js';
import {MAP,CANOPY_COLUMNS,CANOPY_MODEL_X,CANOPY_COLUMN_X} from './map-definition.js';
import {heightAt} from './height.js';
import {propInfo,propGeometry,createPropInstances} from './props.js';

const quads=(rects,y)=>{const position=[],index=[];
 for(const r of rects){const n=position.length/3;position.push(r.x0,y,r.z0,r.x0,y,r.z1,r.x1,y,r.z0,r.x1,y,r.z1);index.push(n,n+1,n+2,n+1,n+3,n+2)} // counter-clockwise seen from above: the normal is +y
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(position.map((_,i)=>i%3===1?1:0),3));g.setIndex(index);return g};
const NO_FADE=new Set(['prop.pump-island','prop.forecourt-canopy']); // the gas station never dissolves when the camera looks through it (a half-faded pump looks broken)
// Is (x, z) under a canopy placed at it (x, z, yaw)? The roof is a little wider than its four columns (CANOPY_COLUMNS: 5 x 3.2 from the centre).
export const underCanopy=(it,x,z)=>{const c=Math.cos(it.yaw),s=Math.sin(it.yaw),dx=x-it.x,dz=z-it.z;return Math.abs(dx*c-dz*s)<6.2&&Math.abs(dx*s+dz*c)<4.4};
// The canopy model is one mesh. Split it into the ROOF (hidden while the player stands under it) and the COLUMNS (always drawn, so you can see what you would run into), and move the
// columns in from 5 m to CANOPY_COLUMN_X from the centre (the model's own columns stand in the driving lane). A triangle is a column's when all three corners are inside a column's box.
export function splitCanopy(g){
 const pos=g.attributes.position,idx=g.index.array,box=v=>{const ax=Math.abs(pos.getX(v)),az=Math.abs(pos.getZ(v));return ax>=CANOPY_MODEL_X-.6&&ax<=CANOPY_MODEL_X+.6&&az>=2.7&&az<=3.7};
 const groups=g.groups.length?g.groups:[{start:0,count:idx.length,materialIndex:0}],roof=[],columns=[],rg=[],cg=[];
 for(const gr of groups){const r0=roof.length,c0=columns.length;
  for(let t=gr.start;t<gr.start+gr.count;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2];(box(a)&&box(b)&&box(c)?columns:roof).push(a,b,c)}
  rg.push({start:r0,count:roof.length-r0,materialIndex:gr.materialIndex});cg.push({start:c0,count:columns.length-c0,materialIndex:gr.materialIndex})}
 const build=(list,gs,shift)=>{const out=new THREE.BufferGeometry();
  for(const name of Object.keys(g.attributes)){const a=g.attributes[name];out.setAttribute(name,shift?a.clone():a)}
  if(shift){const p=out.attributes.position;for(let v=0;v<p.count;v++)if(box(v)){const x=p.getX(v);p.setX(v,x-Math.sign(x)*(CANOPY_MODEL_X-CANOPY_COLUMN_X))}}
  out.setIndex(list);for(const gr of gs)if(gr.count>0)out.addGroup(gr.start,gr.count,gr.materialIndex);out.computeBoundingSphere();return out};
 return {roof:build(roof,rg,false),columns:build(columns,cg,true)};
}
const ROOF_UNDER=.22; // the roof is left as a faint ghost (not gone) while you stand under it, easing in and out over a few frames
const distanceToRect=(x,z,b)=>Math.hypot(Math.max(b.x0-x,0,x-b.x1),Math.max(b.z0-z,0,z-b.z1));

// group: the world's group; groundLayer(material, y): the world's depth-biased ground material; asphalt: the road material; colliders: the world's collider set (box(x, z, hx, hz)).
export function createEastbank({group,fade,groundLayer,asphalt,colliders}){
 const root=new THREE.Group();root.name='eastbank';group.add(root);
 const pave=MAP.paving.filter(p=>p.kind!=='island'),islands=MAP.paving.filter(p=>p.kind==='island');
 const paving=new THREE.Mesh(quads(pave,-.045),groundLayer(asphalt,-.045));paving.name='eastbank-paving';paving.receiveShadow=true;root.add(paving);
 if(islands.length){const slab=new THREE.Mesh(quads(islands,-.044),groundLayer(new THREE.MeshStandardMaterial({color:'#9b9b93',roughness:.95}),-.044));slab.name='eastbank-pump-island';slab.receiveShadow=true;root.add(slab)}
 // painted bays: a line between neighbours and at both ends, 0.12 m wide, and one along the back. The paint is a ground layer too (its own depth bias, above the asphalt's), or the biased paving hides it.
 const bars=[];for(const row of MAP.bayRows){const z=row.z0+row.depth/2;
  for(let i=0;i<=row.count;i++)bars.push({x:row.x0+i*row.width,z,w:.12,d:row.depth});
  bars.push({x:row.x0+row.count*row.width/2,z:row.back==='south'?row.z0+row.depth:row.z0,w:row.count*row.width+.12,d:.12})}
 const paint=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.012,1),groundLayer(new THREE.MeshStandardMaterial({color:'#ecebe0',roughness:.9}),-.037),Math.max(1,bars.length)),m4=new THREE.Matrix4(),at=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
 bars.forEach((b,i)=>paint.setMatrixAt(i,m4.compose(at.set(b.x,-.037,b.z),q.identity(),s.set(b.w,1,b.d))));paint.count=bars.length;paint.name='eastbank-bays';paint.receiveShadow=true;root.add(paint);

 const canopies=[]; // the forecourt roof(s): hidden while the player stands under one (the roof would block the view into the station)
 const chunks=MAP.yards.map(yard=>{
  const holder=new THREE.Group();holder.name='yard-'+yard.id;root.add(holder);
  const byModel=new Map();for(const it of yard.items){if(!byModel.has(it.prop))byModel.set(it.prop,[]);byModel.get(it.prop).push(it)}
  const meshes=[];let triangles=0;
  for(const [prop,items] of byModel){
   const info=propInfo(prop),spots=items.map(it=>({x:it.x,z:it.z,y:heightAt(it.x,it.z)+(it.y||0),yaw:it.yaw})),keep=NO_FADE.has(prop)?{apply:m=>m}:fade;
   if(prop==='prop.forecourt-canopy'){const parts=splitCanopy(propGeometry(prop)),roof=createPropInstances(prop,spots,keep,{shadows:true,geometry:parts.roof}),columns=createPropInstances(prop,spots,keep,{shadows:true,geometry:parts.columns});
    roof.name='canopy-roof';columns.name='canopy-columns';holder.add(roof,columns);meshes.push(roof,columns);triangles+=info.triangles*items.length;canopies.push({mesh:roof,columns,items})}
   else{const mesh=createPropInstances(prop,spots,keep,{shadows:info.height>=2});holder.add(mesh);meshes.push(mesh);triangles+=info.triangles*items.length}
   for(const it of items){if(it.y>0)continue; // a stacked pallet rests on the one below: only the bottom of a stack is solid
    if(prop==='prop.forecourt-canopy'){const c=Math.round(Math.cos(it.yaw)),s=Math.round(Math.sin(it.yaw));for(const [dx,dz] of CANOPY_COLUMNS)colliders.box(it.x+dx*c+dz*s,it.z-dx*s+dz*c,.4,.4); continue} // a roof on four columns: the columns block, the space under the roof does not (the converted canopy has no box)
    const cos=Math.round(Math.cos(it.yaw)),sin=Math.round(Math.sin(it.yaw)),turned=sin!==0;
    for(const b of info.colliders)colliders.box(it.x+b.x*cos+b.z*sin,it.z-b.x*sin+b.z*cos,turned?b.hz:b.hx,turned?b.hx:b.hz)}}
  return {id:yard.id,holder,bounds:yard.bounds,cull:yard.cull,meshes,instances:yard.items.length,triangles};
 });
 return {
  root,chunks,paving,
  // Show a yard only while the viewer is within its cull distance of the yard's rectangle (called with the fade target, like the landmarks' culling).
  update(x,z){for(const c of chunks)c.holder.visible=distanceToRect(x,z,c.bounds)<c.cull;for(const c of canopies){const want=c.items.some(it=>underCanopy(it,x,z))?ROOF_UNDER:1,mats=[].concat(c.mesh.material);c.fade=Math.abs(want-(c.fade??1))<.02?want:(c.fade??1)+(want-(c.fade??1))*.2; for(const m of mats){const solid=c.fade>=.999;if(m.transparent===solid){m.transparent=!solid;m.needsUpdate=true}m.opacity=c.fade;m.depthWrite=solid}}},
  canopies,
  // What would be drawn from (x, z): visible chunks, their instances, triangles and draw calls (one per model per chunk, plus the merged paving, the island and the bays).
  stats(x,z){let chunksOn=0,instances=0,triangles=0,calls=2+(islands.length?1:0);for(const c of chunks)if(distanceToRect(x,z,c.bounds)<c.cull){chunksOn++;instances+=c.instances;triangles+=c.triangles;calls+=c.meshes.length}
   return {chunks:chunks.length,chunksOn,instances,triangles,drawCalls:calls}}
 };
}
