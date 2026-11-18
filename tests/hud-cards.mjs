// HUD restyle pure rules (notes/hud-restyle-spec.md): speed card, fuel/damage bars, view cone angle, street chips, purity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP,roadGraph} from '../dist/map-definition.js';
import {SPEED_AMBER,SPEED_RED,speedCard,fuelBar,damageBar,viewConeAngle,roadDisplayName,streetChips} from '../dist/hud-cards.js';

const near=(a,b,eps=1e-9,msg='')=>assert(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);

// 1. Speed card: parked, 25 mph, amber, red, engine off.
assert.deepEqual(speedCard({speedMs:0,topSpeedMs:29}),{text:'0',unit:'MPH',fraction:0,band:'normal'});
{const c=speedCard({speedMs:25/2.236936,topSpeedMs:29});assert.equal(c.text,'25');assert.equal(c.unit,'MPH');assert.equal(c.band,'normal');assert(c.fraction>.35&&c.fraction<.42)}
assert.equal(speedCard({speedMs:29*SPEED_AMBER,topSpeedMs:29}).band,'amber');
assert.equal(speedCard({speedMs:29*SPEED_RED,topSpeedMs:29}).band,'red');
assert.equal(speedCard({speedMs:40,topSpeedMs:29}).fraction,1,'clamped to 1');
assert.deepEqual(speedCard({speedMs:10,topSpeedMs:29,engineMode:'off'}),{text:'22',unit:'MPH',fraction:0,band:'off'});
assert.equal(speedCard({speedMs:5,topSpeedMs:29,cond:0}).band,'off');

// 2. Fuel and damage bars.
assert.deepEqual(fuelBar(null),{text:'—',fraction:0,band:'off'});
assert.equal(fuelBar({mgal:8000,capacityMgal:10000}).band,'ok');
assert.equal(fuelBar({mgal:2500,capacityMgal:10000}).band,'amber');
assert.equal(fuelBar({mgal:1000,capacityMgal:10000}).band,'red');
assert.equal(damageBar(1000).band,'ok');assert.equal(damageBar(400).band,'amber');assert.equal(damageBar(100).band,'red');

// 3. View cone angle matches minimap.js convention: camera looks along (-sin(yaw), -cos(yaw)).
near(viewConeAngle(0),-Math.PI/2,1e-9,'yaw 0 looks north (-z -> up on canvas = -PI/2)');
near(viewConeAngle(Math.PI),Math.PI/2,1e-9,'yaw PI looks south (+z -> down = +PI/2)');
near(viewConeAngle(-Math.PI/2),0,1e-9,'yaw -PI/2 looks east (+x -> right = 0)');

// 4. Street chips from MAP.roads.
assert.equal(roadDisplayName({id:'oak-street'}),'Oak Street');
assert.equal(roadDisplayName({id:'bay-road',name:'Bay Road'}),'Bay Road');
{const edges=Object.values(roadGraph(MAP).edges),oak=edges.find(e=>e.id==='oak-street'),mid=oak.poly[Math.floor(oak.poly.length/2)];
 const c=streetChips(mid[0],mid[1],edges);assert.equal(c.street,'Oak Street','on Oak Street');
 const far=streetChips(9999,9999,edges);assert.deepEqual(far,{street:null,cross:null},'far from any road');}

// 5. Purity: no DOM, no clock, no random, no three.js.
{const src=fs.readFileSync(new URL('../dist/hud-cards.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'hud-cards.js must not use '+bad);}

console.log('PASS hud-cards.mjs: speed text/bar/bands, fuel/damage bars, view cone angle, street chips from MAP.roads, purity.');
