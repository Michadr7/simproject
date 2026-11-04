// Sound, generated with the Web Audio API (no sound files). One AudioContext, created on the first click or key (browsers do not allow sound before one); a master volume and a mute that are saved;
// at most three sounds at once: the blade, the belt and the lever click. Every sound is placed in the world: it is loudest within NEAR metres and silent beyond HEARING metres of the player.
// Mono on purpose (no panning yet). Nothing here runs unless a source is near enough to hear.
export const AUDIO_KEY='citylife.audio.v1',NEAR=2.5,HEARING=40,MAX_CLICKS=3;

// How much of a sound reaches the player at `distance` metres: 1 up close, falling off smoothly to 0 at HEARING.
export const attenuate=d=>d<=NEAR?1:d>=HEARING?0:Math.pow(1-(d-NEAR)/(HEARING-NEAR),2);
export function loadAudioSettings(storage){
 try{const v=JSON.parse(storage.getItem(AUDIO_KEY)||'null');return {volume:Number.isFinite(v?.volume)?Math.max(0,Math.min(1,v.volume)):.6,muted:v?.muted===true}}catch{return {volume:.6,muted:false}}
}
export function saveAudioSettings(storage,settings){try{storage.setItem(AUDIO_KEY,JSON.stringify({volume:+settings.volume.toFixed(2),muted:!!settings.muted}));return true}catch{return false}}

// AudioContextClass: window.AudioContext (or a fake in tests); storage: {getItem,setItem}.
export function createAudio({AudioContextClass,storage,random=Math.random}){
 const settings=loadAudioSettings(storage);
 let ctx=null,master=null,v=null,clicks=0;
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
  for(const node of [bladeTone,bladeHiss,beltRumble,beltHum,fuelRush,fuelHum])node.start();
  v={bladeTone,bladeLow,bladeToneGain,bladeBand,bladeHissGain,beltRumbleGain,beltHumGain,fuelBand,fuelRushGain,fuelHumGain,buffer};
 }
 return {
  settings,
  get ready(){return !!ctx},
  // Call from a click or key press. Safe to call again (it only resumes a suspended context). False when the browser has no Web Audio.
  unlock(){
   if(ctx){if(ctx.state==='suspended')ctx.resume?.();return true}
   if(!AudioContextClass)return false;
   try{ctx=new AudioContextClass();build();ctx.resume?.();return true}catch{ctx=null;master=null;v=null;return false}
  },
  setActive(on){if(!ctx)return;if(on)ctx.resume?.();else ctx.suspend?.()}, // a hidden tab is silent
  setVolume(volume){settings.volume=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:settings.volume));saveAudioSettings(storage,settings);if(master)ease(master.gain,loudness(),.03)},
  setMuted(muted){settings.muted=!!muted;saveAudioSettings(storage,settings);if(master)ease(master.gain,loudness(),.03)},
  // Every frame while the sawmill is loaded. listener: {x,z}. blade/belt: {at:{x,z}, level:0..1 (how fast it runs), sawing (blade only: a log is going through)}.
  update({listener,blade,belt}){
   if(!ctx)return;
   const b=attenuate(distance(listener,blade.at))*blade.level,load=blade.sawing?1:0;
   ease(v.bladeTone.frequency,(140+520*blade.level)*(1-.18*load));ease(v.bladeLow.frequency,1100-450*load);
   ease(v.bladeToneGain.gain,.13*b*(1-.25*load));ease(v.bladeHissGain.gain,(.04*b)+(.3*load*b));ease(v.bladeBand.frequency,2000+1800*blade.level);
   const r=attenuate(distance(listener,belt.at))*belt.level;
   ease(v.beltRumbleGain.gain,.22*r);ease(v.beltHumGain.gain,.07*r);
  },
  // Fuel flowing (every frame while a nozzle is out): at: {x,z} of the pump, level 0..1 (1 while it is flowing), fullness 0..1 (how full the tank is: the pitch rises).
  fuel({listener,at,level,fullness=0}){
   if(!ctx)return;
   const a=at?attenuate(distance(listener,at))*level:0;
   ease(v.fuelRushGain.gain,.22*a,.04);ease(v.fuelHumGain.gain,.05*a,.04);ease(v.fuelBand.frequency,550+950*Math.max(0,Math.min(1,fullness)));
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
  // The lever: a short click (a tick of noise and a falling blip). `at`: {x,z}. False if it was too far, muted or there are already three clicks playing.
  click(at,listener){
   if(!ctx||settings.muted||clicks>=MAX_CLICKS)return false;
   const a=attenuate(distance(listener,at));if(a<.02)return false;
   const t=ctx.currentTime,src=ctx.createBufferSource();src.buffer=v.buffer;const band=filtered('bandpass',1500,1.2),env=gain(0),blip=ctx.createOscillator();blip.type='square';blip.frequency.value=240;
   blip.frequency.setTargetAtTime(90,t,.02);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(.5*a,t+.004);env.gain.setTargetAtTime(.0001,t+.006,.018);
   src.connect(band);band.connect(env);blip.connect(env);env.connect(master);clicks++;
   src.start(t,random()*1.5);blip.start(t);src.stop(t+.14);blip.stop(t+.14);src.onended=()=>{clicks--};
   return true;
  }
 };
}
