// Unified NPC standing, gifting preferences, discounts, and personal favors across all townspeople (Phase A).
import {STANDING_MAX,MOOD_MIN,MOOD_MAX,tierOfStanding,gainStanding,isSick} from './npc-life.js';
import {byId as rosterById} from './npc-roster.js';
import {normalizeInventory,countItem} from './inventory.js';
import {itemById} from './items.js';

function takeOne(progress,itemId){
 const inv=normalizeInventory(progress?.inventory);
 const idx=inv.slots.findIndex(s=>s.id===itemId&&s.quantity>0);
 if(idx<0)return {error:'You do not have that item.'};
 const slots=inv.slots.map((s,i)=>i===idx?{...s,quantity:s.quantity-1}:s).filter(s=>s.quantity>0);
 return {state:{...progress,inventory:{...inv,slots}}};
}

export const GIFT_ITEMS=Object.freeze(['bouquet','coffee','bread-loaf','sandwich','soup','energy-drink','apple','cat-food','repair-kit','gas-can']);
export const TIER_DISCOUNT=Object.freeze({stranger:1,acquaintance:.95,friend:.9,close:.85});

export const FAVOR_TEMPLATES=Object.freeze([
 Object.freeze({id:'fav-coffee',item:'coffee',label:'Bring a fresh Coffee',ask:'Could you grab me a hot coffee when you pass Alder Coffee & Diner?',reward:1200,standing:4}),
 Object.freeze({id:'fav-bread',item:'bread-loaf',label:'Bring a Bread Loaf',ask:'I am short on time—could you pick up a fresh bread loaf from the bakery or market?',reward:1300,standing:4}),
 Object.freeze({id:'fav-bouquet',item:'bouquet',label:'Bring a Fresh Bouquet',ask:'It is a special day at home—could you bring a fresh bouquet from Ironwood Florist?',reward:2200,standing:5}),
 Object.freeze({id:'fav-energy',item:'energy-drink',label:'Bring an Energy Drink',ask:'Long shift ahead! Could you bring me an energy drink?',reward:1200,standing:4}),
 Object.freeze({id:'fav-soup',item:'soup',label:'Bring hot Soup',ask:'Could you bring me a warm bowl of soup? It would really help today.',reward:1500,standing:4}),
 Object.freeze({id:'fav-repair',item:'repair-kit',label:'Bring a Repair Kit',ask:'Something here needs a quick fix—could you pick up a repair kit from Alder Hardware?',reward:5000,standing:5})
]);

