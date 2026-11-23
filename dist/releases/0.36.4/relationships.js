// Relationships and romance meter rules (notes/relationship-system-design.md): pure functions, zero DOM/THREE/globals/clock/random.
import {byId as rosterById} from './npc-roster.js';
import {STANDING_MAX,tierOfStanding,gainStanding} from './npc-life.js';
import {npcStandingOf,chatCrowdNpc,giveNpcGift,GIFT_ITEMS} from './npc-relations.js';
import {normalizeInventory,countItem} from './inventory.js';
import {itemById} from './items.js';

export const FRIENDSHIP_MAX=100;
export const ROMANCE_MAX=100;
export const GEMMA_ID='gemma';
export const ROMANCE_UNLOCK_FRIENDSHIP=20;
export const DATE_REQ=Object.freeze({friendship:35,romance:40});
export const PARTNER_REQ=Object.freeze({friendship:50,romance:70});
export const HANGOUT_COST_CENTS=250;

export const DAILY_CAPS=Object.freeze({
 chatFriendship:2,
 purchaseFriendship:1,
 romanceGiftPerDay:1,
 complimentFriendship:1,
 complimentRomance:4,
 hangoutFriendship:3,
 hangoutRomance:8
});

export const FRIENDSHIP_TIERS=Object.freeze([
 Object.freeze({id:'stranger',label:'Stranger',min:0}),
 Object.freeze({id:'acquaintance',label:'Acquaintance',min:5}),
 Object.freeze({id:'friend',label:'Friend',min:20}),
 Object.freeze({id:'close',label:'Close Friend',min:50}),
 Object.freeze({id:'best',label:'Best Friend',min:80})
]);

export const ROMANCE_TIERS=Object.freeze([
 Object.freeze({id:'spark',label:'Warm Spark',min:0}),
 Object.freeze({id:'crush',label:'Crush',min:15}),
 Object.freeze({id:'dating',label:'Dating',min:40}),
 Object.freeze({id:'partner',label:'Partner',min:70})
]);

export const GEMMA_PROFILE=Object.freeze({
 id:GEMMA_ID,
 name:'Gemma Atkins',
 role:'Head Baker (Ironwood Bakery)',
 work:'Ironwood Bakery',
 home:'Ironwood',
 gender:'female',
 romanceBodies:Object.freeze(['male']),
 lovedGifts:Object.freeze(['bouquet','coffee','apple','flour-bag','eggs']),
 hint:'Talk with her at Ironwood Bakery, bring a bouquet or coffee, and once you are Friends (20+) warm sparks can grow for a male player.'
});

export const SPECIAL_NPCS=Object.freeze({[GEMMA_ID]:GEMMA_PROFILE});

