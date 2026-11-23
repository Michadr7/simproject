// Pure weather, storm, elevation snow, and player comfort rules.
export const WEATHER_IDS=Object.freeze(['clear','partly','overcast','fog','drizzle','rain','storm','snow']);
export const ELEVATION_LAPSE_C_PER_M=0.25,ELEVATION_BASE_M=12,SNOW_TEMP_C=1.0,SLEET_TEMP_C=2.5,TRANSITION_MIN=30;

const M=(id,label,icon,o)=>Object.freeze({id,label,icon,...o});
export const WEATHER_META=Object.freeze({
 clear:   M('clear',   'Clear',    '☀', {windLevel:.30,windMs:2.5, precipKind:'none',precipRate:0,  stormIntensity:0,  tempOffsetC:3,  cloudCover:.28,sunScale:1.0,hemiScale:1.0, fogScale:1.0, exposureScale:1.0, starsScale:1.0,topTint:[.10,.28,.64],horizonTint:[.51,.67,.82],roadNote:'Dry roads · full grip.'}),
 partly:  M('partly',  'Partly',   '⛅',{windLevel:.60,windMs:4.2, precipKind:'none',precipRate:0,  stormIntensity:0,  tempOffsetC:0,  cloudCover:.55,sunScale:.88,hemiScale:.96,fogScale:.95, exposureScale:1.0, starsScale:.72,topTint:[.14,.27,.52],horizonTint:[.52,.63,.73],roadNote:'Dry pavement · light breeze.'}),
 overcast:M('overcast','Overcast', '☁', {windLevel:.80,windMs:5.5, precipKind:'none',precipRate:0,  stormIntensity:0,  tempOffsetC:-2, cloudCover:.82,sunScale:.65,hemiScale:.88,fogScale:.86, exposureScale:.97, starsScale:.25,topTint:[.18,.22,.28],horizonTint:[.40,.46,.52],roadNote:'Dry surface · flat light.'}),
 fog:     M('fog',     'Fog',      '🌫️',{windLevel:.25,windMs:2.0, precipKind:'none',precipRate:0,  stormIntensity:0,  tempOffsetC:-3, cloudCover:.65,sunScale:.58,hemiScale:.85,fogScale:.42, exposureScale:.96, starsScale:.15,topTint:[.28,.33,.38],horizonTint:[.55,.59,.62],roadNote:'Low visibility · watch oncoming bends.'}),
 drizzle: M('drizzle', 'Drizzle',  '🌦️',{windLevel:.85,windMs:6.2, precipKind:'rain',precipRate:.28,stormIntensity:0,  tempOffsetC:-5, cloudCover:.78,sunScale:.55,hemiScale:.84,fogScale:.76, exposureScale:.95, starsScale:.15,topTint:[.15,.20,.27],horizonTint:[.36,.42,.49],roadNote:'Damp corners · slight mud slick.'}),
 rain:    M('rain',    'Rain',     '🌧️',{windLevel:1.30,windMs:9.5,precipKind:'rain',precipRate:.65,stormIntensity:.15,tempOffsetC:-7, cloudCover:.88,sunScale:.36,hemiScale:.72,fogScale:.64, exposureScale:.90, starsScale:.05,topTint:[.10,.15,.22],horizonTint:[.26,.32,.39],roadNote:'Wet roads · allow extra braking; soft dirt bogs faster.'}),
 storm:   M('storm',   'Storm',    '⛈️',{windLevel:2.00,windMs:14.5,precipKind:'rain',precipRate:1.0,stormIntensity:1.0,tempOffsetC:-8, cloudCover:.96,sunScale:.22,hemiScale:.58,fogScale:.52, exposureScale:.86, starsScale:0,  topTint:[.06,.08,.14],horizonTint:[.18,.22,.29],roadNote:'Heavy rain & gusts · reduced grip and muddy off-road hazards.'}),
 snow:    M('snow',    'Snow',     '❄️',{windLevel:1.00,windMs:7.0, precipKind:'snow',precipRate:.72,stormIntensity:0,  tempOffsetC:-12,cloudCover:.90,sunScale:.48,hemiScale:.82,fogScale:.58, exposureScale:.96, starsScale:.05,topTint:[.24,.28,.35],horizonTint:[.58,.64,.70],roadNote:'Cold & icy patches · dress warm.'}),
});