const int=(v,lo,hi,d=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const safeKey=k=>typeof k==='string'&&k.length>0&&k.length<=48&&k!=='__proto__'&&k!=='constructor'&&k!=='prototype';
const hash=(...parts)=>{let h=2166136261;for(const ch of parts.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return h>>>0};

export function normalizeCrowdLife(raw){
 const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
 for(const k of Object.keys(raw)){
  if(!safeKey(k))continue;const e=raw[k];if(!e||typeof e!=='object'||Array.isArray(e))continue;
  const fav=e.favor&&typeof e.favor==='object'&&typeof e.favor.id==='string'?{id:e.favor.id,day:int(e.favor.day,0,1e9,0)}:null;
  out[k]={points:int(e.points,0,STANDING_MAX,0),mood:int(e.mood,MOOD_MIN,MOOD_MAX,55),chatDay:int(e.chatDay,-1,1e9,-1),giftDay:int(e.giftDay,-1,1e9,-1),lastFavorDay:int(e.lastFavorDay,-1,1e9,-1),...(fav?{favor:fav}:{})};
 }
 return out;
}

const keyOf=personOrId=>typeof personOrId==='string'?personOrId:String(personOrId?.id||'');
const rosterFor=personOrId=>{const k=keyOf(personOrId);return rosterById(k)||(personOrId?.personId?rosterById(personOrId.personId):null)};

export function npcStandingOf(progress,personOrId){
 const k=keyOf(personOrId),r=rosterFor(personOrId);
 if(r)return progress?.standing?.people?.[r.id]?.points||0;
 return progress?.crowdLife?.[k]?.points||0;
}

export function npcTierOf(progress,personOrId){
 return tierOfStanding(npcStandingOf(progress,personOrId));
}

export const discountFor=points=>TIER_DISCOUNT[tierOfStanding(points)]??1;

export function giftReaction(person,itemId){
 const role=String(person?.role||person?.post||'').toLowerCase(),id=keyOf(person).toLowerCase();
 if(itemId==='cat-food')return (id==='brentster'||role.includes('cat'))?{delta:6,mood:10,line:'For Junior? You really remembered—thank you!'}:{delta:1,mood:2,line:'Oh, cat food? That is thoughtful, thanks.'};
 if(itemId==='bouquet')return {delta:5,mood:8,line:'Fresh flowers! That genuinely made my day.'};
 if(itemId==='repair-kit'||itemId==='gas-can')return (id==='oscar'||/hardware|mechanic|timber|driver|foreman|clerk/.test(role))?{delta:5,mood:7,line:'Now that is actually useful. Much appreciated.'}:{delta:2,mood:3,line:'Thanks, I can put this in the closet for later.'};
 if(itemId==='coffee'||itemId==='energy-drink')return /server|barista|attendant|editor|officer|nurse|receptionist|clerk|baker/.test(role)?{delta:4,mood:6,line:'Just what I needed for this shift—thank you!'}:{delta:3,mood:5,line:'Thanks! Nothing beats a pick-me-up.'};
 if(itemId==='bread-loaf'||itemId==='sandwich'||itemId==='soup'||itemId==='apple')return {delta:3,mood:5,line:'Looks delicious—thank you so much!'};
 return {delta:2,mood:3,line:'Thank you, that is kind of you!'};
}

export function giveNpcGift(progress,person,itemId,day=1){
 const k=keyOf(person);if(!k||!safeKey(k))return {error:'Unknown person.'};
 if(!itemById(itemId)||countItem(progress,itemId)<1)return {error:'You do not have that item to give.'};
 const invRes=takeOne(progress,itemId);if(invRes.error)return {error:invRes.error};
 let next=invRes.state;const d=int(day,0,1e9,1),rx=giftReaction(person,itemId),r=rosterFor(person);
 if(r){
  const cur=next.standing?.people?.[r.id]||{points:0,gainDay:-1,gainToday:0};
  const points=Math.min(STANDING_MAX,cur.points+rx.delta);
  const npc=next.npcs?.[r.id];
  next={...next,standing:{...(next.standing||{}),people:{...(next.standing?.people||{}),[r.id]:{...cur,points}}},npcs:npc?{...next.npcs,[r.id]:{...npc,mood:Math.min(MOOD_MAX,npc.mood+rx.mood)}}:next.npcs};
  return {state:next,points,tier:tierOfStanding(points),delta:rx.delta,line:rx.line};
 }
 const cl=normalizeCrowdLife(next.crowdLife),e=cl[k]||{points:0,mood:55,chatDay:-1,giftDay:-1,lastFavorDay:-1};
 const points=Math.min(STANDING_MAX,e.points+rx.delta);
 cl[k]={...e,points,mood:Math.min(MOOD_MAX,e.mood+rx.mood),giftDay:d};
 next={...next,crowdLife:cl};
 return {state:next,points,tier:tierOfStanding(points),delta:rx.delta,line:rx.line};
}

export function chatCrowdNpc(progress,person,day=1){
 const k=keyOf(person);if(!k||!safeKey(k))return {state:progress,gained:0};
 const d=int(day,0,1e9,1),cl=normalizeCrowdLife(progress?.crowdLife),e=cl[k]||{points:0,mood:55,chatDay:-1,giftDay:-1,lastFavorDay:-1};
 if(e.chatDay===d)return {state:progress,gained:0,points:e.points,tier:tierOfStanding(e.points)};
 const points=Math.min(STANDING_MAX,e.points+1);
 cl[k]={...e,points,mood:Math.min(MOOD_MAX,e.mood+2),chatDay:d};
 return {state:{...progress,crowdLife:cl,standing:{...(progress?.standing||{}),town:(progress?.standing?.town||0)+1}},gained:1,points,tier:tierOfStanding(points)};
}

export function activeFavorOf(progress,person){
 const k=keyOf(person),cl=normalizeCrowdLife(progress?.crowdLife),fav=cl[k]?.favor;
 if(!fav)return null;
 return FAVOR_TEMPLATES.find(t=>t.id===fav.id)||null;
}

export function offerFavor(progress,person,day=1){
 const k=keyOf(person);if(!k||!safeKey(k))return {state:progress,favor:null};
 const d=int(day,0,1e9,1),cl=normalizeCrowdLife(progress?.crowdLife),e=cl[k]||{points:0,mood:55,chatDay:-1,giftDay:-1,lastFavorDay:-1};
 if(e.favor){const tpl=FAVOR_TEMPLATES.find(t=>t.id===e.favor.id);if(tpl)return {state:progress,favor:tpl}}
 if(e.lastFavorDay===d)return {state:progress,favor:null};
 const tpl=FAVOR_TEMPLATES[hash(k,d,'favor')%FAVOR_TEMPLATES.length];
 cl[k]={...e,favor:{id:tpl.id,day:d}};
 return {state:{...progress,crowdLife:cl},favor:tpl};
}

export function completeFavor(progress,person,day=1){
 const k=keyOf(person);if(!k||!safeKey(k))return {error:'Unknown person.'};
 const tpl=activeFavorOf(progress,person);if(!tpl)return {error:'No active favor for this person.'};
 if(countItem(progress,tpl.item)<1)return {error:`Need 1 ${itemById(tpl.item)?.name||tpl.item} to complete this favor.`};
 const invRes=takeOne(progress,tpl.item);if(invRes.error)return {error:invRes.error};
 const d=int(day,0,1e9,1);let next=invRes.state;
 const cl=normalizeCrowdLife(next.crowdLife),e=cl[k]||{points:0,mood:55,chatDay:-1,giftDay:-1,lastFavorDay:-1};
 const points=Math.min(STANDING_MAX,e.points+tpl.standing);
 const {favor:_drop,...rest}=e;
 cl[k]={...rest,points,mood:Math.min(MOOD_MAX,e.mood+10),lastFavorDay:d};
 next={...next,cash:(next.cash||0)+tpl.reward,crowdLife:cl,standing:{...(next.standing||{}),town:(next.standing?.town||0)+1}};
 const r=rosterFor(person);
 if(r){next={...next,standing:gainStanding(next.standing,r.id,tpl.standing,d)}}
 return {state:next,favor:tpl,reward:tpl.reward,points,tier:tierOfStanding(points)};
}

// Schedule-linked patrons inside open Ironwood venues (off-shift residents & sick visitors at the clinic).
export function venuePatrons({propertyId,day=1,minute=720,people=[],planOf=null,npcs=null,max=2}={}){
 if(!propertyId||!Array.isArray(people)||!people.length)return [];
 const d=int(day,0,1e9,1),m=((int(minute,-1e9,1e9,720)%1440)+1440)%1440,place='property:'+propertyId;
 const out=[];
 for(const p of people){
  if(!p?.id||p.work===place||!p.resident)continue;
  const r=rosterById(p.id),sick=r&&npcs?.[r.id]?isSick(npcs[r.id],d):false;
  if(propertyId==='ironwood-clinic'&&sick&&m>=480&&m<1080){out.push({person:p,why:'visiting the clinic today (under the weather)'});continue}
  const plan=typeof planOf==='function'?planOf(p.id,d):null;
  const b=Array.isArray(plan)?plan.find(x=>m>=x.from&&m<x.to):null;
  if(!b)continue;
  const leisure=(propertyId==='ironwood-arcade'||propertyId==='alder-cinema')&&m>=1020&&m<1350&&b.act==='home';
  if(b.act==='shop'||b.act==='outside'||leisure){
   if(hash(propertyId,p.id,d,Math.floor(m/60))%7===0)out.push({person:p,why:leisure?'unwinding after a long day':'stopping by while running errands'});
  }
 }
 return out.slice(0,max);
}
