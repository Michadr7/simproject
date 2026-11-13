import assert from 'node:assert/strict';
import {BEATS,PLACES,fresh,normalizeStarter,advanceStarter,starterObjective,skipStarter,cratePay} from '../dist/starter.js';
import {isWalkable} from '../dist/world.js';
const P=s=>({starter:s});
// places we do list must be on walkable ground
for(const k of ['spawn','market','oakStreet18','farmhouse','gas','apartments'])assert(Number.isFinite(PLACES[k].x));
assert(isWalkable(PLACES.spawn.x,PLACES.spawn.z));
assert.equal(BEATS.length,10);
// normalise
assert.deepEqual(normalizeStarter(undefined,{}),fresh());
for(const p of [{completed:1},{cash:5},{vehicles:[{}]},{housing:{rented:true}},{careers:{a:1}},{properties:{x:1}}])assert.deepEqual(normalizeStarter(null,p),skipStarter());
assert.equal(normalizeStarter({step:99},{}).step,10);assert.equal(normalizeStarter({step:-4.5},{}).step,0);assert.equal(normalizeStarter({step:3,done:true},{}).step,10);
assert.equal(normalizeStarter({step:2,loanUid:'v3'},{}).loanUid,null);assert.equal(normalizeStarter({step:5,loanUid:'v3'},{}).loanUid,'v3');assert.equal(normalizeStarter({step:5,loanUid:'x;drop'},{}).loanUid,null);
assert.equal(normalizeStarter({step:10,loanUid:'v3'},{}).loanUid,null);
assert.deepEqual(normalizeStarter('junk',{}),fresh());
// the full path, with wrong events refused at every step
const order=['read-message','delivered','ate','arrived','delivered-crates','refuelled','note-given','gig-done','rented','slept'];
let p=P(fresh()),cash=0;
assert.equal(starterObjective(p).aim,'market');
for(let i=0;i<10;i++){
 for(const wrong of ['slept','read-message','nonsense','rented'])if(wrong!==order[i]&&!(i>=6&&i<=7&&['note-given','gig-done'].includes(wrong))&&!(i===4&&wrong==='loaded'))assert(advanceStarter(p,wrong).error,`step ${i} refuses ${wrong}`);
 if(i===4){assert(advanceStarter(p,'delivered-crates',{quality:50}).error);const l=advanceStarter(p,'loaded');p={starter:l.state};assert(advanceStarter(p,'loaded').error)}
 if(i===3){const r=advanceStarter(p,'arrived',{loanUid:'v4'});assert.equal(r.state.loanUid,'v4');p={starter:r.state};cash+=r.cash;continue}
 const r=advanceStarter(p,order[i],{quality:70});assert(r.state,order[i]);cash+=r.cash;p={starter:r.state};
 if(i===4)assert.equal(r.cash,cratePay(70));
}
assert(p.starter.done);assert.equal(p.starter.step,10);assert.equal(p.starter.loanUid,null);assert(advanceStarter(p,'slept').error);assert.equal(starterObjective(p),null);
assert.equal(cash,300+2500+cratePay(70)+3200);
assert.equal(cratePay(100),4000);assert.equal(cratePay(0),2800);
// beats 7 and 8 in either order
let q=P({...fresh(),step:6});q=P(advanceStarter(q,'gig-done').state);assert.equal(starterObjective(q,{vehicleReady:true}).title,BEATS[6].title);assert(advanceStarter(q,'gig-done').error);q=P(advanceStarter(q,'note-given').state);assert.equal(q.starter.step,8);
assert.equal(starterObjective(P({...fresh(),step:3})).aim,'farmhouse');assert.equal(starterObjective(P({...fresh(),step:4})),null,'paused until the flatbed exists');
// skipped
assert.equal(starterObjective(P(skipStarter())),null);assert(advanceStarter(P(skipStarter()),'read-message').error);
console.log('starter ok');