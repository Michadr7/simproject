// W3: chunk water meshes and the minimap water layer. Synthetic maps only (the shipped map keeps its old flat river from world.js).
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,waterProblems,waterAt} from '../dist/map-definition.js';
import {worldRange,chunkBounds,chunkKey} from '../dist/chunks.js';
import {createChunkView} from '../dist/chunks-view.js';
import {waterChunkData,waterChunkMesh,drawWaterLayer,WATER_ATTRIBUTES} from '../dist/water-chunks.js';

const river={id:'big-river',bank:2.6,shore:3,points:[{x:-330,z:-100,w:14,depth:.8,y:-.95,speed:.6},{x:-330,z:0,w:14,depth:.8,y:-.95,speed:.6},{x:-330,z:100,w:14,depth:.8,y:-.95,speed:.6},{x:-100,z:380,w:14,depth:.8,y:-.95,speed:.4}]};
const lake={id:'lake',outline:[[520,-660],[800,-660],[800,-440],[520,-440]],y:-.9,depth:2.5,shore:6};
const sea={shoreline:[[-450,430],[0,440],[1050,440]],y:-2,beach:25,depth:.6};
const fall={id:'falls',lip:{x:900,z:-300,y:3},drop:6,w:3,dir:[1,0],pool:{r:6}};
const map={...MAP,water:{...MAP.water,rivers:[...MAP.water.rivers,river],fords:[],lakes:[lake],sea,falls:[fall]}};
assert.deepEqual(waterProblems(map),[],'the synthetic water is valid');
const R=worldRange();let tests=0;const ok=(c,m)=>{assert(c,m);tests++};

// The shipped map: its old-form river is not chunked (world.js draws it as before), so no chunk has water.
for(let j=R.j0;j<=R.j1;j++)for(let i=R.i0;i<=R.i1;i++)ok(waterChunkData(MAP,i,j)===null,'no chunk water on the shipped map '+i+':'+j);

// Every chunk of the synthetic world: attributes present and sane, nothing outside its chunk
const tri={},kinds=new Set(),total={tri:0,verts:0},per=new Map();let maxTri=0,maxVerts=0,withWater=0,area=new Map();
for(let j=R.j0;j<=R.j1;j++)for(let i=R.i0;i<=R.i1;i++){
 const d=waterChunkData(map,i,j);if(!d)continue;withWater++;const b=chunkBounds(i,j),n=d.vertices,key=chunkKey(i,j);
 ok(d.position.length===n*3&&d.normal.length===n*3&&d.uv.length===n*2&&d.aDepth.length===n&&d.aFlow.length===n*3&&d.aFoam.length===n&&d.aKind.length===n,'attribute sizes '+key);
 ok(d.index.length===d.triangles*3&&d.index.every(k=>k<n),'index in range '+key);
 let a=0;for(let t=0;t<d.index.length;t+=3){const [p,q,r]=[0,1,2].map(o=>d.index[t+o]),x=k=>d.position[k*3],y=k=>d.position[k*3+1],z=k=>d.position[k*3+2];
  const ny=(z(q)-z(p))*(x(r)-x(p))-(x(q)-x(p))*(z(r)-z(p));if(Math.abs(ny)>1e-6)ok(ny>0,'horizontal triangles face up '+key);a+=Math.abs(ny)/2}
 area.set(key,a);
 for(let k=0;k<n;k++){const x=d.position[k*3],y=d.position[k*3+1],z=d.position[k*3+2];
  ok(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1,'vertex inside its chunk '+key+' '+x+','+z);
  ok(Number.isFinite(y)&&d.aDepth[k]>=0&&d.aDepth[k]<=2.5+1e-6&&d.aFoam[k]>=0&&d.aFlow[k*3+2]>=0,'sane depth, foam, speed '+key);
  const nl=Math.hypot(d.normal[k*3],d.normal[k*3+1],d.normal[k*3+2]);ok(Math.abs(nl-1)<1e-3||nl>.9,'unit normal '+key);
  const kind=d.aKind[k];kinds.add(kind);
  if(kind===0){ok(Math.abs(y+.95)<1e-6,'river surface at its water y');ok(Math.abs(Math.hypot(d.aFlow[k*3],d.aFlow[k*3+1])-1)<1e-3,'river flow direction is a unit tangent');
   const w=waterAt(d.position[k*3],d.position[k*3+2],map);if(w&&w.kind==='river'&&w.id==='big-river')ok(Math.abs(w.depth-d.aDepth[k])<.15,'river depth follows waterAt (5 columns across, cosine in between) '+w.depth+' vs '+d.aDepth[k])}
  if(kind===1)ok(Math.abs(y+.9)<1e-6&&d.aDepth[k]<=2.5+1e-6,'lake level');
  if(kind===2)ok(Math.abs(y+2)<1e-6&&d.aDepth[k]<=.6+1e-6,'sea level and the user-decided 0.6 m bed over the beach');}
 maxTri=Math.max(maxTri,d.triangles);maxVerts=Math.max(maxVerts,n);total.tri+=d.triangles;total.verts+=n;per.set(key,d);const tag=[...new Set(d.aKind)].join('');tri[tag]=Math.max(tri[tag]||0,d.triangles);
}
ok([0,1,2,3].every(k=>kinds.has(k)),'all four kinds appear: '+[...kinds]);
// Coverage: a chunk wholly inside the lake or the sea is one full 100 x 100 sheet; the lake over all chunks adds up to its outline (280 x 220)
ok(Math.abs(area.get('10:6')-1e4)<1,'a lake chunk is one full sheet: '+area.get('10:6'));ok(Math.abs(area.get('5:17')-1e4)<1,'a sea chunk is one full sheet');
{const lakeKeys=[...per.keys()].filter(k=>{const [i,j]=k.split(':').map(Number);return i>=9&&i<=12&&j>=5&&j<=7});let s=0;for(const k of lakeKeys){const d=per.get(k);for(let v=0;v<d.vertices;v++)if(d.aKind[v]!==1)s=-1e9}
 if(s>=0){const sum=lakeKeys.reduce((t,k)=>t+area.get(k),0);ok(Math.abs(sum-280*220)<2,'the lake chunks add up to the lake: '+sum)}}
