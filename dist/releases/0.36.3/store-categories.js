// The Store's categories (0.34): one shown at a time, in a dropdown. An item's category comes from its type; a `soon` category is a placeholder button for a kind of thing that is not sold yet.
// Pure data: tests/store-categories.mjs.
export const CATEGORIES=Object.freeze([
 {id:'vehicles',label:'Vehicles'},
 {id:'clothing',label:'Clothing'},
 {id:'food',label:'Food'},
 {id:'drink',label:'Drink'},
 {id:'tools',label:'Tools'},
 {id:'furniture',label:'Furniture',soon:true},
 {id:'electronics',label:'Electronics',soon:true}
].map(Object.freeze));
export const categoryById=id=>CATEGORIES.find(c=>c.id===id)||null;
// Food and drink are their own; tools (the Axe, the Gas Can) and backpacks are Tools; other worn gear (jackets) is Clothing. Anything else (materials are not sold) has no shelf.
export function categoryOf(item){
 if(!item)return null;
 if(item.type==='food')return 'food';
 if(item.type==='drink')return 'drink';
 if(item.type==='tool')return 'tools';
 if(item.type==='equipment')return item.equipSlot==='backpack'?'tools':'clothing';
 return null;
}
