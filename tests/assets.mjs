// Asset tracker (Mikkadr Hub P3c, hub/assets.js): the pure rules on small fixtures, then the real register and modules (step 2: sub-categories, in-game detection, overrides).
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {STAGES,KINDS,describeModules,buildAssets,groupByPack,packFor,quotedIn,moduleImported,unregisteredOriginals,claimProblems} from '../hub/assets.js';
import {loadAssets,listOriginals} from '../hub/assets-load.mjs';

// quotedIn: only a whole quoted id counts, and regex characters in ids are safe.
assert(quotedIn('prop.box-small',"createProp('prop.box-small')"));
assert(!quotedIn('prop.box-small',"createProp('prop.box-smaller')"));
assert(!quotedIn('house-a',"const house-a=1"));
assert(moduleImported('forklift-assets.js',"import {FORKLIFT} from './forklift-assets.js';"));
assert(!moduleImported('forklift-assets.js',"import x from './forklift.js'"));

// packFor: the longest covering prefix wins.
const reg={assets:[{id:'a',name:'A',pack:'Vehicles',covers:['Veichles/']},{id:'b',name:'B',pack:'Flatbeds',covers:['Veichles/Logging Truck/']},{id:'c',name:'C',stage:'wanted'}],inGameOverrides:{'prop.pump':{file:'x.js',why:'built by code'}}};
assert.equal(packFor('Veichles/Logging Truck/flatbed.glb',reg).id,'b');
assert.equal(packFor('Veichles/other.glb',reg).id,'a');
assert.equal(packFor('nothing/here.glb',reg),null);

// describeModules keeps only small facts and names the viewer route.
const d=describeModules({props:{'house-a':{source:'k/a.glb',width:10,depth:8,height:5,triangles:100}},nature:{models:{'pine.1':{source:'Pine_1',height:9,canopyRadius:2,triangles:50}}},rigged:{},axes:{axe:{source:'Simple_axe',triangles:9,bounds:{min:{x:0,y:0,z:0},max:{x:.1,y:.9,z:.1}}}},saws:{},forklift:{source:'F.obj',triangles:7},flatbed:null,waterCooler:true,characters:[{id:'male',name:'Male',source:'module:character-male'}],vehiclePictures:['a','b'],signPictures:2});
assert.deepEqual(d.map(x=>x.id),['prop:house-a','nature:pine.1','axe:axe','forklift','water-cooler','character:male','pictures:vehicles','pictures:signs']);
assert.deepEqual(d[0].size,{w:10,d:8,h:5});
assert.equal(d.find(x=>x.id==='axe:axe').size.h,.9);
assert.equal(d.find(x=>x.id==='prop:house-a').viewer,'createProp');
for(const x of d)assert(!('pos' in x)&&!('nor' in x),'no raw model fields on a record');

// buildAssets: referenced -> in-game; unreferenced -> converted; an override forces in-game and says why; unregistered is counted.
const derived=[{id:'prop:ref',gameId:'ref',name:'Ref',kind:'model',source:'Veichles/x.glb',triangles:1,size:null},{id:'prop:un',gameId:'un',name:'Un',kind:'model',source:'Veichles/y.glb',triangles:1,size:null},{id:'prop:prop.pump',gameId:'prop.pump',name:'Pump',kind:'model',source:'Veichles/z.glb',triangles:1,size:null},{id:'prop:lost',gameId:'lost',name:'Lost',kind:'model',source:'zzz/q.glb',triangles:1,size:null}];
const built=buildAssets({register:reg,derived,gameText:"p('ref')",creditFor:()=>null});
const by=id=>built.assets.find(a=>a.id===id);
assert.equal(by('prop:ref').stage,'in-game');assert.equal(by('prop:un').stage,'converted');
assert.equal(by('prop:prop.pump').stage,'in-game');assert(/override: built by code/.test(by('prop:prop.pump').evidence));
assert.equal(by('prop:lost').registered,false);assert.equal(built.summary.unregistered,1);
assert.equal(by('prop:ref').pack,'Vehicles');
assert.deepEqual(built.summary.unreferenced,['prop:un','prop:lost']);

