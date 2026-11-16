// "A Hand for Hal" (notes/gigs-starter-design.md section 2): the starter story as pure state. Money is integer cents.
// progress.starter = {step 0..10, done, skipped, quality 0..100, fuelGiven, loanUid, loaded, noteGiven, gigDone}. step n = n beats finished.
// Old saves (any progress already made) are {done:true, skipped:true} so nobody playing is pulled into the tutorial.
// Places are data (G3: the porch, Hal, crate pile and farm truck pose are chosen and a test checks them against the terrain mask and the farm buildings; the studio parking pose is orders.js parkingAim).
export const PLACES=Object.freeze({
 spawn:{x:-5,z:15},market:{x:19,z:-6.3},oakStreet18:{x:3.8,z:-7},farmhouse:{x:-62,z:-236.5},gas:{x:156.5,z:-8.25},apartments:{x:1,z:-6.3},ridgeline:{x:81.5,z:58.3},
 hal:{x:-59.4,z:-235.8},crates:{x:-66,z:-235.4},farmTruck:{x:-70.5,z:-231.5,yaw:0}
});
import {countOf,hasCrates,addCrates,removeCrates} from './cargo.js';
import {VEHICLE_PRICE,vehicleCount,vehicleCapacity,grantVehicle,parkingAim,STUDIO_ID,vehicleName} from './orders.js';
export const SKIP_SALE_PRICE=VEHICLE_PRICE.shortbed; // Hal sells the Shortbed at its store price (orders.js), one source
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
export const VEHICLE_BEATS_READY=true;
export function starterObjective(p,{vehicleReady=VEHICLE_BEATS_READY}={}){
 const s=p?.starter;if(!s||s.done||(!vehicleReady&&s.step>=4))return null;
 if(s.step===6||s.step===7){const left=BEATS.filter(b=>(b.event==='note-given'&&!s.noteGiven)||(b.event==='gig-done'&&!s.gigDone));const b=left[0];return b?{title:b.title,text:b.text,aim:b.place}:null}
 const b=BEATS[s.step];return b?{title:b.title,text:b.text,aim:b.id==='crates'&&!s.loaded?'crates':b.place}:null;
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
 if(event==='slept'&&s.loanUid&&vehicleCount(p)>=vehicleCapacity(p))return {error:'Hal: she needs a place to park. Free a space at home first, then sleep. (You hold '+vehicleCount(p)+' of '+vehicleCapacity(p)+' vehicles.)',soft:true};
 if(event==='delivered-crates'&&!s.loaded)return {error:'Load the crates first.'};
 if(event==='delivered-crates'){const q=int(data.quality,0,100,100);return {state:next({step:step+1,quality:q,loaded:false}),message:`Noah paid for the eggs (quality ${q}%).`,cash:cratePay(q)};}
 const o={step:step+1};
 if(event==='refuelled')o.fuelGiven=true;
 if(event==='arrived'&&data.loanUid)o.loanUid=data.loanUid;
 if(event==='slept'){o.done=true;o.loanUid=null}
 return {state:next(o),message:beat.id==='sleep'?'Hal: keep her. She is yours.':DONE[beat.id]||beat.title+' done.',cash:beat.event==='refuelled'&&s.fuelGiven?0:beat.cash};
}

