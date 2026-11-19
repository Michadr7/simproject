// gig-clients.js: pure gig client rules (client profile and generosity, complications shown before accepting, regular clients, rep tiers and allowed types); implements notes/gig-overhaul-design.md (Rules, Variety, Progression). No DOM, no globals, integers only, deterministic from ids/day/seed.
export const DAY_MINUTES=1440; // same as gigs.js (day=floor(now/1440)); duplicated so this file stays import-free
export const HAL_ID='hal'; // ASSUMPTION: the client id G-E uses for Hal Brennan; pass another id to the helpers that take halId
export const COMPLICATION_RATE=.25; // about 1 gig in 4
export const NOT_HOME_PAY_MUL=1.3;
export const SIGNATURE_MINUTE=16*60; // client is home only after 16:00 (minute of the day)
export const COMPLICATION_KINDS=Object.freeze(['not-home','wrong-item','signature']);
export const REGULAR_AFTER=3; // gigs at quality >= REGULAR_QUALITY
export const REGULAR_QUALITY=80;
export const REQUEST_EVERY_DAYS=3;
export const REGULAR_PAY_MUL=1.15;
export const MAX_CLIENTS=60;
export const TIERS=Object.freeze([Object.freeze({id:'newcomer',min:0}),Object.freeze({id:'known',min:10}),Object.freeze({id:'trusted',min:25}),Object.freeze({id:'regular',min:40})]);
// Gig type ids (gigs.js GIG_TYPES plus the planned D4 cafe, D5 laundry, G5 farm crates).
export const NEWCOMER_TYPES=Object.freeze(['grocery','parcel']); // D1 D2
export const KNOWN_TYPES=Object.freeze(['round','cafe','laundry']); // D3 D4 D5
export const VEHICLE_TYPES=Object.freeze(['fragile','bulk','chain','fuel','farm-crates']);
const MOODS=Object.freeze(['Always in a hurry.','Chatty and warm.','Quiet, keeps to themselves.','Cheerful today.','Tired but polite.','Fussy about details.','Easygoing.','Grateful for any help.']);
const hash=(...a)=>{let h=2166136261;for(const ch of a.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return (h>>>0)};
const int=(v,lo,hi,d=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
// {generosity 0-3, mood}: hashed from client and world seed; Hal is fixed generous (3).
export function clientProfile(clientId,seed){
 const id=String(clientId??''),mood=MOODS[hash('mood',id,seed)%MOODS.length];
 if(id===HAL_ID)return {generosity:3,mood:'Warm and generous, always has a coffee on.'};
 return {generosity:hash('gen',id,seed)%4,mood};
}
// null or {kind,text,payMul,extraStop?,returnToPickup?,earliestMinute?}. Show on the card before accepting. Never on a starter gig.
export function complicationFor(gigId,day,type,seed,isStarter=false){
 if(isStarter)return null;
 const d=int(day,0,1e9,0),t=typeof type==='string'?type:type?.id||'';
 if(hash('comp',gigId,d,t,seed)%1000>=COMPLICATION_RATE*1000)return null;
 const kind=COMPLICATION_KINDS[hash('kind',gigId,d,t,seed)%COMPLICATION_KINDS.length];
 if(kind==='not-home')return {kind,text:'Not home: leave it with a neighbour (a second stop), pays 30% more.',payMul:NOT_HOME_PAY_MUL,extraStop:true};
 if(kind==='wrong-item')return {kind,text:'Wrong item: the pickup gave you the wrong one. Go back to the pickup.',payMul:1,returnToPickup:true};
 return {kind,text:'Signature needed: the client is only home after 16:00.',payMul:1,earliestMinute:d*DAY_MINUTES+SIGNATURE_MINUTE};
}
// ---- regulars. stats = {clientId:{good,last}}; good = gigs at quality >= 80, last = game minute of the last gig or request.
export function normalizeStats(v){
 const out={};if(!v||typeof v!=='object'||Array.isArray(v))return out;let n=0;
 for(const k of Object.keys(v)){
  if(n>=MAX_CLIENTS)break;if(!k||k.length>60||k==='__proto__'||k==='constructor'||k==='prototype')continue;const s=v[k];if(!s||typeof s!=='object')continue;
  out[k]={good:int(s.good,0,1e6,0),last:int(s.last,0,1e9,0)};n++;
 }
 return out;
}
export const isRegular=stat=>!!stat&&int(stat.good,0,1e6,0)>=REGULAR_AFTER;
// -> {clientId:{good,last,regular}} for every client in stats.
export function regularState(stats){const s=normalizeStats(stats),out={};for(const k of Object.keys(s))out[k]={...s[k],regular:isRegular(s[k])};return out}
// A regular asks again every REQUEST_EVERY_DAYS game days after last.
export const nextRequestDue=(stat,now)=>isRegular(stat)&&int(now,0,1e9,0)>=int(stat.last,0,1e9,0)+REQUEST_EVERY_DAYS*DAY_MINUTES;
// Returns a NEW stats object (the input is never changed).
export function recordGig(stats,clientId,quality,now){
 const s=normalizeStats(stats),id=String(clientId??'');if(!id||id.length>60||id==='__proto__')return s;
 const prev=s[id]||{good:0,last:0};
 s[id]={good:Math.min(1e6,prev.good+(int(quality,0,100,0)>=REGULAR_QUALITY?1:0)),last:int(now,0,1e9,prev.last)};
 return s;
}
// Client ids that should send a phone request now. Hal is the first regular offered once the starter is done (even before 3 good gigs); he is due at once if never recorded.
export function regularRequests(stats,now,{starterDone=false,halId=HAL_ID}={}){
 const s=normalizeStats(stats),out=[];
 if(starterDone){const h=s[halId];if(!h||!isRegular(h)){if(!h||int(now,0,1e9,0)>=h.last+REQUEST_EVERY_DAYS*DAY_MINUTES)out.push(halId)}}
 for(const k of Object.keys(s))if(nextRequestDue(s[k],now)&&!out.includes(k))out.push(k);
 return out;
}
// Pay multiplier for a gig from this client (regular +15%).
export const regularPayMul=(stats,clientId,{starterDone=false,halId=HAL_ID}={})=>{const s=normalizeStats(stats)[clientId];return isRegular(s)||(starterDone&&clientId===halId)?REGULAR_PAY_MUL:1};
// ---- tiers by gig rep
export function tierOfRep(rep){const r=int(rep,0,1e9,0);let t=TIERS[0];for(const x of TIERS)if(r>=x.min)t=x;return t.id}
export function allowedTypes(tier){
 const i=Math.max(0,TIERS.findIndex(t=>t.id===tier));
 const out=[...NEWCOMER_TYPES];if(i>=1)out.push(...KNOWN_TYPES);if(i>=2)out.push(...VEHICLE_TYPES);return out;
}
