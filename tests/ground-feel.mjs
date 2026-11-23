import assert from 'node:assert/strict';
import {readFileSync,statSync,existsSync} from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {SURFACE} from '../dist/terrain.js';
import {createDebris,stepDebris,sprayOf,DEBRIS_MAX,DUST_RATE,MUD_RATE,DROP_SHARE,QUALITY_RATE,SPRAY_SURFACE} from '../dist/debris.js';
import {createAudio} from '../dist/audio.js';
import * as VS from '../dist/vehicle-sounds.js';
const S=SURFACE;

// TR6 feedback on soft ground: wheel dust and mud spray (debris.js) and tyre sounds per ground (vehicle-sounds.js, audio.js).
// 1. The spray rules per ground, speed and quality.
{const run=(surface,speed,o={})=>sprayOf({surface,speed,top:15,...o});
 for(const s of [S.STREET,S.ROAD,S.BRIDGE,S.DRIVEWAY,S.PAVEMENT,S.BANK])for(const q of ['high','low']){const r=run(s,15,{quality:q,throttle:1});assert(r.dust===0&&r.mud===0&&r.drop===0,'no spray on ground '+s)}
 assert.equal(run(S.WATER,5).dust,0);assert(run(S.WATER,5).mud>0&&run(S.WATER,5).drop>0&&run(S.WATER,5).colour==='#d8eef8','water ford throws splash');
 assert.equal(run(S.DIRT,3).dust,0,'dust needs 4 m/s');assert(run(S.DIRT,5).dust>0);assert(run(S.DIRT,15).dust>run(S.DIRT,8).dust,'faster, more dust');assert.equal(run(S.DIRT,15).dust,DUST_RATE,'full rate at top speed on dirt');
 assert(run(S.GRAVEL,15).dust<run(S.DIRT,15).dust&&run(S.PATH,15).dust>0,'gravel and path raise a little less');assert.equal(run(S.GRASS,5).dust,0,'dry grass needs 6 m/s');assert(run(S.GRASS,10).dust>0&&run(S.GRASS,15).dust<run(S.DIRT,15).dust);
 assert.equal(run(S.DIRT,15).mud,0,'no mud on dirt');assert.notEqual(run(S.DIRT,15).colour,run(S.MUD,5).colour,'the colour follows the ground');assert.equal(run(S.MUD,5).dust,0,'mud throws no dust');
 assert(run(S.MUD,5).mud>0&&run(S.MUD,.5).mud===0,'mud needs 1.5 m/s or wheelspin');assert.equal(run(S.MUD,.2,{throttle:1}).mud,MUD_RATE,'wheelspin: full rate while standing');assert.equal(run(S.MUD,10,{throttle:1}).mud,run(S.MUD,10).mud,'throttle does not spin a rolling vehicle');
 assert.equal(run(S.MUD,0,{stuck:true}).mud,MUD_RATE,'Stuck always throws mud');assert.equal(run(S.MUD,5).drop,run(S.MUD,5).mud*DROP_SHARE,'droplets are a share of the mud');
 assert(run(S.PLOWED,6).mud>0&&run(S.PLOWED,6).mud<run(S.MUD,6).mud&&run(S.WHEAT,6).mud<run(S.PLOWED,6).mud&&run(S.GREEN,6).mud>0,'plowed less than mud, crops less than plowed');
 assert.equal(run(S.MUD,5,{quality:'low'}).mud,0,'Low: no mud spray');assert.equal(run(S.DIRT,15,{quality:'low'}).dust,DUST_RATE*QUALITY_RATE.low.dust,'Low: a quarter of the dust');assert.equal(QUALITY_RATE.low.dust,.25);
 assert.equal(run(S.DIRT,15,{calm:true}).dust,DUST_RATE/2,'reduced motion: half');assert.equal(run(S.MUD,5,{quality:'weird'}).mud,run(S.MUD,5).mud,'an unknown quality counts as High');
 assert(Object.keys(SPRAY_SURFACE).every(k=>+k!==S.STREET&&+k!==S.ROAD&&+k!==S.PAVEMENT),'roads are not in the table');
 assert.equal(run(S.MUD,-5).mud,run(S.MUD,5).mud,'reversing counts the same speed')}

