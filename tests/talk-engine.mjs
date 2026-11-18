// C1 (notes/conversation-design.md): the pure talk engine: period picks, no repeats within `last`, specificity wins, ONE variant per turn (no glue), replay determinism, unknown go, garbage inputs, inputs never mutated, effects as data. Uses a tiny inline cast.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {talkContext,baseContext,openConversation,chooseReply,remember,lineKey,matches,specificity,effectsOf,cleanMem,freshMem,periodOf,
 CONDITION_KEYS,EFFECT_KEYS,BYE_ID,LAST_CAP,SEEN_CAP,BEATS_CAP} from '../dist/talk-engine.js';

const STRICT={strict:true};
const deepFreeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);for(const k of Object.keys(o))deepFreeze(o[k])}return o};
const at=(h,m=0)=>h*60+m;
const ctxAt=(minute,extra={})=>baseContext({who:'noah',day:3,minute,seed:7,place:'counter',...extra});
const texts=r=>r.lines.map(l=>l.text);

// ---- the tiny inline cast (Noah): period openers, a specific friend line, a gig line, a generic fallback, and a few nodes
const NOAH={id:'noah',name:'Noah',voice:'chatty, tidy',facts:{shop:'the Corner Market'},bye:[{t:'Take care now.'}],nodes:[
 {id:'n.open',entry:true,say:[
  {t:'Hello there.'},
  {if:{period:'morning'},t:'Morning! Welcome to {shop}.'},
  {if:{period:'afternoon'},t:'Afternoon. Need anything?'},
  {if:{period:'evening'},t:'Evening. Doors shut at ten.'},
  {if:{period:'night'},t:'Shop is nearly shut, so be quick.'},
  {if:{period:'morning',tierMin:'friend'},t:['Morning, friend!','The coffee is on.']},
  {if:{gig:'need-restock',gigClient:'noah',place:'counter'},t:['Is that my restock run?','Crates go on the left shelf.']}],
  replies:[{label:'Any work going?',go:'n.work'},{label:'Can I look around?',act:'openStore'},{label:'Who is Sophie?',go:'n.sophie',if:{storyDone:true}},{label:'Tell me about the shop.',go:'n.shop'},{label:'Weather?',go:'n.weather'}]},
 {id:'n.work',topic:'chat',say:[{t:['Plenty.','Check the board.'],do:{beat:'noah.work-asked',standing:1}}],do:{mood:1},replies:[{label:'Anything else about work?',go:'n.work2',if:{beat:'noah.work-asked'}},{label:'Thanks.',go:'n.open',do:{standing:1}}]},
 {id:'n.work2',say:[{if:{beat:'noah.work-asked'},t:'You asked me already, so yes, the board.'},{if:{notBeat:'noah.work-asked'},t:'Never heard of it.'}],end:true},
 {id:'n.sophie',when:{storyDone:true},say:[{t:'She is across the street.'}],end:true},
 {id:'n.shop',say:[{t:'Shelves are full.'},{t:'Stock is low on eggs.'},{t:'We got bread today.'},{t:'The milk is cold.'}],replies:[{label:'Back to the start.',go:'n.open'}]},
 {id:'n.weather',say:[{if:{weather:'rain'},t:'Wet one.'},{if:{weather:'clear'},t:'Clear skies.'}],replies:[{label:'Back to the start.',go:'n.open'}]},
 {id:'n.meet',entry:true,when:{met:false,place:'counter'},say:[{t:['I am Noah.','I keep this counter.'],do:{meet:true}}],replies:[{label:'Nice to meet you.',go:'n.met2'}]},
 {id:'n.met2',say:[{if:{met:true},t:'Likewise, now that we have met.'},{if:{met:false},t:'We have not met yet?'}],end:true}]};
deepFreeze(NOAH);

