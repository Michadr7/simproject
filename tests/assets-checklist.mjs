// Import checklist (Mikkadr Hub P3c, hub/checklist.js): the steps from "received" to "in the game", worked out from the register's facts.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checklistFor,checklists,BUDGET} from '../hub/checklist.js';
import {markShipped} from '../hub/assets.js';
import {loadAssets} from '../hub/assets-load.mjs';
import {renderAssetsPage} from '../hub/assets-page.js';

const base={origin:'register',kind:'model',stage:'received',name:'Thing',files:['a/thing.glb'],format:'glb',triangles:500,unit:2,class:'furniture',plannedUse:'a chair',licence:'CC0',credit:'Someone'};
const ids=c=>c.steps.map(s=>s.id);
const step=(c,id)=>c.steps.find(s=>s.id===id);

// A ready asset: original on disk, GLB, within budget. Only the work that is always left remains.
let c=checklistFor(base);
assert.deepEqual(ids(c),['original','format','size','scale','convert','use','docs']);
assert.equal(step(c,'original').state,'done');assert.equal(step(c,'format').state,'done');assert.equal(step(c,'size').state,'done');
assert.equal(c.ready,true);assert.deepEqual(c.blockers,[]);assert.equal(c.done,3);assert.equal(c.total,7);assert.equal(c.next,step(c,'scale').label);
assert(/2 m per model unit/.test(step(c,'scale').label),'the known scale is named');
// An original that is not on this PC blocks; wanted asks to get it
c=checklistFor({...base,files:[]});assert.equal(c.ready,false);assert(/not on this PC/.test(c.blockers[0]));
c=checklistFor({...base,files:[],stage:'wanted'});assert(/Get the model/.test(c.blockers[0]));assert.equal(c.ready,false,'a wanted asset is never "ready"');
// FBX, archives and TGA textures block
c=checklistFor({...base,format:'fbx'});assert.equal(step(c,'format').state,'todo');assert(/Convert the FBX to GLB/.test(step(c,'format').label));assert.equal(c.ready,false);
c=checklistFor({...base,format:'fbx',archive:'rar'});assert(/Unpack the RAR archive/.test(step(c,'format').label));
c=checklistFor({...base,textures:'tga'});assert(ids(c).includes('textures'));assert.equal(c.ready,false);assert(/TGA/.test(c.blockers.join()));
c=checklistFor({...base,format:null});assert(/Check the file format/.test(step(c,'format').label));
// size: over the class budget asks for simplifying (a pack says "the largest piece"), unknown asks for a count
c=checklistFor({...base,triangles:2988});assert.equal(step(c,'size').state,'todo');assert.equal(step(c,'size').label,`Simplify from 2,988 to about ${BUDGET.furniture.toLocaleString('en-US')} triangles`);assert.equal(c.ready,true,'size is work to do, not a blocker');
assert(/largest piece/.test(checklistFor({...base,name:'Furniture Kit (117 GLB)',triangles:9000}).steps.find(s=>s.id==='size').label));
assert(/Count the triangles/.test(step(checklistFor({...base,triangles:null}),'size').label));
assert.equal(step(checklistFor({...base,triangles:BUDGET.furniture}),'size').state,'done','exactly on budget is fine');
assert(BUDGET.character<49158,'the character budget is below the shipped male (49,158): it is the number to change if you disagree');
// scale and rigging
assert(/Measure the scale/.test(step(checklistFor({...base,unit:null}),'scale').label));assert(/units are huge/.test(step(checklistFor({...base,unit:null,scaleNote:'units are huge'}),'scale').label));
assert(/rigged model/.test(step(checklistFor({...base,skinned:true}),'convert').label));
// sounds and pictures have no model steps
c=checklistFor({...base,kind:'sound',files:[],stage:'wanted',plannedUse:'footsteps'});assert.deepEqual(ids(c),['original','use','docs']);
// credits and licence are "later" and never count
c=checklistFor({...base,licence:'CC-BY 3.0'});const cr=step(c,'credits');assert(cr&&cr.later&&/required/.test(cr.label));assert.equal(c.total,7,'later steps are not counted');
c=checklistFor({...base,licence:'Check on source page',credit:''});assert(step(c,'licence').later&&step(c,'credits').later);
assert(!ids(checklistFor(base)).includes('credits')&&!ids(checklistFor(base)).includes('licence'),'a known CC0 licence with a credit has no later steps');

// Ordering: ready first, then fewest steps left
const list=checklists([{...base,id:'a',name:'Blocked',files:[]},{...base,id:'b',name:'Ready'},{...base,id:'c',name:'Fbx',format:'fbx'},{id:'z',origin:'module',stage:'in-game',name:'Shipped'}]);
assert.deepEqual(list.map(x=>x.asset.id),['b','a','c'].sort((x,y)=>list.findIndex(l=>l.asset.id===x)-list.findIndex(l=>l.asset.id===y)));assert.equal(list[0].asset.id,'b');assert(!list.some(x=>x.asset.id==='z'),'shipped assets have no checklist');

