// W-D3: named NPC dialogue (talk effects, caps, Oscar/Lincoln/Brentster rules through the functions game.js calls), the met set, the People page rows, the door-knock decisions and the roster planner. Pure: no game.js, no browser.
import assert from 'node:assert/strict';
import {ROSTER,ROSTER_ORDER,byId,MOOD_WORDS,GREETINGS,DEFAULT_GREETINGS,KNOCK_LINES,OSCAR_REFUSAL,CAT_STEERS,CAT_ANSWERS,HUNTING_TOPICS} from '../dist/npc-roster.js';
import * as L from '../dist/npc-life.js';
import * as D from '../dist/npc-dialogue.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {runWorldDay} from '../dist/world-tick.js';
import {createSchedule} from '../dist/schedule.js';
import {townPopulation} from '../dist/population.js';
import {MAP} from '../dist/map-definition.js';

const fresh=()=>({npcs:L.normalizeNpcs({}),standing:L.normalizeStanding({})});
const SEED=MAP.seed;
const homePlan=id=>{const h=byId(id)?.home;return !h?[]:[{from:0,to:420,act:'sleep',place:h},{from:420,to:1380,act:'home',place:h},{from:1380,to:1440,act:'sleep',place:h}]};
const at=(h,m=0)=>h*60+m;

// ---- greetings: 3+ per tier for each new NPC, 3+ lines per mood, a default for the rest
for(const id of ['oscar','lincoln','brentster']){for(const t of L.TIERS)assert.ok(GREETINGS[id][t].length>=3,id+' '+t);for(const w of MOOD_WORDS)assert.ok(byId(id).lines[w].length>=3,id+' '+w)}
for(const t of L.TIERS)assert.ok(DEFAULT_GREETINGS[t].length>=3);
assert.equal(new Set(Object.values(GREETINGS.oscar).flat()).size,12,'Oscar: 12 different greetings');

// ---- met set: starts empty, normalised, saved with the NPC, an old save that talked counts as met
assert.deepEqual(D.metIds(fresh().npcs),[]);assert.deepEqual(D.metIds(null),[]);assert.deepEqual(D.metIds('junk'),[]);assert.deepEqual(D.metIds({noah:{metDay:'x'},oscar:{metDay:4},ghost:{metDay:1}}),['oscar']);
assert.deepEqual(D.metIds({noah:{lastTalkDay:5}}),['noah'],'a legacy NPC who was talked to is met');
assert.equal(D.isMet({noah:{metDay:0}},'noah'),true);assert.equal(D.isMet({noah:{metDay:-1}},'noah'),false);assert.equal(D.isMet({noah:{metDay:3}},'nobody'),false);assert.equal(D.isMet(null,'noah'),false);
{const o=D.openTalk(fresh(),'noah',7,SEED);assert.deepEqual(D.metIds(o.state.npcs),['noah']);assert.equal(o.state.npcs.noah.metDay,7);assert.equal(o.state.npcs.noah.talksToday,0,'opening is not a talk');assert.equal(L.standingOf(o.state.standing,'noah'),0);
 const again=D.openTalk(o.state,'noah',9,SEED);assert.equal(again.state.npcs.noah.metDay,7,'met day never moves');
 assert.deepEqual(L.normalizeNpcs(JSON.parse(JSON.stringify(o.state.npcs))),o.state.npcs,'met survives a save round trip')}
assert.equal(D.openTalk(fresh(),'nobody',1),null);assert.equal(D.talkOutcome(fresh(),'nobody','chat',1),null);

// ---- through the real save: normalizeProgress keeps the met day; the daily tick and helped() keep it too (item 5: dialogue, tick and need effects share progress.npcs)
{let P=normalizeProgress(freshProgress());P={...P,housing:{...P.housing,day:60},routine:{...P.routine,minutes:400}};
 const r=D.talkOutcome(P,'noah','chat',59,SEED);P={...P,npcs:r.state.npcs,standing:r.state.standing};
 const rt=normalizeProgress(JSON.parse(JSON.stringify(P)));assert.deepEqual(D.metIds(rt.npcs),['noah']);assert.equal(rt.npcs.noah.metDay,59);
 const ticked=runWorldDay({...P,world:{...P.world,day:50}},59);assert.equal(ticked.npcs.noah.metDay,59,'the daily moodTick keeps the met day');assert.equal(ticked.npcs.noah.lastTalkDay,59);
 const h=L.helped(ticked.npcs.noah,59);assert.equal(h.metDay,59);assert.ok(h.mood>=ticked.npcs.noah.mood)}

