import assert from 'node:assert/strict';
import {makeSessionClock,GAME_MINUTES_PER_SECOND,CLOCK_INTERVAL_S,SNAP_GAME_MINUTES,MAX_CATCHUP_PER_S,validClock,absOf,dayMinute,canSync,syncAdvance,SYNC_WARNING} from '../dist/session-clock.js';
import {GAME_MINUTES_PER_SECOND as POP_RATE} from '../dist/population.js';
import {CLOCK_GAME_MINUTES_PER_SECOND,validClockMessage,createLobby,PROTOCOL} from '../dist/relay-protocol.js';
import {advanceTime,freshRoutine} from '../dist/routine.js';
import {gameMinutes} from '../dist/gigs.js';

assert.equal(GAME_MINUTES_PER_SECOND,POP_RATE,'same rate as the game clock');
assert.equal(CLOCK_GAME_MINUTES_PER_SECOND,GAME_MINUTES_PER_SECOND,'relay and clock agree on the rate');

// validation: junk is never a clock
for(const bad of [null,undefined,{},{day:0,minutes:5},{day:1.5,minutes:5},{day:1,minutes:-1},{day:1,minutes:1440},{day:1,minutes:NaN},{day:'2',minutes:5},{day:1e9,minutes:5},{day:1,minutes:Infinity}]){
 assert.equal(validClock(bad),false);assert.equal(validClockMessage(bad),false);
}
assert(validClock({day:3,minutes:0})&&validClock({day:3,minutes:1439.9})&&validClockMessage({day:3,minutes:600}));

// alone / host: the session clock is the saved clock
const solo=makeSessionClock();
assert(solo.isHost&&solo.mode==='local'&&!solo.following&&solo.savedClockMoves);
solo.setLocal(4,600);assert.equal(solo.day,4);assert.equal(solo.minutes,600);assert.equal(solo.abs,absOf(4,600));
solo.advance(10);assert.equal(solo.minutes,600,'advance does nothing for the local host (the save drives it)');
assert.equal(solo.receiveHost({day:9,minutes:1}),false,'a host never follows anyone');assert.equal(solo.day,4);
assert.equal(solo.setLocal(NaN,1),false);

// a joiner gets the host time immediately, with no easing
const j=makeSessionClock();j.setHost(false);j.setMode('visit');
j.setLocal(2,100);
assert(j.following&&!j.savedClockMoves);
assert.equal(j.receiveHost({day:7,minutes:300}),true);
assert.equal(j.day,7);assert.equal(j.minutes,300);assert(j.synced,'first message snaps at once');
// runs at the same rate
j.advance(10);assert.equal(j.minutes,300+10*GAME_MINUTES_PER_SECOND);
// junk, negative, backwards and old messages are ignored
const before=j.abs;
for(const bad of [{day:-1,minutes:5},{day:7,minutes:-5},{day:7,minutes:'x'},null,{day:7.5,minutes:1}])assert.equal(j.receiveHost(bad),false);
assert.equal(j.receiveHost({day:7,minutes:200}),false,'a message older than the last host message is ignored');
assert.equal(j.abs,before);