const int=(v,lo,hi,d=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const safeKey=k=>typeof k==='string'&&k.length>0&&k.length<=48&&k!=='__proto__'&&k!=='constructor'&&k!=='prototype';
const VALID_STATUS=new Set(['none','dating','partner']);

function takeOneItem(progress,itemId){
 const inv=normalizeInventory(progress?.inventory);
 const idx=inv.slots.findIndex(s=>s.id===itemId&&s.quantity>0);
 if(idx<0)return {error:'You do not have that item.'};
 const slots=inv.slots.map((s,i)=>i===idx?{...s,quantity:s.quantity-1}:s).filter(s=>s.quantity>0);
 return {state:{...progress,inventory:{...inv,slots}}};
}

export function normalizeRelationships(raw){
 const out={};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
 for(const k of Object.keys(raw)){
  if(!safeKey(k))continue;
  const e=raw[k];
  if(!e||typeof e!=='object'||Array.isArray(e))continue;
  const status=VALID_STATUS.has(e.status)?e.status:'none';
  out[k]={
   met:e.met===true,
   points:int(e.points,0,FRIENDSHIP_MAX,0),
   romance:int(e.romance,0,ROMANCE_MAX,0),
   status,
   chatDay:int(e.chatDay,-1,1e9,-1),
   giftDay:int(e.giftDay,-1,1e9,-1),
   hangoutDay:int(e.hangoutDay,-1,1e9,-1),
   complimentDay:int(e.complimentDay,-1,1e9,-1),
   shopDay:int(e.shopDay,-1,1e9,-1),
   perkDay:int(e.perkDay,-1,1e9,-1)
  };
 }
 return out;
}

const emptyRel=()=>({met:false,points:0,romance:0,status:'none',chatDay:-1,giftDay:-1,hangoutDay:-1,complimentDay:-1,shopDay:-1,perkDay:-1});

export function friendshipTierOf(points){
 const p=clamp(Math.round(Number.isFinite(points)?points:0),0,FRIENDSHIP_MAX);
 let idx=0;
 for(let i=0;i<FRIENDSHIP_TIERS.length;i++)if(p>=FRIENDSHIP_TIERS[i].min)idx=i;
 const cur=FRIENDSHIP_TIERS[idx],next=FRIENDSHIP_TIERS[idx+1]||null;
 return {
  id:cur.id,
  label:cur.label,
  min:cur.min,
  nextMin:next?next.min:null,
  nextLabel:next?next.label:null,
  pct:Math.round((p/FRIENDSHIP_MAX)*100)
 };
}

export function romanceTierOf(romance,status='none'){
 const r=clamp(Math.round(Number.isFinite(romance)?romance:0),0,ROMANCE_MAX);
 let idx=r>=15?1:0;
 if(status==='dating'&&idx<2)idx=2;
 if(status==='partner')idx=3;
 const cur=ROMANCE_TIERS[idx],next=ROMANCE_TIERS[idx+1]||null;
 return {
  id:cur.id,
  label:cur.label,
  min:cur.min,
  nextMin:next?next.min:null,
  nextLabel:next?next.label:null,
  pct:Math.round((r/ROMANCE_MAX)*100)
 };
}

export function canRomanceNpc(npcId,playerBody='male'){
 const prof=SPECIAL_NPCS[npcId];
 return !!prof&&prof.romanceBodies.includes(playerBody);
}

const personIdOf=npcOrId=>typeof npcOrId==='string'?npcOrId:String(npcOrId?.id||'');

export function relationshipOf(progress,npcIdOrPerson,playerBody='male',day=null){
 const id=personIdOf(npcIdOrPerson);
 const special=SPECIAL_NPCS[id]||null;
 const roster=rosterById(id);
 const stored=normalizeRelationships(progress?.relationships)[id]||emptyRel();
 const rawPoints=special?stored.points:npcStandingOf(progress,npcIdOrPerson);
 const points=clamp(rawPoints,0,FRIENDSHIP_MAX);
 const ft=friendshipTierOf(points);
 const romanceEligible=canRomanceNpc(id,playerBody);
 const romanceUnlocked=romanceEligible&&points>=ROMANCE_UNLOCK_FRIENDSHIP;
 const romance=romanceEligible?clamp(stored.romance,0,ROMANCE_MAX):0;
 const rt=romanceTierOf(romance,stored.status);
 const d=Number.isFinite(day)?Math.floor(day):int(progress?.housing?.day,1,1e9,1);
 const status=romanceEligible?stored.status:'none';
 const statusLabel=status==='partner'?'Partner':status==='dating'?'Dating':rt.label;
 const canAskDate=romanceUnlocked&&status==='none'&&points>=DATE_REQ.friendship&&romance>=DATE_REQ.romance;
 const canAskPartner=romanceUnlocked&&status==='dating'&&points>=PARTNER_REQ.friendship&&romance>=PARTNER_REQ.romance;
 const perkAvailable=romanceEligible&&status==='partner'&&stored.perkDay!==d;
 const name=special?special.name:roster?roster.name:(typeof npcIdOrPerson==='object'&&npcIdOrPerson?.name?npcIdOrPerson.name:id);
 const role=special?special.role:roster?roster.role:(typeof npcIdOrPerson==='object'&&npcIdOrPerson?.role?npcIdOrPerson.role:'Resident');
 const pointsToNext=ft.nextMin!==null?Math.max(0,ft.nextMin-points):0;
 let nextMilestone='';
 if(special){
  if(points<ROMANCE_UNLOCK_FRIENDSHIP)nextMilestone=`Reach Friend (${ROMANCE_UNLOCK_FRIENDSHIP}) through chats, bakery orders, or gifts.`;
  else if(romanceEligible&&status==='none')nextMilestone=`Dating unlocks at ${DATE_REQ.friendship} Friendship & ${DATE_REQ.romance} Romance.`;
  else if(romanceEligible&&status==='dating')nextMilestone=`Partner unlocks at ${PARTNER_REQ.friendship} Friendship & ${PARTNER_REQ.romance} Romance.`;
  else if(status==='partner')nextMilestone='Partners — stop by anytime for a free pastry & coffee.';
  else nextMilestone=ft.nextLabel?`Next tier: ${ft.nextLabel} at ${ft.nextMin} Friendship.`:'Best Friends for life in Ironwood!';
 }else{
  nextMilestone=ft.nextLabel?`Next tier: ${ft.nextLabel} (${pointsToNext} pts away).`:'Maximum bond reached.';
 }
 return {
  id,
  name,
  role,
  points,
  friendPct:ft.pct,
  tier:ft.id,
  tierLabel:ft.label,
  nextTierLabel:ft.nextLabel,
  pointsToNext,
  romanceEligible,
  romanceUnlocked,
  romance,
  romancePct:rt.pct,
  romanceTier:rt.id,
  romanceLabel:rt.label,
  status,
  statusLabel,
  met:special?stored.met:(roster?(progress?.npcs?.[roster.id]?.metDay??-1)>=0:points>0),
  talkedToday:stored.chatDay===d,
  giftedToday:stored.giftDay===d,
  hangoutToday:stored.hangoutDay===d,
  complimentToday:stored.complimentDay===d,
  canAskDate,
  canAskPartner,
  perkAvailable,
  likedGifts:special?special.lovedGifts:Object.freeze([]),
  nextMilestone
 };
}

function saveRelEntry(progress,id,entry){
 const all=normalizeRelationships(progress?.relationships);
 all[id]=entry;
 return {...progress,relationships:all};
}

export function meetRelationship(progress,npcId,day=1){
 if(!safeKey(npcId))return progress;
 const all=normalizeRelationships(progress?.relationships);
 const cur=all[npcId]||emptyRel();
 if(cur.met)return progress;
 return saveRelEntry(progress,npcId,{...cur,met:true});
}

export function recordShopPurchaseBond(progress,npcId,day=1){
 if(!safeKey(npcId))return {state:progress,gained:0};
 const d=int(day,0,1e9,1),all=normalizeRelationships(progress?.relationships),cur=all[npcId]||emptyRel();
 if(cur.shopDay===d)return {state:{...progress},gained:0};
 const pts=clamp(cur.points+DAILY_CAPS.purchaseFriendship,0,FRIENDSHIP_MAX);
 const next=saveRelEntry(progress,npcId,{...cur,met:true,points:pts,shopDay:d});
 return {state:next,gained:pts-cur.points};
}

export function recordFriendlyChat(progress,npcIdOrPerson,day=1,playerBody='male'){
 const id=personIdOf(npcIdOrPerson);
 if(!safeKey(id))return {state:progress,gained:0,line:'Good talking with you.',rel:relationshipOf(progress,id,playerBody,day)};
 const d=int(day,0,1e9,1);
 if(SPECIAL_NPCS[id]){
  const all=normalizeRelationships(progress?.relationships),cur=all[id]||emptyRel();
  const gained=cur.chatDay===d?0:Math.min(DAILY_CAPS.chatFriendship,FRIENDSHIP_MAX-cur.points);
  const nextEntry={...cur,met:true,points:cur.points+gained,chatDay:d};
  const next=saveRelEntry(progress,id,nextEntry);
  const rel=relationshipOf(next,id,playerBody,d);
  const line=gained>0
   ?(rel.status==='partner'?'Honestly, seeing you walk through that bakery door is the best part of my shift.':rel.status==='dating'?'Saved a warm swirl bun on the rack just in case you stopped by today!':rel.points>=ROMANCE_UNLOCK_FRIENDSHIP?'Always good catching up between loaves—the bakery feels livelier when you stop in.':'Nothing beats the smell of fresh sourdough at dawn. Glad you stopped by!')
   :(rel.status==='partner'?'Still smiling from earlier—stay warm out there, okay?':'Always happy to chat when you have a spare minute!');
  return {state:next,gained,line,rel};
 }
 const r=chatCrowdNpc(progress,npcIdOrPerson,d);
 return {state:r.state,gained:r.gained,line:r.gained?'Nice catching up with you!':'Good seeing you again today!',rel:relationshipOf(r.state,npcIdOrPerson,playerBody,d)};
}

function gemmaGiftReaction(itemId){
 if(itemId==='bouquet')return {f:8,r:10,line:'Oh—fresh blooms? You have no idea how much that brightens up the bakery counter. Thank you!'};
 if(itemId==='coffee')return {f:6,r:6,line:'You brought me a hot cup mid-shift?! You are officially my favorite person today.'};
 if(itemId==='flour-bag'||itemId==='eggs'||itemId==='apple')return {f:5,r:4,line:'Real baking ingredients! Already picturing cinnamon apple galettes—thank you so much.'};
 if(itemId==='bread-loaf')return {f:2,r:1,line:'Ha, bringing bread to a baker? Wait—this smells great, thank you!'};
 return {f:3,r:2,line:'That is genuinely thoughtful of you—thank you!'};
}

export function recordRelationshipGift(progress,npcIdOrPerson,itemId,day=1,playerBody='male'){
 const id=personIdOf(npcIdOrPerson);
 if(!safeKey(id))return {error:'Unknown person.'};
 if(!SPECIAL_NPCS[id]){
  const res=giveNpcGift(progress,npcIdOrPerson,itemId,day);
  if(res.error)return res;
  return {state:res.state,friendshipDelta:res.delta,romanceDelta:0,line:res.line,rel:relationshipOf(res.state,npcIdOrPerson,playerBody,day)};
 }
 if(!itemById(itemId)||countItem(progress,itemId)<1)return {error:'You do not have that item to give.'};
 const taken=takeOneItem(progress,itemId);
 if(taken.error)return taken;
 const d=int(day,0,1e9,1);
 const cur=normalizeRelationships(taken.state.relationships)[id]||emptyRel();
 const rx=gemmaGiftReaction(itemId);
 const nextF=clamp(cur.points+rx.f,0,FRIENDSHIP_MAX);
 const canRom=canRomanceNpc(id,playerBody)&&cur.giftDay!==d&&nextF>=ROMANCE_UNLOCK_FRIENDSHIP;
 const rGain=canRom?rx.r:0;
 const nextR=clamp(cur.romance+rGain,0,ROMANCE_MAX);
 const next=saveRelEntry(taken.state,id,{...cur,met:true,points:nextF,romance:nextR,giftDay:canRom?d:cur.giftDay});
 return {state:next,friendshipDelta:nextF-cur.points,romanceDelta:nextR-cur.romance,line:rx.line,rel:relationshipOf(next,id,playerBody,d)};
}

export function recordRomanticAction(progress,npcId,actionId,day=1,playerBody='male'){
 if(!SPECIAL_NPCS[npcId])return {error:'Unavailable.'};
 const d=int(day,0,1e9,1);
 const cur=normalizeRelationships(progress?.relationships)[npcId]||emptyRel();
 const rel=relationshipOf(progress,npcId,playerBody,d);
 if(actionId==='bakery-perk'){
  if(!rel.romanceEligible||cur.status!=='partner')return {error:'Partner treat unlocks once you are partners with Gemma.'};
  if(cur.perkDay===d)return {error:'You already shared today\'s baker\'s treat!'};
  const next=saveRelEntry(progress,npcId,{...cur,met:true,perkDay:d});
  const l=next.life||{food:100,thirst:100,energy:100};
  const life={...l,food:clamp((l.food??100)+25,0,100),thirst:clamp((l.thirst??100)+20,0,100),energy:clamp((l.energy??100)+20,0,100)};
  return {state:{...next,life},costCents:0,warmBoost:18,energyBoost:20,line:'Made a honey croissant and caramel latte just for you—on the house, always.',rel:relationshipOf({...next,life},npcId,playerBody,d)};
 }
 if(!canRomanceNpc(npcId,playerBody))return {error:'Romance progression is only available here for a male player.'};
 if(cur.points<ROMANCE_UNLOCK_FRIENDSHIP)return {error:`Become Friends (${ROMANCE_UNLOCK_FRIENDSHIP} Friendship) first.`};

 if(actionId==='compliment'){
  if(cur.complimentDay===d)return {error:'You already gave Gemma a heartfelt compliment today.'};
  const nextF=clamp(cur.points+DAILY_CAPS.complimentFriendship,0,FRIENDSHIP_MAX);
  const nextR=clamp(cur.romance+DAILY_CAPS.complimentRomance,0,ROMANCE_MAX);
  const next=saveRelEntry(progress,npcId,{...cur,met:true,points:nextF,romance:nextR,complimentDay:d});
  const lines=['Gemma grins behind the flour dust on her apron. "Careful, keep talking like that and I will burn the sourdough."','Gemma tucks a loose curl behind her ear, smiling softly. "You really notice the little things, don\'t you?"'];
  return {state:next,costCents:0,line:lines[cur.romance%lines.length],rel:relationshipOf(next,npcId,playerBody,d)};
 }

 if(actionId==='hangout'){
  if(cur.hangoutDay===d)return {error:'You already shared coffee together today.'};
  const free=cur.status==='dating'||cur.status==='partner';
  const cost=free?0:HANGOUT_COST_CENTS;
  if((progress?.cash||0)<cost)return {error:'You need $2.50 for two coffees.'};
  const nextF=clamp(cur.points+DAILY_CAPS.hangoutFriendship,0,FRIENDSHIP_MAX);
  const nextR=clamp(cur.romance+DAILY_CAPS.hangoutRomance,0,ROMANCE_MAX);
  const l=progress?.life||{food:100,thirst:100,energy:100};
  const withCash={...progress,cash:(progress?.cash||0)-cost,life:{...l,energy:clamp((l.energy??100)+10,0,100),thirst:clamp((l.thirst??100)+15,0,100)}};
  const next=saveRelEntry(withCash,npcId,{...cur,met:true,points:nextF,romance:nextR,hangoutDay:d});
  return {state:next,costCents:cost,energyBoost:10,warmBoost:14,line:'You pull up two stools by the warm ovens and linger over coffee and cinnamon knots.',rel:relationshipOf(next,npcId,playerBody,d)};
 }

 if(actionId==='ask-date'){
  if(cur.status!=='none')return {error:'You and Gemma are already together!'};
  if(cur.points<DATE_REQ.friendship||cur.romance<DATE_REQ.romance)return {error:`Needs ${DATE_REQ.friendship} Friendship and ${DATE_REQ.romance} Romance first.`};
  const nextF=clamp(cur.points+4,0,FRIENDSHIP_MAX),nextR=clamp(cur.romance+6,0,ROMANCE_MAX);
  const next=saveRelEntry(progress,npcId,{...cur,met:true,points:nextF,romance:nextR,status:'dating'});
  return {state:next,costCents:0,line:'Gemma\'s face lights up. "I thought you would never ask! After closing, let\'s walk by the square."',rel:relationshipOf(next,npcId,playerBody,d)};
 }

 if(actionId==='ask-partner'){
  if(cur.status==='partner')return {error:'Gemma is already your partner.'};
  if(cur.status!=='dating')return {error:'Start dating Gemma first.'};
  if(cur.points<PARTNER_REQ.friendship||cur.romance<PARTNER_REQ.romance)return {error:`Needs ${PARTNER_REQ.friendship} Friendship and ${PARTNER_REQ.romance} Romance first.`};
  const nextF=clamp(cur.points+5,0,FRIENDSHIP_MAX),nextR=clamp(cur.romance+8,0,ROMANCE_MAX);
  const next=saveRelEntry(progress,npcId,{...cur,met:true,points:nextF,romance:nextR,status:'partner'});
  return {state:next,costCents:0,line:'Gemma squeezes your hand across the oak counter. "Partners, then—here in Ironwood and everywhere else."',rel:relationshipOf(next,npcId,playerBody,d)};
 }

 return {error:'Unknown action.'};
}

export function gemmaGreeting(rel,playerBody='male'){
 if(!rel?.met)return 'Welcome to Ironwood Bakery! I am Gemma Atkins—everything in the cases just came out of the oven.';
 if(rel.status==='partner')return 'Hey, favorite customer—and favorite partner. Need a warm loaf or just a break with me?';
 if(rel.status==='dating')return 'There you are! Fresh croissants just cooled—glad you stopped in.';
 if(rel.romanceUnlocked&&rel.romance>=15)return 'Hey, look who came by! Just pulled honey loaves from the deck oven.';
 if(rel.points>=ROMANCE_UNLOCK_FRIENDSHIP)return 'Good to see you, friend! The cinnamon loaves are still warm.';
 return 'Morning! Fresh loaves, baking flour, and hot coffee at Ironwood Bakery.';
}

export function relationshipMeterSpec(rel){
 if(!rel)return null;
 const friendPct=clamp(Math.round((rel.points/FRIENDSHIP_MAX)*100),0,100);
 const friendTone=rel.points>=50?'high':rel.points>=20?'mid':'low';
 return {
  friendPct,
  friendLabel:rel.tierLabel,
  friendText:`${rel.tierLabel} · ${rel.points}/${FRIENDSHIP_MAX}`,
  friendTone,
  romanceUnlocked:!!rel.romanceUnlocked,
  romancePct:rel.romanceUnlocked?clamp(Math.round((rel.romance/ROMANCE_MAX)*100),0,100):0,
  romanceLabel:rel.statusLabel,
  romanceText:rel.romanceUnlocked?`♥ ${rel.statusLabel} · ${rel.romance}/${ROMANCE_MAX}`:'',
  statusLabel:rel.statusLabel
 };
}

export {GIFT_ITEMS};
