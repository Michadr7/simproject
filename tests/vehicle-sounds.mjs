import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {createAudio} from '../dist/audio.js';
import {CLASSES} from '../dist/vehicle.js';
import * as VS from '../dist/vehicle-sounds.js';

// SND1: the recorded vehicle, crash and yell sounds. Node cannot decode audio, so the rules are tested pure (which clip, how loud, when a walker yells, the voice caps), the files are checked on disk
// (registered, small, licensed in ASSETS.md) and the loader is run against a fake AudioContext (lazy, one at a time, a missing file falls back to the generated sound).
const DIR=new URL('../dist/assets/sounds/',import.meta.url);

// Registry integrity: every class has a loop, every file exists and is small, nothing unregistered ships, the total is under the cap, each file is listed in ASSETS.md.
assert.deepEqual(Object.keys(VS.ENGINES).sort(),Object.keys(CLASSES).sort(),'one engine loop per drivable class');
for(const e of Object.values(VS.ENGINES))assert(e.rate[0]>0&&e.rate[1]>e.rate[0],'the rate rises with the revs');
assert.equal(new Set(VS.ALL_FILES).size,VS.ALL_FILES.length,'no file named twice');
const onDisk=readdirSync(DIR).filter(f=>f.endsWith(VS.SOUND_EXT)),assets=readFileSync(new URL('../ASSETS.md',import.meta.url),'utf8');
let total=0;
for(const name of VS.ALL_FILES){const file=name+VS.SOUND_EXT,u=new URL(file,DIR);assert(existsSync(u),`${file} exists in dist/assets/sounds`);const size=statSync(u).size;total+=size;assert(size>1000&&size<=VS.MAX_FILE_BYTES,`${file} is ${size} bytes (cap ${VS.MAX_FILE_BYTES})`);assert(assets.includes(file),`${file} is recorded in ASSETS.md (source, author, licence)`)}
assert(total<=VS.MAX_PAYLOAD_BYTES,`payload ${total} bytes under ${VS.MAX_PAYLOAD_BYTES}`);
for(const f of onDisk)assert(VS.ALL_FILES.includes(f.slice(0,-VS.SOUND_EXT.length)),`${f} is registered`);
// Ogg Vorbis header: mono, and the yells and cranks are the right length (the last page's granule position over the sample rate).
function oggInfo(name){const b=readFileSync(new URL(name+VS.SOUND_EXT,DIR));assert.equal(b.toString('latin1',0,4),'OggS',name+' is an Ogg file');const segs=b[26],pk=27+segs;assert.equal(b.toString('latin1',pk+1,pk+7),'vorbis',name+' is Vorbis');const channels=b[pk+11],rate=b.readUInt32LE(pk+12);let at=b.lastIndexOf('OggS');const gran=Number(b.readBigUInt64LE(at+6));return {channels,rate,seconds:gran/rate}}
for(const name of VS.ALL_FILES){const i=oggInfo(name);assert.equal(i.channels,1,name+' is mono');assert(i.seconds>.1&&i.seconds<12,`${name} is ${i.seconds.toFixed(2)} s`)}
for(const name of VS.YELL_CLIPS)assert(oggInfo(name).seconds<VS.YELL_MAX_SECONDS,`${name} is under ${VS.YELL_MAX_SECONDS} s`);
for(const e of Object.values(VS.ENGINES))assert(oggInfo(e.file).seconds>=4,`${e.file} is a loop long enough not to buzz`);
// Decoded memory (4 bytes a sample at the context rate, 48 kHz assumed): all the clips, and the worst single engine.
{let mb=0;for(const n of VS.VEHICLE_SET)mb+=oggInfo(n).seconds*48000*4/1e6;const eng=Math.max(...Object.values(VS.ENGINES).map(e=>oggInfo(e.file).seconds*48000*4/1e6));assert(mb+eng<25,`decoded ${(mb+eng).toFixed(1)} MB (one engine + the shared set) under 25 MB`)}