// drift easing: host is 1.5 game minutes ahead; never a jump, converges, never backwards
{
 const c=makeSessionClock();c.setHost(false);c.setMode('visit');c.receiveHost({day:1,minutes:600});
 let hostAbs=absOf(1,600);const dt=1/60;let last=c.abs,maxStep=0,elapsed=0;
 for(let i=0;i<60*30;i++){ // 30 real seconds; the host broadcasts at second 5 (its clock is 1.5 ahead of ours)
  hostAbs+=dt*GAME_MINUTES_PER_SECOND;
  if(i===60*5)c.receiveHost({day:1,minutes:hostAbs+1.5});
  c.advance(dt);const step=(c.abs-last)/dt;assert(step>=0,'time never runs backwards');maxStep=Math.max(maxStep,step);last=c.abs;elapsed+=dt;
 }
 assert(maxStep<=GAME_MINUTES_PER_SECOND+MAX_CATCHUP_PER_S+1e-6,'no jump: '+maxStep+' game min per real second');
 assert(Math.abs(c.abs-(hostAbs+1.5))<.05,'converged to the host: '+(c.abs-hostAbs));
 assert.equal(c.debt,0);
}
// a client BEHIND by 1.5 and AHEAD by 1.5 both converge, and an ahead client slows but never stops or reverses
for(const drift of [1.5,-1.5,-10,12]){
 const c=makeSessionClock();c.setHost(false);c.setMode('sync');c.receiveHost({day:3,minutes:700});
 for(let i=0;i<80;i++)c.advance(.5); // we ran 20 game minutes on our own; the host's newer message then says we are drift off
 let last=c.abs;const start=c.abs;{const m=dayMinute(start+drift);assert(c.receiveHost({day:m.day,minutes:m.minutes}),'accepted');}
 const target=start+drift;const dt=.016;let n=0;
 for(;n<60*60&&c.debt!==0;n++){c.advance(dt);assert(c.abs>=last);assert((c.abs-last)/dt<=GAME_MINUTES_PER_SECOND+MAX_CATCHUP_PER_S+1e-6);last=c.abs}
 assert.equal(c.debt,0,'eased out for drift '+drift);
 assert(Math.abs(c.abs-(target+n*dt*GAME_MINUTES_PER_SECOND))<.05,'ends at the host time for drift '+drift);
}
// a huge drift (more than 15 game minutes) is a snap, not an easing
{const c=makeSessionClock();c.setHost(false);c.receiveHost({day:1,minutes:100});c.receiveHost({day:1,minutes:100+SNAP_GAME_MINUTES+10});assert.equal(c.minutes,100+SNAP_GAME_MINUTES+10)}
// the day rolls over
{const c=makeSessionClock();c.setHost(false);c.receiveHost({day:5,minutes:1439});c.advance(4);assert.equal(c.day,6);assert(c.minutes<2)}
// the shared read object does not allocate: now() is the same object every time
{const c=makeSessionClock();assert.equal(c.now(),c.now());const o=c.now();c.setLocal(2,5);assert.equal(c.now(),o);assert.equal(o.day,2)}

// becoming the host stops following; losing it (impossible, but) re-arms the first-message snap
{const c=makeSessionClock();c.setHost(false);c.receiveHost({day:2,minutes:10});c.setHost(true);assert.equal(c.receiveHost({day:9,minutes:10}),false);c.setHost(false);assert.equal(c.receiveHost({day:2,minutes:10}),true,'a new host starts a fresh sequence')}

// the host broadcasts every 30 s (injected time: dt only) and at once when forced
{const h=makeSessionClock();let sent=0;const dt=.5;
 for(let t=0;t<95;t+=dt)if(h.dueBroadcast(dt))sent++;
 assert.equal(sent,3,'95 s -> 3 broadcasts (at 30, 60, 90)');
 assert.equal(h.dueBroadcast(0,true),true,'forced send for a new joiner');
 h.setLocal(8,615);assert.deepEqual(h.hostMessage(),{type:'clock',day:8,minutes:615});
 const g=makeSessionClock();g.setHost(false);assert.equal(g.dueBroadcast(60),false,'a joiner never broadcasts');
 assert.equal(CLOCK_INTERVAL_S,30)}

