import assert from 'node:assert/strict';
import {AUDIO_KEY,NEAR,HEARING,MAX_CLICKS,attenuate,loadAudioSettings,saveAudioSettings,createAudio,engineVoice} from '../dist/audio.js';

// Sound is generated with Web Audio: the rules (how loud, how far, what is saved) are checked here with a fake AudioContext that records the nodes.
class Param{constructor(v=0){this.value=v;this.target=v}setTargetAtTime(v){this.target=v}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.ramp=v}}
class Node{constructor(kind,ctx){this.kind=kind;this.connections=[];ctx.nodes.push(this)}connect(n){this.connections.push(n);return n}start(){this.started=true}stop(){this.stopped=true}}
class FakeContext{
 constructor(){this.nodes=[];this.currentTime=0;this.sampleRate=100;this.state='suspended';this.destination=new Node('destination',this);FakeContext.made.push(this)}
 resume(){this.state='running'}suspend(){this.state='suspended'}
 createGain(){const n=new Node('gain',this);n.gain=new Param(1);return n}
 createOscillator(){const n=new Node('osc',this);n.frequency=new Param(440);n.type='sine';return n}
 createBiquadFilter(){const n=new Node('filter',this);n.frequency=new Param(350);n.Q=new Param(1);n.type='lowpass';return n}
 createBufferSource(){const n=new Node('src',this);n.buffer=null;n.loop=false;return n}
 createBuffer(channels,length){return {length,getChannelData:()=>new Float32Array(length)}}
}
FakeContext.made=[];
const memory=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};

// Distance: full volume close, smoothly down to nothing at 40 m, never negative or above 1.
assert.equal(attenuate(0),1);assert.equal(attenuate(NEAR),1);assert.equal(attenuate(HEARING),0);assert.equal(attenuate(500),0);
{let last=1;for(let d=NEAR;d<=HEARING;d+=.5){const a=attenuate(d);assert(a<=last+1e-12&&a>=0,'falls steadily');last=a}assert(attenuate(10)>attenuate(20)&&attenuate(20)>attenuate(35));assert(attenuate(20)>0&&attenuate(20)<1)}
// Settings: defaults, clamped, survive bad data and blocked storage.
assert.deepEqual(loadAudioSettings(memory()),{volume:.6,muted:false});
{const s=memory();assert(saveAudioSettings(s,{volume:.35,muted:true}));assert.deepEqual(loadAudioSettings(s),{volume:.35,muted:true});s.m.set(AUDIO_KEY,'{"volume":9,"muted":"yes"}');assert.deepEqual(loadAudioSettings(s),{volume:1,muted:false},'clamped, and only true mutes');s.m.set(AUDIO_KEY,'{"volume":"loud"}');assert.equal(loadAudioSettings(s).volume,.6);s.m.set(AUDIO_KEY,'nope');assert.deepEqual(loadAudioSettings(s),{volume:.6,muted:false})}
assert.equal(saveAudioSettings({setItem(){throw new Error('blocked')}},{volume:.5,muted:false}),false);assert.deepEqual(loadAudioSettings({getItem(){throw new Error('blocked')}}),{volume:.6,muted:false});

// No Web Audio (or before the first click): nothing is created and nothing throws.
{const a=createAudio({AudioContextClass:undefined,storage:memory()});assert.equal(a.unlock(),false);assert.equal(a.ready,false);a.update({listener:{x:0,z:0},blade:{at:{x:0,z:0},level:1,sawing:true},belt:{at:{x:0,z:0},level:1}});assert.equal(a.click({x:0,z:0},{x:0,z:0}),false);a.setActive(true)}
{const before=FakeContext.made.length,a=createAudio({AudioContextClass:FakeContext,storage:memory()});assert.equal(FakeContext.made.length,before,'no context until the first click or key');assert.equal(a.ready,false)}

