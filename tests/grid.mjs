import assert from 'node:assert/strict';
import {worldLayout,FIELDS} from '../dist/world.js';
import {TREE_HITS,CHOP_RANGE,SAPLING_AFTER,MATURE_AFTER,MAX_LOGS,LOG_LIFETIME,defaultPlot,normalizePlots,plotAt,setPlot,chopTree,felledTrees,normalizeLogs,nextLogIdFor,collectLog,expireLogs,treeStage,felledStages,regrowTrees} from '../dist/grid.js';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {addItem,countItem,inventoryCapacity,equipTool} from '../dist/inventory.js';
import {xpForNext} from '../dist/skills.js';
import {GameState,initializeState,getPlot,setPlot as setStatePlot} from '../dist/state.js';

const pine=worldLayout().cuttable[0],near={x:pine.x-1.2,z:pine.z},farmKey=`${FIELDS[0].x0},${FIELDS[0].z0}`;
const withAxe=(p=freshProgress(),equipped=true)=>{let s=addItem(p,'axe').state;return equipped?equipTool(s,'axe').state:s};
const levelXp=n=>{let xp=0;for(let l=1;l<n;l++)xp+=xpForNext(l);return xp};
// ── Defaults and sparse storage ────────────────────────────────────────────────
assert.deepEqual(defaultPlot(pine.key),{type:'forest',tree:'pine',hits:0});assert.deepEqual(defaultPlot(farmKey),{type:'farm',crop:null,tilled:false});assert.equal(defaultPlot('0,0'),null);
const fresh=freshProgress();assert.deepEqual([fresh.plots,fresh.logs,fresh.equipped,fresh.nextLogId,fresh.skills],[{},[],null,1,{lumberjack:{xp:0}}]);
let p=setPlot(fresh,farmKey,{type:'farm',crop:'wheat',tilled:true});assert.deepEqual(p.plots,{[farmKey]:{type:'farm',crop:'wheat',tilled:true}});
p=setPlot(p,farmKey,{type:'farm',crop:null,tilled:false});assert.deepEqual(p.plots,{});assert.deepEqual(setPlot(fresh,'0,0',{type:'farm'}).plots,{});
// ── Validation ────────────────────────────────────────────────────────────────
const empty=(()=>{for(let ix=60;ix<160;ix++)for(let iz=-50;iz<50;iz++){const k=ix+','+iz;if(defaultPlot(k)?.tree===null)return k}})(),second=worldLayout().cuttable[1].key;
assert.deepEqual(normalizePlots({
 [pine.key]:{type:'forest',tree:'pine',hits:2},[farmKey]:{type:'farm',crop:'Wheat!!',tilled:'yes'},'0,0':{type:'farm',tilled:true},[empty]:{type:'forest',tree:null},'bad key':{},'-99,-10':null,
 [second]:{type:'forest',tree:'pine',hits:99},[worldLayout().cuttable[2].key]:{type:'forest',tree:null,felledAt:1200.7},[worldLayout().cuttable[3].key]:{type:'forest',tree:null,felledAt:-4}
}),{[pine.key]:{type:'forest',tree:'pine',hits:2},[second]:{type:'forest',tree:'pine',hits:2},[worldLayout().cuttable[2].key]:{type:'forest',tree:null,hits:0,felledAt:1200},[worldLayout().cuttable[3].key]:{type:'forest',tree:null,hits:0,felledAt:null}});
assert.deepEqual(normalizePlots('nope'),{});
// ── Chopping: owned, equipped, in range ──────────────────────────────────────────
assert.match(chopTree(fresh,pine.key,near).error,/need an axe/);
assert.match(chopTree(withAxe(fresh,false),pine.key,near).error,/Equip your axe/);
let s=withAxe();
assert.match(chopTree(s,pine.key,{x:pine.x+5,z:pine.z}).error,/closer/);assert.match(chopTree(s,'0,0',near).error,/no tree/);
// Level 1: three hits, 2 XP each, then 12 XP and 2 logs along the way the trunk falls.
const hit1=chopTree(s,pine.key,near);assert.deepEqual([hit1.hits,hit1.need,hit1.felled,hit1.message],[1,TREE_HITS,false,'Chop 1 / 3']);s=hit1.state;assert.equal(s.skills.lumberjack.xp,2);
const hit2=chopTree(s,pine.key,near);s=hit2.state;assert.equal(plotAt(s,pine.key).hits,2);
// Hits survive a save and load.
let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};saveProgress(storage,s);s=loadProgress(storage);assert.equal(plotAt(s,pine.key).hits,2);assert.equal(s.equipped,'axe');assert.equal(s.skills.lumberjack.xp,4);
const fell=chopTree(s,pine.key,near);assert(fell.felled);assert.match(fell.message,/2 logs/);
assert.deepEqual(plotAt(fell.state,pine.key),{type:'forest',tree:null,hits:0,felledAt:540});
assert.equal(fell.state.skills.lumberjack.xp,16);assert.deepEqual(fell.state.stats,{treesFelled:1,logsCollected:0});assert.equal(countItem(fell.state,'wood-log'),0,'logs lie on the ground, not in the bag');
assert.equal(fell.logs.length,2);assert.deepEqual(fell.state.logs,fell.logs);assert.deepEqual(fell.logs.map(l=>l.id),[1,2]);assert.equal(fell.state.nextLogId,3);
for(const log of fell.logs){assert(Math.hypot(log.x-pine.x,log.z-pine.z)<2.5,'near the stump');assert(log.x>pine.x,'fell away from the player (who stood to the west)')}
assert.match(chopTree(fell.state,pine.key,near).error,/no tree/,'cannot chop a stump');assert.deepEqual(felledTrees(fell.state),[pine.key]);
// Level-ups and perks: level 6 fells in two hits, level 3+ drops a third log.
const swift={...withAxe(),skills:{lumberjack:{xp:levelXp(6)}}};const q1=chopTree(swift,pine.key,near);assert.equal(q1.need,2);const q2=chopTree(q1.state,pine.key,near);assert(q2.felled&&q2.logs.length===3);
const upLevel=chopTree({...withAxe(),skills:{lumberjack:{xp:levelXp(2)-2}}},pine.key,near);assert(upLevel.leveledUp&&upLevel.level===2);
assert.equal(chopTree({...withAxe(),skills:{lumberjack:{xp:levelXp(6)}}},second,{x:0,z:0}).error,'Move closer to the tree.');
// A tree left at 2 hits from before the perk needs only one more swing at level 6.
assert(chopTree({...swift,plots:{[pine.key]:{type:'forest',tree:'pine',hits:2}}},pine.key,near).felled);
// ── Logs ──────────────────────────────────────────────────────────────────────
let c=collectLog(fell.state,1);assert.equal(countItem(c.state,'wood-log'),1);assert.deepEqual(c.state.stats,{treesFelled:1,logsCollected:1});assert.deepEqual(c.state.logs.map(l=>l.id),[2]);assert.match(c.message,/log/);
assert.match(collectLog(c.state,1).error,/gone/);
let full=fell.state;while(full.inventory.slots.length<inventoryCapacity(full.inventory))full=addItem(full,'axe').state;
const refused=collectLog(full,1);assert.match(refused.error,/bag is full/);assert.equal(refused.state,undefined);
let logs=fresh;for(let i=0;i<12;i++)logs=addItem(logs,'wood-log').state;assert.deepEqual(logs.inventory.slots.map(x=>x.quantity),[10,2]);
assert.deepEqual(normalizeLogs([{id:1,x:100,z:-250,rot:1,t:30},{id:1,x:101,z:-250},{id:2,x:900,z:0},{id:3,x:NaN,z:0},{id:0,x:100,z:-250},{id:4,x:101,z:-249,rot:'x',t:-1},null,'x']),[{id:1,x:100,z:-250,rot:1,t:30},{id:4,x:101,z:-249,rot:0,t:0}]);
assert.equal(normalizeLogs(Array.from({length:200},(_,i)=>({id:i+1,x:100,z:-250}))).length,MAX_LOGS);assert.deepEqual(normalizeLogs('nope'),[]);
assert.equal(nextLogIdFor(undefined,[]),1);assert.equal(nextLogIdFor(2,[{id:9}]),10);assert.equal(nextLogIdFor(50,[{id:9}]),50);
const aged={...fell.state,logs:[{id:1,x:100,z:-250,rot:0,t:0},{id:2,x:100,z:-250,rot:0,t:LOG_LIFETIME}]};assert.deepEqual(expireLogs(aged,LOG_LIFETIME+10).logs.map(l=>l.id),[2]);assert.equal(expireLogs(aged,10),aged);
// ── Regrowth: stump, then sapling, then a pine again ──────────────────────────────
const felledAt=1000,stump={type:'forest',tree:null,hits:0,felledAt};
assert.deepEqual([felledAt,felledAt+SAPLING_AFTER-1,felledAt+SAPLING_AFTER,felledAt+MATURE_AFTER-1,felledAt+MATURE_AFTER].map(t=>treeStage(stump,t)),['stump','stump','sapling','sapling','mature']);
assert.equal(treeStage({type:'forest',tree:'pine',hits:0},0),'mature');assert.equal(treeStage({...stump,felledAt:null},1e6),'stump');
const grown={...fresh,plots:{[pine.key]:stump,[second]:{...stump,felledAt:null}}};
assert.deepEqual(felledStages(grown,felledAt+SAPLING_AFTER),[[pine.key,'sapling'],[second,'stump']]);
let r=regrowTrees(grown,felledAt+10);assert.equal(plotAt(r.state,second).felledAt,felledAt+10,'trees felled before regrowth existed start their clock');assert.deepEqual(r.restored,[]);
r=regrowTrees(grown,felledAt+MATURE_AFTER-1);assert.deepEqual(r.restored,[]);
const blocked=regrowTrees(grown,felledAt+MATURE_AFTER,key=>key===pine.key);assert.deepEqual(blocked.restored,[],'not while the player stands there');assert.equal(blocked.state.plots[pine.key].tree,null);
r=regrowTrees(grown,felledAt+MATURE_AFTER);assert.deepEqual(r.restored,[pine.key]);assert.equal(r.state.plots[pine.key],undefined,'back to the default pine');assert.deepEqual(plotAt(r.state,pine.key),{type:'forest',tree:'pine',hits:0});
assert.equal(regrowTrees(fresh,5).state,fresh,'nothing to do leaves the state alone');
// ── Saves ─────────────────────────────────────────────────────────────────────
saveProgress(storage,fell.state);const back=loadProgress(storage);assert.deepEqual(back.logs,fell.state.logs);assert.equal(back.nextLogId,3);assert.equal(back.skills.lumberjack.xp,16);assert.deepEqual(back.stats,{treesFelled:1,logsCollected:0});assert.equal(back.equipped,'axe');assert.deepEqual(felledTrees(back),[pine.key]);
assert.equal(normalizeProgress({equipped:'axe'}).equipped,null,'cannot equip a tool you do not own');assert.equal(normalizeProgress({equipped:'apple',inventory:withAxe().inventory}).equipped,null);
assert.deepEqual(normalizeProgress({position:{x:120,z:-250}}).position,{x:120,z:-250});assert.deepEqual(normalizeProgress({position:{x:-150,z:-230}}).position,{x:-150,z:-230});assert.equal(normalizeProgress({position:{x:500,z:0}}).position,null);
initializeState({progress:freshProgress()});assert.deepEqual(getPlot(pine.key),{type:'forest',tree:'pine',hits:0});setStatePlot(farmKey,{type:'farm',crop:null,tilled:true});assert.equal(GameState.progress.plots[farmKey].tilled,true);
console.log('Plot defaults and validation, equipped-axe chopping, XP and level perks, logs on the ground (fall direction, pickup, full bag, expiry), stump-sapling-pine regrowth, and saves passed.');
