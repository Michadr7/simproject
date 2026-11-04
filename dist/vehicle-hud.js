// The vehicle panel in the bottom-right dock (0.33, index.html #vehiclePanel). vehicleHudModel is pure (tested in tests/vehicle-hud.mjs): it turns the driving state into what the
// panel shows (imperial: miles an hour, gallons). createVehicleHud writes that to the page, and only when something changed.
import {fuelText,fuelTitle,mph} from './fuel.js';
export const STOP_SPEED=1; // m/s: below this you may get out (the same rule as game.js exitVehicle)

// fuel: {mgal, capacityMgal, type} of the vehicle you are in, or null.
export function vehicleHudModel({driving=null,seat=null,name=null,speed=0,fuel=null}={}){
 const fuelShown=fuel?`${fuelTitle(fuel.type)} · ${fuelText(fuel.mgal,fuel.capacityMgal)}`:'—',empty=!!fuel&&fuel.mgal<=0;
 if(!driving)return {state:'off',name:'Not in a vehicle',speed:'—',fuel:'—',
  keys:[],note:'Walk up to a vehicle’s door and press E to get in.'};
 const speedShown=`${mph(speed)} mph`;
 if(seat==='passenger')return {state:'riding',name:name||'Vehicle',speed:'—',fuel:fuelShown,
  keys:[{kbd:'E',text:'Get out'}],note:'You are riding as a passenger. Nobody is driving.'};
 const stopped=Math.abs(speed)<STOP_SPEED;
 return {state:'driving',name:name||'Vehicle',speed:speedShown,fuel:fuelShown,
  keys:[{kbd:'E',text:stopped?'Get out':'Stop to get out',muted:!stopped}],
  note:empty?`Out of fuel. Fill up at the Eastbank gas station: this one takes ${fuel.type}.`:'W S accelerate and brake · A D steer · Space brakes'};
}

// Writes a model into the panel. `$` is the page's getElementById helper. Returns update(model), which skips the DOM work when nothing changed.
export function createVehicleHud($){
 let last='';
 return function update(model){
  const key=JSON.stringify(model);
  if(key===last)return;last=key;
  const panel=$('vehiclePanel');if(!panel)return;
  panel.dataset.state=model.state;
  $('vpName').textContent=model.name;$('vpSpeed').textContent=model.speed;$('vpFuel').textContent=model.fuel;
  const keys=$('vpKeys');keys.replaceChildren();
  for(const k of model.keys){
   const row=document.createElement('div');row.className='vp-key';row.dataset.muted=String(!!k.muted);
   if(k.kbd){const kbd=document.createElement('kbd');kbd.textContent=k.kbd;row.append(kbd)}
   const text=document.createElement('span');text.textContent=k.text;row.append(text);keys.append(row);
  }
  $('vpNote').textContent=model.note;
 };
}
