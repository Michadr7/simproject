// Downtown enterable rooms & services tests (stage 3).
import assert from 'node:assert/strict';
import {DOWNTOWN_PROPERTIES} from '../dist/downtown.js';
import {DOWNTOWN_SERVICES,DOWNTOWN_INTERIOR,isDowntownShop,downtownOpen} from '../dist/downtown-rooms.js';
import {itemById} from '../dist/items.js';

assert.equal(DOWNTOWN_PROPERTIES.length,9);
for(const p of DOWNTOWN_PROPERTIES){
 assert.equal(p.access,'public');
 assert.equal(isDowntownShop(p.id),true);
 const svc=DOWNTOWN_SERVICES[p.id];
 assert(svc&&svc.role&&svc.greeting&&svc.actions.length>0,'service defined for '+p.id);
 for(const a of svc.actions)if(a.item)assert(itemById(a.item),'valid item '+a.item);
 assert.equal(downtownOpen(p,{minutes:p.hours[0]}),true);
 assert.equal(downtownOpen(p,{minutes:p.hours[1]}),false);
}
assert.equal(DOWNTOWN_INTERIOR.origin.x,480);
console.log('PASS downtown-rooms: all 9 Ironwood buildings are public, enterable, and have valid services/hours');
