// One-off asset build: Quaternius "Ultimate Modular Men/Women" FBX parts -> one compact GLB per
// body type, embedded as a base64 JS module so the game needs no file server or extra requests.
//
//   npm install --no-save three@0.160.0
//   node scripts/build-characters.mjs <folder with the male zip contents> <folder with the female zip contents>
//   (each folder is the unzipped "Separate Skeletal Meshes and Animations" directory)
//
// Writes dist/character-male.js and dist/character-female.js. The source art is CC0 (Quaternius).
// Set THREE_DIR to point at a three@0.160.0 package if it is not in ./node_modules/three.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const THREE_DIR=path.resolve(process.env.THREE_DIR||'node_modules/three');
const imp=file=>import(pathToFileURL(path.join(THREE_DIR,file)).href);
const THREE=await imp('build/three.module.js');
const {FBXLoader}=await imp('examples/jsm/loaders/FBXLoader.js');
const {GLTFExporter}=await imp('examples/jsm/exporters/GLTFExporter.js');
const {GLTFLoader}=await imp('examples/jsm/loaders/GLTFLoader.js');

// Node has no FileReader; GLTFExporter needs one to build the binary container.
globalThis.FileReader=class{
 readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.()})}
 readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result='data:application/octet-stream;base64,'+Buffer.from(buffer).toString('base64');this.onloadend?.()})}
};

const PARTS=['Head','Body','Legs','Feet'];
// [name, source clip, relaxed hands]. Walk and Run keep the hands in the relaxed idle pose (the pack's clips make fists);
// Sprint is the pack's Run unchanged, fists and pumping arms included, for Shift-running.
const CLIPS=[['Idle','Idle'],['Idle_Neutral','Idle_Neutral'],['Walk','Walk',true],['Run','Run',true],['Sprint','Run',false],['Interact','Interact'],['Wave','Wave']];
const FINGERS=/^(Thumb|Index|Middle|Ring|Pinky)\d[LR]\./;
const SETS={
 male:{outfits:['Casual_Hoodie','Casual_2','Suit','Worker','Farmer','Beach','Punk','Adventurer']},
 female:{outfits:['Casual','Formal','Suit','Worker','Punk','Adventurer']}
};
const hairRole=/^(hair|eyebrows|moustache|beard|darkbrown)/i;
const loader=new FBXLoader();
const load=file=>{const b=fs.readFileSync(file);return loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')};
const roleOf=name=>/^skin$/i.test(name)?'skin':hairRole.test(name)?'hair':undefined;


// FBXLoader returns non-indexed geometry with one draw group per run of same-material faces
// (thousands of them) and per-face normals. This sorts faces by material, drops the normals (glTF
// renderers then shade flat, matching the pack's faceted look), welds identical vertices and
// packs joints/weights into bytes. One draw group per material.
function compact(geometry){
 const pos=geometry.attributes.position,skinIndex=geometry.attributes.skinIndex,skinWeight=geometry.attributes.skinWeight;
 const triangles=pos.count/3,materialOf=new Uint8Array(triangles);
 for(const g of geometry.groups)for(let t=g.start/3;t<(g.start+g.count)/3;t++)materialOf[t]=g.materialIndex;
 const order=[...materialOf.keys()].sort((a,b)=>materialOf[a]-materialOf[b]||a-b);
 const lookup=new Map(),positions=[],joints=[],weights=[],index=[],groups=[];
 const quantize=v=>{const w=[0,1,2,3].map(k=>skinWeight.array[v*4+k]),q=w.map(x=>Math.round(x*255));
  const drift=255-q.reduce((a,b)=>a+b,0);if(drift)q[q.indexOf(Math.max(...q))]+=drift;return q};
 for(const [rank,t] of order.entries()){
  if(!rank||materialOf[t]!==materialOf[order[rank-1]])groups.push({start:index.length,count:0,materialIndex:materialOf[t]});
  for(let v=t*3;v<t*3+3;v++){
   const p=[0,1,2].map(k=>pos.array[v*3+k]),j=[0,1,2,3].map(k=>skinIndex.array[v*4+k]),w=quantize(v);
   const key=p.map(x=>x.toFixed(3)).join(',')+'|'+j+'|'+w;let at=lookup.get(key);
   if(at===undefined){at=lookup.size;lookup.set(key,at);positions.push(...p);joints.push(...j);weights.push(...w)}
   index.push(at);groups.at(-1).count++;
  }
 }
 const result=new THREE.BufferGeometry();
 result.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3));
 result.setAttribute('skinIndex',new THREE.BufferAttribute(new Uint8Array(joints),4));
 result.setAttribute('skinWeight',new THREE.BufferAttribute(new Uint8Array(weights),4,true));
 result.setIndex(new THREE.BufferAttribute(new Uint16Array(index),1));
 if(groups.length>1)for(const g of groups)result.addGroup(g.start,g.count,g.materialIndex);
 return result;
}

