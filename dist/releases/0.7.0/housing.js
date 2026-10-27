export const STUDIO={deposit:3000,rent:1800,utilities:300,name:'Studio 2B',x:1,z:-6.3};
export const freshHousing=()=>({rented:false,day:1,rentDue:0,utilitiesDue:0});
export function normalizeHousing(value){const a=value&&typeof value==='object'?value:{},h=freshHousing();h.rented=a.rented===true;if(Number.isSafeInteger(a.day)&&a.day>=1&&a.day<=100000)h.day=a.day;for(const k of ['rentDue','utilitiesDue'])if(h.rented&&Number.isSafeInteger(a[k])&&a[k]>=0&&a[k]<=1e10)h[k]=a[k];return h}
export const totalDue=h=>h.rentDue+h.utilitiesDue;
export function housingTransaction(state,action,context={}){
 const housing=normalizeHousing(state.housing),s={...state,housing};
 if(action==='rent'){
  if(!context.atEntrance)return {state:s,error:'Visit the apartment entrance to rent.'};
  if(housing.rented)return {state:s,error:'You already rent this studio.'};
  if(s.cash<STUDIO.deposit+STUDIO.rent)return {state:s,error:'You need $48.00 to move in.'};
  return {state:{...s,cash:s.cash-STUDIO.deposit-STUDIO.rent,housing:{...housing,rented:true}}};
 }
 if(action==='rest'){
  if(!housing.rented||!context.atBed)return {state:s,error:'Use the bed in your studio to rest.'};
  if(housing.day>=100000)return {state:s,error:'Day limit reached.'};
  return {state:{...s,housing:{...housing,day:housing.day+1,rentDue:housing.rentDue+STUDIO.rent,utilitiesDue:housing.utilitiesDue+STUDIO.utilities}}};
 }
 if(action==='pay'){
  const due=totalDue(housing);if(!due)return {state:s,error:'All bills are paid.'};
  if(s.cash<due)return {state:s,error:'Earn enough to cover the outstanding bills.'};
  return {state:{...s,cash:s.cash-due,housing:{...housing,rentDue:0,utilitiesDue:0}}};
 }
 return {state:s,error:'Unknown housing action.'};
}
