// Fuel (0.35, DESIGN 4.13 I): the pure rules. No THREE, no DOM, no game state, so a relay can run the same sale later. Imperial: gallons, dollars a gallon, miles an hour.
// Money is integer cents; fuel is integer milli-gallons (1 gallon = 1000). A step is 50 milli-gallons (0.05 gal), and prices are multiples of 20 cents a gallon, so every step costs a whole
// number of cents. Placeholders, tuned later: the prices, the flow, the burn rate (tank sizes are in map-definition.js).
export const GALLON=1000;
export const PRICE_CENTS_PER_GAL=Object.freeze({gas:400,diesel:420}); // $4.00 and $4.20 a gallon
export const FLOW_MGAL_PER_S=500; // a nozzle fills half a gallon a second
export const STEP_MGAL=50;
export const HOSE_MAX_M=3.5; // the hose is 3.5 m (11.5 ft); past this the nozzle goes back to its holster
export const REACH_M=1.5; // the nozzle must be this close to the filler cap (ground distance)
export const USE_RANGE_M=1.2; // how close to a pump's use spot you must stand to take its nozzle
export const FUEL_TYPES=Object.freeze(['gas','diesel']);
const METRES_PER_MILE=1609.344,MPH_PER_MS=2.2369363;

export const costPerStep=fuel=>PRICE_CENTS_PER_GAL[fuel]*STEP_MGAL/GALLON; // whole cents, given the price rule above
export const priceLabel=fuel=>`$${(PRICE_CENTS_PER_GAL[fuel]/100).toFixed(2)}/gal`;
export const fuelName=fuel=>fuel==='diesel'?'diesel':'gas';
export const fuelTitle=fuel=>fuel==='diesel'?'Diesel':'Gas';
export const mph=metresPerSecond=>Math.round(Math.abs(metresPerSecond)*MPH_PER_MS);

// How much a vehicle burns for the distance it travels (gallons per mile: an arcade placeholder, far thirstier than a real truck so that a tank matters on this small map).
export const burnMgal=(metres,gallonsPerMile)=>Math.max(0,metres)/METRES_PER_MILE*gallonsPerMile*GALLON;

// Sell fuel from a pump into a target.
//   state:  {cash, target: {fuel, mgal, capacityMgal}}  (cash in cents)
//   action: {pump: {fuel}, mgal}                         (milli-gallons asked for, in whole steps)
// Returns {cash, target, soldMgal, cents} with the request clipped to what fits and what can be paid (a request is never refused partway),
// or {error, code} where code is 'invalid', 'wrong-fuel', 'full' or 'broke'.
export function sell(state,action){
 const cash=state?.cash,target=state?.target,pump=action?.pump,mgal=action?.mgal;
 if(!Number.isSafeInteger(cash)||cash<0||!target||!Number.isSafeInteger(target.mgal)||!Number.isSafeInteger(target.capacityMgal)||target.mgal<0||target.capacityMgal<0)return {error:'Bad sale.',code:'invalid'};
 if(!pump||PRICE_CENTS_PER_GAL[pump.fuel]===undefined||!Number.isSafeInteger(mgal)||mgal<=0||mgal%STEP_MGAL!==0)return {error:'Bad sale.',code:'invalid'};
 if(target.fuel!==pump.fuel)return {error:`This one takes ${fuelName(target.fuel)}, not ${fuelName(pump.fuel)}.`,code:'wrong-fuel'};
 const room=target.capacityMgal-target.mgal;
 if(room<STEP_MGAL)return {error:'The tank is full.',code:'full'};
 const perStep=costPerStep(pump.fuel);
 if(cash<perStep)return {error:'You cannot pay for any more fuel.',code:'broke'};
 const steps=Math.min(mgal/STEP_MGAL,Math.floor(room/STEP_MGAL),Math.floor(cash/perStep));
 const soldMgal=steps*STEP_MGAL,cents=steps*perStep;
 return {cash:cash-cents,target:{...target,mgal:target.mgal+soldMgal},soldMgal,cents};
}

// The gas can (0.35): 5 gallons of one fuel. Filling it at a pump is a sale into the can (the same prices and steps as a tank); pouring it into a vehicle is free and moves as much as fits.
//   fillCan({cash, can: {fuel, mgal}}, {pump: {fuel}, mgal}) -> {cash, can, soldMgal, cents} | {error, code}   (an empty can takes whatever the pump sells; a can with fuel only its own)
//   pour({can: {fuel, mgal}, target: {fuel, mgal, capacityMgal}, mgal}) -> {can, target, movedMgal} | {error, code: 'empty' | 'wrong-fuel' | 'full' | 'invalid'}
export const CAN_CAPACITY_MGAL=5000;
export function fillCan(state,action){
 const can=state?.can;if(!can||!Number.isSafeInteger(can.mgal)||can.mgal<0||can.mgal>CAN_CAPACITY_MGAL)return {error:'Bad sale.',code:'invalid'};
 const pumpFuel=action?.pump?.fuel,fuel=can.mgal>0?can.fuel:pumpFuel;
 const r=sell({cash:state.cash,target:{fuel,mgal:can.mgal,capacityMgal:CAN_CAPACITY_MGAL}},action);
 if(r.error)return r.code==='wrong-fuel'?{error:`This can holds ${fuelName(can.fuel)}, not ${fuelName(pumpFuel)}.`,code:'wrong-fuel'}:r.code==='full'?{error:'The can is full.',code:'full'}:r;
 return {cash:r.cash,can:{fuel,mgal:r.target.mgal},soldMgal:r.soldMgal,cents:r.cents};
}
export function pour(state){
 const can=state?.can,target=state?.target,want=state?.mgal;
 if(!can||!target||!Number.isSafeInteger(can.mgal)||!Number.isSafeInteger(target.mgal)||!Number.isSafeInteger(target.capacityMgal)||!(want>0))return {error:'Bad pour.',code:'invalid'};
 if(can.mgal<=0)return {error:'The can is empty.',code:'empty'};
 if(can.fuel!==target.fuel)return {error:`The can holds ${fuelName(can.fuel)}; this takes ${fuelName(target.fuel)}.`,code:'wrong-fuel'};
 const room=target.capacityMgal-target.mgal;if(room<=0)return {error:'The tank is full.',code:'full'};
 const moved=Math.min(Math.floor(want),can.mgal,room),left=can.mgal-moved;
 return {can:{fuel:left>0?can.fuel:null,mgal:left},target:{...target,mgal:target.mgal+moved},movedMgal:moved};
}
export const canText=can=>!can||can.mgal<=0?'Empty gas can':`${fuelTitle(can.fuel)} · ${gallons(can.mgal)} of ${(CAN_CAPACITY_MGAL/GALLON).toFixed(0)} gal`;

// The fuel in a saved vehicle: an integer between 0 and its tank. A missing or bad value is a full tank (so old saves start full).
export function normalizeFuelMgal(value,tankMgal){
 if(!Number.isSafeInteger(value)||value<0||value>tankMgal)return tankMgal;
 return value;
}
export const gallons=mgal=>(mgal/GALLON).toFixed(1);
export const fuelText=(mgal,capacityMgal)=>mgal<=0?'Empty':`${gallons(mgal)} of ${(capacityMgal/GALLON).toFixed(0)} gal`;
