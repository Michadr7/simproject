// Pets (notes/handoff.md PET / CAT QUEUED): the cat's hunger, feeding, petting, run-away and the adoption call, pure rules, no DOM.
// Time is GAME minutes (gameMinutes(p) in gigs.js = (day-1)*1440 + routine minutes), passed in as nowMinutes. Nothing here reads a clock, so a tick is the same in many small steps or one big one.
// Saved shape: pets = {pet, offer:{status,at}, lostAt, lostName}; pet = {name,homeId,adoptedAt,fedAt,patAt,affection,warned,shared}. A pet that ran away is pet:null with lostAt set.
export const DAY_MINUTES=1440;
export const WEEK_MINUTES=7*DAY_MINUTES;
export const STARVE_AFTER=3*WEEK_MINUTES; // not fed for 3 game weeks: the cat runs away
export const WARN_AT=Object.freeze([WEEK_MINUTES,2*WEEK_MINUTES]); // 'looks hungry' at 1 week, 'is starving' at 2
export const PECKISH_AT=3*DAY_MINUTES; // from here the stage is 'peckish' and a meal is allowed (before: 'not hungry')
export const PET_COOLDOWN=60; // game minutes between pats
export const AFFECTION_MAX=100;
export const PAT_GAIN=5;
export const EAT_MINUTES=10; // the 'eat' animation after a meal
export const PURR_MINUTES=5; // the 'purr' animation after a pat
export const SLEEP_FROM=23*60,SLEEP_TO=6*60; // the cat sleeps 23:00-06:00 unless it is hungry
export const REOFFER_AFTER=3*DAY_MINUTES; // a declined offer may come again after this long
export const DEFAULT_NAME='Whiskers';
export const NAME_MAX=16;
export const MSG=Object.freeze({
 offer:'Congratulations on the new place! Would you like a cat to keep you company?',
 warn1:n=>`${n} looks hungry.`,
 warn2:n=>`${n} is starving. Feed ${n} soon.`,
 ranaway:'Your cat ran away to look for food.',
});
export const STAGES=Object.freeze(['fed','peckish','hungry','starving']);