// Which crash sounds: light under 8 m/s, medium to 14, hard above; a person is a soft thud and a yell and no crunch; glass only when the vehicle ends Damaged or worse.
assert.equal(VS.tierOf(5),'light');assert.equal(VS.tierOf(8),'medium');assert.equal(VS.tierOf(13.9),'medium');assert.equal(VS.tierOf(14),'hard');assert.equal(VS.tierOf(-20),'hard');assert.equal(VS.tierOf(undefined),'light');
{const w=VS.crashPlan({impact:20,kind:'world',bandTo:'fine',changed:false});assert.equal(w.tier,'hard');assert(w.crunch.pool===VS.CRASH_CLIPS.hard&&w.glass===null&&!w.yell&&w.thud===null,'a hard wall hit on a Fine vehicle: crunch only');
 const g=VS.crashPlan({impact:20,kind:'world',bandTo:'damaged',changed:true});assert(g.glass&&g.glass.pool===VS.GLASS_CLIPS,'glass when the hit takes it to Damaged');
 assert.equal(VS.crashPlan({impact:6,kind:'world',bandTo:'limping',changed:false}).glass,null,'a small hit on an already bad vehicle adds no glass');
 assert(VS.crashPlan({impact:15,kind:'vehicle',bandTo:'wrecked',changed:false}).glass,'a hard hit on a wrecked one does');
 const p=VS.crashPlan({impact:9,kind:'person',bandTo:'fine'});assert(p.person&&p.yell&&p.crunch===null&&p.glass===null&&p.thud.pool===VS.PERSON_CLIPS,'a person: thud and yell');
 const v=VS.crashPlan({impact:12,kind:'vehicle',bandTo:'fine'}),m=VS.crashPlan({impact:12,kind:'world',bandTo:'fine'});assert(v.crunch.gain>m.crunch.gain,'car on car is a touch louder');
 assert(VS.crashPlan({impact:30,kind:'world'}).crunch.gain<=1.05&&VS.crashPlan({impact:4.1,kind:'world'}).crunch.gain>.4)}
// Variation: never the same pick twice in a row.
{const r=[.1,.1,.1,.1,.9];let k=0,last=-1;const rnd=()=>r[k++%r.length];for(let n=0;n<12;n++){const i=VS.pickIndex(4,rnd,last);assert(i>=0&&i<4&&i!==last);last=i}assert.equal(VS.pickIndex(1,()=>.9),0);assert.equal(VS.pickIndex(4,()=>1),3,'random()=1 stays in range')}
// Yell volume falls with distance; zero at the radius.
assert.equal(VS.yellVolume(0),1);assert(VS.yellVolume(1)>VS.yellVolume(2)&&VS.yellVolume(2)>VS.yellVolume(3.5));assert.equal(VS.yellVolume(4),0);assert.equal(VS.yellVolume(9),0);assert(VS.yellVolume(3.99)>=.25);
// The gate: faster than 4 m/s, within 4 m, 8 s per person, nearest first, and a reused result object.
{const gate=VS.createYellGate(),P=(name,x,z)=>({name,group:{position:{x,z}}}),people=[P('Alex',3,0),P('Sophie',1.5,0),P('Robert',30,0)];
 assert.equal(gate.scan(0,0,0,3.9,people),null,'too slow');assert.equal(gate.scan(0,0,0,-4.5,[P('far',4.5,0)]),null,'too far (reverse counts as speed)');
 const a=gate.scan(10,0,0,6,people);assert.equal(a.id,'Sophie','the nearest first');assert(Math.abs(a.vol-VS.yellVolume(1.5))<1e-9);
 const b=gate.scan(10.1,0,0,6,people);assert.equal(b.id,'Alex');assert.equal(b,a,'the result object is reused');assert.equal(gate.scan(10.2,0,0,6,people),null,'both have yelled');
 assert.equal(gate.scan(17.9,0,0,6,people),null,'cooldown 8 s');assert.equal(gate.scan(18.1,0,0,6,people).id,'Sophie','after the cooldown');
 gate.force(30,'Robert');assert.equal(gate.scan(31,29,0,6,[P('Robert',30,0)]),null,'a hit walker starts the cooldown too');assert.equal(gate.scan(0,0,0,6,null),null)}
// The voice caps: 12 at once, 2 of them yells.
{const v=VS.createVoices();assert(v.take(true)&&v.take(true));assert.equal(v.take(true),false,'a third yell');for(let i=0;i<10;i++)assert(v.take());assert.equal(v.take(),false,'a 13th voice');assert.equal(v.total,12);v.free(true);assert(v.take(true));v.free();v.free();v.free();assert.equal(v.total,9);for(let i=0;i<30;i++)v.free(true);assert.equal(v.total,0);assert.equal(v.yells,0)}
// Scrape: silent when slow, louder and higher when fast.
assert.equal(VS.scrapeGain(1),0);assert(VS.scrapeGain(5)>0&&VS.scrapeGain(15)>VS.scrapeGain(5)&&VS.scrapeGain(40)<=VS.SCRAPE.maxGain+1e-9);assert(VS.scrapeRate(14)>VS.scrapeRate(3));

