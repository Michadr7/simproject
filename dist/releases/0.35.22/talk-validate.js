// Talk validator (notes/conversation-design.md stage C2): checks a cast and lists problems that say which person, node and line, what is wrong and how to fix it.
// Pure: no DOM, no clock, no chance; never throws (a cast that is not even an object gives one 'bad-shape' problem). The engine's own matcher is used for the coverage sweep, so a pass here means the engine always has a line to say.
//
// validateCast(cast, opts): opts = {acts:[act names the game accepts, default DEFAULT_ACTS], others:[other casts, for the "same line in two casts" rule], ids:[raw ids that must never appear in text], places:[extra places for the coverage sweep], sweepLimit}.
// validateCasts(castsArrayOrObject, opts) checks every cast against all the others. The coverage sweep (rule 11) tries every hour, tier, mood, story step, place, gig, rank, cafe state, beat and recent event the cast's conditions mention.
// HOW TO READ A PROBLEM: {rule (1-11, 0 = shape/voice extras), code, level:'error'|'warn', who, node, where, text?, message, fix}.
// message = "<Person> / <node> / <where>: <what is wrong>. Fix: <how to fix it>." Fix the cast text and run again until the list is empty.
//
// WRITER RULES (what the checks enforce):
//  1. One variant is one complete utterance: 1 to 3 bubbles, each a whole sentence or more ending in . ! ? or an ellipsis, never a fragment to be glued.
//  2. A bubble is 160 characters or less; a reply label is 60 or less and at most 6 replies per node.
//  3. Time words (morning, afternoon, evening, tonight, night, lunch ...) only inside a variant whose `if`/`when` limits the period (or hour) to a matching time of day.
//  4. Every node ends in replies (each reply has go, act or end:true) or end:true; every `go` names a node of this cast; every node can be reached from an entry node.
//  5. Only the listed condition keys and effect keys; `act` names must be in the game's act list.
//  6. No two bubbles share a text, in this cast or any other cast. Write facts ("a sawyer at the Ridgeline mill"), never ids (ridgeline-sawyer), and no {slot} without a fact.
//  7. Every node must have a variant for every situation it can be reached in: end each node's `say` list with one variant that has no `if`.
import {CONDITION_KEYS,EFFECT_KEYS,PERIODS,TIERS,MOOD_BANDS,PLACES,WEATHERS,CAFE_STATES,MAX_REPLIES,MAX_BUBBLES,MAX_BUBBLE_CHARS,MAX_LABEL_CHARS,matches,baseContext,bubblesOf,indexNodes,periodOf} from './talk-engine.js';
export const DEFAULT_ACTS=Object.freeze(['openStore','gigBoard','shelves','hal.groceries','hal.buy','walt.hire','walt.promote','walt.collect','cafe.hire','cafe.clockin','cafe.clockout','cafe.promote','cafe.meal','job.pickup','job.deliver','skipStory']);
export const SWEEP_LIMIT=4000; // contexts tried per node by the coverage sweep (rule 11)
const R=(rule,level)=>Object.freeze({rule,level});
export const RULES=Object.freeze({
 'unknown-condition':R(1,'error'),'bad-condition-value':R(1,'error'),'unknown-effect':R(1,'error'),'unknown-act':R(1,'error'),
 'unreachable-node':R(2,'error'),'dead-end':R(3,'error'),'missing-go':R(4,'error'),'too-many-replies':R(5,'error'),'duplicate-label':R(6,'error'),'repeated-text':R(7,'error'),
 'wrong-time-word':R(8,'error'),'glue-suspect':R(9,'error'),'line-too-long':R(10,'error'),'placeholder-text':R(10,'error'),'uncovered-node':R(11,'error'),
 'bad-shape':R(0,'error'),'duplicate-node-id':R(0,'error'),'no-entry':R(0,'error'),'crowd-facts':R(0,'error'),'missing-voice':R(0,'warn'),'voice-avoid':R(0,'warn'),'voice-sentence-long':R(0,'warn'),
});
// Time words and the periods each one is allowed in. Phrases that do not name the present ("tomorrow morning", "last night", "in the morning") are ignored.
export const TIME_WORDS=Object.freeze([
 ['this morning',['morning','afternoon']],['this afternoon',['afternoon','evening']],['this evening',['evening','night']],['tonight',['evening','night']],
 ['good morning',['morning']],['good afternoon',['afternoon']],['good evening',['evening','night']],['good night',['evening','night']],
 ['morning',['morning']],['afternoon',['afternoon']],['evening',['evening']],['midnight',['night']],['night',['evening','night']],
 ['breakfast',['morning']],['sunrise',['morning']],['dawn',['morning']],['lunch',['morning','afternoon']],['lunchtime',['morning','afternoon']],['sunset',['evening']],['dusk',['evening']],['supper',['evening']],['dinner',['evening']],
].map(([w,p])=>Object.freeze([w,Object.freeze(p)])));
const NEUTRAL=/\b(tomorrow|yesterday|last|next|every|each|all|in the|of the|during the|one|that|some|any|most|other)\s+(morning|afternoon|evening|night)s?\b/gi;
const OPENER=/^(hi|hey|hello|howdy|morning|afternoon|evening|good (morning|afternoon|evening|day))\b/i;
// ---- helpers
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v,d='')=>typeof v==='string'?v:d;
const num=v=>typeof v==='number'&&Number.isFinite(v);
const list=v=>Array.isArray(v)?v:v==null?[]:[v];
const norm=t=>str(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();
const sentences=t=>str(t).split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
const quote=t=>'"'+(t.length>70?t.slice(0,67)+'...':t)+'"';
const names=a=>a.map(x=>'"'+x+'"').join(', ');
// ---- condition and effect shape checks: each returns '' when fine, or what is wrong
const oneOf=(v,set,label)=>list(v).length>0&&list(v).every(x=>set.includes(x))?'':`${label} must be ${set.length>8?'one of the known values':'one or a list of '+set.join(', ')}, got ${JSON.stringify(v)}`;
const strings=(v,label)=>list(v).length>0&&list(v).every(x=>typeof x==='string'&&x.length>0)?'':`${label} must be a name or a list of names, got ${JSON.stringify(v)}`;
const CHECK={
 period:v=>oneOf(v,PERIODS,'period'),weather:v=>oneOf(v,WEATHERS,'weather'),place:v=>oneOf(v,PLACES,'place'),mood:v=>oneOf(v,MOOD_BANDS,'mood'),cafe:v=>oneOf(v,CAFE_STATES,'cafe'),
 tierMin:v=>TIERS.includes(v)?'':`tierMin must be one of ${TIERS.join(', ')}, got ${JSON.stringify(v)}`,tierMax:v=>TIERS.includes(v)?'':`tierMax must be one of ${TIERS.join(', ')}, got ${JSON.stringify(v)}`,
 hour:v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isInteger(n)&&n>=0&&n<=24)&&v[0]!==v[1]?'':`hour must be [from,to) with two different whole hours 0-24, got ${JSON.stringify(v)}`,
 met:v=>typeof v==='boolean'?'':`met must be true or false, got ${JSON.stringify(v)}`,storyDone:v=>typeof v==='boolean'?'':`storyDone must be true or false, got ${JSON.stringify(v)}`,
 story:v=>Array.isArray(v)&&v.length>=1&&v.length<=2&&v.every(n=>Number.isInteger(n)&&n>=0)&&(v.length<2||v[0]<=v[1])?'':`story must be [fromStep,toStep] of whole numbers, got ${JSON.stringify(v)}`,
 gig:v=>typeof v==='boolean'?'':strings(v,'gig'),gigClient:v=>strings(v,'gigClient'),hired:v=>typeof v==='boolean'?'':strings(v,'hired'),
 rankMin:v=>Number.isInteger(v)&&v>=1&&v<=99?'':`rankMin must be a whole number 1-99, got ${JSON.stringify(v)}`,
 beat:v=>strings(v,'beat'),notBeat:v=>strings(v,'notBeat'),recent:v=>strings(v,'recent'),
 seen:v=>list(v).length>0&&list(v).every(o=>isObj(o)&&typeof o.node==='string'&&o.node&&(o.min===undefined||num(o.min))&&(o.max===undefined||num(o.max)))?'':`seen must be {node:'id',min?:n,max?:n} (or a list of those), got ${JSON.stringify(v)}`,
 daysSince:v=>{const lo=Array.isArray(v)?v[0]:isObj(v)?v.min:undefined,hi=Array.isArray(v)?v[1]:isObj(v)?v.max:undefined;return (num(lo)||num(hi))&&(lo===undefined||num(lo))&&(hi===undefined||num(hi))?'':`daysSince must be {min?,max?} or [min,max] with numbers, got ${JSON.stringify(v)}`},
};
const plainId=v=>typeof v==='string'&&v.length>0&&v.length<=60&&!/\s/.test(v);
const EFFECT_CHECK={meet:v=>v===true?'':'meet must be true',standing:v=>num(v)&&Math.abs(v)<=50?'':'standing must be a number from -50 to 50',mood:v=>num(v)&&Math.abs(v)<=100?'':'mood must be a number from -100 to 100',beat:v=>plainId(v)?'':'beat must be a name without spaces',topic:v=>plainId(v)?'':'topic must be a name without spaces',act:v=>plainId(v)?'':'act must be a name without spaces'};
// ---- time of day a variant can be said in: its own `if` AND the node's `when`, as a set of periods
const hoursOf=cond=>{const h=cond&&cond.hour;if(!Array.isArray(h)||h.length!==2||!num(h[0])||!num(h[1]))return null;const out=new Set();for(let x=0;x<24;x++){const f=h[0],t=h[1];if(f<=t?x>=f&&x<t:x>=f||x<t)out.add(x)}return out};
function periodsOf(cond){
 let set=new Set(PERIODS);
 if(isObj(cond)&&cond.period!==undefined){const p=list(cond.period).filter(x=>PERIODS.includes(x));set=new Set(p)}
 const hrs=hoursOf(cond);
 if(hrs){const fromHours=new Set();for(const h of hrs)fromHours.add(periodOf(h*60));set=new Set([...set].filter(p=>fromHours.has(p)))}
 return set;
}
const intersect=(a,b)=>new Set([...a].filter(x=>b.has(x)));
// Time words found in a text: [[word, allowedPeriods]]
export function timeWordsIn(text){
 let s=' '+str(text).replace(NEUTRAL,' ')+' ',found=[];
 for(const [w,ok] of TIME_WORDS){const re=new RegExp('\\b'+w+'\\b','i');if(re.test(s)){found.push([w,ok]);s=s.replace(new RegExp('\\b'+w+'\\b','gi'),' ')}}
 return found;
}
// ---- the validator
export function validateCast(cast,opts){
 const out=[];
 try{run(cast,isObj(opts)?opts:{},out)}catch(e){out.push(mk('bad-shape',cast,'','the cast',`the validator could not read this cast (${String(e&&e.message||e).slice(0,80)})`,'make sure the cast is {id,name,voice,facts,nodes:[...]} with plain objects and arrays',''))}
 return out;
}
// Several casts at once: each one is also checked against the others for repeated lines.
export function validateCasts(casts,opts){
 const all=Array.isArray(casts)?casts:isObj(casts)?Object.values(casts):[],o=isObj(opts)?opts:{},out=[];
 for(const c of all)out.push(...validateCast(c,{...o,others:all.filter(x=>x!==c)}));
 return out;
}
export const formatProblem=p=>isObj(p)?str(p.message):'';
export const formatProblems=ps=>list(ps).map((p,i)=>`${i+1}. [${str(p.level)} ${str(p.code)}] ${formatProblem(p)}`).join('\n');
function mk(code,cast,node,where,what,fix,text){
 const who=isObj(cast)?str(cast.name)||str(cast.id)||'(unnamed cast)':'(not a cast)',r=RULES[code]||R(0,'error');
 return {rule:r.rule,code,level:r.level,who,node:node||'',where,text:text||'',message:`${who} / ${node?'node '+node+' / ':''}${where}: ${what}. Fix: ${fix}.`,fix};
}
function run(cast,o,out){
 const P=(code,node,where,what,fix,text)=>out.push(mk(code,cast,node,where,what,fix,text));
 if(!isObj(cast)){P('bad-shape','','the cast','this is not a cast object','pass an object like {id,name,voice,facts,nodes:[...]}');return}
 const acts=new Set(o.acts?list(o.acts):DEFAULT_ACTS),others=list(o.others).filter(isObj);
 if(!str(cast.id).trim())P('bad-shape','','cast.id','the cast has no id','give it a lower-case id such as "noah"');
 if(!str(cast.voice).trim())P('missing-voice','','cast.voice','the cast has no voice line','add voice:"one line for writers" such as "chatty, tidy, counts things out loud"');
 if(!Array.isArray(cast.nodes)||!cast.nodes.length){P('bad-shape','','cast.nodes','the cast has no nodes','add a nodes array with at least one node that has entry:true');return}
 if(cast.kind==='crowd'){const f=isObj(cast.facts)?cast.facts:{};for(const k of ['job','home','hint'])if(typeof f[k]!=='string'||!f[k].trim())P('crowd-facts','','facts.'+k,`a crowd person needs a facts.${k} sentence`,`add facts:{${k}:'a whole phrase'} to this person`)}
 // ---- shape, ids
 const nodes=[],seenIds=new Set();
 cast.nodes.forEach((n,i)=>{
  if(!isObj(n)||typeof n.id!=='string'||!n.id.trim()){P('bad-shape','','nodes['+i+']','node number '+(i+1)+' has no id','give every node an id string such as "noah.work"');return}
  if(seenIds.has(n.id)){P('duplicate-node-id',n.id,'node id','two nodes share the id "'+n.id+'"','rename one of them (ids must be unique inside a cast)');return}
  seenIds.add(n.id);nodes.push(n);
 });
 const map=indexNodes(cast),facts=cast.facts;
 const knownIds=new Set(list(o.ids).filter(x=>typeof x==='string'));
 for(const id of [cast.id,...seenIds])if(typeof id==='string')knownIds.add(id);for(const a of acts)knownIds.add(a);
 const idLike=new Set([...knownIds].filter(x=>x.length>=4&&/[-_.]|[a-z][A-Z]/.test(x)));
 // ---- conditions and effects
 const checkCond=(cond,node,where)=>{
  if(cond===undefined||cond===null)return;
  if(!isObj(cond)){P('bad-condition-value',node,where,'the condition is not an object','write it like {period:"morning",tierMin:"friend"}');return}
  for(const k of Object.keys(cond)){
   if(!CONDITION_KEYS.includes(k)){P('unknown-condition',node,where,`condition key "${k}" does not exist`,`use only: ${CONDITION_KEYS.join(', ')}`);continue}
   const bad=CHECK[k](cond[k]);if(bad)P('bad-condition-value',node,where,bad,`rewrite the "${k}" value in the allowed form`);
  }
 };
 const checkEffects=(spec,node,where)=>{
  if(spec===undefined||spec===null)return;
  for(const e of list(spec)){
   if(!isObj(e)){P('unknown-effect',node,where,'an effect is not an object','write do:{standing:1} or do:[{beat:"x"},{mood:2}]');continue}
   for(const k of Object.keys(e)){
    if(!EFFECT_KEYS.includes(k)){P('unknown-effect',node,where,`effect key "${k}" does not exist`,`use only: ${EFFECT_KEYS.join(', ')}`);continue}
    const bad=EFFECT_CHECK[k](e[k]);if(bad)P('unknown-effect',node,where,bad,`rewrite the "${k}" effect`);
    if(k==='act'&&plainId(e[k])&&!acts.has(e[k]))P('unknown-act',node,where,`act "${e[k]}" is not a known game action`,`use one of: ${[...acts].join(', ')}`);
   }
  }
 };
 // ---- text checks
 const bubbleTexts=[];                       // {text,node,where,periods}
 const checkBubble=(text,node,where,periods,cond)=>{
  const n=norm(text);if(n)bubbleTexts.push({n,node,where,text});
  if(text.length>MAX_BUBBLE_CHARS)P('line-too-long',node,where,`the bubble is ${text.length} characters (limit ${MAX_BUBBLE_CHARS})`,'split it into two bubbles of one variant or cut it down',text);
  const hits=[];
  const LEFT=/\bundefined\b|\bnull\b|\bNaN\b|\[object|[{}<>]|\$\{|\bTODO\b|\bFIXME\b|lorem ipsum|\bxxx\b/i,probe=text.replace(/\{\w+\}/g,' '); // unresolved {slots} get their own, clearer message below
  if(LEFT.test(probe))hits.push('a placeholder or leftover code ('+probe.match(LEFT)[0]+')');
  for(const id of idLike)if(text.includes(id))hits.push('the raw id "'+id+'"');
  if(/\b[a-z]{2,}\.[a-z]{2,}\b/.test(text)&&!hits.length)hits.push('something that looks like an id or a missing space after a full stop ('+(text.match(/\b[a-z]{2,}\.[a-z]{2,}\b/)[0])+')');
  for(const h of hits)P('placeholder-text',node,where,'the text contains '+h,'write a real sentence from the facts ("a sawyer at the Ridgeline mill"), not ids or slots',text);
  const trimmed=text.trim();
  if(/^[a-z]/.test(trimmed))P('glue-suspect',node,where,'the bubble starts with a lower-case letter, so it looks like the end of a sentence glued onto another','start the bubble with a capital letter and make it a complete utterance',text);
  else if(!/[.!?\u2026]["')\u201d\u2019]*$/.test(trimmed))P('glue-suspect',node,where,'the bubble does not end with . ! ? or an ellipsis, so it looks like a fragment','finish the sentence and end it with . ! or ?',text);
  const bad=cast.avoid&&list(cast.avoid).filter(w=>typeof w==='string'&&w&&new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text));
  for(const w of bad||[])P('voice-avoid',node,where,`this person never says "${w}" (cast.avoid) but the bubble does`,'reword the bubble in this person\'s voice',text);
  if(num(cast.maxSentenceWords))for(const s of sentences(text)){const w=s.split(/\s+/).length;if(w>cast.maxSentenceWords){P('voice-sentence-long',node,where,`a sentence has ${w} words but this voice allows ${cast.maxSentenceWords} (cast.maxSentenceWords)`,'split the sentence or shorten it',s);break}}
  if(periods&&periods.size){
   for(const [w,ok] of timeWordsIn(text)){const wrong=[...periods].filter(p=>!ok.includes(p));
    if(wrong.length){const want=ok.length>1?'['+ok.map(x=>"'"+x+"'").join(',')+']':"'"+ok[0]+"'";
     P('wrong-time-word',node,where,`the word "${w}" is only right in ${ok.join(' or ')} but this variant can be said in ${[...periods].join(', ')} (wrong in ${wrong.join(', ')})`,`add if:{period:${want}} to this variant (or put when:{period:${want}} on the node), or remove the word`,text)}}
  }
  void cond;
 };
 const checkVariants=(variants,node,label,nodeWhen,isBye)=>{
  if(!Array.isArray(variants)||!variants.length){P('bad-shape',node,label,'there are no variants to say','add say:[{t:"A whole sentence."}]');return}
  variants.forEach((v,i)=>{
   const where=`${label} variant ${i+1}`;
   if(!isObj(v)){P('bad-shape',node,where,'the variant is not an object','write {t:"text"} or {if:{...},t:["bubble one.","bubble two."]}');return}
   checkCond(v.if,node,where+' if');checkEffects(v.do,node,where+' do');
   const raw=list(v.t),goodRaw=raw.filter(t=>typeof t==='string'&&t.trim());
   if(!goodRaw.length||goodRaw.length!==raw.length){P('bad-shape',node,where,'t must be a string or a list of 1 to '+MAX_BUBBLES+' non-empty strings','write t:"One sentence." or t:["First bubble.","Second bubble."]');return}
   if(raw.length>MAX_BUBBLES)P('bad-shape',node,where,`the variant has ${raw.length} bubbles (the limit is ${MAX_BUBBLES})`,'cut it to 3 bubbles or split it into two variants');
   const periods=isBye?new Set(PERIODS):intersect(periodsOf(nodeWhen),periodsOf(v.if));
   const bubbles=bubblesOf(v,facts);
   bubbles.forEach((b,j)=>checkBubble(b,node,`${where} bubble ${j+1}`,periods,v.if));
   // rule 9: two greeting openers in one variant (e.g. "Hey. ... Hello.")
   const openers=bubbles.flatMap(sentences).filter(s=>OPENER.test(s));
   if(openers.length>=2)P('glue-suspect',node,where,`the variant has ${openers.length} greeting openers (${names(openers.map(s=>s.split(/\s+/)[0].replace(/[^\p{L}]/gu,'')))}), so two greetings were glued together`,'keep ONE greeting per variant and write the rest as a separate variant',bubbles.join(' '));
   const slot=(raw.join(' ').match(/\{(\w+)\}/g)||[]).find(s=>!(isObj(facts)&&Object.prototype.hasOwnProperty.call(facts,s.slice(1,-1))));
   if(slot)P('placeholder-text',node,where,`the slot ${slot} has no matching entry in cast.facts`,`add facts:{${slot.slice(1,-1)}:'...'} or remove the slot`,raw.join(' '));
  });
 };
 // ---- per node
 const entries=nodes.filter(n=>n.entry===true);
 if(!entries.length)P('no-entry','','nodes','no node has entry:true, so nobody can start a talk','mark the opening node(s) entry:true and give the last one no `when`');
 for(const n of nodes){
  const id=n.id;
  checkCond(n.when,id,'node when');checkEffects(n.do,id,'node do');
  checkVariants(n.say,id,'say',n.when,false);
  const reps=Array.isArray(n.replies)?n.replies:[];
  if(n.replies!==undefined&&!Array.isArray(n.replies))P('bad-shape',id,'replies','replies is not a list','write replies:[{label:"...",go:"node.id"}]');
  const labels=new Map();let usable=0;
  reps.forEach((r,i)=>{
   const where=`reply ${i+1}`+(isObj(r)&&typeof r.label==='string'?' '+quote(r.label):'');
   if(!isObj(r)||typeof r.label!=='string'||!r.label.trim()){P('bad-shape',id,where,'the reply has no label','write {label:"Any work going?",go:"node.id"}');return}
   checkCond(r.if,id,where+' if');checkEffects(r.do,id,where+' do');
   if(r.act!==undefined){if(!plainId(r.act))P('unknown-act',id,where,'the act is not a name','use act:"openStore" style names from the game act list');else if(!acts.has(r.act))P('unknown-act',id,where,`act "${r.act}" is not a known game action`,`use one of: ${[...acts].join(', ')}`)}
   if(r.label.length>MAX_LABEL_CHARS)P('line-too-long',id,where,`the reply label is ${r.label.length} characters (limit ${MAX_LABEL_CHARS})`,'shorten it to a short first-person line',r.label);
   if(/\bundefined\b|\bnull\b|\bNaN\b|[{}]/.test(r.label))P('placeholder-text',id,where,'the reply label contains a placeholder or leftover code','write a real label',r.label);
   const nl=norm(r.label);if(labels.has(nl))P('duplicate-label',id,where,`two replies in this node read the same ("${r.label.trim()}", also reply ${labels.get(nl)})`,'reword one so the player can tell them apart (or delete the duplicate)',r.label);else labels.set(nl,i+1);
   if(typeof r.go==='string'){if(!map.has(r.go))P('missing-go',id,where,`go points to "${r.go}", which is not a node of this cast`,`create a node with id "${r.go}" or change go to one of: ${[...map.keys()].slice(0,6).join(', ')}${map.size>6?', ...':''}`);else usable++}
   else if(r.go!==undefined)P('missing-go',id,where,'go is not a node id string','write go:"node.id"');
   else if(typeof r.act==='string'||r.end===true)usable++;
   else P('bad-shape',id,where,'the reply has no go, act or end','give it go:"node.id", act:"name" or end:true');
  });
  if(reps.length>MAX_REPLIES)P('too-many-replies',id,'replies',`the node has ${reps.length} replies but only ${MAX_REPLIES} are shown (the rest are silently dropped)`,`keep at most ${MAX_REPLIES} (move the rest to a sub-topic node)`);
  if(n.end!==true&&usable===0)P('dead-end',id,'replies','the node has no replies that lead anywhere and no end:true, so the talk dead-ends here','add replies:[{label:"...",go:"node.id"}] or set end:true');
 }
 if(cast.bye!==undefined)checkVariants(cast.bye,'','bye',undefined,true);
 // ---- rule 2: reachability from the entry nodes through reply.go
 if(entries.length){
  const reach=new Set(entries.map(n=>n.id)),stack=[...reach];
  while(stack.length){const n=map.get(stack.pop());if(!n)continue;for(const r of list(n.replies))if(isObj(r)&&typeof r.go==='string'&&map.has(r.go)&&!reach.has(r.go)){reach.add(r.go);stack.push(r.go)}}
  for(const n of nodes)if(!reach.has(n.id))P('unreachable-node',n.id,'node','no reply leads to this node and it is not an entry node, so nobody can ever see it','add a reply with go:"'+n.id+'" in the node where it belongs, or mark it entry:true, or delete it');
 }
 // ---- rule 7: the same text twice (this cast, then every other cast)
 const byText=new Map();
 for(const b of bubbleTexts){if(!byText.has(b.n))byText.set(b.n,[]);byText.get(b.n).push(b)}
 const otherText=new Map();
 for(const oc of others){if(!isObj(oc)||!Array.isArray(oc.nodes))continue;const w=str(oc.name)||str(oc.id);for(const n of oc.nodes)if(isObj(n))for(const v of list(n.say))for(const t of bubblesOf(v,oc.facts)){const k=norm(t);if(k&&!otherText.has(k))otherText.set(k,w+' / '+str(n.id))}}
 for(const [k,arr] of byText){
  if(arr.length>1)P('repeated-text',arr[1].node,arr[1].where,`the same text appears ${arr.length} times in this cast (also at ${arr.filter((_,i)=>i!==1).slice(0,3).map(a=>(a.node||'bye')+' '+a.where).join('; ')})`,'rewrite all but one so no two bubbles are the same',arr[1].text);
  else if(otherText.has(k))P('repeated-text',arr[0].node,arr[0].where,`another person already says exactly this (${otherText.get(k)})`,'rewrite it in this person\'s own voice (no two people share a line)',arr[0].text);
 }
 // ---- rule 11: coverage sweep
 sweep(cast,map,nodes,entries,o,P);
}
// ---- rule 11: the sweep. For each node (and for the entry set) try many contexts and make sure a variant fits wherever the node can be reached.
function collectDomains(nodes){
 const d={places:new Set(),weathers:new Set(['clear']),gigs:new Set(),clients:new Set(),hired:new Set(),beats:new Set(),recents:new Set(),seenNodes:new Set(),stories:new Set([0]),ranks:new Set([1]),days:new Set([0,1,9999])};
 const walk=c=>{if(!isObj(c))return;
  for(const x of list(c.place))d.places.add(x);for(const x of list(c.weather))d.weathers.add(x);
  if(typeof c.gig==='string'||Array.isArray(c.gig))for(const x of list(c.gig))d.gigs.add(x);
  for(const x of list(c.gigClient))d.clients.add(x);if(typeof c.hired==='string'||Array.isArray(c.hired))for(const x of list(c.hired))d.hired.add(x);
  for(const x of [...list(c.beat),...list(c.notBeat)])if(typeof x==='string')d.beats.add(x);for(const x of list(c.recent))if(typeof x==='string')d.recents.add(x);
  for(const o of list(c.seen))if(isObj(o)&&typeof o.node==='string')d.seenNodes.add(o.node);
  if(Array.isArray(c.story))for(const x of c.story)if(num(x)){d.stories.add(Math.max(0,x));d.stories.add(Math.max(0,x-1));d.stories.add(x+1)}
  if(num(c.rankMin)){d.ranks.add(c.rankMin);d.ranks.add(Math.max(1,c.rankMin-1))}
  const ds=Array.isArray(c.daysSince)?c.daysSince:isObj(c.daysSince)?[c.daysSince.min,c.daysSince.max]:[];for(const x of ds)if(num(x)){d.days.add(x);d.days.add(x+1);d.days.add(Math.max(0,x-1))}
 };
 for(const n of nodes){walk(n.when);for(const v of list(n.say))if(isObj(v))walk(v.if);for(const r of list(n.replies))if(isObj(r))walk(r.if)}
 if(!d.places.size)d.places.add('street');
 return d;
}
function groupsFor(keys,d){
 const g=[],has=(...k)=>k.some(x=>keys.has(x)),G=(label,opts)=>g.push({label,opts});
 if(has('period','hour'))G('time',Array.from({length:24},(_,h)=>({text:`${String(h).padStart(2,'0')}:00 (${periodOf(h*60)})`,patch:{minute:h*60}})));
 if(has('weather'))G('weather',[...d.weathers].map(w=>({text:'weather '+w,patch:{weather:w}})));
 if(has('place'))G('place',[...d.places].map(p=>({text:'place '+p,patch:{place:p}})));
 if(has('met'))G('met',[true,false].map(m=>({text:'met '+m,patch:{met:m}})));
 if(has('tierMin','tierMax'))G('tier',TIERS.map(t=>({text:'tier '+t,patch:{tier:t}})));
 if(has('mood'))G('mood',MOOD_BANDS.map(m=>({text:'mood '+m,patch:{moodBand:m}})));
 if(has('story'))G('story',[...d.stories].sort((a,b)=>a-b).map(s=>({text:'story step '+s,patch:{story:s}})));
 if(has('storyDone'))G('storyDone',[true,false].map(s=>({text:'storyDone '+s,patch:{storyDone:s}})));
 if(has('gig'))G('gig',['',...d.gigs,'other-gig'].map(x=>({text:x?'gig '+x:'no gig',patch:{gig:x}})));
 if(has('gigClient'))G('gigClient',['',...d.clients,'other-client'].map(x=>({text:x?'gigClient '+x:'no gig client',patch:{gigClient:x}})));
 if(has('hired','rankMin')){const ids=[...d.hired],opts=[{text:'hired nowhere',patch:{hired:{}}}];for(const id of ids)for(const r of d.ranks)opts.push({text:`hired at ${id} rank ${r}`,patch:{hired:{[id]:r}}});if(!ids.length)for(const r of d.ranks)opts.push({text:'hired at rank '+r,patch:{hired:{x:r}}});G('hired',opts)}
 if(has('cafe'))G('cafe',CAFE_STATES.map(c=>({text:'cafe '+c,patch:{cafe:c}})));
 if(has('beat','notBeat')){const b=[...d.beats],o=[{text:'no beats set',patch:{beats:[]}}];for(const x of b)o.push({text:'only beat '+x,patch:{beats:[x]}});if(b.length>1)o.push({text:'all beats set',patch:{beats:b}});G('beats',o)}
 if(has('seen')){const n=[...d.seenNodes],o=[{text:'nothing seen',patch:{seen:{}}}];for(const x of n)for(const c of [1,3,10])o.push({text:`${x} seen ${c}x`,patch:{seen:{[x]:c}}});G('seen',o)}
 if(has('daysSince'))G('daysSince',[...d.days].sort((a,b)=>a-b).map(x=>({text:x>=9999?'never talked before':x+' days since the last talk',patch:{daysSince:x}})));
 if(has('recent')){const r=[...d.recents],o=[{text:'no recent events',patch:{recent:[]}}];for(const x of r)o.push({text:'recent '+x,patch:{recent:[x]}});G('recent',o)}
 return g;
}
function* contextsOf(groups,limit){
 const total=groups.reduce((a,g)=>a*g.opts.length,1),count=Math.min(total,limit);
 for(let i=0;i<count;i++){
  let idx=total>limit?Math.floor(i*total/limit):i;const patch={},texts=[];
  for(const g of groups){const o=g.opts[idx%g.opts.length];idx=Math.floor(idx/g.opts.length);Object.assign(patch,o.patch);texts.push(o.text)}
  yield {patch,texts};
 }
}
function keysOfNode(n,withVariants=true){
 const k=new Set(),add=c=>{if(isObj(c))for(const x of Object.keys(c))if(CONDITION_KEYS.includes(x))k.add(x)};
 add(n.when);if(withVariants)for(const v of list(n.say))if(isObj(v))add(v.if);return k;
}
const unconditional=v=>isObj(v)&&(v.if===undefined||v.if===null||(isObj(v.if)&&!Object.keys(v.if).length))&&bubblesOf(v,{}).length>0;
function sweep(cast,map,nodes,entries,o,P){
 const limit=num(o.sweepLimit)?o.sweepLimit:SWEEP_LIMIT,d=collectDomains(nodes);
 for(const p of list(o.places))if(PLACES.includes(p))d.places.add(p); // opts.places: places where this person can be talked to even if no condition names them
 const fits=(n,ctx)=>list(n.say).some(v=>isObj(v)&&bubblesOf(v,cast.facts).length>0&&matches(v.if,ctx));
 // reachable nodes only (unreachable ones already have their own problem)
 const reach=new Set(entries.map(n=>n.id)),stack=[...reach];
 while(stack.length){const n=map.get(stack.pop());if(!n)continue;for(const r of list(n.replies))if(isObj(r)&&typeof r.go==='string'&&map.has(r.go)&&!reach.has(r.go)){reach.add(r.go);stack.push(r.go)}}
 for(const n of nodes){
  if(n.entry===true||!reach.has(n.id)||!Array.isArray(n.say)||list(n.say).some(unconditional))continue;
  let fails=0,first=null;
  for(const c of contextsOf(groupsFor(keysOfNode(n),d),limit)){const ctx=baseContext({who:cast.id,...c.patch});if(!matches(n.when,ctx))continue;if(!fits(n,ctx)){fails++;if(!first)first=c.texts}}
  if(fails)P('uncovered-node',n.id,'say',`no variant fits when ${first.join(', ')||'any situation'}${fails>1?` (and ${fails-1} more situations)`:''}, so the node would say nothing`,'add a last variant with no `if` as a fallback, or widen the `if` of an existing variant');
 }
 if(entries.length){
  if(entries.some(n=>!Object.keys(isObj(n.when)?n.when:{}).length&&list(n.say).some(unconditional)))return;
  const keys=new Set();for(const n of entries)for(const k of keysOfNode(n))keys.add(k);
  let fails=0,first=null,none=false;
  for(const c of contextsOf(groupsFor(keys,d),limit)){
   const ctx=baseContext({who:cast.id,...c.patch}),open=entries.filter(n=>matches(n.when,ctx));
   if(!open.length||!open.some(n=>fits(n,ctx))){fails++;if(!first){first=c.texts;none=!open.length}}
  }
  if(fails)P('uncovered-node',entries.map(n=>n.id).join(', '),'entry nodes',`${none?'no entry node opens':'no entry node has a variant that fits'} when ${first.join(', ')}${fails>1?` (and ${fails-1} more situations)`:''}, so the person would have nothing to say when you walk up`,'make one entry node have no `when` and end its say list with a variant that has no `if`');
 }
}
