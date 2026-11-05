// The phone's Store app (0.34): pick a category from the dropdown, pick things (or a vehicle and its colour), see the delivery fee and when it will arrive, order to a home you rent or own. UI only: the rules are
// orders.js and the transaction runs in game.js. A vehicle has a picture (vehicle-pictures.js, rendered by scripts/render-vehicle-pictures.mjs and loaded when the Store is first opened) and an Info view.
// getState() -> the game state; onOrder(cart, homeId) and onOrderVehicle(model, colour, homeId) -> {message}|{error}; onSetMain(homeId) -> {message}|{error}; say(text) shows a message on the phone.
import {soldOnline,VEHICLE_PRICE,VEHICLE_ORDER,vehicleCapacity,vehicleCount,inStock,displayColour,restockMinutes,catalogue,quote,overview,arrivalText,etaText,nowMinutes,FEE_CENTS,BUNDLE,MAX_UNITS} from './orders.js';
import {money} from './jobs.js';
import {MAP} from './map-definition.js';
import {coloursOf,colourOf,defaultColour} from './paint.js';
import {CATEGORIES,categoryById,categoryOf} from './store-categories.js';
import {CLASSES} from './vehicle.js';
import {GALLON,mph,fuelName} from './fuel.js';
const SIZE_NOTE={small:`small · $${FEE_CENTS.small/100} per ${BUNDLE.small}`,medium:`medium · $${FEE_CENTS.medium/100} per ${BUNDLE.medium}`,large:`large · $${FEE_CENTS.large/100} each`};
const TIER_NAME={low:'Starter',mid:'Mid-range',high:'High-end'};
export function createPhoneStore({document:doc,getState,onOrder,onOrderVehicle,onSetMain,say}){
 const $=id=>doc.getElementById(id),cart=new Map(),rows=new Map(),el=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const cartList=()=>[...cart].filter(([,q])=>q>0).map(([id,qty])=>({id,qty}));
 let category='vehicles',infoModel=null,PICTURES=null,picturesAsked=false;
 const pictureFor=(model,colour)=>PICTURES?.[`${model}-${colour}`]||'';
 // the category dropdown
 $('phoneStoreCategory').replaceChildren(...CATEGORIES.map(c=>{const o=el('option','',c.soon?`${c.label} (coming soon)`:c.label);o.value=c.id;return o}));$('phoneStoreCategory').value=category;
 $('phoneStoreCategory').onchange=()=>{category=categoryById($('phoneStoreCategory').value)?.id||'vehicles';refresh()};
 for(const {item,size} of catalogue()){
  const cat=categoryOf(item);if(!cat)continue;
  const row=el('div','phone-store-row'),name=el('span','phone-store-name',`${item.icon} ${item.name}`),note=el('small','',`${money(item.price)} · ${SIZE_NOTE[size]}`),count=el('strong','phone-store-qty','0');
  const minus=el('button','phone-store-step','−'),plus=el('button','phone-store-step','+');minus.id='phoneStoreSub-'+item.id;plus.id='phoneStoreAdd-'+item.id;minus.setAttribute('aria-label','One fewer '+item.name);plus.setAttribute('aria-label','One more '+item.name);
  minus.onclick=()=>{const q=(cart.get(item.id)||0)-1;if(q>0)cart.set(item.id,q);else cart.delete(item.id);refresh()};
  plus.onclick=()=>{if(quote(cartList()).units>=MAX_UNITS)return say(`One order can hold ${MAX_UNITS} things.`);cart.set(item.id,(cart.get(item.id)||0)+1);refresh()};
  const label=el('div','phone-store-label');label.append(name,note);row.append(label,minus,count,plus);$('phoneStoreItems').append(row);rows.set(item.id,{count,minus,row,category:cat});
 }
 // vehicles: one card per model with a picture, its colours as swatches (a sold-out colour is greyed out until it is restocked), an Info button and an Order button for the picked colour
 const picked={};
 const orderVehicle=model=>{const r=onOrderVehicle(model,picked[model],$('phoneStoreHome').value);say(r.error||r.message||'');refresh()};
 const vehicleRows=MAP.vehicles.filter(v=>VEHICLE_PRICE[v.model]&&soldOnline(v.model)).map(v=>{
  const row=el('div','phone-store-row phone-store-vehicle'),picture=el('img','phone-store-picture'),label=el('div','phone-store-label'),note=el('small','',''),swatches=el('div','phone-swatches'),buttons=el('div','phone-store-buttons');
  const order=el('button','phone-accept','Order'),info=el('button','phone-accept phone-info','Info');order.id='phoneStoreVehicle-'+v.model;info.id='phoneStoreInfo-'+v.model;picture.alt=v.name;
  const chips=coloursOf(v.model).map(c=>{const chip=el('button','phone-swatch','');chip.id=`phoneStoreColour-${v.model}-${c.id}`;chip.style.background=c.swatch;chip.setAttribute('aria-label',c.name);chip.title=c.name;chip.onclick=()=>{picked[v.model]=c.id;refresh()};swatches.append(chip);return {c,chip}});
  buttons.append(info,order);label.append(el('span','phone-store-name',v.name),swatches,note,buttons);row.append(picture,label);$('phoneStoreVehicles').append(row);
  order.onclick=()=>orderVehicle(v.model);info.onclick=()=>{infoModel=v.model;refresh()};
  return {v,note,order,chips,picture,row};
 });
 // the Info view of one vehicle: a bigger picture, the specs, the colours, the price and the Order button
 $('phoneStoreInfoOrder').onclick=()=>{if(infoModel)orderVehicle(infoModel)};
 $('phoneStoreMain').onclick=()=>{const r=onSetMain($('phoneStoreHome').value);say(r.error||r.message||'');refresh()};
 $('phoneStoreClear').onclick=()=>{cart.clear();refresh()};
 $('phoneStoreOrder').onclick=()=>{const r=onOrder(cartList(),$('phoneStoreHome').value);say(r.error||r.message||'');if(!r.error)cart.clear();refresh()};
 let homesKey='';
 function refresh(){
  const state=getState(),p=state.progress,o=overview(p),q=quote(cartList()),visible=!$('phoneScreen-store').hidden;
  if(visible&&!picturesAsked){picturesAsked=true;import('./vehicle-pictures.js').then(m=>{PICTURES=m.PICTURES;refresh()},()=>{})}
  // homes: the select keeps your choice; it starts on the main home
  const key=o.homes.map(h=>h.id).join()+'|'+o.main;
  if(key!==homesKey){homesKey=key;const was=$('phoneStoreHome').value;$('phoneStoreHome').replaceChildren(...o.homes.map(h=>{const opt=el('option','',`${h.name}${h.id===o.main?' (main)':''}`);opt.value=h.id;return opt}));$('phoneStoreHome').value=o.homes.some(h=>h.id===was)?was:(o.main||'')}
  const chosen=$('phoneStoreHome').value,hasHome=o.homes.length>0;
  $('phoneStoreNote').textContent=hasHome?`Deliveries go to ${o.homes.find(h=>h.id===chosen)?.name||'your main home'}${chosen===o.main?' (your main home)':''}. ${o.homes.find(h=>h.id===chosen)?.kind==='apartment'?'Collect them from the parcel locker by the studio door.':'Collect them from the parcel box in front of the door.'}`:'You need a home to receive an order: rent the studio or a house first (Housing app).';
  $('phoneStoreHome').disabled=!hasHome;$('phoneStoreMain').disabled=!hasHome||chosen===o.main;
  // which category is shown
  const cat=categoryById(category);$('phoneStoreCategory').value=category;
  $('phoneStoreVehicles').hidden=category!=='vehicles';$('phoneStoreSoon').hidden=!cat.soon;$('phoneStoreSoon').textContent=cat.soon?`${cat.label}: coming soon.`:'';
  for(const r of rows.values())r.row.hidden=r.category!==category;
  $('phoneStoreItems').hidden=category==='vehicles'||!!cat.soon;
  $('phoneStoreCartBox').hidden=!q.units&&(category==='vehicles'||!!cat.soon);
  for(const {v,note,order,chips,picture} of vehicleRows){const total=VEHICLE_PRICE[v.model]+VEHICLE_ORDER.fee,full=vehicleCount(p)>=vehicleCapacity(p);
   if(!picked[v.model]||!inStock(p,v.model,picked[v.model]))picked[v.model]=displayColour(p,v.model)||picked[v.model]||defaultColour(v.model);
   const colour=picked[v.model],stocked=inStock(p,v.model,colour);
   for(const {c,chip} of chips){const ok=inStock(p,v.model,c.id);chip.disabled=!ok;chip.className='phone-swatch'+(c.id===colour?' selected':'')+(ok?'':' soldout');chip.title=ok?c.name:`${c.name}: sold out, back in ${Math.ceil(restockMinutes(p,v.model,c.id)/1440)} game days`}
   note.textContent=!stocked?`${colourOf(v.model,colour).name}: sold out, back in ${Math.ceil(restockMinutes(p,v.model,colour)/1440)} game days.`:!hasHome?'You need a home first to park a vehicle: rent the studio or a house (Housing app).':full?`No room: you hold ${vehicleCount(p)} of ${vehicleCapacity(p)} vehicles. Each home holds some (apartment 1, small house 1).`:`${colourOf(v.model,colour).name} · ${money(VEHICLE_PRICE[v.model])} + ${money(VEHICLE_ORDER.fee)} delivery`;
   order.disabled=!stocked||full||!hasHome||p.cash<total;const src=pictureFor(v.model,colour);if(src&&picture.src!==src)picture.src=src}
  for(const [id,r] of rows){const n=cart.get(id)||0;r.count.textContent=String(n);r.minus.disabled=!n}
  const lines=q.lines.map(l=>`${l.qty} × ${l.name}`).join(', ');
  $('phoneStoreCart').textContent=q.units?lines:'Your cart is empty. Add things with +.';
  $('phoneStoreTotals').textContent=q.units?`Things ${money(q.subtotal)} · delivery ${money(q.fee)} · total ${money(q.total)} · arrives ${arrivalText(nowMinutes(p)+q.delayMin)} (${etaText(nowMinutes(p)+q.delayMin,nowMinutes(p))})`:'';
  $('phoneStoreOrder').disabled=!q.units||!hasHome||p.cash<q.total;$('phoneStoreClear').disabled=!q.units;
  const list=$('phoneStoreOrders');list.replaceChildren();
  for(const w of o.waiting)list.append(el('p','phone-home-status',`Waiting at ${w.name}: ${w.units} thing${w.units===1?'':'s'}. Collect ${w.units===1?'it':'them'} at the drop spot.`));
  for(const order of o.queue)list.append(el('p','phone-home-status',order.vehicle?`On the way to ${order.homeName}: the ${order.vehicle}, arrives ${order.eta}. It will be parked on the driveway.`:`On the way to ${order.homeName}: ${order.units} thing${order.units===1?'':'s'}, arrives ${order.eta}.`));
  if(!o.waiting.length&&!o.queue.length)list.append(el('p','phone-home-status','No orders yet.'));
  // the Info view replaces the list while it is open
  const slot=infoModel&&MAP.vehicles.find(v=>v.model===infoModel),cls=infoModel&&CLASSES[infoModel];
  $('phoneStoreListView').hidden=!!slot;$('phoneStoreInfoView').hidden=!slot;
  if(slot&&cls){const colour=picked[infoModel],total=VEHICLE_PRICE[infoModel]+VEHICLE_ORDER.fee,stocked=inStock(p,infoModel,colour),full=vehicleCount(p)>=vehicleCapacity(p);
   $('phoneStoreInfoName').textContent=slot.name;const src=pictureFor(infoModel,colour);if(src&&$('phoneStoreInfoPicture').src!==src)$('phoneStoreInfoPicture').src=src;
   $('phoneStoreInfoSpecs').textContent=`${TIER_NAME[cls.tier]||cls.tier} · top speed ${mph(cls.top)} mph · ${cls.mpg} mpg · ${(slot.fuel.tankMgal/GALLON).toFixed(0)} gal ${fuelName(slot.fuel.type)} tank`;
   $('phoneStoreInfoPrice').textContent=`${colourOf(infoModel,colour).name} · ${money(VEHICLE_PRICE[infoModel])} + ${money(VEHICLE_ORDER.fee)} delivery to your home in 2 game days, or buy it on the Eastbank lot.`;
   $('phoneStoreInfoColours').replaceChildren(...coloursOf(infoModel).map(c=>{const ok=inStock(p,infoModel,c.id),chip=el('button','phone-swatch'+(c.id===colour?' selected':'')+(ok?'':' soldout'),'');chip.id=`phoneStoreInfoColour-${infoModel}-${c.id}`;chip.style.background=c.swatch;chip.disabled=!ok;chip.title=c.name;chip.setAttribute('aria-label',c.name);chip.onclick=()=>{picked[infoModel]=c.id;refresh()};return chip}));
   $('phoneStoreInfoNote').textContent=!stocked?`Sold out, back in ${Math.ceil(restockMinutes(p,infoModel,colour)/1440)} game days.`:!hasHome?'You need a home first to park a vehicle.':full?`No room: you hold ${vehicleCount(p)} of ${vehicleCapacity(p)} vehicles.`:'';
   $('phoneStoreInfoOrder').disabled=!stocked||full||!hasHome||p.cash<total}
 }
 // Back: closes the Info view if it is open (true), else leaves the phone to go back a screen (false)
 const back=()=>{if(!infoModel)return false;infoModel=null;refresh();return true};
 return {refresh,back,reset(){infoModel=null},get inInfo(){return !!infoModel}};
}
