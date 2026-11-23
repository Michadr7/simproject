// npc-dialogue.js: pure rules for talking to, knocking on the door of and listing the ten named NPCs (stage W-D3); implements notes/world-system-design.md (NEW NPCS, OWNER ANSWERS 7 and 15). No DOM, no three.js, no globals, no clock, no chance (lines are picked by an integer hash of ids, day and an injected seed).
// State in, NEW state out: `raw` is {npcs, standing} (progress.npcs, progress.standing; junk is normalised). game.js stores the returned state, the People page and the visit door read the same state. The met set is progress.npcs[id].metDay >= 0 (npc-life.js).
import {MAP} from './map-definition.js';
import {ROSTER,ROSTER_ORDER,byId,greetingsOf,KNOCK_LINES,OSCAR_REFUSAL,OSCAR_DOOR_STRANGER,CAT_STEERS,CAT_ANSWERS,COMMON_TOPICS,TOWN_LINES,TIPS} from './npc-roster.js';
import {normalizeNpcs,normalizeStanding,talk,meet,gainStanding,tierFor,standingOf,tierRank,moodWord,moodLine,isSick,canVisit,namedPlan,TIERS,STANDING_THRESHOLDS,OSCAR_TALKS_FREE,SKIP_ERRANDS_BELOW} from './npc-life.js';

