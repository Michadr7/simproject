// C2 (notes/conversation-design.md section 2d): the cast validator. A bad cast triggers every rule exactly once, a good cast has zero problems, and every message names the person, the node, what is wrong and how to fix it.
import assert from 'node:assert/strict';
import {validateCast,validateCasts,formatProblem,formatProblems,timeWordsIn,RULES,TIME_WORDS,DEFAULT_ACTS} from '../dist/talk-validate.js';
import {openConversation,baseContext,chooseReply} from '../dist/talk-engine.js';

const ACTS=['openStore','gigBoard'];
const codes=ps=>ps.map(p=>p.code);
const count=(ps,code)=>ps.filter(p=>p.code===code).length;

// ---- the good cast: period variants, a fallback at the end of every list, a night-only node with a night word, facts for slots, no problems
const GOOD={id:'noah',name:'Noah',voice:'chatty, tidy, counts things out loud',facts:{shop:'the Corner Market'},avoid:['awesome'],maxSentenceWords:20,bye:[{t:'Take care now.'}],nodes:[
 {id:'noah.open',entry:true,say:[
  {if:{period:'morning'},t:'Morning! Welcome to {shop}.'},
  {if:{period:['evening','night']},t:'Late one, so be quick.'},
  {if:{period:'afternoon',met:true},t:'Afternoon. Need anything?'},
  {t:['Hello there.','What can I get you?']}],
  replies:[{label:'Any work going?',go:'noah.work'},{label:'Can I look around?',act:'openStore'},{label:'Tell me about the shop.',go:'noah.shop'},{label:'When do you close?',go:'noah.closing',if:{period:['evening','night']}}]},
 {id:'noah.work',say:[{t:['Plenty today.','Check the board by the door.'],do:{beat:'noah.work-asked',standing:1}}],replies:[{label:'Show me the board.',act:'gigBoard'},{label:'Thanks.',go:'noah.open'}]},
 {id:'noah.shop',topic:'chat',say:[{if:{tierMin:'friend'},t:'Between us, the eggs sell out by noon.'},{t:'Shelves are full and the milk is cold.'}],replies:[{label:'Back to the start.',go:'noah.open'}]},
 {id:'noah.closing',when:{period:['evening','night']},say:[{t:'Tonight the doors shut at ten.'}],end:true}]};
{const ps=validateCast(GOOD,{acts:ACTS});assert.deepEqual(ps,[],'the good cast has zero problems:\n'+formatProblems(ps));
 // and the engine can really talk with it at every hour
 for(let h=0;h<24;h++)for(const tier of ['stranger','friend']){const r=openConversation(GOOD,'noah',baseContext({who:'noah',minute:h*60,tier,met:true}),undefined,{strict:true});assert(r.lines.length>0)}}

// ---- the bad cast: every numbered rule (1-11) fires exactly once
const LONG='This is a very long line that just keeps going and going. '.repeat(3).trim();
const BAD={id:'badman',name:'Badman',voice:'bad on purpose',facts:{},nodes:[
 {id:'b.open',entry:true,do:{bogusEffect:1},say:[
  {t:'Hello there. What can I get you?'},
  {if:{period:'morning',bogusKey:1},t:'Fine morning today.'},                                  // rule 1: unknown condition key
  {if:{period:'afternoon'},t:'Hi. Are you here about the woods? Hey. Did I tell you about the deer?'},   // rule 9: two greetings glued
  {t:'Morning, how are you?'},                                                                // rule 8: a time word in a line that can be said at any hour
  {if:{period:'evening'},t:LONG},                                                             // rule 10: over 160 characters
  {if:{period:'night'},t:'Your order is undefined today.'},                                   // rule 10: a placeholder leaked
  {if:{period:'noon'},t:'Midday already.'},                                                   // rule 1: a value that does not exist
  {if:{period:'afternoon',met:true},t:'Come back soon.'}],                                    // rule 7: the same text in two places
  replies:[{label:'Any work going?',go:'b.work'},{label:'Any work going?',go:'b.shop'},         // rule 6: duplicate label
   {label:'Where is the exit?',go:'b.nowhere'},                                                 // rule 4: go to a missing node
   {label:'Look around.',act:'doesNotExist'},                                                   // rule 1: an unknown act
   {label:'Tell me more.',go:'b.shop'},{label:'Who else works here?',go:'b.shop'},{label:'What time is it?',go:'b.picky'}]},   // rule 5: 7 replies
 {id:'b.work',say:[{t:'Plenty to do.'}]},                                                       // rule 3: a dead end
 {id:'b.shop',say:[{t:'Come back soon.'}],end:true},
 {id:'b.orphan',say:[{t:'Nobody finds me.'}],end:true},                                         // rule 2: unreachable
 {id:'b.picky',say:[{if:{period:'night'},t:'Night talk.'}],end:true}]};                         // rule 11: nothing to say by day