// ---- a talk: talk() and gainStanding(+1), +3 a day at most, next day more
{let s=fresh();const o=D.talkOutcome(s,'noah','chat',5,SEED);
 const hand=L.talk(L.meet(s.npcs.noah,5),'chat',5);assert.equal(o.state.npcs.noah.mood,hand.mood,'the same effect as npc-life talk()');assert.equal(o.moodAfter-o.moodBefore,L.TALK_GAIN);
 assert.equal(o.standingGain,1);assert.equal(o.state.npcs.noah.talks.chat,1);assert.equal(o.state.npcs.noah.lastTalkDay,5);assert.equal(o.refused,false);assert.equal(o.pages.length,1);assert.ok(o.pages[0].length>3);
 assert.equal(JSON.stringify(s),JSON.stringify(fresh()),'input untouched');
 s=o.state;for(let i=0;i<6;i++)s=D.talkOutcome(s,'noah','town',5,SEED).state;
 assert.equal(L.standingOf(s.standing,'noah'),L.STANDING_DAILY_CAP,'cap +3 a day');assert.equal(s.npcs.noah.talksToday,7);
 s=D.talkOutcome(s,'noah','tips',6,SEED).state;assert.equal(L.standingOf(s.standing,'noah'),4,'a new day gives more');assert.equal(s.npcs.noah.talksToday,1);
 assert.equal(D.talkOutcome(fresh(),'noah','not-a-topic',3,SEED).state.npcs.noah.talks.chat,1,'an unknown topic is a plain chat');
 for(const t of D.topicsFor('noah')){const p=D.talkOutcome(fresh(),'noah',t.id,3,SEED).pages;assert.ok(p.length&&p.every(x=>typeof x==='string'&&x.length>3),t.id)}
 // Noah's and Hal's own menus: only the effects
 const rr=D.registerTalk(fresh(),'hal',4);assert.equal(rr.npcs.hal.metDay,4);assert.equal(L.standingOf(rr.standing,'hal'),1);assert.equal(rr.npcs.hal.talks.chat,1);
 assert.deepEqual(D.registerTalk(fresh(),'nobody',4).npcs,fresh().npcs)}

// ---- Oscar: talks 1 and 2 are fine, from the third he refuses ('Leave me be.'), mood drops, no standing; a new day resets
{let s=fresh();const m0=s.npcs.oscar.mood;
 const a=D.talkOutcome(s,'oscar','chat',10,SEED);assert.equal(a.refused,false);assert.equal(a.state.npcs.oscar.mood,m0);
 const b=D.talkOutcome(a.state,'oscar','tips',10,SEED);assert.equal(b.refused,false);assert.equal(b.state.npcs.oscar.mood,m0);assert.ok(b.pages[0].length>3);
 const o3=D.openTalk(b.state,'oscar',10,SEED);assert.equal(o3.text,OSCAR_REFUSAL,'he is already wary');assert.equal(o3.oscarWary,true);
 const c=D.talkOutcome(b.state,'oscar','chat',10,SEED);assert.equal(c.refused,true);assert.deepEqual(c.pages,['Leave me be.']);assert.equal(c.state.npcs.oscar.mood,m0-L.OSCAR_TALK_COST);assert.equal(c.standingGain,0);assert.equal(L.standingOf(c.state.standing,'oscar'),L.standingOf(b.state.standing,'oscar'));
 const d=D.talkOutcome(c.state,'oscar','chat',10,SEED);assert.equal(d.state.npcs.oscar.mood,m0-2*L.OSCAR_TALK_COST);
 const next=D.openTalk(d.state,'oscar',11,SEED);assert.notEqual(next.text,OSCAR_REFUSAL);assert.equal(next.oscarWary,false);assert.equal(D.talkOutcome(d.state,'oscar','chat',11,SEED).refused,false);
 assert.deepEqual(D.topicsFor('oscar').map(t=>t.id),['chat','tips']);
 // quiet help warms him: helped() is the one the need loop calls
 assert.equal(L.helped(c.state.npcs.oscar,10).mood-c.state.npcs.oscar.mood,L.OSCAR_HELP_GAIN)}