// ---- 1. period picks (one fixed context per time of day; Noah already met, so the greeting entry is used)
const met={met:true};
const expectPeriod=[[at(8),/^Morning! Welcome to the Corner Market\.$/,'morning'],[at(14),/^Afternoon\. Need anything\?$/,'afternoon'],[at(19),/^Evening\. Doors shut at ten\.$/,'evening'],[at(23,30),/nearly shut/,'night'],[at(3),/nearly shut/,'night'],[at(5),/Welcome to/,'morning'],[at(21,59),/^Evening\./,'evening'],[at(22),/nearly shut/,'night'],[at(12),/^Afternoon/,'afternoon'],[at(17,59),/^Afternoon/,'afternoon']];
for(const [min,re,name] of expectPeriod){const r=openConversation(NOAH,'noah',ctxAt(min,met),undefined,STRICT);assert.equal(r.lines.length,1,name);assert.match(r.lines[0].text,re,name+' at '+min);assert.equal(periodOf(min),name)}
assert.deepEqual([periodOf(0),periodOf(299),periodOf(300),periodOf(719),periodOf(720),periodOf(1079),periodOf(1080),periodOf(1319),periodOf(1320),periodOf(1440),periodOf(-60)],['night','night','morning','morning','afternoon','afternoon','evening','evening','night','night','night'],'period edges (and wrap)');
// a later turn uses the CURRENT time: opened at 11:59, the next turn at 12:01 speaks an afternoon line (game time never pauses during a talk)
{const TIMED={id:'t',nodes:[{id:'t.open',entry:true,say:[{t:'Hello.'}],replies:[{label:'And now?',go:'t.time'}]},{id:'t.time',say:[{if:{period:'morning'},t:'Still morning.'},{if:{period:'afternoon'},t:'Afternoon already.'}],end:true}]};
 const a=openConversation(TIMED,'t',baseContext({who:'t',minute:at(11,59)}),undefined,STRICT),b=chooseReply(a.session,TIMED,a.replies[0].id,baseContext({who:'t',minute:at(12,1)}),undefined,STRICT);
 assert.deepEqual(texts(b),['Afternoon already.']);const c=chooseReply(a.session,TIMED,a.replies[0].id,baseContext({who:'t',minute:at(11,59)}),undefined,STRICT);assert.deepEqual(texts(c),['Still morning.'])}

// ---- 2. specificity wins ties of period; the gig line beats everything; w overrides specificity
{const fr=openConversation(NOAH,'noah',ctxAt(at(8),{met:true,tier:'friend'}),undefined,STRICT);assert.deepEqual(texts(fr),['Morning, friend!','The coffee is on.'],'friend+morning (2 conditions) beats morning (1) and the fallback (0)');
 const st=openConversation(NOAH,'noah',ctxAt(at(8),{met:true,tier:'acquaintance'}),undefined,STRICT);assert.match(st.lines[0].text,/^Morning! Welcome/,'an acquaintance gets the plain morning line');
 const g=openConversation(NOAH,'noah',ctxAt(at(8),{met:true,tier:'friend',gig:'need-restock',gigClient:'noah'}),undefined,STRICT);assert.deepEqual(texts(g),['Is that my restock run?','Crates go on the left shelf.'],'the active gig line (3 conditions) wins over friend morning (2)');
 const other=openConversation(NOAH,'noah',ctxAt(at(8),{met:true,gig:'need-restock',gigClient:'sophie'}),undefined,STRICT);assert.match(other.lines[0].text,/^Morning! Welcome/,'a gig for someone else does not match');
 const W={id:'w',nodes:[{id:'w.open',entry:true,say:[{if:{period:'morning'},t:'Plain.'},{if:{period:'morning',met:true},t:'Specific.'},{if:{period:'morning'},w:9,t:'Weighted.'}],end:true}]};
 assert.deepEqual(texts(openConversation(W,'w',baseContext({who:'w',minute:at(8),met:true}),undefined,STRICT)),['Weighted.'],'w overrides specificity');
 assert.equal(specificity({period:'x',met:true}),2);assert.equal(specificity(null),0);assert.equal(specificity({}),0)}