const bad=validateCast(BAD,{acts:ACTS});
const expectCodes=['unknown-condition','bad-condition-value','unknown-effect','unknown-act','unreachable-node','dead-end','missing-go','too-many-replies','duplicate-label','repeated-text','wrong-time-word','glue-suspect','line-too-long','placeholder-text','uncovered-node'];
for(const c of expectCodes)assert.equal(count(bad,c),1,`rule code ${c} must fire exactly once, got ${count(bad,c)}:\n${formatProblems(bad)}`);
assert.equal(bad.length,expectCodes.length,'and nothing else fires:\n'+formatProblems(bad));
assert.deepEqual([...new Set(bad.map(p=>p.rule))].sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,10,11],'all eleven numbered rules are covered');
// every message says WHICH person/node/line, WHAT and HOW
for(const p of bad){assert(p.message.startsWith('Badman / '),'names the person: '+p.message);assert(/Fix: .{12,}\.$/.test(p.message),'has a fix sentence: '+p.message);assert(p.fix.length>=12&&p.where.length>0);
 assert.equal(p.level,'error');assert.equal(p.who,'Badman');assert.equal(p.rule,RULES[p.code].rule);assert.equal(formatProblem(p),p.message)}
const one=c=>bad.find(p=>p.code===c);
assert.match(one('unknown-condition').message,/node b\.open \/ say variant 2 if: condition key "bogusKey" does not exist\. Fix: use only: period, hour/);
assert.match(one('bad-condition-value').message,/variant 7 if: period must be one or a list of morning, afternoon, evening, night, got "noon"/);
assert.match(one('unknown-effect').message,/node b\.open \/ node do: effect key "bogusEffect" does not exist/);
assert.match(one('unknown-act').message,/reply 4 "Look around\." : ?|reply 4 "Look around\."/);assert.match(one('unknown-act').message,/act "doesNotExist" is not a known game action\. Fix: use one of: openStore, gigBoard/);
assert.match(one('unreachable-node').message,/node b\.orphan \/ node: no reply leads to this node/);assert.match(one('unreachable-node').message,/go:"b\.orphan"/);
assert.match(one('dead-end').message,/node b\.work \/ replies: the node has no replies that lead anywhere and no end:true/);
assert.match(one('missing-go').message,/reply 3 "Where is the exit\?": go points to "b\.nowhere", which is not a node of this cast/);
assert.match(one('too-many-replies').message,/the node has 7 replies but only 6 are shown/);
assert.match(one('duplicate-label').message,/reply 2 "Any work going\?": two replies in this node read the same/);
assert.match(one('repeated-text').message,/the same text appears 2 times in this cast/);assert.equal(one('repeated-text').text,'Come back soon.');
assert.match(one('wrong-time-word').message,/variant 4 bubble 1: the word "morning" is only right in morning but this variant can be said in morning, afternoon, evening, night \(wrong in afternoon, evening, night\)\. Fix: add if:\{period:'morning'\}/);
assert.match(one('glue-suspect').message,/variant 3: the variant has 2 greeting openers \("Hi", "Hey"\), so two greetings were glued together/);
assert.match(one('line-too-long').message,/variant 5 bubble 1: the bubble is \d{3} characters \(limit 160\)/);assert.equal(one('line-too-long').node,'b.open');
assert.match(one('placeholder-text').message,/variant 6 bubble 1: the text contains a placeholder or leftover code \(undefined\)/);
assert.match(one('uncovered-node').message,/node b\.picky \/ say: no variant fits when \d\d:00 \((morning|afternoon|evening)\)/);assert.match(one('uncovered-node').message,/more situations\), so the node would say nothing\. Fix: add a last variant with no `if`/);

// ---- the shape and voice extras: each fires exactly once in a second bad cast
const BAD2={id:'bob',name:'Bob',kind:'crowd',avoid:['awesome'],maxSentenceWords:5,facts:{job:'a baker',home:'Oak Street'},nodes:[
 {id:'bob.a',say:[{t:'That is awesome.'}],end:true},
 {id:'bob.a',say:[{t:'Duplicate id.'}],end:true},
 {id:'bob.s',say:[{t:'This sentence has way more than five words in it.'}],end:true},
 {id:'bob.shape',end:true}]};