// The bed shows: the lake centre vertices are 2.5 m deep, the outline vertices 0; the sea is 0 at the shoreline; the river centre is 0.8
{const d=per.get('10:6');ok(Math.max(...d.aDepth)>2.4,'lake centre is deep');const e=per.get('9:6');ok(Math.min(...e.aDepth)<=1e-6,'the lake edge has depth 0 (waterline)')
 const s=per.get('5:16');ok(Math.min(...s.aFoam)<1&&Math.min(...s.aDepth)<1e-6,'the sea shoreline vertices are depth 0 and foam 0 (waterline = shoreline)');const r=per.get('1:11');ok(Math.max(...r.aDepth)>.79,'the river centre is deeper than its edges')}

// Meshes through the chunk streaming: built, one draw call each, disposed again
{const mat=new THREE.MeshStandardMaterial({color:'#4a86a6',transparent:true,opacity:.94,side:THREE.DoubleSide,depthWrite:false}),scene=new THREE.Group();
 let clock=0,disposedGeo=0;const slice=(i,j)=>({key:chunkKey(i,j),i,j});
 const view=createChunkView({index:{range:R,slice},scene,map:MAP,build:{water:s=>{const m=waterChunkMesh(THREE,mat,map,s.i,s.j);m?.geometry.addEventListener('dispose',()=>disposedGeo++);return m}},now:()=>clock,disposeDelayMs:100});
 view.ensure(660,-550,2);
 const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});ok(meshes.length>=9,'the 5 x 5 chunks round a lake chunk are mostly water: '+meshes.length);
 ok(meshes.every(m=>m.material===mat&&m.renderOrder===1&&WATER_ATTRIBUTES.every(a=>m.geometry.getAttribute(a))),'one shared material, all vertex attributes');
 for(const m of meshes){const [i,j]=m.name.slice(6).split(':').map(Number),b=chunkBounds(i,j);m.geometry.computeBoundingBox();const bb=m.geometry.boundingBox;ok(bb.min.x>=b.x0-1e-4&&bb.max.x<=b.x1+1e-4&&bb.min.z>=b.z0-1e-4&&bb.max.z<=b.z1+1e-4,'mesh stays inside '+m.name);ok(view.meshesOf(m.name.slice(6))===1,'one draw call per chunk')}
 // walk far away: the chunks are disposed (geometry too) and nothing is left in the scene
 for(let step=0;step<200&&scene.children.length;step++){clock+=60;view.update(-300,-1100,1e9)}
 ok(disposedGeo>=meshes.length,'every built water geometry was disposed: '+disposedGeo+' of '+meshes.length);
 const dead=meshes.filter(m=>m.parent);ok(dead.length===0,'disposed water meshes left the scene: '+dead.length)}

// Minimap: nothing is drawn for the shipped map; the synthetic map draws sea, lake, river and falls
{const rec=[];const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:(...a)=>{rec.push([k,a])},set:(t,k,v)=>{t[k]=v;return true}});const px=x=>(x+450)*.1,pz=z=>(z+1200)*.1;
 ok(drawWaterLayer(ctx,MAP,px,pz,.1)===0&&rec.length===0,'the shipped map adds nothing to the minimap');
 const n=drawWaterLayer(ctx,map,px,pz,.1);ok(n>=5&&rec.some(c=>c[0]==='fill')&&rec.some(c=>c[0]==='stroke'),'synthetic water is drawn: '+n+' shapes');
 ok(rec.every(c=>c[1].every(v=>typeof v!=='number'||Number.isFinite(v))),'every minimap coordinate is finite')}

console.log(`water-chunks: ${tests} checks; ${withWater} chunks with water; per chunk max ${maxTri} triangles and ${maxVerts} vertices (1 draw call each); max triangles by kinds present ${JSON.stringify(tri)}; whole map ${total.tri} triangles`);