// Unlocking: one context, resumed, the master gain follows the volume; a second click does not build another.
const storage=memory(),audio=createAudio({AudioContextClass:FakeContext,storage});
assert(audio.unlock());const ctx=FakeContext.made.at(-1),gains=()=>ctx.nodes.filter(n=>n.kind==='gain'),master=()=>gains()[0];
assert.equal(ctx.state,'running');assert(audio.ready);assert(Math.abs(master().gain.value-.36)<1e-9,'volume 0.6 squared');
const built=ctx.nodes.length;audio.unlock();assert.equal(ctx.nodes.length,built,'unlock twice builds once');assert.equal(FakeContext.made.at(-1),ctx);
assert.equal(ctx.nodes.filter(n=>n.kind==='osc'||n.kind==='src').filter(n=>n.started).length,10,'blade tone, blade hiss, belt rumble, belt hum, fuel rush, fuel hum, the engine (two tones and a throb) and road noise are running');
audio.setMuted(true);assert.equal(master().gain.target,0);assert.equal(loadAudioSettings(storage).muted,true);audio.setMuted(false);assert(master().gain.target>0);
audio.setVolume(.5);assert.equal(master().gain.target,.25);assert.equal(loadAudioSettings(storage).volume,.5);audio.setVolume(5);assert.equal(audio.settings.volume,1);audio.setVolume(NaN);assert.equal(audio.settings.volume,1,'not a number: unchanged');audio.setVolume(.6);
ctx.state='running';audio.setActive(false);assert.equal(ctx.state,'suspended','a hidden tab is silent');audio.setActive(true);assert.equal(ctx.state,'running');

// The blade and the belt follow their speed and the distance. gains(): master, blade tone, blade hiss, belt rumble, belt hum.
const here={x:100,z:-278},mid={x:115,z:-278},far={x:150,z:-278},at={x:104,z:-278};
const update=(listener,blade,belt)=>audio.update({listener,blade:{at,...blade},belt:{at,...belt}});
update(here,{level:0,sawing:false},{level:0});assert.deepEqual(gains().slice(1,5).map(g=>g.gain.target),[0,0,0,0],'a stopped saw and belt are silent');
update(here,{level:1,sawing:false},{level:0});const idle=gains()[1].gain.target,idleHiss=gains()[2].gain.target;assert(idle>0&&idleHiss>0&&gains()[3].gain.target===0);
update(here,{level:1,sawing:true},{level:0});assert(gains()[2].gain.target>idleHiss*4,'a log in the blade hisses much louder');assert(gains()[1].gain.target<idle,'and the note sags under load');
const osc=ctx.nodes.filter(n=>n.kind==='osc')[0];update(here,{level:0,sawing:false},{level:0});const low=osc.frequency.target;update(here,{level:1,sawing:false},{level:0});assert(osc.frequency.target>low*2,'the pitch rises with the blade speed');
update(mid,{level:1,sawing:false},{level:0});assert(gains()[1].gain.target<idle&&gains()[1].gain.target>0,'quieter at 15 m');update(far,{level:1,sawing:true},{level:1});assert.deepEqual(gains().slice(1,5).map(g=>g.gain.target),[0,0,0,0],'silent beyond 40 m');
update(here,{level:0,sawing:false},{level:1});assert(gains()[3].gain.target>0&&gains()[4].gain.target>0&&gains()[1].gain.target===0,'the belt hums when it runs');
// Fuel: a rush of noise and a low hum while it flows, near only, the pitch rising as the tank fills; a two-note chime when it is full (or low and flat when you cannot pay), sharing the click limit.
{const rush=()=>gains()[5].gain.target,hum=()=>gains()[6].gain.target,band=ctx.nodes.filter(n=>n.kind==='filter').at(-1)&&ctx.nodes.filter(n=>n.kind==='filter').find(n=>n.frequency.target===600||n.frequency.value===600),pump={x:100,z:-270};
 audio.fuel({listener:here,at:pump,level:0,fullness:0});assert.equal(rush(),0,'nothing flows: silent');
 audio.fuel({listener:here,at:pump,level:1,fullness:0});const flowing=rush();assert(flowing>0&&hum()>0,'fuel flowing is heard close by');
 audio.fuel({listener:{x:100,z:-240},at:pump,level:1,fullness:0});assert(rush()<flowing&&rush()>0,'quieter 30 m away');audio.fuel({listener:{x:100,z:-200},at:pump,level:1,fullness:0});assert.equal(rush(),0,'silent beyond 40 m');
 audio.fuel({listener:here,at:null,level:1,fullness:0});assert.equal(rush(),0,'no pump, no sound');
 const filters=ctx.nodes.filter(n=>n.kind==='filter');const fuelBand=filters.find(n=>n.frequency.value===600);audio.fuel({listener:here,at:pump,level:1,fullness:0});const empty=fuelBand.frequency.target;audio.fuel({listener:here,at:pump,level:1,fullness:1});assert(fuelBand.frequency.target>empty*1.5,'the pitch rises as the tank fills');
 audio.fuel({listener:here,at:pump,level:0,fullness:1});
 const before=ctx.nodes.length;assert.equal(audio.chime(pump,here),true,'the full chime plays near');assert(ctx.nodes.length>before);assert.equal(audio.chime(pump,far),false,'too far to hear');
 const oscs=ctx.nodes.filter(n=>n.kind==='osc').slice(-2);assert.deepEqual(oscs.map(o=>o.frequency.value),[880,1320],'two rising notes');
 oscs.at(-1).onended();assert.equal(audio.chime(pump,here,{ok:false}),true);const bad=ctx.nodes.filter(n=>n.kind==='osc').slice(-2);assert.deepEqual(bad.map(o=>o.frequency.value),[330,247],'two falling low notes when you cannot pay');bad.at(-1).onended()}
