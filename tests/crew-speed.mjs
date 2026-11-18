import assert from 'node:assert/strict';
import {townPopulation,GAME_MINUTES_PER_SECOND,WALK_SPEED} from '../dist/population.js';
import {MAP} from '../dist/map-definition.js';
import {workforcePose,fellerSlot,HAUL_SPEED,WORK_HOURS,SAWYER_CYCLE_MIN,FELLER_PHASE_MIN,SAWYER_PHASE_MIN,FELLER_CHAIN} from '../dist/workforce-pose.js';

// Owner eye-check 0.35.20: the Ridgeline crew walked between stations at super speed (up to 138 m/s: fixed minutes per walk on 25-163 m routes).
// The visible speed (distance moved per real second at the game clock's rate) must never exceed a normal walk: WALK_SPEED (the pedestrians' pace),
// well under the player's walk (4.5 m/s, game.js). No teleports either: the same cap holds across every phase change, the midday block change included.
const CAP=WALK_SPEED*1.001,PLAYER_WALK=4.5;
assert.ok(WALK_SPEED<PLAYER_WALK&&HAUL_SPEED<=WALK_SPEED,'the crew pace is under the player walk and a carry is not faster than a walk');
const pop=townPopulation(),crew=['ridgeline-fellers#1','ridgeline-fellers#2','ridgeline-sawyer'].map(post=>pop.people.find(p=>p.post===post));
assert.ok(crew.every(Boolean),'the three crew posts are held');
const a={},b={},ctx={seed:MAP.seed};
const sweep=(person,day,hz)=>{const dt=1/hz,dm=dt*GAME_MINUTES_PER_SECOND;let max=0,at=0,phase='',walked=0,claimed=0;
 workforcePose(a,person,day,WORK_HOURS[0],ctx);
 for(let i=1,m=WORK_HOURS[0]+dm;m<=WORK_HOURS[1];i++,m=WORK_HOURS[0]+i*dm){workforcePose(b,person,day,m,ctx);const v=Math.hypot(b.x-a.x,b.z-a.z)/dt;
  if(v>max){max=v;at=m;phase=b.phase}if(a.moving&&b.moving&&a.phase===b.phase){walked+=v*dt;claimed+=b.speed*dt}Object.assign(a,b)}
 return {max,at,phase,walked,claimed}};
// a full working day (06:00-18:00) at 60 Hz for three days, and 30/144 Hz for one, every worker
for(const person of crew)for(const [day,hz] of [[1,60],[4,60],[7,60],[2,30],[3,144]]){
 const r=sweep(person,day,hz);
 assert.ok(r.max<=CAP,`${person.post} day ${day} ${hz} Hz: ${r.max.toFixed(2)} m/s at minute ${r.at.toFixed(2)} (${r.phase}) over the ${WALK_SPEED} m/s cap`);
 assert.ok(r.walked>50&&Math.abs(r.walked-r.claimed)/r.claimed<.05,`${person.post} day ${day}: the pose's speed (${r.claimed.toFixed(0)} m) matches how far it walks (${r.walked.toFixed(0)} m), so the legs keep up`);
}
// ten days at a coarse 1 s step (a chord is never longer than the path, so this still bounds the speed)
for(const person of crew)for(let day=1;day<=10;day++){const r=sweep(person,day,1);assert.ok(r.max<=CAP,`${person.post} day ${day} coarse: ${r.max.toFixed(2)} m/s`)}
// Calm crew (owner 2026-11-18, prompts/opus-timber-storage.md): at the real clock rate (GAME_MINUTES_PER_SECOND game minutes a real second) a tree's chop + buck takes the
// visible feller at least a real minute, each bend 3 s, the sawyer's feed 4 s and saw 20 s; measured from the poses as well; only one feller works at a time.
const SEC=m=>m/GAME_MINUTES_PER_SECOND,P=FELLER_PHASE_MIN,SP=SAWYER_PHASE_MIN;
assert.ok(SEC(P.chop+P.buck)>=60&&SEC(P.bend)>=3,`feller: chop+buck ${SEC(P.chop+P.buck)} s, bend ${SEC(P.bend)} s`);
assert.ok(SEC(SP.pick)>=3&&SEC(SP.feed)>=4&&SEC(SP.saw)>=20&&SEC(SP.belt)>=3&&SEC(SP.hut)>=3,'sawyer station phases: '+JSON.stringify(SP));
let treeSec=0,trees=0;{let on=false;for(const [who,turn] of [[crew[0],FELLER_CHAIN.cutter],[crew[1],FELLER_CHAIN.hauler]])for(let m=turn[0],run=0;m<turn[1];m+=1/120){workforcePose(a,who,1,m,ctx);const at=a.phase==='chop'||a.phase==='buck';if(at){run+=1/60;if(!on)trees++}else if(on){treeSec=treeSec?Math.min(treeSec,run):run;run=0}on=at}}
assert.ok(treeSec>=60-1/30,`measured at 60 Hz: the quickest visible tree took ${treeSec.toFixed(1)} real seconds (chop + buck)`);
for(let m=WORK_HOURS[0];m<=WORK_HOURS[1];m+=.5){let busy=0;for(const w of crew.slice(0,2)){workforcePose(a,w,4,m,ctx);if(a.phase!==null)busy++}assert.ok(busy<=1,'one feller at a time, minute '+m)}// the slots are long enough for their walks: a feller's slot is 20..400 game minutes, the sawyer's loop more than its 2.45 station minutes
const s=fellerSlot(crew[0],1,400,ctx);assert.ok(s.end-s.start>20&&s.end-s.start<400,'feller slot '+(s.end-s.start).toFixed(1));
assert.ok(SAWYER_CYCLE_MIN>6&&SAWYER_CYCLE_MIN<40,'sawyer loop '+SAWYER_CYCLE_MIN.toFixed(1));
console.log(`PASS crew-speed.mjs: the Ridgeline crew never moves faster than ${WALK_SPEED} m/s (pedestrian pace, under the player's ${PLAYER_WALK} m/s walk) over full working days at 30/60/144 Hz and ten days coarse, no teleports at phase or block changes, and the pose's speed matches the distance walked (feller slot ${(s.end-s.start).toFixed(0)} game min, sawyer loop ${SAWYER_CYCLE_MIN.toFixed(1)} game min); calm crew: a visible tree takes >= ${treeSec.toFixed(0)} real s (${trees} trees on day 1), one feller at a time.`);
