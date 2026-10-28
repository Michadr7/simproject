export function normalizeLife(v={}){const n=(x,d)=>Number.isFinite(x)?Math.max(0,Math.min(100,x)):d;return {food:n(v?.food,100),thirst:n(v?.thirst,100),energy:n(v?.energy,100),groceries:Number.isInteger(v?.groceries)?Math.max(0,Math.min(20,v.groceries)):0}}
// Energy points per real second; rates are independent of rendering FPS.
export const ENERGY_RATES=Object.freeze({standing:.002,walking:.025,running:.07});
export const STAT_DRAIN_OPTIONS=Object.freeze([1,5,10,50]);
export const normalizeDrainMultiplier=value=>STAT_DRAIN_OPTIONS.includes(value)?value:1;
export function tickLife(life,dt,moving,running,loadMultiplier=1,drainMultiplier=1){
 const l=normalizeLife(life);dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.25)):0;
 const elapsed=dt*normalizeDrainMultiplier(drainMultiplier);
 const rate=moving?(running?ENERGY_RATES.running:ENERGY_RATES.walking)*loadMultiplier:ENERGY_RATES.standing;
 // Thirst drains faster than food. Depletion adds a 1 point/second penalty
 // (2 points/second when both are empty), scaled by the testing multiplier.
 const hungryFor=Math.max(0,elapsed-l.food/.018),thirstyFor=Math.max(0,elapsed-l.thirst/.028);
 l.food=Math.max(0,l.food-elapsed*.018);l.thirst=Math.max(0,l.thirst-elapsed*.028);
 l.energy=Math.max(0,l.energy-elapsed*rate-hungryFor-thirstyFor);return l;
}
export function lifeTransaction(state,action,place){const l=normalizeLife(state.life),s={...state,life:l};const fail=error=>({state:s,error});
 if(action==='groceries'){if(place!=='market')return fail('Visit the market cashier.');if(l.groceries>=20)return fail('Your bag is full.');if(s.cash<400)return fail('You need $4.00 for groceries.');return {state:{...s,cash:s.cash-400,life:{...l,groceries:l.groceries+1}},message:'Groceries packed · prepare a meal in your kitchen.'}}
 if(action==='drink'){if(place!=='market')return fail('Visit the market cashier.');if(s.cash<300)return fail('You need $3.00 for an energy drink.');if(l.energy>=100&&l.thirst>=100)return fail('You are already rested and hydrated.');return {state:{...s,cash:s.cash-300,life:{...l,energy:Math.min(100,l.energy+30),thirst:Math.min(100,l.thirst+25)}},message:'Energy drink · thirst +25, energy +30.'}}
 if(action==='meal'){if(place!=='cafe')return fail('Visit the café counter.');if(s.cash<600)return fail('You need $6.00 for lunch.');if(l.food>=100&&l.energy>=100&&l.thirst>=100)return fail('You are already full and rested.');return {state:{...s,cash:s.cash-600,life:{...l,food:Math.min(100,l.food+45),energy:Math.min(100,l.energy+15),thirst:Math.min(100,l.thirst+20)}},message:'Lunch enjoyed · food +45, thirst +20, energy +15.'}}
 if(action==='cook'){if(place!=='home')return fail('Use your home kitchen.');if(!l.groceries)return fail('Buy groceries at the market first.');if(l.food>=100&&l.energy>=100)return fail('You are already full and rested.');return {state:{...s,life:{...l,groceries:l.groceries-1,food:Math.min(100,l.food+65),energy:Math.min(100,l.energy+20)}},message:'Meal prepared · food +65, energy +20.'}}
 return fail('Unknown action.');}
