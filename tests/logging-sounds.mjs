// logging-sounds.mjs: tests for dist/logging-sounds.js (50 CC0/derived logging & ambience clips, chopLayers, fellSequence, pure non-repeating pickers & size-keyed thuds).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 AXE_HITS,AXE_HEAVY,AXE_LIGHT,AXE_BODY,WOOD_CRACKS,TRUNK_GROANS,TREE_FALL_SEQS,TREE_FALL_DEEPS,
 LOG_THUDS,LOG_THUDS_DEEP,WOOD_CREAKS,CHOP_TAILS,FOREST_AMBIENCE,
 LOGGING_MIX,LOGGING_SHOTS,LOGGING_LOOPS,LOGGING_FILES,pickLoggingClip,pickLogThud,chopLayers,fellSequence
} from '../dist/logging-sounds.js';
import {MAX_PAYLOAD_BYTES} from '../dist/vehicle-sounds.js';

const sndUrl=f=>new URL('../dist/assets/sounds/'+f+'.ogg',import.meta.url);
const NEW_SET=new Set([
 ...AXE_HEAVY,...AXE_LIGHT,...AXE_BODY,...TRUNK_GROANS,...TREE_FALL_DEEPS,
 ...Object.values(LOG_THUDS_DEEP),...CHOP_TAILS,FOREST_AMBIENCE.bed,FOREST_AMBIENCE.deep
]);
const LOOPS=new Set(Object.values(FOREST_AMBIENCE));

assert.equal(AXE_HITS.length,6,'6 legacy axe-hit variants');
assert.equal(AXE_HEAVY.length,4,'4 heavy felling axe hits');
assert.equal(AXE_LIGHT.length,2,'2 light limbing axe hits');
assert.equal(AXE_BODY.length,4,'4 body+crack axe hits');
assert.equal(WOOD_CRACKS.length,3,'3 wood-crack layers');
assert.equal(TRUNK_GROANS.length,4,'4 trunk-groan layers');
assert.equal(TREE_FALL_SEQS.length,2,'2 legacy tree-fall sequences');
assert.equal(TREE_FALL_DEEPS.length,3,'3 deep tree-fall sequences');
assert.deepEqual(Object.keys(LOG_THUDS),['small','medium','heavy']);
assert.deepEqual(Object.keys(LOG_THUDS_DEEP),['xs','s','m','l']);
assert.equal(WOOD_CREAKS.length,6,'6 wood-creak one-shots');
assert.equal(CHOP_TAILS.length,6,'6 forest chop-tail echoes');
assert.equal(FOREST_AMBIENCE.pines,'amb-forest-pines');
assert.equal(FOREST_AMBIENCE.bed,'amb-forest-bed');
assert.equal(FOREST_AMBIENCE.deep,'amb-deep-woods');
assert.equal(LOGGING_FILES.length,50,'50 unique logging/ambience clips');
assert.equal(new Set(LOGGING_FILES).size,LOGGING_FILES.length);

for(const obj of [AXE_HITS,AXE_HEAVY,AXE_LIGHT,AXE_BODY,WOOD_CRACKS,TRUNK_GROANS,TREE_FALL_SEQS,TREE_FALL_DEEPS,LOG_THUDS,LOG_THUDS_DEEP,WOOD_CREAKS,CHOP_TAILS,FOREST_AMBIENCE,LOGGING_MIX,LOGGING_SHOTS,LOGGING_LOOPS,LOGGING_FILES]){
 assert.ok(Object.isFrozen(obj),'export is frozen');
}

let totalBytes=0;
for(const f of LOGGING_FILES){
 const p=sndUrl(f);
 assert.ok(fs.existsSync(p),f+'.ogg exists');
 const sz=fs.statSync(p).size;
 const maxBytes=LOOPS.has(f)?320*1024:80*1024;
 assert.ok(sz>1024&&sz<maxBytes,`${f}.ogg size ${sz}B within budget`);
 totalBytes+=sz;
 const b=fs.readFileSync(p),pk=27+b[26];
 assert.equal(b.toString('latin1',0,4),'OggS',f+' Ogg container');
 assert.equal(b[pk+11],1,f+' mono');
 assert.equal(b.readUInt32LE(pk+12),NEW_SET.has(f)?44100:22050,f+' expected sample rate');
}

// Total sound payload in dist/assets/sounds/ under MAX_PAYLOAD_BYTES (10 MB).
const soundDir=new URL('../dist/assets/sounds/',import.meta.url);
const allPayloadBytes=fs.readdirSync(soundDir).filter(f=>f.endsWith('.ogg')).reduce((s,f)=>s+fs.statSync(new URL(f,soundDir)).size,0);
assert.ok(allPayloadBytes<=MAX_PAYLOAD_BYTES,`total sound payload ${allPayloadBytes} B under ${MAX_PAYLOAD_BYTES} B`);

for(const [k,s] of Object.entries(LOGGING_SHOTS)){
 assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.clips),k+' frozen');
 assert.ok(s.level>0&&s.level<=1&&s.jitter>=0,k+' mix/jitter sane');
}
for(const l of Object.values(LOGGING_LOOPS))assert.ok(l.level>0&&l.level<=1);