// ---- G3: the game-facing layer (pure; game.js calls these with GameState.progress and applies what they return) ----
export const LOAN_FUEL_MGAL=3000; // the loan truck arrives with about 3 gallons (tank 20 gal): beat 6 is the pump
export const KNOCK_COST=12; // egg quality lost per counted crash while the crates are on the truck
// G3b: the egg crates are a real cargo piece. While the story says `loaded` the loan truck's deck holds STORY_CRATES crates and the pallet by the barn is hidden; otherwise there are none.
export const STORY_CRATES=4;
export const storyPalletHidden=s=>!!(s&&!s.done&&s.loaded);
// What to do to a deck: {cargo} when it must change (the new list), null when it is right already (cheap enough to ask every frame). Timber on the deck blocks loading (the game asks the player to clear it first).
export function storyDeck(s,cargo,model){
 if(storyPalletHidden(s)){if(countOf(cargo,'crate')===STORY_CRATES)return null;const r=addCrates(removeCrates(cargo).cargo,model,STORY_CRATES);return r.error?null:{cargo:r.cargo}}
 return hasCrates(cargo)?{cargo:removeCrates(cargo).cargo}:null;
}export const knockQuality=n=>Math.max(0,100-KNOCK_COST*int(n,0,100,0));
export const CRATE_REACH=9,MARKET_REACH=14; // metres: the truck must stand this close to the pile / the market door
// Where an objective's arrow leads: a PLACES key, or null for no story arrow (the phone, or the normal market arrow).
export const aimPoint=key=>key&&key!=='phone'&&PLACES[key]?{x:PLACES[key].x,z:PLACES[key].z}:null;
// Hal is at the farm in the working day (his post is 06:30 to 17:30) and always while the story needs him.
export const halHere=p=>{const s=p?.starter,m=p?.routine?.minutes||0;return !!s&&((!s.done&&s.step>=3&&s.step<=9)||(m>=390&&m<1050))};
const money=c=>'$'+(c/100).toFixed(c%100?2:0);
// applyStory(p, event, data) -> {progress, text, moved?} | {error, soft?}. progress carries the cash and the new step; moved = {uid, pose} when a vehicle has to be put somewhere (the gift goes to the studio's parking spot).
export function applyStory(p,event,data={}){
 const r=advanceStarter(p,event,data);if(r.error)return r;
 const cash=r.cash||0,loan=p.starter.loanUid;
 let progress={...p,starter:r.state,cash:p.cash+cash,routine:{...p.routine,earned:(p.routine?.earned||0)+cash}},moved=null;
 if(event==='slept'&&loan){const aim=parkingAim(STUDIO_ID),i=progress.vehicles.findIndex(v=>v.uid===loan);if(aim&&i>=0){const v={...progress.vehicles[i],x:+aim.x.toFixed(2),z:+aim.z.toFixed(2),yaw:+aim.yaw.toFixed(3)};progress={...progress,vehicles:progress.vehicles.map((o,j)=>j===i?v:o)};moved={uid:loan,pose:{x:v.x,z:v.z,yaw:v.yaw}}}}
 return {progress,text:r.message+(cash?' | +'+money(cash):''),moved};
}
// Beat 4: Hal lends the truck in the farm yard (a normal vehicle entry; starter.loanUid says it is his) and pays for the groceries.
export function startLoan(p){
 const s=p.starter;if(!s||s.done||s.step!==3)return {error:'Not now.'};
 const g=grantVehicle(p,'shortbed',null,PLACES.farmTruck,{loan:true,fuelMgal:LOAN_FUEL_MGAL});if(g.error)return {error:g.error};
 const r=applyStory(g.state,'arrived',{loanUid:g.vehicle.uid});if(r.error)return r;
 return {...r,vehicle:g.vehicle,text:'Hal lends you the truck for the day. '+r.text};
}
// A save that reached the truck beats before the truck existed (or lost it): the loan truck is put in the farm yard once. Returns null when nothing is needed.
export function ensureLoan(p){
 const s=p?.starter;if(!s||s.done||s.step<4||s.step>9||(s.loanUid&&p.vehicles?.some(v=>v.uid===s.loanUid)))return null;
 const g=grantVehicle(p,'shortbed',null,PLACES.farmTruck,{loan:true,fuelMgal:s.fuelGiven?undefined:LOAN_FUEL_MGAL});if(g.error)return null;
 return {progress:{...g.state,starter:{...s,loanUid:g.vehicle.uid}},vehicle:g.vehicle,text:'Hal left the truck in the farm yard for you.'};
}
// Hal's talk: {text, choices:[{id,label}]}. ids: 'groceries' (beat 4), 'buy' (the sale, for anyone who is not in the story).
export function halTalk(p){
 const s=p?.starter,price=money(SKIP_SALE_PRICE),has=p?.vehicles?.some(v=>v.model==='shortbed');
 if(s&&!s.done){
  if(s.step<3)return {text:'Hal: Haven\'t seen you around. Noah said he might send someone out with my groceries.',choices:[]};
  if(s.step===3)return {text:'Hal: You must be Noah\'s helper. My knee says thank you. My old flatbed has stood since spring: take her for the day if you can drive.',choices:[{id:'groceries',label:'Hand over the groceries'}]};
  if(s.step===4)return {text:s.loaded?'Hal: The crates are on. Noah is waiting, and mind the bumps.':'Hal: Four crates of eggs are on the pallet by the barn. Park the truck beside them, load up, and run them to Noah.',choices:[]};
  if(s.step===5)return {text:'Hal: She is nearly dry. I left cash for gas: the pump is in Eastbank.',choices:[]};
  return {text:s.step===9?'Hal: Studio 2B needs a place for her to sleep. Then she is yours.':'Hal: Walt at the Ridgeline office is expecting my note. Take a gig if you want the money.',choices:[]};
 }
 if(s?.skipped||!has)return {text:s?.skipped?'Hal: No story for you, then. But I will sell you the truck for '+price+': she runs fine.':'Hal: Come by some mornings, I will have work.',choices:has?[]:s?.skipped?[{id:'buy',label:'Buy the truck · '+price}]:[]};
 return {text:'Hal: Come by some mornings, I will have work.',choices:[]};
}
// Buying the truck from Hal (skippers and old saves): the Shortbed's store price, a place at home needed, parked in the farm yard.
export function buyFromHal(p){
 const s=p.starter;if(!s||(!s.skipped&&!s.done))return {error:'Hal is not selling today.'};
 if(p.vehicles?.some(v=>v.model==='shortbed'))return {error:'You already have a '+vehicleName('shortbed')+'.'};
 const g=grantVehicle(p,'shortbed',null,PLACES.farmTruck,{price:SKIP_SALE_PRICE});return g.error?{error:g.error}:{progress:g.state,vehicle:g.vehicle,text:g.message};
}