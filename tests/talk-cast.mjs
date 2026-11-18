// C4 early cast sweep and pinned phrases.
import assert from 'node:assert/strict';
import {CASTS,castOf} from '../dist/cast.js';
import {NOAH,HAL,WALT,ELENA,SOPHIE,EARLY_CAST} from '../dist/cast-early.js';
import {openConversation,chooseReply,baseContext,PERIODS,TIERS,MOOD_BANDS,PLACES,BYE_ID,BYE_LABEL} from '../dist/talk-engine.js';
import {validateCast,validateCasts,formatProblems,DEFAULT_ACTS,timeWordsIn} from '../dist/talk-validate.js';

assert.deepEqual(EARLY_CAST,[NOAH,HAL,WALT,ELENA,SOPHIE]);
assert.equal(CASTS.length,5);

// 1. Validator passes with zero errors and zero warnings (including cross-cast duplicate text).
for(const c of CASTS){
 const p=validateCast(c,{others:CASTS.filter(x=>x!==c),places:PLACES});
 assert.deepEqual(p,[],`validateCast problems for ${c.id}:\n${formatProblems(p)}`);
}
assert.deepEqual(validateCasts(CASTS,{places:PLACES}),[]);

// 2. castOf lookup by id, personId, name, and invalid inputs.
for(const [k,want] of [['noah',NOAH],['NOAH',NOAH],['oak-apartments/8#1',NOAH],['hal',HAL],['Hal Brennan',HAL],['farm-house#1',HAL],['walt',WALT],['Walt Hargrove',WALT],['commuter:ridgeline-owner',WALT],['elena',ELENA],['oak-apartments/7#1',ELENA],['sophie',SOPHIE],['  Sophie  ',SOPHIE],['oak-apartments/2#1',SOPHIE]]){
 assert.equal(castOf(k),want,'castOf('+JSON.stringify(k)+')');
}
for(const miss of ['',null,undefined,42,'nobody','lincoln'])assert.equal(castOf(miss),null);

// 3. Breadth-first walk to depth 6 across key contexts: always speaks, never repeats a line in one walk, valid time words, known acts, always ends cleanly.
const MINUTE={morning:8*60,afternoon:14*60,evening:19*60,night:23*60};
const STORIES=[{story:0,storyDone:false},{story:1,storyDone:false},{story:2,storyDone:false},{story:3,storyDone:false},{story:4,storyDone:false},{story:5,storyDone:false},{story:6,storyDone:false},{story:7,storyDone:false},{story:8,storyDone:false},{story:9,storyDone:false},{story:10,storyDone:true}];
let contextsChecked=0,walksChecked=0,bubblesChecked=0;

function checkResponse(res,period,seenLines,seenNodes){
 if(res.ended)return;
 assert(res.lines.length>=1&&res.lines.length<=3,'must speak 1-3 bubbles');
 assert(res.replies.some(r=>r.id===BYE_ID&&r.label===BYE_LABEL),'BYE_ID offered');
 assert(!seenNodes.has(res.session.node),`node cycle within one walk at ${res.session.node}`);
 seenNodes.add(res.session.node);
 for(const l of res.lines){
  bubblesChecked++;
  assert(!seenLines.has(l.text),`repeated line within walk: ${l.text}`);
  seenLines.add(l.text);
  for(const [w,ok] of timeWordsIn(l.text))assert(ok.includes(period),`word "${w}" invalid in ${period}: ${l.text}`);
 }
 for(const e of res.effects)if(e.kind==='act')assert(DEFAULT_ACTS.includes(e.id),`unknown act ${e.id}`);
}

function sweepWalk(cast,ctx,maxDepth=6){
 const open=openConversation(cast,cast.id,ctx,undefined,{strict:true});
 assert.equal(open.problems.length,0);
 assert(open.lines.length>0,'open must say at least one bubble');
 const q=[{res:open,depth:0,lines:new Set(),nodes:new Set()}];
 while(q.length){
  const cur=q.shift();
  const lines=new Set(cur.lines),nodes=new Set(cur.nodes);
  checkResponse(cur.res,ctx.period,lines,nodes);
  if(cur.res.ended)continue;
  // Choosing BYE_ID always ends cleanly and keeps valid bye lines.
  const bye=chooseReply(cur.res.session,cast,BYE_ID,ctx,undefined,{strict:true});
  assert.equal(bye.ended,true);
  if(cur.depth>=maxDepth)continue;
  for(const r of cur.res.replies){
   if(r.id===BYE_ID)continue;
   const next=chooseReply(cur.res.session,cast,r.id,ctx,undefined,{strict:true});
   assert.equal(next.problems.length,0,`problems after reply "${r.label}" in ${cast.id}`);
   for(const e of next.effects)if(e.kind==='act')assert(DEFAULT_ACTS.includes(e.id));
   if(!next.ended){assert(next.lines.length>0);q.push({res:next,depth:cur.depth+1,lines,nodes})}
   else{
    for(const l of next.lines){
     assert(!lines.has(l.text),`repeated end line: ${l.text}`);
     for(const [w,ok] of timeWordsIn(l.text))assert(ok.includes(ctx.period),`end word "${w}" invalid in ${ctx.period}: ${l.text}`);
    }
    walksChecked++;
   }
  }
 }
}