// ---- the loader and the playing, against a fake context ----
class Param{constructor(v=0){this.value=v;this.target=v}setTargetAtTime(v){this.target=v}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.ramp=v}}
class Node{constructor(kind,ctx){this.kind=kind;this.ctx=ctx;this.links=[];ctx.nodes.push(this)}connect(n){this.links.push(n);return n}disconnect(){}start(...a){this.started=a}stop(){this.stopped=true;this.onended?.()}}
class Ctx{
 constructor(){this.nodes=[];this.currentTime=0;this.sampleRate=48000;this.state='suspended';this.destination=new Node('destination',this);Ctx.made.push(this)}
 resume(){this.state='running'}suspend(){this.state='suspended'}
 createGain(){const n=new Node('gain',this);n.gain=new Param(1);return n}
 createOscillator(){const n=new Node('osc',this);n.frequency=new Param(440);return n}
 createBiquadFilter(){const n=new Node('filter',this);n.frequency=new Param(350);n.Q=new Param(1);return n}
 createBufferSource(){const n=new Node('src',this);n.playbackRate=new Param(1);n.loop=false;return n}
 createBuffer(c,l){return {length:l,duration:l/this.sampleRate,getChannelData:()=>new Float32Array(l)}}
 async decodeAudioData(b){const name=Buffer.from(b).toString();if(name.includes('corrupt'))throw new Error('bad data');return {duration:3,name}}
}
Ctx.made=[];
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};
const flush=async(a)=>{for(let i=0;i<200&&a.sounds.pending;i++)await new Promise(r=>setTimeout(r,0))};
function build({missing=[],corrupt=[],seed=.37}={}){
 const asked=[];let inflight=0,maxInflight=0;
 const fetchFn=async url=>{asked.push(url);inflight++;maxInflight=Math.max(maxInflight,inflight);await new Promise(r=>setTimeout(r,0));inflight--;if(missing.some(m=>url.includes(m)))return {ok:false};const body=Buffer.from(corrupt.some(m=>url.includes(m))?'corrupt '+url:url);return {ok:true,arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.length)}};
 let n=0;const a=createAudio({AudioContextClass:Ctx,storage:memory(),soundBase:'http://x/sounds/',fetchFn,random:()=>(seed*(++n)*7.13)%1});
 return {a,asked,stats:()=>({maxInflight})};
}
const voice=(o={})=>({freq:30,gain:.3,lowpass:400,rough:.2,rpm:.5,gear:1,road:.3,misfire:false,...o});
// Nothing is fetched before the first gesture, nor at startup; no sound folder means no fetch at all.
{const {a,asked}=build();a.prepare('shortbed');a.crash({impact:10,kind:'world'});a.engine(voice(),'shortbed');assert.equal(asked.length,0,'no context, no fetch');assert(a.unlock());assert.equal(asked.length,0,'unlocking loads nothing: the vehicle sounds wait for a vehicle')}
{const asked=[];const a=createAudio({AudioContextClass:Ctx,storage:memory(),fetchFn:async u=>{asked.push(u);return {ok:false}}});a.unlock();a.prepare('shortbed');a.engine(voice(),'shortbed');assert.equal(asked.length,0,'without a soundBase nothing is fetched and nothing throws')}
// Getting into a vehicle: its own engine loop first, then the shared set, one fetch at a time, each file once, never another class's engine.
{const {a,asked,stats}=build();a.unlock();a.prepare('worktruck');await flush(a);assert.equal(asked[0],'http://x/sounds/eng-worktruck.ogg','the engine of that class goes first');assert.equal(asked.length,1+VS.VEHICLE_SET.length);assert.equal(stats().maxInflight,1,'one file at a time');assert(!asked.some(u=>u.includes('eng-flatbed')||u.includes('eng-s70')),'other engines stay unloaded');
 a.prepare('worktruck');a.prepare('flatbed');await flush(a);assert.equal(asked.filter(u=>u.includes('eng-worktruck')).length,1,'never fetched twice');assert.equal(asked.length,2+VS.VEHICLE_SET.length,'only the new class adds a file');assert(a.sounds.has('eng-flatbed')&&a.sounds.has('crash-hard-1'))}
