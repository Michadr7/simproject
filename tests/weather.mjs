// Weather, storm, elevation snow, and player comfort rules + integration checks.
import assert from 'node:assert/strict';
import {
 WEATHER_IDS,WEATHER_META,CLOTHING_PROTECTION,WARM_CONSUMABLES,
 dayArc,weatherAt,dayWeatherWord,forecastDays,localWeatherAt,
 freshStormState,stepStorm,stepGroundWet,weatherSkyAdjust,
 freshComfort,normalizeComfort,applyWarmBoost,applyWarmth,applyCampRestComfort,
 stepComfort,comfortEffects,comfortAdvice,shelterAt,fishingWeatherMod,wildlifeWeatherMod
} from '../dist/weather.js';
import {skyAt} from '../dist/daynight.js';
import {createAudio} from '../dist/audio.js';
import {castFishing} from '../dist/fishing.js';
import {effectiveFleeRadius} from '../dist/wildlife.js';
import {ITEMS,itemById} from '../dist/items.js';
import {DOWNTOWN_SERVICES} from '../dist/downtown-rooms.js';
import {ALL_IRONWOOD_SERVICES} from '../dist/ironwood-interiors.js';
import {normalizeProgress} from '../dist/jobs.js';
import {SCHEMA} from '../dist/ownership.js';
import {createPhoneWeather} from '../dist/phone-weather.js';
import {readFileSync} from 'node:fs';

const SEED=202611;

// 1. Determinism & smooth continuity across midnight and day 61 -> 62
assert.deepEqual(weatherAt(SEED,4,600),weatherAt(SEED,4,600),'same inputs give identical weather');
{
 const end61=weatherAt(SEED,61,1439.99),start62=weatherAt(SEED,62,0);
 assert(Math.abs(end61.windMs-start62.windMs)<2.5,'continuous across day 61 -> 62 midnight');
 assert(Math.abs(end61.cloudCover-start62.cloudCover)<0.12,'cloudCover smooth across day 61 -> 62');
 assert.equal(weatherAt(SEED,1,540).id,'clear','Day 1 morning opens clear');
 assert.equal(weatherAt(SEED,1,720).id,'clear','Day 1 noon stays clear');
 const seen=new Set();
 for(let d=2;d<=20;d++)for(const m of [240,720,1200])seen.add(weatherAt(SEED,d,m).id);
 assert(seen.size>=4&&['drizzle','rain','storm'].some(id=>seen.has(id)),'Days 2-20 roll varied & wet weather: '+[...seen].join(','));
}

// 2. Storm system: gusty wind, full precip, deterministic lightning & delayed thunder
{
 const stW=weatherAt(SEED,5,600,'storm');
 assert.equal(stW.id,'storm');
 assert.equal(stW.windLevel,2.0);
 assert.equal(stW.precipRate,1.0);
 assert.equal(stW.stormIntensity,1.0);
 let st=freshStormState(SEED),flashes=0,thunders=0;
 st.cooldown=0.2;
 for(let i=0;i<200;i++){
  const r=stepStorm(st,0.05,stW.stormIntensity);
  st=r.state;
  if(r.flash>0.7)flashes++;
  if(r.thunderEvent>0)thunders++;
 }
 assert(flashes>=1,'storm triggers lightning flash');
 assert(thunders>=1,'lightning schedules delayed thunder event');
 // Re-running from same initial seed reproduces identical sequence
 let stA=freshStormState(SEED),stB=freshStormState(SEED);
 for(let i=0;i<300;i++){
  const a=stepStorm(stA,0.1,1),b=stepStorm(stB,0.1,1);
  stA=a.state;stB=b.state;
  assert.deepEqual(a,b,'stepStorm is deterministic without Math.random');
 }
}

// 3. Elevation snow & regional micro-climates
{
 const rainDay=weatherAt(SEED,5,540,'rain');
 const valley=localWeatherAt(rainDay,{x:0,z:0,y:1,zone:'alder',forest:0});
 const midElev=localWeatherAt(rainDay,{x:260,z:-240,y:29,zone:'wild',forest:0});
 const passPeak=localWeatherAt(rainDay,{x:320,z:-260,y:45,zone:'wild',forest:0});
 const bay=localWeatherAt(rainDay,{x:20,z:220,y:1,zone:'kaspian',forest:0});
 const woods=localWeatherAt(rainDay,{x:-20,z:-120,y:10,zone:'forest',forest:1});
 assert.equal(valley.precipKind,'rain','rain stays rain in Ironwood Valley');
 assert.equal(midElev.precipKind,'sleet','rain transitions to sleet on Blackstone grade');
 assert.equal(passPeak.precipKind,'snow','valley rain flips to Mountain Snow at y=45 m');
 assert.equal(passPeak.region,'Blackstone Pass');
 assert(passPeak.snowCover>0.5,'elevation snow carries visual snowCover');
 assert(bay.windMs>valley.windMs&&bay.tempC<valley.tempC,'Kaspian Bay is windier & cooler');
 assert(woods.windMs<valley.windMs&&woods.precipRate<valley.precipRate,'forest canopy shields wind & rain');
}

