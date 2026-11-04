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

// The fuel in a saved vehicle: an integer between 0 and its tank. A missing or bad value is a full tank (so old saves start full).
export function normalizeFuelMgal(value,tankMgal){
 if(!Number.isSafeInteger(value)||value<0||value>tankMgal)return tankMgal;
 return value;
}
export const gallons=mgal=>(mgal/GALLON).toFixed(1);
export const fuelText=(mgal,capacityMgal)=>mgal<=0?'Empty':`${gallons(mgal)} of ${(capacityMgal/GALLON).toFixed(0)} gal`;