// groupByPack: one group per pack with stage counts; busier packs first.
const g=groupByPack([{pack:'P',stage:'in-game',triangles:5},{pack:'P',stage:'received',triangles:null},{pack:'Q',stage:'wanted'},{pack:'R',stage:'converted',triangles:2},{pack:'R',stage:'in-game',triangles:3},{pack:'R',stage:'in-game',triangles:3}]);
assert.deepEqual(g.map(x=>x.pack),['R','P','Q']);assert.deepEqual(g[1].stages,{'in-game':1,received:1});assert.equal(g[1].triangles,5);

// The real data: the register is well formed, every shipped module asset is registered, and the sub-categories are built.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const r=await loadAssets(root);
const ids=r.assets.map(a=>a.id);
assert.equal(new Set(ids).size,ids.length,'asset ids are unique');
for(const a of r.assets){assert(STAGES.includes(a.stage),`${a.id}: stage ${a.stage}`);assert(KINDS.includes(a.kind),`${a.id}: kind ${a.kind}`);assert(a.pack,`${a.id} has a pack`)}
assert.equal(r.summary.fromModules,Object.keys(r.derived).length);
assert.equal(r.summary.unregistered,0,'every shipped asset is covered by a register entry: '+r.assets.filter(a=>a.origin==='module'&&!a.registered).map(a=>a.id).join(', '));
assert(r.summary.fromModules>=100,'the dist modules describe at least 100 assets');
for(const [k,o] of Object.entries(r.register.inGameOverrides)){assert(fs.existsSync(path.join(root,'dist',o.file)),`override ${k} names a file that exists`);assert(o.why,`override ${k} says why`)}
assert(r.groups.length>=10&&r.groups.length<=40,'a sensible number of sub-categories: '+r.groups.length);
assert(r.groups.reduce((n,x)=>n+x.items.length,0)===r.assets.length,'every asset is in exactly one group');
const furniture=r.groups.find(x=>x.pack==='Kenney Furniture Kit');
assert(furniture&&furniture.items.length>=25,'the furniture kit folds into one group with its shipped pieces and the received kit');
console.log(`Assets: ${r.summary.total} records (${r.summary.fromRegister} from the register, ${r.summary.fromModules} from the dist modules) in ${r.groups.length} sub-categories; stages ${JSON.stringify(r.summary.byStage)}; ${r.summary.unreferenced.length} shipped assets with no reference (${r.summary.unreferenced.join(', ')}).`);

