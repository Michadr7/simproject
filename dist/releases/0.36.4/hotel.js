// Pure hotel stay rules: paid nights, first-night voucher, guest parking access, and save normalising (notes/ironwood-city-design.md 3.4-3.6, I8/I10).
export const HOTEL=Object.freeze({
 id:'hotel-room',
 name:'Ironwood Hotel Suite',
 nightCents:2500,
 maxAdvanceNights:14,
 dropSpot:Object.freeze({x:26,z:-117.3,kind:'locker',yaw:0}),
 parkBay:Object.freeze({x:28,z:-96,yaw:0})
});

export const freshHotel=()=>({paidUntilDay:0,voucherUsed:false,voucherDay:0});
const int=(v,lo,hi,d=0)=>Number.isSafeInteger(v)?Math.max(lo,Math.min(hi,v)):d;

export function normalizeHotel(v){
 const a=v&&typeof v==='object'?v:{};
 const voucherUsed=a.voucherUsed===true;
 return {
  paidUntilDay:int(a.paidUntilDay,0,1e7,0),
  voucherUsed,
  voucherDay:voucherUsed?int(a.voucherDay,0,1e7,0):0
 };
}

export const currentDay=p=>int(p?.housing?.day,1,1e7,1);
export const hotelNightsLeft=p=>{const h=normalizeHotel(p?.hotel),d=currentDay(p);return Math.max(0,h.paidUntilDay-d+1)};
export const hotelRoomHeld=p=>hotelNightsLeft(p)>0;
export const hotelCanSleep=p=>{
 if(hotelRoomHeld(p))return true;
 const h=normalizeHotel(p?.hotel);
 return h.voucherUsed&&h.voucherDay===currentDay(p);
};

export function hotelTransaction(state,action,{nights=1}={}){
 const p=state&&typeof state==='object'?state:{},day=currentDay(p),h=normalizeHotel(p.hotel);
 const fail=error=>({state:p,error});
 if(action==='voucher'){
  if(h.voucherUsed)return fail('Your complimentary first-night pass has already been claimed.');
  const next={...h,voucherUsed:true,voucherDay:day};
  return {state:{...p,hotel:next},paid:0,message:'Complimentary first-night pass activated for the Ground Suite.'};
 }
 if(action==='pay-nights'){
  const count=int(nights,1,HOTEL.maxAdvanceNights,0);
  if(!count)return fail('Choose 1 to 14 nights.');
  const cost=count*HOTEL.nightCents,cash=int(p.cash,0,1e10,0);
  if(cash<cost)return fail(`Need $${(cost/100).toFixed(2)} for ${count} hotel night${count===1?'':'s'}.`);
  const base=Math.max(h.paidUntilDay,day-1);
  const next={...h,paidUntilDay:base+count};
  return {
   state:{...p,cash:cash-cost,hotel:next},
   paid:cost,
   nightsLeft:next.paidUntilDay-day+1,
   message:`Booked ${count} night${count===1?'':'s'} at ${HOTEL.name} ($${(cost/100).toFixed(2)}).`
  };
 }
 return fail('Unknown hotel action.');
}