// entry nodes: the one with the most specific `when` opens; a stranger at the counter meets Noah first, a met person gets the greeting
{const first=openConversation(NOAH,'noah',ctxAt(at(8),{met:false}),undefined,STRICT);assert.deepEqual(texts(first),['I am Noah.','I keep this counter.']);assert.deepEqual(first.effects.map(e=>e.kind),['meet']);
 const street=openConversation(NOAH,'noah',ctxAt(at(8),{met:false,place:'street'}),undefined,STRICT);assert.match(street.lines[0].text,/^Morning/,'the meeting node needs the counter')}

// ---- 3. ONE variant per turn: a multi-bubble variant comes whole, a turn never mixes two variants (no glue)
{const sets=NOAH.nodes.flatMap(n=>n.say.map(v=>[].concat(v.t).map(t=>t.replace('{shop}','the Corner Market')).join('|')));
 for(let day=0;day<40;day++)for(const min of [at(8),at(14),at(19),at(23)])for(const tier of ['stranger','friend'])for(const gig of ['','need-restock']){
  const r=openConversation(NOAH,'noah',ctxAt(min,{day,met:true,tier,gig,gigClient:gig?'noah':''}),undefined,STRICT);
  assert(sets.includes(texts(r).join('|')),'every turn is exactly one authored variant: '+texts(r).join('|'));assert(r.lines.length>=1&&r.lines.length<=3)}}
{const a=openConversation(NOAH,'noah',ctxAt(at(9),{met:true}),undefined,STRICT);const w=chooseReply(a.session,NOAH,a.replies[0].id,ctxAt(at(9),{met:true}),undefined,STRICT);assert.deepEqual(texts(w),['Plenty.','Check the board.']);assert.deepEqual(w.echo,{who:'you',text:'Any work going?'});assert(w.lines.every(l=>l.who==='noah'))}

// ---- 4. no repeats within `last` (with 8 equal variants, 25 openings never repeat inside the last 6; with 4 variants every window of 4 is distinct)
{const mk=n=>({id:'r',nodes:[{id:'r.open',entry:true,say:Array.from({length:n},(_,i)=>({t:'Line number '+i+'.'})),end:true}]});
 for(const [n,win] of [[8,7],[4,4]]){const C=mk(n);let mem=freshMem();const keys=[];
  for(let i=0;i<25;i++){const r=openConversation(C,'r',baseContext({who:'r',day:i,minute:at(9),seed:5,mem}),mem,STRICT);keys.push(lineKey(r.lines[0].text));mem=remember(mem,r.session);assert(mem.last.length<=LAST_CAP);assert.equal(mem.last.at(-1),keys.at(-1))}
  for(let i=0;i<keys.length;i++){const prev=keys.slice(Math.max(0,i-(win-1)),i);assert(!prev.includes(keys[i]),`variant ${i} repeated one of the previous ${win-1} (n=${n})`)}
  const first=Math.min(n,LAST_CAP+1);assert.equal(new Set(keys.slice(0,first)).size,first,'the first '+first+' openings are all different');assert.equal(new Set(keys).size,n,'all '+n+' variants get used')}}
// when EVERY matching variant was said recently, the least recent one comes back (never nothing)
{const C={id:'r',nodes:[{id:'r.open',entry:true,say:[{t:'One.'},{t:'Two.'}],end:true}]};const mem={last:[lineKey('Two.'),lineKey('One.')],seen:{},beats:[],lastMin:-1};
 assert.deepEqual(texts(openConversation(C,'r',baseContext({who:'r',mem}),mem,STRICT)),['Two.'],'the one said longest ago')}
// the same line is never said twice inside ONE talk when something else fits
{const C={id:'r',nodes:[{id:'r.open',entry:true,say:[{t:'A.'}],replies:[{label:'again',go:'r.b'}]},{id:'r.b',say:[{t:'A.'},{t:'B.'}],end:true}]};
 for(let seed=0;seed<30;seed++){const c=baseContext({who:'r',seed}),a=openConversation(C,'r',c,undefined,STRICT),b=chooseReply(a.session,C,a.replies[0].id,c,undefined,STRICT);assert.deepEqual(texts(b),['B.'],'seed '+seed)}}

