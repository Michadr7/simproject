// Diner recipes, rank unlocks, and order scoring (notes/diner-design.md).
export const CATEGORIES=Object.freeze(['drink','burger','sandwich','pizza']);
export const STATIONS=Object.freeze(['espresso','grill','prep','oven']);
export const MIN_TIP_CENTS=50,MAX_TIP_CENTS=300,PASS_QUALITY=0.5;

const p=(id,slot,required=true,heat=false)=>Object.freeze(heat?{id,slot,required,heat:true}:{id,slot,required});
const r=(id,name,category,station,minRank,cookSec,burnSec,priceCents,parts)=>Object.freeze({
 id,name,category,station,minRank,cookSec,burnSec,priceCents,parts:Object.freeze(parts)
});

export const RECIPES=Object.freeze([
 r('espresso','Espresso','drink','espresso',2,3,6,250,[p('cup_demitasse','cup'),p('coffee_grounds','grind'),p('espresso_shot','shot',true,true)]),
 r('americano','Americano','drink','espresso',2,3,6,300,[p('cup_mug','cup'),p('coffee_grounds','grind'),p('espresso_shot','shot',true,true),p('hot_water','finish')]),
 r('latte','Latte','drink','espresso',2,3,6,400,[p('cup_mug','cup'),p('coffee_grounds','grind'),p('espresso_shot','shot',true,true),p('steamed_milk','milk',true,true)]),
 r('iced_latte','Iced Latte','drink','espresso',2,3,6,450,[p('cup_iced','cup'),p('ice','ice'),p('cold_milk','milk'),p('coffee_grounds','grind'),p('espresso_shot','shot',true,true)]),
 r('cappuccino','Cappuccino','drink','espresso',3,3,6,425,[p('cup_mug','cup'),p('coffee_grounds','grind'),p('espresso_shot','shot',true,true),p('milk_foam','milk',true,true)]),
 r('hot_chocolate','Hot Chocolate','drink','espresso',3,3,7,350,[p('cup_mug','cup'),p('cocoa','base'),p('steamed_milk','milk',true,true)]),
 r('tea','Tea','drink','espresso',3,2,8,250,[p('cup_mug','cup'),p('tea_bag','base'),p('hot_water','finish',true,true)]),
 r('iced_tea','Iced Tea','drink','espresso',3,2,8,300,[p('cup_iced','cup'),p('ice','ice'),p('tea_bag','base',true,true)]),
 r('classic_burger','Classic Burger','burger','grill',2,5,9,650,[p('bun_bottom','bottom'),p('patty','protein',true,true),p('lettuce','topping'),p('tomato','topping'),p('onion','topping',false),p('sauce','sauce'),p('bun_top','top')]),
 r('cheeseburger','Cheeseburger','burger','grill',2,5,9,750,[p('bun_bottom','bottom'),p('patty','protein',true,true),p('cheese','cheese'),p('lettuce','topping'),p('tomato','topping'),p('sauce','sauce'),p('bun_top','top')]),
 r('bacon_burger','Bacon Burger','burger','grill',3,5,9,850,[p('bun_bottom','bottom'),p('patty','protein',true,true),p('cheese','cheese'),p('bacon','protein',true,true),p('lettuce','topping'),p('tomato','topping'),p('sauce','sauce'),p('bun_top','top')]),
 r('grilled_cheese','Grilled Cheese','sandwich','grill',2,4,9,550,[p('bread_bottom','bottom'),p('cheese','cheese',true,true),p('bread_top','top',true,true)]),
 r('egg_melt','Egg Melt','sandwich','grill',2,5,9,650,[p('bread_bottom','bottom'),p('fried_egg','protein',true,true),p('cheese','cheese'),p('bread_top','top',true,true)]),
 r('blt','BLT Sandwich','sandwich','grill',3,4,9,700,[p('bread_bottom','bottom'),p('bacon','protein',true,true),p('lettuce','topping'),p('tomato','topping'),p('sauce','sauce',false),p('bread_top','top')]),
 r('club','Club Sandwich','sandwich','prep',3,4,9,800,[p('bread_bottom','bottom'),p('ham','protein'),p('bacon','protein',true,true),p('cheese','cheese'),p('lettuce','topping'),p('tomato','topping'),p('sauce','sauce'),p('bread_top','top')]),
 r('margherita','Margherita Pizza','pizza','oven',2,7,12,800,[p('dough_base','base'),p('tomato_sauce','sauce'),p('mozzarella','cheese',true,true)]),
 r('pepperoni','Pepperoni Pizza','pizza','oven',2,7,12,900,[p('dough_base','base'),p('tomato_sauce','sauce'),p('mozzarella','cheese',true,true),p('pepperoni','topping',true,true)]),
 r('veggie','Veggie Pizza','pizza','oven',3,7,12,950,[p('dough_base','base'),p('tomato_sauce','sauce'),p('mozzarella','cheese',true,true),p('mushroom','topping'),p('onion','topping'),p('pepper','topping'),p('olives','topping',false)])
]);