// Engine: the generated tone until the loop is decoded, then the loop (rate follows the revs, load opens the filter, the generated tone goes silent), the misfire dip and roughness ride on the loop; leaving the vehicle stops it.
{const {a}=build();a.unlock();const ctx=Ctx.made.at(-1);ctx.state='running';const gains=()=>ctx.nodes.filter(n=>n.kind==='gain');
 a.engine(voice({gain:.3}),'offroad');const srcsBefore=ctx.nodes.filter(n=>n.kind==='src'&&n.started&&n.loop).length;assert.equal(a.sounds.engine,null,'not decoded yet: the generated engine plays');await flush(a);
 a.engine(voice({gain:.3,rpm:.1}),'offroad');assert.equal(a.sounds.engine,'offroad');const loop=ctx.nodes.filter(n=>n.kind==='src'&&n.started&&n.loop).at(-1);assert(loop.buffer?loop.buffer.name.includes('eng-offroad'):true);
 const low=loop.playbackRate.target;a.engine(voice({gain:.3,rpm:1}),'offroad');assert(loop.playbackRate.target>low*1.5,'revs raise the pitch');const hi=loop.playbackRate.target;
 a.engine(voice({gain:.3,rpm:1,misfire:true,gain:.045}),'offroad');assert(loop.playbackRate.target<hi,'a misfire dips the pitch');
 a.engine(voice({gain:0,rpm:0}),'offroad');assert.equal(loop.links[0].frequency.target>0,true);const lp=loop.links[0],g=lp.links[0];assert.equal(g.gain.target,0,'engine off: silent');
 a.engine(voice(),'flatbed');assert.equal(a.sounds.engine,null,'another class: the old loop is dropped until its own is decoded');await flush(a);a.engine(voice(),'flatbed');assert.equal(a.sounds.engine,'flatbed');a.engine(voice(),null);assert.equal(a.sounds.engine,null,'out of the vehicle: stopped')}
// Missing or corrupt files: nothing throws, the generated sounds stay, nothing is retried.
{const {a,asked}=build({missing:['eng-s70','crash-hard','yell-'],corrupt:['stall']});a.unlock();const ctx=Ctx.made.at(-1);ctx.state='running';a.prepare('shortbed');await flush(a);const n=asked.length;
 for(let i=0;i<5;i++)a.engine(voice(),'shortbed');assert.equal(a.sounds.engine,null,'the loop is missing: the generated engine');
 assert.doesNotThrow(()=>{a.crash({impact:20,kind:'world',bandTo:'damaged',changed:true});a.crash({impact:5,kind:'person'});a.stall();a.drive({on:true,sliding:true,speed:10,x:0,z:0,dt:.016,people:[{name:'A',group:{position:{x:1,z:0}}}]})});
 assert.equal(asked.length,n,'a failed file is not asked for again');assert(a.sounds.has('crash-medium-1')&&!a.sounds.has('crash-hard-1')&&!a.sounds.has('stall'),'the others still load');
 const thumps=ctx.nodes.filter(x=>x.kind==='osc'&&x.started).length;assert(thumps>=1,'a hard crash with no clip decoded uses the generated thump')}
// Crashes play the right pool; voices are capped and released; a hidden tab and mute are silent.
{const {a}=build();a.unlock();const ctx=Ctx.made.at(-1);ctx.state='running';a.prepare('shortbed');await flush(a);
 const shots=()=>ctx.nodes.filter(n=>n.kind==='src'&&n.buffer&&n.started);
 assert(a.crash({impact:18,kind:'world',bandTo:'damaged',changed:true}));const names=shots().map(s=>s.buffer.name);assert(names.some(n=>/crash-hard-\d/.test(n)),'hard crunch');assert(names.some(n=>/glass-\d/.test(n)),'and glass');
 const before=shots().length;a.crash({impact:5,kind:'person'});const added=shots().slice(before).map(s=>s.buffer.name);assert(added.some(n=>/thud-person/.test(n))&&added.some(n=>/yell-/.test(n)),'a person hit: a thud and a yell');assert(!added.some(n=>/crash-/.test(n)));
 shots().forEach(s=>s.stop());assert.equal(a.sounds.voices,0,'voices are released when clips end');
 for(let i=0;i<20;i++)a.crash({impact:18,kind:'world',bandTo:'damaged',changed:true});assert(a.sounds.voices<=12,'never more than 12 voices');
 shots().forEach(s=>s.stop());ctx.state='suspended';const b4=shots().length;a.crash({impact:18,kind:'world'});assert.equal(shots().length,b4,'a hidden tab plays nothing');ctx.state='running';a.setMuted(true);a.crash({impact:18,kind:'world'});assert.equal(shots().length,b4,'muted: nothing')}
