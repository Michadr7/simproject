// Pure unit tests for dist/grocery-migrate.js (notes/cooking-design.md section 5, L-PURE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 FRIDGE_SLOTS,PACK_REFUND_CENTS,MIGRATE_MESSAGE,migrateGroceries
} from '../dist/grocery-migrate.js';

// 1. Safe on null/undefined/empty/missing fields, and strict no-op when groceries === 0.
assert.equal(migrateGroceries(null),null);
assert.equal(migrateGroceries(undefined),undefined);
{
 const empty={};
 assert.equal(migrateGroceries(empty),empty);
 const zero={life:{groceries:0},cash:100};
 assert.equal(migrateGroceries(zero),zero);
}

// 2. Studio rented: unpacks groceries into housing.fridge + cat-food + phone message, idempotent.
{
 const p={
  cash:500,
  housing:{rented:true,day:3},
  routine:{minutes:600},
  life:{food:80,thirst:90,energy:70,groceries:4},
  inventory:{slots:[],equipment:{jacket:null,backpack:null}},
  pets:{pet:{name:'Whiskers'}},
  messages:[]
 };
 const snap=JSON.stringify(p);
 const m1=migrateGroceries(p);
 assert.equal(JSON.stringify(p),snap,'input progress not mutated');
 assert.equal(m1.life.groceries,0,'groceries cleared');
 assert.deepEqual(m1.housing.fridge,[
  {id:'eggs',quantity:4},
  {id:'produce',quantity:4},
  {id:'cat-food',quantity:2}
 ],'4 packs -> 4 eggs, 4 produce, ceil(4/3)=2 cat-food');
 assert.equal(m1.messages.length,1);
 assert.equal(m1.messages[0].app,'player');
 assert.equal(m1.messages[0].text,MIGRATE_MESSAGE);
 assert.equal(m1.messages[0].at,2*1440+600);

 // Idempotent: running twice changes nothing.
 const m2=migrateGroceries(m1);
 assert.deepEqual(m2,m1,'second run is a strict no-op');
}

// 3. Owned/rented property fridge when studio is not rented.
{
 const p={
  life:{groceries:2},
  housing:{rented:false,day:1},
  properties:{'cedar-1':{tenure:'own',since:1}},
  inventory:{slots:[],equipment:{jacket:null,backpack:null}}
 };
 const m=migrateGroceries(p);
 assert.equal(m.life.groceries,0);
 assert.deepEqual(m.properties['cedar-1'].fridge,[
  {id:'eggs',quantity:2},
  {id:'produce',quantity:2},
  {id:'cat-food',quantity:1}
 ]);
}

// 4. No home: falls back to inventory.slots; full inventory refunds unplaced packs at $4.00 each.
{
 const fullSlots=Array.from({length:8},(_,i)=>({id:`item-${i}`,quantity:1}));
 const p={
  cash:100,
  life:{groceries:3},
  housing:{rented:false,day:1},
  inventory:{slots:fullSlots,equipment:{jacket:null,backpack:null}}
 };
 const m=migrateGroceries(p);
 assert.equal(m.life.groceries,0);
 assert.equal(m.cash,100+3*PACK_REFUND_CENTS,'3 unplaced packs refunded $12.00');
 assert.equal(m.inventory.slots.length,8);
 assert.equal(FRIDGE_SLOTS,20);
}

// 5. Purity: no DOM, no clock, no random, no three.js.
{
 const src=fs.readFileSync(new URL('../dist/grocery-migrate.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'grocery-migrate.js must not use '+bad);
 assert(!/from '\.\/(game|driving|phone)/.test(src));
}

console.log('PASS Grocery-migrate: idempotent unpacking into studio/property fridge, inventory fallback, $4.00 refund on full bag, safe on missing fields, and purity.');
