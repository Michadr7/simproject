import {levelOf,perkText,perksText} from './skills.js';
import {isAxe,hitsFor,bestAxe} from './tools.js';
import {CONTRACTS,availableContracts} from './gig-bridge.js';
import {money} from './jobs.js';
import {clockText,formatClock} from './routine.js';
import {weekday} from './housing.js';
import {LISTED} from './ownership.js';
import {MAP} from './map-definition.js';
import {createPhoneGps} from './phone-gps.js';
import {CLASSES} from './vehicle.js';
import {GALLON,mph,fuelName,fuelText,priceLabel,canText} from './fuel.js';
import {canOf} from './inventory.js';
import {createPhoneStore} from './phone-store.js';
import {createPhoneJobs} from './phone-jobs.js';
import {vehicleCapacity,vehicleCount,vehicleLabel} from './orders.js';
import {messagesOf,unreadByApp,unreadTotal,APP_NAMES,timeText} from './messages.js';
import {statusOf,hoursNow} from './garage.js'; // VD4: the garage line on each vehicle card (PH1: Call a tow moved to the Call app)
import {createPhoneCall} from './phone-call.js';

// UI only: transactions and movement/cursor ownership stay in game.js.
export function createPhone({document:doc,getState,canOpen,onOpen,onClose,onAccept,onRefresh,onHomeAction,onOrder,onOrderVehicle,onSetMain,isOnSite,onClockIn,onClockOut,onQuit,onCollect,onRead,onTow,pullInfo,onPull,inVehicle,audio,gps}){
  const $=id=>doc.getElementById(id);
  let opened=false,screen='home',previousFocus=null;
  // unread counts come from the saved messages (messages.js): the phone button shows the total, each app icon its own, Messages the total again
  const APP_IDS=['messages','gigs','bank','homes','player','store','jobs'];
  const badgeNow=()=>{const p=getState().progress,by=unreadByApp(p),total=unreadTotal(p),b=$('phoneButton');b.dataset.unread=total?String(Math.min(total,9)):'';b.classList.toggle('has-unread',total>0);
   for(const id of APP_IDS){const el=$('phoneBadge-'+id);if(!el)continue;const n=id==='messages'?total:(by[id]||0);el.hidden=!n;el.textContent=n>9?'9+':String(n)}};
  $('phoneOverlay').hidden=true;
  const gpsUi=gps?createPhoneGps({document:doc,gps:gps.state,mapOptions:gps.mapOptions}):null;
   const store=createPhoneStore({document:doc,getState,onOrderVehicle:(model,colour,home)=>onOrderVehicle?.(model,colour,home)||{error:'Ordering is not available.'},onOrder:(cart,home)=>onOrder?.(cart,home)||{error:'Ordering is not available.'},onSetMain:id=>onSetMain?.(id)||{error:'Not available.'},say:text=>{$('phoneMessage').textContent=text}});
  const jobs=createPhoneJobs({document:doc,getState,isOnSite:id=>isOnSite?.(id)??false,onClockIn:id=>onClockIn?.(id)||{error:'Not available.'},onClockOut:()=>onClockOut?.()||{error:'Not available.'},onQuit:id=>onQuit?.(id)||{error:'Not available.'},onCollect:id=>onCollect?.(id)||{error:'Not available.'},say:text=>{$('phoneMessage').textContent=text}});
  const call=createPhoneCall({document:doc,getState,inVehicle:()=>inVehicle?.()??false,onTow:uid=>{const r=onTow?.(uid)||{error:'Not available.'};refresh();return r},pullInfo:()=>pullInfo?.()||null,onPull:()=>{const r=onPull?.()||{error:'Not available.'};refresh();return r},audio}); // PH1: the Call app (a tow is called from here)
  const cards=CONTRACTS.map(job=>{
    const card=doc.createElement('article');card.className='phone-contract';
    const title=doc.createElement('h3');title.textContent=job.title;
    const description=doc.createElement('p');description.textContent=job.description;
    const terms=doc.createElement('div');terms.className='phone-contract-terms';terms.textContent=`${money(job.reward)} · ${job.mode==='timed'?job.duration+'s task':job.mode==='courier'?'20m run':'Heavy load'}`;
    const button=doc.createElement('button');button.id='accept-'+job.id;button.className='phone-accept';
    button.onclick=()=>{
      const result=onAccept(job.id);
      if(result?.error){$('phoneMessage').textContent=result.error;refresh();return}
      close();
    };
    card.append(title,description,terms,button);$('phoneContracts').append(card);
    return {job,button,card,gTitle:title,gDesc:description,gTerms:terms};
  });
  // The Housing app: one card per home for rent or sale (built once, updated in place): a status line and the buttons that apply to where you stand with it.
  const homeCards=LISTED.map(h=>{
    const card=doc.createElement('article');card.className='phone-contract phone-home';
    const title=doc.createElement('h3');title.textContent=h.name;
    const terms=doc.createElement('p');terms.textContent=`Rent ${money(h.rentCents)} a week · deposit ${money(h.depositCents)} · buy for ${money(h.priceCents)}`;
    const status=doc.createElement('p');status.className='phone-home-status';
    const actions=doc.createElement('div');actions.className='phone-home-actions';
    const buttons={};
    for(const [action,label] of [['rent','Rent'],['buy','Buy'],['pay','Pay rent'],['leave','Move out']]){
      const button=doc.createElement('button');button.id=`home-${action}-${h.id}`;button.className='phone-accept';button.textContent=label;
      button.onclick=()=>{const result=onHomeAction?.(action,h.id)||{};$('phoneMessage').textContent=result.error||result.message||'';refresh()};
      buttons[action]=button;actions.append(button);
    }
    card.append(title,terms,status,actions);$('phoneHomes').append(card);
    return {h,status,buttons};
  });
  // The Player screen's Vehicles list (built once, updated in place): name, tier, mileage, top speed and how much fuel is in the tank. A vehicle with no saved fuel entry is full.
  const TIER_NAME={low:'Starter',mid:'Mid-range',high:'High-end'};
  let garageKey='';const garageLevels=new Map(),garageExtra=new Map();
  const noVehicles=doc.createElement('p');noVehicles.className='phone-home-status';noVehicles.textContent='You do not own a vehicle yet. Buy one at the Eastbank lot, or order it in the Store.';$('phoneGarage').append(noVehicles);
  function refresh(){
    onRefresh?.();const state=getState(),progress=state.progress;
    const offerBy=new Map(availableContracts(progress).map(job=>[job.id,job])),available=new Set(offerBy.keys());
    $('phoneClock').textContent=clockText(progress.routine);
    $('phoneDate').textContent=weekday(progress.housing.day)+' · Oak Street';
    $('phoneGreeting').textContent=state.me.name?`Hello, ${state.me.name}.`:'Your life, in reach.';
    $('phoneBalance').textContent=money(progress.cash);
    $('phoneFuelPrices').textContent=`Eastbank gas station: gas ${priceLabel('gas')} · diesel ${priceLabel('diesel')}.`;
    {const owned=progress.vehicles||[],key=owned.map(v=>v.uid+v.colour).join();
     if(key!==garageKey){garageKey=key;garageLevels.clear();garageExtra.clear();const cards=[];
      for(const v of owned){const slot=MAP.vehicles.find(s=>s.model===v.model),cls=CLASSES[v.model];if(!slot||!cls)continue;
       const card=doc.createElement('article');card.className='phone-contract';
       const title=doc.createElement('h3');title.textContent=vehicleLabel(v.model,v.colour);
       const specs=doc.createElement('p');specs.textContent=`${TIER_NAME[cls.tier]||cls.tier} · ${cls.mpg} mpg · top ${mph(cls.top)} mph · ${(slot.fuel.tankMgal/GALLON).toFixed(0)} gal ${fuelName(slot.fuel.type)} tank`;
       const level=doc.createElement('p');level.className='phone-home-status';garageLevels.set(v.uid,level);
       const shopLine=doc.createElement('p');shopLine.className='phone-home-status';garageExtra.set(v.uid,{shopLine});
       card.append(title,specs,level,shopLine);cards.push(card)}
      $('phoneGarage').replaceChildren(...cards,noVehicles)}
     for(const v of owned){const slot=MAP.vehicles.find(s=>s.model===v.model),level=garageLevels.get(v.uid);if(slot&&level)level.textContent=`Fuel: ${fuelText(v.fuelMgal??slot.fuel.tankMgal,slot.fuel.tankMgal)}`;const ex=garageExtra.get(v.uid),st=ex&&statusOf(progress,v.uid,hoursNow(progress));if(st){const at=st.readyAt!==null?` · ready ${weekday(Math.floor(st.readyAt/24)+1)} ${formatClock((st.readyAt%24)*60)}`:'';ex.shopLine.textContent=st.line+(st.inShop&&!st.ready?at:'')}}
     noVehicles.hidden=owned.length>0;$('phoneVehicleSpace').textContent=`Vehicle space: ${vehicleCount(progress)} of ${vehicleCapacity(progress)} used (apartment 1, small house 1, medium 2, large 3).`}
    {const can=canOf(progress);$('phoneCan').textContent=can?`Gas can: ${canText(can)}.`:'No gas can. Buy one ($15) from the store.'}
    $('phonePlayerName').textContent=state.me.name||'New neighbor';
    {const xp=progress.skills.lumberjack.xp,{level,into,next}=levelOf(xp);
     $('phoneLumberLevel').textContent=level>=20?'Lv 20 · max':'Lv '+level;$('phoneLumberMeter').max=next||1;$('phoneLumberMeter').value=next?into:1;
     {const axe=isAxe(progress.equipped)?progress.equipped:bestAxe(progress);$('phoneLumberPerks').textContent=perksText(level,axe?hitsFor(axe,level):null)};$('phoneLumberNext').textContent=level>=20?'Every perk unlocked.':`${into} / ${next} XP to level ${level+1}: ${perkText(level+1)}`;
     $('phoneTrees').textContent=String(progress.stats.treesFelled);$('phoneLogs').textContent=String(progress.stats.logsCollected);$('phoneDeliveries').textContent=String(progress.completed)}
    $('phoneEnergy').textContent=Math.round(progress.life.energy)+' / 100';
    $('phoneFood').textContent=Math.round(progress.life.food)+' / 100';
    $('phoneEnergyMeter').value=progress.life.energy;$('phoneFoodMeter').value=progress.life.food;
    $('phoneThirst').textContent=Math.round(progress.life.thirst)+' / 100';$('phoneThirstMeter').value=progress.life.thirst;
    $('phoneActiveJob').textContent=progress.activeJob?`Active: ${progress.activeJob.title}. Follow the gold marker.`:available.size?'No upfront energy charge. Offers refresh every 30 game minutes.': 'No offers right now. Check back after the board refreshes.';
    for(const {h,status,buttons} of homeCards){
      const held=progress.properties?.[h.id],renting=held?.tenure==='rent',owning=held?.tenure==='own';
      status.textContent=owning?'You own this home.':renting?(held.rentDue?`Rent overdue: ${money(held.rentDue)}.`:`Renting · rent due in ${Math.max(0,held.nextBillDay-progress.housing.day)} days.`):'For rent or sale.';
      buttons.rent.hidden=!!held;buttons.buy.hidden=owning;buttons.pay.hidden=!(renting&&held.rentDue>0);buttons.leave.hidden=!renting;
      buttons.buy.textContent=renting?`Buy · ${money(h.priceCents-held.deposit)}`:`Buy · ${money(h.priceCents)}`;
    }
    store.refresh();if(screen==='jobs')jobs.render();
    for(const {job,button,card,gTitle,gDesc,gTerms} of cards){
      card.hidden=!available.has(job.id);{const o=offerBy.get(job.id);if(o){gTitle.textContent=o.title;gDesc.textContent=o.description;gTerms.textContent=money(o.reward)+' · '+o.terms}}
      const current=progress.activeJob?.id===job.id;
      button.disabled=!!progress.activeJob;
      button.textContent=current?'In progress':progress.activeJob?'Finish active gig':'Accept';
    }
  }
  // The Messages screen: every message newest first (unread ones marked), each a button that opens its app. Built when the screen is shown, so a message that comes in while it is open is added.
  function renderMessages(){
    const box=$('phoneMessages'),list=messagesOf(getState().progress),rows=[];
    if(!list.length){const none=doc.createElement('p');none.className='phone-empty';none.textContent='No messages yet. Orders, deliveries, bills and reminders will show up here.';rows.push(none)}
    for(const msg of list){const row=doc.createElement('button');row.className='phone-message';row.dataset.unread=String(!msg.read);row.dataset.app=msg.app;
      const head=doc.createElement('small'),app=doc.createElement('b'),at=doc.createElement('span');app.textContent=APP_NAMES[msg.app]||msg.app;at.textContent=timeText(msg.at);head.append(app,at);
      const text=doc.createElement('span');text.textContent=msg.text;row.append(head,text);row.onclick=()=>showScreen(msg.app);rows.push(row)}
    box.replaceChildren(...rows);
  }
  function showScreen(next){
    screen=next;
    for(const name of ['home','messages','gigs','bank','homes','player','store','jobs','call','gps'])$('phoneScreen-'+name).hidden=name!==screen;
    $('phoneTitle').textContent=screen==='home'?'Your phone':({homes:'Housing',gps:'GPS'})[screen]||screen[0].toUpperCase()+screen.slice(1);
    if(screen!=='store')store.reset();if(screen!=='jobs')jobs.reset();if(screen!=='call')call.reset();if(gpsUi){if(screen==='gps')gpsUi.show();else gpsUi.hide()}$('phoneHome').disabled=screen==='home';$('phoneBack').disabled=screen==='home';$('phoneMessage').textContent='';refresh();
    // opening an app reads its messages; Messages reads them all (the list was drawn first, so the unread ones still show as unread this once)
    if(screen==='messages'){renderMessages();onRead?.(null)}else if(screen!=='home')onRead?.(screen);
    badgeNow();
  }
  function open(){
    if(opened||!canOpen())return;
    previousFocus=doc.activeElement;opened=true;badgeNow();onOpen();
    $('phoneOverlay').hidden=false;showScreen('home');$('phoneApp-gigs').focus();
  }
  function close(){
    if(!opened)return;call.reset();gpsUi?.hide();
    opened=false;$('phoneOverlay').hidden=true;onClose();
    previousFocus?.focus?.();
  }
  for(const name of ['messages','gigs','bank','homes','player','store','jobs','call','gps'])if($('phoneApp-'+name))$('phoneApp-'+name).onclick=()=>showScreen(name);
  $('phoneHome').onclick=()=>showScreen('home');$('phoneBack').onclick=()=>{if(screen==='store'&&store.back())return;showScreen('home')};$('phoneClose').onclick=close;
  $('phoneButton').onclick=()=>opened?close():open();
  // A notification (the message itself is already saved: game.js notifyPhone): the button shakes (the class is taken off and put back so a second one shakes again) and the badges are redrawn. With the phone open, a message for the screen you are on is read at once.
  const btn=$('phoneButton'),badge=badgeNow;let ringTimer=null;
  function notify(app){if(opened){if(screen==='messages'){renderMessages();onRead?.(null)}else if(app&&screen===app)onRead?.(app);badge();return}badge();btn.classList.remove('ring');void btn.offsetWidth;btn.classList.add('ring');clearTimeout(ringTimer);ringTimer=setTimeout(()=>btn.classList.remove('ring'),900)}
  return {open,notify,get unread(){return unreadTotal(getState().progress)},refreshBadges:badgeNow,close,toggle:()=>opened?close():open(),get isOpen(){return opened},showJobs(){if(opened&&screen==='jobs')jobs.render()},gpsUpdate:(dt,view)=>gpsUi?.update(dt,view)};
}
