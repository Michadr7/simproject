import assert from 'node:assert/strict';
import {CATEGORIES,categoryById,categoryOf} from '../dist/store-categories.js';
import {ITEMS,itemById,isBuyable} from '../dist/items.js';
import {PICTURES} from '../dist/vehicle-pictures.js';
import {PAINT,coloursOf} from '../dist/paint.js';

// The Store's categories and the vehicle pictures (0.34).
assert.deepEqual(CATEGORIES.map(c=>c.id),['vehicles','clothing','food','drink','tools','furniture','electronics']);assert(CATEGORIES.filter(c=>c.soon).map(c=>c.id).join()==='furniture,electronics','two placeholders');
assert.equal(categoryOf(itemById('axe')),'tools');assert.equal(categoryOf(itemById('gas-can')),'tools');assert.equal(itemById('gas-can').name,'Gas Can','a capital C');
assert.equal(categoryOf(itemById('small-backpack')),'tools');assert.equal(categoryOf(itemById('large-backpack')),'tools');assert.equal(categoryOf(itemById('basic-jacket')),'clothing');
assert.equal(categoryOf(itemById('apple')),'food');assert.equal(categoryOf(itemById('water')),'drink');assert.equal(categoryOf(itemById('wood-log')),null,'materials are not sold');
for(const item of ITEMS.filter(isBuyable)){const c=categoryOf(item);assert(c&&categoryById(c)&&!categoryById(c).soon,`${item.id} is on a real shelf`)}
// a picture for every model in every colour (run `npm run pictures` after adding a vehicle or a colour)
for(const model of Object.keys(PAINT))for(const c of coloursOf(model)){const src=PICTURES[`${model}-${c.id}`];assert(/^data:image\/png;base64,/.test(src||''),`a picture for ${model} in ${c.id}: run npm run pictures`)}
assert.equal(Object.keys(PICTURES).length,Object.keys(PAINT).reduce((n,m)=>n+coloursOf(m).length,0),'no stale pictures');
console.log(`Store: ${CATEGORIES.length} categories (${CATEGORIES.filter(c=>c.soon).length} placeholders), every item on a shelf (tools hold the axe, the Gas Can and backpacks), ${Object.keys(PICTURES).length} vehicle pictures.`);