// ---- 5. replay determinism: the same inputs give the same transcript; the seed and the day change the choice
const script=(cast,seed,day)=>{let mem=freshMem(),out=[];for(let talk=0;talk<4;talk++){const c=baseContext({who:'noah',day:day+talk,minute:at(7)+talk*200,seed,place:'counter',met:true,mem});let r=openConversation(cast,'noah',c,mem,STRICT);out.push(texts(r));
  for(let step=0;step<6&&!r.ended;step++){const pick=r.replies[(talk+step)%r.replies.length];out.push(pick.id);r=chooseReply(r.session,cast,pick.id,baseContext({who:'noah',day:day+talk,minute:at(7)+talk*200+step*10,seed,place:'counter',met:true,mem}),mem,STRICT);out.push(texts(r),r.effects)}
  mem=remember(mem,r.session);out.push(mem)}return JSON.stringify(out)};
assert.equal(script(NOAH,11,2),script(NOAH,11,2),'same inputs, same transcript');
assert.equal(script(deepFreeze(JSON.parse(JSON.stringify(NOAH))),11,2),script(NOAH,11,2),'a deep copy of the cast gives the same transcript');
assert.notEqual(new Set([1,2,3,4,5,6].map(s=>script(NOAH,s,2))).size,1,'the seed changes the transcript');

// ---- 6. unknown go: throws in strict (tests), hidden at runtime; unknown reply id and a stale reply are safe
{const BAD={id:'b',nodes:[{id:'b.open',entry:true,say:[{t:'Hi.'}],replies:[{label:'Nowhere',go:'b.missing'},{label:'Fine',go:'b.ok'}]},{id:'b.ok',say:[{t:'OK.'}],end:true}]};
 assert.throws(()=>openConversation(BAD,'b',baseContext({who:'b'}),undefined,STRICT),/unknown node "b\.missing"/);
 const r=openConversation(BAD,'b',baseContext({who:'b'}));assert.deepEqual(r.replies.map(x=>x.label),['Fine','See you'],'at runtime the reply to nowhere is hidden, the rest works');assert(r.problems.some(p=>/b\.missing/.test(p)),'and the problem is reported');
 const ok=chooseReply(r.session,BAD,'r2',baseContext({who:'b'}));assert.deepEqual(texts(ok),['OK.']);assert.equal(ok.ended,true);
 const un=chooseReply(r.session,BAD,'nonsense',baseContext({who:'b'}));assert.equal(un.ended,false);assert.deepEqual(un.lines,[]);assert.equal(un.replies.length,2);assert.deepEqual(un.session,r.session,'an unknown reply id changes nothing');
 const NOENTRY={id:'n',nodes:[{id:'n.a',say:[{t:'x'}],end:true}]};assert.throws(()=>openConversation(NOENTRY,'n',baseContext({who:'n'}),undefined,STRICT),/no entry node fits/);assert.equal(openConversation(NOENTRY,'n',baseContext({who:'n'})).ended,true);
 const NOSAY={id:'n',nodes:[{id:'n.a',entry:true,say:[{if:{period:'night'},t:'x'}],end:true}]};assert.throws(()=>openConversation(NOSAY,'n',baseContext({who:'n',minute:at(9)}),undefined,STRICT),/none has a variant/);assert.deepEqual(openConversation(NOSAY,'n',baseContext({who:'n',minute:at(9)})).lines,[])}

