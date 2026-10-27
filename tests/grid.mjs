import assert from 'node:assert/strict';
import {worldLayout,FIELDS} from '../dist/world.js';
import {TREE_HITS,defaultPlot,normalizePlots,plotAt,setPlot,chopTree,felledTrees} from '../dist/grid.js';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {addItem,countItem,inventoryCapacity} from '../dist/inventory.js';
import {GameState,initializeState,getPlot,setPlot as setStatePlot} from '../dist/state.js';

const pine=worldLayout().cuttable[0],near={x:pine.x-1.2,z:pine.z},farmKey=`${FIELDS[0].x0},${FIELDS[0].z0}`;
// Defaults: no entry means the generated state.
assert.deepEqual(defaultPlot(pine.key),{type:'forest',tree:'pine',hits:0});
assert.deepEqual(defaultPlot(farmKey),{type:'farm',crop:null,tilled:false});
assert.equal(defaultPlot('0,0'),null,'city cells are not plots');
assert.deepEqual(freshProgress().plots,{});
// Sparse storage: setting a plot back to its default removes it.
let p=setPlot(freshProgress(),farmKey,{type:'farm',crop:'wheat',tilled:true});assert.deepEqual(p.plots,{[farmKey]:{type:'farm',crop:'wheat',tilled:true}});
p=setPlot(p,farmKey,{type:'farm',crop:null,tilled:false});assert.deepEqual(p.plots,{});
assert.deepEqual(setPlot(freshProgress(),'0,0',{type:'farm'}).plots,{},'off-grid writes ignored');
// Validation drops anything malformed or impossible.
const empty=(()=>{for(let ix=60;ix<160;ix++)for(let iz=-50;iz<50;iz++){const k=ix+','+iz;if(defaultPlot(k)?.tree===null)return k}})();
assert.deepEqual(normalizePlots({
 [pine.key]:{type:'forest',tree:'pine',hits:2},[farmKey]:{type:'farm',crop:'Wheat!!',tilled:'yes'},
 '0,0':{type:'farm',tilled:true},[empty]:{type:'forest',tree:null},'bad key':{},'-100,-10':{type:'forest',tree:null},'-99,-10':null,
 [worldLayout().cuttable[1].key]:{type:'forest',tree:'pine',hits:99}
}),{[pine.key]:{type:'forest',tree:'pine',hits:2},[worldLayout().cuttable[1].key]:{type:'forest',tree:'pine',hits:2}});
assert.deepEqual(normalizePlots('nope'),{});assert.deepEqual(normalizePlots(null),{});

// Chopping: needs an axe, range, three hits, room for the log.
let s=freshProgress();
assert.match(chopTree(s,pine.key,near).error,/axe/);
s=addItem(s,'axe').state;
assert.match(chopTree(s,pine.key,{x:pine.x+5,z:pine.z}).error,/closer/);
assert.match(chopTree(s,'0,0',near).error,/no tree/);
for(let hit=1;hit<TREE_HITS;hit++){const r=chopTree(s,pine.key,near);assert.equal(r.felled,false);assert.equal(r.hits,hit);s=r.state;assert.equal(plotAt(s,pine.key).hits,hit)}
// Hits survive a save/load.
let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};saveProgress(storage,s);s=loadProgress(storage);assert.equal(plotAt(s,pine.key).hits,TREE_HITS-1);
// Full bag: the last hit is refused and nothing changes.
let full=s;while(full.inventory.slots.length<inventoryCapacity(full.inventory))full=addItem(full,'axe').state;
const refused=chopTree(full,pine.key,near);assert.match(refused.error,/bag is full/);
const fell=chopTree(s,pine.key,near);assert.equal(fell.felled,true);assert.match(fell.message,/Wood log/);
s=fell.state;assert.deepEqual(plotAt(s,pine.key),{type:'forest',tree:null,hits:0});assert.equal(countItem(s,'wood-log'),1);
assert.match(chopTree(s,pine.key,near).error,/no tree/,'cannot chop a stump');
assert.deepEqual(felledTrees(s),[pine.key]);
saveProgress(storage,s);assert.deepEqual(felledTrees(loadProgress(storage)),[pine.key],'felled trees persist');
// Logs stack to 10 per slot.
let logs=freshProgress();for(let i=0;i<12;i++)logs=addItem(logs,'wood-log').state;assert.deepEqual(logs.inventory.slots.map(x=>x.quantity),[10,2]);
// Saved positions in the new zones are kept; positions off the world are dropped.
assert.deepEqual(normalizeProgress({position:{x:120,z:-30}}).position,{x:120,z:-30});
assert.deepEqual(normalizeProgress({position:{x:-150,z:40}}).position,{x:-150,z:40});
assert.equal(normalizeProgress({position:{x:500,z:0}}).position,null);assert.equal(normalizeProgress({position:{x:0,z:55}}).position,null);
// state.js helpers.
initializeState({progress:freshProgress()});
assert.deepEqual(getPlot(pine.key),{type:'forest',tree:'pine',hits:0});
setStatePlot(farmKey,{type:'farm',crop:null,tilled:true});assert.equal(GameState.progress.plots[farmKey].tilled,true);
console.log('Plot defaults, sparse storage, validation, axe/range/three-hit chopping, full-bag refusal, wood logs, persistence, zone positions and state helpers passed.');
