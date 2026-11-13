// Mikkadr Hub 2.8.1: measured file checks. The hub reads only the JSON header of a model file and says in plain words what it found: no skeleton, too heavy, no clips. Pure rules, the header reader on a built file, the Assets summary, the master's status block, and the page.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {factsOfGltf,problemsOf,oneLine,readFacts,looksLikeCharacter,sizeWords,CHARACTER_TRIS} from '../hub/asset-facts.mjs';
import {createRecords} from '../hub/records-store.mjs';
import {statusText} from '../hub/status.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// a tiny glTF description: n triangles in one mesh part, optional skin and clips
const gltf=({tris=100,skin=false,clips=0,materials=1,uri=false}={})=>({asset:{version:'2.0'},nodes:[{name:'n'}],meshes:[{name:'m',primitives:[{attributes:{POSITION:0,...(skin?{JOINTS_0:2}:{})},indices:1}]}],
 accessors:[{count:tris*3,min:[-0.5,0,-0.2],max:[0.5,1.8,0.2]},{count:tris*3},{count:tris*3}],skins:skin?[{joints:[0,1,2]}]:[],animations:Array.from({length:clips},(_,i)=>({name:'clip'+i,channels:[],samplers:[]})),
 materials:Array.from({length:materials},()=>({})),textures:[{}],images:[uri?{uri:'tex.png'}:{bufferView:0,mimeType:'image/png'}]});
const glb=(json,extra=0)=>{let j=Buffer.from(JSON.stringify(json),'utf8');while(j.length%4)j=Buffer.concat([j,Buffer.from(' ')]);const bin=Buffer.alloc(8+extra),total=12+8+j.length+bin.length;const h=Buffer.alloc(20);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(total,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4E4F534A,16);return Buffer.concat([h,j,bin])};