const bad2=validateCast(BAD2,{acts:ACTS}),extra=['bad-shape','duplicate-node-id','no-entry','crowd-facts','missing-voice','voice-avoid','voice-sentence-long'];
for(const c of extra)assert.equal(count(bad2,c),1,`extra code ${c} once:\n${formatProblems(bad2)}`);assert.equal(bad2.length,extra.length,formatProblems(bad2));
assert.match(bad2.find(p=>p.code==='crowd-facts').message,/Bob \/ facts\.hint: a crowd person needs a facts\.hint sentence\. Fix: add facts:\{hint:'a whole phrase'\}/);
assert.equal(bad2.find(p=>p.code==='missing-voice').level,'warn');assert.equal(bad2.find(p=>p.code==='voice-avoid').level,'warn');
assert.deepEqual([...Object.keys(RULES)].sort(),[...expectCodes,...extra].sort(),'every code in RULES is covered by one of the two bad casts');

// ---- time words: the owner's real bad line, the neutral phrases, hours and periods
assert.deepEqual(timeWordsIn('Hey! Do you hunt? You look like you could hunt. Morning. Cold enough for a hunt.').map(x=>x[0]),['morning']);
assert.deepEqual(timeWordsIn('Come by tomorrow morning, or last night, or every evening.').map(x=>x[0]),[],'phrases that do not name the present are ignored');
assert.deepEqual(timeWordsIn('Good morning. Lunch is at noon, and tonight we close.').map(x=>x[0]),['tonight','good morning','lunch']);assert.deepEqual(timeWordsIn('Come by some mornings.').map(x=>x[0]),[],'"mornings" is not "morning"');
assert.deepEqual(timeWordsIn(null),[]);assert(TIME_WORDS.length>=15);
{const mkc=(cond,t,when)=>({id:'t',name:'T',voice:'v',nodes:[{id:'t.open',entry:true,when,say:[{if:cond,t},{t:'Hello there.'}],end:true}]});
 assert.equal(count(validateCast(mkc({hour:[8,10]},'Morning!')),'wrong-time-word'),0,'hour 8-10 is all morning');assert.equal(count(validateCast(mkc({hour:[8,14]},'Morning!')),'wrong-time-word'),1,'hour 8-14 reaches the afternoon');
 assert.equal(count(validateCast(mkc(undefined,'Morning!',{period:'morning'})),'wrong-time-word'),0,'a node when:{period} counts');assert.equal(count(validateCast(mkc({period:'night'},'Tonight is quiet.')),'wrong-time-word'),0);assert.equal(count(validateCast(mkc({period:'morning'},'Tonight is quiet.')),'wrong-time-word'),1);
 assert.equal(count(validateCast(mkc({hour:[22,5]},'Midnight oil.')),'wrong-time-word'),0,'hour [22,5) wraps and is night');assert.equal(count(validateCast(mkc({period:['evening','night']},'Good night.')),'wrong-time-word'),0)}
// the owner's example line, written as one unconditional variant, fails twice
{const c={id:'l',name:'Lincoln',voice:'v',nodes:[{id:'l.open',entry:true,say:[{t:'Hey! Do you hunt? You look like you could hunt. Morning. Cold enough for a hunt.'}],end:true}]};assert.deepEqual(codes(validateCast(c)).sort(),['glue-suspect','wrong-time-word'])}

