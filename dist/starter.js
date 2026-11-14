// "A Hand for Hal" (notes/gigs-starter-design.md section 2): the starter story as pure state. Money is integer cents.
// progress.starter = {step 0..10, done, skipped, quality 0..100, fuelGiven, loanUid, loaded, noteGiven, gigDone}. step n = n beats finished.
// Old saves (any progress already made) are {done:true, skipped:true} so nobody playing is pulled into the tutorial.
// Places are data. Only positions already known from the map are listed; the porch, crate pile, farm truck pose and studio parking pose are NOT chosen yet (design section 7).
export const PLACES=Object.freeze({
 spawn:{x:-5,z:15},market:{x:19,z:-6.3},oakStreet18:{x:3.8,z:-7},farmhouse:{x:-62,z:-244},gas:{x:156.5,z:-8.25},apartments:{x:1,z:-6.3}
});
export const SKIP_SALE_PRICE=280000;
const B=(id,title,text,event,place,cash=0)=>Object.freeze({id,title,text,event,place,cash});
export const BEATS=Object.freeze([
 B('message','Check your phone','A message from Noah: come by the market, he could use a hand.','read-message','market'),
 B('groceries','Sophie\'s groceries','Carry Sophie\'s groceries from the market to 18 Oak Street.','delivered','oakStreet18',300),
 B('food','Eat something first','Noah says Hal Brennan needs someone. Buy food and a water, and eat one: it is a long walk.','ate','market'),
 B('farm','Walk to Willow Farmhouse','Take Hal his groceries. The arrow leads the way.','arrived','farmhouse',2500),
 B('crates','Eggs for Noah','Load four egg crates on Hal\'s flatbed and drive them to the market. Hard knocks cost quality.','delivered-crates','market'),
 B('fuel','Fill up','The tank is nearly empty. Hal left cash for gas: fill up at the pump.','refuelled','gas',3200),
 B('note','Hal\'s note for Walt','Drop Hal\'s note at the Ridgeline office in Eastbank.','note-given','ridgeline'),
 B('gig','Take a gig','Two starter gigs are on the Gigs app. Take one and finish it.','gig-done','phone'),
 B('rent','Somewhere to park','Studio 2B is for rent. Rent it so the truck has a home.','rented','apartments'),
 B('sleep','Keep her','Hal gives you the truck. Sleep in the studio to end the day.','slept','apartments')
]);
const DONE=Object.freeze({groceries:'Sophie thanks you and the groceries are delivered.',food:'Fed and watered. Off to the farm.',farm:'Hal pays you for the groceries. His truck waits in the yard: more soon.'});
export const fresh=()=>({step:0,done:false,skipped:false,quality:100,fuelGiven:false,loanUid:null,loaded:false,noteGiven:false,gigDone:false});
const int=(v,lo,hi,d=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
// An old save: anything done already. p is the progress being normalised (partly built is fine).
const hasProgress=p=>!!p&&((p.completed||0)>0||(p.cash||0)>0||(p.vehicles?.length||0)>0||!!p.housing?.rented||Object.keys(p.properties||{}).length>0||Object.keys(p.careers||{}).length>0);
export function normalizeStarter(v,p){
 if(!v||typeof v!=='object')return hasProgress(p)?{...fresh(),step:10,done:true,skipped:true}:fresh();
 const s=fresh();s.step=int(v.step,0,10);s.done=v.done===true||s.step===10;s.skipped=v.skipped===true;
 if(s.done)s.step=10;
 s.quality=int(v.quality,0,100,100);s.fuelGiven=v.fuelGiven===true;s.loaded=v.loaded===true;s.noteGiven=v.noteGiven===true;s.gigDone=v.gigDone===true;
 s.loanUid=typeof v.loanUid==='string'&&/^v\d{1,6}$/.test(v.loanUid)&&s.step>=4&&s.step<=9?v.loanUid:null;
 return s;
}
export const skipStarter=()=>({...fresh(),step:10,done:true,skipped:true});
// The objective card and the tracker's story row read this. aim is a PLACES key.
// The truck beats (5, 6 and 10) need the short flatbed, which is not built yet: until VEHICLE_BEATS_READY the story pauses after beat 4 and the card goes back to the normal text.
export const VEHICLE_BEATS_READY=false;
export function starterObjective(p,{vehicleReady=VEHICLE_BEATS_READY}={}){
 const s=p?.starter;if(!s||s.done||(!vehicleReady&&s.step>=4))return null;
 if(s.step===6||s.step===7){const left=BEATS.filter(b=>(b.event==='note-given'&&!s.noteGiven)||(b.event==='gig-done'&&!s.gigDone));const b=left[0];return b?{title:b.title,text:b.text,aim:b.place}:null}
 const b=BEATS[s.step];return b?{title:b.title,text:b.text,aim:b.place}:null;
}
// Pay for the egg crates (beat 5): $40 at 100% quality, at least $28.
export const cratePay=q=>2800+Math.floor(1200*int(q,0,100,100)/100);
// advanceStarter(p, event, data) -> {state, message, cash} or {error}. state is the new starter; the caller applies cash and messages.
export function advanceStarter(p,event,data={}){
 const s=p?.starter;if(!s)return {error:'No starter story.'};if(s.done)return {error:'The story is finished.'};
 const next=o=>({...s,...o}),step=s.step;
 if(step===4&&event==='loaded')return s.loaded?{error:'Already loaded.'}:{state:next({loaded:true}),message:'The crates are on the deck.',cash:0};
 if(step===6||step===7){
  const a=event==='note-given'?'noteGiven':event==='gig-done'?'gigDone':null;
  if(!a)return {error:'That does not fit this step.'};
  if(s[a])return {error:'Already done.'};
  const n=next({[a]:true,step:step+1});
  return {state:n,message:a==='noteGiven'?'Walt: Hal says you are reliable. Come and see me when you want steady work.':'Gig finished.',cash:0};
 }
 const beat=BEATS[step];
 if(!beat||beat.event!==event)return {error:'That does not fit this step.'};
 if(event==='delivered-crates'&&!s.loaded)return {error:'Load the crates first.'};
 if(event==='delivered-crates'){const q=int(data.quality,0,100,100);return {state:next({step:step+1,quality:q,loaded:false}),message:`Noah paid for the eggs (quality ${q}%).`,cash:cratePay(q)};}
 const o={step:step+1};
 if(event==='refuelled')o.fuelGiven=true;
 if(event==='arrived'&&data.loanUid)o.loanUid=data.loanUid;
 if(event==='slept'){o.done=true;o.loanUid=null}
 return {state:next(o),message:beat.id==='sleep'?'Hal: keep her. She is yours.':DONE[beat.id]||beat.title+' done.',cash:beat.event==='refuelled'&&s.fuelGiven?0:beat.cash};
}