// npc-life.js: pure rules for the named NPCs (saved mood/sickness/talk state, standing tiers, visit rules, a named person's day wrapped around schedule.js, need seeds); implements notes/world-system-design.md (NPC life, OWNER ANSWERS 6/7/15, NEW NPCS). No DOM, no globals, no Math.random/Date.now: chance is an integer hash of ids, day and an injected seed; every function returns NEW objects.
import {ROSTER_ORDER,byId,MOOD_WORDS,HUNTING_TOPICS} from './npc-roster.js';
export const DAY=1440;
// ---- numbers (placeholders to tune)
export const TIERS=Object.freeze(['stranger','acquaintance','friend','close']);
export const STANDING_THRESHOLDS=Object.freeze({stranger:0,acquaintance:5,friend:20,close:50});
export const STANDING_DAILY_CAP=3;       // standing gained per person per day
export const STANDING_MAX=1000;
export const MOOD_MIN=0,MOOD_MAX=100,MOOD_DRIFT=5;      // drift toward the personal baseline per day
export const MOOD_WORD_MIN=Object.freeze({miserable:0,low:20,okay:40,good:60,delighted:80});
export const SKIP_ERRANDS_BELOW=25;
export const SICK_EVERY_DAYS=21;         // each NPC about once in this many days (a day with two candidates picks one, so a little less)
export const SICK_MAX_DAYS=3;
export const SICK_MOOD_DROP=2;
export const TALK_GAIN=2;                // a first friendly talk of the day
export const OSCAR_TALKS_FREE=2,OSCAR_TALK_COST=6,OSCAR_HELP_GAIN=8;
export const HELP_GAIN=4;
export const LINCOLN_HUNT_GAIN=6,LINCOLN_REPEAT_GAIN=1,LINCOLN_OTHER_GAIN=-1,SULK_AFTER_DAYS=3,SULK_DROP=4,SULK_TARGET_DROP=20,SULK_UNTALKED_AFTER=3;
export const CAT_TOPICS=Object.freeze(['cat','brentster-jr','cat-food','vet']);
export const BRENTSTER_CAT_GAIN=6,BRENTSTER_OTHER_COST=2;
export const AFTERNOON=720;              // rain drops errands that start after this minute
export const OUTING_TRIP_MIN=15,MARKET_STAY=30,DELIVERY_AT=600,DELIVERY_DAY=2,VISIT_AT=1020,VISIT_SPREAD=120,VISIT_STAY=45;
export const NEED_EVERY_DAYS=8,NEED_DUE_DAYS=3;
export const RAIN_WORDS=Object.freeze(['rain','storm','snow']);
const ACTS=['sleep','home','travel','work','shop','away','outside']; // keep equal to schedule.js ACTS
// ---- helpers
const hash=(...a)=>{let h=2166136261;for(const ch of a.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0};
const int=(v,lo,hi,d=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const clampMood=v=>Math.max(MOOD_MIN,Math.min(MOOD_MAX,Math.round(v)));
const towards=(v,t,s)=>v<t?Math.min(t,v+s):Math.max(t,v-s);
const safeKey=k=>typeof k==='string'&&k.length>0&&k.length<=40&&k!=='__proto__'&&k!=='constructor'&&k!=='prototype';
// ---- standing (per PLAYER; saved by the caller at progress.standing.people)
export function normalizeStanding(raw){
 const people={};const src=raw&&typeof raw==='object'&&raw.people&&typeof raw.people==='object'&&!Array.isArray(raw.people)?raw.people:{};
 for(const id of Object.keys(src)){if(!safeKey(id))continue;const e=src[id];if(!e||typeof e!=='object')continue;
  people[id]={points:int(e.points,0,STANDING_MAX,0),gainDay:int(e.gainDay,-1,1e9,-1),gainToday:int(e.gainToday,0,STANDING_DAILY_CAP,0)}}
 return {people};
}
export function tierOfStanding(points){const p=int(points,0,STANDING_MAX,0);let t='stranger';for(const k of TIERS)if(p>=STANDING_THRESHOLDS[k])t=k;return t}
export const tierRank=t=>Math.max(0,TIERS.indexOf(t));
export const standingOf=(stats,id)=>normalizeStanding(stats).people[id]?.points||0;
export const tierFor=(stats,id)=>tierOfStanding(standingOf(stats,id));
// Positive amounts are capped at STANDING_DAILY_CAP per person per day; negative amounts (a snub) are not capped. -> new state
export function gainStanding(stats,id,amount,day){
 const s=normalizeStanding(stats);if(!safeKey(id))return s;
 const d=int(day,0,1e9,0),a=int(amount,-STANDING_MAX,STANDING_MAX,0),e=s.people[id]||{points:0,gainDay:-1,gainToday:0};
 const used=e.gainDay===d?e.gainToday:0;
 if(a>=0){const g=Math.min(a,STANDING_DAILY_CAP-used);s.people[id]={points:Math.min(STANDING_MAX,e.points+g),gainDay:d,gainToday:used+g}}
 else s.people[id]={points:Math.max(0,e.points+a),gainDay:e.gainDay,gainToday:e.gainToday};
 return s;
}
// ---- saved NPC state: npcs[id]={id,mood,sickUntil,lastTalkDay,talks:{topic:count},flags:[],talkDay,talksToday,metDay} (metDay = the day the player first met them, -1 = not met: the People page's met set, W-D3)
export const baselineOf=id=>byId(id)?.baseline??50;
export function newNpc(id){return {id,mood:baselineOf(id),sickUntil:-1,lastTalkDay:-1,talks:{},flags:[],talkDay:-1,talksToday:0,metDay:-1}}
export function normalizeNpcs(raw){
 const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},out={};
 for(const id of ROSTER_ORDER){
  const e=src[id],d=newNpc(id);
  if(!e||typeof e!=='object'||Array.isArray(e)){out[id]=d;continue}
  const talks={};let n=0;
  if(e.talks&&typeof e.talks==='object'&&!Array.isArray(e.talks))for(const k of Object.keys(e.talks)){if(n>=40)break;if(!safeKey(k))continue;const c=int(e.talks[k],0,1e6,0);if(c>0){talks[k]=c;n++}}
  const flags=[];if(Array.isArray(e.flags))for(const f of e.flags){if(flags.length>=12)break;if(safeKey(f)&&!flags.includes(f))flags.push(f)}
  out[id]={id,mood:clampMood(Number.isFinite(e.mood)?e.mood:d.mood),sickUntil:int(e.sickUntil,-1,1e9,-1),lastTalkDay:int(e.lastTalkDay,-1,1e9,-1),talks,flags,talkDay:int(e.talkDay,-1,1e9,-1),talksToday:int(e.talksToday,0,1e6,0),metDay:int(e.metDay,-1,1e9,int(e.lastTalkDay,-1,1e9,-1))};
 }
 return out;
}
export function moodWord(mood){const m=clampMood(Number.isFinite(mood)?mood:50);let w=MOOD_WORDS[0];for(const k of MOOD_WORDS)if(m>=MOOD_WORD_MIN[k])w=k;return w}
// One of the roster's lines for this mood, picked by hash (stable for the same npc, day and seed).
export function moodLine(npc,day,seed=0){const r=byId(npc?.id);if(!r)return '';const list=r.lines[moodWord(npc.mood)];return list[hash(seed,npc.id,'line',day)%list.length]}
const withFlag=(flags,f,on)=>on?(flags.includes(f)?[...flags]:[...flags,f]):flags.filter(x=>x!==f);
export const isSick=(npc,day)=>!!npc&&npc.sickUntil>=int(day,0,1e9,0);
// ---- sickness: the same for everyone, from the seed and the day only. Never two NPCs START the same day (a day with two candidates picks one).
export function sickToday(day,seed=0){
 const d=int(day,0,1e9,0);let best=null,bh=Infinity;
 for(const id of ROSTER_ORDER){if(hash(seed,id,'sick',d)%SICK_EVERY_DAYS!==0)continue;const k=hash(seed,id,'pick',d);if(k<bh){bh=k;best=id}}
 return best;
}
export const sickLength=(id,day,seed=0)=>1+hash(seed,id,'len',day)%SICK_MAX_DAYS;
export function applySickness(npc,day,seed=0){
 const d=int(day,0,1e9,0);if(!npc||npc.sickUntil>=d||sickToday(d,seed)!==npc.id)return {...npc,talks:{...npc.talks},flags:[...npc.flags]};
 return {...npc,talks:{...npc.talks},flags:[...npc.flags],sickUntil:d+sickLength(npc.id,d,seed)-1};
}
// ---- the daily mood tick. ctx={catMood?, seed?}. Order: sickness starts, then mood drifts toward the baseline (Brentster: toward his cat's mood).
export function moodTick(npc,day,ctx={}){
 const d=int(day,0,1e9,0),r=byId(npc.id),seed=ctx.seed??0;
 let n=applySickness(npc,d,seed),target=r?r.baseline:50,flags=n.flags;
 if(r?.rule==='catowner'&&Number.isFinite(ctx.catMood))target=clampMood(ctx.catMood);
 let mood=towards(n.mood,target,MOOD_DRIFT);
 if(r?.rule==='hunter'){
  const gap=n.lastTalkDay<0?d:d-n.lastTalkDay,total=Object.values(n.talks).reduce((a,b)=>a+b,0),hunted=HUNTING_TOPICS.reduce((a,t)=>a+(n.talks[t]||0),0);
  const sulk=gap>=SULK_AFTER_DAYS&&d>=SULK_AFTER_DAYS||(total>=SULK_UNTALKED_AFTER&&hunted===0);
  flags=withFlag(flags,'sulking',sulk);
  if(sulk){mood=towards(mood,Math.max(MOOD_MIN,target-SULK_TARGET_DROP),MOOD_DRIFT);mood-=SULK_DROP}
 }
 if(isSick(n,d))mood-=SICK_MOOD_DROP;
 return {...n,mood:clampMood(mood),flags,talks:{...n.talks}};
}
// ---- talking. -> new npc (mood, talks, lastTalkDay, flags)
export function talk(npc,topic,day){
 const d=int(day,0,1e9,0),t=safeKey(topic)?topic:'chat',r=byId(npc.id);
 const first=npc.talkDay!==d,today=(first?0:npc.talksToday)+1;
 const talks={...npc.talks,[t]:(npc.talks[t]||0)+1};let mood=npc.mood,flags=[...npc.flags];
 if(r?.rule==='recluse'){if(today>OSCAR_TALKS_FREE)mood-=OSCAR_TALK_COST}
 else if(r?.rule==='hunter'){
  if(HUNTING_TOPICS.includes(t)){mood+=(npc.talks[t]||0)===0?LINCOLN_HUNT_GAIN:LINCOLN_REPEAT_GAIN;flags=withFlag(flags,'sulking',false)}
  else mood+=LINCOLN_OTHER_GAIN;
 }else if(r?.rule==='catowner')mood+=CAT_TOPICS.includes(t)?BRENTSTER_CAT_GAIN:-BRENTSTER_OTHER_COST;
 else if(first)mood+=TALK_GAIN;
 return {...npc,mood:clampMood(mood),talks,flags,lastTalkDay:d,talkDay:d,talksToday:today,metDay:npc.metDay>=0?npc.metDay:d};
}
// The player met them (answered the door, spoke first words): no mood or talk effect, only the met day. -> new npc
export function meet(npc,day){return {...npc,talks:{...npc.talks},flags:[...npc.flags],metDay:npc.metDay>=0?npc.metDay:int(day,0,1e9,0)}}
// Quiet help (a need filled, a favour done): Oscar warms most. -> new npc
export function helped(npc,day){const r=byId(npc.id);return {...npc,mood:clampMood(npc.mood+(r?.rule==='recluse'?OSCAR_HELP_GAIN:HELP_GAIN)),talks:{...npc.talks},flags:[...npc.flags]}}
// ---- visiting an NPC's flat or house. minute = minute of the day; plan = that NPC's plan for the day (namedPlan); opts={sick}
// atDoor: the NPC will talk at the door; inside: the player may go in; allowed = atDoor||inside. Strangers never; acquaintances at the door; friends inside; the roster can raise a tier (Oscar: inside needs 'close', door only 10:00-12:00).
export function canVisit(npcId,tier,minute,plan,opts={}){
 const r=byId(npcId),no=reason=>({allowed:false,atDoor:false,inside:false,reason});
 if(!r)return no('unknown');if(!r.home||!r.visit.atDoor)return no('no-home-in-town');
 const rank=tierRank(tier);if(rank<tierRank('acquaintance'))return no('stranger');
 const m=((int(minute,-1e9,1e9,0)%DAY)+DAY)%DAY,b=Array.isArray(plan)?plan.find(x=>m>=x.from&&m<x.to):null;
 if(!b)return no('no-plan');
 if(b.act==='sleep')return no('asleep');
 if(b.place!==r.home||(b.act!=='home'))return no('not-home');
 const hrs=r.visit.doorHours;if(hrs&&(m<hrs[0]||m>=hrs[1]))return no('door-closed');
 if(rank<tierRank(r.visit.atDoor))return no('stranger');
 const inside=!opts.sick&&rank>=tierRank(r.visit.inside);
 return {allowed:true,atDoor:true,inside,reason:opts.sick?'sick':inside?'welcome':'door-only'};
}
// ---- a named person's day
const blockOk=b=>b&&Number.isInteger(b.from)&&Number.isInteger(b.to)&&b.to>b.from&&ACTS.includes(b.act);
function merge(blocks){const out=[];for(const b of blocks){const p=out[out.length-1];if(p&&b.act!=='travel'&&p.act===b.act&&p.place===b.place&&p.to===b.from)p.to=b.to;else out.push({...b})}return out}
// Drop every errand (travel there, the shop block, travel back) that starts at `fromMinute` or later.
function dropErrands(plan,fromMinute){
 const out=[];
 for(let i=0;i<plan.length;i++){const b=plan[i],a=out[out.length-1],c=plan[i+1];
  if(b.act==='travel'&&c&&(c.act==='shop'||c.act==='outside')&&c.place===b.place&&c.from>=fromMinute&&plan[i+2]&&plan[i+2].act==='travel'&&plan[i+2].origin===c.place){
   const back=plan[i+2],X=b.origin,Y=back.place;
   if(X===Y)out.push({from:b.from,to:back.to,act:a&&a.place===X&&a.act!=='travel'?a.act:'home',place:X});
   else out.push({from:b.from,to:back.to,act:'travel',place:Y,origin:X,mode:b.mode||'walk'});
   i+=2;continue}
  out.push({...b})}
 return merge(out);
}
function sickPlan(plan){
 const home=plan[0].place,act=plan[0].act==='away'?'away':'home';
 if(act==='away')return [{from:0,to:DAY,act:'away',place:home}];
 const wake=(plan.find(b=>b.act!=='sleep')||{from:420}).from,last=plan[plan.length-1],bed=last.act==='sleep'?last.from:1320;
 const w=Math.max(1,Math.min(wake,bed-1));
 return [{from:0,to:w,act:'sleep',place:home},{from:w,to:bed,act:'home',place:home},{from:bed,to:DAY,act:'sleep',place:home}];
}
// Split the home/work block that holds `start` into: stay, travel there, stay `stay` minutes at `place` as `act`, travel back, rest. Unchanged if it does not fit.
function outing(plan,start,place,stay,act,trip){
 const i=plan.findIndex(b=>start>=b.from&&start<b.to&&(b.act==='home'||b.act==='work')&&b.place!==place);if(i<0)return plan;
 const b=plan[i],X=b.place,t=Math.max(1,Math.round(trip(X,place))),end=start+t+stay+t;if(end>b.to)return plan;
 const out=plan.slice(0,i).map(x=>({...x}));
 if(start>b.from)out.push({from:b.from,to:start,act:b.act,place:X});
 out.push({from:start,to:start+t,act:'travel',place,origin:X,mode:'walk'},{from:start+t,to:start+t+stay,act,place},{from:start+t+stay,to:end,act:'travel',place:X,origin:place,mode:'walk'});
 if(end<b.to)out.push({from:end,to:b.to,act:b.act,place:X});
 for(const x of plan.slice(i+1))out.push({...x});
 return out;
}
// Does a friend visit the player today? -> {visit,minute,stay,at:'porch'|'home'} (porch for friends, inside the player's home for close friends). Deterministic from seed, id and day.
export function visitsPlayer(npc,day,tier,seed=0){
 const no={visit:false,minute:0,stay:0,at:null},r=byId(npc?.id),d=int(day,0,1e9,0);
 if(!r||!r.home||tierRank(tier)<tierRank('friend')||isSick(npc,d)||npc.mood<SKIP_ERRANDS_BELOW)return no;
 const every=r.visit.every[tier==='close'?'close':'friend'];if(!every||hash(seed,npc.id,'visit',d)%every!==0)return no;
 return {visit:true,minute:VISIT_AT+hash(seed,npc.id,'visit-at',d)%VISIT_SPREAD,stay:VISIT_STAY,at:tier==='close'?'home':'porch'};
}
export const dayRole=(npcId,day)=>{const r=byId(npcId),k=((int(day,0,1e9,0)%7)+7)%7;if(!r)return null;if(r.deliveryDay===k)return 'delivery';if(r.marketDay===k)return 'market';return null};
// basePlan = a schedule.js dayPlan(person,day) for this NPC (never edited). world={seed, weather(day)->'rain'|..., standing (the player's standing state) or tier, playerPlace, trip(from,to)->minutes, marketPlace}
// -> a NEW plan with the same shape and valid ACTS that still covers 0..1440.
export function namedPlan(npc,day,world,basePlan){
 const d=int(day,0,1e9,0),w=world||{},r=byId(npc.id),plan0=Array.isArray(basePlan)&&basePlan.length&&basePlan.every(blockOk)?basePlan.map(b=>({...b})):null;
 if(!plan0||!r)return plan0||[];
 if(isSick(npc,d))return sickPlan(plan0);
 let plan=plan0;const trip=typeof w.trip==='function'?w.trip:()=>OUTING_TRIP_MIN;
 if(r.homebody||npc.mood<SKIP_ERRANDS_BELOW){plan=dropErrands(plan,0);const home=plan[0].place;plan=merge(plan.map(b=>b.act==='outside'&&b.place===home?{...b,act:'home'}:b))} // no strolls and no sitting out at the door (NPC-VISIBLE): Oscar stays in
 else if(typeof w.weather==='function'&&RAIN_WORDS.includes(w.weather(d)))plan=dropErrands(plan,AFTERNOON);
 const role=dayRole(npc.id,d);
 if(role==='delivery'&&!r.homebody&&npc.mood>=SKIP_ERRANDS_BELOW)plan=outing(plan,DELIVERY_AT+hash(w.seed??0,npc.id,'deliv',d)%30,w.marketPlace||'shop:market',MARKET_STAY,'work',trip);
 const tier=w.tier||(w.standing?tierFor(w.standing,npc.id):'stranger'),v=w.playerPlace?visitsPlayer(npc,d,tier,w.seed??0):{visit:false};
 if(v.visit&&!(typeof w.weather==='function'&&RAIN_WORDS.includes(w.weather(d))&&v.at==='porch'))plan=outing(plan,v.minute,w.playerPlace,v.stay,'shop',trip);
 return merge(plan);
}
// ---- need seeds the world system can read (W-B turns them into real needs). -> [{kind,good,place,person,qty,dueDay,reason}]
export function needsFor(npc,day,world={}){
 const d=int(day,0,1e9,0),r=byId(npc.id),seed=world.seed??0,out=[];if(!r)return out;
 const mk=(kind,good,reason,qty=1,place=r.home||r.work)=>out.push({kind,good,place,person:npc.id,qty,dueDay:d+NEED_DUE_DAYS,reason});
 if(isSick(npc,d)&&npc.sickUntil-d+1>=1&&r.home)mk('errand','medicine','sick',1,r.home);
 if(r.rule==='catowner'){const hunger=world.cat&&Number.isFinite(world.cat.hunger)?world.cat.hunger:0;if(hunger>=50)mk('tend','cat-food','cat-hungry',1);if(world.cat?.missing)mk('errand','cat-search','cat-missing',1)}
 if(r.rule==='recluse'&&tierRank(world.tier||'stranger')>=tierRank('close')&&hash(seed,npc.id,'truck',d)%30===0)mk('tow','black-truck','truck-dead',1);
 if(r.rule==='hunter'&&!npc.flags.includes('sulking')&&hash(seed,npc.id,'hunt',d)%6===0)mk('restock','ammo','low-ammo',2);
 if(npc.mood>=SKIP_ERRANDS_BELOW&&!out.length&&hash(seed,npc.id,'need',d)%NEED_EVERY_DAYS===0){
  const kinds=r.needs,k=kinds[hash(seed,npc.id,'need-kind',d)%kinds.length];mk(k,r.needGoods[k]||'goods','routine',1+hash(seed,npc.id,'qty',d)%3)}
 return out;
}