export const CLOTHING_PROTECTION=Object.freeze({
 none:          Object.freeze({cold:0,  rain:0,  label:'No jacket'}),
 'basic-jacket':Object.freeze({cold:.40,rain:.35,label:'Basic Jacket'}),
 'rain-shell':  Object.freeze({cold:.55,rain:.88,label:'Rain Shell'}),
 'winter-parka':Object.freeze({cold:.88,rain:.65,label:'Winter Parka'}),
});

export const WARM_CONSUMABLES=Object.freeze({
 coffee:        Object.freeze({power:14,minutes:75}),
 'coffee-to-go':Object.freeze({power:12,minutes:60}),
 soup:          Object.freeze({power:18,minutes:120}),
 'clam-chowder':Object.freeze({power:22,minutes:150}),
});

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a*(1-t)+b*t;
const smooth=(t)=>{const u=clamp(t,0,1);return u*u*(3-2*u)};
const mix3=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
const intDay=d=>Number.isFinite(d)?Math.max(1,Math.floor(d)):1;
const wrapMin=m=>Number.isFinite(m)?((m%1440)+1440)%1440:540;

function hashU32(...parts){
 let h=2166136261>>>0;
 for(const p of parts){
  const s=String(p);
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  h^=0x9e;h=Math.imul(h,16777619)>>>0;
 }
 h^=h>>>16;h=Math.imul(h,0x85ebca6b)>>>0;h^=h>>>13;h=Math.imul(h,0xc2b2ae35)>>>0;h^=h>>>16;
 return h>>>0;
}

const TRANSITIONS=Object.freeze({
 clear:   [['clear',34],['partly',42],['overcast',14],['fog',10]],
 partly:  [['clear',28],['partly',34],['overcast',24],['drizzle',8],['fog',6]],
 overcast:[['partly',24],['overcast',24],['drizzle',28],['rain',18],['fog',6]],
 fog:     [['clear',34],['partly',38],['overcast',20],['drizzle',8]],
 drizzle: [['partly',20],['overcast',28],['drizzle',20],['rain',26],['fog',6]],
 rain:    [['overcast',18],['drizzle',32],['rain',24],['storm',26]],
 storm:   [['rain',48],['drizzle',30],['overcast',22]],
 snow:    [['overcast',35],['partly',25],['snow',30],['fog',10]],
});

function pickNext(prev,seed,day,slot){
 const base=TRANSITIONS[prev]||TRANSITIONS.partly;
 const list=base.map(([id,w])=>{
  let m=w;
  if(slot===0&&id==='fog')m*=2.4;
  if(slot!==0&&id==='fog')m*=0.2;
  if(slot===1&&prev==='fog'&&(id==='clear'||id==='partly'))m*=1.5;
  return [id,m];
 });
 const total=list.reduce((s,[,w])=>s+w,0);
 let ticket=(hashU32(seed|0,day,slot,'wx')/4294967296)*total;
 for(const [id,w] of list){ticket-=w;if(ticket<=0)return id}
 return list[0][0];
}

function buildDay(seed,targetDay){
 const dEff=((intDay(targetDay)-1)%365)+1;
 let prev='clear';
 let last={morning:'clear',afternoon:'partly',evening:'overcast',prevEvening:'clear'};
 for(let d=1;d<=dEff;d++){
  if(d===1){
   last={morning:'clear',afternoon:'clear',evening:'clear',prevEvening:'clear'};
   prev='clear';
   continue;
  }
  const prevEvening=prev;
  const morning=pickNext(prev,seed,d,0);
  const afternoon=pickNext(morning,seed,d,1);
  const evening=pickNext(afternoon,seed,d,2);
  last={morning,afternoon,evening,prevEvening};
  prev=evening;
 }
 return last;
}

export function dayArc(seed,day){
 const d=intDay(day);
 const cur=buildDay(seed,d);
 const nxt=pickNext(cur.evening,seed,(((d)%365)+1),0);
 return Object.freeze({...cur,nextMorning:nxt});
}

function valleyBaseTempC(minute){
 const wave=0.5-0.5*Math.cos((wrapMin(minute)-300)/1440*Math.PI*2); // min at 05:00 (12 C), max at 17:00 (~16 C)
 return 12+4*wave;
}

