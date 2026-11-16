import assert from 'node:assert/strict';
import {STARTER_EPOCH,alreadyHoused,BEATS,PLACES,fresh,normalizeStarter,advanceStarter,starterObjective,skipStarter,cratePay,SKIP_SALE_PRICE} from '../dist/starter.js';
import {VEHICLE_PRICE} from '../dist/orders.js';
import {isWalkable} from '../dist/world.js';
const P=s=>({starter:s,housing:{rented:true},vehicles:[]}); // a studio to park in
// places we do list must be on walkable ground
for(const k of ['spawn','market','oakStreet18','farmhouse','gas','apartments'])assert(Number.isFinite(PLACES[k].x));
assert(isWalkable(PLACES.spawn.x,PLACES.spawn.z));
assert.equal(BEATS.length,10);
// normalise
assert.equal(STARTER_EPOCH,1);assert.equal(fresh().epoch,STARTER_EPOCH,'a fresh starter is stamped');assert.equal(skipStarter().epoch,STARTER_EPOCH,'skipping stamps the epoch too');
assert.deepEqual(normalizeStarter(undefined,{}),fresh());
// S-RESET: a starter of another epoch (or none) restarts at step 0, whatever the progress; nothing but the starter is read
for(const p of [{completed:1},{cash:5},{vehicles:[{}]},{housing:{rented:true}},{careers:{a:1}},{properties:{x:1}}])assert.deepEqual(normalizeStarter(null,p),fresh(),'no starter but progress: a fresh story, not skipped');
for(const old of [{step:10,done:true,skipped:true},{step:10,done:true},{step:5,loanUid:'v3',quality:40},{step:3,epoch:0},{step:7,epoch:2},{step:2,epoch:'1'}])assert.deepEqual(normalizeStarter(old,{completed:9,cash:99999}),fresh(),'an old starter '+JSON.stringify(old)+' resets');
const E=o=>({epoch:STARTER_EPOCH,...o});
assert.deepEqual(normalizeStarter(E({step:6,quality:80,noteGiven:true}),{}),{...fresh(),step:6,quality:80,noteGiven:true},'a current starter is kept');assert.deepEqual(normalizeStarter(normalizeStarter({step:10,done:true},{}),{}),fresh(),'a second load does not reset again (still step 0 is kept, epoch stamped)');
assert.equal(normalizeStarter(E({step:99}),{}).step,10);assert.equal(normalizeStarter(E({step:-4.5}),{}).step,0);assert.equal(normalizeStarter(E({step:3,done:true}),{}).step,10);
assert.equal(normalizeStarter(E({step:2,loanUid:'v3'}),{}).loanUid,null);assert.equal(normalizeStarter(E({step:5,loanUid:'v3'}),{}).loanUid,'v3');assert.equal(normalizeStarter(E({step:5,loanUid:'x;drop'}),{}).loanUid,null);
assert.equal(normalizeStarter(E({step:10,loanUid:'v3'}),{}).loanUid,null);
{const s=normalizeStarter(E({step:5,loanUid:'v3',quality:70}),{});assert.equal(normalizeStarter(JSON.parse(JSON.stringify(s)),{}).step,5,'round trip through a save keeps the story');assert.equal(normalizeStarter(JSON.parse(JSON.stringify(skipStarter())),{}).skipped,true,'a skipped story stays skipped')}
// the rent beat completes at once for anyone who already has a home
assert(alreadyHoused({starter:E({step:8}),housing:{rented:true}}));assert(alreadyHoused({starter:E({step:8}),properties:{h1:{tenure:'own'}}}));assert(!alreadyHoused({starter:E({step:8}),housing:{rented:false},properties:{}}));assert(!alreadyHoused({starter:E({step:7}),housing:{rented:true}}),'only at step 8');assert(!alreadyHoused({starter:E({step:8,done:true}),housing:{rented:true}}));assert(!alreadyHoused(null));
assert.deepEqual(normalizeStarter('junk',{}),fresh());
// the full path, with wrong events refused at every step
const order=['read-message','delivered','ate','arrived','delivered-crates','refuelled','note-given','gig-done','rented','slept'];
let p=P(fresh()),cash=0;
assert.equal(starterObjective(p).aim,'market');
for(let i=0;i<10;i++){
 for(const wrong of ['slept','read-message','nonsense','rented'])if(wrong!==order[i]&&!(i>=6&&i<=7&&['note-given','gig-done'].includes(wrong))&&!(i===4&&wrong==='loaded'))assert(advanceStarter(p,wrong).error,`step ${i} refuses ${wrong}`);
 if(i===4){assert(advanceStarter(p,'delivered-crates',{quality:50}).error);const l=advanceStarter(p,'loaded');p=P(l.state);assert(advanceStarter(p,'loaded').error)}
 if(i===3){const r=advanceStarter(p,'arrived',{loanUid:'v4'});assert.equal(r.state.loanUid,'v4');p=P(r.state);cash+=r.cash;continue}
 const r=advanceStarter(p,order[i],{quality:70});assert(r.state,order[i]);cash+=r.cash;p=P(r.state);
 if(i===4)assert.equal(r.cash,cratePay(70));
}
assert(p.starter.done);assert.equal(p.starter.step,10);assert.equal(p.starter.loanUid,null);assert(advanceStarter(p,'slept').error);assert.equal(starterObjective(p),null);
assert.equal(cash,300+2500+cratePay(70)+3200);
assert.equal(cratePay(100),4000);assert.equal(cratePay(0),2800);
// beats 7 and 8 in either order
let q=P({...fresh(),step:6});q=P(advanceStarter(q,'gig-done').state);assert.equal(starterObjective(q,{vehicleReady:true}).title,BEATS[6].title);assert(advanceStarter(q,'gig-done').error);q=P(advanceStarter(q,'note-given').state);assert.equal(q.starter.step,8);
assert.equal(starterObjective(P({...fresh(),step:3})).aim,'farmhouse');assert.equal(starterObjective(P({...fresh(),step:4}),{vehicleReady:false}),null,'paused when the truck beats are switched off');assert.equal(starterObjective(P({...fresh(),step:4})).aim,'crates');assert.equal(starterObjective(P({...fresh(),step:4,loaded:true})).aim,'market');
// the skip sale price is the Shortbed's store price ($500), one source
assert.equal(SKIP_SALE_PRICE,VEHICLE_PRICE.shortbed);assert.equal(SKIP_SALE_PRICE,50000);
// skipped
assert.equal(starterObjective(P(skipStarter())),null);assert(advanceStarter(P(skipStarter()),'read-message').error);
console.log('starter ok');