// ---- Lincoln: a topic menu from his topics, more than a dialog page (paged), three long pages per topic, the effect applied once; skipping costs nothing more
{const topics=D.topicsFor('lincoln');assert.equal(topics.length,byId('lincoln').topics.length+1);assert.deepEqual(topics.slice(0,-1).map(t=>t.id),HUNTING_TOPICS);assert.equal(topics.at(-1).id,'chat');
 let seen=[];for(let p=0,n=0;n<20;n++){const pc=D.pagedChoices(topics,p);assert.ok(pc.items.length<=2);assert.ok(pc.items.length+1<=3,'plus the More button: 3 buttons');seen.push(...pc.items.map(t=>t.id));p=pc.nextPage;if(p===0)break}
 assert.deepEqual(seen,topics.map(t=>t.id),'every topic is reachable and the pages wrap');
 assert.deepEqual(D.pagedChoices([1,2,3]).nextPage,null);assert.deepEqual(D.pagedChoices([1,2,3,4],5).items,[3,4],'page index wraps');
 let s=fresh();const m0=s.npcs.lincoln.mood,o=D.talkOutcome(s,'lincoln','deer',3,SEED);
 assert.deepEqual(o.pages,byId('lincoln').topics.find(t=>t.id==='deer').lines,'the topic lines are the pages');assert.equal(o.pages.length,3);
 assert.equal(o.state.npcs.lincoln.mood-m0,L.LINCOLN_HUNT_GAIN);assert.equal(o.standingGain,1);
 const viewedAll=D.talkOutcome(s,'lincoln','deer',3,SEED),skipped=D.talkOutcome(s,'lincoln','deer',3,SEED);assert.deepEqual(viewedAll.state,skipped.state,'the effect does not depend on how many pages were read');
 const sameTopic=D.talkOutcome(o.state,'lincoln','deer',3,SEED);assert.equal(sameTopic.state.npcs.lincoln.mood-o.state.npcs.lincoln.mood,L.LINCOLN_REPEAT_GAIN);
 // opening the menu and leaving is free (but he is met)
 const open=D.openTalk(fresh(),'lincoln',3,SEED);assert.equal(open.state.npcs.lincoln.mood,m0);assert.equal(open.state.npcs.lincoln.talksToday,0);assert.ok(open.choices.length>3);
 // the sulk rule is npc-life's: three talks and none about hunting, then the tick marks him
 let t=fresh();for(let i=0;i<3;i++)t=D.talkOutcome(t,'lincoln','chat',4,SEED).state;assert.ok(t.npcs.lincoln.mood<m0);
 assert.ok(L.moodTick(t.npcs.lincoln,5,{seed:SEED}).flags.includes('sulking'),'3 non-hunting talks: sulks');
 assert.equal(L.moodTick(D.talkOutcome(t,'lincoln','rifles',5,SEED).state.npcs.lincoln,5,{seed:SEED}).flags.includes('sulking'),false,'a hunting topic clears it');
 // a non-hunting answer steers back to hunting
 const ch=D.talkOutcome(fresh(),'lincoln','chat',3,SEED);assert.equal(ch.pages.length,2);assert.match(ch.pages[1],/^Which reminds me: /)}

// ---- Brentster: every conversation ends on his cat; cat topics please him
{const m0=fresh().npcs.brentster.mood;
 for(const t of D.topicsFor('brentster').filter(x=>!CAT_ANSWERS[x.id])){const o=D.talkOutcome(fresh(),'brentster',t.id,2,SEED);assert.equal(o.steered,true,t.id);assert.equal(o.pages.length,2);assert.ok(CAT_STEERS.includes(o.pages[1]),t.id+' steers to the cat');assert.equal(o.state.npcs.brentster.mood-m0,-L.BRENTSTER_OTHER_COST)}
 for(const id of Object.keys(CAT_ANSWERS)){const o=D.talkOutcome(fresh(),'brentster',id,2,SEED);assert.equal(o.steered,false);assert.equal(o.pages[0],CAT_ANSWERS[id]);assert.equal(o.state.npcs.brentster.mood-m0,L.BRENTSTER_CAT_GAIN)}
 assert.ok(D.topicsFor('brentster').length>3);assert.ok(D.pagedChoices(D.topicsFor('brentster')).nextPage!==null)}

