import assert from 'node:assert/strict';
import {useCooler,coolerWait,normalizeCoolers,COOLER_THIRST} from '../dist/water-cooler.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {OFFICE_COOLER} from '../dist/office.js';
import {WAREHOUSE_COOLER} from '../dist/warehouse-layout.js';

// Free water at work (DESIGN 4.18): +30 thirst, once per game hour at each cooler, saved, never over 100, refused when not thirsty.
const base=freshProgress(),p={...base,life:{...base.life,thirst:40},housing:{...base.housing,day:2},routine:{...base.routine,minutes:600}};
const a=useCooler(p,'office');assert.equal(a.state.life.thirst,40+COOLER_THIRST);assert.equal(a.state.coolers.office,1440+600);assert.match(a.message,/\+30/);
assert.match(useCooler(a.state,'office').error,/60 min/,'the same cooler needs an hour');assert.equal(coolerWait(a.state,'office'),60);
const b=useCooler(a.state,'warehouse');assert.equal(b.state.life.thirst,100,'the other cooler is separate, and thirst stops at 100');assert.match(b.message,/\+30/);
const later={...a.state,routine:{...a.state.routine,minutes:661}};assert.equal(coolerWait(later,'office'),0);assert(!useCooler(later,'office').error,'ready after an hour');
assert.match(useCooler({...p,life:{...p.life,thirst:100}},'office').error,/not thirsty/);assert(useCooler(p,'attic').error);
assert.equal(useCooler({...p,life:{...p.life,thirst:90}},'office').state.life.thirst,100);assert.match(useCooler({...p,life:{...p.life,thirst:90}},'office').message,/\+10/);
assert.deepEqual(normalizeCoolers({office:5.7,warehouse:-1,x:3}),{office:5});assert.deepEqual(normalizeProgress({coolers:{office:50}}).coolers,{office:50});assert.deepEqual(normalizeProgress(null).coolers,{});
assert(OFFICE_COOLER.x<6&&Math.abs(OFFICE_COOLER.z)<5&&WAREHOUSE_COOLER.z<12&&Math.abs(WAREHOUSE_COOLER.x)<18,'both coolers stand inside their rooms');
console.log('Water cooler: +30 thirst, once per game hour at each cooler, separate coolers, capped at 100, refused when not thirsty, and saved.');