// Pure picker: deterministic, never repeats lastIndex back-to-back in 200 picks, safe on bad/edge inputs.
assert.equal(pickLoggingClip('nope',-1,0.5),null);
for(const kind of Object.keys(LOGGING_SHOTS)){
 const a=pickLoggingClip(kind,-1,0.37),b=pickLoggingClip(kind,-1,0.37);
 assert.deepEqual(a,b,kind+' deterministic');
 assert.ok(LOGGING_SHOTS[kind].clips.includes(a.file),kind+' returns pool clip');
 const n=LOGGING_SHOTS[kind].clips.length;
 let last=-1;
 for(let i=0;i<200;i++){
  const r=((i*0.61803398875)%1);
  const p=pickLoggingClip(kind,last,r);
  if(n>1)assert.notEqual(p.index,last,`${kind} step ${i} never repeats ${last}`);
  assert.ok(p.rate>0.8&&p.rate<1.2,`${kind} rate ${p.rate} sane`);
  last=p.index;
 }
 if(n>1){
  for(let idx=0;idx<n;idx++){
   const p=pickLoggingClip(kind,idx,0);
   assert.notEqual(p.index,idx,`${kind} rand=0 avoids ${idx}`);
  }
 }
}
assert.ok(pickLoggingClip('axeHit',0,NaN).index>=0);
assert.ok(pickLoggingClip('axeHit',0,1.5).index!==0);
assert.ok(pickLoggingClip('axeHit',0,-0.5).index!==0);

// Size-keyed log thuds (legacy + 4 deep sizes).
const sm=pickLogThud('small',0.2),md=pickLogThud('medium',0.5),hv=pickLogThud('heavy',0.8),fb=pickLogThud('unknown',0.5);
assert.equal(sm.file,'log-thud-small');assert.equal(md.file,'log-thud-medium');assert.equal(hv.file,'log-thud-heavy');
assert.ok(sm.level<md.level&&md.level<hv.level,'log thud level scales with size');
assert.equal(fb.file,'log-thud-medium');assert.equal(fb.size,'medium');
const dxs=pickLogThud('xs',0.1),ds=pickLogThud('s',0.3),dm=pickLogThud('m',0.6),dl=pickLogThud('l',0.9);
assert.equal(dxs.file,'log-thud-xs');assert.equal(dl.file,'log-thud-l');
assert.ok(dxs.level<ds.level&&ds.level<dm.level&&dm.level<dl.level,'deep log thud levels scale xs < s < m < l');

// chopLayers: deterministic, non-repeating in 200 picks, tailDelayMs & tailGain monotonic in depth01, pitch +-6%, gain +-1.5 dB, safe on bad input.
assert.deepEqual(chopLayers('heavy',0.5,0.23,0.71),chopLayers('heavy',0.5,0.23,0.71),'chopLayers deterministic');
for(const k of ['heavy','light','body','axeHit','buckCut']){
 let lastH=-1,lastT=-1;
 for(let i=0;i<200;i++){
  const rA=((i*0.61803398875)%1),rB=((i*0.38196601125)%1);
  const c=chopLayers(k,0.6,rA,rB,lastH,lastT);
  assert.ok(LOGGING_FILES.includes(c.hit),k+' hit in LOGGING_FILES');
  assert.ok(CHOP_TAILS.includes(c.tail),k+' tail in CHOP_TAILS');
  assert.notEqual(c.hitIndex,lastH,`${k} hit never repeats step ${i}`);
  assert.notEqual(c.tailIndex,lastT,`${k} tail never repeats step ${i}`);
  assert.ok(c.pitch>=0.9399&&c.pitch<=1.0601,`${k} pitch ${c.pitch} within +-6%`);
  assert.ok(c.gain>0,'gain positive');
  lastH=c.hitIndex;lastT=c.tailIndex;
 }
}
const c0=chopLayers('heavy',0,0.4,0.6),cMid=chopLayers('heavy',0.5,0.4,0.6),c1=chopLayers('heavy',1,0.4,0.6);
assert.equal(c0.tailDelayMs,120);assert.equal(c1.tailDelayMs,700);
assert.ok(c0.tailDelayMs<cMid.tailDelayMs&&cMid.tailDelayMs<c1.tailDelayMs,'tailDelayMs monotonic in depth01');
assert.ok(c0.tailGain<cMid.tailGain&&cMid.tailGain<c1.tailGain,'tailGain monotonic in depth01');
assert.doesNotThrow(()=>chopLayers('bad',NaN,-5,99));
assert.doesNotThrow(()=>chopLayers(null,undefined,Infinity,'x'));

// fellSequence: ascending atMs, valid clips, deterministic, safe on bad input.
const fs1=fellSequence(0.42),fs2=fellSequence(0.42);
assert.deepEqual(fs1,fs2,'fellSequence deterministic');
assert.equal(fs1.length,4,'creak -> crack -> fall -> thud');
for(let i=0;i<fs1.length;i++){
 assert.ok(LOGGING_FILES.includes(fs1[i].clip),'fellSequence clip valid: '+fs1[i].clip);
 assert.ok(fs1[i].gain>0&&fs1[i].gain<=1,'fellSequence gain sane');
 if(i>0)assert.ok(fs1[i].atMs>fs1[i-1].atMs,'fellSequence atMs strictly ascending');
}
assert.doesNotThrow(()=>fellSequence(NaN));
assert.doesNotThrow(()=>fellSequence(-10));
assert.doesNotThrow(()=>fellSequence(99));

console.log(`PASS logging-sounds.mjs: 50 logging/ambience clips (${(totalBytes/1024).toFixed(1)} KB logging, ${(allPayloadBytes/1e6).toFixed(2)} MB total payload), chopLayers + fellSequence + 200-pick no-repeat verified.`);