// ---- the door: canVisit decides. Oscar answers 10:00-12:00 and lets you in only when close; strangers get 'Who is it?'
{const plan=id=>homePlan(id);
 const K=(raw,id,minute,pl=plan(id),day=20)=>D.knock(raw,id,{day,minute,plan:pl,seed:SEED});
 const std=(id,tier)=>({npcs:L.normalizeNpcs({}),standing:{people:{[id]:{points:L.STANDING_THRESHOLDS[tier],gainDay:-1,gainToday:0}}}});
 // stranger
 for(const id of ['noah','sophie','lincoln','brentster']){const k=K(fresh(),id,at(12));assert.equal(k.allowed,false);assert.equal(k.reason,'stranger');assert.equal(k.talk,false);assert.ok(KNOCK_LINES.stranger.includes(k.text),id+' '+k.text);assert.deepEqual(D.metIds(k.state.npcs),[],'an unanswered door meets nobody')}
 // acquaintance: a talk at the door; friend: inside (the game talks in the doorway: no interiors yet)
 {const k=K(std('lincoln','acquaintance'),'lincoln',at(12));assert.equal(k.talk,true);assert.equal(k.inside,false);assert.equal(k.reason,'door-only')}
 {const k=K(std('lincoln','friend'),'lincoln',at(12));assert.equal(k.talk,true);assert.equal(k.inside,true);assert.equal(k.reason,'welcome')}
 // asleep, out
 assert.equal(K(std('noah','friend'),'noah',at(3)).reason,'asleep');assert.ok(KNOCK_LINES.asleep.includes(K(std('noah','friend'),'noah',at(3)).text));
 {const work=[{from:0,to:420,act:'sleep',place:byId('noah').home},{from:420,to:1380,act:'work',place:'shop:market'},{from:1380,to:1440,act:'sleep',place:byId('noah').home}];const k=K(std('noah','friend'),'noah',at(12),work);assert.equal(k.reason,'not-home');assert.equal(k.talk,false)}
 // sick: through the door, no talk
 {const s=std('noah','friend');s.npcs.noah={...s.npcs.noah,sickUntil:22};const k=K(s,'noah',at(12));assert.equal(k.talk,false);assert.equal(k.reason,'sick');assert.ok(KNOCK_LINES.sick.includes(k.text))}
 // Oscar
 {const p=plan('oscar');
  const stranger=K(fresh(),'oscar',at(11),p);assert.equal(stranger.talk,false);assert.equal(stranger.reason,'stranger');assert.equal(stranger.text,'"I do not know you. Go away." Through the door.');assert.equal(L.standingOf(stranger.state.standing,'oscar'),1,'persistence: he never leaves his flat');assert.deepEqual(D.metIds(stranger.state.npcs),['oscar']);
  const again=K(stranger.state,'oscar',at(11,30),p);assert.equal(L.standingOf(again.state.standing,'oscar'),2);
  let s=fresh();for(let d=20;d<24;d++){s=K(s,'oscar',at(11),p,d).state}assert.equal(L.standingOf(s.standing,'oscar'),4);
  s=K(s,'oscar',at(11),p,24).state;assert.equal(L.tierFor(s.standing,'oscar'),'acquaintance','five days of knocking: acquaintance');
  const out=K(std('oscar','acquaintance'),'oscar',at(14),p);assert.equal(out.reason,'door-closed');assert.equal(out.talk,false);assert.ok(KNOCK_LINES['door-closed'].includes(out.text));
  assert.equal(K(std('oscar','acquaintance'),'oscar',at(9,59),p).reason,'door-closed');
  const door=K(std('oscar','acquaintance'),'oscar',at(10),p);assert.equal(door.talk,true);assert.equal(door.inside,false);
  const friend=K(std('oscar','friend'),'oscar',at(11),p);assert.equal(friend.talk,true);assert.equal(friend.inside,false,'Oscar needs close for inside');
  assert.equal(K(std('oscar','close'),'oscar',at(11),p).inside,true);assert.equal(K(std('oscar','close'),'oscar',at(12),p).reason,'door-closed');
  // a stranger outside his hours gets nothing, not even persistence
  const none=K(fresh(),'oscar',at(15),p);assert.equal(L.standingOf(none.state.standing,'oscar'),0)}
 // people with no flat in town and unknown ids
 assert.equal(K(std('walt','close'),'walt',at(12),[{from:0,to:1440,act:'work',place:'office:ridgeline-office'}]).reason,'no-home-in-town');assert.equal(K(fresh(),'nobody',at(12)),null);
 // flat directory: the named residents of the Oak Street Apartments, by flat number; names only once met
 const ds=D.flatDoors(fresh().npcs);assert.deepEqual(ds.map(d=>d.flat),[2,8,9,10,11]);assert.ok(ds.every(d=>/^Flat \d+$/.test(d.label)),'no names before you have met them');
 const met=D.flatDoors(D.openTalk(fresh(),'oscar',1,SEED).state.npcs);assert.equal(met.find(d=>d.id==='oscar').label,'Flat 9 · Oscar');
 const pc=D.pagedChoices(ds.map(d=>({id:d.id})));assert.equal(pc.items.length,2);assert.equal(pc.nextPage,1);
 // every door decision is a pure function (same input, same answer)
 assert.deepEqual(K(std('lincoln','friend'),'lincoln',at(12)),K(std('lincoln','friend'),'lincoln',at(12)))}

