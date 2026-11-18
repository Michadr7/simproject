// SND2 + SND3 + steps-v2: the lumber and sound-sweep tables (every SURFACE mapped, 11 step kinds + run + cloth, pure nextStepClip, every clip exists/mono/under budget, audio.js safe without a sound card).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STEP_CLIPS,STEP_RUN_CLIPS,STEP_CLOTH,STEP_CLOTH_LEVEL,STEP_LEVEL,stepKind,nextStepClip,SWEEP_SHOTS,SWEEP_LOOPS,SWEEP_FILES,SWEEP_CORE} from '../dist/sweep-sounds.js';
import {SURFACE} from '../dist/terrain.js';
import {createAudio} from '../dist/audio.js';
import {TIMBER_SHOTS,TIMBER_FILES,CHAINSAW,SAWMILL_BLADE,CONVEYOR_CLIP} from '../dist/timber-sounds.js';

const sndUrl=f=>new URL('../dist/assets/sounds/'+f+'.ogg',import.meta.url);
for(const f of [...SWEEP_FILES,'eng-atv','eng-tractor']){const p=sndUrl(f);assert.ok(fs.existsSync(p),f+' exists');assert.ok(fs.statSync(p).size<60000,f+' under 60 KB')}
// steps-v2 count re-pinned 38 -> 114: +52 walk clips (4 existing kinds expanded to 6 + 7 new kinds dirt/mud/soil/crops/bank/tile/carpet), +20 run clips (5 common kinds x 4), +4 cloth layer clips.
assert.equal(SWEEP_FILES.length,114);assert.equal(new Set(SWEEP_FILES).size,SWEEP_FILES.length);for(const c of SWEEP_CORE)assert.ok(SWEEP_FILES.includes(c),c+' is in the set');

// steps-v2: every new step/run/cloth file is mono 22.05 kHz Ogg Vorbis under 30 KB, and total new audio is under 400 KB.
const LEGACY_STEPS=new Set(['step-pave-1','step-pave-2','step-pave-3','step-grass-1','step-grass-2','step-grass-3','step-gravel-1','step-gravel-2','step-gravel-3','step-wood-1','step-wood-2','step-wood-3']);
let newStepBytes=0;
for(const f of [...Object.values(STEP_CLIPS).flat(),...Object.values(STEP_RUN_CLIPS).flat(),...STEP_CLOTH]){
 const p=sndUrl(f),sz=fs.statSync(p).size,b=fs.readFileSync(p),pk=27+b[26];
 assert.equal(b.toString('latin1',0,4),'OggS',f+' Ogg');assert.equal(b[pk+11],1,f+' mono');assert.equal(b.readUInt32LE(pk+12),22050,f+' 22.05 kHz');
 if(!LEGACY_STEPS.has(f)){assert.ok(sz<30*1024,f+' under 30 KB');newStepBytes+=sz}
}
assert.ok(newStepBytes<400*1024,`total new step audio ${newStepBytes} B under 400 KB`);

// All 15 terrain.js SURFACE ids mapped explicitly, plus indoor strings and unknowns.
const EXPECTED_SURFACE=[
 [SURFACE.GRASS,'grass'],[SURFACE.STREET,'pave'],[SURFACE.ROAD,'pave'],[SURFACE.DIRT,'dirt'],[SURFACE.PAVEMENT,'pave'],
 [SURFACE.WATER,null],[SURFACE.BANK,'bank'],[SURFACE.BRIDGE,'wood'],[SURFACE.WHEAT,'crops'],[SURFACE.PLOWED,'soil'],
 [SURFACE.GREEN,'crops'],[SURFACE.DRIVEWAY,'pave'],[SURFACE.PATH,'dirt'],[SURFACE.MUD,'mud'],[SURFACE.GRAVEL,'gravel']
];
assert.equal(EXPECTED_SURFACE.length,Object.keys(SURFACE).length,'all 15 SURFACE ids listed');
for(const [id,kind] of EXPECTED_SURFACE)assert.equal(stepKind(id),kind,`SURFACE ${id} -> ${kind}`);
for(const id of Object.values(SURFACE))assert.ok(stepKind(id)===null||STEP_CLIPS[stepKind(id)],'every surface maps to a set or none: '+id);
for(const k of ['tile','carpet','wood','pave','grass','gravel','dirt','mud','soil','crops','bank'])assert.equal(stepKind(k),k);
assert.equal(stepKind('lava'),null);assert.equal(stepKind(999),null);
for(const [k,pool] of Object.entries(STEP_CLIPS)){assert.ok(pool.length>=5&&pool.length<=6,k+' has 5-6 clips');assert.ok(Object.isFrozen(pool))}
for(const k of ['pave','grass','gravel','dirt','wood'])assert.equal(STEP_RUN_CLIPS[k].length,4,k+' run pool');
assert.equal(STEP_CLOTH.length,4);assert.ok(STEP_CLOTH_LEVEL.walk<STEP_LEVEL.walk&&STEP_CLOTH_LEVEL.run<STEP_LEVEL.run);

