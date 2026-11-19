// C9 crowd cast sweep (19 non-roster town walkers), cross-cast uniqueness against EARLY_CAST + OAK_CAST, and npc-chat place awareness.
import assert from 'node:assert/strict';
import {CROWD_CAST} from '../dist/cast-crowd.js';
import {EARLY_CAST} from '../dist/cast-early.js';
import {OAK_CAST} from '../dist/cast-oak.js';
import {townPopulation} from '../dist/population.js';
import {chatLine,PLACE_REMARKS} from '../dist/npc-chat.js';
import {openConversation,chooseReply,baseContext,PERIODS,TIERS,PLACES,WEATHERS,BYE_ID,BYE_LABEL} from '../dist/talk-engine.js';
import {validateCast,validateCasts,formatProblems,timeWordsIn} from '../dist/talk-validate.js';

// 1. Every non-roster person in townPopulation has a crowd cast entry (19 walkers + 5 early + 4 oak = 28).
const rosterIds=new Set([...EARLY_CAST,...OAK_CAST].map(c=>c.personId));
const popWalkers=townPopulation().people.filter(p=>!rosterIds.has(p.id));
assert.equal(CROWD_CAST.length,popWalkers.length);
const crowdByPid=new Map(CROWD_CAST.map(c=>[c.personId,c]));
for(const p of popWalkers)assert.ok(crowdByPid.has(p.id),`missing crowd cast for ${p.name} (${p.id})`);

// 2. Validator passes with zero errors/warnings across ALL 28 casts (early + oak + crowd).
const all=[...EARLY_CAST,...OAK_CAST,...CROWD_CAST];
for(const c of CROWD_CAST){
 const p=validateCast(c,{others:all.filter(x=>x!==c),places:PLACES});
 assert.deepEqual(p,[],`validateCast problems for ${c.id}:\n${formatProblems(p)}`);
}
assert.deepEqual(validateCasts(all,{places:PLACES}),[]);

// 3. Style & sweep across periods, tiers, places, weather, and Ridgeline vest.
const MINUTE={morning:8*60,afternoon:14*60,evening:19*60,night:23*60};
let contextsChecked=0,walksChecked=0,bubblesChecked=0;

function checkResponse(res,period,seenLines,seenNodes){
 if(res.ended)return;
 assert(res.lines.length>=1&&res.lines.length<=3,'1-3 bubbles');
 const authored=res.replies.filter(r=>r.id!==BYE_ID);
 assert(authored.length<=4,`>4 authored replies at ${res.session.node}`);
 assert(res.replies.at(-1)?.id===BYE_ID&&res.replies.at(-1)?.label===BYE_LABEL,'BYE_ID last');
 assert(!seenNodes.has(res.session.node),`node cycle at ${res.session.node}`);
 seenNodes.add(res.session.node);
 for(const l of res.lines){
  bubblesChecked++;
  assert(!seenLines.has(l.text),`repeated line: ${l.text}`);
  seenLines.add(l.text);
  for(const [w,ok] of timeWordsIn(l.text))assert(ok.includes(period),`word "${w}" invalid in ${period}: ${l.text}`);
 }
}

function sweepWalk(cast,ctx,maxDepth=4){
 const open=openConversation(cast,cast.id,ctx,undefined,{strict:true});
 assert.equal(open.problems.length,0);
 assert(open.lines.length>0);
 const q=[{res:open,depth:0,lines:new Set(),nodes:new Set()}];
 while(q.length){
  const cur=q.shift(),lines=new Set(cur.lines),nodes=new Set(cur.nodes);
  checkResponse(cur.res,ctx.period,lines,nodes);
  if(cur.res.ended)continue;
  assert.equal(chooseReply(cur.res.session,cast,BYE_ID,ctx,undefined,{strict:true}).ended,true);
  if(cur.depth>=maxDepth)continue;
  for(const r of cur.res.replies){
   if(r.id===BYE_ID)continue;
   assert(r.label.length<=40,`label >40 chars: ${r.label}`);
   const next=chooseReply(cur.res.session,cast,r.id,ctx,undefined,{strict:true});
   assert.equal(next.problems.length,0);
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

for(const c of CROWD_CAST){
 for(const period of PERIODS)for(const tier of TIERS)for(const place of ['street','door','doorway']){
  contextsChecked++;
  sweepWalk(c,baseContext({who:c.id,minute:MINUTE[period],tier,met:tier!=='stranger',place,day:4,seed:7}));
 }
 for(const weather of WEATHERS){
  contextsChecked++;
  sweepWalk(c,baseContext({who:c.id,minute:MINUTE.afternoon,tier:'friend',met:true,weather,hired:{ridgeline:1},place:'street',day:5,seed:2}));
 }
}

// 4. npc-chat.js place-aware remarks differ across bench, shop, diner, and road.
const alex=popWalkers.find(p=>p.name==='Alex');
const malik=popWalkers.find(p=>p.name==='Malik Petrov');
assert.ok(alex&&malik);
for(const person of [alex,malik]){
 const lines=Object.keys(PLACE_REMARKS).map(place=>chatLine(person,{day:2,minute:600,place}).text);
 assert.equal(new Set(lines).size,Object.keys(PLACE_REMARKS).length,`distinct place lines for ${person.name}`);
}

console.log(`PASS talk-cast-crowd.mjs: ${CROWD_CAST.length} crowd casts validated against ${EARLY_CAST.length + OAK_CAST.length} named casts (0 errors, 0 warnings), ${contextsChecked} sweep contexts (${walksChecked} terminal walks, ${bubblesChecked} bubbles), place-aware npc-chat passed.`);
