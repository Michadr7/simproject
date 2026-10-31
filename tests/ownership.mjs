import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {advanceTime} from '../dist/routine.js';
import {LISTED,listingOf,normalizeProperties,heldIds,propertyTransaction,advanceProperties,SCHEMA,WEEK,GRACE} from '../dist/ownership.js';
import {MAP} from '../dist/map-definition.js';

const DAY=1440,base=(cash,extra={})=>({...freshProgress(),cash,...extra});
// ── The listings: the four vacant houses, each priced sensibly ─────────────────────────────────────────
assert.deepEqual(LISTED.map(h=>h.id),['house-r1','house-r3','house-r5','house-r7']);
for(const h of LISTED){assert(h.priceCents>h.rentCents*50&&h.priceCents<h.rentCents*100,`${h.id}: the price is 50-100 weeks of rent`);assert.equal(h.depositCents,h.rentCents*2,`${h.id}: the deposit is two weeks`)}
assert.equal(MAP.properties.filter(p=>p.listing).every(p=>p.owner===null),true,'only vacant homes are listed');

// ── The save: schema 2, and an old save walks forward ─────────────────────────────────────────────────
{const old=JSON.parse(readFileSync(new URL('./fixtures/save-schema-1.json',import.meta.url)));assert.equal(old.schema,undefined,'the fixture is from before the schema number');
 const s=normalizeProgress(old);assert.equal(s.schema,SCHEMA);assert.equal(SCHEMA,2);assert.deepEqual(s.properties,{});assert.deepEqual(s.homeNotices,[]);
 assert.equal(s.cash,12345);assert.equal(s.completed,3);assert.equal(s.housing.rented,true);assert.equal(s.housing.day,12);assert.equal(s.life.groceries,2,'everything that was there is kept');
 assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(s))),s,'normalising twice changes nothing')}
assert.equal(freshProgress().schema,2);assert.deepEqual(freshProgress().properties,{});
// junk is cleaned: unknown homes, bad tenures, impossible numbers
{const n=normalizeProperties({'house-r1':{tenure:'rent',since:5,nextBillDay:12,rentDue:-4,missed:99,deposit:'lots'},'house-r2':{tenure:'own'},'nowhere':{tenure:'own'},'house-r3':{tenure:'squat'},'house-r5':{tenure:'own',since:3}});
 assert.deepEqual(Object.keys(n).sort(),['house-r1','house-r5'],'only listed homes with a real tenure survive');assert.deepEqual(n['house-r1'],{tenure:'rent',since:5,nextBillDay:12,rentDue:0,missed:0,deposit:32000});assert.equal(n['house-r5'].nextBillDay,0)}
assert.deepEqual(normalizeProperties(null),{});assert.deepEqual(normalizeProperties([1,2]),{});

// ── Renting ────────────────────────────────────────────────────────────────────────────────
{const L=listingOf('house-r1'),s0=base(L.depositCents+L.rentCents);
 const r=propertyTransaction(s0,'rent','house-r1');assert.equal(r.error,undefined);assert.equal(r.state.cash,0,'deposit and the first week are paid');
 assert.deepEqual(r.state.properties['house-r1'],{tenure:'rent',since:1,nextBillDay:8,rentDue:0,missed:0,deposit:L.depositCents});assert.deepEqual(heldIds(r.state),['house-r1']);assert(r.message.includes('1 Cedar Loop'));
 assert.match(propertyTransaction(base(L.depositCents+L.rentCents-1),'rent','house-r1').error,/You need \$480\.00/,'one cent short');
 assert.equal(propertyTransaction(r.state,'rent','house-r1').error,'You already live here.');
 assert.equal(propertyTransaction(s0,'rent','house-r2').error,'That home is not for rent or sale.','a resident\'s home is not listed');assert.equal(propertyTransaction(s0,'dance','house-r1').error,'Unknown home action.')}

// ── Buying ─────────────────────────────────────────────────────────────────────────────────
{const L=listingOf('house-r3'),rich=base(L.priceCents+1000);
 const b=propertyTransaction(rich,'buy','house-r3');assert.equal(b.state.cash,1000);assert.deepEqual(b.state.properties['house-r3'],{tenure:'own',since:1,nextBillDay:0,rentDue:0,missed:0,deposit:0});
 assert.equal(propertyTransaction(b.state,'buy','house-r3').error,'You already own this home.');assert.match(propertyTransaction(base(L.priceCents-1),'buy','house-r3').error,/You need \$11,?000\.00/);
 // a renter buys with the deposit counted, but not while rent is owing
 const rent=propertyTransaction(base(3e6),'rent','house-r3').state,cash0=rent.cash,buy=propertyTransaction(rent,'buy','house-r3');assert.equal(buy.state.cash,cash0-(L.priceCents-L.depositCents),'the deposit counts toward the price');assert.equal(buy.state.properties['house-r3'].tenure,'own');
 assert.equal(propertyTransaction({...rent,properties:{'house-r3':{...rent.properties['house-r3'],rentDue:14000}}},'buy','house-r3').error,'Pay the rent you owe before you buy.')}

