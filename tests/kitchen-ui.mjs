// Kitchen & 20-slot Fridge UI tests (8 recipes, split bag+fridge cooking, transfers).
import assert from 'node:assert/strict';
import {RECIPES,recipeFor} from '../dist/recipes.js';
import {createKitchenUI,canCookFromPools,consumeFromPools} from '../dist/kitchen-ui.js';

function el(tag='div',id=''){
 const classes=new Set(),node={
  tagName:tag.toUpperCase(),id,hidden:false,disabled:false,textContent:'',className:'',children:[],dataset:{},attributes:{},
  classList:{add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),toggle:(c,v)=>v===undefined?(classes.has(c)?classes.delete(c):classes.add(c)):(v?classes.add(c):classes.delete(c)),contains:c=>classes.has(c)},
  setAttribute:(k,v)=>{node.attributes[k]=String(v)},
  append:(...kids)=>{for(const k of kids)if(k)node.children.push(k)},
  replaceChildren:(...kids)=>{node.children=[];node.append(...kids)},
  focus:()=>{}
 };
 return node;
}
function makeDoc(ids){
 const byId=new Map(ids.map(id=>[id,el('div',id)]));
 return {
  byId,activeElement:null,
  getElementById:id=>byId.get(id)||null,
  createElement:tag=>el(tag)
 };
}

// 1. Pure combined bag + fridge cooking helpers
const toast=recipeFor('egg-toast');
const invSplit={slots:[{id:'bread-loaf',quantity:1}],extraSlots:0};
const fridgeSplit=[{id:'eggs',quantity:1}];
assert.equal(canCookFromPools(invSplit,fridgeSplit,toast),true,'split ingredients cook Egg on Toast');
const cookedSplit=consumeFromPools(invSplit,fridgeSplit,toast);
assert.equal(cookedSplit.inventory.slots.length,0,'consumed bread from inventory');
assert.equal(cookedSplit.fridge.length,0,'consumed eggs from fridge');

// 2. Full UI drawer: 8 recipes, combined cookability, store/take callbacks
const doc=makeDoc(['kitchenOverlay','kitchenClose','kitchenMessage','kitchenSummary','kitchenFridgeCap','kitchenBagCap','kitchenGroceries','kitchenRecipes','kitchenFridge','kitchenBag','kitchenStoreAll']);
let state={progress:{inventory:{slots:[{id:'bread-loaf',quantity:2},{id:'produce',quantity:1}],equipment:{}},life:{groceries:0},housing:{fridge:[{id:'eggs',quantity:1}]}}};
let fridge=state.progress.housing.fridge,cooked=null,stored=null,took=null,closedCount=0;
const ui=createKitchenUI({
 document:doc,
 getState:()=>state,
 homeFridge:()=>fridge,
 canOpen:()=>true,
 onOpen:()=>{},
 onClose:()=>{closedCount++},
 onCook:r=>{cooked=r.id},
 onStoreOne:id=>{stored=id;return {message:'Stored '+id}},
 onStoreAll:()=>({message:'Stored all'}),
 onTakeOne:id=>{took=id;return {message:'Took '+id}},
 onGroceries:()=>{}
});

ui.open();
assert.equal(ui.isOpen,true,'drawer opens');
assert.equal(doc.byId.get('kitchenOverlay').hidden,false);
assert.equal(doc.byId.get('kitchenRecipes').children.length,RECIPES.length,'renders all 8 recipes');

const findCookBtn=id=>{
 for(const card of doc.byId.get('kitchenRecipes').children){
  const btn=card.children.find(c=>c.id==='cook-'+id);
  if(btn)return btn;
 }
 return null;
};
assert.equal(findCookBtn('egg-toast').disabled,false,'Egg on Toast cookable from bag+fridge');
assert.equal(findCookBtn('grilled-sandwich').disabled,false,'Toasted Sandwich cookable from bag');
assert.equal(findCookBtn('camp-skillet').disabled,true,'Hearty Skillet disabled when meat missing');

// Transfer buttons in Fridge & Bag sections
doc.byId.get('kitchenFridge').children[0].children[2].onclick();
assert.equal(took,'eggs','fridge take button fires onTakeOne');
doc.byId.get('kitchenBag').children[0].children[2].onclick();
assert.equal(stored,'bread-loaf','bag store button fires onStoreOne');

// Cooking closes drawer and passes recipe
findCookBtn('fried-eggs').onclick();
assert.equal(cooked,'fried-eggs');
assert.equal(ui.isOpen,false);
assert.equal(closedCount,1);

console.log('PASS kitchen-ui: all 8 recipes rendered, split bag+fridge cooking, 20-slot fridge & bag transfers');
