import assert from 'node:assert/strict';
import {WEEK_MINUTES as W,STARVE_AFTER,WARN_AT,PECKISH_AT,PET_COOLDOWN,AFFECTION_MAX,REOFFER_AFTER,DEFAULT_NAME,MSG,fresh,normalizePet,normalizePets,adoptionOffer,declineOffer,accept,hungerOf,feed,pat,tick,tickPets,rehome,moodOf} from '../dist/pets.js';
assert.equal(STARVE_AFTER,3*W);assert.deepEqual(WARN_AT,[W,2*W]);
const home={housing:{rented:true}};
// offer rules
assert.equal(adoptionOffer({},fresh(),0),false);assert.equal(adoptionOffer(null,fresh(),0),false);
assert.equal(adoptionOffer(home,fresh(),100),true);assert.equal(adoptionOffer({properties:{a:1}},fresh(),0),true);
let s=declineOffer(fresh(),100);
assert.equal(adoptionOffer(home,s,100+REOFFER_AFTER-1),false);assert.equal(adoptionOffer(home,s,100+REOFFER_AFTER),true);
s=accept(s,'oak18',500);assert.equal(s.pet.name,DEFAULT_NAME);assert.equal(s.pet.homeId,'oak18');assert.equal(s.pet.shared,false);
assert.equal(adoptionOffer(home,s,1e7),false);assert.equal(accept(s,'other',900).pet.homeId,'oak18');
// hunger and thresholds
const p0=s.pet;
assert.deepEqual([0,PECKISH_AT-1,PECKISH_AT,W-1,W,2*W-1,2*W].map(m=>hungerOf(p0,500+m).stage),['fed','fed','peckish','peckish','hungry','hungry','starving']);
assert.equal(hungerOf(p0,500).hunger,0);assert.equal(hungerOf(p0,500+STARVE_AFTER/2).hunger,0.5);assert.equal(hungerOf(p0,1e9).hunger,1);
// feed
assert.equal(feed(p0,500+PECKISH_AT-1).reason,'not-hungry');assert.equal(feed(p0,500+PECKISH_AT-1).ok,false);
const f=feed(p0,500+W);assert.equal(f.ok,true);assert.equal(f.pet.fedAt,500+W);assert.equal(hungerOf(f.pet,500+W).stage,'fed');assert.equal(feed(f.pet,500+W+10).ok,false);
assert.equal(feed(null,0).reason,'no-pet');
// pat cooldown
let a=pat(p0,1000);assert.equal(a.ok,true);assert.equal(a.affection,5);
assert.equal(pat(a.pet,1000+PET_COOLDOWN-1).reason,'cooldown');assert.equal(pat(a.pet,1000+PET_COOLDOWN).ok,true);
let pp=p0;for(let i=0;i<50;i++)pp=pat(pp,2000+i*PET_COOLDOWN).pet;assert.equal(pp.affection,AFFECTION_MAX);
// tick: each event once, exact thresholds
let t=tick(p0,500+W-1);assert.equal(t.events.length,0);
t=tick(p0,500+W);assert.deepEqual(t.events,[{type:'warn1',text:MSG.warn1('Whiskers')}]);assert.equal(t.pet.warned,1);
assert.equal(tick(t.pet,500+W+5000).events.length,0);
const t2=tick(t.pet,500+2*W);assert.equal(t2.events[0].type,'warn2');
// survives a save round-trip (no repeats on reload)
const rt=normalizePet(JSON.parse(JSON.stringify(t2.pet)));assert.deepEqual(rt,t2.pet);assert.equal(tick(rt,500+2*W+10).events.length,0);
// run away
let r=tick(t2.pet,500+3*W-1);assert.ok(r.pet);r=tick(t2.pet,500+3*W);
assert.equal(r.pet,null);assert.deepEqual(r.events.map(e=>e.type),['ranaway']);assert.equal(r.events[0].text,'Your cat ran away to look for food.');
const big=tick(p0,500+4*W);assert.deepEqual(big.events.map(e=>e.type),['warn1','warn2','ranaway']);
let ps=tickPets(s,500+3*W);assert.equal(ps.pets.pet,null);assert.equal(ps.pets.lostAt,500+3*W);assert.equal(ps.pets.lostName,'Whiskers');
ps=normalizePets(JSON.parse(JSON.stringify(ps.pets)));assert.equal(ps.pet,null);assert.equal(ps.lostAt,500+3*W);assert.equal(tickPets(ps,1e7).events.length,0);
// frame-rate independence
function run(step,end){let q=p0,ev=[];for(let n=500;;n+=step){const x=tick(q,Math.min(n,end));ev.push(...x.events.map(e=>e.type));q=x.pet;if(!q||n>=end)break}return {q,ev}}
const one=run(1e9,500+2*W+7),many=run(37,500+2*W+7),big2=run(13,500+4*W);
assert.deepEqual(one,many);assert.deepEqual(big2.ev,['warn1','warn2','ranaway']);assert.equal(big2.q,null);
// clock going backwards
const back=tick(p0,0);assert.equal(back.events.length,0);assert.deepEqual(back.pet,p0);
assert.equal(hungerOf(p0,-9999).stage,'fed');assert.equal(feed(p0,-9999).ok,false);assert.equal(pat(a.pet,0).ok,false);
const late=tick(p0,500+W).pet;assert.equal(tick(late,10).events.length,0);assert.equal(tick(late,10).pet.warned,1);
for(const bad of [NaN,undefined,Infinity,'x'])assert.doesNotThrow(()=>{tick(p0,bad);hungerOf(p0,bad);feed(p0,bad);pat(p0,bad);moodOf(p0,bad)});
// junk normalisation
for(const j of [undefined,null,5,'x',[],true])assert.equal(normalizePet(j),null);
const j=normalizePet({name:'  <b>Tom</b>  ',homeId:'a b!',fedAt:NaN,patAt:'x',affection:999,warned:7,shared:true,evil:1});
assert.deepEqual(Object.keys(j).sort(),['adoptedAt','affection','fedAt','homeId','name','patAt','shared','warned']);
assert.equal(j.name,'bTomb');assert.equal(j.homeId,null);assert.equal(j.fedAt,0);assert.equal(j.affection,AFFECTION_MAX);assert.equal(j.warned,2);assert.equal(j.shared,false);
assert.equal(normalizePet({name:42}).name,DEFAULT_NAME);assert.deepEqual(normalizePets('junk'),fresh());assert.deepEqual(normalizePets({offer:{status:'zzz',at:'q'},lostAt:'x'}),fresh());
// rehome
const h=rehome(p0,'house7');assert.equal(h.homeId,'house7');assert.equal(rehome(p0,'bad id!').homeId,'oak18');assert.equal(rehome(null,'x'),null);assert.equal(p0.homeId,'oak18');
// mood
assert.equal(moodOf(null,0),'idle');
const m=pat(feed(p0,500+W).pet,500+W+20).pet;
assert.equal(moodOf(feed(p0,500+W).pet,500+W+3),'eat');assert.equal(moodOf(m,500+W+22),'purr');
const day=n=>({...p0,fedAt:n});
assert.equal(moodOf(day(0),2*1440+2*60),'sleep');assert.equal(moodOf(day(0),2*1440+12*60+45),'idle');assert.equal(moodOf(day(0),2*1440+12*60),'walk');
assert.equal(moodOf(day(0),W+2*60),'walk'); // hungry cats do not sleep
console.log('PASS pets: offer, hunger, feed, pat, tick, run-away, normalise, rehome, mood');