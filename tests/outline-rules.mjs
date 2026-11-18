// V-C (notes/visual-identity-design.md): pure outline width clamping, 28..45 m fade, Low=0, and nearby vehicle selection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OUTLINE,clampOutlineWidth,outlineFade,outlineWidthAt,selectOutlinedVehicles} from '../dist/outline-rules.js';

const near=(a,b,eps=1e-9,msg='')=>assert(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);

// 1. Clamped widths.
assert.equal(clampOutlineWidth(-1),OUTLINE.widthMin);
assert.equal(clampOutlineWidth(5),OUTLINE.widthMax);
assert.equal(clampOutlineWidth(.004),.004);
assert.equal(clampOutlineWidth(NaN),OUTLINE.widthChar);

// 2. Distance fade: 1 <= 28 m, monotonic down, 0 >= 45 m.
{let prev=2;
 for(let d=0;d<=60;d++){
  const f=outlineFade(d);
  assert(f>=0&&f<=1,`fade in [0,1] at ${d}`);
  assert(f<=prev+1e-12,`fade monotonic non-increasing at ${d}`);
  prev=f;
 }
 assert.equal(outlineFade(0),1);assert.equal(outlineFade(-5),1);assert.equal(outlineFade(OUTLINE.fadeStart),1);
 assert(outlineFade(36)>0&&outlineFade(36)<1,'mid-fade at 36 m');
 assert.equal(outlineFade(OUTLINE.fadeEnd),0,'invisible at 45 m');assert.equal(outlineFade(100),0);
 assert.equal(outlineFade(Infinity),0);assert.equal(outlineFade(NaN),0);}

// 3. Low tier and disabled toggle: strictly 0 everywhere.
for(const d of [0,10,28,36,45]){
 assert.equal(outlineWidthAt(d,{quality:'low'}),0,`0 on Low at ${d}`);
 assert.equal(outlineWidthAt(d,{quality:'high',enabled:false}),0,`0 when disabled at ${d}`);
}
near(outlineWidthAt(10,{quality:'high'}),OUTLINE.widthChar,1e-9,'full char width close up on High');
assert.equal(outlineWidthAt(45,{quality:'high'}),0,'0 at 45 m on High');
near(outlineWidthAt(10,{quality:'high',baseWidth:99}),OUTLINE.widthMax,1e-9,'baseWidth clamped to widthMax');

// 4. Nearby vehicle selection: driven + nearest 2 within 35 m on High; [] on Low/disabled.
{const vs=[
  {uid:'v-far',x:50,z:0},
  {uid:'v-mid',x:20,z:0},
  {uid:'v-near',x:5,z:0},
  {uid:'v-edge',x:35,z:0},
  {uid:'v-driven',x:100,z:0},
 ];
 assert.deepEqual(selectOutlinedVehicles(vs,{x:0,z:0},{drivenUid:'v-driven',quality:'high'}),['v-driven','v-near','v-mid']);
 assert.deepEqual(selectOutlinedVehicles(vs,{x:0,z:0},{drivenUid:'v-driven',quality:'low'}),[],'none on Low');
 assert.deepEqual(selectOutlinedVehicles(vs,{x:0,z:0},{drivenUid:'v-driven',quality:'high',enabled:false}),[],'none when disabled');
 assert.deepEqual(selectOutlinedVehicles(vs,{x:0,z:0},{quality:'high'}),['v-near','v-mid'],'no driven vehicle: up to 2 nearby');
 assert.deepEqual(selectOutlinedVehicles([{uid:'v-edge',x:35,z:0},{uid:'v-out',x:35.01,z:0}],{x:0,z:0}),['v-edge'],'35 m boundary inclusive');}

// 5. Purity: no DOM, no clock, no random, no three.js.
{const src=fs.readFileSync(new URL('../dist/outline-rules.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'outline-rules.js must not use '+bad);}

console.log('PASS outline-rules.mjs: 0 on Low/disabled, 28..45 m fade, clamped widths, driven + 2 nearby vehicles within 35 m, purity.');
