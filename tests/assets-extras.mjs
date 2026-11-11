// Asset tracker extras (Mikkadr Hub P3c): readable names, the "new or changed" marker, and the heaviest-first view against the frame budget.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {nice,describeModules,trackChanges,isRecent,signature,heaviest,frameBudget,RECENT_DAYS,BUDGET,findUses,usesText} from '../hub/assets.js';
import {renderAssetsPage} from '../hub/assets-page.js';
import {catalogOf} from '../hub/assets-cli.mjs';
import {loadAssets} from '../hub/assets-load.mjs';

// Names
for(const [id,want] of [['house-a','House A'],['industrial-q','Industrial building Q'],['f-tv-cabinet','TV cabinet'],['f-tv','TV'],['suv','SUV'],['sports-car-2','Sports car 2'],['car-2','Car 2'],['prop.zone-sign-unload','Zone sign unload'],['prop.fuel-pump-diesel','Fuel pump (diesel)'],['offroad','Off-road pickup'],['container-a','Container A'],['tank-small','Tank small'],['f-bed-double','Bed double'],['coop','Chicken coop']])assert.equal(nice(id),want,id);
const d=describeModules({nature:{models:{'pine.1':{source:'Pine_1',height:9,canopyRadius:2,triangles:5},'broadleaf.2':{source:'x',height:8,canopyRadius:2,triangles:5}}}});
assert.deepEqual(d.map(x=>x.name),['Pine tree 1','Broadleaf tree 2']);

// Changes: the first run is a baseline and marks nothing; later runs mark what is new or different, for a week.
const A=[{id:'a',stage:'received',name:'A',hash:'h1',files:[],triangles:10},{id:'b',stage:'wanted',name:'B',files:[]}];
const day=86400000,t0=Date.UTC(2026,10,10);
const first=trackChanges({},A,t0);assert(first.baseline);assert.deepEqual(first.changed,[]);assert.equal(first.next.a.changedAt,null);assert(!isRecent(first.next.a,t0));
const same=trackChanges(first.next,A,t0+day);assert(!same.baseline);assert.deepEqual(same.changed,[]);assert.equal(same.next.a,first.next.a,'an untouched asset keeps its entry');
const A2=[{...A[0],hash:'h2'},{...A[1],stage:'received'},{id:'c',stage:'wanted',name:'C',files:[]}];
const later=trackChanges(same.next,A2,t0+2*day);assert.deepEqual(later.changed,['a','b','c']);assert.equal(later.next.a.kind,'changed');assert.equal(later.next.c.kind,'new');
assert(isRecent(later.next.a,t0+2*day+(RECENT_DAYS-1)*day),'still recent inside the window');assert(!isRecent(later.next.a,t0+2*day+(RECENT_DAYS+1)*day),'not recent after it');
assert.notEqual(signature(A[0]),signature({...A[0],triangles:11}),'triangles are part of the signature');assert.equal(isRecent(null),false);
const kept=trackChanges(later.next,A2,t0+3*day);assert.equal(kept.next.a.changedAt,later.next.a.changedAt,'the time of the change is kept, not reset');

// Heaviest and the budget
const M=[{id:'prop:a',name:'A',origin:'module',triangles:100,stage:'in-game',pack:'X'},{id:'prop:b',name:'B',origin:'module',triangles:300,stage:'in-game',pack:'X'},{id:'w',name:'W',origin:'register',triangles:900,stage:'wanted',pack:'X'},{id:'character:male',name:'Male',origin:'module',skinned:true,triangles:50000,stage:'in-game',pack:'Characters'},{id:'suv',name:'SUV',origin:'module',triangles:3000,stage:'in-game',pack:'Quaternius Cars'},{id:'forklift',name:'Forklift',origin:'module',triangles:14000,stage:'in-game',pack:'Vehicles'}];
assert.deepEqual(heaviest(M,3).map(a=>a.id),['character:male','forklift','suv'],'heaviest first, shipped only');
const fb=frameBudget(M);assert.equal(fb.characters.total,BUDGET.characters*50000);assert.equal(fb.cars.each,3000,'the forklift is not one of the ten cars');assert.equal(fb.cars.total,BUDGET.cars*3000);
assert.equal(frameBudget([]).characters.total,0);

// The page: chips on new or changed assets, a heaviest section, and nothing marked on a baseline
const groups=[{pack:'X',items:[{...M[0],kind:'model',files:[],notes:'',plannedUse:''},{...M[1],kind:'model',files:[]}],stages:{'in-game':2},triangles:400,info:[]}];
const summary={total:2,fromModules:2,byStage:{'in-game':2}};
const html=renderAssetsPage({groups,summary,changes:{'prop:a':{sig:'x',changedAt:t0,kind:'new'}},generatedAt:t0+day});
assert(html.includes('>New</span>'),'a new asset is marked');assert(html.includes('1 new or changed'),'the pack says how many');assert(!html.includes('>Changed</span>'));
assert(html.includes('Heaviest assets'));
const calm=renderAssetsPage({groups,summary,changes:first.next,generatedAt:t0+day});assert(!calm.includes('c-new">New')&&!calm.includes('new or changed'),'a baseline marks nothing');
assert(!/<script/i.test(html));

