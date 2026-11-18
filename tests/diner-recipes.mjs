// Diner D-A tests: recipes, rank unlocks, and order tip/quality scoring.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 CATEGORIES,STATIONS,MIN_TIP_CENTS,MAX_TIP_CENTS,PASS_QUALITY,RECIPES,RANK_UNLOCKS,
 recipeById,recipesForRank,menuForRank,isUnlocked,tipFor,scoreOrder
} from '../dist/diner-recipes.js';

// 1. Recipe schema and catalog completeness.
assert(RECIPES.length===18,'18 total recipes across drinks, burgers, sandwiches, pizza');
const ids=new Set();
for(const r of RECIPES){
 assert(!ids.has(r.id),`unique id ${r.id}`);ids.add(r.id);
 assert(CATEGORIES.includes(r.category),`${r.id} category`);
 assert(STATIONS.includes(r.station),`${r.id} station`);
 assert(Number.isSafeInteger(r.priceCents)&&r.priceCents>0,`${r.id} price`);
 assert(r.cookSec>0&&r.burnSec>r.cookSec,`${r.id} cook/burn timings`);
 assert(Array.isArray(r.parts)&&r.parts.length>=3,`${r.id} parts`);
 for(const p of r.parts){assert(p.id&&p.slot&&typeof p.required==='boolean',`${r.id} part shape`)}
}

// 2. Rank unlock table: tight starter menu (10) at Rank 2, rest (8) at Rank 3.
const STARTER=['espresso','americano','latte','iced_latte','classic_burger','cheeseburger','grilled_cheese','egg_melt','margherita','pepperoni'];
const RANK3=['cappuccino','hot_chocolate','tea','iced_tea','bacon_burger','blt','club','veggie'];
assert.deepEqual(RANK_UNLOCKS[1],[],'Rank 1 Waiter unlocks 0 crafting recipes');
assert.deepEqual([...RANK_UNLOCKS[2]].sort(),[...STARTER].sort(),'Rank 2 unlocks exact 10 starter recipes');
assert.deepEqual([...RANK_UNLOCKS[3]].sort(),[...STARTER,...RANK3].sort(),'Rank 3 unlocks all 18 recipes');
assert.equal(recipesForRank(1).length,0);
assert.equal(recipesForRank(2).length,10);
assert.equal(recipesForRank(3).length,18);
assert.equal(menuForRank(1).length,10,'customers at Rank 1 still order from starter menu');
assert.equal(menuForRank(3).length,18);
for(const id of STARTER){assert.equal(isUnlocked(id,1),false);assert.equal(isUnlocked(id,2),true)}
for(const id of RANK3){assert.equal(isUnlocked(id,2),false);assert.equal(isUnlocked(id,3),true)}

// 3. Scoring: perfect, missing/optional parts, order, burnt, raw, speed & tip bounds.
for(const r of RECIPES){
 const allParts=r.parts.map(p=>p.id);
 const perf=scoreOrder(r,allParts,r.cookSec,0);
 assert.deepEqual(perf,{ok:true,quality:1,missing:[],burnt:false,tipCents:MAX_TIP_CENTS},`perfect ${r.id}`);
 const burnt=scoreOrder(r.id,allParts,r.burnSec,0);
 assert.equal(burnt.ok,false);assert.equal(burnt.burnt,true);assert.equal(burnt.tipCents,0,`burnt ${r.id} gets no tip`);
 const raw=scoreOrder(r.id,allParts,0,0);
 assert.equal(raw.ok,false);assert.equal(raw.tipCents,0,`raw ${r.id} gets no tip`);
 const empty=scoreOrder(r.id,[],r.cookSec,0);
 assert.equal(empty.ok,false);assert.equal(empty.tipCents,0,`empty ${r.id} gets no tip`);
}
// Optional part omitted keeps quality 1; 1 required missing stays ok with reduced tip; 2 missing fails.
{const burger=recipeById('classic_burger'),noOnion=burger.parts.filter(p=>p.id!=='onion').map(p=>p.id);
 assert.deepEqual(scoreOrder(burger,noOnion,burger.cookSec),{ok:true,quality:1,missing:[],burnt:false,tipCents:MAX_TIP_CENTS});
 const noSauce=noOnion.filter(id=>id!=='sauce'),res1=scoreOrder(burger,noSauce,burger.cookSec,10);
 assert.equal(res1.ok,true);assert.equal(res1.quality,0.7);assert.deepEqual(res1.missing,['sauce']);
 assert(res1.tipCents>=MIN_TIP_CENTS&&res1.tipCents<MAX_TIP_CENTS,'reduced tip within bounds');
 const res2=scoreOrder(burger,noSauce.filter(id=>id!=='tomato'),burger.cookSec);
 assert.equal(res2.ok,false);assert.equal(res2.tipCents,0,'2 missing parts ruins order');
 // Wrong stack order + extra wrong ingredient reduces quality.
 const swapped=[...noOnion];[swapped[0],swapped[1]]=[swapped[1],swapped[0]];
 const badOrder=scoreOrder(burger,swapped,burger.cookSec);
 assert.equal(badOrder.quality,0.9);assert(badOrder.tipCents<MAX_TIP_CENTS);
 const withExtra=scoreOrder(burger,[...noOnion,'pepperoni'],burger.cookSec);
 assert.equal(withExtra.quality,0.75);
}
// Tip bounds: across quality >= 0.5 and wait times 0..100, passing tip is always in [50, 300] and monotonic.
{const latte=recipeById('latte'),parts=latte.parts.map(p=>p.id);
 const fast=scoreOrder(latte,parts,latte.cookSec,5),med=scoreOrder(latte,parts,latte.cookSec,55),slow=scoreOrder(latte,parts,latte.cookSec,100);
 assert(fast.tipCents>med.tipCents&&med.tipCents>slow.tipCents,'slower service yields smaller tip');
 for(const w of [0,15,50,100,150]){const s=scoreOrder(latte,parts,latte.cookSec,w);assert(s.tipCents>=MIN_TIP_CENTS&&s.tipCents<=MAX_TIP_CENTS)}
 assert.equal(tipFor(PASS_QUALITY,100,0),MIN_TIP_CENTS,'minimum passing quality + slowest service hits $0.50 floor');
 assert.equal(tipFor(1,0,1),MAX_TIP_CENTS,'perfect quality + fastest service hits $3.00 ceiling');
 assert.equal(tipFor(0.49,0,1),0,'below pass quality gets 0 tip');
 assert.equal(scoreOrder(null,[],0).ok,false);assert.equal(scoreOrder('nope',['x'],5).tipCents,0);
}

// 4. Purity & no BOM.
{const raw=fs.readFileSync(new URL('../dist/diner-recipes.js',import.meta.url),'utf8');
 assert(!raw.startsWith('\uFEFF'),'no UTF-8 BOM');
 const src=raw.replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'must not use '+bad);
}
console.log('diner-recipes: PASS (18 recipes, Rank 2/3 unlocks, quality/burn scoring, $0.50-$3.00 tips, purity)');
