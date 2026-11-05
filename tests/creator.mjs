// Character creator rules (appearance.js): every offered part has its own name, names are not repeated within a row,
// quick outfits touch only the clothes, switching body keeps shared parts, random looks are valid.
import assert from 'node:assert/strict';
import {OUTFITS,PART_KEYS,PART_NAMES,CLOTHES_KEYS,partChoices,quickOutfits,switchBody,randomLook,outfit,normalizeAppearance,palettes} from '../dist/appearance.js';

for(const body of ['male','female']){
 const ids=OUTFITS[body].map(([id])=>id);
 for(const key of PART_KEYS){
  const choices=partChoices(body,key);
  assert(choices.length>=4,`${body} ${key}: at least four choices`);
  const labels=choices.map(([label])=>label);
  assert.equal(new Set(labels).size,labels.length,`${body} ${key}: no label repeated (${labels})`);
  for(const [,id] of choices)assert(ids.includes(id),`${body} ${key}: ${id} is a real outfit`);
  for(const id of Object.keys(PART_NAMES[body][key]))assert(ids.includes(id),`${body} ${key}: PART_NAMES names a real outfit (${id})`);
  // the old problem: a part row listed outfit names, so Top read 'Hoodie, Casual, Suit...' like the Outfit row
  const outfitLabels=new Set(OUTFITS[body].map(([,label])=>label));
  assert(labels.some(label=>!outfitLabels.has(label)),`${body} ${key}: names the part, not the outfit`);
 }
 // every head is on offer (hairstyles are never duplicates)
 assert.equal(partChoices(body,'head').length,ids.length,`${body}: every hairstyle offered`);
 // a hidden duplicate still shows when it is the one being worn, so an old save is never blank
 for(const key of CLOTHES_KEYS)for(const id of ids)if(!PART_NAMES[body][key][id])assert(partChoices(body,key,id).some(([,v])=>v===id),`${body} ${key}: worn ${id} is listed`);
 // quick outfits only list outfits whose clothes are all named
 for(const [id] of quickOutfits(body))for(const key of CLOTHES_KEYS)assert(PART_NAMES[body][key][id],`${body} quick outfit ${id} has a named ${key}`);
}
// the men's Explorer clothes are the Suit's: not offered as a quick outfit, its hairstyle is
assert(!quickOutfits('male').some(([id])=>id==='Adventurer'),'male Explorer is not a quick outfit');
assert(partChoices('male','head').some(([,id])=>id==='Adventurer'),'male Explorer hairstyle is offered');

// switching body keeps the parts the other body also has, and the colours and name
const a=normalizeAppearance({name:'Sam',body:'female',head:'Punk',top:'Suit',legs:'Worker',feet:'Formal',skin:palettes.skin[4][1],hair:palettes.hair[2][1]});
const m=switchBody(a,'male');
assert.equal(m.body,'male');assert.equal(m.name,'Sam');assert.equal(m.skin,a.skin);assert.equal(m.hair,a.hair);
assert.equal(m.head,'Punk');assert.equal(m.top,'Suit');assert.equal(m.legs,'Worker');
assert.equal(m.feet,OUTFITS.male[0][0],'a part the male body lacks falls back to the first');
assert.deepEqual(switchBody(m,'female').head,'Punk');

// random looks: valid, same body and name, clothes from one quick outfit
let seed=7;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
for(const body of ['male','female'])for(let i=0;i<40;i++){
 const r=randomLook(outfit(body,OUTFITS[body][0][0],{name:'Ana'}),rand);
 assert.deepEqual(r,normalizeAppearance(r),'random look is already normal');
 assert.equal(r.body,body);assert.equal(r.name,'Ana');
 assert(r.top===r.legs&&r.legs===r.feet&&quickOutfits(body).some(([id])=>id===r.top),'clothes from one quick outfit');
}
console.log('PASS creator.mjs: every part row names the part, no repeated labels, quick outfits set clothes only (male Explorer left out as a Suit duplicate), body switch keeps shared parts, random looks are valid.');