export function weatherAt(seed,day,minute,overrideId=null){
 const d=intDay(day),m=wrapMin(minute);
 if(overrideId&&WEATHER_META[overrideId]){
  const w=WEATHER_META[overrideId];
  return Object.freeze({...w,minute:m,day:d,tempC:+(valleyBaseTempC(m)+w.tempOffsetC).toFixed(2)});
 }
 const arc=dayArc(seed,d);
 let fromId=arc.prevEvening,toId=arc.morning,elapsed=m;
 if(m>=1020){fromId=arc.afternoon;toId=arc.evening;elapsed=m-1020}
 else if(m>=480){fromId=arc.morning;toId=arc.afternoon;elapsed=m-480}
 const A=WEATHER_META[fromId],B=WEATHER_META[toId],t=smooth(elapsed/TRANSITION_MIN);
 const dom=t<.5?A:B;
 const num=(k)=>mix(A[k],B[k],t);
 const precipRate=num('precipRate');
 const tempOffsetC=num('tempOffsetC');
 return Object.freeze({
  id:dom.id,label:dom.label,icon:dom.icon,minute:m,day:d,
  windLevel:num('windLevel'),windMs:num('windMs'),
  precipKind:precipRate>0.02?(dom.precipKind!=='none'?dom.precipKind:(B.precipKind!=='none'?B.precipKind:A.precipKind)):'none',
  precipRate,stormIntensity:num('stormIntensity'),tempOffsetC,
  tempC:+(valleyBaseTempC(m)+tempOffsetC).toFixed(2),
  cloudCover:num('cloudCover'),sunScale:num('sunScale'),hemiScale:num('hemiScale'),
  fogScale:num('fogScale'),exposureScale:num('exposureScale'),starsScale:num('starsScale'),
  topTint:mix3(A.topTint,B.topTint,t),horizonTint:mix3(A.horizonTint,B.horizonTint,t),
  roadNote:dom.roadNote,
 });
}

export function dayWeatherWord(seed,day,overrideId=null){
 if(overrideId&&WEATHER_META[overrideId])return overrideId;
 return dayArc(seed,day).afternoon;
}

export function forecastDays(seed,startDay,count=3){
 const s=intDay(startDay),n=Math.max(1,Math.min(7,Math.floor(count)||3)),out=[];
 const passDrop=(50-ELEVATION_BASE_M)*ELEVATION_LAPSE_C_PER_M;
 for(let i=0;i<n;i++){
  const day=s+i,arc=dayArc(seed,day);
  const segs=[arc.morning,arc.afternoon,arc.evening].map(id=>WEATHER_META[id]);
  const highs=segs.map(w=>Math.round(16+w.tempOffsetC)),lows=segs.map(w=>Math.round(12+w.tempOffsetC));
  const valleyHighC=Math.max(...highs),valleyLowC=Math.min(...lows);
  const passHighC=Math.round(valleyHighC-passDrop),passLowC=Math.round(valleyLowC-passDrop);
  const stormRisk=segs.some(w=>w.id==='storm')?'High':segs.some(w=>w.id==='rain')?'Low':'None';
  const snowPass=segs.some((w,idx)=>w.precipRate>0.05&&(Math.round((idx===1?16:12)+w.tempOffsetC-passDrop))<=SNOW_TEMP_C);
  const worst=segs.find(w=>w.id==='storm')||segs.find(w=>w.id==='rain')||segs.find(w=>w.id==='drizzle')||segs.find(w=>w.id==='fog')||WEATHER_META[arc.afternoon];
  const advisory=worst.id==='storm'?(snowPass?'Storm in valley · snow on Blackstone peaks.':'High gusts & heavy rain.')
   :snowPass?'Valley rain turns to snow on Blackstone Pass.'
   :worst.id==='fog'?'Morning fog burns off later.'
   :'Fair conditions across the valley.';
  out.push({day,morning:arc.morning,afternoon:arc.afternoon,evening:arc.evening,summaryId:arc.afternoon,valleyHighC,valleyLowC,passHighC,passLowC,stormRisk,snowPass,advisory});
 }
 return out;
}