// facts
let f=factsOfGltf(gltf({tris:262348}),12345678);assert.equal(f.triangles,262348);assert.equal(f.skins,0);assert.equal(f.bones,0);assert.equal(f.animations,0);assert.equal(f.materials,1);assert.deepEqual(f.bounds,{height:1.8,width:1,depth:0.4});
assert.equal(oneLine(f),'262,348 triangles, no skeleton, no animations, 1 material, 11.8 MB');
f=factsOfGltf(gltf({tris:5000,skin:true,clips:3,materials:4}),1500000);assert.equal(f.bones,3);assert.equal(f.animations,3);assert.equal(f.skinnedMeshes,1);assert.match(oneLine(f),/5,000 triangles, 3 bones, 3 animation clips, 4 materials, 1\.4 MB/);
// problems: said for what it is
assert.equal(looksLikeCharacter('Character/man-base-character.glb'),true);assert.equal(looksLikeCharacter('Tools/Steel_Axe by Quaternius.glb'),false);assert.equal(looksLikeCharacter('Props/mandarin_tree.glb'),false,'a word that only contains man is not a man');
let p=problemsOf(factsOfGltf(gltf({tris:262348}),12e6),'Character/man-base-character.glb');assert.match(p[0],/no skeleton/);assert.ok(p.some(x=>/far over the game's budget \(a character is a few thousand\)/.test(x)));assert.ok(p.some(x=>/one mesh with one material/.test(x)));
assert.deepEqual(problemsOf(factsOfGltf(gltf({tris:5000,skin:true,clips:3,materials:3}),1.5e6),'Character/ok.glb'),[],'a good character has no problems');
p=problemsOf(factsOfGltf(gltf({tris:5000,skin:true,clips:0,materials:3}),1e6),'Character/x.glb');assert.deepEqual(p.length,1);assert.match(p[0],/no animation clips/);
assert.deepEqual(problemsOf(factsOfGltf(gltf({tris:8000}),1e6),'Tools/axe.glb'),[],'a prop is not expected to have a skeleton');assert.match(problemsOf(factsOfGltf(gltf({tris:150000}),1e6),'Tools/axe.glb')[0],/far over the game's budget\. It needs decimating/);
assert.ok(problemsOf(factsOfGltf(gltf({tris:100,uri:true}),1e6),'x.glb').some(x=>/separate from the model/.test(x)));assert.ok(problemsOf(factsOfGltf(gltf({tris:100}),30*1048576),'x.glb').some(x=>/very large/.test(x)));assert.equal(CHARACTER_TRIS,30000);assert.equal(sizeWords(1572864),'1.5 MB');

// the header reader, on built files in a temporary project
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-facts-')),as=path.join(dir,'assets-src','Character');fs.mkdirSync(as,{recursive:true});
const man=path.join(as,'man-base-character.glb');fs.writeFileSync(man,glb(gltf({tris:262348}),3*1048576));
let r=readFacts(man,'Character/man-base-character.glb');assert.equal(r.facts.triangles,262348);assert.match(r.line,/no skeleton/);assert.ok(r.problems.length>=2);
fs.writeFileSync(path.join(as,'junk.glb'),Buffer.from('not a glb at all, just words'));assert.match(readFacts(path.join(as,'junk.glb')).error,/Could not read the model header/);
fs.writeFileSync(path.join(as,'a.png'),Buffer.from([1,2,3]));assert.match(readFacts(path.join(as,'a.png')).error,/Only \.glb and \.gltf/);assert.match(readFacts(path.join(dir,'nope.glb')).error,/could not be read/);
// cached until the file changes
const again=readFacts(man,'Character/man-base-character.glb');assert.equal(again,r,'the same answer object while the file is unchanged');fs.writeFileSync(man,glb(gltf({tris:5000,skin:true,clips:2,materials:3}),1048576));const changed=readFacts(man,'Character/man-base-character.glb');assert.equal(changed.facts.triangles,5000);assert.deepEqual(changed.problems,[]);
fs.writeFileSync(man,glb(gltf({tris:262348}),3*1048576));

// the Assets summary and the master's status block
fs.writeFileSync(path.join(dir,'assets-register.json'),'{"assets":[]}\n');
{const recs=createRecords({root:dir,load:async()=>({assets:[]}),originals:async()=>['Character/man-base-character.glb','Sounds/water.wav']});
 await recs.summary();const s=await recs.summary();
 const item=s.newFiles.items.find(i=>i.path==='Character/man-base-character.glb');assert.match(item.check.line,/262,348 triangles, no skeleton/);assert.ok(item.check.problems.length>=2);assert.equal(s.newFiles.items.find(i=>i.path==='Sounds/water.wav').check,null,'a sound is not measured');
 const st=statusText({root:dir,records:recs});assert.match(st,/File check, measured by the hub: Character\/man-base-character\.glb: 262,348 triangles, no skeleton/);assert.match(st,/PROBLEMS: It has no skeleton/);assert.ok(!/water\.wav: /.test(st.split('File check')[1]||''))}
fs.rmSync(dir,{recursive:true,force:true});

// the master is told to say it first; the page shows it; the code reads a header and nothing else
const chat=fs.readFileSync(path.join(root,'hub','chat.js'),'utf8'),page=fs.readFileSync(path.join(root,'hub','web','assets-area.js'),'utf8'),src=fs.readFileSync(path.join(root,'hub','asset-facts.mjs'),'utf8').replace(/\/\/.*$/gm,'');
assert.ok(chat.includes('File check, measured by the hub')&&chat.includes('say that FIRST')&&chat.includes('Never call a file ready or usable while a problem is listed'),'the master is told');
assert.ok(page.includes('checkView(i.check)')&&page.includes('File problems'),'the Assets page shows the checks');assert.ok(!/child_process|fetch\(|https?:/.test(src),'it reads one file header and starts and sends nothing');
// the file problems wait for you in Work, without anyone asking
{const {buildWaiting}=await import('../hub/waiting.js'),{buildWork,nextStep}=await import('../hub/work.js');
 const chk=[{path:'Character/man-base-character.glb',check:{line:'x',problems:['It has no skeleton, so it cannot walk.','262,348 triangles is far over the budget.']}},{path:'Tools/axe.glb',check:{line:'y',problems:[]}},{path:'Sounds/a.wav',check:null}];
 const w=buildWaiting({fileChecks:chk,now:1});const it=w.items.filter(i=>i.group==='filecheck');assert.equal(it.length,1,'only a file with a problem');assert.match(it[0].title,/^man-base-character\.glb: 2 problems found in the file$/);assert.match(it[0].detail,/no skeleton.*\(and 1 more\)/);assert.equal(it[0].actions[0].href,'#assets');
 assert.equal(buildWaiting({fileChecks:[],now:1}).items.filter(i=>i.group==='filecheck').length,0);
 const tree=buildWork({waiting:w.items,enabled:true});const item=tree.projects.flatMap(p=>p.items).find(i=>i.id==='filecheck:Character/man-base-character.glb');assert.equal(item.kind,'filecheck');assert.equal(item.needsYou,false);assert.match(item.next,/Open Assets to read what the hub measured/);assert.equal(tree.needsYou,0,'a file problem is a quiet note: it does not count as something that needs you');}
console.log('hub-asset-facts: the measured facts, the plain-word problems for a character and for a prop, the header reader with its cache, the Assets summary, the status block of the master, and the page passed.');