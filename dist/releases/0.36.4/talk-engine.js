// Talk engine (notes/conversation-design.md stage C1): pure rules that pick ONE whole line variant per turn from time, standing, mood and story; effects come back as data.
// No DOM, no three.js, no Date.now, no Math.random, no globals: every function returns NEW objects and never changes its inputs. All choice comes from an integer hash of
// (seed, who, node, day, visits, turn) and from the person's memory, so the same inputs always give the same transcript. Time is never read: the caller passes the CURRENT
// (day, minute) into every turn, and game time never pauses during a talk, so a long talk can move from "morning" to "afternoon" lines.
//
// CAST SHAPE (authors write this; scripts/talk-check.mjs and dist/talk-validate.js check it):
//   cast = {id, name, voice:'one line for writers', facts:{job:'...'}, bye:[variant]?, nodes:[node]}
//   node = {id, entry?:true, topic?:'deer', when?:cond, say:[variant], replies?:[reply], end?:true, do?:effects}
//   variant = {if?:cond, t:'one bubble' | ['bubble','bubble'] (1 to 3 bubbles written together as ONE unit), w?:number, do?:effects}
//   reply = {id?:'x', label:'short first-person line', if?:cond, go?:'node.id', act?:'actName', end?:true, do?:effects}
//   cond = an object of CONDITION_KEYS (all keys must hold); effects = {meet:true, standing:1, mood:2, beat:'x', topic:'deer', act:'name'} or an array of those.
//   {name} inside a bubble is replaced by cast.facts.name (a string) when it exists.
// The engine adds the free "See you" reply (id BYE_ID) to every node that is not an end node, so authors never write it.
import {tierFor,moodWord} from './npc-life.js';
export const TALK_VERSION=1;
export const PERIODS=Object.freeze(['morning','afternoon','evening','night']);
export const TIERS=Object.freeze(['stranger','acquaintance','friend','close']);
export const MOOD_BANDS=Object.freeze(['miserable','low','okay','good','delighted']);
export const PLACES=Object.freeze(['counter','street','door','doorway','farm','office','cafe']);
export const WEATHERS=Object.freeze(['clear','cloudy','rain','storm','snow','fog']);
export const CAFE_STATES=Object.freeze(['none','employed','onShift']);
export const CONDITION_KEYS=Object.freeze(['period','hour','weather','place','met','tierMin','tierMax','mood','story','storyDone','gig','gigClient','hired','rankMin','cafe','beat','notBeat','seen','daysSince','recent']);
export const EFFECT_KEYS=Object.freeze(['meet','standing','mood','beat','topic','act']);
export const MAX_REPLIES=6,MAX_BUBBLES=3,MAX_BUBBLE_CHARS=160,MAX_LABEL_CHARS=60,LAST_CAP=6,SEEN_CAP=32,BEATS_CAP=16,RECENT_CAP=8,NEVER_DAYS=9999;
export const DERIVED_FLAGS=Object.freeze(['skipped','loaded','ownsShortbed','rented','carryingCafe']);
export const BYE_ID='bye',BYE_LABEL='See you';
// ---- helpers
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v,d='')=>typeof v==='string'?v:d;
const num=v=>typeof v==='number'&&Number.isFinite(v);
const int=(v,lo,hi,d=0)=>num(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const list=v=>Array.isArray(v)?v:v==null?[]:[v];
const safeKey=k=>typeof k==='string'&&k.length>0&&k.length<=60&&k!=='__proto__'&&k!=='constructor'&&k!=='prototype';
const uniq=a=>{const out=[];for(const x of a)if(!out.includes(x))out.push(x);return out};
const hash=(...a)=>{let h=2166136261;for(const ch of a.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0};
const wrapMin=m=>num(m)?((Math.floor(m)%1440)+1440)%1440:0;
export const hourOf=minute=>Math.floor(wrapMin(minute)/60);
export const periodOf=minute=>{const h=hourOf(minute);return h>=5&&h<12?'morning':h>=12&&h<18?'afternoon':h>=18&&h<22?'evening':'night'};
// A short base-36 hash of a line's text (whitespace collapsed): what the person's memory stores instead of the text.
export const lineKey=text=>hash('line',str(text).trim().replace(/\s+/g,' ')).toString(36);
const fail=msg=>{throw new Error('talk: '+msg)};
// ---- memory (progress.npcs[id].mem or progress.talk.people[id]; see notes/conversation-design.md 2f): {last:[lineKey] (6), seen:{nodeId:count} (32 keys), beats:[string] (16), lastMin:int (day*1440+minute of the last turn, -1 = never)}
export const freshMem=()=>({last:[],seen:{},beats:[],lastMin:-1});
export function cleanMem(raw){
 const r=isObj(raw)?raw:{},m=freshMem();
 if(Array.isArray(r.last))m.last=r.last.filter(k=>typeof k==='string'&&k.length>0&&k.length<=16).slice(-LAST_CAP);
 if(isObj(r.seen)){const e=[];for(const k of Object.keys(r.seen)){if(!safeKey(k))continue;const c=int(r.seen[k],0,1e6,0);if(c>0)e.push([k,c])}for(const [k,c] of e.slice(-SEEN_CAP))m.seen[k]=c}
 if(Array.isArray(r.beats))m.beats=uniq(r.beats.filter(safeKey)).slice(-BEATS_CAP);
 m.lastMin=int(r.lastMin,-1,1e12,-1);
 return m;
}
// ---- context: a flat, plain object every condition reads. talkContext builds it from the saved progress; baseContext fills the gaps (used by tests, the validator sweep and scripts/talk-check.mjs).
export function baseContext(patch){
 const r=isObj(patch)?patch:{},mem=cleanMem(r.mem),day=int(r.day,0,1e9,0),minute=wrapMin(r.minute),mood=int(r.mood,0,100,50);
 const tier=TIERS.includes(r.tier)?r.tier:'stranger';
 const hired={};if(isObj(r.hired))for(const k of Object.keys(r.hired)){if(safeKey(k)&&num(r.hired[k]))hired[k]=int(r.hired[k],1,99,1)}
 const beats=Array.isArray(r.beats)?uniq(r.beats.filter(safeKey)).slice(-BEATS_CAP):mem.beats;
 let seen=mem.seen;if(isObj(r.seen)){seen={};for(const k of Object.keys(r.seen)){if(safeKey(k)&&num(r.seen[k]))seen[k]=int(r.seen[k],0,1e6,0)}}
 const who=str(r.who),first=mem.seen[who+'.first']>0||(isObj(r.seen)&&seen[who+'.first']>0);
 const daysSince=num(r.daysSince)?int(r.daysSince,0,NEVER_DAYS,NEVER_DAYS):mem.lastMin<0?NEVER_DAYS:Math.max(0,day-Math.floor(mem.lastMin/1440));
 return {who,day,minute,hour:Math.floor(minute/60),period:periodOf(minute),weather:WEATHERS.includes(r.weather)?r.weather:'clear',place:PLACES.includes(r.place)?r.place:'street',seed:num(r.seed)?Math.floor(r.seed):0,
  recent:Array.isArray(r.recent)?r.recent.filter(x=>typeof x==='string'&&x.length>0&&x.length<=40).slice(-RECENT_CAP):[],
  tier,tierRank:TIERS.indexOf(tier),met:r.met===true||first,mood,moodBand:MOOD_BANDS.includes(r.moodBand)?r.moodBand:moodWord(mood),
  story:int(r.story,0,99,0),storyDone:r.storyDone===true,gig:str(r.gig),gigClient:str(r.gigClient),hired,rank:Object.values(hired).reduce((a,b)=>Math.max(a,b),0),
  cafe:CAFE_STATES.includes(r.cafe)?r.cafe:'none',beats,seen,daysSince,mem};
}
// env = {day, minute, weather, place, seed, recent:[event strings]}; the caller passes the CURRENT time on every turn. Never throws: junk gives a stranger context.
export function talkContext(progress,who,env){
 try{
  const p=isObj(progress)?progress:{},e=isObj(env)?env:{},id=safeKey(who)?who:'';
  const npc=isObj(p.npcs)&&isObj(p.npcs[id])?p.npcs[id]:null,tp=isObj(p.talk)&&isObj(p.talk.people)&&isObj(p.talk.people[id])?p.talk.people[id]:null;
  let memRaw=null;if(isObj(e.mem))memRaw=e.mem;else if(npc&&isObj(npc.mem))memRaw=npc.mem;else if(tp)memRaw={last:tp.last,seen:tp.seen,beats:tp.beats,lastMin:num(tp.lastMin)?tp.lastMin:num(tp.lastDay)&&tp.lastDay>=0?tp.lastDay*1440:-1};
  const metDay=npc&&num(npc.metDay)?npc.metDay:tp&&num(tp.metDay)?tp.metDay:-1;
  let tier='stranger';try{if(isObj(p.standing)&&id)tier=tierFor(p.standing,id)}catch(_){}
  const st=isObj(p.starter)?p.starter:{},gig=isObj(p.gigs)&&isObj(p.gigs.active)?p.gigs.active:{};
  const hired={};if(isObj(p.careers))for(const k of Object.keys(p.careers)){const c=p.careers[k];if(safeKey(k)&&isObj(c)&&c.hired===true)hired[k]=num(c.rank)?c.rank:1}
  // derived beats: env.flags (an object {skipped:true,...} or a list of names) become the beats 'is.skipped' etc. They are computed fresh each turn by the caller and never saved (remember() keeps only session beats).
  const fl=[];if(Array.isArray(e.flags)){for(const f of e.flags)if(typeof f==='string')fl.push(f.replace(/^is\./,''))}else if(isObj(e.flags)){for(const k of Object.keys(e.flags))if(e.flags[k]===true)fl.push(k)}
  const derived=uniq(fl.filter(f=>DERIVED_FLAGS.includes(f)).map(f=>'is.'+f));
  const mb=cleanMem(memRaw).beats.filter(b=>!derived.includes(b));
  const beats=[...mb.slice(Math.max(0,mb.length-(BEATS_CAP-derived.length))),...derived];
  return baseContext({who:id,day:e.day,minute:e.minute,weather:e.weather,place:e.place,seed:e.seed,recent:e.recent,mem:memRaw,beats,met:metDay>=0,tier,mood:npc&&num(npc.mood)?npc.mood:50,
   story:st.step,storyDone:st.done===true||st.skipped===true,gig:str(gig.type),gigClient:str(gig.client),hired,cafe:hired.diner?(isObj(p.shift)&&p.shift.employer==='diner'?'onShift':'employed'):'none'}); // diner D-A2: the cafe state comes from the career: none (not hired), employed, onShift
 }catch(_){return baseContext({})}
}
// ---- conditions (the closed list the validator checks). A missing or empty cond always holds; an unknown key or a wrong-shaped value never holds.
const inList=(v,x)=>list(v).includes(x);
const seenCount=(c,node)=>int(c.seen&&c.seen[node],0,1e6,0);
const COND={
 period:(v,c)=>inList(v,c.period),
 hour:(v,c)=>{if(!Array.isArray(v)||!num(v[0])||!num(v[1]))return false;return v[0]<=v[1]?c.hour>=v[0]&&c.hour<v[1]:c.hour>=v[0]||c.hour<v[1]},
 weather:(v,c)=>inList(v,c.weather),
 place:(v,c)=>inList(v,c.place),
 met:(v,c)=>typeof v==='boolean'&&c.met===v,
 tierMin:(v,c)=>TIERS.includes(v)&&c.tierRank>=TIERS.indexOf(v),
 tierMax:(v,c)=>TIERS.includes(v)&&c.tierRank<=TIERS.indexOf(v),
 mood:(v,c)=>inList(v,c.moodBand),
 story:(v,c)=>Array.isArray(v)&&num(v[0])&&c.story>=v[0]&&(!num(v[1])||c.story<=v[1]),
 storyDone:(v,c)=>typeof v==='boolean'&&c.storyDone===v,
 gig:(v,c)=>v===true?!!c.gig:v===false?!c.gig:inList(v,c.gig),
 gigClient:(v,c)=>inList(v,c.gigClient),
 hired:(v,c)=>v===true?c.rank>0:v===false?c.rank===0:list(v).some(id=>c.hired&&c.hired[id]!==undefined),
 rankMin:(v,c,cond)=>{if(!num(v))return false;const ids=typeof cond.hired==='string'||Array.isArray(cond.hired)?list(cond.hired):null,r=ids?Math.max(0,...ids.map(id=>c.hired&&c.hired[id]||0)):c.rank;return r>=v},
 cafe:(v,c)=>list(v).some(x=>x==='employed'?c.cafe!=='none':x===c.cafe),
 beat:(v,c)=>list(v).every(b=>c.beats.includes(b)),
 notBeat:(v,c)=>list(v).every(b=>!c.beats.includes(b)),
 seen:(v,c)=>list(v).every(o=>{if(!isObj(o)||typeof o.node!=='string')return false;const n=seenCount(c,o.node),min=num(o.min)?o.min:num(o.max)?0:1;return n>=min&&(!num(o.max)||n<=o.max)}),
 daysSince:(v,c)=>{const lo=Array.isArray(v)?v[0]:isObj(v)?v.min:undefined,hi=Array.isArray(v)?v[1]:isObj(v)?v.max:undefined;if(!(num(lo)||num(hi)))return false;return (!num(lo)||c.daysSince>=lo)&&(!num(hi)||c.daysSince<=hi)},
 recent:(v,c)=>list(v).some(x=>c.recent.includes(x)),
};
export function matches(cond,ctx){
 if(cond==null)return true;if(!isObj(cond))return false;
 const c=isObj(ctx)?ctx:baseContext({});
 for(const k of Object.keys(cond)){const f=Object.prototype.hasOwnProperty.call(COND,k)?COND[k]:null;if(!f||!f(cond[k],c,cond))return false}
 return true;
}
// How specific a condition is: its number of keys (more keys beat fewer).
export const specificity=cond=>isObj(cond)?Object.keys(cond).length:0;
// ---- text and effects
export const expand=(text,facts)=>str(text).replace(/\{(\w+)\}/g,(m,k)=>isObj(facts)&&Object.prototype.hasOwnProperty.call(facts,k)&&(typeof facts[k]==='string'||num(facts[k]))?String(facts[k]):m);
// The 1 to 3 bubbles of a variant (empty bubbles dropped).
export const bubblesOf=(variant,facts)=>isObj(variant)?list(variant.t).filter(t=>typeof t==='string'&&t.trim()).slice(0,MAX_BUBBLES).map(t=>expand(t.trim(),facts)):[];
// effects data: [{kind:'meet'|'standing'|'mood'|'beat'|'topic'|'act', amount?, id?, at:nodeId}]. The engine never applies them: game.js does.
export function effectsOf(spec,at=''){
 const out=[];
 for(const o of list(spec)){
  if(!isObj(o))continue;
  if(o.meet===true)out.push({kind:'meet',at});
  if(num(o.standing)&&o.standing!==0)out.push({kind:'standing',amount:int(o.standing,-50,50,0),at});
  if(num(o.mood)&&o.mood!==0)out.push({kind:'mood',amount:int(o.mood,-100,100,0),at});
  if(safeKey(o.beat))out.push({kind:'beat',id:o.beat,at});
  if(safeKey(o.topic))out.push({kind:'topic',id:o.topic,at});
  if(safeKey(o.act))out.push({kind:'act',id:o.act,at});
 }
 return out;
}
// ---- cast access
export function indexNodes(cast){
 const m=new Map();if(!isObj(cast)||!Array.isArray(cast.nodes))return m;
 for(const n of cast.nodes)if(isObj(n)&&typeof n.id==='string'&&n.id&&!m.has(n.id))m.set(n.id,n);
 return m;
}
export const entryNodes=cast=>{const m=indexNodes(cast),out=[];for(const n of m.values())if(n.entry===true)out.push(n);return out};
// ---- sessions: plain JSON data {v,who,node,turn,keys,nodes,beats,met,metNow,day,minute,ended}
const isSession=s=>isObj(s)&&s.v===TALK_VERSION&&typeof s.who==='string'&&typeof s.node==='string'&&Array.isArray(s.keys)&&Array.isArray(s.nodes)&&Array.isArray(s.beats);
const copySession=s=>({v:TALK_VERSION,who:s.who,node:s.node,turn:int(s.turn,0,1e6,0),keys:s.keys.filter(k=>typeof k==='string').slice(-64),nodes:s.nodes.filter(k=>typeof k==='string').slice(-64),beats:s.beats.filter(safeKey).slice(-64),met:s.met===true,metNow:s.metNow===true,day:int(s.day,0,1e9,0),minute:wrapMin(s.minute),ended:s.ended===true});
// What conditions see during a turn: the context plus this session's beats, visits and "met".
function viewOf(ctx,s,mem){
 const seen={...ctx.seen,...mem.seen};for(const n of s.nodes)seen[n]=(seen[n]||0)+1;
 return {...ctx,met:ctx.met||s.met,beats:uniq([...ctx.beats,...mem.beats,...s.beats]),seen};
}
// Pick ONE variant: matching, not said recently (memory + this session), then highest score (w, else specificity), then by hash. If everything was said recently, the least recent wins.
function pickVariant(variants,view,order,who,nodeId,turn,facts){
 const cands=[];
 list(variants).forEach((v,i)=>{
  if(!isObj(v)||!matches(v.if,view))return;
  const bubbles=bubblesOf(v,facts);if(!bubbles.length)return;
  cands.push({i,v,bubbles,key:lineKey(bubbles.join(' ')),score:num(v.w)?v.w:specificity(v.if)});
 });
 if(!cands.length)return null;
 const seed=[view.seed,who,nodeId,view.day,view.seen[nodeId]||0,turn];
 const fresh=cands.filter(c=>!order.includes(c.key));
 if(!fresh.length){let best=null,bi=Infinity;for(const c of cands){const at=order.lastIndexOf(c.key);if(at<bi||(at===bi&&hash(...seed,c.i)<hash(...seed,best.i))){bi=at;best=c}}return best}
 const top=Math.max(...fresh.map(c=>c.score)),tops=fresh.filter(c=>c.score===top);
 return tops[hash(...seed)%tops.length];
}
// Visible replies of a node for this turn (conditions, and the target's `when`); ids are authored or r1, r2...
function repliesOf(map,node,view,s,mem,strict,problems){
 const out=[];
 if(!node||node.end===true)return out;
 const used=new Set([BYE_ID]);
 list(node.replies).forEach((r,i)=>{
  if(!isObj(r)||typeof r.label!=='string'||!r.label.trim())return;
  if(out.length>=MAX_REPLIES)return;
  let id=safeKey(r.id)&&r.id!==BYE_ID?r.id:'r'+(i+1);while(used.has(id))id+='~';used.add(id);
  if(!matches(r.if,view))return;
  if(typeof r.go==='string'){
   const t=map.get(r.go);
   if(!t){if(strict)fail(`reply "${r.label}" in node "${node.id}" goes to unknown node "${r.go}"`);problems.push(`reply "${r.label}" in node "${node.id}" goes to unknown node "${r.go}"`);if(typeof r.act!=='string')return}
   else if(!matches(t.when,view))return;
  }
  const to=typeof r.go==='string'?r.go:'';
  out.push({id,label:r.label.trim(),asked:!!to&&(s.nodes.includes(to)||((mem.seen[to]||0)>0&&view.daysSince===0)),raw:r});
 });
 return out;
}
// Say the node: pick its variant, collect effects. Returns null when no variant fits (strict throws).
function sayNode(cast,map,nodeId,s,view,mem,strict,problems){
 const node=map.get(nodeId);
 if(!node){if(strict)fail(`unknown node "${nodeId}"`);problems.push(`unknown node "${nodeId}"`);return null}
 const order=[...mem.last,...s.keys],pick=pickVariant(node.say,view,order,s.who,nodeId,s.turn,cast.facts);
 if(!pick){if(strict)fail(`node "${nodeId}" has no variant that fits (period ${view.period}, tier ${view.tier}, mood ${view.moodBand}, story ${view.story}, place ${view.place})`);problems.push(`node "${nodeId}" had nothing to say`);return null}
 return {node,pick,lines:pick.bubbles.map(text=>({who:s.who,text})),effects:[...effectsOf(node.do,nodeId),...effectsOf(pick.v.do,nodeId)]};
}
// Apply a said node to a session copy (beats, met, keys, visits) and build the result.
function present(cast,map,said,s,ctx,mem,strict,problems,echo,pre){
 s.node=said.node.id;s.keys=[...s.keys,said.pick.key].slice(-64);s.nodes=[...s.nodes,said.node.id].slice(-64);
 const effects=[...pre,...said.effects];
 for(const e of effects){if(e.kind==='beat'&&!s.beats.includes(e.id))s.beats.push(e.id);if(e.kind==='meet'){s.met=true;s.metNow=true}}
 s.ended=said.node.end===true;
 const view=viewOf(ctx,s,mem),replies=s.ended?[]:repliesOf(map,said.node,view,s,mem,strict,problems);
 const out=replies.map(r=>({id:r.id,label:r.label,asked:r.asked}));
 if(!s.ended)out.push({id:BYE_ID,label:BYE_LABEL,asked:false});
 return {session:s,lines:said.lines,replies:out,effects,ended:s.ended,echo,problems};
}
const dead=(s,problems)=>({session:s,lines:[],replies:[],effects:[],ended:true,echo:null,problems});
const optsOf=o=>({strict:isObj(o)&&o.strict===true});
const memFor=(ctx,mem)=>cleanMem(mem===undefined||mem===null?ctx.mem:mem);
// ---- the public turn functions
// Opens a talk: picks the best entry node (entry:true, its `when` holds; most specific first, then by hash), and says one variant of it.
export function openConversation(cast,who,ctx,mem,opts){
 const o=optsOf(opts),problems=[],id=safeKey(who)?who:str(isObj(ctx)?ctx.who:'');
 try{
  const c=baseContext({...(isObj(ctx)?ctx:{}),who:id}),m=memFor(c,mem);
  const s={v:TALK_VERSION,who:id,node:'',turn:0,keys:[],nodes:[],beats:[],met:c.met,metNow:false,day:c.day,minute:c.minute,ended:false};
  if(!isObj(cast)||!Array.isArray(cast.nodes)){if(o.strict)fail('cast has no nodes array');s.ended=true;return dead(s,['cast has no nodes array'])}
  const map=indexNodes(cast),view=viewOf(c,s,m);
  const entries=entryNodes(cast).filter(n=>matches(n.when,view)).map(n=>({n,score:num(n.w)?n.w:specificity(n.when),h:hash(c.seed,id,n.id,c.day,view.seen[n.id]||0)}));
  entries.sort((a,b)=>b.score-a.score||a.h-b.h);
  if(!entries.length){if(o.strict)fail(`no entry node fits (place ${c.place}, period ${c.period}, tier ${c.tier}, story ${c.story}); mark a node entry:true with no "when"`);s.ended=true;return dead(s,['no entry node fits'])}
  for(const e of entries){
   const said=sayNode(cast,map,e.n.id,{...s},view,m,false,[]);
   if(said)return present(cast,map,said,s,c,m,o.strict,problems,null,[]);
  }
  if(o.strict)fail(`entry nodes ${entries.map(e=>'"'+e.n.id+'"').join(', ')} fit but none has a variant for this context (period ${c.period}, tier ${c.tier}, mood ${c.moodBand}, story ${c.story})`);
  s.ended=true;return dead(s,['no entry node had a variant that fits']);
 }catch(e){if(o.strict)throw e;return dead({v:TALK_VERSION,who:id,node:'',turn:0,keys:[],nodes:[],beats:[],met:false,metNow:false,day:0,minute:0,ended:true},[String(e&&e.message||e)])}
}
// One player reply. ctx is built NOW (the current day and minute), so the next line can use a later period than the first. replyId is an id from the last `replies` (BYE_ID leaves).
export function chooseReply(session,cast,replyId,ctx,mem,opts){
 const o=optsOf(opts),problems=[];
 if(!isSession(session))return dead({v:TALK_VERSION,who:'',node:'',turn:0,keys:[],nodes:[],beats:[],met:false,metNow:false,day:0,minute:0,ended:true},['not a talk session']);
 let s=copySession(session);
 try{
  if(s.ended)return dead(s,['the talk already ended']);
  const c=baseContext({...(isObj(ctx)?ctx:{}),who:s.who}),m=memFor(c,mem);
  s.day=c.day;s.minute=c.minute;
  const map=indexNodes(cast),node=map.get(s.node);
  if(!node){if(o.strict)fail(`session is at unknown node "${s.node}"`);s.ended=true;return dead(s,[`session is at unknown node "${s.node}"`])}
  const view=viewOf(c,s,m),replies=repliesOf(map,node,view,s,m,o.strict,problems);
  s.turn+=1;
  if(replyId===BYE_ID&&node.end!==true){
   const echo={who:'you',text:BYE_LABEL},pick=isObj(cast)?pickVariant(cast.bye,view,[...m.last,...s.keys],s.who,'bye',s.turn,cast.facts):null;
   s.ended=true;if(pick)s.keys=[...s.keys,pick.key].slice(-64);
   return {session:s,lines:pick?pick.bubbles.map(text=>({who:s.who,text})):[],replies:[],effects:pick?effectsOf(pick.v.do,'bye'):[],ended:true,echo,problems};
  }
  const r=replies.find(x=>x.id===replyId);
  if(!r){problems.push(`reply "${str(replyId)}" is not offered now`);const out=replies.map(x=>({id:x.id,label:x.label,asked:x.asked}));if(node.end!==true)out.push({id:BYE_ID,label:BYE_LABEL,asked:false});s.turn-=1;return {session:s,lines:[],replies:out,effects:[],ended:s.ended,echo:null,problems}}
  const raw=r.raw,pre=[...effectsOf(raw.do,node.id),...(typeof raw.act==='string'?effectsOf({act:raw.act},node.id):[])],echo={who:'you',text:r.label};
  for(const e of pre){if(e.kind==='beat'&&!s.beats.includes(e.id))s.beats.push(e.id);if(e.kind==='meet'){s.met=true;s.metNow=true}}
  if(typeof raw.go!=='string'||!map.has(raw.go)){s.ended=true;return {session:s,lines:[],replies:[],effects:pre,ended:true,echo,problems}}
  const view2=viewOf(c,s,m),said=sayNode(cast,map,raw.go,s,view2,m,o.strict,problems);
  if(!said){s.ended=true;return {session:s,lines:[],replies:[],effects:pre,ended:true,echo,problems}}
  return present(cast,map,said,s,c,m,o.strict,problems,echo,pre);
 }catch(e){if(o.strict)throw e;s.ended=true;return dead(s,[String(e&&e.message||e)])}
}
// Returns the NEW memory after a talk: said line keys (newest 6), visited nodes counted, beats set, "who.first" when they met, lastMin. Call it ONCE when the talk ends (also when the player walks away).
export function remember(mem,session){
 const m=cleanMem(mem);
 if(!isSession(session))return m;
 const s=copySession(session);
 const last=[...m.last.filter(k=>!s.keys.includes(k)),...uniq([...s.keys].reverse()).reverse()].slice(-LAST_CAP);
 const entries=Object.entries(m.seen);
 const bump=k=>{const i=entries.findIndex(e=>e[0]===k);let c=0;if(i>=0)c=entries.splice(i,1)[0][1];entries.push([k,c+1])};
 for(const n of s.nodes)bump(n);
 if(s.metNow)bump(s.who+'.first');
 const seen={};for(const [k,c] of entries.slice(-SEEN_CAP))seen[k]=c;
 const beats=uniq([...m.beats.filter(b=>!s.beats.includes(b)),...s.beats]).slice(-BEATS_CAP);
 return {last,seen,beats,lastMin:s.day*1440+s.minute};
}