export const TIER_WORDS=Object.freeze({stranger:'Stranger',acquaintance:'Acquaintance',friend:'Friend',close:'Close friend'});
export const CHOICES_PER_PAGE=2; // a menu with more than 3 choices shows this many topics and a 'More topics' button (the dialog has 3 buttons)
const hash=(...a)=>{let h=2166136261;for(const ch of a.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0};
const pick=(list,...k)=>list[hash(...k)%list.length];
const dayInt=d=>Number.isFinite(d)?Math.max(0,Math.floor(d)):0;
const stateOf=raw=>({npcs:normalizeNpcs(raw?.npcs),standing:normalizeStanding(raw?.standing)});

// ---- who is who
const BY_PERSON=new Map(ROSTER.map(r=>[r.personId,r]));
export const rosterByPersonId=personId=>BY_PERSON.get(personId)||null;
// ids of the people the player has met (spoken to, or heard at a door), in roster order. Never throws on junk.
export const metIds=npcs=>{const n=normalizeNpcs(npcs);return ROSTER_ORDER.filter(id=>n[id].metDay>=0)};
export const isMet=(npcs,id)=>!!npcs&&typeof npcs==='object'&&!!byId(id)&&Number.isFinite(npcs[id]?.metDay)&&npcs[id].metDay>=0;
export const displayRole=r=>String(r.role).replace(/ \(ASSUMED name\)/,'');

// ---- topics (the buttons). Lincoln: his hunting topics; Brentster: his cat; Oscar: little; everyone else: the common three.
export function topicsFor(id){
 const r=byId(id);if(!r)return [];
 if(r.rule==='hunter')return [...r.topics.map(t=>({id:t.id,label:t.title})),{id:'chat',label:'Something else'}];
 if(r.rule==='catowner')return [{id:'cat',label:'How is Brentster Jr.?'},{id:'cat-food',label:'What does Junior eat?'},{id:'vet',label:'Has Junior seen the vet?'},{id:'chat',label:'How are you doing?'}];
 if(r.rule==='recluse')return [{id:'chat',label:'Just checking in.'},{id:'tips',label:'Anything I can do for you?'}];
 return COMMON_TOPICS.map(t=>({...t}));
}
// A menu of more than 3 choices is shown a page at a time: -> {items, nextPage} (nextPage = null when everything fits). The caller adds a 'More topics' button that shows nextPage.
export function pagedChoices(list,page=0){
 if(list.length<=3)return {items:list,nextPage:null};
 const per=CHOICES_PER_PAGE,pages=Math.ceil(list.length/per),p=((Math.floor(page)||0)%pages+pages)%pages;
 return {items:list.slice(p*per,p*per+per),nextPage:(p+1)%pages};
}

// ---- opening a talk. The player has met them from here on (met day set); standing and mood change only when a topic is chosen (talkOutcome).
// -> {state, id, name, tier, text, choices:[{id,label}], oscarWary}
export function openTalk(raw,id,day,seed=0){
 const r=byId(id);if(!r)return null;
 const d=dayInt(day),s=stateOf(raw),tier=tierFor(s.standing,id),npc=meet(s.npcs[id],d),state={...s,npcs:{...s.npcs,[id]:npc}};
 const greet=pick(greetingsOf(id)[tier],seed,id,'greet',d,npc.talksToday);
 const wary=r.rule==='recluse'&&npc.talkDay===d&&npc.talksToday>=OSCAR_TALKS_FREE;
 return {state,id,name:r.name,tier,text:wary?OSCAR_REFUSAL:greet+' '+moodLine(npc,d,seed),choices:topicsFor(id),oscarWary:wary};
}

// ---- choosing a topic. One talk: talk(npc,topic,day) and gainStanding(+1, capped +3 a day). Pages are the lines to show one after another (Next / Skip in the UI): the effect is applied here, once, whatever the player does with the pages.
// Oscar: from the third talk of the day on he refuses ('Leave me be.'), the talk still costs mood (npc-life rule) and earns no standing. Brentster: every answer ends with a steer to his cat.
// -> {state, pages:[string], refused, steered, moodBefore, moodAfter, standingGain}
export function talkOutcome(raw,id,topicId,day,seed=0){
 const r=byId(id);if(!r)return null;
 const d=dayInt(day),s=stateOf(raw),npc0=meet(s.npcs[id],d),topic=topicsFor(id).find(t=>t.id===topicId),tid=topic?topic.id:'chat';
 const refused=r.rule==='recluse'&&npc0.talkDay===d&&npc0.talksToday>=OSCAR_TALKS_FREE;
 const npc=talk(npc0,tid,d),points0=standingOf(s.standing,id);
 const standing=refused?s.standing:gainStanding(s.standing,id,1,d);
 let pages,steered=false;
 if(refused)pages=[OSCAR_REFUSAL];
 else if(r.rule==='hunter'&&r.topics.some(t=>t.id===tid))pages=[...r.topics.find(t=>t.id===tid).lines]; // long-winded: three pages
 else if(r.rule==='catowner'){const a=CAT_ANSWERS[tid];steered=!a;pages=a?[a]:[replyFor(r,tid,npc,d,seed),pick(CAT_STEERS,seed,id,'steer',d,npc.talksToday)]}
 else if(r.rule==='hunter')pages=[replyFor(r,tid,npc,d,seed),'Which reminds me: '+pick(r.topics,seed,id,'back',d,npc.talksToday).lines[0]]; // steers back to hunting
 else pages=[replyFor(r,tid,npc,d,seed)];
 return {state:{...s,npcs:{...s.npcs,[id]:npc},standing},pages,refused,steered,moodBefore:npc0.mood,moodAfter:npc.mood,standingGain:standingOf(standing,id)-points0};
}
function replyFor(r,tid,npc,day,seed){
 if(tid==='town')return pick(TOWN_LINES,seed,r.id,'town',day,npc.talksToday);
 if(tid==='tips')return TIPS[r.id]||'Keep your head down and your hands busy.';
 return moodLine(npc,day,seed);
}
// A plain talk with someone whose own dialogue already exists (Noah's counter, Hal): only the effects. -> new {npcs, standing}
export function registerTalk(raw,id,day,topic='chat'){
 if(!byId(id))return stateOf(raw);const d=dayInt(day),s=stateOf(raw),npc=talk(meet(s.npcs[id],d),topic,d);
 return {npcs:{...s.npcs,[id]:npc},standing:gainStanding(s.standing,id,1,d)};
}

// ---- the door: the flats of the Oak Street Apartments (the named residents; the building has ONE door and a buzzer panel, no flat doors)
export const DWELLING_ID='dwelling:oak-apartments';
export const flatNumber=r=>r.flat?Number(String(r.flat).split('/').pop()):null;
export function flatDoors(npcs){
 return ROSTER.filter(r=>r.home===DWELLING_ID&&flatNumber(r)>0).map(r=>({id:r.id,flat:flatNumber(r),label:'Flat '+flatNumber(r)+(isMet(npcs,r.id)?' · '+r.name.split(' ')[0]:'')})).sort((a,b)=>a.flat-b.flat);
}
// Knock. ctx={day, minute (of the day), plan (that NPC's namedPlan for today), seed}.
// -> {allowed, reason, tier, text, talk:boolean (they talk to you now: call openTalk next), inside:boolean (the flat's inside is open to you: interiors do not exist yet, so the game talks in the doorway), state}
// canVisit decides. A stranger gets 'Who is it?' and no answer; a homebody (Oscar) who is awake and at the door answers once a day with a refusal and counts that as persistence (+1 standing, capped), otherwise nobody could ever get to know him: he never leaves his flat.
export function knock(raw,id,ctx){
 const r=byId(id);if(!r)return null;
 const d=dayInt(ctx.day),seed=ctx.seed??0,s=stateOf(raw),tier=tierFor(s.standing,id),sick=isSick(s.npcs[id],d),v=canVisit(id,tier,ctx.minute,ctx.plan,{sick});
 const out=(o)=>({allowed:v.allowed,reason:v.reason,tier,talk:false,inside:false,state:s,...o});
 if(!v.allowed){
  if(v.reason==='stranger'&&r.homebody&&canVisit(id,'acquaintance',ctx.minute,ctx.plan,{sick}).allowed){
   const npc=meet(s.npcs[id],d);
   return out({text:OSCAR_DOOR_STRANGER,state:{npcs:{...s.npcs,[id]:npc},standing:gainStanding(s.standing,id,1,d)}});
  }
  const lines=KNOCK_LINES[v.reason]||KNOCK_LINES.unknown;
  return out({text:pick(lines,seed,id,'knock',v.reason,d)});
 }
 if(v.reason==='sick')return out({text:pick(KNOCK_LINES.sick,seed,id,'knock','sick',d)});
 return out({talk:true,inside:v.inside,text:v.inside?'The door opens wide. "Come in, come in." You talk in the doorway.':'The door opens a crack.'});
}

// ---- the People page
const NICE={'dwelling:oak-apartments':'Oak Street Apartments'};
export function placeLabel(place,map=MAP){
 if(typeof place!=='string'||!place.includes(':'))return '';
 const k=place.slice(0,place.indexOf(':')),id=place.slice(place.indexOf(':')+1);
 if(k==='dwelling')return (map.dwellings||[]).find(x=>x.id===id)?.name||NICE[place]||id;
 if(k==='shop')return map.shops?.[id]?.name||(map.properties||[]).find(x=>x.id===id)?.name||id;
 if(k==='office')return (map.offices||[]).find(x=>x.id===id)?.name||id.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
 if(k==='zone')return (map.zones||[]).find(x=>x.id===id)?.label?.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase())||id;
 if(k==='property')return (map.properties||[]).find(x=>x.id===id)?.name||id;
 return id;
}
export function lastTalkedText(lastTalkDay,day){
 if(!(lastTalkDay>=0))return 'Not yet';const n=dayInt(day)-lastTalkDay;
 return n<=0?'Today':n===1?'Yesterday':n+' days ago';
}
// The one-line hint on how to get closer: the next tier and what is missing, plus the person's own tip.
export function improveHint(id,tier,points){
 const r=byId(id);if(!r)return '';
 const i=TIERS.indexOf(tier),next=TIERS[i+1];
 const lead=next?'Next: '+TIER_WORDS[next]+' at '+STANDING_THRESHOLDS[next]+' standing (you have '+points+'). Talk to them once a day (at most +3 a day) and fill their needs on the Gigs app.':'You are as close as it gets. Keep helping them.';
 return lead+' '+(TIPS[id]||'');
}
// Rows for the phone's People page: ONLY people the player has met. -> [{id,name,role,home,work,tier,tierWord,mood,sick,lastTalked,points,hint}]
export function peopleRows(raw,{day=0,map=MAP}={}){
 const s=stateOf(raw),d=dayInt(day),out=[];
 for(const id of ROSTER_ORDER){
  const npc=s.npcs[id];if(npc.metDay<0)continue;
  const r=byId(id),pts=standingOf(s.standing,id),tier=tierFor(s.standing,id);
  out.push({id,name:r.name,role:displayRole(r),home:r.home?placeLabel(r.home,map)+(r.flat?' · Flat '+flatNumber(r):''):'Lives out of town',work:r.work?placeLabel(r.work,map):'No regular job',tier,tierWord:TIER_WORDS[tier],mood:moodWord(npc.mood),sick:isSick(npc,d),lastTalked:lastTalkedText(npc.lastTalkDay,d),points:pts,hint:improveHint(id,tier,pts)});
 }
 return out;
}
export {tierRank};
// ---- walkers: a roster person's plan for the crowd (npc-crowd.js planOf). base = schedule.planOf(personId, schedDay); namedPlan changes it for sickness (stay home), a low mood or a homebody (no errands). Everyone else gets the plain schedule plan.
// The NPC day (sickness, moods) is schedDay-1 (schedule days are 1-based, npc-life days 0-based). No playerPlace is passed: a friend's visit to the player's home is NOT planned yet (nothing could draw it), so no visit block ever reaches the crowd.
// Memoised per person: the plan is rebuilt only when the day, the sick flag or the low-mood flag changes (a number compare per call, no allocation otherwise).
export function createRosterPlanner({schedule,getNpcs,seed=0,weather=null,trip=null}){
 const cache=new Map();
 return {
  planOf(personId,schedDay){
   const base=schedule.planOf(personId,schedDay),r=BY_PERSON.get(personId),npcs=r&&getNpcs();
   const npc=npcs&&npcs[r.id];if(!base||!npc)return base;
   const nd=Math.max(0,schedDay-1),key=schedDay*4+(isSick(npc,nd)?2:0)+(npc.mood<SKIP_ERRANDS_BELOW?1:0),hit=cache.get(personId);
   if(hit&&hit.key===key)return hit.plan;
   const world={seed,weather:weather||undefined,trip:trip||undefined},plan=namedPlan(npc,nd,world,base);
   cache.set(personId,{key,plan});return plan;
  },
  clear(){cache.clear()}
 };
}