// ---- cross-cast repeats, fragments, ids, slots
{const A={id:'a',name:'Anna',voice:'v',nodes:[{id:'a.open',entry:true,say:[{t:'The shelves are full today.'}],end:true}]},B={id:'b',name:'Ben',voice:'v',nodes:[{id:'b.open',entry:true,say:[{t:'The SHELVES are full, today!'}],end:true}]};
 assert.deepEqual(validateCast(A),[],'alone, Anna is fine');const all=validateCasts([A,B]);assert.deepEqual(codes(all),['repeated-text','repeated-text'],'both are told (normalised: case and punctuation ignored)');
 assert.match(all[0].message,/^Anna \/ node a\.open \/ say variant 1 bubble 1: another person already says exactly this \(Ben \/ b\.open\)/);assert.equal(validateCast(B,{others:[A]}).filter(p=>p.code==='repeated-text').length,1)}
{const one=t=>codes(validateCast({id:'x',name:'X',voice:'v',facts:{shop:'the Market'},nodes:[{id:'x.open',entry:true,say:[{t}],end:true}]}));
 assert.deepEqual(one('and then the shelves'),['glue-suspect'],'lower-case start (one problem per bubble)');assert.deepEqual(one('Cold enough for a hunt'),['glue-suspect']);assert.deepEqual(one('Is it cold?'),[]);assert.deepEqual(one('She said "stop."'),[]);assert.deepEqual(one('Wait...'),[]);
 assert.deepEqual(one('Visit {shop} today.'),[]);assert.deepEqual(one('Visit {nothing} today.'),['placeholder-text']);assert.deepEqual(one('Go to alder-store now.'),[],'plain kebab words are allowed unless they are known ids');
 assert.deepEqual(one('See ridgeline.sawyer now.'),['placeholder-text'],'something that looks like an id');assert.deepEqual(one('Price is $500.'),[]);assert.deepEqual(one('x'.repeat(161)).includes('line-too-long'),true);assert.deepEqual(codes(validateCast({id:'x',name:'X',voice:'v',nodes:[{id:'x.open',entry:true,say:[{t:'Go to ridgeline-sawyer now.'}],end:true}]},{ids:['ridgeline-sawyer']})),['placeholder-text'],'known ids from opts.ids are flagged');
 assert.deepEqual(one(['One.','Two.','Three.','Four.']),['bad-shape'])}
// unknown acts need the act list: the default list is the design note's
assert(DEFAULT_ACTS.includes('hal.groceries')&&DEFAULT_ACTS.includes('skipStory'));assert.deepEqual(codes(validateCast({id:'x',name:'X',voice:'v',nodes:[{id:'x.open',entry:true,say:[{t:'Hi.'}],replies:[{label:'Shop',act:'openStore'}]}]})),[]);
// coverage: entries only at the counter leave the street empty; a fallback fixes it
{const mk=say=>({id:'c',name:'C',voice:'v',nodes:[{id:'c.counter',entry:true,end:true,when:{place:'counter'},say},{id:'c.door',entry:true,end:true,when:{place:'door'},say:[{t:'Who is it?'}]}]});
 assert.deepEqual(validateCast(mk([{t:'Welcome in.'}])),[],'the sweep only tries places the cast names (or opts.places)');
 const ps=validateCast(mk([{t:'Welcome in.'}]),{places:['street']});assert.deepEqual(codes(ps),['uncovered-node']);assert.match(ps[0].message,/no entry node opens when place street/,ps[0].message);
 assert.deepEqual(codes(validateCast({id:'c',name:'C',voice:'v',nodes:[{id:'c.counter',entry:true,end:true,when:{place:'counter'},say:[{t:'Welcome in.'}]},{id:'c.any',entry:true,end:true,say:[{t:'Hello there.'}]}]})),[])}
// a say list whose variants only cover some ctx values (story steps) is caught with the missing step named
{const ps=validateCast({id:'s',name:'S',voice:'v',nodes:[{id:'s.open',entry:true,say:[{t:'Hello there.'}],replies:[{label:'Story?',go:'s.story'}]},{id:'s.story',say:[{if:{story:[0,2]},t:'Early days.'},{if:{story:[4,6]},t:'Getting on.'}],end:true}]});
 assert.deepEqual(codes(ps),['uncovered-node']);assert.match(ps[0].message,/when story step (3|7|99)\b/,ps[0].message)}

// ---- garbage never throws; a non-cast gives one clear problem
for(const junk of [undefined,null,0,'x',[],{},{nodes:'x'},{id:'q',nodes:[null,5,'a',{}]},{id:'q',nodes:[{id:'a',entry:true,say:null,replies:'x'}]},{id:'q',nodes:[{id:'a',entry:true,say:[null,{t:5},{t:[]},{t:'ok.'}],replies:[null,{label:5},{label:'x',go:{}}]}]},{id:'q',nodes:[{id:'a',entry:true,when:'x',say:[{if:7,t:'ok.'}],do:'z'}]},{id:'q',nodes:[{id:'a',entry:true,say:[{t:'ok.'}],replies:[{label:'x',go:'a',if:{period:5,hour:'x',seen:3,daysSince:{}}}]}],avoid:[1,null],maxSentenceWords:'x'}])
 for(const o of [undefined,null,{},{acts:'x',others:[null,5,{nodes:3}]},{sweepLimit:'x'}]){const ps=validateCast(junk,o);assert(Array.isArray(ps));for(const p of ps)assert.equal(typeof p.message,'string')}
