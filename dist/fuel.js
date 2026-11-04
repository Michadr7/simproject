// Fuel (0.35, DESIGN 4.13 I): the pure rules. No THREE, no DOM, no game state, so a relay can run the same sale later.
// Money is integer cents; fuel is integer millilitres. A step is 100 ml, and prices are multiples of 10 cents per litre, so every step costs a whole number of cents.
// Placeholders, tuned later: the prices, the flow, the burn rate, the tank sizes (tank sizes are in map-definition.js).
export const PRICE_CENTS_PER_L=Object.freeze({petrol:200,diesel:210});
export const FLOW_ML_PER_S=2000; // a nozzle fills 2 L a second
export const STEP_ML=100;
export const HOSE_MAX_M=3.5; // past this the nozzle goes back to its holster
export const REACH_M=1.5; // the nozzle must be this close to the filler (ground distance)
export const USE_RANGE_M=1.2; // how close to a pump's use spot you must stand to take its nozzle

export const costPerStep=fuel=>PRICE_CENTS_PER_L[fuel]*STEP_ML/1000; // whole cents, given the price rule above
export const priceLabel=fuel=>`$${(PRICE_CENTS_PER_L[fuel]/100).toFixed(2)}/L`;
export const fuelName=fuel=>fuel==='diesel'?'diesel':'petrol';

// How much a vehicle burns for the distance it travels (litres per 100 m, a placeholder).
export const burnMl=(metres,litresPer100m)=>Math.max(0,metres)*litresPer100m*10; // 1 L per 100 m = 10 ml per metre

// Sell fuel from a pump into a target.
//   state:  {cash, target: {fuel, ml, capacityMl}}  (cash in cents)
//   action: {pump: {fuel}, ml}                       (ml asked for, in whole steps)
// Returns {cash, target, soldMl, cents} with the request clipped to what fits and what can be paid (a request is never refused partway),
// or {error, code} where code is 'invalid', 'wrong-fuel', 'full' or 'broke'.
export function sell(state,action){
 const cash=state?.cash,target=state?.target,pump=action?.pump,ml=action?.ml;
 if(!Number.isSafeInteger(cash)||cash<0||!target||!Number.isSafeInteger(target.ml)||!Number.isSafeInteger(target.capacityMl)||target.ml<0||target.capacityMl<0)return {error:'Bad sale.',code:'invalid'};
 if(!pump||PRICE_CENTS_PER_L[pump.fuel]===undefined||!Number.isSafeInteger(ml)||ml<=0||ml%STEP_ML!==0)return {error:'Bad sale.',code:'invalid'};
 if(target.fuel!==pump.fuel)return {error:`This one takes ${target.fuel==='diesel'?'diesel':'petrol'}, not ${fuelName(pump.fuel)}.`,code:'wrong-fuel'};
 const room=target.capacityMl-target.ml;
 if(room<STEP_ML)return {error:'The tank is full.',code:'full'};
 const perStep=costPerStep(pump.fuel);
 if(cash<perStep)return {error:'You cannot pay for any more fuel.',code:'broke'};
 const steps=Math.min(ml/STEP_ML,Math.floor(room/STEP_ML),Math.floor(cash/perStep));
 const soldMl=steps*STEP_ML,cents=steps*perStep;
 return {cash:cash-cents,target:{...target,ml:target.ml+soldMl},soldMl,cents};
}

// The fuel in a saved vehicle: an integer between 0 and its tank. A missing or bad value is a full tank (so old saves start full).
export function normalizeFuelMl(value,tankMl){
 if(!Number.isSafeInteger(value)||value<0||value>tankMl)return tankMl;
 return value;
}
export const fuelText=(ml,capacityMl)=>ml<=0?'Empty':`${(ml/1000).toFixed(1)} L of ${(capacityMl/1000).toFixed(0)} L`;