export function localWeatherAt(base,{x=0,z=0,y=0,zone='alder',forest=0}={}){
 const w=base||WEATHER_META.clear;
 const h=Number.isFinite(y)?Math.max(0,y):0;
 const f=clamp(Number.isFinite(forest)?forest:0,0,1);
 const coast=zone==='kaspian'||z>140;
 const pass=h>22||(x>250&&z<-180);
 const region=pass?'Blackstone Pass':coast?'Kaspian Bay':f>0.45?'Pine Ridge':'Ironwood Valley';
 const elevDrop=Math.max(0,h-ELEVATION_BASE_M)*ELEVATION_LAPSE_C_PER_M;
 const tempC=+((w.tempC??14)-elevDrop-(coast?2:0)-f).toFixed(2);
 const passWindMul=h>22?1+Math.min(.4,(h-22)*.015):1;
 const windMs=+(w.windMs*(coast?1.25:1)*passWindMul*(1-.35*f)).toFixed(2);
 const windLevel=clamp(w.windLevel*(coast?1.2:1)*passWindMul*(1-.25*f),0,2);
 const precipRate=clamp(w.precipRate*(1-.25*f),0,1);
 let precipKind=precipRate>0.02?w.precipKind:'none',id=w.id,label=w.label,icon=w.icon,fogScale=w.fogScale*(coast?.85:1);
 if(precipRate>0.05&&tempC<=SNOW_TEMP_C){
  precipKind='snow';id='snow';label=h>22?'Mountain Snow':'Snow';icon='❄️';
 }else if(precipRate>0.05&&tempC<=SLEET_TEMP_C){
  precipKind='sleet';label='Sleet';icon='🌨️';
 }
 const rainLevel=precipKind==='rain'?precipRate:precipKind==='sleet'?precipRate*.6:0;
 const snowLevel=precipKind==='snow'?precipRate:precipKind==='sleet'?precipRate*.4:0;
 const snowCover=clamp((snowLevel>0?.35+snowLevel*.65:0)+clamp((2-tempC)/8,0,.4)*(h>22?1:0),0,1);
 return Object.freeze({...w,id,label,icon,region,tempC,windMs,windLevel,precipKind,precipRate,rainLevel,snowLevel,snowCover,fogScale});
}

export function freshStormState(seed=1){
 return {seed:(Math.trunc(Number(seed)||1)>>>0)||1,cooldown:8,flash:0,thunderTimer:0,thunderPower:0};
}

function nextLcg(s){return ((Math.imul(s>>>0,1664525)+1013904223)>>>0)||1}

export function stepStorm(stormState,dt,stormIntensity=0){
 const cur=stormState&&typeof stormState==='object'?stormState:freshStormState(1);
 const d=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
 const inten=clamp(Number.isFinite(stormIntensity)?stormIntensity:0,0,1);
 let seed=cur.seed>>>0||1,cooldown=Number.isFinite(cur.cooldown)?cur.cooldown:8;
 let flash=cur.flash*Math.exp(-d/.16);
 if(flash<1e-4)flash=0;
 let thunderTimer=cur.thunderTimer||0,thunderPower=cur.thunderPower||0,thunderEvent=0;
 if(thunderTimer>0&&d>0){
  thunderTimer-=d;
  if(thunderTimer<=0){thunderTimer=0;thunderEvent=thunderPower||0.7;thunderPower=0}
 }
 if(inten>=0.35&&d>0){
  cooldown-=d;
  if(cooldown<=0){
   seed=nextLcg(seed);const u1=seed/4294967296;
   seed=nextLcg(seed);const u2=seed/4294967296;
   flash=0.75+0.25*inten;
   thunderTimer=1.2+u1*2.6;
   thunderPower=0.55+0.45*inten;
   cooldown=6+(1-inten)*10+u2*8;
  }
 }
 return {state:{seed,cooldown,flash,thunderTimer,thunderPower},flash,thunderEvent};
}

export function stepGroundWet(wet,localWeather,dt){
 const cur=clamp(Number.isFinite(wet)?wet:0,0,1);
 const d=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
 if(!d)return cur;
 const rain=clamp(localWeather?.rainLevel||0,0,1),temp=localWeather?.tempC??15,wind=localWeather?.windMs??3;
 if(rain>0.02)return clamp(cur+(0.008+0.02*rain)*d,0,1);
 const dryRate=0.004*(1+clamp((temp-8)/16,0,.8)+clamp(wind/15,0,.6));
 return clamp(cur-dryRate*d,0,1);
}

export function weatherSkyAdjust(localWeather,flash=0){
 const w=localWeather||WEATHER_META.clear;
 return Object.freeze({
  cloudCover:w.cloudCover,sunScale:w.sunScale,hemiScale:w.hemiScale,fogScale:w.fogScale,
  exposureScale:w.exposureScale,starsScale:w.starsScale,topTint:w.topTint,horizonTint:w.horizonTint,
  flash:clamp(Number.isFinite(flash)?flash:0,0,1),
 });
}

export const freshComfort=()=>({value:78,soak:0,exposure:0,warmUntil:0,warmPower:0});

