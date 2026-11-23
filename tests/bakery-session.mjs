// W-J: two players compete for the same host-owned bakery gig.
import assert from 'node:assert/strict';
import {freshProgress} from '../dist/jobs.js';
import {needsForStock} from '../dist/bakery-needs.js';
import {applyBakeryAction,bakerySession} from '../dist/bakery-session.js';
import {CLAIM_LAPSE_MIN} from '../dist/needs.js';

const day=5,now=day*1440+600;
const stock={flour:6,'coffee-beans':0};
const need=needsForStock(stock,0,[],{day});
const fresh=freshProgress();
const alice={id:'alice',progress:fresh},bob={id:'bob',progress:freshProgress()};
const host=bakerySession({...fresh,needs:[need],bakeryStock:stock});
const act=(session,player,type,gigId,at=now)=>applyBakeryAction(
 session,player,{type,gigId,needId:need.id},{now:at}
);
const updated=(player,result)=>({...player,progress:result.state});
const a1=act(host,alice,'accept',1);
assert.equal(a1.state.gigs.active.needId,need.id);
assert.equal(host.claims.size,0);
assert.match(act(a1.session,bob,'accept',1).error,/already claimed/);
assert.match(act(a1.session,bob,'cancel',1).error,/no longer yours/);
const cancelled=act(a1.session,updated(alice,a1),'cancel',1);
assert.equal(cancelled.session.claims.size,0);
assert.equal(cancelled.state.gigs.active,null);
assert.equal(cancelled.state.cash,fresh.cash);

const b1=act(cancelled.session,bob,'accept',1);
const unloaded=updated(bob,b1);
assert.match(act(b1.session,unloaded,'deliver',1).error,/not carrying/);
const loaded=act(b1.session,unloaded,'load',1,now+1);
assert.equal(loaded.state.carry.kind,'sack');
const carried=updated(bob,loaded);
const delivered=act(loaded.session,carried,'deliver',1,now+10);
assert.equal(delivered.units,1);
assert.equal(delivered.session.needs[0].filled,1);
assert.equal(delivered.session.stock['coffee-beans'],1);
assert(delivered.paid>0);
assert.equal(delivered.state.cash,bob.progress.cash+delivered.paid);
assert.equal(delivered.state.carry,null);
assert.equal(delivered.state.gigs.active,null);
assert.equal(delivered.session.claims.size,0);
assert.match(act(delivered.session,carried,'deliver',1,now+10).error,/no longer yours/);
assert.match(act(delivered.session,updated(bob,delivered),'accept',1,now+10).error,/cannot be accepted/);

const redeployed=act(b1.session,updated(alice,cancelled),'accept',2,now+CLAIM_LAPSE_MIN);
assert.equal(redeployed.session.claims.get(need.id).id,alice.id);
const stale=act(redeployed.session,unloaded,'cancel',1,now+CLAIM_LAPSE_MIN);
assert.equal(stale.state.gigs.active,null);
assert.equal(stale.session.claims.get(need.id).id,alice.id);
console.log('PASS bakery-session: competing claims, cancellation, loading, payout once, and stale claim cleanup');