// ---- Step 5: the rules that keep the register honest.
// (a) A shipped asset the register does not cover fails (the real data above asserts unregistered is 0); here the rule on a fixture, and credits are only a warning.
const miss=buildAssets({register:{assets:[{id:'k',name:'K',pack:'K',covers:['kenney/']}]},derived:[{id:'prop:a',gameId:'a',name:'A',kind:'model',source:'kenney/a.glb',triangles:1,size:null},{id:'prop:b',gameId:'b',name:'B',kind:'model',source:'elsewhere/b.glb',triangles:1,size:null}],gameText:"'a','b'",creditFor:()=>null});
assert.equal(miss.summary.unregistered,1,'an asset with no register entry is counted');assert.equal(miss.assets.find(a=>a.id==='prop:b').registered,false);
assert(miss.assets.every(a=>a.hasCredit===false),'no credit is recorded, and that is not an error');
// (b) Claims nothing backs: a hand-written in-game entry, a pack that covers nothing, an override that points at nothing.
const dist=f=>f==='x.js'?"import('./thing-${kind}.js')":null;
const dd=[{source:'kenney/a.glb'}];
assert.deepEqual(claimProblems({assets:[{id:'p',covers:['kenney/'],stage:'in-game'},{id:'w',stage:'wanted'}],inGameOverrides:{}},dd,dist),[]);
assert(claimProblems({assets:[{id:'h',stage:'in-game'}]},dd,dist).some(x=>/cannot claim "in-game"/.test(x)),'a hand-written in-game entry fails');
assert(claimProblems({assets:[{id:'h',stage:'converted'}]},dd,dist).some(x=>/cannot claim "converted"/.test(x)),'a hand-written converted entry fails');
assert(claimProblems({assets:[{id:'p',covers:['nowhere/'],stage:'in-game'}]},dd,dist).some(x=>/match no shipped asset/.test(x)),'a pack that covers nothing fails');
assert(claimProblems({assets:[],inGameOverrides:{a:{file:'gone.js',needle:'n',why:'w'}}},dd,dist).some(x=>/does not exist/.test(x)),'an override on a missing file fails');
assert(claimProblems({assets:[],inGameOverrides:{a:{file:'x.js',why:'w'}}},dd,dist).some(x=>/needs a "needle"/.test(x)),'an override with no needle fails');
assert(claimProblems({assets:[],inGameOverrides:{a:{file:'x.js',needle:'nope',why:'w'}}},dd,dist).some(x=>/no longer contains/.test(x)),'an override whose proof has gone fails');
assert.deepEqual(claimProblems({assets:[],inGameOverrides:{a:{file:'x.js',needle:'./thing-${kind}.js',why:'w'}}},dd,dist),[],'an override that is proven passes');
// the real register
const readDist=f=>{const p=path.join(root,'dist',f);return fs.existsSync(p)?fs.readFileSync(p,'utf8'):null};
assert.deepEqual(claimProblems(r.register,r.derived,readDist),[],'the register makes no claim the game does not back');
// (c) Originals in assets-src that no entry accounts for only warn (the folder is not in the repo, so it may be absent).
assert.deepEqual(unregisteredOriginals(['a/x.glb','b/y.glb','c/Zed by Someone.glb'],{assets:[{files:['a/x.glb']},{covers:['b/']},{covers:['Zed']}]}),[],'a listed file, a covered folder and a covered file name are all accounted for');
assert.deepEqual(unregisteredOriginals(['q/z.glb','a/x.glb'],{assets:[{files:['a/x.glb']}]}),['q/z.glb'],'an unlisted original is reported');
const originals=listOriginals(root),stray=unregisteredOriginals(originals,r.register);
for(const a of r.register.assets)for(const f of a.files||[])if(originals.length)assert(originals.includes(f),`${a.id}: ${f} is listed in the register but is not in assets-src`);
if(stray.length)console.log(`WARNING: ${stray.length} of ${originals.length} originals in assets-src are not in the register: ${stray.join(', ')}`);
const stale=r.assets.filter(a=>a.origin==='register'&&a.stage==='received'&&a.files.length&&originals.length&&!a.files.every(f=>originals.includes(f)));
assert.equal(stale.length,0,'a received entry points at files that exist');
// credits: a shipped asset with no credits.js line is a warning only until the public release
const uncredited=r.assets.filter(a=>a.origin==='module'&&a.hasCredit===false);
if(uncredited.length)console.log(`WARNING (credits, not urgent until the public release): ${uncredited.length} shipped assets have no credits.js line: ${uncredited.map(a=>a.id).join(', ')}`);
// stages: every register-only asset is wanted or received, every module asset is in-game or converted
for(const a of r.assets)if(a.origin==='register')assert(['wanted','received','retired'].includes(a.stage),`${a.id}: a register entry is wanted, received or retired`);else assert(['in-game','converted'].includes(a.stage),`${a.id}: a shipped asset is in-game or converted`);
console.log(`Register rules: no unbacked claims, ${originals.length} originals checked (${stray.length} unregistered, warning only), ${uncredited.length} uncredited (warning only).`);