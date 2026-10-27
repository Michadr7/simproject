// Restoration values are points; prices are cents. Equipment bonuses never stack by type.
const food=(id,name,icon,foodRestore,thirstRestore,energyRestore,price)=>({id,name,type:'food',icon,foodRestore,thirstRestore,energyRestore,price,stackLimit:10});
const drink=(id,name,icon,foodRestore,thirstRestore,energyRestore,price)=>({id,name,type:'drink',icon,foodRestore,thirstRestore,energyRestore,price,stackLimit:10});
// Tools are used from the world (E), never consumed. Materials are gathered, not sold in shops.
const tool=(id,name,icon,description,price)=>({id,name,type:'tool',icon,description,foodRestore:0,thirstRestore:0,energyRestore:0,price,stackLimit:1});
const material=(id,name,icon,description,price)=>({id,name,type:'material',icon,description,foodRestore:0,thirstRestore:0,energyRestore:0,price,stackLimit:10,buyable:false});
const equipment=(id,name,icon,equipSlot,slotBonus,price)=>({id,name,type:'equipment',icon,equipSlot,slotBonus,foodRestore:0,thirstRestore:0,energyRestore:0,price,stackLimit:1});
export const ITEMS=Object.freeze([
 food('apple','Apple','🍎',15,5,2,100),
 food('banana','Banana','🍌',18,0,6,100),
 food('sandwich','Sandwich','🥪',35,0,12,400),
 food('hotdog','Hotdog','🌭',30,0,8,350),
 food('pizza','Pizza slice','🍕',40,0,10,450),
 food('granola-bar','Granola bar','🥜',20,0,10,150),
 food('salad','Salad','🥗',30,10,5,400),
 food('soup','Soup','🍲',35,20,8,450),
 food('yogurt','Yogurt','🥣',20,5,5,200),
 food('rice-bowl','Rice bowl','🍚',50,0,15,550),
 drink('water','Water','💧',0,45,0,100),
 drink('soda','Soda','🥤',5,30,5,200),
 drink('coffee','Coffee','☕',0,20,20,250),
 drink('energy-drink','Energy drink','⚡',0,25,30,300),
 drink('orange-juice','Orange juice','🧃',10,35,8,250),
 equipment('basic-jacket','Basic jacket','🧥','jacket',2,1500),
 equipment('small-backpack','Small backpack','🎒','backpack',10,2500),
 equipment('large-backpack','Large backpack','🎒','backpack',20,4500),
 tool('axe','Axe','🪓','Equip it, then press E (hold to keep chopping) at a pine in Alder Woods',2000),
 material('wood-log','Wood log','🪵','Timber from Alder Woods · sells for $1.00 at the Corner Market',100)
].map(Object.freeze));
export const itemById=id=>ITEMS.find(item=>item.id===id);
export const isConsumable=item=>item?.type==='food'||item?.type==='drink';
export const isBuyable=item=>item?.buyable!==false;