// 4. Ground wetness & sky modulation
{
 const stormV=localWeatherAt(weatherAt(SEED,5,600,'storm'));
 const clearV=localWeatherAt(weatherAt(SEED,1,600,'clear'));
 let wet=0;
 for(let i=0;i<240;i++)wet=stepGroundWet(wet,stormV,0.25);
 assert(wet>0.85&&wet<=1,'ground wet rises smoothly in storm');
 for(let i=0;i<600;i++)wet=stepGroundWet(wet,clearV,0.25);
 assert(wet<0.1,'ground wet dries out in warm sun & wind');

 const baseSky=skyAt(720);
 assert.deepEqual(baseSky,skyAt(720,{}),'skyAt without weather unchanged');
 const stormSky=skyAt(720,{weather:weatherSkyAdjust(stormV,1)});
 assert(stormSky.lightStrength<baseSky.lightStrength*0.4,'storm dims sunlight');
 assert(stormSky.fogFar<baseSky.fogFar,'storm pulls fog closer');
 assert(stormSky.cloudCover>0.9,'storm fills sky cloudCover');
 assert(stormSky.hemiStrength>baseSky.hemiStrength,'lightning flash spikes hemisphere light');
}

// 5. Player comfort "in-between" curve & gear/shelter recovery
{
 const stormL=localWeatherAt(weatherAt(SEED,5,600,'storm'));
 // Short 15s dash in storm stays Comfortable (>= 55)
 let dash=freshComfort();
 for(let i=0;i<60;i++)dash=stepComfort(dash,{...stormL,nowMinutes:600},0.25);
 assert(dash.value>=55,'brief 15s dash in storm stays Comfortable: '+dash.value.toFixed(1));

 // Extended 180s storm exposure without jacket drops into < 30 (Soaked & Cold)
 let soaked=freshComfort();
 for(let i=0;i<720;i++)soaked=stepComfort(soaked,{...stormL,nowMinutes:600},0.25);
 const coldFx=comfortEffects(soaked);
 assert(soaked.value<30,'extended 180s storm exposure turns cold: '+soaked.value.toFixed(1));
 assert.equal(coldFx.band,'cold');
 assert.equal(coldFx.label,'Soaked & Cold');
 assert.equal(coldFx.energyDrain,1.55);
 assert.equal(coldFx.speed,0.88);
 assert.equal(coldFx.canSprint,false);

 // Rain shell blocks soak significantly
 let shell=freshComfort();
 for(let i=0;i<720;i++)shell=stepComfort(shell,{...stormL,jacketId:'rain-shell',nowMinutes:600},0.25);
 assert(shell.soak<0.35&&shell.value>soaked.value+25,'rain-shell strongly limits soaking');

 // Winter parka protects against Blackstone Pass snow
 const snowL=localWeatherAt(weatherAt(SEED,5,600,'rain'),{x:320,z:-260,y:45});
 let parka=freshComfort();
 for(let i=0;i<720;i++)parka=stepComfort(parka,{...snowL,jacketId:'winter-parka',nowMinutes:600},0.25);
 assert(parka.value>=55,'winter-parka stays comfortable in mountain snow: '+parka.value.toFixed(1));

 // Indoors + hot coffee/clam chowder dries soak & restores Cozy (>= 80)
 let cozy=applyWarmth(soaked,600,'clam-chowder');
 for(let i=0;i<400;i++)cozy=stepComfort(cozy,{...stormL,indoors:true,warmMealActive:true,nowMinutes:605},0.25);
 const cozyFx=comfortEffects(cozy);
 assert(cozy.value>=80&&cozy.soak<0.05,'indoors + warm soup dries soak & reaches Cozy: '+cozy.value.toFixed(1));
 assert.equal(cozyFx.band,'cozy');
 assert.equal(cozyFx.energyDrain,0.85);
 assert(comfortAdvice(soaked,{}).includes('Rain Shell'));

 // Campfire tent rest restores comfort & activates warmth
 const rested=applyCampRestComfort(soaked,true,360);
 assert.equal(rested.value,100);
 assert.equal(rested.soak,0);
}

