// C8 Oak Street & Cedar Loop cast sweep, cross-cast validation, and pinned phrases.
import assert from 'node:assert/strict';
import {OAK_CAST,OSCAR,LINCOLN,BRENTSTER,GRACE} from '../dist/cast-oak.js';
import {EARLY_CAST} from '../dist/cast-early.js';
import {openConversation,chooseReply,baseContext,PERIODS,TIERS,MOOD_BANDS,PLACES,WEATHERS,BYE_ID,BYE_LABEL} from '../dist/talk-engine.js';
import {validateCast,validateCasts,formatProblems,DEFAULT_ACTS,timeWordsIn} from '../dist/talk-validate.js';

assert.deepEqual(OAK_CAST,[OSCAR,LINCOLN,BRENTSTER,GRACE]);
assert.equal(OAK_CAST.length,4);

// 1. Validator passes with zero errors/warnings (including cross-cast uniqueness against EARLY_CAST).
const all=[...EARLY_CAST,...OAK_CAST];
for(const c of OAK_CAST){
 const p=validateCast(c,{others:all.filter(x=>x!==c),places:PLACES});
 assert.deepEqual(p,[],`validateCast problems for ${c.id}:\n${formatProblems(p)}`);
}
assert.deepEqual(validateCasts(all,{places:PLACES}),[]);

// 2. Style rules: every reply label <= 40 chars and <= 4 authored replies visible at once.
for(const c of OAK_CAST){
 for(const n of c.nodes){
  for(const r of n.replies||[]){
   assert(r.label.length<=40,`label >40 chars in ${c.id}/${n.id}: ${r.label} (${r.label.length})`);
  }
 }
}

// 3. Breadth-first sweep to depth 6 across periods, tiers, places, weather, moods, and hired:'ridgeline'.
const MINUTE={morning:8*60,afternoon:14*60,evening:19*60,night:23*60};
let contextsChecked=0,walksChecked=0,bubblesChecked=0;

function checkResponse(res,period,seenLines,seenNodes){
 if(res.ended)return;
 assert(res.lines.length>=1&&res.lines.length<=3,'must speak 1-3 bubbles');
 const authored=res.replies.filter(r=>r.id!==BYE_ID);
 assert(authored.length<=4,`more than 4 authored replies shown at ${res.session.node}: ${authored.length}`);
 assert(res.replies.at(-1)?.id===BYE_ID&&res.replies.at(-1)?.label===BYE_LABEL,'BYE_ID last');
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
  const cur=q.shift(),lines=new Set(cur.lines),nodes=new Set(cur.nodes);
  checkResponse(cur.res,ctx.period,lines,nodes);
  if(cur.res.ended)continue;
  const bye=chooseReply(cur.res.session,cast,BYE_ID,ctx,undefined,{strict:true});
  assert.equal(bye.ended,true);
  if(cur.depth>=maxDepth)continue;
  for(const r of cur.res.replies){
   if(r.id===BYE_ID)continue;
   const next=chooseReply(cur.res.session,cast,r.id,ctx,undefined,{strict:true});
   assert.equal(next.problems.length,0,`problems after reply "${r.label}" in ${cast.id}`);
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
 for(const period of PERIODS)for(const tier of TIERS)for(const place of ['counter','street','door','doorway']){
  list.push(baseContext({who:c.id,minute:MINUTE[period],tier,met:tier!=='stranger',place,day:4,seed:7}));
 }
 for(const weather of WEATHERS)for(const moodBand of MOOD_BANDS){
  list.push(baseContext({who:c.id,minute:MINUTE.evening,tier:'friend',met:true,weather,moodBand,hired:{ridgeline:2},place:c.id==='oscar'||c.id==='grace'?'doorway':'counter',day:5,seed:2}));
 }
 return list;
};

for(const c of OAK_CAST){
 for(const ctx of CONTEXTS_PER_CAST(c)){
  contextsChecked++;
  sweepWalk(c,ctx,6);
 }
}

// 4. Pinned checks: Oscar 10-12 doorway vs afternoon, Lincoln counter acts, Brentster Junior beats, Grace no false indoor supper.
{
 const text=res=>res.lines.map(l=>l.text).join(' ');
 const oscarMorning=openConversation(OSCAR,'oscar',baseContext({who:'oscar',minute:10*60+30,tier:'stranger',met:false,place:'doorway',day:2}));
 assert.match(text(oscarMorning),/State your business/i);
 const oscarLate=openConversation(OSCAR,'oscar',baseContext({who:'oscar',minute:15*60,tier:'friend',met:true,place:'doorway',day:2}));
 assert.match(text(oscarLate),/ten and noon/i);

 const lincolnCounter=openConversation(LINCOLN,'lincoln',baseContext({who:'lincoln',minute:19*60,tier:'acquaintance',met:true,place:'counter',hired:{ridgeline:1},day:3}));
 assert.match(text(lincolnCounter),/Ridgeline vest/i);
 assert(lincolnCounter.replies.some(r=>/browse items/i.test(r.label)));
 assert(lincolnCounter.replies.some(r=>/prices/i.test(r.label)));

 const brent=openConversation(BRENTSTER,'brentster',baseContext({who:'brentster',minute:14*60,tier:'acquaintance',met:true,place:'counter',day:3}));
 const jReply=brent.replies.find(r=>/Brentster Jr/i.test(r.label));
 assert(jReply);
 const jRes=chooseReply(brent.session,BRENTSTER,jReply.id,baseContext({who:'brentster',minute:14*60,tier:'acquaintance',met:true,place:'counter',day:3}));
 assert(jRes.effects.some(e=>e.kind==='beat'&&e.id==='junior.met'));

 for(const n of GRACE.nodes)for(const v of n.say){
  const t=Array.isArray(v.t)?v.t.join(' '):v.t;
  assert(!/stay for supper|come inside/i.test(t),`Grace must not promise indoor supper: ${t}`);
 }
}

console.log(`PASS talk-cast-oak.mjs: ${OAK_CAST.length} Oak/Cedar casts validated against ${EARLY_CAST.length} early casts (0 errors, 0 warnings), ${contextsChecked} sweep contexts (${walksChecked} terminal walks, ${bubblesChecked} bubbles), pinned checks passed.`);
