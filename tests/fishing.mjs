// B4 Fishing pure rules & save persistence tests (dist/fishing.js + dist/jobs.js).
import assert from 'node:assert/strict';
import {fishingAt} from '../dist/map-definition.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {
 FISHING_SKILL,FISHING_LOG_LIMIT,FISHING_TIMING,FISHING_SPECIES,FISHING_CATCH_TABLES,
 isFishingPeak,fishingWaterFor,castFishing,hookFishing,cancelFishing,stepFishing,recordFishingCatch,normalizeFishingLog
} from '../dist/fishing.js';

// 1. Peak hours & water eligibility paired with real map fishingAt()
assert.equal(FISHING_SKILL,'fishing');
assert.equal(isFishingPeak(360),true);assert.equal(isFishingPeak(1080),true);assert.equal(isFishingPeak(720),false);
assert.equal(isFishingPeak(-360),true); // 18:00 wrapped
assert.equal(fishingWaterFor(fishingAt(650,-470),'blackstone-lake'),'blackstone-lake');
assert.equal(fishingWaterFor(fishingAt(540,-470),'blackstone-lake'),'blackstone-lake');
assert.equal(fishingWaterFor(fishingAt(600,-560),'blackstone-lake'),'blackstone-lake');
assert.equal(fishingWaterFor({kind:'water',id:'sea'},'kaspian-bay'),'kaspian-bay');
assert.equal(fishingWaterFor({kind:'water',id:'sea'},'blackstone-lake'),null);
assert.equal(fishingWaterFor(fishingAt(100,-300),'blackstone-lake'),null);

// 2. Cast validation & modifiers
const dock=fishingAt(650,-470);
assert.equal(castFishing({location:null,hasRod:true,bait:'worms',seed:1}).error,'invalid-water');
assert.equal(castFishing({location:dock,hasRod:false,bait:'worms',seed:1}).error,'need-rod');
assert.equal(castFishing({location:dock,hasRod:true,bait:'bread',seed:1}).error,'need-bait');
assert.equal(castFishing({location:dock,hasRod:true,bait:'worms',seed:-1}).error,'invalid-seed');

const cWorm=castFishing({location:dock,hasRod:true,bait:'worms',seed:12345,minutes:720,level:1});
const cPeakLure=castFishing({location:dock,hasRod:true,bait:'lure',seed:12345,minutes:360,level:10});
assert.equal(cWorm.consumeBait,true);assert.equal(cPeakLure.consumeBait,false);
assert(cPeakLure.state.biteAt<cWorm.state.biteAt,'peak hours + lure shorten wait');
assert((cPeakLure.state.biteUntil-cPeakLure.state.biteAt)>(cWorm.state.biteUntil-cWorm.state.biteAt),'higher level widens bite window');
assert(Math.abs((castFishing({location:dock,hasRod:true,bait:'worms',seed:12345,minutes:720,level:99}).state.biteUntil-castFishing({location:dock,hasRod:true,bait:'worms',seed:12345,minutes:720,level:99}).state.biteAt)-(FISHING_TIMING.biteWindowSeconds+FISHING_TIMING.maxBiteWindowBonus))<1e-12);

// 3. Early hook, missed bite, cancel
{const early=hookFishing(cWorm.state);assert.equal(early.state.phase,'ended');assert.equal(early.state.reason,'early-hook');
 const miss=stepFishing(cWorm.state,cWorm.state.biteUntil+.05);assert.equal(miss.state.phase,'ended');assert.equal(miss.state.reason,'missed-bite');
 assert.equal(cancelFishing(cWorm.state).state.reason,'cancelled');
}

// 4. Deterministic reel & 30/60/144 Hz frame independence -> catch
function simulateCatch(hz,pulse){
 let s=castFishing({location:dock,hasRod:true,bait:'worms',seed:777,minutes:360,level:5}).state;
 const dt=1/hz;
 while(s.phase==='waiting')s=stepFishing(s,dt).state;
 assert.equal(s.phase,'bite');
 s=hookFishing(s).state;assert.equal(s.phase,'reeling');
 let out=null;
 for(let i=0;i<hz*20&&s.phase==='reeling';i++){
  const res=stepFishing(s,dt,pulse(s));
  s=res.state;
  if(res.catch){out=res;break}
 }
 return {s,out};
}
const pulse=s=>s.tension<.75;
const r30=simulateCatch(30,pulse),r60=simulateCatch(60,pulse),r144=simulateCatch(144,pulse);
assert(r30.out&&r60.out&&r144.out,'caught across 30/60/144 Hz');
assert.deepEqual(r60.out.catch,r30.out.catch);assert.deepEqual(r144.out.catch,r60.out.catch);
assert.equal(r60.s.phase,'ended');assert.equal(r60.s.reason,'caught');
assert.equal(stepFishing(r60.s,.1,true).catch,undefined,'catch emits only once on transition');

// 5. Over-tension snap & zero-reel escape
{let s=stepFishing(cWorm.state,cWorm.state.biteAt).state;s=hookFishing(s).state;
 let snapped=s;for(let i=0;i<400&&snapped.phase==='reeling';i++)snapped=stepFishing(snapped,1/60,true).state;
 assert.equal(snapped.reason,'line-broke');
 let escaped=hookFishing(stepFishing(castFishing({location:dock,hasRod:true,bait:'lure',seed:42,minutes:360,level:1}).state,10).state).state;
 if(escaped.phase==='reeling'){for(let i=0;i<400&&escaped.phase==='reeling';i++)escaped=stepFishing(escaped,1/60,false).state;assert.equal(escaped.reason,'fish-escaped')}
}

// 6. Kaspian Bay table & persistent catch log in normalizeProgress
{const kc=castFishing({location:{kind:'water',id:'sea'},region:'kaspian-bay',hasRod:true,bait:'lure',seed:99,minutes:400,level:1}).state;
 const hooked=hookFishing(stepFishing(kc,kc.biteAt).state).state;
 assert(FISHING_CATCH_TABLES['kaspian-bay'].some(e=>e.speciesId===hooked.fish.speciesId));
 let log=[];for(let i=0;i<FISHING_LOG_LIMIT+5;i++)log=recordFishingCatch(log,{...hooked.fish,weightGrams:500+i});
 assert.equal(log.length,FISHING_LOG_LIMIT,'capped at 30');assert.equal(log[0].weightGrams,500+FISHING_LOG_LIMIT+4,'newest first');
 const saved=normalizeProgress({...freshProgress(),fishingLog:[...log,{bad:true},{speciesId:'kraken',waterId:'kaspian-bay',weightGrams:100,valueCents:10,xp:1}]});
 assert.equal(saved.fishingLog.length,FISHING_LOG_LIMIT);
 assert.equal(normalizeProgress(freshProgress()).fishingLog,undefined,'empty omitted');
}

console.log(`PASS fishing: B4 rules, ${Object.keys(FISHING_SPECIES).length} species, 30/60/144 Hz reel stability, snap/escape gates, and persistent catch log (${FISHING_LOG_LIMIT} cap)`);
