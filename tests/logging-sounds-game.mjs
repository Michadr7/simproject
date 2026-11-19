// logging-sounds-game.mjs: the logging sounds are wired (audio.logging, the forest loop, game.js hooks) and the pure wiring rules behave.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAudio} from '../dist/audio.js';
import {LOGGING_FILES,AXE_HITS,LOG_THUDS,LOGGING_LOOPS,LOGGING_MIX} from '../dist/logging-sounds.js';
import {FOREST,forestProximity,forestTarget,forestLoopGain,forestDuck,createCreakGate,thudSizeForLogs,LOGGING_ONESHOT_FILES,CREAK} from '../dist/logging-wiring.js';

// ---- pure rules
assert.equal(forestProximity(0),1);assert.equal(forestProximity(FOREST.fullM),1);assert.equal(forestProximity(FOREST.stopM),0);assert.equal(forestProximity(Infinity),0);assert.equal(forestProximity(NaN),0);
let prev=1;for(let d=0;d<=60;d+=.5){const p=forestProximity(d);assert.ok(p>=0&&p<=1&&p<=prev+1e-12,'bounded and non-increasing');prev=p}
const st={on:false};
assert.equal(forestTarget(st,FOREST.startM+1,true),0);assert.equal(st.on,false);
assert.ok(forestTarget(st,FOREST.startM-1,true)>0);assert.equal(st.on,true);
assert.ok(forestTarget(st,FOREST.startM+3,true)>=0&&st.on===true,'hysteresis: stays on between start and stop');
assert.equal(forestTarget(st,FOREST.stopM+1,true),0);assert.equal(st.on,false);
st.on=true;assert.equal(forestTarget(st,5,false),0);assert.equal(st.on,false,'indoors stops it');
assert.equal(forestLoopGain(1,1),LOGGING_LOOPS.forestPines.level);assert.equal(forestLoopGain(2,5),LOGGING_LOOPS.forestPines.level);assert.equal(forestLoopGain(-1,1),0);assert.equal(forestLoopGain(NaN,1),0);
assert.ok(forestLoopGain(1,forestDuck({vehicle:true}))<forestLoopGain(1,1));assert.ok(forestLoopGain(1,forestDuck({talking:true}))<forestLoopGain(1,1));assert.equal(forestDuck(),1);
assert.equal(thudSizeForLogs(1),'small');assert.equal(thudSizeForLogs(2),'medium');assert.equal(thudSizeForLogs(5),'heavy');
// creak gate: seeded, same seed = same times, frame-rate independent, quiet away from the forest, never more often than minS
const run=(seed,dt,prox,secs,working)=>{const g=createCreakGate(seed),at=[];let t=0;for(let i=0;i<secs/dt;i++){t+=dt;if(g.tick(dt,prox,working))at.push(+t.toFixed(2))}return at};
assert.deepEqual(run(7,1/60,1,300),run(7,1/60,1,300));
assert.equal(run(7,1/60,.1,300).length,0,'no creaks away from the trees');
const a60=run(7,1/60,1,300),a30=run(7,1/30,1,300);assert.ok(a60.length>=5&&a60.length<=300/CREAK.minS+1);assert.ok(Math.abs(a60.length-a30.length)<=1,'frame rate does not change how often');
for(let i=1;i<a60.length;i++)assert.ok(a60[i]-a60[i-1]>=CREAK.minS-.1,'rare');
assert.ok(run(7,1/60,1,300,true).length>a60.length,'more often while a tree is being worked');
assert.notDeepEqual(run(8,1/60,1,300),a60);
// the one-shot list covers every clip but the loop
assert.equal(LOGGING_ONESHOT_FILES.length,LOGGING_FILES.length-1);assert.ok(!LOGGING_ONESHOT_FILES.includes(LOGGING_LOOPS.forestPines.file));