// ---- 7. effects are DATA: the engine never touches state; beats set in a talk are visible to later conditions in the same talk
{const c=ctxAt(at(9),{met:true}),a=openConversation(NOAH,'noah',c,undefined,STRICT);const w=chooseReply(a.session,NOAH,'r1',c,undefined,STRICT);
 assert.deepEqual(w.effects,[{kind:'mood',amount:1,at:'n.work'},{kind:'standing',amount:1,at:'n.work'},{kind:'beat',id:'noah.work-asked',at:'n.work'}],'node do, then the variant do');
 assert.deepEqual(w.replies.map(r=>r.label),['Anything else about work?','Thanks.','See you'],'the beat just set unlocks a reply in the same talk');
 const w2=chooseReply(w.session,NOAH,'r1',c,undefined,STRICT);assert.deepEqual(texts(w2),['You asked me already, so yes, the board.'],'beat/notBeat see this talk\'s beats');assert.equal(w2.ended,true);assert.deepEqual(w2.replies,[]);
 const thanks=chooseReply(w.session,NOAH,'r2',c,undefined,STRICT);assert.deepEqual(thanks.effects,[{kind:'standing',amount:1,at:'n.work'}],'a reply do comes before the next node');assert.equal(thanks.ended,false);
 const store=chooseReply(a.session,NOAH,'r2',c,undefined,STRICT);assert.deepEqual(store.effects,[{kind:'act',id:'openStore',at:'n.open'}]);assert.equal(store.ended,true,'an act with no go ends the talk (the act opens its own menu)');assert.deepEqual(store.lines,[]);
 const bye=chooseReply(a.session,NOAH,BYE_ID,c,undefined,STRICT);assert.equal(bye.ended,true);assert.deepEqual(texts(bye),['Take care now.']);assert.deepEqual(bye.echo,{who:'you',text:'See you'});
 const done=chooseReply(bye.session,NOAH,'r1',c);assert.equal(done.ended,true);assert.deepEqual(done.lines,[],'a finished talk says nothing more')}
// meet: the first meeting sets met for the rest of the talk and remember() writes who.first
{const c=ctxAt(at(9),{met:false}),a=openConversation(NOAH,'noah',c,undefined,STRICT);assert.equal(a.session.met,true);const b=chooseReply(a.session,NOAH,'r1',c,undefined,STRICT);assert.deepEqual(texts(b),['Likewise, now that we have met.']);
 const mem=remember(freshMem(),b.session);assert.equal(mem.seen['noah.first'],1);assert.equal(mem.seen['n.meet'],1);assert.equal(baseContext({who:'noah',mem}).met,true,'a remembered meeting is met next time');
 assert.match(openConversation(NOAH,'noah',baseContext({who:'noah',minute:at(8),place:'counter',mem}),mem,STRICT).lines[0].text,/^Morning! Welcome/,'and the greeting replaces the introduction')}
// fixed-shape ids, asked flags, the free See you, conditions on replies and the target's `when`
{const c=ctxAt(at(9),{met:true}),a=openConversation(NOAH,'noah',c,undefined,STRICT);assert.deepEqual(a.replies.map(r=>r.id),['r1','r2','r4','r5',BYE_ID],'ids are r<position>; the storyDone reply is hidden');
 assert.equal(openConversation(NOAH,'noah',ctxAt(at(9),{met:true,storyDone:true}),undefined,STRICT).replies.some(r=>r.label==='Who is Sophie?'),true);assert(a.replies.every(r=>r.asked===false));
 const w=chooseReply(a.session,NOAH,'r1',c,undefined,STRICT),back=chooseReply(w.session,NOAH,'r2',c,undefined,STRICT);assert.equal(back.replies.find(r=>r.label==='Any work going?').asked,true,'a node already visited is marked asked')}