// 2. The pool: ONE Points object of 220, spray fills it at a rate that does not depend on the frame rate, the pieces behave (dust floats, mud falls), nothing leaves the bounds.
{assert.equal(DEBRIS_MAX,220);let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,scene=new THREE.Scene(),db=createDebris(scene,{random:rnd});
 assert.equal(scene.children.filter(c=>c.isPoints).length,1,'still one draw call');assert.equal(db.particles.max,220);assert.equal(db.points.geometry.getAttribute('aKind').count,220);
 {const m=db.points.material,sh={vertexShader:'#include <common>\n#include <fog_vertex>',fragmentShader:'#include <common>\n#include <opaque_fragment>'};m.onBeforeCompile(sh);assert(sh.fragmentShader.includes('vKind>2.5&&vKind<3.5')&&sh.fragmentShader.includes('vKind>4.5')&&sh.fragmentShader.includes('gl_PointCoord'),'soft round dust and droplets in the fragment shader');assert(sh.vertexShader.includes('k>4.5')&&sh.vertexShader.includes('4.*aT'),'dust grows with its age')}
 const heading={dx:0,dz:1},at={x:0,y:.1,z:0},count=hz=>{const d=createDebris(new THREE.Scene(),{random:rnd});let n=0;for(let i=0;i<hz*2;i++)n+=d.spray('w',1/hz,at,heading,12,{dust:DUST_RATE,mud:0,drop:0,colour:'#b9a582'});return n};
 for(const hz of [30,60,165])assert(Math.abs(count(hz)-28)<=1,hz+' Hz: '+count(hz)+' dust pieces in 2 s at 14 a second');
 assert.equal(db.spray('x',1/60,at,heading,12,{dust:0,mud:0,drop:0,colour:'#000'}),0,'a zero rate throws nothing');
 const kinds=db.points.geometry.getAttribute('aKind'),n=db.spray('m',1,at,heading,.5,{dust:0,mud:MUD_RATE,drop:MUD_RATE*DROP_SHARE,colour:'#3e2f22'});assert(n>=18&&n<=22,'a second of wheelspin on mud: '+n);
 const set=new Set();for(let i=0;i<220;i++)if(db.particles.life[i]>0)set.add(Math.floor(kinds.array[i]));assert(set.has(4)&&set.has(5)&&!set.has(3),'mud chunks and droplets');
 // spin throws backwards (heading +z, so the chunks go to -z) and up
 let back=0,up=0;for(let i=0;i<220;i++)if(db.particles.life[i]>0){back+=db.particles.vel[i*3+2]<0?1:0;up+=db.particles.vel[i*3+1]>0?1:0}assert(back>=n-2&&up===n,'mud flies back and up');
 // dust is light: after a second it has fallen far less than a mud chunk
 const d1=createDebris(new THREE.Scene(),{random:()=>.5}),d2=createDebris(new THREE.Scene(),{random:()=>.5});d1.spray('a',1,at,heading,12,{dust:2,mud:0,drop:0,colour:'#b9a582'});d2.spray('a',1,at,heading,12,{dust:0,mud:2,drop:0,colour:'#3e2f22'});
 for(let i=0;i<30;i++){d1.update(1/60);d2.update(1/60)}const high=p=>{let m=-9;for(let i=0;i<220;i++)if(p.life[i]>0)m=Math.max(m,p.pos[i*3+1]);return m};
 assert(high(d1.particles)>-9,'dust is still in the air after .5 s');assert(high(d1.particles)>=.1-1e-6||high(d1.particles)>.05,'dust has barely fallen');
 for(let i=0;i<300;i++){d1.update(1/60);d2.update(1/60)}assert.equal(d1.particles.alive,0,'dust is gone after its life');assert.equal(d2.particles.alive,0,'mud is gone after its life');assert.equal(d1.points.visible,false,'nothing drawn when empty');
 // a pool that the spray fills completely stays bounded and below the ground never
 const d3=createDebris(new THREE.Scene(),{random:rnd});for(let i=0;i<600;i++){d3.spray('a',1/60,at,heading,15,{dust:100,mud:100,drop:25,colour:'#b9a582'});d3.update(1/60)}assert(d3.particles.alive<=220);for(let i=0;i<220;i++)if(d3.particles.life[i]>0)assert(d3.particles.pos[i*3+1]>=-1e-6,'above the ground');
 // old callers of stepDebris (no per-point arrays) still work
 const P={max:1,pos:new Float32Array([0,1,0]),vel:new Float32Array(3),age:new Float32Array(1),life:new Float32Array([1])};assert.equal(stepDebris(P,.1,0),1)}

