import {MAP} from './map-definition.js';
// Amounts are integer cents. One billing function serves both sleep and midnight.
export const STUDIO={deposit:3000,rent:6000,utilities:700,name:'Studio 2B',x:MAP.studio.x,z:MAP.studio.z};
export const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const weekday=day=>WEEKDAYS[(Math.max(1,Math.floor(day))-1)%7];
export const weekNumber=day=>Math.floor((Math.max(1,Math.floor(day))-1)/7)+1;
export const freshHousing=()=>({billingVersion:2,rented:false,day:1,rentDue:0,utilitiesDue:0,nextBillDay:8,utilityUsage:0});
export function normalizeHousing(value){const a=value&&typeof value==='object'?value:{},h=freshHousing();h.rented=a.rented===true;if(Number.isSafeInteger(a.day)&&a.day>=1&&a.day<=100000)h.day=a.day;for(const k of ['rentDue','utilitiesDue'])if(h.rented&&Number.isSafeInteger(a[k])&&a[k]>=0&&a[k]<=1e10)h[k]=a[k];h.nextBillDay=h.day+7;if(a.billingVersion===2){if(Number.isSafeInteger(a.nextBillDay)&&a.nextBillDay>=1&&a.nextBillDay<=100007)h.nextBillDay=a.nextBillDay;if(Number.isSafeInteger(a.utilityUsage)&&a.utilityUsage>=0&&a.utilityUsage<=1e8)h.utilityUsage=a.utilityUsage}return h}
export const totalDue=h=>h.rentDue+h.utilitiesDue;
export const estimatedUtilities=h=>STUDIO.utilities+h.utilityUsage;
export const dueIn=h=>Math.max(0,h.nextBillDay-h.day);
export function advanceHousingDays(value,days){const h=normalizeHousing(value);h.day=Math.min(100000,h.day+Math.max(0,Math.floor(days)));if(h.rented&&h.day>=h.nextBillDay){const cycles=Math.floor((h.day-h.nextBillDay)/7)+1;h.rentDue+=cycles*STUDIO.rent;h.utilitiesDue+=cycles*STUDIO.utilities+h.utilityUsage;h.utilityUsage=0;h.nextBillDay+=cycles*7}return h}
export function housingTransaction(state,action,context={}){
 const housing=normalizeHousing(state.housing),s={...state,housing};
 if(action==='rent'){if(!context.atEntrance)return {state:s,error:'Visit the apartment entrance to rent.'};if(housing.rented)return {state:s,error:'You already rent this studio.'};if(s.cash<STUDIO.deposit+STUDIO.rent)return {state:s,error:'You need $90.00: $30 deposit and $60 for the first week.'};return {state:{...s,cash:s.cash-STUDIO.deposit-STUDIO.rent,housing:{...housing,rented:true,nextBillDay:housing.day+7,utilityUsage:0}}}}
 if(action==='rest'){if(!housing.rented||!context.atBed)return {state:s,error:'Use the bed in your studio to rest.'};return {state:{...s,life:{...s.life,energy:100}}}}
 if(action==='pay'){const due=totalDue(housing);if(!due)return {state:s,error:'All bills are paid.'};if(s.cash<due)return {state:s,error:'Earn enough to cover the outstanding bills.'};return {state:{...s,cash:s.cash-due,housing:{...housing,rentDue:0,utilitiesDue:0}}}}
 return {state:s,error:'Unknown housing action.'};
}