// modes: 'visit' leaves the saved clock still, 'sync' moves it. The save is advanced exactly as game.js sessionStep does.
function sessionStep(state,sc,step){
 if(sc.mode==='local'){const next=advanceTime(state,step*.5);sc.setLocal(next.housing.day,next.routine.minutes);return next}
 sc.advance(step);
 if(sc.mode==='sync'){const d=sc.abs-gameMinutes(state);return d>0?advanceTime(state,d):state}
 return state;
}
const save={routine:{...freshRoutine(),minutes:600},housing:{day:3,lastRent:3,paidUntil:3}};
{ // visit: 3 game minutes of host time later, the saved day and minutes are untouched
 const sc=makeSessionClock();sc.setHost(false);sc.setMode('visit');sc.receiveHost({day:12,minutes:1000});
 let s=save;for(let i=0;i<360;i++)s=sessionStep(s,sc,.5);
 assert.equal(s,save,'visit returns the very same saved state');assert.equal(s.routine.minutes,600);assert.equal(s.housing.day,3);
 assert.equal(sc.day,12);assert(sc.minutes>1000,'while the session clock runs on');
}
{ // sync: the save follows the session clock
 const sc=makeSessionClock();sc.setHost(false);sc.setMode('sync');
 assert(canSync(gameMinutes(save),absOf(12,1000)));assert.equal(syncAdvance(gameMinutes(save),absOf(12,1000)),absOf(12,1000)-gameMinutes(save));
 sc.receiveHost({day:12,minutes:1000});
 let s=sessionStep(save,sc,1/60);
 assert.equal(s.housing.day,12);assert(Math.abs(s.routine.minutes-(1000+GAME_MINUTES_PER_SECOND/60))<1e-6);
 for(let i=0;i<600;i++)s=sessionStep(s,sc,.1);
 assert(Math.abs(gameMinutes(s)-sc.abs)<1e-6,'the saved clock equals the session clock');
}
assert.equal(canSync(absOf(20,0),absOf(5,0)),false,'a host day earlier than the save cannot be synced to');
assert(/Crops will grow/.test(SYNC_WARNING)&&/rent/.test(SYNC_WARNING)&&/cat/.test(SYNC_WARNING)&&/gig/.test(SYNC_WARNING));

// the relay (pure lobby): host = oldest player, only the host's clock is relayed, validated and rate limited, a joiner is sent the aged clock
{
 const out=[];let t=0;let n=0;
 const lobby=createLobby({send:(p,m)=>out.push([p,m]),close(){},newId:()=>'p'+(++n),now:()=>t});
 const hello={type:'hello',protocol:PROTOCOL,version:'0.35.9'};
 lobby.join('A',hello);lobby.join('B',hello);
 assert.equal(lobby.host,'p1');
 assert.equal(out.find(([p,m])=>p==='A'&&m.type==='welcome')[1].host,'p1');assert.equal(out.find(([p,m])=>p==='B'&&m.type==='welcome')[1].host,'p1');
 out.length=0;
 lobby.receive('B',JSON.stringify({type:'clock',day:5,minutes:5}));assert.equal(out.length,0,'a non-host clock is dropped');
 lobby.receive('A',JSON.stringify({type:'clock',day:5,minutes:-5}));lobby.receive('A',JSON.stringify({type:'clock',day:'x',minutes:5}));assert.equal(out.length,0,'junk dropped');
 t=1000;lobby.receive('A',JSON.stringify({type:'clock',day:5,minutes:100}));
 assert.deepEqual(out,[['B',{type:'clock',day:5,minutes:100}]]);out.length=0;
 t=1100;lobby.receive('A',JSON.stringify({type:'clock',day:5,minutes:101}));assert.equal(out.length,0,'faster than twice a second is dropped');
 t=11000;lobby.join('C',hello); // 10 s later: 5 game minutes aged
 const c=out.find(([p,m])=>p==='C'&&m.type==='clock');assert(c,'a joiner is sent the time at once');assert.equal(c[1].day,5);assert(Math.abs(c[1].minutes-105)<1e-9);
 out.length=0;lobby.leave('A');
 assert.equal(lobby.host,'p2');assert(out.some(([p,m])=>m.type==='host'&&m.id==='p2'),'the next oldest player is told it is the host');
}
console.log('PASS session-clock: validation, join snap, same-rate run, drift easing (no jumps, converges, never backwards), 30 s broadcast, visit vs sync, relay host rules');