// ---- the People page: only the met, with name, role, home, work, tier, mood, last talked, hint
{assert.deepEqual(D.peopleRows(fresh(),{day:5}),[],'nobody met: an empty page');assert.deepEqual(D.peopleRows(null),[]);assert.deepEqual(D.peopleRows('junk',{day:2}),[]);
 let s=fresh();s=D.talkOutcome(s,'noah','chat',4,SEED).state;s=D.openTalk(s,'lincoln',4,SEED).state;s=D.talkOutcome(s,'brentster','cat',3,SEED).state;
 const rows=D.peopleRows(s,{day:5});assert.deepEqual(rows.map(r=>r.id),['noah','lincoln','brentster'],'roster order; unmet people (Hal, Oscar...) hidden');
 const noah=rows[0];assert.equal(noah.name,'Noah');assert.equal(noah.role,'Clerk (Corner Market)');assert.equal(noah.home,'Oak Street Apartments · Flat 8');assert.equal(noah.work,'Corner Market');assert.equal(noah.tier,'stranger');assert.equal(noah.tierWord,'Stranger');assert.ok(MOOD_WORDS.includes(noah.mood));assert.equal(noah.lastTalked,'Yesterday');assert.equal(noah.sick,false);
 assert.match(noah.hint,/^Next: Acquaintance at 5 standing \(you have 1\)/);assert.ok(noah.hint.includes('Watch the shelves'),'the person\'s own tip');
 assert.equal(rows[1].lastTalked,'Not yet','met at the door but never talked to');assert.equal(rows[2].lastTalked,'2 days ago');assert.equal(D.peopleRows(s,{day:4})[0].lastTalked,'Today');
 for(const r of rows){for(const k of ['id','name','role','home','work','tier','tierWord','mood','lastTalked','hint'])assert.ok(typeof r[k]==='string'&&r[k].length,r.id+' '+k);assert.ok(!/ASSUMED/.test(r.name+r.role))}
 // tier words follow standing; close friends have nothing left to climb
 const big={npcs:s.npcs,standing:{people:{noah:{points:60,gainDay:-1,gainToday:0}}}};const r2=D.peopleRows(big,{day:9}).find(r=>r.id==='noah');assert.equal(r2.tierWord,'Close friend');assert.match(r2.hint,/^You are as close as it gets/);
 // sick shows
 const sick={npcs:{...s.npcs,noah:{...s.npcs.noah,sickUntil:9}},standing:s.standing};assert.equal(D.peopleRows(sick,{day:8})[0].sick,true);assert.equal(D.peopleRows(sick,{day:10})[0].sick,false);
 // places read well for everyone
 const all=ROSTER.map(r=>{let x=fresh();x=D.openTalk(x,r.id,1,SEED).state;return D.peopleRows(x,{day:1})[0]});for(const r of all){assert.ok(!/[:]/.test(r.home+r.work),r.id+' '+r.home+' / '+r.work)}
 assert.equal(all.find(r=>r.id==='hal').home,D.placeLabel('property:farm-house'));assert.equal(all.find(r=>r.id==='walt').home,'Lives out of town');assert.equal(all.find(r=>r.id==='oscar').work,'No regular job');
 assert.equal(D.placeLabel('shop:market'),'Corner Market');assert.equal(D.placeLabel('dwelling:oak-apartments'),'Oak Street Apartments');assert.equal(D.placeLabel('office:ridgeline-warehouse'),'Ridgeline Warehouse');assert.equal(D.placeLabel('zone:forest'),'Pine Ridge');assert.equal(D.placeLabel('nonsense'),'')}

