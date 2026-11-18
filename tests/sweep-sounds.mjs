// SND2 + SND3: the lumber and sound-sweep tables (steps map every SURFACE, every wired clip exists and is small, audio.js sweep/step/ambience/forklift are safe without a sound card).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STEP_CLIPS,stepKind,SWEEP_SHOTS,SWEEP_LOOPS,SWEEP_FILES,SWEEP_CORE} from '../dist/sweep-sounds.js';
import {SURFACE} from '../dist/terrain.js';
import {createAudio} from '../dist/audio.js';
import {TIMBER_SHOTS,TIMBER_FILES,CHAINSAW,SAWMILL_BLADE,CONVEYOR_CLIP} from '../dist/timber-sounds.js';
for(const f of [...SWEEP_FILES,'eng-atv','eng-tractor']){const p=new URL('../dist/assets/sounds/'+f+'.ogg',import.meta.url);assert.ok(fs.existsSync(p),f+' exists');assert.ok(fs.statSync(p).size<60000,f+' under 60 KB')}
assert.equal(SWEEP_FILES.length,38);assert.equal(new Set(SWEEP_FILES).size,SWEEP_FILES.length);for(const c of SWEEP_CORE)assert.ok(SWEEP_FILES.includes(c),c+' is in the set');
assert.equal(stepKind(SURFACE.PAVEMENT),'pave');assert.equal(stepKind(SURFACE.STREET),'pave');assert.equal(stepKind(SURFACE.GRASS),'grass');assert.equal(stepKind(SURFACE.WHEAT),'grass');assert.equal(stepKind(SURFACE.GRAVEL),'gravel');assert.equal(stepKind(SURFACE.PATH),'gravel');assert.equal(stepKind(SURFACE.BRIDGE),'wood');assert.equal(stepKind(SURFACE.WATER),null);assert.equal(stepKind('wood'),'wood');assert.equal(stepKind('lava'),null);
for(const id of Object.values(SURFACE))assert.ok(stepKind(id)===null||STEP_CLIPS[stepKind(id)],'every surface maps to a set or none: '+id);
for(const [k,s] of Object.entries(SWEEP_SHOTS)){assert.ok(s.level>0&&s.level<=1&&s.jitter>=0,k)}
const a=createAudio({AudioContextClass:null,storage:{getItem:()=>null,setItem(){}},random:()=>.5});
for(const m of ['sweep','step','ambience','forklift'])assert.equal(typeof a[m],'function',m);
assert.equal(a.sweep('cash-register'),false);assert.equal(a.sweep('nope'),false);assert.equal(a.step(SURFACE.GRASS,{x:0,z:0},{x:0,z:0},true),false);a.ambience({outdoors:true});a.forklift({on:true,speed:-1});
assert.ok(Object.keys(SWEEP_LOOPS).length===7);
// SND-hooks: every name game.js passes to audio.sweep exists in SWEEP_SHOTS, and each wired event is called at least once.
{const src=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8'),used=new Set([...src.matchAll(/audio\.sweep\('([a-z-]+)'/g)].map(m=>m[1]));for(const n of used)assert.ok(SWEEP_SHOTS[n],'game.js plays a known sweep sound: '+n);for(const n of ['door-open','door-close','cash-register','coins-pay','level-up','eat-bite','sleep-chime','breath-tired','fuel-nozzle','car-door-open','car-door-close','car-horn','brake-squeal','ui-click','ui-toast','shop-bell'])assert.ok(used.has(n),'game.js hooks '+n);assert.ok(/audio\.forklift\(/.test(src),'game.js drives audio.forklift')}
// SND2 (lumber): every registry clip exists and is small, the shot table is sane, timber() and chainsaw() are safe without a sound card.
for(const f of [...TIMBER_FILES,CONVEYOR_CLIP]){const u=new URL('../dist/assets/sounds/'+f+'.ogg',import.meta.url);assert.ok(fs.existsSync(u),f+' is in dist/assets/sounds');assert.ok(fs.statSync(u).size<120*1024,f+' under 120 KB')}
assert.equal(TIMBER_FILES.length,new Set(TIMBER_FILES).size);assert.equal(TIMBER_FILES.length,20,'20 wired lumber clips (the conveyor is optional)');
for(const [k,s] of Object.entries(TIMBER_SHOTS)){assert.ok(s.clips.length>=1&&s.level>0&&s.level<=1&&s.jitter>=0,k);assert.ok(Object.isFrozen(s))}
assert.deepEqual(Object.keys(CHAINSAW),['start','idle','cut','stop']);assert.deepEqual(Object.keys(SAWMILL_BLADE),['idle','cut','stop']);
assert.equal(typeof a.timber,'function');assert.equal(typeof a.chainsaw,'function');assert.equal(a.timber('chop',{x:0,z:0},{x:0,z:0}),false,'no audio context: nothing plays, nothing throws');assert.equal(a.timber('nope'),false);a.chainsaw({active:true,cutting:true,at:{x:0,z:0},listener:{x:0,z:0}});console.log('PASS sweep-sounds.mjs: 20 lumber clips and the timber/chainsaw calls, 38 sweep clips exist and are small, every terrain SURFACE maps to a footstep set (or none for water), the shot table is sane, audio.js sweep/step/ambience/forklift are safe without a sound card.');