// ── Paying and leaving ──────────────────────────────────────────────────────────────────────
{const rent=propertyTransaction(base(1e6),'rent','house-r5').state,owing={...rent,properties:{'house-r5':{...rent.properties['house-r5'],rentDue:19000,missed:1}}};
 const paid=propertyTransaction(owing,'pay','house-r5');assert.equal(paid.state.cash,rent.cash-19000);assert.deepEqual([paid.state.properties['house-r5'].rentDue,paid.state.properties['house-r5'].missed],[0,0]);
 assert.equal(propertyTransaction(rent,'pay','house-r5').error,'There is no rent to pay.');assert.match(propertyTransaction({...owing,cash:100},'pay','house-r5').error,/You need \$190\.00/);
 const left=propertyTransaction(rent,'leave','house-r5');assert.equal(left.state.cash,rent.cash+38000,'the deposit comes back');assert.deepEqual(heldIds(left.state),[]);
 const forfeit=propertyTransaction(owing,'leave','house-r5');assert.equal(forfeit.state.cash,rent.cash,'owing rent, the deposit is kept');assert(forfeit.message.includes('deposit stays'));
 assert.equal(propertyTransaction(propertyTransaction(base(1e7),'buy','house-r7').state,'leave','house-r7').error,'You do not rent this home.')}

// ── Weekly rent on the game clock (routine.js advanceTime calls advanceProperties when the day changes) ──────────────────────────────────
{const L=listingOf('house-r1');let s=propertyTransaction(base(1e6),'rent','house-r1').state;const start=s.cash;
 s=advanceTime(s,6*DAY);assert.equal(s.housing.day,7);assert.equal(s.cash,start,'nothing is due before day 8');
 s=advanceTime(s,DAY);assert.equal(s.housing.day,8);assert.equal(s.cash,start-L.rentCents,'rent is taken on day 8');assert.equal(s.properties['house-r1'].nextBillDay,15);assert(s.homeNotices.at(-1).includes('Rent paid'));
 s=advanceTime(s,21*DAY);assert.equal(s.cash,start-4*L.rentCents,'three more weeks, three more payments in one jump');
 // an owner pays no rent
 let o=propertyTransaction(base(1e7),'buy','house-r1').state;const before=o.cash;o=advanceTime(o,30*DAY);assert.equal(o.cash,before,'owners owe nothing');assert.deepEqual(o.homeNotices,[])}
// ── A week that cannot be paid is a warning, a second evicts ─────────────────────────────────────────────────────────
{const L=listingOf('house-r3');let s=propertyTransaction(base(L.depositCents+L.rentCents),'rent','house-r3').state;assert.equal(s.cash,0);
 s=advanceTime(s,7*DAY);assert.equal(s.properties['house-r3'].missed,1);assert.equal(s.properties['house-r3'].rentDue,L.rentCents);assert(s.homeNotices.at(-1).includes('overdue'),'a warning');assert.deepEqual(heldIds(s),['house-r3'],'still your home');
 s=advanceTime(s,7*DAY);assert.deepEqual(heldIds(s),[],'the second unpaid week evicts');assert(s.homeNotices.at(-1).includes('evicted'));assert.equal(s.cash,0,'and the deposit is lost');
 // paying in the grace week saves the tenancy
 let t=propertyTransaction(base(L.depositCents+L.rentCents),'rent','house-r3').state;t=advanceTime(t,7*DAY);t={...t,cash:50000};t=propertyTransaction(t,'pay','house-r3').state;t=advanceTime(t,7*DAY);assert.equal(t.properties['house-r3'].missed,0);assert.equal(t.properties['house-r3'].rentDue,0,'the next week was paid from cash')}
// a long absence: ten weeks at once with too little cash evicts after two
{const L=listingOf('house-r7');let s=propertyTransaction(base(L.depositCents+L.rentCents+L.rentCents),'rent','house-r7').state;s=advanceTime(s,70*DAY);assert.deepEqual(heldIds(s),[],'evicted');assert.equal(s.cash,0)}
assert.equal(WEEK,7);assert.equal(GRACE,2);
// the notices are capped and cleaned
assert.equal(normalizeProgress({homeNotices:['a','b','c','d','e','f','g',5,{}]}).homeNotices.length,6);
console.log('Ownership: four homes listed; renting, buying (a renter\'s deposit counts), paying and moving out; weekly rent on the game clock, a warning after one unpaid week and eviction after two; schema 2 migrates a 0.29 save without losing anything.');
