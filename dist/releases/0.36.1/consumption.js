import {createHeldItem,disposeHeldItem} from './item-models.js';

// Timeline (seconds): the right hand rises to the mouth, the item is used at USE_AT,
// then the empty hand lowers back to the animation pose. Nothing is ever scaled.
export const RAISE=.8,USE_AT=1,LOWER=.45,TOTAL=USE_AT+LOWER;
const EPS=1e-6;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};

// character: a createCharacter() result. update(dt) returns 'raising' until the item is used,
// 'used' exactly once at USE_AT (apply stats then), 'lowering' while the hand returns, and 'done'.
export function createConsumptionAnimation(character,item){
 const prop=createHeldItem(item);character.hold(prop,{upright:true});
 let elapsed=0,used=false,finished=false,propRemoved=false;
 function removeProp(){if(propRemoved)return;propRemoved=true;character.release();disposeHeldItem(prop)}
 function update(dt){
  if(finished)return 'done';
  elapsed=Math.min(TOTAL,elapsed+Math.max(0,Math.min(dt,.25)));
  if(elapsed<USE_AT-EPS){
   character.reach('R',character.mouth,smooth(elapsed/RAISE));
   // Drinks tip toward the lips at the end; food bobs once.
   const sip=smooth((elapsed-RAISE*.85)/(USE_AT-RAISE*.85));
   character.setHeldTilt(item.type==='drink'?sip*.7:Math.sin(sip*Math.PI)*.12);
   return 'raising';
  }
  if(!used){used=true;removeProp();character.reach('R',character.mouth,1);return 'used'}
  const t=smooth((elapsed-USE_AT)/LOWER);
  character.reach('R',character.mouth,1-t);
  if(elapsed>=TOTAL-EPS){finished=true;character.reach('R',character.mouth,0);return 'done'}
  return 'lowering';
 }
 // Interrupted (scene change, reload): remove the item and drop the arm at once.
 function dispose(){removeProp();if(!finished){finished=true;character.reach('R',character.mouth,0)}}
 return {prop,update,dispose,get used(){return used},get finished(){return finished}};
}
