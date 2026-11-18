import './legacy-keys.js';
import {bandOf,misfiring} from './damage.js';
import {PHONE_CLIPS} from './phone-calls.js'; // PH1: the Call app's sounds (lazy, fallback tones)
import {SOUND_EXT,CRANK_CLIP,STALL_CLIP,VEHICLE_SET,YELL_CLIPS,SCRAPE_CLIPS,engineFor,crashPlan,pickIndex,createYellGate,createVoices,scrapeGain,scrapeRate,TYRE,TYRE_CLIPS,tyreMix,stepTyreBlend,freshTyreBlend} from './vehicle-sounds.js';import {TIMBER_SHOTS,TIMBER_FILES,CHAINSAW,SAWMILL_BLADE} from './timber-sounds.js';import {STEP_CLIPS,STEP_LEVEL,SWEEP_SHOTS,SWEEP_LOOPS,SWEEP_CORE,stepKind} from './sweep-sounds.js'; // SND1: recorded vehicle, crash and yell sounds (optional: the generated sounds stay as the fallback)
const PHONE_LEVEL={key:.45,pickup:.7,ring:.5,busy:.5,hangup:.7}; // PH1: levels of the recorded phone clips
const PHONE_TONES={key:{f:[697,1209],on:.09,per:.09,n:1,lv:.12},ring:{f:[440,480],on:1.8,per:2,n:1,lv:.1},busy:{f:[480,620],on:.5,per:1,n:6,lv:.1},pickup:{click:1800},hangup:{click:900}}; // the generated fallbacks (Hz)
// Sound, generated with the Web Audio API (no sound files). One AudioContext, created on the first click or key (browsers do not allow sound before one); a master volume and a mute that are saved;
// at most three sounds at once: the blade, the belt and the lever click. Every sound is placed in the world: it is loudest within NEAR metres and silent beyond HEARING metres of the player.
// Mono on purpose (no panning yet). Nothing here runs unless a source is near enough to hear.
export const AUDIO_KEY='edenridge.audio.v1',NEAR=2.5,HEARING=40,MAX_CLICKS=3;

// How much of a sound reaches the player at `distance` metres: 1 up close, falling off smoothly to 0 at HEARING.
export const attenuate=d=>d<=NEAR?1:d>=HEARING?0:Math.pow(1-(d-NEAR)/(HEARING-NEAR),2);
// A vehicle's engine voice, pure (tested): what the engine sounds like at a speed. speed and top in m/s; throttle 0..1; tier 'low' | 'mid' | 'high'.
// Four gears: the revs climb through each gear and drop at the shift. Cheaper tiers are lower, rougher and louder; better ones higher and smoother.
// (0.35 retry) a truck is low and thumping, not buzzy: the tone is a train of sharp pulses (the firing strokes: the idle is about 22 pulses a second for the old truck), softened by a low-pass that
// stays low, with a strong lope (the throb) in the rough ones. The pulse rate is `freq`.
const ENGINE_TIERS={low:{base:22,gain:.34,rough:.8,lowpass:240},mid:{base:24,gain:.3,rough:.6,lowpass:300},high:{base:28,gain:.26,rough:.3,lowpass:380}};
const GEARS=[0,.2,.42,.68,1.0001],SAMPLE_GAIN=3.5; // SAMPLE_GAIN: the recorded loop sits at -20 dBFS rms; voice.gain (about .16 to .33) times this is its level
// (VD3) cond (0..1000) and time (seconds, a running clock) add the damage: a rougher throb by band (damage.js: +0.1 Worn, +0.25 Damaged, +0.4 Limping) and a misfire, a 0.12 s dip in level and pitch every 1.7 s (Damaged) or 0.8 s (Limping) on a fixed phase of the clock.
export function engineVoice({speed=0,top=10,throttle=0,tier='low',running=true,cond=1000,time=0}={}){
 const t=ENGINE_TIERS[tier]||ENGINE_TIERS.low;if(!running)return {freq:t.base,gain:0,lowpass:t.lowpass,rough:t.rough,rpm:0,gear:0,road:0};
 const ratio=Math.max(0,Math.min(1,Math.abs(speed)/Math.max(.1,top)));let gear=0;while(gear<3&&ratio>=GEARS[gear+1])gear++;
 const p=(ratio-GEARS[gear])/(GEARS[gear+1]-GEARS[gear]),rpm=gear===0?.12+.88*p:.42+.58*p,load=Math.max(0,Math.min(1,throttle));
 const miss=misfiring(cond,time);return {freq:t.base*(1+rpm*2.1)*(miss?.78:1),gain:t.gain*(.55+.3*load+.25*rpm)*(miss?.15:1),lowpass:t.lowpass+rpm*600+load*250,rough:+(t.rough+bandOf(cond).rough).toFixed(2),rpm,gear,road:Math.min(1,ratio*1.3),misfire:miss};
}
export function loadAudioSettings(storage){
 try{const v=JSON.parse(storage.getItem(AUDIO_KEY)||'null');return {volume:Number.isFinite(v?.volume)?Math.max(0,Math.min(1,v.volume)):.6,muted:v?.muted===true}}catch{return {volume:.6,muted:false}}
}
export function saveAudioSettings(storage,settings){try{storage.setItem(AUDIO_KEY,JSON.stringify({volume:+settings.volume.toFixed(2),muted:!!settings.muted}));return true}catch{return false}}

