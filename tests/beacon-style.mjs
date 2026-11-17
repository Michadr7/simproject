// OBJ-BEACON: the beacon colours by purpose and the distance and daylight fade rules in beacon-style.js (pure).
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {BEACON_KINDS,BEACON_COLOURS,STOP_ZONE,kindOf,colourFor,fadeFor} from '../dist/beacon-style.js';

for(const k of BEACON_KINDS)assert.match(BEACON_COLOURS[k],/^#[0-9a-f]{6}$/i,k+' has a colour');
assert.equal(new Set(BEACON_KINDS.map(colourFor)).size,BEACON_KINDS.length,'every purpose has its own colour');
assert.equal(colourFor('nonsense'),BEACON_COLOURS.story,'unknown falls back to story');

assert.equal(kindOf({source:'gig',stage:'travel'}),'pickup');
assert.equal(kindOf({source:'gig',stage:'return'}),'dropoff');
assert.equal(kindOf({source:'delivery'}),'dropoff');
assert.equal(kindOf({source:'door'}),'shop');
assert.equal(kindOf({source:'counter'}),'shop');
assert.equal(kindOf({source:'gig',stage:'travel',urgent:true}),'urgent');
assert.equal(kindOf(),'story');

for(const day of [0,.5,1]){let prev=null;for(let d=0;d<=300;d+=.5){const f=fadeFor(d,day);
 for(const v of Object.values(f))assert.ok(v>=0&&v<=1,'in 0..1 at '+d);
 if(prev)for(const k of Object.keys(f))assert.ok(f[k]>=prev[k]-1e-12,k+' never falls with distance (d='+d+', day='+day+')');prev=f}}
const near=fadeFor(1,0),far=fadeFor(100,0);
assert.ok(near.padScale<far.padScale&&near.padScale<=.4+1e-9,'a small pad inside the stop zone');
assert.equal(near.beamAlpha,0,'no beam when you are standing in it');assert.equal(far.beamAlpha,1,'full beam far away at night');
assert.ok(STOP_ZONE>0);
for(const d of [1,10,30,100]){const n=fadeFor(d,0),y=fadeFor(d,1);assert.ok(y.ringAlpha<=n.ringAlpha&&y.beamAlpha<=n.beamAlpha,'dimmer in daylight at '+d)}
assert.ok(fadeFor(100,1).beamAlpha<fadeFor(100,0).beamAlpha,'daylight really dims the beam');
for(const bad of [NaN,undefined,-5]){const f=fadeFor(bad,NaN);for(const v of Object.values(f))assert.ok(v>=0&&v<=1)}
// FIX-R1: daylight 0 means night = full brightness; game.js daylightNow returns 0 indoors so an indoor marker is not dimmed
assert.equal(fadeFor(100,0).beamAlpha,1);assert.ok(fadeFor(30,0).ringAlpha>=fadeFor(30,1).ringAlpha);
{const g=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');assert.ok(g.includes('const daylightNow=()=>{if(shop||inside)return 0;'),'indoors is full brightness (daylight 0)')}
console.log('PASS beacon-style: colours by purpose, fades in 0..1 and monotonic with distance, dimmer by day.');