assert.equal(validateCast(null).length,1);assert.equal(validateCast(null)[0].code,'bad-shape');assert.match(validateCast(null)[0].message,/not a cast object\. Fix: pass an object like/);
assert.deepEqual(validateCasts(null),[]);assert.deepEqual(validateCasts({a:GOOD}),validateCast(GOOD));
// inputs are not changed
{const snap=JSON.stringify(BAD);validateCast(BAD,{acts:ACTS});assert.equal(JSON.stringify(BAD),snap);const deep=o=>{Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object')deep(v)};deep(BAD);assert.equal(validateCast(BAD,{acts:ACTS}).length,expectCodes.length)}
// a cast the validator passes never leaves the engine speechless (strict engine, many contexts)
{let n=0;for(let h=0;h<24;h++)for(const tier of ['stranger','acquaintance','friend','close'])for(const place of ['counter','street'])for(const met of [true,false]){const ctx=baseContext({who:'noah',minute:h*60,tier,place,met,day:h});const r=openConversation(GOOD,'noah',ctx,undefined,{strict:true});assert(r.lines.length>0);for(const rep of r.replies){const x=chooseReply(r.session,GOOD,rep.id,ctx,undefined,{strict:true});n++;assert(x.ended||x.lines.length>0,'no silent node after '+rep.id)}}assert(n>1000)}

// ---- scripts/talk-check.mjs: works on any cast object (module exports), prints problems and a transcript, exit code 1 on errors
{const {findCasts,checkCast,transcript,main}=await import('../scripts/talk-check.mjs');
 assert.deepEqual(findCasts({GOOD,list:[BAD,GOOD],map:{a:BAD2},junk:5,fn:()=>1,nested:{x:{y:1}}}),[GOOD,BAD,BAD2],'finds casts in exports: single, array, object of casts, no duplicates');assert.deepEqual(findCasts(null),[]);
 assert.equal(checkCast(GOOD,{acts:ACTS}).text,'No problems for Noah.');assert.match(checkCast(BAD,{acts:ACTS}).text,/^\d+\. \[error unknown-condition\] Badman \/ node b\.open/m);assert.match(checkCast(BAD,{acts:ACTS}).text,/15 problem\(s\) for Badman\.$/);
 const t=transcript(GOOD,{minute:8*60,tier:'friend',met:true,place:'counter'});assert.match(t,/^ {2}Noah: Morning! Welcome to the Corner Market\.\n {2}you could say: "Any work going\?" \| "Can I look around\?" \| "Tell me about the shop\." \| "See you"$/);
 assert.match(transcript(GOOD,{minute:23*60,place:'counter'},{walk:true}),/you: When do you close\?\n {4}Noah: Tonight the doors shut at ten\./);assert.match(transcript(BAD2,{}),/says nothing here/);
 const os=await import('node:os'),fsx=await import('node:fs'),pathx=await import('node:path');const dir=fsx.mkdtempSync(pathx.join(os.tmpdir(),'talkcheck-')),file=pathx.join(dir,'casts.mjs');
 fsx.writeFileSync(file,'export const good='+JSON.stringify(GOOD)+';export const bad='+JSON.stringify(BAD)+';');
 const run=async args=>{const logs=[],log=console.log,err=console.error;console.log=(...a)=>logs.push(a.join(' '));console.error=(...a)=>logs.push(a.join(' '));try{return {code:await main(args),out:logs.join('\n')}}finally{console.log=log;console.error=err}};
 let r=await run([file,'noah','--acts=openStore,gigBoard','--period=evening','--tier=close']);assert.equal(r.code,0);assert.match(r.out,/No problems for Noah\./);assert.match(r.out,/--- evening, close ---\n {2}Noah: Late one, so be quick\./);
 r=await run([file,'badman','--acts=openStore,gigBoard','--problems-only']);assert.equal(r.code,1,'errors give exit code 1');assert.match(r.out,/15 problem\(s\) for Badman\./);assert(!/---/.test(r.out),'--problems-only prints no transcript');
 r=await run([file,'nobody']);assert.equal(r.code,2);assert.match(r.out,/no cast "nobody" in .*found: (noah, badman|badman, noah)/);r=await run([pathx.join(dir,'missing.mjs')]);assert.equal(r.code,2);assert.match(r.out,/is not a file/);
 fsx.rmSync(dir,{recursive:true,force:true})}

console.log('Talk validator: good cast has zero problems; the bad cast fires all 11 rules (15 codes) exactly once with person, node, line, what and how; the 7 shape and voice extras once each; time words, glue, ids, slots, cross-cast repeats, the coverage sweep, garbage in, inputs untouched.');