// ---- the roster planner: sick named people stay home, everyone else keeps the schedule's own plan, nothing allocates twice
{const pop=townPopulation(),sched=createSchedule(pop);let npcs=L.normalizeNpcs({});const pl=D.createRosterPlanner({schedule:sched,getNpcs:()=>npcs,seed:SEED});
 const noah=byId('noah').personId,day=30;
 const plain=sched.planOf(noah,day),p1=pl.planOf(noah,day);assert.deepEqual(p1,L.namedPlan(npcs.noah,day-1,{seed:SEED},plain));assert.strictEqual(pl.planOf(noah,day),p1,'memoised');
 const outsider=pop.people.find(p=>!ROSTER.some(r=>r.personId===p.id));assert.strictEqual(pl.planOf(outsider.id,day),sched.planOf(outsider.id,day),'not a roster person: the plain plan');
 npcs={...npcs,noah:{...npcs.noah,sickUntil:day-1}};const sickPlan=pl.planOf(noah,day);assert.notStrictEqual(sickPlan,p1);assert.ok(sickPlan.every(b=>b.act==='sleep'||b.act==='home'),'a sick NPC stays home all day');assert.equal(sickPlan[0].place,byId('noah').home);
 npcs={...npcs,noah:{...npcs.noah,sickUntil:-1}};assert.deepEqual(pl.planOf(noah,day),p1,'well again: the normal day');
 npcs={...npcs,noah:{...npcs.noah,mood:10}};assert.ok(!pl.planOf(noah,day).some(b=>b.act==='shop'),'a low mood drops the errands');
 npcs=undefined;assert.strictEqual(pl.planOf(noah,day),plain,'no npc state yet: the plain plan');
 // no friend visit to the player is ever planned (nothing can draw it yet)
 npcs=L.normalizeNpcs({});let visits=0;const rich={npcs,standing:{people:Object.fromEntries(ROSTER_ORDER.map(i=>[i,{points:60}]))}};for(const r of ROSTER)for(let d=1;d<40;d++){const p=pl.planOf(r.personId,d);if(p&&p.some(b=>b.act==='shop'&&b.place&&b.place.startsWith('visit')))visits++}assert.equal(visits,0);
 // every roster person's plan is a valid whole day
 for(const r of ROSTER)for(let d=1;d<15;d++){const p=pl.planOf(r.personId,d);if(!p)continue;assert.equal(p[0].from,0);assert.equal(p.at(-1).to,1440);for(let i=1;i<p.length;i++)assert.equal(p[i].from,p[i-1].to,r.id+' day '+d)}}

// ---- roster lookups
assert.equal(D.rosterByPersonId('oak-apartments/9#1').id,'oscar');assert.equal(D.rosterByPersonId('nope'),null);assert.equal(D.displayRole(byId('foreman')),'Ridgeline foreman');

console.log('PASS npc-dialogue: talk effects and caps, Oscar refusal, Lincoln pages and sulk, Brentster steers, met set and save round trip, People rows (unmet hidden), door-knock table, roster planner (sick stay home)');
