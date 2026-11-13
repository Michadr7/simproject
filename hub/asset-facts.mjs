// Mikkadr Hub 2.8.1: measured facts about a new model file, so nobody has to find out by hand that a "character" has no skeleton. Reads only the JSON header of a .glb or .gltf (never the mesh bytes, never a model, never a network).
// factsOfGltf and problemsOf are pure; readFacts reads the header and keeps the answer until the file changes. Everything said here is counted from the file; a guess is never printed as a fact.
import fs from 'node:fs';
import path from 'node:path';

export const MAX_HEADER=16*1024*1024,BIG_FILE=25*1024*1024,HEAVY_TRIS=100000,CHARACTER_TRIS=30000;
const CHARACTER=/(^|[\\/_ .-])(character|characters|man|woman|person|people|npc|human|body|avatar)([\\/_ .-]|$)/i;
export const looksLikeCharacter=p=>CHARACTER.test(String(p||''));
const n=v=>Number.isFinite(v)?v:0;
// json: the parsed glTF JSON; bytes: the size of the file.
export function factsOfGltf(g,bytes=0){
 const acc=g.accessors||[],meshes=g.meshes||[],skins=g.skins||[],anims=g.animations||[],imgs=g.images||[],nodes=g.nodes||[];
 let tris=0,verts=0,skinnedMeshes=0,parts=0;
 for(const m of meshes)for(const p of m.primitives||[]){parts++;const pos=acc[p.attributes&&p.attributes.POSITION];if(!pos)continue;verts+=n(pos.count);tris+=(p.indices!=null&&acc[p.indices]?n(acc[p.indices].count):n(pos.count))/3;if(p.attributes.JOINTS_0!=null)skinnedMeshes++}
 const bounds=(()=>{const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];let any=false;for(const m of meshes)for(const p of m.primitives||[]){const a=acc[p.attributes&&p.attributes.POSITION];if(a&&a.min&&a.max){any=true;for(let i=0;i<3;i++){mn[i]=Math.min(mn[i],a.min[i]);mx[i]=Math.max(mx[i],a.max[i])}}}return any?{height:+(mx[1]-mn[1]).toFixed(2),width:+(mx[0]-mn[0]).toFixed(2),depth:+(mx[2]-mn[2]).toFixed(2)}:null})();
 return {bytes:n(bytes),nodes:nodes.length,meshes:meshes.length,parts,triangles:Math.round(tris),vertices:verts,skins:skins.length,bones:skins.reduce((s,k)=>s+(k.joints||[]).length,0),skinnedMeshes,
  animations:anims.length,clips:anims.map(a=>String(a.name||'').slice(0,40)).slice(0,12),materials:(g.materials||[]).length,textures:(g.textures||[]).length,images:imgs.length,externalImages:imgs.filter(i=>i.uri&&!/^data:/.test(i.uri)).length,bounds}}
const k=x=>Math.round(x).toLocaleString('en-US');
export const sizeWords=b=>b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
// The facts in one line of plain words.
export const oneLine=f=>[`${k(f.triangles)} triangles`,f.skins?`${f.bones} bones`:'no skeleton',f.animations?`${f.animations} animation clip${f.animations===1?'':'s'}`:'no animations',`${f.materials} material${f.materials===1?'':'s'}`,sizeWords(f.bytes)].join(', ');
// What is wrong, in plain words, for a file of this path. A character is expected to have a skeleton, clips and a modest triangle count.
export function problemsOf(f,filePath=''){
 const out=[],ch=looksLikeCharacter(filePath);
 if(ch&&!f.skins)out.push('It has no skeleton, so it cannot walk, hold a tool or sit until it is rigged. A rigged copy or rigging in Blender is needed.');
 if(ch&&f.skins&&!f.animations)out.push('It has a skeleton but no animation clips (no idle, walk or run).');
 if(f.triangles>(ch?CHARACTER_TRIS:HEAVY_TRIS))out.push(`${k(f.triangles)} triangles is far over the game's budget${ch?' (a character is a few thousand)':''}. It needs decimating before it can be used.`);
 if(f.bytes>BIG_FILE)out.push(`The file is ${sizeWords(f.bytes)}, very large for a web game; the game would load slowly.`);
 if(f.externalImages>0)out.push(`${f.externalImages} texture file${f.externalImages===1?' is':'s are'} separate from the model and must travel with it.`);
 if(ch&&f.parts===1&&f.materials<=1)out.push('It is one mesh with one material, so skin, hair and clothes cannot be changed separately.');
 if(!f.meshes)out.push('It contains no mesh.');
 return out}
// Read the JSON header of a .glb (or the .gltf file itself). Returns {facts, problems, line} or {error}. Cached by path, size and time.
const cache=new Map();
export function readFacts(file,rel=''){
 let st;try{st=fs.statSync(file)}catch{return {error:'The file could not be read.'}}
 const key=file+'|'+st.size+'|'+st.mtimeMs,hit=cache.get(file);if(hit&&hit.key===key)return hit.value;
 let value;
 try{
  const ext=path.extname(file).toLowerCase();let json;
  if(ext==='.glb'){const fd=fs.openSync(file,'r');try{const head=Buffer.alloc(20);fs.readSync(fd,head,0,20,0);
    if(head.readUInt32LE(0)!==0x46546C67)throw new Error('not a GLB file');
    const len=head.readUInt32LE(12),type=head.readUInt32LE(16);if(type!==0x4E4F534A||len>MAX_HEADER)throw new Error('unreadable header');
    const buf=Buffer.alloc(len);fs.readSync(fd,buf,0,len,20);json=JSON.parse(buf.toString('utf8'))}finally{fs.closeSync(fd)}}
  else if(ext==='.gltf'){if(st.size>MAX_HEADER)throw new Error('too large to read');json=JSON.parse(fs.readFileSync(file,'utf8'))}
  else return {error:'Only .glb and .gltf files are measured.'};
  const facts=factsOfGltf(json,st.size);value={facts,problems:problemsOf(facts,rel||file),line:oneLine(facts)}}
 catch(e){value={error:'Could not read the model header: '+String(e&&e.message||e).slice(0,80)}}
 cache.set(file,{key,value});if(cache.size>200)cache.delete(cache.keys().next().value);
 return value}