// ---- 8. talkContext reads the saved progress and never changes it
{const progress=deepFreeze({npcs:{noah:{id:'noah',mood:85,metDay:2,mem:{last:['abc'],seen:{'n.shop':2},beats:['noah.work-asked'],lastMin:2*1440+600}}},standing:{people:{noah:{points:22,gainDay:-1,gainToday:0}}},starter:{step:4,done:false},gigs:{active:{type:'need-restock',client:'noah'}},careers:{ridgeline:{hired:true,rank:2},other:{hired:false,rank:0}},cafe:{employed:true,stage:'brew'}});
 const c=talkContext(progress,'noah',deepFreeze({day:5,minute:at(19),weather:'rain',place:'counter',seed:3,recent:['delivered:sophie','egg-run']}));
 assert.deepEqual({tier:c.tier,mood:c.moodBand,met:c.met,story:c.story,done:c.storyDone,gig:c.gig,client:c.gigClient,hired:c.hired,rank:c.rank,cafe:c.cafe,period:c.period,weather:c.weather,place:c.place,days:c.daysSince,seen:c.seen,beats:c.beats,recent:c.recent},
  {tier:'friend',mood:'delighted',met:true,story:4,done:false,gig:'need-restock',client:'noah',hired:{ridgeline:2},rank:2,cafe:'onShift',period:'evening',weather:'rain',place:'counter',days:3,seen:{'n.shop':2},beats:['noah.work-asked'],recent:['delivered:sophie','egg-run']});
 assert.equal(talkContext(progress,'noah',{day:5,minute:0,mem:{seen:{x:1}}}).seen.x,1,'env.mem overrides');
 const crowd=talkContext(deepFreeze({talk:{v:1,people:{marta:{metDay:1,lastDay:4,last:['k'],seen:{'marta.first':1},beats:['b']}}}}),'marta',{day:6,minute:at(8)});assert.equal(crowd.met,true);assert.equal(crowd.daysSince,2);assert.deepEqual(crowd.beats,['b'],'people outside the roster read progress.talk.people');
 const fresh=talkContext({},'noah',{day:0,minute:at(8)});assert.deepEqual({t:fresh.tier,m:fresh.met,s:fresh.story,g:fresh.gig,c:fresh.cafe,d:fresh.daysSince,r:fresh.rank,w:fresh.weather,p:fresh.place},{t:'stranger',m:false,s:0,g:'',c:'none',d:9999,r:0,w:'clear',p:'street'},'a fresh save is a stranger, no gig, clear weather, on the street');
 assert.equal(talkContext({cafe:{employed:true,stage:'off'}},'x',{}).cafe,'employed');assert.equal(talkContext({starter:{done:false,skipped:true}},'x',{}).storyDone,true)}

// ---- 9. memory: caps, newest kept, first-meeting key, junk cleaned
{let mem=freshMem();const C={id:'m',nodes:[{id:'m.open',entry:true,say:[{t:'x'}],replies:[{label:'a',go:'m.b'}]},{id:'m.b',say:[{t:'y'}],end:true}]};
 const s={v:1,who:'m',node:'m.b',turn:3,keys:Array.from({length:10},(_,i)=>'k'+i),nodes:Array.from({length:40},(_,i)=>'node'+i),beats:Array.from({length:30},(_,i)=>'beat'+i),met:true,metNow:false,day:4,minute:90,ended:true};
 mem=remember(mem,s);assert.deepEqual(mem.last,['k4','k5','k6','k7','k8','k9']);assert.equal(Object.keys(mem.seen).length,SEEN_CAP);assert.equal(mem.seen.node39,1);assert.equal(mem.seen.node0,undefined,'the oldest visited nodes drop first');assert.equal(mem.beats.length,BEATS_CAP);assert.equal(mem.beats.at(-1),'beat29');assert.equal(mem.lastMin,4*1440+90);
 const again=remember(mem,{...s,keys:['k9','kNew'],nodes:['node39'],beats:[]});assert.deepEqual(again.last,['k5','k6','k7','k8','k9','kNew'].slice(-LAST_CAP));assert.equal(again.seen.node39,2);
 assert.deepEqual(cleanMem({last:[1,'a',null],seen:{ok:2,bad:'x',__proto__:3,neg:-1},beats:['a','a',5],lastMin:'x'}),{last:['a'],seen:{ok:2},beats:['a'],lastMin:-1});assert.deepEqual(cleanMem(null),freshMem());assert.deepEqual(remember(null,null),freshMem());
 assert.equal(lineKey('Hello  there. '),lineKey('Hello there.'));assert.notEqual(lineKey('a'),lineKey('b'));assert.match(lineKey('x'),/^[0-9a-z]+$/);assert.equal(lineKey(null),lineKey(''))}