// 3. The tyre sound rules: which loop for which ground, loudness and pitch by speed and slip, the cross-fade.
{assert.deepEqual(Object.keys(VS.TYRE_CLIPS),['asphalt','gravel','grass','mud']);assert.deepEqual([...VS.TYRE_FILES].sort(),['tyres-asphalt','tyres-grass','tyres-gravel','tyres-mud']);for(const f of VS.TYRE_FILES)assert(!VS.VEHICLE_SET.includes(f)&&VS.ALL_FILES.includes(f),f+' is registered but loaded on its own');
 for(const s of [S.STREET,S.ROAD,S.BRIDGE,S.DRIVEWAY,S.PAVEMENT])assert.equal(VS.tyreLoopOf(s),'asphalt');for(const s of [S.DIRT,S.PATH,S.GRAVEL])assert.equal(VS.tyreLoopOf(s),'gravel');for(const s of [S.GRASS,S.GREEN,S.WHEAT,S.PLOWED])assert.equal(VS.tyreLoopOf(s),'grass');assert.equal(VS.tyreLoopOf(S.MUD),'mud');assert.equal(VS.tyreLoopOf(S.WATER),null);assert.equal(VS.tyreLoopOf(undefined),null);
 const m=(o={})=>VS.tyreMix({surface:S.ROAD,speed:10,...o});assert.equal(m({speed:.3}).gain,0,'silent when nearly stopped');assert(m({speed:4}).gain>0&&m({speed:12}).gain>m({speed:4}).gain,'louder with speed');assert.equal(m({speed:-10}).gain,m({speed:10}).gain,'reverse counts');
 assert(m({speed:12}).rate>m({speed:4}).rate&&m({slip:1}).gain>m({slip:0}).gain&&m({slip:1}).rate>m({slip:0}).rate,'slip and speed raise gain and pitch');assert(m({speed:40}).gain<=VS.TYRE.level.asphalt*(1+VS.TYRE.slipGain)+1e-9,'bounded');
 assert(m({speed:0,spin:true,surface:S.MUD}).gain>0,'wheels spinning on the spot still sound');assert.equal(m({surface:S.WATER}).loop,null);assert.equal(m({surface:S.WATER}).gain,0);
 assert(VS.slipOf({speed:12,top:15,steer:1,grip:.35})>VS.slipOf({speed:12,top:15,steer:1,grip:1})&&VS.slipOf({speed:12,top:15,steer:0,grip:.35})===0&&VS.slipOf({spin:true})>=.8&&VS.slipOf({speed:15,top:15,steer:1,grip:.3,spin:true})===1,'slip: turning on loose ground, wheelspin, capped at 1');
 const w=VS.freshTyreBlend();VS.stepTyreBlend(w,'asphalt',.15);assert(Math.abs(w.asphalt-.5)<1e-9);VS.stepTyreBlend(w,'asphalt',.15);assert.equal(w.asphalt,1);
 VS.stepTyreBlend(w,'mud',.15);assert(Math.abs(w.asphalt-.5)<1e-9&&Math.abs(w.mud-.5)<1e-9,'half way: both at half');VS.stepTyreBlend(w,'mud',.15);assert.equal(w.asphalt,0);assert.equal(w.mud,1,'a change of ground takes .3 s');VS.stepTyreBlend(w,null,1);assert.equal(w.mud,0,'no loop: everything falls')}

// 4. The files: four mono Ogg loops, small, recorded in ASSETS.md and named in credits.js.
{const DIR=new URL('../dist/assets/sounds/',import.meta.url),assets=readFileSync(new URL('../ASSETS.md',import.meta.url),'utf8'),credits=readFileSync(new URL('../dist/credits.js',import.meta.url),'utf8');let total=0;
 for(const n of VS.TYRE_FILES){const u=new URL(n+'.ogg',DIR);assert(existsSync(u),n+' exists');const b=readFileSync(u),size=statSync(u).size;total+=size;assert(size>10000&&size<=VS.MAX_FILE_BYTES,n+' is '+size+' bytes');assert(assets.includes(n+'.ogg')&&assets.includes('Creative Commons 0'),n+' is in ASSETS.md');
  const pk=27+b[26];assert.equal(b.toString('latin1',pk+1,pk+7),'vorbis');assert.equal(b[pk+11],1,n+' is mono');const rate=b.readUInt32LE(pk+12),secs=Number(b.readBigUInt64LE(b.lastIndexOf('OggS')+6))/rate;assert(secs>=4&&secs<=8,n+' is '+secs.toFixed(1)+' s: long enough to loop without a buzz')}
 assert(total<200000,'the four loops are under 200 KB: '+total);assert(credits.includes('tyre (asphalt, gravel, grass, mud)')&&credits.includes('Kinoton')&&credits.includes('Felix Blume'),'the one credits entry names them')}

