// Tests for shop-presence.js: opening hours, visibility flags, smooth lightScale ramp, frame-rate independence, and purity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP} from '../dist/map-definition.js';
import {shopPresence,stepLightScale,LIGHT_DIM,LIGHT_FULL,LIGHT_RAMP_HOURS} from '../dist/shop-presence.js';

// 1. Closed hours: everything hidden and lightScale dimmed.
for(const h of [0,6.99,22,23.5]){
 const m=shopPresence('market',h,MAP.shops);
 assert.deepEqual(m,{open:false,clerkVisible:false,customersVisible:false,cupsVisible:false,lightScale:LIGHT_DIM},`market closed at ${h}`);
}
for(const h of [0,7.99,18,21]){
 const c=shopPresence('cafe',h,MAP.shops);
 assert.deepEqual(c,{open:false,clerkVisible:false,customersVisible:false,cupsVisible:false,lightScale:LIGHT_DIM},`cafe closed at ${h}`);
}

// 2. Mid-day open hours: everything visible and lightScale full.
assert.deepEqual(shopPresence('market',12,MAP.shops),{open:true,clerkVisible:true,customersVisible:true,cupsVisible:true,lightScale:LIGHT_FULL});
assert.deepEqual(shopPresence('cafe',12,MAP.shops),{open:true,clerkVisible:true,customersVisible:true,cupsVisible:true,lightScale:LIGHT_FULL});

// 3. Smooth ramp at opening and closing.
const mOpenStart=shopPresence('market',7,MAP.shops);
const mOpenMid=shopPresence('market',7+LIGHT_RAMP_HOURS/2,MAP.shops);
const mOpenEnd=shopPresence('market',7+LIGHT_RAMP_HOURS,MAP.shops);
assert.equal(mOpenStart.open,true);
assert.equal(mOpenStart.lightScale,LIGHT_DIM,'ramp starts at LIGHT_DIM at opening');
assert(mOpenMid.lightScale>LIGHT_DIM&&mOpenMid.lightScale<LIGHT_FULL,'ramp is smooth mid-transition');
assert.equal(mOpenEnd.lightScale,LIGHT_FULL,'ramp reaches LIGHT_FULL');

const cCloseMid=shopPresence('cafe',18-LIGHT_RAMP_HOURS/2,MAP.shops);
assert(cCloseMid.open===true&&cCloseMid.lightScale>LIGHT_DIM&&cCloseMid.lightScale<LIGHT_FULL,'cafe ramps down before 18:00');

// 4. Custom hours table in hours (not minutes) + wrap-around/invalid hour handling.
const custom={market:[9,17]};
assert.equal(shopPresence('market',8.5,custom).open,false);
assert.equal(shopPresence('market',10,custom).open,true);
assert.equal(shopPresence('market',NaN,custom).open,false);
assert.equal(shopPresence('unknown',12,MAP.shops).open,false);

// 5. Frame-rate independence of stepLightScale: two 0.05s steps equal one 0.10s step.
let a=LIGHT_DIM;
a=stepLightScale(a,LIGHT_FULL,0.05);
a=stepLightScale(a,LIGHT_FULL,0.05);
const b=stepLightScale(LIGHT_DIM,LIGHT_FULL,0.10);
assert(Math.abs(a-b)<1e-12,`frame-rate independent: ${a} vs ${b}`);

// 6. Purity: no DOM, no three.js, no Date.now/Math.random/performance.now.
const src=fs.readFileSync(new URL('../dist/shop-presence.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'shop-presence.js must not use '+bad);

console.log('Shop presence: market 07:00-22:00 and cafe 08:00-18:00 hide clerk/customers/cups when closed, ramp lightScale smoothly, stepLightScale is frame-rate independent, and module is pure.');