// markShipped on fixtures: by file (the whole path or just the name), by an explicit shippedAs, and not for wanted rows with nothing to match
const rows=markShipped([{id:'m1',origin:'module',name:'Steel axe',source:'Steel_Axe by Quaternius.glb'},{id:'m2',origin:'module',name:'Hut',source:'polypizza/Hut.glb'},{id:'m3',origin:'module',name:'Flatbed',source:'Veichles/Logging Truck/flatbed.glb'},
 {id:'a',origin:'register',stage:'received',files:['Tools/Steel_Axe by Quaternius.glb']},{id:'b',origin:'register',stage:'received',files:[],shippedAs:'m2'},{id:'c',origin:'register',stage:'received',files:['Veichles/Logging Truck/flatbed.glb']},
 {id:'d',origin:'register',stage:'wanted',files:[]},{id:'e',origin:'register',stage:'received',files:['x/other.glb'],shippedAs:'gone'}]);
const sh=Object.fromEntries(rows.filter(r=>r.origin==='register').map(r=>[r.id,r.shippedAs||null]));
assert.deepEqual(sh,{a:'m1',b:'m2',c:'m3',d:null,e:null},'a name match, an explicit link and a full-path match; a link to nothing is dropped');

// The real register: every received and wanted asset has the facts it needs, and the numbers are consistent
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const r=await loadAssets(root),all=checklists(r.assets);
const outdated=r.assets.filter(a=>a.shippedAs);
assert.equal(all.length+outdated.length,r.assets.filter(a=>a.origin==='register').length,'every received and wanted asset has a checklist, except the outdated rows');
assert(!r.assets.some(a=>a.id==='tripo-sawmill'),'the outdated Tripo v1 sawmill is gone from the register');
for(const x of all){assert(x.total>=3&&x.done<=x.total,x.asset.id);if(x.asset.kind==='model')assert(x.asset.class,`${x.asset.id} has a class (it picks the budget)`)}
const fbx=all.filter(x=>x.steps.some(s=>s.id==='format'&&s.state==='todo'&&/FBX/.test(s.label))).map(x=>x.asset.id);
for(const id of ['jtoastie-pos-machine','quaternius-ultimate-crops','high-end-axe'])assert(fbx.includes(id),id+' needs an FBX conversion');
assert.equal(all.find(x=>x.asset.id==='safayan-jeep').steps.find(s=>s.id==='size').label,'Simplify from 8,022 to about 2,500 triangles','the Jeep needs simplifying to its own target');
assert.equal(step(checklistFor({...base,triangles:2000,targetTriangles:1000}),'size').state,'todo','an entry target beats the class budget');
assert(/131,000 to about 20,000/.test(all.find(x=>x.asset.id==='grab3d-man-base').steps.find(s=>s.id==='size').label),'the Grab3D man needs decimating');
// outdated rows: a register row whose file or `shippedAs` is already a shipped asset is listed for removal and gets no checklist
// (the nine found on 2026-11-10 were removed at the user's request; the rule stays, pinned by the markShipped fixtures above and the page check below)
assert.deepEqual(outdated.map(a=>a.id),[],'no register row describes something that already ships');
for(const id of ['quaternius-hut','polypizza-store','polypizza-wood-log','kenney-desk','quaternius-axe','creativetrio-axe','chainsaw01-sku0374','quaternius-gas-can','spawncamp-flatbed','tripo-sawmill'])assert(!r.assets.some(a=>a.id===id),id+' stays removed');
const html0=renderAssetsPage({groups:r.groups,summary:r.summary});
const stale={id:'old',origin:'register',stage:'received',kind:'model',name:'Old hut',pack:'P',files:[],shippedAs:'prop:hut',shippedName:'Hut'};
const staleHtml=renderAssetsPage({groups:[{pack:'P',items:[stale],stages:{received:1},triangles:0,info:[]}],summary:{total:1,fromModules:0,byStage:{received:1}}});
assert(staleHtml.includes('already ships as Hut')&&staleHtml.includes('already ships this as')&&staleHtml.includes('>outdated<'),'an outdated row is named on its card and in the attention list');
const ready=all.filter(x=>x.ready);
assert(ready.every(x=>x.asset.files.length>0),'ready means the original is on disk');
// the page shows it
const html=html0;
assert(html.includes('Import checklist ('+all.length+')'));assert(html.includes('class="steps"'));assert(/import \d+\/\d+/.test(html),'a card shows its import progress');
assert(!/<script/i.test(html));
console.log(`Checklist: ${all.length} received and wanted assets, ${ready.length} ready to import now (${ready.map(x=>x.asset.name).join(', ')||'none'}), ${all.filter(x=>x.blockers.some(b=>/not on this PC/.test(b))).length} waiting for an original that is not on this PC.`);