const CONTEXTS_PER_CAST=c=>{
 const list=[];
 for(const period of PERIODS)for(const tier of TIERS)for(const place of ['counter','street','door','farm','office','cafe']){
  list.push(baseContext({who:c.id,minute:MINUTE[period],tier,met:tier!=='stranger',place,day:4,seed:7}));
 }
 for(const st of STORIES)for(const moodBand of MOOD_BANDS){
  list.push(baseContext({who:c.id,minute:MINUTE.morning,tier:'acquaintance',met:true,moodBand,place:c.id==='walt'?'office':c.id==='elena'?'cafe':c.id==='noah'?'counter':'street',...st,day:5,seed:2}));
 }
 if(c.id==='walt')for(const r of [1,2,4,6])list.push(baseContext({who:'walt',minute:600,place:'office',met:true,hired:{ridgeline:r},day:6}));
 if(c.id==='elena')for(const cf of ['none','employed','onShift'])list.push(baseContext({who:'elena',minute:600,place:'cafe',met:true,cafe:cf,day:6}));
 return list;
};

for(const c of CASTS){
 for(const ctx of CONTEXTS_PER_CAST(c)){
  contextsChecked++;
  sweepWalk(c,ctx,6);
 }
}

// 4. Helper for reading full session text & driving specific paths.
const replyBy=(res,re)=>res.replies.find(r=>re.test(r.label));
const step=(cast,res,re,ctx)=>{const r=replyBy(res,re);assert(r,`missing reply ${re} on ${res.session.node}`);return chooseReply(res.session,cast,r.id,ctx,undefined,{strict:true})};
const allText=res=>res.lines.map(l=>l.text).join(' ');

// 4a. Hal Brennan pinned starter-game & story phrases.
{
 const s2=baseContext({who:'hal',minute:600,place:'farm',story:2,storyDone:false});
 assert(allText(openConversation(HAL,'hal',s2,undefined,{strict:true})).includes('Noah said he might send someone out with my groceries'));
 const s3=baseContext({who:'hal',minute:600,place:'farm',story:3,storyDone:false});
 const o3=openConversation(HAL,'hal',s3,undefined,{strict:true});
 assert(allText(o3).includes('Noah')&&allText(o3).includes('Shortbed'));
 const r3=step(HAL,o3,/Hand over the groceries/,s3);
 assert(allText(r3).includes('Four crates')&&allText(r3).includes('Noah'));
 assert(r3.effects.some(e=>e.kind==='act'&&e.id==='hal.groceries'));
 const s4=baseContext({who:'hal',minute:600,place:'farm',story:4,storyDone:false});
 const o4=openConversation(HAL,'hal',s4,undefined,{strict:true});
 assert(allText(o4).includes('Four crates')&&/waiting|Noah/.test(allText(o4)));
 const s4b=baseContext({who:'hal',minute:600,place:'farm',story:4,storyDone:false,beats:['is.loaded']});
 assert(/waiting|Noah/.test(allText(openConversation(HAL,'hal',s4b,undefined,{strict:true}))));
 const sDone=baseContext({who:'hal',minute:14*60,place:'farm',story:10,storyDone:true,met:true});
 const oDone=openConversation(HAL,'hal',sDone,undefined,{strict:true});
 assert(/Come by some mornings/.test(allText(oDone)));
 const rTruck=step(HAL,oDone,/Shortbed/,sDone);
 assert(allText(rTruck).includes('$500'));
 assert(replyBy(rTruck,/Buy the truck/)&&step(HAL,rTruck,/Buy the truck/,sDone).effects.some(e=>e.kind==='act'&&e.id==='hal.buy'));
}