// Uses: only the named keys count, a place comes from the node's own position or its nearest named ancestor, and the text stays short.
const ids=new Set(['house-a','car','prop.box']);
const tree={yards:[{id:'depot',items:[{prop:'prop.box',x:1,z:1},{prop:'prop.box',x:2,z:2},{prop:'car',x:3,z:3}]}],landmarks:[{id:'lm1',prop:'house-a',x:5,z:5},{id:'lm2',prop:'house-a',x:150,z:5}],note:'car',kind:'house-a'};
const found=findUses(tree,{ids,keys:new Set(['prop']),placeOf:n=>typeof n.x==='number'?(n.x>100?'East':'West'):null,root:'map'});
assert.equal(found['prop.box'].total,2);assert.deepEqual(found['prop.box'].places,{West:2});assert.deepEqual(found['house-a'].places,{West:1,East:1});
assert.equal(found.car.total,1,'the word car under another key is not a use');assert(!('note' in found));
const noPos=findUses({yards:[{id:'depot',items:[{prop:'prop.box'}]}]},{ids,keys:new Set(['prop']),root:'map'});assert.deepEqual(noPos['prop.box'].places,{depot:1},'with no coordinates the place is the nearest id');
const bare=findUses({a:{prop:'car'}},{ids,keys:new Set(['prop']),root:'map'});assert.deepEqual(bare.car.places,{map:1},'with neither, the root label');
assert.equal(usesText(null),'');assert.equal(usesText({map:{total:0,places:{}},interiors:{total:0,places:{}},code:[]}),'');
assert.equal(usesText({map:{total:3,places:{West:2,East:1}},interiors:{total:0,places:{}},code:['a.js','b.js']}),'map 3 (West 2, East 1) · code: a.js, b.js');
assert(usesText({map:{total:9,places:{a:5,b:1,c:1,d:1,e:1}},code:[]}).includes('+1 more'),'long place lists are cut');

// The real data: names are readable, the budget has the characters (measured by the studio when pictures exist), and the catalog carries the marker
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const r=await loadAssets(root);
for(const a of r.assets.filter(a=>a.origin==='module'))assert(!/^[a-z]/.test(a.name)||/^(iPhone)/.test(a.name),`${a.id}: "${a.name}" starts with a capital`);
assert(!r.assets.some(a=>/\bsuv\b/.test(a.name)),'SUV is spelled as an acronym');
const cat=catalogOf(r.assets,'v1',{},{[r.assets[0].id]:{sig:'x',changedAt:Date.now(),kind:'new'}});
assert.equal(cat[0].changeKind,'new');assert.equal(cat[1].changedAt,null);
const byId=Object.fromEntries(r.assets.map(a=>[a.id,a]));
assert(byId['prop:house-a'].uses.map.total>=1&&/Cedar Heights/.test(usesText(byId['prop:house-a'].uses)),'house A stands in Cedar Heights');
assert(byId['prop:prop.pallet'].uses.map.places['Eastbank Works']>=10,'the pallets are in Eastbank Works');
assert(byId['prop:f-bed-double'].uses.interiors.total>=1,'the bed is in an interior layout');
assert(byId['prop:prop.pump-island'].uses.map.total===2,'two pump islands are placed in the map');
for(const id of ['prop:prop.fuel-pump','prop:prop.fuel-pump-diesel','prop:f-side-table'])assert.equal(usesText(byId[id].uses),'',id+' is used nowhere');
for(const id of ['character:male','pictures:vehicles','forklift'])assert(byId[id].uses.code.length>0,id+' is named by game code (modules by import)');
const unusedByUses=r.assets.filter(a=>a.origin==='module'&&!usesText(a.uses)).map(a=>a.id).sort();
assert.deepEqual(unusedByUses,r.assets.filter(a=>a.stage==='converted').map(a=>a.id).sort(),'an asset is "converted" exactly when it has no use anywhere');
const page=renderAssetsPage({groups:[{pack:'X',items:[byId['prop:house-a'],byId['prop:f-side-table']],stages:{'in-game':1,converted:1},triangles:0,info:[]}],summary:{total:2,fromModules:2,byStage:{'in-game':1,converted:1}}});
assert(page.includes('Used: map 1 (Cedar Heights 1)'),'a card says where the asset is used');assert(page.includes('Not used anywhere in the game'),'an unused asset says so');
const top=heaviest(r.assets,5);assert(top.length===5&&top.every((a,i)=>i===0||a.triangles<=top[i-1].triangles),'the heaviest list is sorted');
console.log(`Extras: names, change marker (${RECENT_DAYS} days, baseline first), heaviest-first and frame budget pinned; heaviest real asset ${top[0].name} (${top[0].triangles.toLocaleString('en-US')}).`);