// Yells while driving past: at most 2 at once, one per walker per 8 s, quieter when further; none when slow.
{const {a}=build();a.unlock();const ctx=Ctx.made.at(-1);ctx.state='running';a.prepare('shortbed');await flush(a);
 const people=[0,1,2,3].map(i=>({name:'p'+i,group:{position:{x:1+i*.2,z:0}}})),fx={on:true,sliding:false,speed:8,x:0,z:0,dt:.016,people},yells=()=>ctx.nodes.filter(n=>n.kind==='src'&&n.buffer&&n.started&&/yell-/.test(n.buffer.name));
 a.drive({...fx,speed:3});assert.equal(yells().length,0,'under 4 m/s: quiet');
 for(let i=0;i<4;i++)a.drive(fx);assert.equal(yells().length,2,'four walkers in range, two voices');assert.equal(a.sounds.yells,2);
 yells().forEach(s=>s.stop());assert.equal(a.sounds.yells,0);for(let i=0;i<10;i++)a.drive(fx);assert.equal(yells().length,4,'a walker the cap blocked keeps its turn: all four yelled once');
 yells().forEach(s=>s.stop());for(let i=0;i<20;i++)a.drive(fx);assert.equal(yells().length,4,'nobody yells twice inside the cooldown');
 const gains=yells().map(s=>s.links[0].gain.value);assert(gains[0]>gains[3],'the nearer walker is louder')}
// Scrape: starts when sliding fast, follows the speed, one loop at a time, stops after the slide.
{const {a}=build();a.unlock();const ctx=Ctx.made.at(-1);ctx.state='running';a.prepare('shortbed');await flush(a);const fx={on:true,sliding:true,speed:10,x:0,z:0,dt:.016,people:[]},loops=()=>ctx.nodes.filter(n=>n.kind==='src'&&n.loop&&n.buffer&&/scrape/.test(n.buffer.name));
 a.drive({...fx,speed:1});assert.equal(loops().length,0,'too slow to scrape');a.drive(fx);assert.equal(loops().length,1);const s=loops()[0];a.drive({...fx,speed:14});assert.equal(loops().length,1,'one scrape loop');assert(s.links[0].gain.target>0&&s.playbackRate.target>.9);
 a.drive({...fx,sliding:false});assert.equal(s.stopped,undefined,'it fades first');for(let i=0;i<40;i++)a.drive({...fx,sliding:false});assert.equal(s.stopped,true,'then stops');const v0=a.sounds.voices;assert.equal(v0,0)}
// Ignition and stall use the recorded clips when decoded (the crank loops for as long as the starter turns), the generated ones otherwise.
{const {a}=build();a.unlock();const ctx=Ctx.made.at(-1);ctx.state='running';const before=ctx.nodes.filter(n=>n.kind==='osc').length;a.stall();a.ignition({x:0,z:0},{x:0,z:0},{seconds:1.2});assert(ctx.nodes.filter(n=>n.kind==='osc').length>before,'not decoded: generated');
 a.prepare('shortbed');await flush(a);const oscs=ctx.nodes.filter(n=>n.kind==='osc').length;assert(a.ignition({x:0,z:0},{x:0,z:0},{seconds:2.5}));const crank=ctx.nodes.filter(n=>n.kind==='src'&&n.loop&&n.buffer?.name?.includes('start-crank')).at(-1);assert(crank&&crank.started[0]===0,'the recorded starter loop plays');assert(a.stall());assert.equal(ctx.nodes.filter(n=>n.kind==='osc').length,oscs,'recorded clips: no new oscillators');assert.equal(a.ignition({x:0,z:0},{x:90,z:0}),false)}
console.log('Vehicle sounds: every class has an engine loop and every file is registered, mono Ogg under the size cap with the payload under 2 MB and decoded memory under 25 MB, yells under 1.2 s, all listed in ASSETS.md; crash tier by impact (light, medium, hard), glass at Damaged or worse, a person is a thud and a yell; the yell gate (4 m/s, 4 m, 8 s each, nearest first, 2 voices) and the 12-voice cap; the loader fetches nothing before a vehicle, one file at a time, its own engine first, never twice; a missing or corrupt file keeps the generated sound; engine rate follows the revs, misfire dips, hidden tab and mute are silent.');