// nextStepClip: pure, deterministic from seed, never repeats back-to-back, alternates feet, scales gain/rate with running, includes soft cloth layer.
assert.equal(nextStepClip(SURFACE.WATER,-1,'L',false,1),null);
assert.equal(nextStepClip('lava',-1,'L',false,1),null);
for(const k of Object.keys(STEP_CLIPS)){
 const a=nextStepClip(k,-1,'L',false,42),b=nextStepClip(k,-1,'L',false,42);
 assert.deepEqual(a,b,k+' deterministic from seed');
 assert.equal(a.foot,'L');assert.equal(a.nextFoot,'R');assert.equal(a.index%2,0,'L picks even index');
 assert.ok(a.cloth&&STEP_CLOTH.includes(a.cloth.file)&&a.cloth.gain>0&&a.cloth.gain<a.gain);
 let last=-1,foot='L';
 for(let i=0;i<24;i++){
  const s=nextStepClip(k,last,foot,false,i*17+3);
  assert.notEqual(s.index,last,`${k} step ${i} never repeats index ${last}`);
  assert.equal(s.foot,foot);assert.equal(s.index%2,foot==='L'?0:1);
  last=s.index;foot=s.nextFoot;
 }
 // Same-foot repeated calls still never repeat lastIndex back-to-back.
 for(const f of ['L','R'])for(let idx=0;idx<STEP_CLIPS[k].length;idx++)if((idx%2)===(f==='R'?1:0))for(let sd=0;sd<6;sd++){
  const s=nextStepClip(k,idx,f,false,sd);assert.notEqual(s.index,idx,`${k} same-foot ${f} never repeats ${idx}`);
 }
 // Running scales gain & rate higher and uses run pool for common kinds.
 for(const sd of [0,0.37,7,99]){
  const w=nextStepClip(k,-1,'L',false,sd),r=nextStepClip(k,-1,'L',true,sd);
  assert.ok(r.gain>w.gain&&r.rate>w.rate,`${k} run louder and faster at seed ${sd}`);
  assert.ok(r.cloth.gain>w.cloth.gain&&r.cloth.rate>w.cloth.rate,`${k} cloth scales with run`);
  if(STEP_RUN_CLIPS[k])assert.ok(STEP_RUN_CLIPS[k].includes(r.file),k+' uses run pool');
  else assert.ok(STEP_CLIPS[k].includes(r.file),k+' falls back to walk pool');
 }
}
// Omitting foot alternates automatically from lastIndex.
{const s1=nextStepClip(SURFACE.MUD,-1,null,false,5),s2=nextStepClip(SURFACE.MUD,s1.index,null,false,6),s3=nextStepClip(SURFACE.MUD,s2.index,null,false,7);
 assert.equal(s1.foot,'L');assert.equal(s2.foot,'R');assert.equal(s3.foot,'L')}

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
assert.equal(typeof a.timber,'function');assert.equal(typeof a.chainsaw,'function');assert.equal(a.timber('chop',{x:0,z:0},{x:0,z:0}),false,'no audio context: nothing plays, nothing throws');assert.equal(a.timber('nope'),false);a.chainsaw({active:true,cutting:true,at:{x:0,z:0},listener:{x:0,z:0}});console.log(`PASS sweep-sounds.mjs: 114 sweep clips (${(newStepBytes/1024).toFixed(1)} KB new step audio), all 15 SURFACE ids + indoor tile/carpet/wood, nextStepClip deterministic L/R + run + cloth, 20 lumber clips, audio.js safe without a sound card.`);