export function normalizeComfort(v){
 if(!v||typeof v!=='object')return freshComfort();
 const f=freshComfort();
 return {
  value:Number.isFinite(v.value)?clamp(v.value,0,100):f.value,
  soak:Number.isFinite(v.soak)?clamp(v.soak,0,1):0,
  exposure:Number.isFinite(v.exposure)?clamp(v.exposure,0,1):0,
  warmUntil:Number.isFinite(v.warmUntil)&&v.warmUntil>0?Math.floor(v.warmUntil):0,
  warmPower:Number.isFinite(v.warmPower)&&v.warmPower>0?clamp(v.warmPower,0,40):0,
 };
}

export function applyWarmBoost(comfort,nowMinutes,power=14,minutes=90){
 const c=normalizeComfort(comfort),now=Number.isFinite(nowMinutes)?Math.max(0,Math.floor(nowMinutes)):0;
 const p=clamp(power,0,40),until=now+Math.max(5,Math.floor(minutes));
 return {...c,warmUntil:Math.max(c.warmUntil,until),warmPower:c.warmUntil>now?Math.max(c.warmPower,p):p,exposure:Math.max(0,c.exposure-0.12),value:Math.min(100,c.value+p*0.4)};
}

export function applyWarmth(comfort,nowMinutes,itemId){
 const cfg=WARM_CONSUMABLES[itemId];
 return cfg?applyWarmBoost(comfort,nowMinutes,cfg.power,cfg.minutes):normalizeComfort(comfort);
}

export function applyCampRestComfort(comfort,usedFirewood,nowMinutes){
 const base={...normalizeComfort(comfort),soak:0,exposure:0,value:usedFirewood?100:80};
 return usedFirewood?applyWarmBoost(base,nowMinutes,16,90):base;
}

export function stepComfort(comfort,env={},dt=0){
 const c=normalizeComfort(comfort),d=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
 if(!d)return c;
 const gear=CLOTHING_PROTECTION[env.jacketId]||CLOTHING_PROTECTION.none;
 const rain=clamp(env.rainLevel??(env.precipKind==='rain'?env.precipRate:env.precipKind==='sleet'?(env.precipRate||0)*.6:0),0,1);
 const snow=clamp(env.snowLevel??(env.precipKind==='snow'?env.precipRate:env.precipKind==='sleet'?(env.precipRate||0)*.4:0),0,1);
 const shelteredRain=!!(env.indoors||env.inCab||env.underAwning||env.nearCampfire);

 let soak=c.soak;
 if(env.wading)soak=clamp(soak+0.06*d,0,1);
 else if(env.nearCampfire)soak=clamp(soak-0.045*d,0,1);
 else if(env.indoors)soak=clamp(soak-0.028*d,0,1);
 else if(env.inCab)soak=clamp(soak-0.014*d,0,1);
 else if(env.underAwning)soak=clamp(soak-0.006*d,0,1);
 else if(rain>0.02)soak=clamp(soak+rain*(1-gear.rain)*(env.openVehicle?1.25:1)*0.014*d,0,1);
 else if(snow>0.02)soak=clamp(soak+snow*(1-gear.rain*.7)*0.004*d,0,1);
 else soak=clamp(soak-0.004*d,0,1);

 const windCut=Math.max(gear.cold,gear.rain*.75);
 const rawWind=env.indoors||env.inCab?0:((env.windMs??3)*(env.underAwning?.5:1)+(env.openVehicle?Math.abs(env.vehicleSpeed||0)*.6:0))*(1-windCut*.6);
 const apparentTempC=(env.tempC??15)-Math.min(9,rawWind*0.45)-soak*11;
 const coldDeficit=env.indoors||env.inCab||env.nearCampfire?0:Math.max(0,15-apparentTempC)*(1-gear.cold);
 const nowMin=Number.isFinite(env.nowMinutes)?env.nowMinutes:0;
 const warmBonus=(nowMin<c.warmUntil?c.warmPower:0)+(env.warmMealActive?14:0);

 const stress=env.indoors||env.inCab||env.nearCampfire?0:clamp((coldDeficit-warmBonus*0.45)/14+(shelteredRain?soak*0.2:soak*(1-gear.rain*0.5)*0.35),0,1);
 let exposure=c.exposure;
 if(stress>0.25)exposure=clamp(exposure+stress*0.0085*d,0,1);
 else{
  const rec=env.indoors||env.nearCampfire?0.04:env.inCab?0.02:0.012;
  exposure=clamp(exposure-rec*d,0,1);
 }

 let target,tau;
 if(env.indoors||env.nearCampfire){target=Math.min(100,86+(warmBonus>0?12:0)-soak*18);tau=18}
 else if(env.inCab){target=Math.min(90,76+(warmBonus>0?10:0)-soak*15);tau=25}
 else{target=clamp(76+warmBonus*0.7-coldDeficit*1.3-soak*18-exposure*38,5,98);tau=target<c.value?36:18}

 const value=clamp(c.value+(target-c.value)*(1-Math.exp(-d/tau)),0,100);
 return {value,soak,exposure,warmUntil:c.warmUntil,warmPower:c.warmPower};
}