// ---- 10. conditions: every key, edge cases, closed list
{const c=baseContext({who:'q',day:4,minute:at(23),weather:'snow',place:'door',tier:'friend',met:true,mood:70,story:5,storyDone:false,gig:'need-restock',gigClient:'noah',hired:{ridgeline:3},cafe:'employed',beats:['b1'],seen:{'n.a':2},recent:['egg-run'],mem:{lastMin:3*1440}});
 const yes=[{period:['evening','night']},{hour:[22,5]},{hour:[22,24]},{weather:'snow'},{place:['door','doorway']},{met:true},{tierMin:'acquaintance'},{tierMax:'close'},{tierMin:'friend',tierMax:'friend'},{mood:'good'},{story:[3,6]},{story:[5]},{storyDone:false},{gig:true},{gig:'need-restock'},{gigClient:['noah','x']},{hired:'ridgeline'},{hired:true},{rankMin:3},{rankMin:2,hired:'ridgeline'},{cafe:'employed'},{cafe:['onShift','employed']},{beat:'b1'},{notBeat:'b2'},{seen:{node:'n.a',min:2}},{seen:{node:'n.a',max:2}},{seen:{node:'n.zz',max:0}},{daysSince:{min:1,max:1}},{daysSince:[0,3]},{recent:['x','egg-run']},{}];
 const no=[{period:'morning'},{hour:[5,22]},{hour:[23,23]},{hour:'x'},{weather:'clear'},{place:'cafe'},{met:false},{met:'yes'},{tierMin:'close'},{tierMax:'acquaintance'},{tierMin:'bogus'},{mood:['low','okay']},{story:[6,9]},{story:'5'},{storyDone:true},{gig:false},{gig:'need-harvest'},{gigClient:'sophie'},{hired:'other'},{hired:false},{rankMin:4},{rankMin:1,hired:'other'},{cafe:'none'},{cafe:'onShift'},{beat:'b2'},{beat:['b1','b2']},{notBeat:'b1'},{seen:{node:'n.a',min:3}},{seen:{node:'n.zz'}},{seen:'n.a'},{daysSince:{min:2}},{daysSince:{}},{recent:['nope']},{bogusKey:true},'text',7];
 for(const k of yes)assert.equal(matches(k,c),true,JSON.stringify(k));for(const k of no)assert.equal(matches(k,c),false,JSON.stringify(k));
 assert.equal(matches(undefined,c),true);assert.equal(matches(null,c),true);assert.equal(matches({period:'night',met:true,mood:'good'},c),true,'all keys must hold');assert.equal(matches({period:'night',met:false},c),false);
 assert.equal(CONDITION_KEYS.length,20);assert.deepEqual([...EFFECT_KEYS],['meet','standing','mood','beat','topic','act']);for(const k of CONDITION_KEYS)assert(Object.isFrozen(CONDITION_KEYS)&&typeof k==='string');
 assert.deepEqual(effectsOf([{meet:true,standing:2},{beat:'x',topic:'deer',act:'a.b'},{mood:-3},null,'x',{standing:0},{beat:'__proto__'}],'n'),[{kind:'meet',at:'n'},{kind:'standing',amount:2,at:'n'},{kind:'beat',id:'x',at:'n'},{kind:'topic',id:'deer',at:'n'},{kind:'act',id:'a.b',at:'n'},{kind:'mood',amount:-3,at:'n'}]);assert.deepEqual(effectsOf(undefined),[])}
// an unknown condition key makes its variant never match, and the next fallback speaks instead
assert.deepEqual(texts(openConversation({id:'u',nodes:[{id:'u.open',entry:true,say:[{if:{bogus:1},t:'Never.'},{t:'Fallback.'}],end:true}]},'u',baseContext({who:'u'}),undefined,STRICT)),['Fallback.']);
// fact slots: {shop} is filled from cast.facts; an unknown slot stays visible so the validator can flag it
assert.deepEqual(texts(openConversation({id:'f',facts:{shop:'the Market',n:3},nodes:[{id:'f.open',entry:true,say:[{t:'At {shop}, {n} left, {nothing}.'}],end:true}]},'f',baseContext({who:'f'}),undefined,STRICT)),['At the Market, 3 left, {nothing}.']);