// 4b. Walt Hargrove pinned office-game phrases & acts.
{
 const wu=baseContext({who:'walt',minute:600,place:'office',hired:{},story:6,storyDone:false});
 const owu=openConversation(WALT,'walt',wu,undefined,{strict:true});
 assert(/Can I help you/.test(allText(owu)));
 assert(owu.effects.some(e=>e.kind==='beat'&&e.id==='walt.note'));
 const offer=step(WALT,owu,/looking for work/i,wu);
 assert(/bottom/i.test(allText(offer))&&/axe/i.test(allText(offer)));
 const hired=step(WALT,offer,/take it/i,wu);
 assert(hired.effects.some(e=>e.kind==='act'&&e.id==='walt.hire'));
 assert(/crew/.test(allText(hired))&&!/axe|logs/.test(allText(hired)),'walt.hired-confirm no longer repeats the act text');
 const wh1=baseContext({who:'walt',minute:780,place:'office',hired:{ridgeline:1},met:true});
 const owh1=openConversation(WALT,'walt',wh1,undefined,{strict:true});
 assert(/Good to see you/.test(allText(owh1)));
 assert(replyBy(owh1,/Anything waiting/));
 const p1=step(WALT,owh1,/promotion/i,wh1);
 assert(/Not yet/.test(allText(p1))&&/level 3/.test(allText(p1)));
 const wh2=baseContext({who:'walt',minute:780,place:'office',hired:{ridgeline:2},met:true});
 const p2=step(WALT,openConversation(WALT,'walt',wh2,undefined,{strict:true}),/promotion/i,wh2);
 assert(/sheet/.test(allText(p2))&&!/earned it/i.test(allText(p2)),'rank 2 is not told it earned Feller before the check');
 assert(step(WALT,p2,/promote me/i,wh2).effects.some(e=>e.kind==='act'&&e.id==='walt.promote'));
}

// 4c. Noah acts & story paths.
{
 const nc=baseContext({who:'noah',minute:540,place:'counter',story:0,storyDone:false,met:false});
 const on=openConversation(NOAH,'noah',nc,undefined,{strict:true});
 assert(/seven until ten/i.test(allText(on)));
 assert(replyBy(on,/browse items/i));
 const nw=step(NOAH,on,/Any work going/,nc);
 assert(replyBy(nw,/Sophie/)&&replyBy(nw,/Skip the introduction/));
 const nPick=step(NOAH,nw,/Sophie/,nc);
 assert(nPick.effects.some(e=>e.kind==='act'&&e.id==='job.pickup'));
 const nSkip=step(NOAH,nw,/Skip/,nc);
 assert(allText(nSkip).includes('$500')&&step(NOAH,nSkip,/Yes, skip/,nc).effects.some(e=>e.kind==='act'&&e.id==='skipStory'));
}

// 4d. Elena acts & facts (diner D-A2: eight dollars an hour plus tips replaced the $24 two-customer shift; the lunch is still $6).
{
 const ec=baseContext({who:'elena',minute:540,place:'cafe',cafe:'none',met:false});
 const oe=openConversation(ELENA,'elena',ec,undefined,{strict:true});
 const ew=step(ELENA,oe,/cafe work/i,ec);
 assert(allText(ew).includes('Eight dollars an hour plus tips'));
 const eh=step(ELENA,ew,/would like the job/i,ec);
 assert(eh.effects.some(e=>e.kind==='act'&&e.id==='cafe.hire'));
 const ee=baseContext({who:'elena',minute:600,place:'cafe',cafe:'employed',met:true});
 const eWork=step(ELENA,openConversation(ELENA,'elena',ee,undefined,{strict:true}),/cafe work/i,ee);
 assert(step(ELENA,eWork,/Clock me in/,ee).effects.some(e=>e.kind==='act'&&e.id==='cafe.clockin'));
 assert(step(ELENA,eWork,/due a promotion/,ee).effects.some(e=>e.kind==='act'&&e.id==='cafe.promote'),'the diner promotion is asked at the counter');
 const eMeal=step(ELENA,openConversation(ELENA,'elena',ee,undefined,{strict:true}),/eat and drink/i,ee);
 assert(allText(eMeal).includes('$6')&&step(ELENA,eMeal,/Yes, please/,ee).effects.some(e=>e.kind==='act'&&e.id==='cafe.meal'));
}

// 4e. Sophie thanks on groceries & gives Oscar hint.
{
 const sc=baseContext({who:'sophie',minute:900,place:'street',story:2,storyDone:false,met:false});
 const os=openConversation(SOPHIE,'sophie',sc,undefined,{strict:true});
 assert(os.effects.some(e=>e.kind==='beat'&&e.id==='sophie.thanked'));
 assert(os.effects.some(e=>e.kind==='standing'&&e.amount===1));
 const sn=step(SOPHIE,os,/18 Oak Street/i,sc);
 const so=step(SOPHIE,sn,/Oscar/i,sc);
 assert(/ten AM and noon/i.test(allText(so))&&/twice/i.test(allText(so)));
 assert(so.effects.some(e=>e.kind==='beat'&&e.id==='sophie.oscar-hint'));
}