async function build(kind,dir){
 const root=fs.readdirSync(dir).includes('Animations.fbx')?dir:path.join(dir,'Separate Skeletal Meshes and Animations');
 const sources=[];
 for(const outfit of SETS[kind].outfits){
  const folder=path.join(root,outfit);
  for(const part of PARTS){
   const file=fs.readdirSync(folder).find(f=>f.endsWith(`_${part}.fbx`));
   if(!file)throw new Error(`Missing ${part} for ${outfit}`);
   sources.push({outfit,part,file:path.join(folder,file)});
  }
 }
 const output=new THREE.Group();output.name='character';
 let canonical=null,rigRoot=null;const materials=new Map();
 const materialFor=original=>{
  // The FBX stores linear values that the loader treats as sRGB, so everything comes out too dark.
  const stored=original.color.getRGB({},THREE.SRGBColorSpace);
  const color=new THREE.Color().setRGB(stored.r,stored.g,stored.b);
  const key=original.name+'#'+color.getHexString();
  if(!materials.has(key)){
   const material=new THREE.MeshStandardMaterial({name:original.name,color,roughness:.88,metalness:0});
   const role=roleOf(original.name);if(role)material.userData.role=role;
   materials.set(key,material);
  }
  return materials.get(key);
 };
 let maxInverseDiff=0;
 for(const {outfit,part,file} of sources){
  const scene=load(file);
  const skinned=[];scene.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o)});
  if(skinned.length!==1)throw new Error(`${file}: expected one skinned mesh, found ${skinned.length}`);
  const mesh=skinned[0];
  if(!canonical){
   canonical=mesh.skeleton;
   // Keep only the bone hierarchy as the shared rig.
   let top=canonical.bones[0];while(top.parent&&top.parent!==scene)top=top.parent;
   rigRoot=top;rigRoot.parent?.remove(rigRoot);output.add(rigRoot);
  }
  // Remap this part's joints onto the shared skeleton by bone name.
  // The pack's FootL/FootR are IK control bones: animated on their own, they pull the shoes off the shins.
  // Skin the feet to the lower legs instead (rigid shoes); the legs follow the foot bones' animated positions (character.js).
  const redirect=new Map();for(const [foot,shin] of [['FootL','LowerLegL'],['FootR','LowerLegR']])redirect.set(canonical.bones.findIndex(c=>c.name===foot),canonical.bones.findIndex(c=>c.name===shin));
  const own=mesh.skeleton.bones.map(b=>canonical.bones.findIndex(c=>c.name===b.name)).map(i=>redirect.get(i)??i);
  if(own.includes(-1))throw new Error(`${file}: bone not in shared rig`);
  mesh.skeleton.bones.forEach((b,i)=>{const a=mesh.skeleton.boneInverses[i].elements,c=canonical.boneInverses[canonical.bones.findIndex(x=>x.name===b.name)].elements;for(let k=0;k<16;k++)maxInverseDiff=Math.max(maxInverseDiff,Math.abs(a[k]-c[k]))});
  const index=mesh.geometry.attributes.skinIndex;
  for(let i=0;i<index.array.length;i++)index.array[i]=own[index.array[i]];
  const wasGroups=mesh.geometry.groups.length;mesh.geometry=compact(mesh.geometry);
  mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(materialFor):materialFor(mesh.material);
  mesh.name=`${outfit}__${part}`;
  // The pack stores geometry in metres, Z up; the mesh node's own transform turns that into the rig's centimetres, Y up. Keep it.
  const bindMatrix=mesh.bindMatrix.clone();mesh.parent?.remove(mesh);
  output.add(mesh);mesh.updateMatrixWorld(true);mesh.bind(canonical,bindMatrix);
 }
 // Animation clips from the shared animation file.
 const source=load(path.join(root,'Animations.fbx'));
 const clips=[];
 for(const [name,wanted,relaxHands] of CLIPS){
  const clip=source.animations.find(c=>c.name.split('|').pop()===wanted);
  if(!clip)throw new Error('Missing clip '+wanted);
  let tracks=clip.tracks.filter(track=>{
   // Foot control bones drive the legs by IK at runtime: keep where they move, drop their rotations and the pole targets.
   if(/^(PTL|PTR)\./.test(track.name)||/^(FootL|FootR)\.(quaternion|scale)$/.test(track.name))return false;
   if(track.name.endsWith('.quaternion'))return true;
   // Positions and scales matter only where they actually move.
   const v=track.values,stride=track.name.endsWith('.scale')?3:3;let moves=false;
   for(let i=stride;i<v.length&&!moves;i++)if(Math.abs(v[i]-v[i%stride])>1e-3)moves=true;
   return moves;
  });
  if(relaxHands){
   const idle=clips.find(c=>c.name==='Idle_Neutral');
   const held=idle.tracks.filter(t=>FINGERS.test(t.name)).map(t=>new THREE.QuaternionKeyframeTrack(t.name,[0,clip.duration],[...t.values.slice(0,4),...t.values.slice(0,4)]));
   tracks=[...tracks.filter(t=>!FINGERS.test(t.name)),...held];
  }
  clips.push(new THREE.AnimationClip(name,clip.duration,tracks));
 }
 output.updateMatrixWorld(true);
 const census=o=>{const c={};o.traverse(x=>{const k=x.isSkinnedMesh?'skinned':x.isBone?'bone':x.isMesh?'mesh':x.type;c[k]=(c[k]||0)+1});return JSON.stringify(c)};
 console.log(`  before export: ${census(output)}`);
 let verts=0,tris=0;output.traverse(o=>{if(o.isSkinnedMesh){verts+=o.geometry.attributes.position.count;tris+=o.geometry.index.count/3}});
 console.log(`  geometry: ${verts} vertices, ${tris} triangles; animation: ${clips.reduce((n,c)=>n+c.tracks.reduce((m,t)=>m+t.times.length+t.values.length,0),0)} floats in ${clips.reduce((n,c)=>n+c.tracks.length,0)} tracks`);
 const glb=await new Promise((resolve,reject)=>new GLTFExporter().parse(output,resolve,reject,{binary:true,animations:clips,onlyVisible:false}));
 // Round-trip check.
 const parsed=await new GLTFLoader().parseAsync(glb,'');
 const meshes=[];parsed.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
 console.log(`  after reload: ${census(parsed.scene)}`);
 const names=[...new Set(meshes.flatMap(m=>[].concat(m.material).map(x=>x.name+(x.userData.role?`[${x.userData.role}]`:''))))].sort();
 console.log(`${kind}: ${meshes.length} parts, ${parsed.animations.length} clips, ${(glb.byteLength/1024).toFixed(0)} KB glb, max bind-matrix difference between parts ${maxInverseDiff.toExponential(2)}`);
 console.log(`  materials: ${names.join(', ')}`);
 const out=path.resolve('dist',`character-${kind}.js`);
 fs.writeFileSync(out,`// Generated by scripts/build-characters.mjs from Quaternius Ultimate Modular ${kind==='male'?'Men':'Women'} (CC0). Do not edit.\nexport default '${Buffer.from(glb).toString('base64')}';\n`);
 console.log(`  wrote ${out} (${(fs.statSync(out).size/1024/1024).toFixed(2)} MB)`);
}
const [,, maleDir, femaleDir]=process.argv;
if(!maleDir||!femaleDir){console.error('Usage: node scripts/build-characters.mjs <male folder> <female folder>');process.exit(1)}
await build('male',maleDir);await build('female',femaleDir);