// AudioContextClass: window.AudioContext (or a fake in tests); storage: {getItem,setItem}.
// soundBase: the folder URL of the recorded sounds (vehicle-sounds.js), or null for none (tests); fetchFn: fetch, replaceable in tests.
export function createAudio({AudioContextClass,storage,random=Math.random,sampleUrl=null,soundBase=null,fetchFn=globalThis.fetch?globalThis.fetch.bind(globalThis):null}){
 const settings=loadAudioSettings(storage);
 let ctx=null,master=null,v=null,clicks=0,drinkSample=null;
 // Recorded drink (assets/sounds/water_drink.wav). Fetched once the context exists; until it arrives, or if it fails, drink() uses the synthesized one.
 function loadDrinkSample(){if(!sampleUrl||typeof fetch!=='function'||!ctx)return;fetch(sampleUrl).then(r=>r.ok?r.arrayBuffer():null).then(b=>b?ctx.decodeAudioData(b):null).then(buf=>{if(buf)drinkSample=buf}).catch(()=>{})}
 const loudness=()=>settings.muted?0:settings.volume*settings.volume; // volume feels linear when squared
 const ease=(param,value,k=.06)=>param.setTargetAtTime(value,ctx.currentTime,k);
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function noise(){const length=ctx.sampleRate*2,buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=random()*2-1;return buffer}
 function filtered(kind,frequency,q=.7){const f=ctx.createBiquadFilter();f.type=kind;f.frequency.value=frequency;f.Q.value=q;return f}
 function looping(buffer){const s=ctx.createBufferSource();s.buffer=buffer;s.loop=true;return s}
 function gain(value=0){const g=ctx.createGain();g.gain.value=value;return g}
 function build(){
  master=gain(loudness());master.connect(ctx.destination);const buffer=noise();
  // The blade: a sawtooth whine that rises with its speed and sags under load, with a hiss that grows when it is cutting.
  const bladeTone=ctx.createOscillator();bladeTone.type='sawtooth';bladeTone.frequency.value=140;const bladeLow=filtered('lowpass',1100),bladeToneGain=gain(),bladeHiss=looping(buffer),bladeBand=filtered('bandpass',2400,.8),bladeHissGain=gain();
  bladeTone.connect(bladeLow);bladeLow.connect(bladeToneGain);bladeToneGain.connect(master);bladeHiss.connect(bladeBand);bladeBand.connect(bladeHissGain);bladeHissGain.connect(master);
  // The belt: a low rumble of filtered noise with a soft 50 Hz hum under it.
  const beltRumble=looping(buffer),beltLow=filtered('lowpass',240,.5),beltRumbleGain=gain(),beltHum=ctx.createOscillator();beltHum.type='sine';beltHum.frequency.value=50;const beltHumGain=gain();
  beltRumble.connect(beltLow);beltLow.connect(beltRumbleGain);beltRumbleGain.connect(master);beltHum.connect(beltHumGain);beltHumGain.connect(master);
  // Fuel flowing: a filtered rush of noise whose pitch climbs as the tank fills (the cavity gets smaller), over a low pump hum.
  const fuelRush=looping(buffer),fuelBand=filtered('bandpass',600,.9),fuelRushGain=gain(),fuelHum=ctx.createOscillator();fuelHum.type='triangle';fuelHum.frequency.value=92;const fuelHumGain=gain();
  fuelRush.connect(fuelBand);fuelBand.connect(fuelRushGain);fuelRushGain.connect(master);fuelHum.connect(fuelHumGain);fuelHumGain.connect(master);
  // The engine of the vehicle you are in: a sawtooth with a sub-octave triangle through a low-pass that opens with the revs, a throb for rough engines, and road noise that grows with speed.
  const engSaw=ctx.createOscillator();engSaw.type='sawtooth';engSaw.frequency.value=22;const engSub=ctx.createOscillator();engSub.type='triangle';engSub.frequency.value=11;
  if(ctx.createPeriodicWave){const n=40,real=new Float32Array(n),imag=new Float32Array(n);for(let i=1;i<n;i++)real[i]=1/Math.pow(i,.55);engSaw.setPeriodicWave(ctx.createPeriodicWave(real,imag))} // cosines add up to a sharp pulse, not a saw
  const engLow=filtered('lowpass',240,1.4),engGain=gain(),engThrob=ctx.createOscillator();engThrob.type='sine';engThrob.frequency.value=9;const engThrobDepth=gain(0);
  engSaw.connect(engLow);engSub.connect(engLow);engLow.connect(engGain);engGain.connect(master);engThrob.connect(engThrobDepth);engThrobDepth.connect(engGain.gain);
  const road=looping(buffer),roadBand=filtered('bandpass',420,.6),roadGain=gain();road.connect(roadBand);roadBand.connect(roadGain);roadGain.connect(master);
  for(const node of [bladeTone,bladeHiss,beltRumble,beltHum,fuelRush,fuelHum,engSaw,engSub,engThrob,road])node.start();
  v={bladeTone,bladeLow,bladeToneGain,bladeBand,bladeHissGain,beltRumbleGain,beltHumGain,fuelBand,fuelRushGain,fuelHumGain,engSaw,engSub,engLow,engGain,engThrob,engThrobDepth,roadBand,roadGain,buffer};
 }
 // SND1: the recorded sounds (vehicle-sounds.js). Fetched and decoded one at a time, only after the first gesture and only when a vehicle is used (the engine loop of its class, then one shared set of about 35 short clips);
 // a file that is missing or will not decode is skipped for good and the generated sound stays. Decoded memory is about 11 MB for everything (4 engines are never loaded together: one per class used).
 const buffers=new Map(),wanted=new Set(),queue=[],voices=createVoices(),gate=createYellGate(),last={crash:-1,yell:-1,glass:-1,thud:-1,scrape:-1,chop:-1,fall:-1,logDrop:-1,plankDrop:-1};
 let busy=false,eng=null,scr=null,scrIdle=0,yellClock=0;
 function pump(){if(busy||!queue.length||!ctx)return;busy=true;const name=queue.shift();
  Promise.resolve().then(()=>fetchFn(soundBase+name+SOUND_EXT)).then(r=>r&&r.ok?r.arrayBuffer():null).then(b=>b?ctx.decodeAudioData(b):null).then(buf=>{if(buf)buffers.set(name,buf)}).catch(()=>{}).then(()=>{busy=false;pump()})}
 function want(names){if(!soundBase||!ctx||typeof fetchFn!=='function')return;for(const n of names)if(n&&!buffers.has(n)&&!wanted.has(n)){wanted.add(n);queue.push(n)}pump()}
 const live=()=>!!ctx&&ctx.state==='running'&&!settings.muted; // a hidden tab (suspended context) plays nothing
 // One recorded clip through the master gain, within the voice cap (12 at once, 2 of them yells).
 function shot(name,level,{rate=1,delay=0,yell=false}={}){
  const b=buffers.get(name);if(!b||!live()||!voices.take(yell))return false;
  const s=ctx.createBufferSource(),g=gain(level);s.buffer=b;s.playbackRate.value=rate;s.connect(g);g.connect(master);s.onended=()=>{voices.free(yell);s.disconnect?.();g.disconnect?.()};s.start(ctx.currentTime+delay);return true;
 }
 // A generated thump for a crash when no recorded clip is decoded yet (a noise burst under a falling sine).
 function thump(level,hard){
  if(!live()||!v||!voices.take())return false;
  const t=ctx.currentTime,src=ctx.createBufferSource(),low=filtered('lowpass',hard?900:500,.7),env=gain(0),o=ctx.createOscillator();src.buffer=v.buffer;o.type='sine';o.frequency.setValueAtTime(hard?90:70,t);o.frequency.setTargetAtTime(32,t,.06);
  env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(level,t+.004);env.gain.setTargetAtTime(.0001,t+.02,hard?.12:.07);src.connect(low);low.connect(env);o.connect(env);env.connect(master);
  src.start(t,random()*1.5);src.stop(t+.5);o.start(t);o.stop(t+.5);src.onended=()=>voices.free();return true;
 }
 // Lumber (timber-sounds.js, SND2): the clips are fetched the first time one is asked for. A loop that is not decoded yet simply stays silent (the generated blade stays until the recorded one is ready).
 const tim={warm:false,amb:{},fuel:null,fork:{},csOn:false,csAt:0,csA:0,idle:null,cut:null,stopT:0,mill:null,lvl:0};
 function loopOf(name){const b=buffers.get(name);if(!b||!ctx)return null;const s=looping(b),g=gain(0);s.connect(g);g.connect(master);s.start(ctx.currentTime,random()*b.duration);return {s,g}}
 function stopLoop(l){if(!l)return;try{l.s.stop()}catch{}l.s.disconnect?.();l.g.disconnect?.()}
 function pickShot(pool,slot,level,opts){const n=pool.length,i=pickIndex(n,random,last[slot]);last[slot]=i;for(let k=0;k<n;k++)if(shot(pool[(i+k)%n],level,opts))return true;return false}
 function yell(vol){if(!(vol>.02)||!live())return false;want(YELL_CLIPS);return pickShot(YELL_CLIPS,'yell',.8*vol,{rate:.95+random()*.12,yell:true})}
 function startEngine(cls,buf){const s=looping(buf),lp=filtered('lowpass',1500,.5),g=gain(0),d=gain(0);s.connect(lp);lp.connect(g);g.connect(master);v.engThrob.connect(d);d.connect(g.gain);s.start(ctx.currentTime,random()*buf.duration);eng={cls,src:s,lp,g,depth:d}}
 function stopEngine(){if(!eng)return;try{eng.src.stop()}catch{}try{v.engThrob.disconnect(eng.depth)}catch{}try{eng.g.disconnect()}catch{}eng=null}
 // Sliding along a wall: a looped scrape (one of three) with a gain and pitch that follow the speed; it fades out a moment after the slide ends.
 function scrape(speed,dt){
  const g=scrapeGain(speed);
  if(g>0&&live()){scrIdle=0;if(!scr){const names=SCRAPE_CLIPS.filter(n=>buffers.has(n));if(!names.length||!voices.take())return;const i=pickIndex(names.length,random,last.scrape),b=buffers.get(names[i]),s=looping(b),sg=gain(0);last.scrape=i;s.connect(sg);sg.connect(master);s.start(ctx.currentTime,random()*b.duration);scr={s,g:sg}}
   ease(scr.g.gain,g,.05);ease(scr.s.playbackRate,scrapeRate(speed),.1)}
  else if(scr){scrIdle+=dt;ease(scr.g.gain,0,.04);if(scrIdle>.4){try{scr.s.stop()}catch{}scr.s.disconnect?.();scr.g.disconnect?.();scr=null;voices.free()}}
 }
 // TR6: tyre sounds. One loop per kind of ground (asphalt, gravel, grass, mud), loaded the first time that ground is driven on, played while you drive faster than 0.5 m/s: gain and pitch from speed and slip (vehicle-sounds.js tyreMix),
 // cross-faded over .3 s when the ground changes (stepTyreBlend). Until a loop is decoded (or if it never loads) a filtered generated noise stands in (asphalt keeps the engine's own road noise). Mute and a hidden tab silence it.
 const TYRE_QUIET={loop:null,gain:0,rate:1},TYRE_LOOPS=Object.keys(TYRE_CLIPS),tyreW=freshTyreBlend(),tyreV=new Map(),TYRE_FALLBACK={gravel:{type:'bandpass',f:2200,q:.5,k:.16},grass:{type:'lowpass',f:900,q:.5,k:.25},mud:{type:'lowpass',f:350,q:.7,k:.4}};let tyreIdle=0;
 function tyreStop(r){try{r.s.stop()}catch{}r.s.disconnect?.();r.g.disconnect?.();if(r.rec)voices.free()}
 function tyres(fx){
  const m=fx.on&&live()?tyreMix(fx):TYRE_QUIET;if(m.loop&&m.gain>0)want([TYRE_CLIPS[m.loop]]);stepTyreBlend(tyreW,m.gain>0?m.loop:null,fx.dt||0);let any=false;
  for(const loop of TYRE_LOOPS){const w=tyreW[loop],buf=buffers.get(TYRE_CLIPS[loop]);let r=tyreV.get(loop);
   if(r&&!r.rec&&buf){tyreStop(r);tyreV.delete(loop);r=null} // the recording arrived: swap the stand-in for it
   if(w>0&&!r){
    if(buf){if(voices.take()){const s=looping(buf),g=gain(0);s.connect(g);g.connect(master);s.start(ctx.currentTime,random()*buf.duration);r={s,g,rec:true,k:1}}}
    else if(TYRE_FALLBACK[loop]&&v){const c=TYRE_FALLBACK[loop],s=looping(v.buffer),fl=filtered(c.type,c.f,c.q),g=gain(0);s.connect(fl);fl.connect(g);g.connect(master);s.start(ctx.currentTime,random()*1.5);r={s,g,rec:false,k:c.k}}
    if(r)tyreV.set(loop,r)}
   if(r){ease(r.g.gain,w*m.gain*r.k,.05);if(r.rec)ease(r.s.playbackRate,m.rate,.1);if(w>0)any=true}}
  tyreIdle=any?0:tyreIdle+(fx.dt||0);if(!any&&tyreIdle>TYRE.idleStopS&&tyreV.size){for(const r of tyreV.values())tyreStop(r);tyreV.clear()}
 } return {
  settings,
  get ready(){return !!ctx},
  // SND1 test and tool access: has(name) (decoded), pending (files still to fetch), voices (clips playing).
  sounds:{get tyres(){return TYRE_LOOPS.filter(l=>tyreV.has(l)&&tyreW[l]>0)},tyreWeights:tyreW,has:n=>buffers.has(n),get pending(){return queue.length+(busy?1:0)},get voices(){return voices.total},get yells(){return voices.yells},get engine(){return eng?eng.cls:null}},
  // Call from a click or key press. Safe to call again (it only resumes a suspended context). False when the browser has no Web Audio.
  unlock(){
   if(ctx){if(ctx.state==='suspended')ctx.resume?.();return true}
   if(!AudioContextClass)return false;
   try{ctx=new AudioContextClass();build();ctx.resume?.();loadDrinkSample();return true}catch{ctx=null;master=null;v=null;return false}
  },
  setActive(on){if(!ctx)return;if(on)ctx.resume?.();else ctx.suspend?.()}, // a hidden tab is silent
  setVolume(volume){settings.volume=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:settings.volume));saveAudioSettings(storage,settings);if(master)ease(master.gain,loudness(),.03)},
  setMuted(muted){settings.muted=!!muted;saveAudioSettings(storage,settings);if(master)ease(master.gain,loudness(),.03)},
  // A lumber one-shot at a place: kind is a key of TIMBER_SHOTS (chop, fall, thud, logDrop, plankDrop, plankStack). at: {x,z} (null = the player's own, full level); delay in seconds (the thud after the fall).
  timber(kind,at,listener,{delay=0}={}){
   const T=TIMBER_SHOTS[kind];if(!ctx||settings.muted||!T)return false;want(TIMBER_FILES);
   const a=at&&listener?attenuate(distance(listener,at)):1;if(a<.02)return false;
   return pickShot(T.clips,T.slot,T.level*a,{rate:1+(random()-.5)*T.jitter,delay});
  },
  // SND3: a one-shot from the sweep table (SWEEP_SHOTS: ui-click, cash-register, door-open, car-horn, ...). at {x,z} + listener = placed in the world; no `at` = the player's own, full level. The first call also starts loading the core set.
  sweep(name,at,listener){
   const T=SWEEP_SHOTS[name];if(!ctx||settings.muted||!T)return false;if(!tim.warm){tim.warm=true;want(SWEEP_CORE)}want(T.clips);
   const a=at&&listener?attenuate(distance(listener,at)):1;if(a<.02)return false;
   last[name]??=-1;return pickShot(T.clips,name,T.level*a,{rate:1+(random()-.5)*T.jitter*2});
  },
  // A footstep: surface is a terrain.js SURFACE id or 'pave'|'grass'|'gravel'|'wood' (inside a building or on a deck: 'wood'); running makes it louder. One call per step.
  step(surface,at,listener,running=false){
   const k=stepKind(surface);if(!k||!ctx||settings.muted)return false;if(!tim.warm){tim.warm=true;want(SWEEP_CORE)}want(STEP_CLIPS[k]);
   const a=at&&listener?attenuate(distance(listener,at)):1;if(a<.02)return false;
   last['step'+k]??=-1;return pickShot(STEP_CLIPS[k],'step'+k,(running?STEP_LEVEL.run:STEP_LEVEL.walk)*a,{rate:1+(random()-.5)*STEP_LEVEL.jitter*2});
  },
  // Outdoor ambience, every frame: birds by day, crickets by night, wind (windSpeed in m/s, a fifth of it indoors), water near the lake (waterDist in metres to the nearest water). Quiet and slow to change.
  ambience({outdoors=true,isNight=false,windSpeed=0,waterDist=Infinity}={}){
   if(!ctx)return;const L=SWEEP_LOOPS,names={birds:L.birds,crickets:L.crickets,wind:L.wind,water:L.water};want(Object.values(names));
   for(const k of Object.keys(names))if(!tim.amb[k]&&buffers.has(names[k]))tim.amb[k]=loopOf(names[k]);
   const to={birds:outdoors&&!isNight?.2:0,crickets:outdoors&&isNight?.2:0,wind:.18*Math.min(1,windSpeed/12)*(outdoors?1:.2),water:outdoors?.22*attenuate(waterDist):0};
   for(const k of Object.keys(to))if(tim.amb[k])ease(tim.amb[k].g.gain,to[k],1.2);
  },
  // The forklift, every frame: on (engine/seat), speed (negative = reversing: the beep), raise (non-zero while the forks move: the hydraulic whine), at {x,z}, listener {x,z}.
  forklift({on=false,speed=0,raise=0,at,listener}={}){
   if(!ctx)return;const L=SWEEP_LOOPS;want([L.forkBeep,L.forkLift]);
   if(!tim.fork.beep&&buffers.has(L.forkBeep))tim.fork.beep=loopOf(L.forkBeep);if(!tim.fork.lift&&buffers.has(L.forkLift))tim.fork.lift=loopOf(L.forkLift);
   const a=on&&at&&listener?attenuate(distance(listener,at)):0;
   if(tim.fork.beep)ease(tim.fork.beep.g.gain,speed<-.1?.45*a:0,.05);if(tim.fork.lift)ease(tim.fork.lift.g.gain,raise!==0?.5*a:0,.05);
  },  // A chainsaw, every frame it is in someone's hands: active (the engine runs), cutting (the bar is in wood), at {x,z}, listener {x,z}. Start clip, then the idle loop; the cut loop blends in while cutting; the stop clip when it is put away.
  chainsaw({active,cutting,at,listener}){
   if(!ctx)return;want(Object.values(CHAINSAW));
   const a=active&&at&&listener?attenuate(distance(listener,at)):0,now=ctx.currentTime;
   if(active&&!tim.csOn){tim.csOn=true;tim.csAt=now;shot(CHAINSAW.start,.75*a)}
   if(!active&&tim.csOn){tim.csOn=false;tim.stopT=now+.4;shot(CHAINSAW.stop,.65*tim.csA)}
   if(active){tim.csA=a;if(!tim.idle)tim.idle=loopOf(CHAINSAW.idle);if(!tim.cut)tim.cut=loopOf(CHAINSAW.cut)}
   const up=Math.max(0,Math.min(1,(now-tim.csAt-1.8)/.7)),k=cutting?1:0; // the start clip already idles: the idle loop fades in after about 2 s
   if(tim.idle)ease(tim.idle.g.gain,.55*a*(1-k)*up,.06);if(tim.cut)ease(tim.cut.g.gain,.75*a*k*up,.06);
   if(!active&&(tim.idle||tim.cut)&&now>tim.stopT){stopLoop(tim.idle);stopLoop(tim.cut);tim.idle=tim.cut=null}
  },
  // Every frame while the sawmill is loaded. listener: {x,z}. blade/belt: {at:{x,z}, level:0..1 (how fast it runs), sawing (blade only: a log is going through)}.
  update({listener,blade,belt}){
   if(!ctx)return;
   const b=attenuate(distance(listener,blade.at))*blade.level,load=blade.sawing?1:0;
   ease(v.bladeTone.frequency,(140+520*blade.level)*(1-.18*load));ease(v.bladeLow.frequency,1100-450*load);
   ease(v.bladeToneGain.gain,.13*b*(1-.25*load));ease(v.bladeHissGain.gain,(.04*b)+(.3*load*b));ease(v.bladeBand.frequency,2000+1800*blade.level);
   const r=attenuate(distance(listener,belt.at))*belt.level;
   ease(v.beltRumbleGain.gain,.22*r);ease(v.beltHumGain.gain,.07*r);
   want(Object.values(SAWMILL_BLADE)); // SND2: the recorded blade replaces the generated one as soon as both loops are decoded; the stop clip plays when the saw is switched off
   if(buffers.has(SAWMILL_BLADE.idle)&&buffers.has(SAWMILL_BLADE.cut)){if(!tim.mill)tim.mill={i:loopOf(SAWMILL_BLADE.idle),c:loopOf(SAWMILL_BLADE.cut)};const m=tim.mill;ease(v.bladeToneGain.gain,0);ease(v.bladeHissGain.gain,0);
    if(m.i&&m.c){ease(m.i.g.gain,.55*b*(1-.75*load));ease(m.i.s.playbackRate,.85+.25*blade.level);ease(m.c.g.gain,.75*b*load)}
    if(tim.lvl>.2&&blade.level<=.02)shot(SAWMILL_BLADE.stop,.65*attenuate(distance(listener,blade.at)));tim.lvl=blade.level}
  },
  // Fuel flowing (every frame while a nozzle is out): at: {x,z} of the pump, level 0..1 (1 while it is flowing), fullness 0..1 (how full the tank is: the pitch rises).
  fuel({listener,at,level,fullness=0}){
   if(!ctx)return;
   const a=at?attenuate(distance(listener,at))*level:0;
   ease(v.fuelRushGain.gain,.22*a,.04);ease(v.fuelHumGain.gain,.05*a,.04);ease(v.fuelBand.frequency,550+950*Math.max(0,Math.min(1,fullness)));
   want([SWEEP_LOOPS.fuel]);if(buffers.has(SWEEP_LOOPS.fuel)){if(!tim.fuel)tim.fuel=loopOf(SWEEP_LOOPS.fuel);if(tim.fuel){ease(tim.fuel.g.gain,.45*a,.04);ease(tim.fuel.s.playbackRate,.85+.45*Math.max(0,Math.min(1,fullness)),.1);ease(v.fuelRushGain.gain,0,.04);ease(v.fuelHumGain.gain,0,.04)}} // SND3: the recorded pour replaces the generated one once decoded
  },
  // Every frame: the engine of the vehicle you are sitting in. voice: engineVoice(...) (gain 0 when it is off or stalled). It plays at full level for the driver (and a passenger).
  // cls: the class id of that vehicle ('shortbed', ...): its recorded loop (vehicle-sounds.js) replaces the generated tone as soon as it is decoded; the misfire dip, the roughness by band and the revs are applied on top of it.
  engine(voice,cls=null){
   if(!ctx)return;
   const E=cls?engineFor(cls):null,buf=E&&buffers.get(E.file);if(E&&!wanted.has(E.file))want([E.file]);if(eng&&(eng.cls!==cls||!buf))stopEngine();if(buf&&!eng)startEngine(cls,buf);
   const q=voice.misfire?.2:1;ease(v.engLow.frequency,voice.lowpass,.08);ease(v.engThrob.frequency,voice.freq/2.6,.1);
   if(eng){const sg=Math.min(1.2,voice.gain*SAMPLE_GAIN);ease(eng.src.playbackRate,(E.rate[0]+(E.rate[1]-E.rate[0])*voice.rpm)*(voice.misfire?.8:1),.06*q);ease(eng.lp.frequency,Math.min(9000,voice.lowpass*6),.08);ease(eng.g.gain,sg,voice.misfire?.02:.08);ease(eng.depth.gain,sg*.4*voice.rough,.1);ease(v.engGain.gain,0,.08);ease(v.engThrobDepth.gain,0,.1)}
   else{ease(v.engSaw.frequency,voice.freq,.05*q);ease(v.engSub.frequency,voice.freq/2,.05*q);
   ease(v.engGain.gain,voice.gain,voice.misfire?.02:.08);ease(v.engThrobDepth.gain,voice.gain*.8*voice.rough,.1)}
   ease(v.roadGain.gain,.09*voice.road*(voice.gain>0?1:0),.1);ease(v.roadBand.frequency,300+500*voice.road,.1);
  },
  // Turning the key: a few rough cranks, then the engine catches. `at` and `listener` as for click. Plays through the shared click limit.
  ignition(at,listener,{tier='low',seconds=0}={}){ // seconds: how long the starter turns (a damaged engine cranks longer: damage.js CRANK_SECONDS x cranks); 0 = the tier's short start
   if(!ctx||settings.muted)return false;
   const a=attenuate(distance(listener,at));if(a<.02)return false;
   const cb=buffers.get(CRANK_CLIP);if(cb&&live()&&voices.take()){const dur=seconds>0?Math.min(8,seconds):.9,t0=ctx.currentTime,s=looping(cb),g=gain(0); // the recorded starter, looped for as long as it turns
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(.7*a,t0+.03);g.gain.setValueAtTime(.7*a,t0+Math.max(.04,dur-.1));g.gain.linearRampToValueAtTime(0,t0+dur);s.connect(g);g.connect(master);s.onended=()=>{voices.free();s.disconnect?.();g.disconnect?.()};s.start(t0);s.stop(t0+dur);return true}
   const t=ctx.currentTime,cranks=seconds>0?Math.max(2,Math.min(40,Math.round(seconds/.13))):tier==='low'?5:tier==='mid'?4:3,src=ctx.createBufferSource();src.buffer=v.buffer;const band=filtered('lowpass',300,.7),env=gain(0);
   for(let i=0;i<cranks;i++){const s=t+i*.13;env.gain.setValueAtTime(0,s);env.gain.linearRampToValueAtTime(.4*a,s+.02);env.gain.linearRampToValueAtTime(.05*a,s+.1)}
   env.gain.setTargetAtTime(.0001,t+cranks*.13+.05,.05);src.connect(band);band.connect(env);env.connect(master);src.start(t,random()*1.5);src.stop(t+cranks*.13+.4);
   return true;
  },
  // The engine dying (a stalling crash): a falling, coughing rumble with two pops, about 0.7 s. Not placed in the world (it is the driver's own engine). Shares the click limit.
  stall(){
   if(!ctx||settings.muted||clicks>=MAX_CLICKS)return false;
   if(shot(STALL_CLIP,.85))return true; // the recorded engine cut-off, else the generated one below
   const t=ctx.currentTime,o=ctx.createOscillator(),low=filtered('lowpass',220,.8),env=gain(0);clicks++;o.type='sawtooth';o.frequency.setValueAtTime(75,t);o.frequency.linearRampToValueAtTime(24,t+.65);
   env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(.3,t+.03);env.gain.setTargetAtTime(.0001,t+.2,.14);o.connect(low);low.connect(env);env.connect(master);o.start(t);o.stop(t+.8);
   for(const at of [.1,.34]){const src=ctx.createBufferSource();src.buffer=v.buffer;const band=filtered('bandpass',200,1.2),pop=gain(0);pop.gain.setValueAtTime(0,t+at);pop.gain.linearRampToValueAtTime(.35,t+at+.01);pop.gain.setTargetAtTime(.0001,t+at+.02,.04);src.connect(band);band.connect(pop);pop.connect(master);src.start(t+at,random()*1.5);src.stop(t+at+.2)}
   o.onended=()=>{clicks--};return true;
  },
  // A chime when the tank is full (or you cannot pay): two short notes. `at`: {x,z}. Shares the click limit.
  chime(at,listener,{ok=true}={}){
   if(!ctx||settings.muted||clicks>=MAX_CLICKS)return false;
   const a=attenuate(distance(listener,at));if(a<.02)return false;
   const t=ctx.currentTime,notes=ok?[880,1320]:[330,247];clicks++;let last=null;
   notes.forEach((freq,i)=>{const o=ctx.createOscillator(),env=gain(0);o.type=ok?'sine':'square';o.frequency.value=freq;const s=t+i*.14;env.gain.setValueAtTime(0,s);env.gain.linearRampToValueAtTime(.22*a,s+.01);env.gain.setTargetAtTime(.0001,s+.05,.07);o.connect(env);env.connect(master);o.start(s);o.stop(s+.3);last=o});
   last.onended=()=>{clicks--};
   return true;
  },
  // The phone's notification: two soft rising notes, not placed in the world (it is in your pocket). Shares the click limit.
  ping(){
   if(!ctx||settings.muted||clicks>=MAX_CLICKS)return false;
   want(['phone-ping']);if(shot('phone-ping',.45))return true; // SND3: the recorded ping, else the two generated notes
   const t=ctx.currentTime;clicks++;let last=null;
   [1175,1568].forEach((freq,i)=>{const o=ctx.createOscillator(),env=gain(0);o.type='sine';o.frequency.value=freq;const s=t+i*.12;env.gain.setValueAtTime(0,s);env.gain.linearRampToValueAtTime(.18,s+.01);env.gain.setTargetAtTime(.0001,s+.04,.09);o.connect(env);env.connect(master);o.start(s);o.stop(s+.4);last=o});
   last.onended=()=>{clicks--};
   return true;
  },
  // Drinking from the cooler: a short pour of filtered noise, then three gulps (sine blips that fall in pitch), about 1.3 s. False if muted, too far or too many sounds are playing.
  drink(at,listener){
   if(!ctx||settings.muted||clicks>=MAX_CLICKS)return false;
   const a=attenuate(distance(listener,at));if(a<.02)return false;
   if(drinkSample){const t=ctx.currentTime,s=ctx.createBufferSource(),g=gain(0);s.buffer=drinkSample;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.6*a,t+.03);s.connect(g);g.connect(master);clicks++;s.onended=()=>{clicks--};s.start(t);return true}
   const t=ctx.currentTime,src=ctx.createBufferSource();src.buffer=v.buffer;const band=filtered('bandpass',1800,1.4),env=gain(0);
   env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(.16*a,t+.05);env.gain.setValueAtTime(.16*a,t+.4);env.gain.setTargetAtTime(.0001,t+.45,.06);band.frequency.setValueAtTime(1500,t);band.frequency.linearRampToValueAtTime(2600,t+.5);
   src.connect(band);band.connect(env);env.connect(master);clicks++;src.start(t,random()*1.5);src.stop(t+.7);
   let last=src;[.55,.8,1.05].forEach((d,i)=>{const o=ctx.createOscillator(),g=gain(0),s=t+d;o.type='sine';o.frequency.setValueAtTime(260-i*20,s);o.frequency.setTargetAtTime(110,s,.05);g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.22*a,s+.02);g.gain.setTargetAtTime(.0001,s+.06,.05);o.connect(g);g.connect(master);o.start(s);o.stop(s+.3);last=o});
   last.onended=()=>{clicks--};
   return true;
  },  // The lever: a short click (a tick of noise and a falling blip). `at`: {x,z}. False if it was too far, muted or there are already three clicks playing.
  click(at,listener){
   if(!ctx||settings.muted||clicks>=MAX_CLICKS)return false;
   const a=attenuate(distance(listener,at));if(a<.02)return false;
   const t=ctx.currentTime,src=ctx.createBufferSource();src.buffer=v.buffer;const band=filtered('bandpass',1500,1.2),env=gain(0),blip=ctx.createOscillator();blip.type='square';blip.frequency.value=240;
   blip.frequency.setTargetAtTime(90,t,.02);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(.5*a,t+.004);env.gain.setTargetAtTime(.0001,t+.006,.018);
   src.connect(band);band.connect(env);blip.connect(env);env.connect(master);clicks++;
   src.start(t,random()*1.5);blip.start(t);src.stop(t+.14);blip.stop(t+.14);src.onended=()=>{clicks--};
   return true;
  },
  // SND1: call when you get into a vehicle: starts loading its engine loop and the shared set (once; a no-op without a sound folder).
  prepare(cls){if(!ctx)return;const E=engineFor(cls);want([E?.file,...VEHICLE_SET])},
  // A counted crash (a driving.js 'crash' event): the recorded crunch by tier, glass when it is bad, a soft thud and a yell for a person. Falls back to a generated thump while the clips are not decoded.
  crash(e){
   if(!ctx||!live())return false;want(VEHICLE_SET);const plan=crashPlan(e);let ok=false;
   if(plan.thud)ok=pickShot(plan.thud.pool,'thud',plan.thud.gain)||thump(.5,false);
   if(plan.crunch)ok=pickShot(plan.crunch.pool,'crash',plan.crunch.gain)||thump(plan.tier==='hard'?.9:plan.tier==='medium'?.6:.35,plan.tier!=='light');
   if(plan.glass)pickShot(plan.glass.pool,'glass',plan.glass.gain,{delay:plan.glass.delay});
   if(plan.yell){gate.force(yellClock,'person');yell(1)}
   return ok;
  },
  // Every frame: fx = {on (you are driving), sliding (the hull is touching something), speed (m/s), x, z, dt, people: [{name, group:{position}}]}. Scrape while sliding fast enough; a yell from a walker the vehicle passes closely at speed (8 s each, 2 voices at most).
  drive(fx){
   if(!ctx)return;yellClock+=fx.dt;
   if(fx.on&&live()){const h=gate.scan(yellClock,fx.x,fx.z,fx.speed,fx.people);if(h&&!yell(h.vol))gate.last.delete(h.id)}
   scrape(fx.on&&fx.sliding?fx.speed:0,fx.dt);tyres(fx);
  },
  // PH1: a phone sound (phone-calls.js PHONE_CLIPS: key, pickup, ring, busy, hangup) through the master gain, so mute and volume apply. loop repeats the recorded clip until the returned stop() is called. The clips load on the first call; until they are decoded (or if they never load) a generated tone plays instead. Returns stop().
  phone(name,{loop=false}={}){
   const none=()=>{};if(!ctx||!v||!live())return none;want(PHONE_CLIPS);
   const b=buffers.get('phone-'+name),t=ctx.currentTime,g=gain(0),parts=[];let done=false;g.connect(master);
   if(b){const s=loop?looping(b):ctx.createBufferSource();s.buffer=b;s.connect(g);g.gain.value=PHONE_LEVEL[name]||.5;s.start(t);parts.push(s)}
   else{const p=PHONE_TONES[name];if(!p)return none;
    if(p.click){const s=ctx.createBufferSource(),bp=filtered('bandpass',p.click,1.2);s.buffer=v.buffer;s.connect(bp);bp.connect(g);g.gain.setValueAtTime(.5,t);g.gain.setTargetAtTime(.0001,t+.01,.02);s.start(t,random()*1.5);s.stop(t+.12);parts.push(s)}
    else{for(const f of p.f){const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;o.connect(g);o.start(t);o.stop(t+p.per*p.n+.05);parts.push(o)}
     for(let i=0;i<p.n;i++){g.gain.setValueAtTime(p.lv,t+i*p.per);g.gain.setValueAtTime(0,t+i*p.per+p.on)}}}
   const stop=()=>{if(done)return;done=true;try{g.gain.cancelScheduledValues?.(ctx.currentTime);ease(g.gain,0,.02)}catch{}setTimeout(()=>{for(const s of parts){try{s.stop()}catch{}}try{g.disconnect()}catch{}},120)};
   return stop;
  }
 };
}