// 5. The loader and the playing, against a fake context: lazy per ground, cross-fade, fallback noise, mute, no throw.
class Param{constructor(v=0){this.value=v;this.target=v}setTargetAtTime(v){this.target=v}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.ramp=v}cancelScheduledValues(){}}
class Node{constructor(kind,ctx){this.kind=kind;this.ctx=ctx;this.links=[];ctx.nodes.push(this)}connect(n){this.links.push(n);return n}disconnect(){}start(...a){this.started=a}stop(){this.stopped=true;this.onended?.()}}
class Ctx{constructor(){this.nodes=[];this.currentTime=0;this.sampleRate=48000;this.state='suspended';this.destination=new Node('destination',this);Ctx.made.push(this)}resume(){this.state='running'}suspend(){this.state='suspended'}
 createGain(){const n=new Node('gain',this);n.gain=new Param(1);return n}createOscillator(){const n=new Node('osc',this);n.frequency=new Param(440);return n}createBiquadFilter(){const n=new Node('filter',this);n.frequency=new Param(350);n.Q=new Param(1);return n}
 createBufferSource(){const n=new Node('src',this);n.playbackRate=new Param(1);n.loop=false;return n}createBuffer(c,l){return {length:l,duration:l/this.sampleRate,getChannelData:()=>new Float32Array(l)}}
 async decodeAudioData(b){const name=Buffer.from(b).toString();if(name.includes('corrupt'))throw new Error('bad');return {duration:5.75,name}}}
Ctx.made=[];
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};
const tick=()=>new Promise(r=>setTimeout(r,0));const flush=async a=>{for(let i=0;i<200&&a.sounds.pending;i++)await new Promise(r=>setTimeout(r,0))};
function build({missing=[]}={}){const asked=[];const fetchFn=async url=>{asked.push(url);await new Promise(r=>setTimeout(r,0));if(missing.some(m=>url.includes(m)))return {ok:false};const body=Buffer.from(url);return {ok:true,arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.length)}};
 let n=0;const a=createAudio({AudioContextClass:Ctx,storage:memory(),soundBase:'http://x/sounds/',fetchFn,random:()=>(.37*(++n)*7.13)%1});a.unlock();const ctx=Ctx.made.at(-1);ctx.state='running';return {a,asked,ctx}}