// Drinking from the cooler: a pour and three falling gulps, near only, counted with the clicks.
{const o0=ctx.nodes.filter(n=>n.kind==='osc').length;assert.equal(audio.drink(at,far),false,'too far to hear');assert.equal(audio.drink(at,here),true);const gulps=ctx.nodes.filter(n=>n.kind==='osc').slice(o0);assert.equal(gulps.length,3,'three gulps');gulps.at(-1).onended();}
// The lever click: one-shot, near only, at most three at once, never while muted.
const nodesBefore=ctx.nodes.length;assert.equal(audio.click(at,here),true);assert(ctx.nodes.length>nodesBefore);const srcs=ctx.nodes.filter(n=>n.kind==='src'&&n.onended);assert.equal(srcs.length,1);
assert.equal(audio.click(at,far),false,'too far to hear');assert.equal(audio.click(at,here),true);assert.equal(audio.click(at,here),true);assert.equal(audio.click(at,here),false,'three at once is the limit');assert.equal(MAX_CLICKS,3);
srcs[0].onended();assert.equal(audio.click(at,here),true,'a finished click frees a place');
audio.setMuted(true);assert.equal(audio.click(at,here),false,'muted');
// Engines: the pure voice (revs climb through four gears and drop at the shift; cheaper tiers are lower and rougher), and the nodes follow it; the key turn is heard near only.
{const E=(speed,o={})=>engineVoice({speed,top:10,throttle:1,tier:'low',...o});
 assert.equal(E(0,{running:false}).gain,0,'an engine that is off is silent');assert(E(0).gain>0&&E(0).gear===0,'idling is audible, in first gear');
 assert(E(1.5).freq>E(0).freq&&E(1.9).freq>E(1.5).freq,'the revs climb inside a gear');assert(E(2.1).gear===1&&E(2.1).freq<E(1.99).freq,'and drop at the shift to the next gear');assert(E(10).gear===3&&E(10).rpm<=1.0001,'top speed is the last gear');
 assert(E(4,{tier:'low'}).freq<E(4,{tier:'mid'}).freq&&E(4,{tier:'mid'}).freq<E(4,{tier:'high'}).freq,'better tiers sound higher');assert(E(4,{tier:'low'}).rough>E(4,{tier:'high'}).rough,'and smoother');
 assert(E(4,{throttle:1}).gain>E(4,{throttle:0}).gain,'throttle is louder than coasting');assert(E(0).road===0&&E(10).road===1,'road noise grows with speed');
 const a=createAudio({AudioContextClass:FakeContext,storage:memory()});a.unlock();const ctx2=FakeContext.made.at(-1),oscs=()=>ctx2.nodes.filter(n=>n.kind==='osc');
 a.engine(E(0,{running:false}));assert(ctx2.nodes.filter(n=>n.kind==='gain').every(g=>g.gain.target<=1),'engine call is safe when off');
 const voice=E(5);a.engine(voice);assert(oscs().some(o=>Math.abs(o.frequency.target-voice.freq)<1e-9),'the engine oscillator follows the voice');
 assert.equal(a.ignition({x:0,z:0},{x:0,z:0},{tier:'low'}),true,'the key turn is heard beside you');assert.equal(a.ignition({x:0,z:0},{x:80,z:0}),false,'and not from 80 m away')}
console.log('Audio: distance falloff (full within 2.5 m, silent beyond 40 m), saved volume and mute, one context built on the first click, blade pitch and hiss follow speed and load, the belt hums only while it runs, the lever click is limited to three at once, fuel flows with a rising pitch and chimes when full.');