// ---- audio.logging and the forest loop with a fake Web Audio
const events=[];
const param=name=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(v){events.push([name,+v.toFixed(4)])}});
const node=extra=>({connect(){},disconnect(){},start(){},stop(){},...extra});
class FakeCtx{
 constructor(){this.currentTime=0;this.state='running';this.sampleRate=8000;this.destination=node()}
 resume(){}
 createGain(){return node({gain:param('gain')})}
 createBiquadFilter(){return node({frequency:{value:0},Q:{value:0}})}
 createOscillator(){return node({frequency:{value:0,setValueAtTime(){},setTargetAtTime(){}},setPeriodicWave(){}})}
 createPeriodicWave(){return {}}
 createBuffer(c,n){return {getChannelData:()=>new Float32Array(n),duration:n/8000}}
 createBufferSource(){const s=node({playbackRate:{value:1},buffer:null,loop:false,onended:null});s.start=function(){if(!this.loop)events.push(['shot',this.buffer.name,+this.playbackRate.value.toFixed(4)]);this.onended?.()}; /* the clip ends at once so the voice cap frees */return s}
 decodeAudioData(b){return Promise.resolve({name:b.name,duration:3})}
}
const requested=[];
const fetchFn=async url=>{const name=String(url).split('/').pop().replace(/\.\w+$/,'');requested.push(name);return {ok:true,arrayBuffer:async()=>({name})}};
let r=.1;const rnd=()=>{r=(r*7.13+.37)%1;return r};
const audio=createAudio({AudioContextClass:FakeCtx,storage:{getItem:()=>null,setItem(){}},random:rnd,soundBase:'s/',fetchFn});
assert.ok(audio.unlock());
assert.equal(audio.logging('axeHit',null,null),false,'first call only starts loading');
const settle=async()=>{for(let i=0;i<80;i++)await new Promise(r=>setImmediate(r))};
await settle();
for(const f of LOGGING_ONESHOT_FILES)assert.ok(requested.includes(f),'game asks for the clip '+f);
assert.ok(audio.sounds.has(AXE_HITS[0]));
const hits=[];for(let i=0;i<30;i++){events.length=0;assert.ok(audio.logging('axeHit',null,null));hits.push(events.find(e=>e[0]==='shot')[1])}
for(let i=1;i<hits.length;i++)assert.notEqual(hits[i],hits[i-1],'no back-to-back axe hit');
assert.ok(new Set(hits).size>=4,'uses the variants');
for(const k of ['woodCrack','treeFall','buckCut','woodCreak']){events.length=0;assert.ok(audio.logging(k,null,null,{scale:.5}),k);assert.ok(events.some(e=>e[0]==='shot'))}
for(const [size,file] of Object.entries(LOG_THUDS)){events.length=0;assert.ok(audio.logging('logThud',null,null,{size}));assert.equal(events.find(e=>e[0]==='shot')[1],file)}
assert.equal(audio.logging('woodCreak',{x:500,z:0},{x:0,z:0}),false,'too far to hear');
assert.equal(audio.logging('nonsense',null,null),false);
audio.setMuted(true);assert.equal(audio.logging('axeHit',null,null),false,'muted plays nothing');audio.setMuted(false);
// forest loop: not started at 0, loaded at >0, gain follows the pure function, silent indoors
audio.ambience({outdoors:true,forest:0});audio.ambience({outdoors:true,forest:1});await settle();
events.length=0;audio.ambience({outdoors:true,forest:1,duck:1});
const gains=events.filter(e=>e[0]==='gain').map(e=>e[1]);
assert.ok(gains.includes(forestLoopGain(1,1)),'forest loop at full proximity: '+gains);
events.length=0;audio.ambience({outdoors:true,forest:1,duck:forestDuck({vehicle:true})});assert.ok(events.some(e=>e[1]===forestLoopGain(1,FOREST.duckVehicle)),'ducked under an engine');
events.length=0;audio.ambience({outdoors:false,forest:1});assert.ok(events.some(e=>e[1]===0)&&!events.some(e=>e[1]===forestLoopGain(1,1)),'silent indoors');

// ---- game.js hooks exist (text check: the game cannot run in node)
const g=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
for(const hook of ["audio.logging('axeHit'","audio.logging('woodCrack'","audio.logging('treeFall'","audio.logging('buckCut'","audio.logging('logThud'","audio.logging('woodCreak'","forest:fp","forestTarget(","createCreakGate("])assert.ok(g.includes(hook),'game.js has '+hook);
assert.ok(!g.includes("audio.timber('chop'"),'the old single chop clip is no longer played');
const au=fs.readFileSync(new URL('../dist/audio.js',import.meta.url),'utf8');assert.ok(au.includes('pickLoggingClip(')&&au.includes('LOGGING_ONESHOT_FILES'));
assert.ok(LOGGING_MIX.axeHit>0);
console.log('PASS logging-sounds-game.mjs: audio.logging non-repeating over '+hits.length+' hits, '+LOGGING_ONESHOT_FILES.length+' clips requested, forest loop gain bounded/ducked/silent indoors, seeded creak gate ('+a60.length+' creaks in 300 s), game.js hooks present.');