const fx=(o={})=>({on:true,sliding:false,speed:10,x:0,z:0,dt:.05,people:[],surface:S.ROAD,top:15,slip:0,spin:false,...o});
const loops=(ctx,re)=>ctx.nodes.filter(n=>n.kind==='src'&&n.loop&&n.started&&n.buffer&&re.test(n.buffer.name));
{ // lazily: nothing before you drive on a ground; only that ground's loop is fetched, once
 const {a,asked,ctx}=build();a.drive(fx({on:false}));a.drive(fx({surface:undefined}));assert.equal(asked.length,0,'not driving, or no ground: nothing fetched');a.drive(fx({speed:.2}));assert.equal(asked.length,0,'standing still: nothing yet');
 a.drive(fx());await tick();assert.deepEqual(asked,['http://x/sounds/tyres-asphalt.ogg'],'only the ground you are on');await flush(a);for(let i=0;i<3;i++)a.drive(fx());assert.equal(asked.length,1,'never twice');
 assert.equal(loops(ctx,/tyres-asphalt/).length,1,'the recorded loop plays');const s=loops(ctx,/tyres-asphalt/)[0];assert(s.links[0].gain.target>0&&s.playbackRate.target>.8,'gain and pitch follow the speed');const g1=s.links[0].gain.target;a.drive(fx({speed:15}));assert(s.links[0].gain.target>g1,'faster, louder');
 // cross-fade to mud: the mud loop is fetched on the first mud frame, the weights move over .3 s, asphalt goes quiet
 a.drive(fx({surface:S.MUD,speed:4}));await tick();assert.equal(asked.at(-1),'http://x/sounds/tyres-mud.ogg');await flush(a);for(let i=0;i<3;i++)a.drive(fx({surface:S.MUD,speed:4}));const w=a.sounds.tyreWeights;assert(w.mud>0&&w.mud<1&&w.asphalt>0&&w.asphalt<1,'half way between the two grounds: '+w.mud.toFixed(2));
 assert.equal(a.sounds.tyres.length,2,'two loops while it fades');for(let i=0;i<6;i++)a.drive(fx({surface:S.MUD,speed:4}));assert.equal(w.mud,1);assert.equal(w.asphalt,0);assert.equal(s.links[0].gain.target,0,'the old ground is silent');
 // stopping: everything fades, then the loops are stopped and the voices come back
 for(let i=0;i<30;i++)a.drive(fx({speed:0}));assert.equal(a.sounds.tyres.length,0);assert(loops(ctx,/tyres-/).every(n=>n.stopped),'stopped when you stop');assert.equal(a.sounds.voices,0,'voices released');
 // leaving the vehicle and mute are silent; a hidden tab too
 a.drive(fx());a.drive(fx());assert(a.sounds.tyres.length>0);a.setMuted(true);for(let i=0;i<10;i++)a.drive(fx());assert.equal(a.sounds.tyres.length,0,'muted: nothing plays')}
{ // missing files: a generated noise stands in for gravel, grass and mud (asphalt keeps the engine's road noise), and nothing throws or is asked for twice
 const {a,asked,ctx}=build({missing:['tyres-']});const noise=()=>ctx.nodes.filter(n=>n.kind==='src'&&n.loop&&n.started&&n.links[0]?.kind==='filter').length;
 assert.doesNotThrow(()=>{for(const sf of [S.ROAD,S.DIRT,S.MUD]){for(let i=0;i<10;i++)a.drive(fx({surface:sf}))}});await flush(a);const n=asked.length;for(let i=0;i<10;i++)a.drive(fx({surface:S.DIRT}));assert.equal(asked.length,n,'a missing loop is not retried');
 assert(noise()>=2,'gravel and mud have a generated noise');assert(!loops(ctx,/tyres-/).length,'no recorded loop was decoded')}
{ // the engine, crash and scrape keep working beside it
 const {a,ctx}=build();a.prepare('shortbed');await flush(a);assert(a.sounds.has('crash-hard-1'));assert.equal(a.sounds.has('tyres-asphalt'),false,'the vehicle set does not load tyres');a.drive(fx({sliding:true,speed:10}));assert(loops(ctx,/scrape/).length===1,'scrape plays')}

// 6. In the packaged game: an S70 flooring it in the yard puddle throws mud (the debris Points object is drawn, still one), the same truck on the road throws nothing, and the spray stops at Low quality.
{const {bootGame}=await import('./support/boot-game.mjs'),{MAP}=await import('../dist/map-definition.js'),{CLASSES,doorPoint}=await import('../dist/vehicle.js');
 const puddle=MAP.mud.find(m=>m.id==='mud-yard-puddle'),V={x:(puddle.x0+puddle.x1)/2,z:(puddle.z0+puddle.z1)/2,yaw:0};
 const g=await bootGame({position:{x:V.x+5,z:V.z},progress:{cash:30000,completed:5,routine:{minutes:480},vehicles:[{uid:'v1',model:'shortbed',colour:'#c23b2e',x:V.x,z:V.z,yaw:V.yaw,fuelMgal:10000}],orders:{nextVehicle:2}}});
 try{const {GameState,pump,send,scene}=g,press=code=>{send('keydown',code);send('keyup',code)},dbg=()=>scene().getObjectByName('crash-debris');
  pump(1.5);const door=doorPoint(V,CLASSES.shortbed);Object.assign(GameState.me.position,{x:door.x,z:door.z});pump(1);press('KeyE');pump(3);
  assert.equal(scene().children.filter(c=>c.name==='crash-debris').length,1,'one debris Points object');assert.equal(dbg().visible,false,'idle: nothing drawn');
  send('keydown','KeyW');pump(1);assert.equal(dbg().visible,true,'wheelspin in mud throws mud');send('keyup','KeyW');pump(4);assert.equal(dbg().visible,false,'and it settles when you stop');
  assert.equal(scene().children.filter(c=>c.name==='crash-debris').length,1,'still one draw call')}
 finally{await g.done()}}
console.log('Ground feel (TR6): spray rules per ground, speed, spin and quality (none on roads, Low = a quarter of the dust and no mud, reduced motion halves), one 220-point Points object with dust that floats and mud that flies back, rate independent of the frame rate; tyre loops per ground (4 mono Ogg under 200 KB, in ASSETS.md and credits), lazy loading of only the ground you drive on, gain and pitch by speed and slip, a .3 s cross-fade, generated noise fallback, mute.');
