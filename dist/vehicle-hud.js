// The vehicle panel in the bottom-right dock (0.33, index.html #vehiclePanel). vehicleHudModel is pure (tested in tests/vehicle-hud.mjs): it turns the driving state into what the
// panel shows (imperial: miles an hour, gallons). createVehicleHud writes that to the page, and only when something changed.
import {fuelText,fuelTitle,mph} from './fuel.js';
import {bandOf,percent,lampOf} from './damage.js';
export const SILHOUETTES=['shortbed','worktruck','offroad','flatbed']; // the drawn vehicles in index.html (#vpDamage); any other model shows the generic one
export const STOP_SPEED=1; // m/s: below this you may get out (the same rule as game.js exitVehicle)

// fuel: {mgal, capacityMgal, type} of the vehicle you are in, or null.
// ground: {label, factor} (the surface under the wheels and the share of top speed it allows), or null.
// forklift: {speed, lift, load, hint, goal} while you drive the warehouse forklift: the panel names it, shows the fork height and the load in the fuel slot, lists every control (always on screen while driving)
// and says in its note what to do next and where (fork-guide.js forkGoal, one line) and why the forks are stopped or what to do with them (fork-pallets.js forkHint, the next line).
export function forkliftHudModel({speed=0,lift=0,load=0,hint='',goal=''}){
 const stopped=Math.abs(speed)<STOP_SPEED;
 return {state:'driving',name:'Forklift · indoor',speed:`${mph(speed)} mph`,fuel:`${lift.toFixed(2)} m · ${load?load+' planks':'empty'}`,fuelLabel:'Forks',
  keys:[{kbd:'W S',text:'Drive and reverse'},{kbd:'A D',text:'Steer (rear wheels: the back swings out)'},{kbd:'R F',text:'Raise and lower the forks'},{kbd:'Shift',text:'Hold to drive faster'},{kbd:'E',text:stopped?'Get off':'Stop to get off',muted:!stopped}],
  note:[goal,hint].filter(Boolean).join('\n')||'Slide the forks into a pallet, raise to lift it, lower to set it down. Indoor only.'};
}
// lights: the headlight row's text while you drive (night-lights-rules.js lightsLabel: "Lights: auto (on)"), or null for no row. Key L cycles auto, on, off.
// damage: {model, cond, engine} of the vehicle you are in (driving.damageOf), or null. The row carries the band id and the text, so the DOM changes only when they do.
export function damageRow(d){if(!d)return null;const b=bandOf(d.cond);return {model:SILHOUETTES.includes(d.model)?d.model:'generic',band:b.id,lamp:lampOf(d.cond),text:b.id==='wrecked'?'Wrecked · 0%':`${b.label} · ${percent(d.cond)}%`}}
export function vehicleHudModel({driving=null,seat=null,name=null,speed=0,fuel=null,ground=null,forklift=null,lights=null,damage=null}={}){
 if(forklift)return forkliftHudModel(forklift);
 const fuelShown=fuel?`${fuelTitle(fuel.type)} · ${fuelText(fuel.mgal,fuel.capacityMgal)}`:'—',empty=!!fuel&&fuel.mgal<=0;
 if(!driving)return {state:'off',name:'Not in a vehicle',speed:'—',fuel:'—',
  keys:[],note:'Walk up to a vehicle’s door and press E to get in.'};
 const speedShown=`${mph(speed)} mph`;
 const dmg=damageRow(damage);
 if(seat==='passenger')return {state:'riding',name:name||'Vehicle',speed:'—',fuel:fuelShown,damage:dmg,
  keys:[{kbd:'E',text:'Get out'}],note:'You are riding as a passenger. Nobody is driving.'};
 const stopped=Math.abs(speed)<STOP_SPEED;
 const wrecked=!!damage&&damage.cond<=0,engineNote=wrecked?'Wrecked: it will not start. E gets you out.':damage&&damage.engine==='off'?'The engine stalled. Press W to restart.':damage&&damage.engine==='crank'?'Starting the engine…':null;
 return {state:'driving',name:name||'Vehicle',speed:speedShown,fuel:fuelShown,damage:dmg,
  keys:[{kbd:'E',text:stopped?'Get out':'Stop to get out',muted:!stopped},...(lights?[{kbd:'L',text:lights}]:[])],
  note:engineNote?engineNote:empty?`Out of fuel. Fill up at the Eastbank gas station: this one takes ${fuel.type}.`:ground&&ground.factor<.95?`Off road · ${ground.label} · top speed ${Math.round(ground.factor*100)}%. Get back on the road to go faster.`:'W S accelerate and brake · A D steer · Space brakes'};
}

// Writes a model into the panel. `$` is the page's getElementById helper. Returns update(model), which skips the DOM work when nothing changed.
export function createVehicleHud($){
 let last='';
 const update=function(model){
  const key=JSON.stringify(model);
  if(key===last)return;last=key;
  const panel=$('vehiclePanel');if(!panel)return;
  panel.dataset.state=model.state;
  {const d=$('vpDamage');if(d){d.hidden=!model.damage;if(model.damage){if(d.dataset.model!==model.damage.model)d.dataset.model=model.damage.model;if(d.dataset.band!==model.damage.band)d.dataset.band=model.damage.band;const t=$('vpDmgText');if(t)t.textContent=model.damage.text;const l=$('vpLamp');if(l&&l.dataset.lamp!==model.damage.lamp)l.dataset.lamp=model.damage.lamp}}} // the band class changes only when the band does
  $('vpName').textContent=model.name;$('vpSpeed').textContent=model.speed;$('vpFuel').textContent=model.fuel;{const l=$('vpFuelLabel');if(l)l.textContent=model.fuelLabel||'Fuel'}
  const keys=$('vpKeys');keys.replaceChildren();
  for(const k of model.keys){
   const row=document.createElement('div');row.className='vp-key';row.dataset.muted=String(!!k.muted);
   if(k.kbd){const kbd=document.createElement('kbd');kbd.textContent=k.kbd;row.append(kbd)}
   const text=document.createElement('span');text.textContent=k.text;row.append(text);keys.append(row);
  }
  $('vpNote').textContent=model.note;
 };
 // VD7a: a counted crash pulses and shakes the damage row once (a CSS class, taken off when the animation ends); never per frame, never from the model, so the row's DOM text still changes only with the model
 update.pulse=()=>{const d=$('vpDamage');if(!d||d.hidden)return;if(!d.dataset.pulseHook){d.dataset.pulseHook='1';d.addEventListener('animationend',()=>d.classList.remove('hit'))}d.classList.remove('hit');void d.offsetWidth;d.classList.add('hit')};
 return update;
}
