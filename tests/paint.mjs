import assert from 'node:assert/strict';
import {PAINT,coloursOf,defaultColour,colourOf,validColour,paintUniforms} from '../dist/paint.js';
import {CLASSES} from '../dist/vehicle.js';
import {MAP} from '../dist/map-definition.js';

// Paint colours (0.34): every drivable model has several, with unique ids, a swatch and a name; the first keeps the model's own paint; the shader numbers are in range.
assert.deepEqual(Object.keys(PAINT).sort(),Object.keys(CLASSES).sort(),'every vehicle class has a paint entry and the other way round');
for(const model of Object.keys(PAINT)){const list=coloursOf(model);assert(list.length>=5,model+' has several colours');assert.equal(new Set(list.map(c=>c.id)).size,list.length,'unique ids');
 for(const c of list){assert(/^#[0-9a-f]{6}$/.test(c.swatch)&&c.name,`${model}/${c.id} has a name and a swatch`);const u=paintUniforms(model,c.id);assert(u.sat>=0&&u.sat<=2&&u.val>0&&u.val<=2.5&&u.band>0&&u.band<.5&&u.src>0&&u.src<1,`${model}/${c.id} shader numbers`);assert(u.hue===-1||(u.hue>=0&&u.hue<1))}
 assert.equal(defaultColour(model),list[0].id);assert.equal(paintUniforms(model,list[0].id).hue,-1,'the first colour keeps the model hue');assert(validColour(model,list[1].id)&&!validColour(model,'pink')&&!validColour('tractor','red'));assert.equal(colourOf(model,'pink'),null)}
assert.equal(paintUniforms('worktruck','pink').hue,-1,'an unknown colour falls back to the first');
assert(MAP.vehicles.every(v=>PAINT[v.model]),'every dealership slot has paint');
console.log('Paint: '+Object.keys(PAINT).map(m=>`${m} ${coloursOf(m).length} colours`).join(', ')+', unique ids, valid shader numbers, the first colour is the model\'s own, unknown colours fall back.');