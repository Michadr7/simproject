// Pure unit tests for dist/recipes.js (notes/cooking-design.md section 4, L-PURE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 RECIPES,COOKING_INGREDIENTS,HOSPITALITY_BONUS_PER_2_LEVELS,HOSPITALITY_BONUS_CAP,
 recipeFor,canCook,consume,hospitalityBonus,scaledOutput
} from '../dist/recipes.js';

// 1. Table shape: 8 unique recipes, valid durations, ingredients, and positive outputs.
assert.equal(RECIPES.length,8,'8 home recipes');
assert.equal(new Set(RECIPES.map(r=>r.id)).size,8,'unique recipe ids');
for(const r of RECIPES){
 assert(r.cookSec>0&&r.burnSec>r.cookSec,`${r.id} burnSec > cookSec`);
 assert(r.gameMinutes>0&&r.xp>=4&&r.xp<=8,`${r.id} gameMinutes and xp`);
 assert(r.food>0||r.thirst>0||r.energy>0,`${r.id} restores at least one stat`);
 assert(r.ingredients.length>=1&&r.ingredients.every(i=>i.qty>=1),`${r.id} has ingredients`);
}
assert(COOKING_INGREDIENTS.includes('eggs')&&COOKING_INGREDIENTS.includes('flour-bag')&&COOKING_INGREDIENTS.includes('ground-coffee'));
assert.equal(recipeFor('pancakes').servings,2);
assert.equal(recipeFor('home-coffee').packItem,'coffee');
assert.equal(recipeFor('grilled-sandwich').packItem,'sandwich');
assert.equal(recipeFor('hearty-soup').packItem,'soup');
assert.equal(recipeFor('unknown'),null);
assert.equal(recipeFor(null),null);

// 2. canCook & consume: checks quantities across stacks, returns new inventory without mutating input.
{
 const inv={slots:[{id:'produce',quantity:1},{id:'bread-loaf',quantity:2},{id:'produce',quantity:1},{id:'apple',quantity:3}]};
 const snap=JSON.stringify(inv);
 assert.equal(canCook(inv,'hearty-soup'),true,'2 produce across 2 stacks + 1 bread-loaf');
 assert.equal(canCook(inv,'camp-skillet'),false,'missing meat-pack and eggs');
 assert.equal(canCook(inv,'unknown'),false);
 assert.equal(canCook(null,'fried-eggs'),false);

 const after=consume(inv,'hearty-soup');
 assert.equal(JSON.stringify(inv),snap,'input inventory is not mutated');
 assert.deepEqual(after.slots,[{id:'bread-loaf',quantity:1},{id:'apple',quantity:3}],'consumed produce stacks dropped, bread-loaf decremented, apple kept');
 assert.equal(consume(after,'hearty-soup'),null,'cannot consume when missing ingredients');

 // Array form also supported
 const arr=[{id:'eggs',quantity:1}];
 assert.equal(canCook(arr,'fried-eggs'),true);
 assert.deepEqual(consume(arr,'fried-eggs'),[]);
}

// 3. Hospitality bonus & quality-scaled output.
{
 assert.equal(HOSPITALITY_BONUS_PER_2_LEVELS,0.05);
 assert.equal(HOSPITALITY_BONUS_CAP,0.25);
 assert.equal(hospitalityBonus(1),0);
 assert.equal(hospitalityBonus(2),0.05);
 assert.equal(hospitalityBonus(4),0.10);
 assert.equal(hospitalityBonus(10),0.25);
 assert.equal(hospitalityBonus(20),0.25,'capped at +25%');

 const base=scaledOutput('camp-skillet',1.0,1);
 assert.deepEqual(base,{food:90,thirst:0,energy:35,xp:8});
 const high=scaledOutput('camp-skillet',1.3,10);
 assert.equal(high.food,Math.round(90*1.3*1.25));
 assert.equal(high.energy,Math.round(35*1.3*1.25));
 assert.equal(high.xp,8);
 const burnt=scaledOutput('fried-eggs',0.4,1);
 assert.equal(burnt.food,Math.round(35*0.4));
 assert.equal(burnt.xp,2);
 assert.equal(scaledOutput('nope',1,1),null);
}

// 4. Purity: no DOM, no clock, no random, no three.js.
{
 const src=fs.readFileSync(new URL('../dist/recipes.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'recipes.js must not use '+bad);
 assert(!/from '\.\/(game|driving|phone)/.test(src));
}

console.log('PASS Recipes: 8-recipe table, canCook/consume immutability & multi-stack deduction, hospitality + quality scaling, and purity.');