export function comfortEffects(comfort){
 const c=normalizeComfort(comfort);
 if(c.value>=80)return Object.freeze({band:'cozy',label:'Cozy',energyDrain:.85,speed:1,canSprint:true,vignette:0,passiveEnergy:.08});
 if(c.value>=55)return Object.freeze({band:'ok',label:'Comfortable',energyDrain:1,speed:1,canSprint:true,vignette:0,passiveEnergy:0});
 if(c.value>=30)return Object.freeze({band:'chilly',label:c.soak>=.45?'Damp':'Chilly',energyDrain:1.25,speed:.95,canSprint:true,vignette:.35,passiveEnergy:0});
 return Object.freeze({band:'cold',label:c.soak>=.45?'Soaked & Cold':'Chilled',energyDrain:1.55,speed:.88,canSprint:false,vignette:.85,passiveEnergy:0});
}

export function comfortAdvice(comfort,env={}){
 const c=normalizeComfort(comfort),fx=comfortEffects(c);
 if(env.indoors)return c.soak>0.2?'Drying off indoors.':'Warm & sheltered indoors.';
 if(env.nearCampfire)return 'Warming by the campfire.';
 if(env.inCab)return 'Inside a heated vehicle cab.';
 if(fx.band==='cozy')return 'Warm and comfortable — energy lasts longer.';
 if(c.soak>=0.45&&!env.jacketId)return 'Soaked in the wet. A Rain Shell, indoor shelter, or cab will dry you out.';
 if(c.soak>=0.45)return 'Getting damp outdoors. Step under an awning, into a cab, or indoors to dry off.';
 if(fx.band==='cold'||fx.band==='chilly'){
  return env.jacketId==='winter-parka'?'Extended cold is creeping in — hot coffee, warm soup, or shelter helps.':
   'Cold chill building up. A Winter Parka, hot coffee, or warm shelter helps.';
 }
 if(env.underAwning)return 'Sheltered under an awning out of the rain.';
 return 'Conditions feel comfortable.';
}

export function shelterAt(pos,{indoors=false,shop=false,drivingActive=false,openVehicle=false,awnings=[],camps=[],campfireUntil=0,nowMinutes=0}={}){
 const isIndoor=!!(indoors||shop);
 const inCab=!!(drivingActive&&!openVehicle&&!isIndoor);
 let underAwning=false,nearCampfire=false;
 if(!isIndoor&&pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.z)){
  for(const a of awnings||[]){if(a&&Math.hypot(pos.x-a.x,pos.z-a.z)<=2.4){underAwning=true;break}}
  if(nowMinutes<campfireUntil){
   for(const c of camps||[]){if(c&&Math.hypot(pos.x-c.x,pos.z-c.z)<=6.5){nearCampfire=true;break}}
  }
 }
 return {indoors:isIndoor,inCab,openVehicle:!!(drivingActive&&openVehicle&&!isIndoor),underAwning,nearCampfire};
}

export function fishingWeatherMod(localWeather){
 const id=localWeather?.id;
 if(id==='overcast'||id==='drizzle')return Object.freeze({waitMult:.80,rareBonus:.15});
 if(id==='rain')return Object.freeze({waitMult:.90,rareBonus:.10});
 if(id==='storm')return Object.freeze({waitMult:1.30,rareBonus:.05});
 return Object.freeze({waitMult:1,rareBonus:0});
}

export function wildlifeWeatherMod(localWeather){
 const id=localWeather?.id;
 if(id==='fog'||id==='rain'||id==='storm'||id==='snow'||localWeather?.precipKind==='sleet')return Object.freeze({fleeMult:.75});
 if(id==='drizzle')return Object.freeze({fleeMult:.85});
 return Object.freeze({fleeMult:1});
}
