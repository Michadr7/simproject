// Unit tests for dist/apartment-visits.js (Oak Street elevator directory, floor layout & schedule-aware visiting).
import assert from 'node:assert/strict';
import {OAK_UNITS,OAK_FLOORS,unitsOnFloor,floorLabel,oakElevatorUnits,hallwayKnockOutcome,knockMessage} from '../dist/apartment-visits.js';
import {normalizeProgress} from '../dist/jobs.js';

assert.equal(OAK_UNITS.length,6);
assert.deepEqual(OAK_FLOORS,[2,3,4]);
assert.deepEqual(unitsOnFloor(2).map(u=>u.id),['sophie']);
assert.deepEqual(unitsOnFloor(3).map(u=>u.id),['elena','noah','oscar']);
assert.deepEqual(unitsOnFloor(4).map(u=>u.id),['lincoln','brentster']);
assert(floorLabel(3).includes('Elena, Noah, Oscar'));
assert(OAK_UNITS.every(u=>typeof u.personId==='string'&&u.personId.startsWith('oak-apartments/')));

let p=normalizeProgress({housing:{rented:true,day:1},routine:{minutes:720}});
const homePlan=[{from:0,to:420,act:'sleep',place:'dwelling:oak-apartments'},{from:420,to:1320,act:'home',place:'dwelling:oak-apartments'},{from:1320,to:1440,act:'sleep',place:'dwelling:oak-apartments'}];
const awayPlan=[{from:0,to:420,act:'sleep',place:'dwelling:oak-apartments'},{from:420,to:1080,act:'work',place:'shop:market'},{from:1080,to:1320,act:'home',place:'dwelling:oak-apartments'},{from:1320,to:1440,act:'sleep',place:'dwelling:oak-apartments'}];
const byPersonId={
 'oak-apartments/2#1':homePlan,
 'oak-apartments/7#1':awayPlan,
 'oak-apartments/8#1':awayPlan,
 'oak-apartments/9#1':homePlan,
 'oak-apartments/10#1':homePlan,
 'oak-apartments/11#1':awayPlan
};
const units=oakElevatorUnits({progress:p,planOf:id=>byPersonId[id]||null,otherPlayers:[{id:'p2',name:'Maya'}]});
assert.equal(units[0].kind,'studio');
assert.equal(units[0].locked,false);
const sophie=units.find(u=>u.id==='sophie');
const noah=units.find(u=>u.id==='noah');
assert(sophie&&sophie.status==='At home'&&sophie.visit.reason==='stranger');
assert.equal(noah?.status,'At work','personId schedule resolves live away status');
assert(knockMessage(sophie,sophie.visit).includes('Who is it'));

// Hallway door knock outcome: away vs asleep vs home vs sick
const kAway=hallwayKnockOutcome(noah,p,awayPlan);
assert.equal(kAway.answered,false);
assert.equal(kAway.home,false);
assert.equal(kAway.text,"There's nobody home.");

const pSleep={...p,routine:{...p.routine,minutes:120}};
const kSleep=hallwayKnockOutcome(sophie,pSleep,homePlan);
assert.equal(kSleep.answered,false);
assert.equal(kSleep.asleep,true);

const kHome=hallwayKnockOutcome(sophie,p,homePlan);
assert.equal(kHome.answered,true);
assert.equal(kHome.home,true);

const pSick={...p,npcs:{...p.npcs,sophie:{...p.npcs.sophie,sickUntil:5}}};
const kSick=hallwayKnockOutcome(sophie,pSick,homePlan);
assert.equal(kSick.answered,false);
assert.equal(kSick.reason,'sick');

// Friend tier allows inside visit when home
p={...p,standing:{...p.standing,people:{sophie:{points:25,gainDay:1,gainToday:0}}}};
const units2=oakElevatorUnits({progress:p,planOf:()=>homePlan});
const sophie2=units2.find(u=>u.id==='sophie');
assert.equal(sophie2.visit.allowed,true);
assert.equal(sophie2.visit.inside,true);
assert(knockMessage(sophie2,sophie2.visit).includes('Come on in'));
console.log('PASS apartment-visits: 6 Oak Street NPC units, residential floors, personId schedule status, hallway knock outcomes, and co-op units verified');