// ---- 11. garbage inputs never throw (default mode) and inputs are never mutated
{const circ={};circ.self=circ;const junk=[undefined,null,0,-1,NaN,Infinity,'x','',true,[],[1,2],{},{nodes:'x'},{nodes:[null,5,'a',{}]},{nodes:[{id:'a',entry:true,say:null}]},{nodes:[{id:'a',entry:true,say:[{t:5},null,{t:[null,{}]}],replies:[null,{label:5},{label:'x',go:{}}]}]},{nodes:[{id:'a',entry:true,say:[{t:'ok'}],replies:'x'}]},circ,()=>1,Symbol('s'),{v:1,who:'x',node:'a',keys:[],nodes:[],beats:[]},{v:1,who:5,node:'a'},{nodes:[{id:'a',entry:true,when:5,say:[{if:'x',t:'ok'}]}]}];
 for(const a of junk)for(const b of [undefined,null,'noah',5,{},circ,Symbol('q')]){
  const c0=talkContext(a,b,a);assert.equal(typeof c0.period,'string');const c1=baseContext(a);
  for(const cast of [a,NOAH]){const r=openConversation(cast,b,a);assert(Array.isArray(r.lines)&&Array.isArray(r.replies)&&Array.isArray(r.effects)&&typeof r.ended==='boolean');
   const r2=openConversation(cast,b,c1,a);const r3=openConversation(cast,'noah',c1);
   for(const s of [a,r2.session,r3.session]){const x=chooseReply(s,cast,b,a,a);assert(Array.isArray(x.lines));chooseReply(s,cast,BYE_ID,c1);chooseReply(s,cast,'r1',c1,freshMem())}
   remember(a,r3.session);remember(a,a);remember(r2.session,r3.session)}
  matches(a,b);matches(b,a);effectsOf(a);lineKey(a);cleanMem(a);specificity(a);periodOf(a)}}
{const cast=deepFreeze(JSON.parse(JSON.stringify(NOAH))),prog=deepFreeze({npcs:{noah:{mood:60,metDay:1,mem:{last:['a'],seen:{x:1},beats:['b'],lastMin:5}}},standing:{people:{noah:{points:9}}}}),env=deepFreeze({day:2,minute:500,recent:['a'],seed:1,place:'counter'});
 const ctx=deepFreeze(talkContext(prog,'noah',env)),mem=deepFreeze(cleanMem(prog.npcs.noah.mem)),a=openConversation(cast,'noah',ctx,mem,STRICT);deepFreeze(a.session);
 const b=chooseReply(a.session,cast,'r1',ctx,mem,STRICT),c=chooseReply(b.session,cast,'r2',ctx,mem,STRICT);remember(mem,c.session);remember(mem,b.session);assert.equal(b.session===a.session,false);assert(a.session.nodes.length===1&&b.session.nodes.length===2,'new sessions, old one untouched')}

// ---- 12. purity: the source has no clock, no chance, no DOM, no three.js (comments excluded)
{const code=fs.readFileSync(new URL('../dist/talk-engine.js',import.meta.url),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
 for(const bad of [/Math\.random/,/Date\.now/,/new Date/,/performance\.now/,/\bdocument\b/,/\bwindow\b/,/from 'three'/,/globalThis/,/localStorage/,/\bsetTimeout\b/])assert.equal(bad.test(code),false,'engine code must not use '+bad);
 assert.equal(/^[ \t]*(let|var)\s/m.test(code.split('\n').filter(l=>/^(let|var|const)\s/.test(l)&&/^(let|var)\s/.test(l)).join('\n')),false,'no top-level mutable state')}

console.log('Talk engine: period picks and edges, the current time on every turn, specificity and w, one variant per turn (no glue), no repeats within last (8 variants x 25 talks), least-recent fallback, replay determinism, unknown go (strict throws, runtime hides), effects as data and same-talk beats, talkContext from progress, memory caps, all 20 conditions, garbage in, inputs frozen, no clock or chance.');