const num=(v,lo,hi,d)=>Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d;
const cleanName=v=>{const s=typeof v==='string'?v.replace(/[^\p{L}\p{N} '-]/gu,'').trim().slice(0,NAME_MAX):'';return s||DEFAULT_NAME};
const cleanHome=v=>typeof v==='string'&&/^[\w.:-]{1,48}$/.test(v)?v:null;
const BIG=1e9;

export const fresh=()=>({pet:null,offer:{status:'none',at:null},lostAt:null,lostName:null});
// One pet record, junk-safe: finite clamped numbers, unknown fields dropped, missing ones defaulted. Returns null if there is no usable pet.
export function normalizePet(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const fedAt=num(raw.fedAt,-BIG,BIG,0);
 return {name:cleanName(raw.name),homeId:cleanHome(raw.homeId),adoptedAt:num(raw.adoptedAt,-BIG,BIG,fedAt),fedAt,patAt:num(raw.patAt,-BIG,BIG,-BIG),
  affection:num(raw.affection,0,AFFECTION_MAX,0),warned:Math.floor(num(raw.warned,0,2,0)),shared:false};
}
export function normalizePets(raw){
 const f=fresh();if(!raw||typeof raw!=='object')return f;
 const st=['none','declined','accepted'].includes(raw.offer?.status)?raw.offer.status:'none';
 const pet=normalizePet(raw.pet);
 return {pet,offer:{status:pet?'accepted':st,at:Number.isFinite(raw.offer?.at)?raw.offer.at:null},
  lostAt:Number.isFinite(raw.lostAt)?raw.lostAt:null,lostName:Number.isFinite(raw.lostAt)&&!pet?cleanName(raw.lostName):null};
}

// The adoption call: true when the phone should ring now. progress needs housing.rented or an owned property; pets is the saved state.
export const hasHome=progress=>!!progress&&(!!progress.housing?.rented||Object.keys(progress.properties||{}).length>0);
export function adoptionOffer(progress,pets,nowMinutes){
 const s=normalizePets(pets);
 if(!hasHome(progress)||s.pet||s.offer.status==='accepted')return false;
 if(s.offer.status==='declined')return s.offer.at!=null&&nowMinutes-s.offer.at>=REOFFER_AFTER;
 return s.offer.status==='none'&&s.lostAt==null;
}
export const declineOffer=(pets,nowMinutes)=>({...normalizePets(pets),offer:{status:'declined',at:nowMinutes}});
export function accept(pets,homeId,nowMinutes,name=DEFAULT_NAME){
 const s=normalizePets(pets);if(s.pet)return s; // one pet at a time
 const pet=normalizePet({name,homeId,adoptedAt:nowMinutes,fedAt:nowMinutes,patAt:-BIG,affection:0,warned:0});
 return {pet,offer:{status:'accepted',at:nowMinutes},lostAt:null,lostName:null};
}

// Hunger: 0 (just fed) to 1 (starved). A clock that goes backwards counts as 0 elapsed; it never feeds the cat or changes the record.
export const elapsedOf=(pet,now)=>pet&&Number.isFinite(now)?Math.max(0,now-pet.fedAt):0;
export function hungerOf(pet,now){
 const e=elapsedOf(pet,now);
 const stage=e>=WARN_AT[1]?'starving':e>=WARN_AT[0]?'hungry':e>=PECKISH_AT?'peckish':'fed';
 return {hunger:Math.min(1,e/STARVE_AFTER),stage,minutesLeft:Math.max(0,STARVE_AFTER-e)};
}
export function feed(pet,now){
 if(!pet)return {pet:null,ok:false,reason:'no-pet'};
 if(!Number.isFinite(now))return {pet,ok:false,reason:'bad-time'};
 if(now<pet.fedAt)return {pet,ok:false,reason:'not-hungry'}; // clock went back: never a free meal
 if(elapsedOf(pet,now)<PECKISH_AT)return {pet,ok:false,reason:'not-hungry'};
 return {pet:{...pet,fedAt:now,warned:0},ok:true,reason:'fed'};
}
export function pat(pet,now){
 if(!pet)return {pet:null,ok:false,reason:'no-pet',affection:0};
 if(!Number.isFinite(now)||(now>=pet.patAt&&now-pet.patAt<PET_COOLDOWN)||now<pet.patAt)return {pet,ok:false,reason:'cooldown',affection:pet.affection};
 const affection=Math.min(AFFECTION_MAX,pet.affection+PAT_GAIN);
 return {pet:{...pet,patAt:now,affection},ok:true,reason:'patted',affection};
}
// Advance by looking at the clock only (so step size never matters). Each warning fires once (pet.warned is saved); a long jump fires every missed event in order.
// Returns {pet (null once it has run away), events:[{type,text}], lostAt, lostName}.
export function tick(pet,now){
 const none={pet:pet||null,events:[],lostAt:null,lostName:null};
 if(!pet||!Number.isFinite(now))return none;
 const e=elapsedOf(pet,now),events=[];let warned=pet.warned;
 const names=['warn1','warn2'];
 for(let i=warned;i<2;i++)if(e>=WARN_AT[i]){events.push({type:names[i],text:MSG[names[i]](pet.name)});warned=i+1}
 if(e>=STARVE_AFTER){events.push({type:'ranaway',text:MSG.ranaway});return {pet:null,events,lostAt:pet.fedAt+STARVE_AFTER,lostName:pet.name}}
 return {pet:{...pet,warned},events,lostAt:null,lostName:null};
}
// Convenience for the whole saved state: tick, and record the loss when the cat runs away.
export function tickPets(pets,now){
 const s=normalizePets(pets),r=tick(s.pet,now);
 return {pets:r.pet||!s.pet?{...s,pet:r.pet}:{...s,pet:null,lostAt:r.lostAt,lostName:r.lostName},events:r.events};
}
export const rehome=(pet,homeId)=>pet?{...pet,homeId:cleanHome(homeId)||pet.homeId}:null;
export const rename=(pet,name)=>pet?{...pet,name:cleanName(name)}:null;

// Which animation to play: 'eat' just after a meal, 'purr' just after a pat, 'sleep' at night (a hungry cat stays up), 'walk' when hungry or in a regular daytime wander, else 'idle'.
export function moodOf(pet,now){
 if(!pet||!Number.isFinite(now))return 'idle';
 if(now>=pet.fedAt&&now-pet.fedAt<EAT_MINUTES&&pet.fedAt>pet.adoptedAt)return 'eat';
 if(now>=pet.patAt&&now-pet.patAt<PURR_MINUTES)return 'purr';
 const st=hungerOf(pet,now).stage,tod=((now%DAY_MINUTES)+DAY_MINUTES)%DAY_MINUTES;
 if(st==='hungry'||st==='starving')return 'walk';
 if(tod>=SLEEP_FROM||tod<SLEEP_TO)return 'sleep';
 return Math.floor(tod/30)%3===0?'walk':'idle';
}