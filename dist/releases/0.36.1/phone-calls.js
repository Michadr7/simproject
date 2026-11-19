// PH1: the phone's Call app (pure rules, tested; phone-call.js draws it, audio.js plays the sounds). Contacts are data: id, name, kind, number, a handler id and an availability rule. dial() says what happens when you call one.
// Handlers: 'tow' (the real tow service: busy unless you are in a vehicle, then you pick which of yours to tow), 'shop' (the Eastbank workshop: tells you to visit), 'line' (a placeholder business: a fixed line in its hours, otherwise no answer; later stages wire jobs here).
// No imports on purpose (audio.js and vehicle-sounds.js import PHONE_CLIPS from here).
export const PHONE_CLIPS=Object.freeze(['phone-key','phone-pickup','phone-ring','phone-busy','phone-hangup']); // mono Ogg in dist/assets/sounds/ (ASSETS.md); audio.phone() takes the part after 'phone-'
export const BUSY_LINE='Line busy',NO_ANSWER_LINE='No answer.';
// hours: [opens, closes) in game minutes, or null for always. rings: seconds of ringing before the answer (1 to 2).
export const CONTACTS=Object.freeze([
 {id:'tow',name:'Tow service',kind:'service',number:'555-0100',handler:'tow',hours:null,rings:1.6},
 {id:'repair',name:'Eastbank Workshop',kind:'business',number:'555-0142',handler:'shop',hours:null,rings:1.2,say:'Eastbank Workshop. We fix vehicles at the service bay by the yard: bring it in (or have it towed here) and the counter will quote you on the spot. We do not take repairs over the phone.'},
 {id:'bakery',name:'Alder Bakery',kind:'business',number:'555-0117',handler:'line',hours:[330,840],rings:1.4,say:'Alder Bakery. Fresh bread most mornings. Come by before lunch.'},
 {id:'pharmacy',name:'Alder Pharmacy',kind:'business',number:'555-0123',handler:'line',hours:[480,1080],rings:1.8,say:'Alder Pharmacy. Nothing to order by phone yet. Drop in.'},
 {id:'riden',name:'Riden Deals',kind:'business',number:'555-0188',handler:'line',hours:[540,1080],rings:1.5,say:'Riden Deals vehicles. Come to the lot to see what we have.'},
 {id:'ridgeline',name:'Ridgeline Timber',kind:'business',number:'555-0165',handler:'line',hours:[360,1080],rings:1.7,say:'Ridgeline Timber. No work to hand out by phone today.'}
]);
export const contactById=id=>CONTACTS.find(c=>c.id===id)||null;
export const KIND_LABEL=Object.freeze({service:'Services',business:'Businesses',person:'People'});
export const isOpen=(c,minutes)=>!c.hours||(minutes>=c.hours[0]&&minutes<c.hours[1]);
// The tow line's one rule (the user's words: "if you are not in a vehicle, the line will be busy"): you must be in a vehicle (driving one) to get through.
export const towLineOpen=({inVehicle})=>!!inVehicle;
// What happens when you call. ctx: {inVehicle: bool, minutes: game minutes of the day}. Returns {contact, outcome: 'answered'|'busy'|'no-answer', line, ringSeconds, pick: bool (the tow service asks which vehicle)}.
export function dial(contactOrId,ctx={}){
 const c=typeof contactOrId==='string'?contactById(contactOrId):contactOrId;
 if(!c)return {contact:null,outcome:'no-answer',line:'That number is not in service.',ringSeconds:1,pick:false};
 const ringSeconds=Math.min(2,Math.max(1,c.rings||1.5)),base={contact:c,ringSeconds,pick:false};
 if(c.handler==='tow'){
  if(!towLineOpen(ctx))return {...base,outcome:'busy',line:BUSY_LINE,ringSeconds:0};
  return {...base,outcome:'answered',line:ctx.pull?'Tow service. Stuck? We can pull you out, or tow one of your vehicles, even the one you are in.':'Tow service. Which of your vehicles do you want us to pick up? (Even the one you are in: you will wait at the shop.)',pick:true,pull:!!ctx.pull}; // TR4: ctx.pull = a Stuck or soft-ground vehicle under you (the 'Pull me out' line)
 }
 if(!isOpen(c,ctx.minutes??0))return {...base,outcome:'no-answer',line:NO_ANSWER_LINE};
 return {...base,outcome:'answered',line:c.say||'Hello?'};
}
// The tow choices: one per owned vehicle, from the saved list. statusOf is garage.js statusOf(progress, uid, now) so this file stays import-free: {uid, label, tow (cents, 0 = free this time, null = already in the shop), line}.
export function towOptions(vehicles,statusOf,labelOf){
 return (vehicles||[]).map(v=>{const st=statusOf(v.uid)||{};return {uid:v.uid,label:labelOf(v),line:st.line||'',inShop:!!st.inShop,tow:st.inShop?null:(st.tow??null)}});
}
// TR4: the 'Pull me out' line. info: {cents (0 = free, hard luck), hours}.
export const pullLabel=info=>`Pull me out · ${info.cents===0?'free this time':'$'+(info.cents/100).toFixed(2)} · ${Math.round(info.hours*60)} min`;
export const towLabel=o=>o.inShop?'In the shop':o.tow==null?'Already at the shop':o.tow===0?'Tow · free this time':`Tow to the repair shop · $${(o.tow/100).toFixed(2)}`;