// 4f. Opus review blockers (notes/eval/outbox/OPUS-cast-review.md B1-B6): derived beats, rank, truck, skippers.
{
 // B2: Elena offers the produce delivery only while carrying it (derived beat is.carryingCafe)
 const ed=baseContext({who:'elena',minute:600,place:'cafe',story:5,storyDone:false,met:true});
 assert(!replyBy(openConversation(ELENA,'elena',ed,undefined,{strict:true}),/produce delivery/),'no delivery reply when nothing is carried');
 const edc=baseContext({who:'elena',minute:600,place:'cafe',story:5,storyDone:false,met:true,beats:['is.carryingCafe']});
 assert(replyBy(openConversation(ELENA,'elena',edc,undefined,{strict:true}),/produce delivery/),'delivery reply while carrying');
 // B3: skippers are not thanked for groceries; Noah offers the Sophie reply to story-done non-skippers only
 const nd=baseContext({who:'noah',minute:600,place:'door',story:4,storyDone:false,met:true});
 assert(replyBy(openConversation(NOAH,'noah',nd,undefined,{strict:true}),/Sophie settle/),'Noah door offers the Sophie reply after the delivery');
 const ndSkip=baseContext({who:'noah',minute:600,place:'door',story:10,storyDone:true,met:true,beats:['is.skipped']});
 assert(!replyBy(openConversation(NOAH,'noah',ndSkip,undefined,{strict:true}),/Sophie settle/),'no Sophie reply for skippers');
 const sk=baseContext({who:'sophie',minute:600,place:'door',story:10,storyDone:true,met:true,beats:['is.skipped']});
 assert(!openConversation(SOPHIE,'sophie',sk,undefined,{strict:true}).effects.some(e=>e.kind==='beat'&&e.id==='sophie.thanked'),'skippers are not thanked');
 const sn=baseContext({who:'sophie',minute:600,place:'door',story:10,storyDone:true,met:true});
 assert(openConversation(SOPHIE,'sophie',sn,undefined,{strict:true}).effects.some(e=>e.kind==='beat'&&e.id==='sophie.thanked'),'non-skippers are thanked');
 const skG=step(SOPHIE,openConversation(SOPHIE,'sophie',sk,undefined,{strict:true}),/grocery order/i,sk);
 assert(/Gigs board/.test(allText(skG))&&!/unbruised/.test(allText(skG)),'skipper groceries line');
 // B4: Walt reads the real rank
 const wf=baseContext({who:'walt',minute:780,place:'office',hired:{ridgeline:6},met:true});
 const wfo=openConversation(WALT,'walt',wf,undefined,{strict:true});
 assert(/Foreman/.test(allText(wfo))&&!/Sawyer/.test(allText(wfo)),'a Foreman is greeted as Foreman');
 const wn=baseContext({who:'walt',minute:20*60,place:'street',hired:{ridgeline:3},met:true});
 assert(!/Feller rank/.test(allText(openConversation(WALT,'walt',wn,undefined,{strict:true}))),'no stale Feller rank line');
 // B5: Hal does not sell the truck to an owner
 const ho=baseContext({who:'hal',minute:14*60,place:'farm',story:10,storyDone:true,met:true,beats:['is.ownsShortbed']});
 const hot=step(HAL,openConversation(HAL,'hal',ho,undefined,{strict:true}),/Shortbed/,ho);
 assert(/yours now/.test(allText(hot))&&!replyBy(hot,/Buy the truck/),'no sale to an owner');
 // B6: the loaded line is derived, and absent without it
 const hl=baseContext({who:'hal',minute:600,place:'farm',story:4,storyDone:false});
 assert(!/crates are on/i.test(allText(openConversation(HAL,'hal',hl,undefined,{strict:true}))),'no "crates are on" before loading');
 // H1: Sophie pays $12
 const n0=baseContext({who:'noah',minute:540,place:'counter',story:0,storyDone:false,met:false});
 const nw0=step(NOAH,openConversation(NOAH,'noah',n0,undefined,{strict:true}),/Any work going/,n0);
 assert(replyBy(nw0,/\$12\.00/)&&!replyBy(nw0,/\$3\.00/),'Sophie run is $12');
 // H3: no "Studio 2B" for a new player at the door
 const nn=baseContext({who:'noah',minute:600,place:'door',met:false});
 assert(!/Studio 2B|across the street/.test(allText(openConversation(NOAH,'noah',nn,undefined,{strict:true}))),'no home or street-geography slip');
}
console.log(`PASS talk-cast.mjs: ${CASTS.length} early casts validated (0 errors, 0 warnings), ${contextsChecked} sweep contexts (${walksChecked} terminal walks, ${bubblesChecked} bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.`);