const BY_ID=Object.freeze(Object.fromEntries(RECIPES.map(x=>[x.id,x])));
export const RANK_UNLOCKS=Object.freeze({
 1:Object.freeze([]),
 2:Object.freeze(RECIPES.filter(x=>x.minRank<=2).map(x=>x.id)),
 3:Object.freeze(RECIPES.filter(x=>x.minRank<=3).map(x=>x.id)),
 4:Object.freeze(RECIPES.filter(x=>x.minRank<=4).map(x=>x.id))
});

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const recipeById=id=>typeof id==='string'?BY_ID[id]||null:null;
export const recipesForRank=rank=>RECIPES.filter(x=>x.minRank<=(Number(rank)||1));
export const menuForRank=rank=>RECIPES.filter(x=>x.minRank<=Math.max(2,Number(rank)||1));
export const isUnlocked=(recipeOrId,rank)=>{const x=typeof recipeOrId==='string'?recipeById(recipeOrId):recipeOrId;return !!x&&(Number(rank)||1)>=x.minRank};

export function tipFor(quality,waitGameMin=0,cookSpeed=1){
 if(!Number.isFinite(quality)||quality<PASS_QUALITY)return 0;
 const w=Number.isFinite(waitGameMin)?Math.max(0,waitGameMin):0;
 const waitScore=1-clamp((w-15)/85,0,1);
 const speedScore=w>0?waitScore*0.7+clamp(cookSpeed,0,1)*0.3:clamp(cookSpeed,0,1);
 const qNorm=clamp((quality-PASS_QUALITY)/(1-PASS_QUALITY),0,1);
 return Math.round(MIN_TIP_CENTS+(MAX_TIP_CENTS-MIN_TIP_CENTS)*(qNorm*0.7+speedScore*0.3));
}

export function scoreOrder(recipeOrId,madeParts=[],cookSecs=0,waitGameMin=0){
 const recipe=typeof recipeOrId==='string'?recipeById(recipeOrId):recipeOrId;
 if(!recipe||!Array.isArray(recipe.parts))return {ok:false,quality:0,missing:[],burnt:false,tipCents:0};
 const made=(Array.isArray(madeParts)?madeParts:[]).map(x=>typeof x==='string'?x:x?.id).filter(x=>typeof x==='string');
 const req=recipe.parts.filter(x=>x.required!==false),allowed=new Set(recipe.parts.map(x=>x.id));
 const orderMap=new Map(recipe.parts.map((x,i)=>[x.id,i]));
 const missing=req.filter(x=>!made.includes(x.id)).map(x=>x.id);
 const extra=made.filter(id=>!allowed.has(id));
 let wrongOrder=false,prev=-1;
 for(const id of made){const idx=orderMap.get(id);if(idx===undefined)continue;if(idx<prev){wrongOrder=true;break}prev=idx}
 const cook=Number.isFinite(cookSecs)?Math.max(0,cookSecs):0;
 const burnt=recipe.burnSec>0&&cook>=recipe.burnSec;
 let cookPen=0;
 if(burnt)cookPen=0.65;
 else if(recipe.cookSec>0){
  if(cook<recipe.cookSec*0.4)cookPen=0.6;
  else if(cook<recipe.cookSec*0.8)cookPen=0.2;
  else if(recipe.burnSec>recipe.cookSec&&cook>recipe.cookSec*1.25)cookPen=0.1;
 }
 const rawQ=1-0.3*missing.length-0.25*extra.length-(wrongOrder?0.1:0)-cookPen;
 const quality=Math.round(clamp(rawQ,0,1)*100)/100;
 const ok=!burnt&&quality>=PASS_QUALITY&&missing.length<req.length;
 const cookSpeed=recipe.burnSec>recipe.cookSec&&cook>recipe.cookSec?1-clamp((cook-recipe.cookSec)/(recipe.burnSec-recipe.cookSec),0,1):1;
 const tipCents=ok?tipFor(quality,waitGameMin,cookSpeed):0;
 return {ok,quality,missing,burnt,tipCents};
}
