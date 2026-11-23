// Home cooking 8-recipe table and pure inventory helpers (notes/cooking-design.md section 4, L-PURE).
export const HOSPITALITY_BONUS_PER_2_LEVELS=0.05;
export const HOSPITALITY_BONUS_CAP=0.25;

const ing=(id,qty=1)=>Object.freeze({id,qty});
const recipe=(id,name,ingredients,cookSec,burnSec,gameMinutes,food,thirst,energy,xp,packItem=null,servings=1)=>Object.freeze({
 id,name,ingredients:Object.freeze(ingredients),cookSec,burnSec,gameMinutes,food,thirst,energy,xp,packItem,servings
});

export const RECIPES=Object.freeze([
 recipe('home-coffee','Mug of Coffee',[ing('ground-coffee',1)],2.5,6,5,0,20,25,4,'coffee',1),
 recipe('fried-eggs','Fried Eggs',[ing('eggs',1)],3.0,7,8,35,0,12,4,null,1),
 recipe('egg-toast','Egg on Toast',[ing('eggs',1),ing('bread-loaf',1)],3.5,8,10,55,0,20,5,null,1),
 recipe('pancakes','Stack of Pancakes',[ing('flour-bag',1),ing('eggs',1),ing('milk',1)],4.5,9,15,70,0,25,7,null,2),
 recipe('veggie-omelette','Veggie Omelette',[ing('eggs',1),ing('produce',1)],4.0,8,12,65,5,22,6,null,1),
 recipe('grilled-sandwich','Toasted Sandwich',[ing('bread-loaf',1),ing('produce',1)],3.0,7,8,50,5,15,5,'sandwich',1),
 recipe('hearty-soup','Hearty Vegetable Soup',[ing('produce',2),ing('bread-loaf',1)],5.0,11,18,75,20,25,7,'soup',1),
 recipe('camp-skillet','Hearty Skillet',[ing('meat-pack',1),ing('produce',1),ing('eggs',1)],5.5,11,20,90,0,35,8,null,1)
]);

const BY_ID=Object.freeze(Object.fromEntries(RECIPES.map(r=>[r.id,r])));
export const COOKING_INGREDIENTS=Object.freeze([...new Set(RECIPES.flatMap(r=>r.ingredients.map(i=>i.id)))]);

const slotsOf=inv=>Array.isArray(inv)?inv:Array.isArray(inv?.slots)?inv.slots:[];
const countIn=(slots,id)=>slots.reduce((n,s)=>n+(s?.id===id&&Number.isInteger(s.quantity)&&s.quantity>0?s.quantity:0),0);

export const recipeFor=id=>typeof id==='string'?BY_ID[id]||null:null;

export function canCook(inventory,recipeOrId){
 const r=typeof recipeOrId==='string'?recipeFor(recipeOrId):recipeOrId;
 if(!r||!Array.isArray(r.ingredients)||!r.ingredients.length)return false;
 const slots=slotsOf(inventory);
 return r.ingredients.every(req=>countIn(slots,req.id)>=req.qty);
}

// Returns a new inventory (or slot array if an array was passed) with ingredients deducted, or null if missing.
export function consume(inventory,recipeOrId){
 const r=typeof recipeOrId==='string'?recipeFor(recipeOrId):recipeOrId;
 if(!canCook(inventory,r))return null;
 const need=Object.fromEntries(r.ingredients.map(req=>[req.id,req.qty]));
 const nextSlots=[];
 for(const slot of slotsOf(inventory)){
  if(!slot||typeof slot!=='object'){continue}
  const rem=need[slot.id]||0;
  if(rem<=0||!Number.isInteger(slot.quantity)||slot.quantity<=0){nextSlots.push({...slot});continue}
  const take=Math.min(slot.quantity,rem);
  need[slot.id]=rem-take;
  if(slot.quantity-take>0)nextSlots.push({...slot,quantity:slot.quantity-take});
 }
 return Array.isArray(inventory)?nextSlots:{...(inventory&&typeof inventory==='object'?inventory:{}),slots:nextSlots};
}

export function hospitalityBonus(level=1){
 const lv=Number.isFinite(level)?Math.max(1,Math.floor(level)):1;
 return Math.min(HOSPITALITY_BONUS_CAP,Math.floor(lv/2)*HOSPITALITY_BONUS_PER_2_LEVELS);
}

export function scaledOutput(recipeOrId,qualityMult=1,hospitalityLevel=1){
 const r=typeof recipeOrId==='string'?recipeFor(recipeOrId):recipeOrId;
 if(!r)return null;
 const q=Number.isFinite(qualityMult)?Math.max(0,qualityMult):1;
 const scale=q*(1+hospitalityBonus(hospitalityLevel));
 return {
  food:Math.round(r.food*scale),
  thirst:Math.round(r.thirst*scale),
  energy:Math.round(r.energy*scale),
  xp:q>0?Math.max(1,Math.round(r.xp*(q>=1?1:0.5))):0
 };
}
