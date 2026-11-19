// logging-sounds.mjs: tests for dist/logging-sounds.js (21 CC0 logging/ambience clips, mono 22.05 kHz Ogg Vorbis, pure non-repeating picker & size-keyed thuds).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 AXE_HITS,WOOD_CRACKS,TREE_FALL_SEQS,LOG_THUDS,WOOD_CREAKS,FOREST_AMBIENCE,
 LOGGING_MIX,LOGGING_SHOTS,LOGGING_LOOPS,LOGGING_FILES,pickLoggingClip,pickLogThud
} from '../dist/logging-sounds.js';

const sndUrl=f=>new URL('../dist/assets/sounds/'+f+'.ogg',import.meta.url);

assert.equal(AXE_HITS.length,6,'6 axe-hit variants');
assert.equal(WOOD_CRACKS.length,3,'3 wood-crack layers');
assert.equal(TREE_FALL_SEQS.length,2,'2 tree-fall sequences');
assert.deepEqual(Object.keys(LOG_THUDS),['small','medium','heavy']);
assert.equal(WOOD_CREAKS.length,6,'6 wood-creak one-shots');
assert.equal(FOREST_AMBIENCE.pines,'amb-forest-pines');
assert.equal(LOGGING_FILES.length,21,'21 unique logging/ambience clips');
assert.equal(new Set(LOGGING_FILES).size,LOGGING_FILES.length);

for(const obj of [AXE_HITS,WOOD_CRACKS,TREE_FALL_SEQS,LOG_THUDS,WOOD_CREAKS,FOREST_AMBIENCE,LOGGING_MIX,LOGGING_SHOTS,LOGGING_LOOPS,LOGGING_FILES]){
 assert.ok(Object.isFrozen(obj),'export is frozen');
}

let totalBytes=0;
for(const f of LOGGING_FILES){
 const p=sndUrl(f);
 assert.ok(fs.existsSync(p),f+'.ogg exists');
 const sz=fs.statSync(p).size;
 const maxBytes=f==='amb-forest-pines'?400*1024:80*1024;
 assert.ok(sz>1024&&sz<maxBytes,`${f}.ogg size ${sz}B within budget`);
 totalBytes+=sz;
 const b=fs.readFileSync(p),pk=27+b[26];
 assert.equal(b.toString('latin1',0,4),'OggS',f+' Ogg container');
 assert.equal(b[pk+11],1,f+' mono');
 assert.equal(b.readUInt32LE(pk+12),22050,f+' 22.05 kHz');
}

for(const [k,s] of Object.entries(LOGGING_SHOTS)){
 assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.clips),k+' frozen');
 assert.ok(s.level>0&&s.level<=1&&s.jitter>=0,k+' mix/jitter sane');
}
assert.ok(LOGGING_LOOPS.forestPines.level>0&&LOGGING_LOOPS.forestPines.level<=1);

// Pure picker: deterministic, never repeats lastIndex back-to-back, safe on bad/edge inputs.
assert.equal(pickLoggingClip('nope',-1,0.5),null);
for(const kind of Object.keys(LOGGING_SHOTS)){
 const a=pickLoggingClip(kind,-1,0.37),b=pickLoggingClip(kind,-1,0.37);
 assert.deepEqual(a,b,kind+' deterministic');
 assert.ok(LOGGING_SHOTS[kind].clips.includes(a.file),kind+' returns pool clip');
 const n=LOGGING_SHOTS[kind].clips.length;
 let last=-1;
 for(let i=0;i<20;i++){
  const r=((i*0.61803398875)%1);
  const p=pickLoggingClip(kind,last,r);
  if(n>1)assert.notEqual(p.index,last,`${kind} step ${i} never repeats ${last}`);
  assert.ok(p.rate>0.8&&p.rate<1.2,`${kind} rate ${p.rate} sane`);
  last=p.index;
 }
 // Even with constant rand=0, never repeats lastIndex when n > 1.
 if(n>1){
  for(let idx=0;idx<n;idx++){
   const p=pickLoggingClip(kind,idx,0);
   assert.notEqual(p.index,idx,`${kind} rand=0 avoids ${idx}`);
  }
 }
}
// Out-of-range/NaN rand clamps safely.
assert.ok(pickLoggingClip('axeHit',0,NaN).index>=0);
assert.ok(pickLoggingClip('axeHit',0,1.5).index!==0);
assert.ok(pickLoggingClip('axeHit',0,-0.5).index!==0);

// Size-keyed log thuds.
const sm=pickLogThud('small',0.2),md=pickLogThud('medium',0.5),hv=pickLogThud('heavy',0.8),fb=pickLogThud('unknown',0.5);
assert.equal(sm.file,'log-thud-small');assert.equal(md.file,'log-thud-medium');assert.equal(hv.file,'log-thud-heavy');
assert.ok(sm.level<md.level&&md.level<hv.level,'log thud level scales with size');
assert.equal(fb.file,'log-thud-medium');assert.equal(fb.size,'medium');

console.log(`PASS logging-sounds.mjs: 21 CC0 logging/ambience clips (${(totalBytes/1024).toFixed(1)} KB total, mono 22.05 kHz Ogg), non-repeating pickLoggingClip + pickLogThud verified.`);