// 6. Forecast, shelter (awning / cab vs open ATV / campfire), fishing, wildlife, items, saves, audio
{
 const f=forecastDays(SEED,1,3);
 assert.equal(f.length,3);
 assert(f.every(d=>d.passLowC<d.valleyLowC),'forecast reflects cooler Blackstone Pass temps');

 const shAwning=shelterAt({x:40.5,z:-104},{awnings:[{x:40.5,z:-104}]});
 assert.equal(shAwning.underAwning,true);
 const shCab=shelterAt({x:0,z:0},{drivingActive:true,openVehicle:false});
 assert.equal(shCab.inCab,true);
 const shAtv=shelterAt({x:0,z:0},{drivingActive:true,openVehicle:true});
 assert.equal(shAtv.openVehicle,true);
 assert.equal(shAtv.inCab,false);
 const shCamp=shelterAt({x:100,z:100},{camps:[{x:102,z:100}],campfireUntil:500,nowMinutes:450});
 assert.equal(shCamp.nearCampfire,true);

 const over=weatherAt(SEED,2,540,'overcast'),storm=weatherAt(SEED,2,540,'storm');
 const cBase=castFishing({location:{kind:'basin',id:'lake-basin'},region:'blackstone-lake',hasRod:true,bait:'lure',seed:77,minutes:540});
 const cOver=castFishing({location:{kind:'basin',id:'lake-basin'},region:'blackstone-lake',hasRod:true,bait:'lure',seed:77,minutes:540,weather:over});
 const cStorm=castFishing({location:{kind:'basin',id:'lake-basin'},region:'blackstone-lake',hasRod:true,bait:'lure',seed:77,minutes:540,weather:storm});
 assert(cOver.state.biteAt<cBase.state.biteAt&&cStorm.state.biteAt>cBase.state.biteAt,'overcast speeds bite, storm slows bite');
 assert(effectiveFleeRadius('deer',weatherAt(SEED,2,540,'fog'))<effectiveFleeRadius('deer',null),'fog shrinks wildlife flee radius');

 assert(ITEMS.some(i=>i.id==='rain-shell'&&i.buyable===false)&&itemById('winter-parka').slotBonus===3,'weather gear in ITEMS');
 assert(DOWNTOWN_SERVICES['ironwood-clothes'].actions.some(a=>a.item==='rain-shell')&&ALL_IRONWOOD_SERVICES['eden-outdoors'].actions.some(a=>a.item==='winter-parka'),'weather gear stocked in shops');
 const saved=normalizeProgress({schema:SCHEMA,comfort:{value:42.5,soak:.6,exposure:.4,warmUntil:900,warmPower:12}});
 assert.equal(saved.schema,SCHEMA);
 assert.equal(saved.comfort.value,42.5);

 // Fake Web Audio check: ambience({rain}) & thunder()
 class Param{constructor(val=0){this.value=val;this.target=val}setTargetAtTime(val){this.target=val}setValueAtTime(val){this.value=val}linearRampToValueAtTime(val){this.ramp=val}}
 class Node{constructor(kind,ctx){this.kind=kind;this.connections=[];ctx.nodes.push(this)}connect(n){this.connections.push(n);return n}start(){this.started=true}stop(){this.stopped=true}}
 class FakeCtx{
  constructor(){this.nodes=[];this.currentTime=0;this.sampleRate=100;this.state='suspended';this.destination=new Node('destination',this)}
  createGain(){const n=new Node('gain',this);n.gain=new Param(1);return n}
  createBiquadFilter(){const n=new Node('filter',this);n.frequency=new Param();n.Q=new Param();return n}
  createOscillator(){const n=new Node('osc',this);n.frequency=new Param();return n}
  createBuffer(_,len){return {duration:len/this.sampleRate,getChannelData:()=>new Float32Array(len)}}
  createBufferSource(){const n=new Node('src',this);return n}
  resume(){this.state='running'}
 }
 const mem=(()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}})();
 const au=createAudio({AudioContextClass:FakeCtx,storage:mem});
 au.unlock();
 au.ambience({outdoors:true,windSpeed:12,rain:.8,storm:1,sheltered:false});
 assert.equal(au.thunder(.9),true,'thunder fires on active AudioContext');

 // Phone Weather UI + DOM hooks in dist/index.html
 const html=readFileSync('dist/index.html','utf8');
 for(const id of ['weatherChip','phoneApp-weather','phoneScreen-weather','phoneWeather','phoneComfort','phoneComfortMeter']){
  assert(html.includes(`id="${id}"`),`dist/index.html contains #${id}`);
 }
 const mkEl=tag=>{const c=[];return {tagName:tag,children:c,dataset:{},className:'',textContent:'',append(...a){c.push(...a)},replaceChildren(...a){c.length=0;c.push(...a)}}};
 const root=mkEl('div'),doc={getElementById:id=>id==='phoneWeather'?root:null,createElement:mkEl};
 const base=weatherAt(SEED,2,540,'rain'),local=localWeatherAt(base,{x:320,z:-260,y:45});
 const pw=createPhoneWeather({document:doc,getWeather:()=>({base,local,comfort:freshComfort(),effects:comfortEffects(freshComfort()),shelter:{},jacketId:'winter-parka',groundWet:.6,forecast:forecastDays(SEED,1,3),advice:'Stay warm'})});
 pw.render();
 assert(root.children.length>=4,'Phone Weather renders hero, comfort, heading, and 3-day forecast');
}

console.log(`PASS weather: ${WEATHER_IDS.length} states, storm lightning/thunder, elevation snow (${dayWeatherWord(SEED,1)}), comfort curve, sky/audio/fishing/wildlife/gear hooks`);
