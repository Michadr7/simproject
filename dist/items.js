// Restoration values are points; prices are cents. Equipment bonuses never stack by type.
const food=(id,name,icon,foodRestore,thirstRestore,energyRestore,price)=>({id,name,type:'food',icon,foodRestore,thirstRestore,energyRestore,price,stackLimit:10});
const drink=(id,name,icon,foodRestore,thirstRestore,energyRestore,price)=>({id,name,type:'drink',icon,foodRestore,thirstRestore,energyRestore,price,stackLimit:10});
// Tools are used from the world (E), never consumed. Materials are gathered, not sold in shops.
const tool=(id,name,icon,description,price)=>({id,name,type:'tool',icon,description,foodRestore:0,thirstRestore:0,energyRestore:0,price,stackLimit:1});
// requires: a skill level to BUY the item (a company can still hand it over earlier); careers.js and the shops check it with requirementError (inventory.js).
const material=(id,name,icon,description,price)=>({id,name,type:'material',icon,description,foodRestore:0,thirstRestore:0,energyRestore:0,price,stackLimit:10,buyable:false});
const ingredient=(id,name,icon,description,price)=>({...material(id,name,icon,description,price),type:'ingredient'});
const gift=(id,name,icon,description,price)=>({...material(id,name,icon,description,price),type:'gift'});
const gear=(id,name,icon,description,price,opts={})=>({id,name,type:'gear',icon,description,foodRestore:0,thirstRestore:0,energyRestore:0,price,stackLimit:opts.stackLimit||1,buyable:false,...opts});
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
 {...equipment('basic-jacket','Basic jacket','🧥','jacket',2,1500),description:'Light everyday jacket: +2 slots, 40% cold & 35% rain protection.'},
 {...equipment('rain-shell','Rain Shell','🧥','jacket',2,4500),buyable:false,description:'Waterproof shell: +2 slots, blocks 88% of rain soak and cuts wind chill.'},
 {...equipment('winter-parka','Winter Parka','🧥','jacket',3,8500),buyable:false,description:'Insulated mountain parka: +3 slots, 88% cold protection for Blackstone Pass snow.'},
 equipment('small-backpack','Small backpack','🎒','backpack',10,2500),
 equipment('large-backpack','Large backpack','🎒','backpack',20,4500),
  tool('axe','Axe','🪓','Equip it, then press E (hold to keep chopping) at a pine in Pine Ridge. Four swings for a pine at level 1',2000),
 {...tool('logging-axe','Logging Axe','🪓','A heavier, sharper axe: a pine falls in three swings at level 5',12000),requires:{skill:'lumberjack',level:5}},
 {...tool('chainsaw','Chainsaw','🪚','A petrol chainsaw: equip it and hold E at a felled trunk to cut it into logs. Sold only by Ridgeline Timber to a Hauler at level 5. Felling with it arrives with fuel and wear',35000),requires:{skill:'lumberjack',level:5},buyable:false,companyOnly:'ridgeline'}, // T-E (owner 2026-11-18): Rank 3 Hauler, level 5, $350 (was Foreman, level 15, $600)
 {...tool('logging-chainsaw','Logging Chainsaw','🪚','The professional saw: half the fuel and slow to wear. Sold only by Ridgeline Timber at level 20. Cutting with it arrives with fuel and wear',150000),requires:{skill:'lumberjack',level:20},buyable:false,companyOnly:'ridgeline'},
 {...tool('steel-axe','Steel Axe','🪓','The best axe there is: a pine falls in two swings at level 10',35000),requires:{skill:'lumberjack',level:10}},
 {...tool('gas-can','Gas Can','⛽','Equip it. At a pump hold F to fill it (5 gallons of one fuel); at a vehicle\'s tank cap hold F to pour it in',1500),capacityMgal:5000},
 {...tool('repair-kit','Repair kit','🧰','Equip it, then press E at a damaged vehicle: it gains 15% condition, up to 40% (a kit never goes further: take it to the Eastbank repair shop)',4000),stackLimit:5},
 ingredient('flour-bag','Bag of flour','🥣','A kitchen ingredient from Eden Wholesale.',200),
 ingredient('ground-coffee','Ground coffee','☕','A kitchen ingredient from Eden Wholesale.',400),
 {...ingredient('eggs','Eggs','🥚','Fresh eggs for home cooking.',250),buyable:true},
 {...ingredient('milk','Milk','🥛','A carton of milk for home cooking.',200),buyable:true},
 {...ingredient('produce','Fresh produce','🥬','Vegetables for home cooking.',300),buyable:true},
 {...ingredient('bread-loaf','Bread loaf','🍞','A loaf of bread for toast and sandwiches.',220),buyable:true},
 {...ingredient('meat-pack','Meat pack','🥩','Fresh meat for hearty skillets.',450),buyable:true},
 {...ingredient('cat-food','Cat food','🥫','A tin of food for your cat.',180),buyable:true},
 gift('bouquet','Fresh Bouquet','💐','A hand-tied bouquet from Ironwood Florist — gift to any neighbour.',1200),
 material('wood-log','Wood log','🪵','Timber from Pine Ridge · Ridgeline Timber pays for it on shift',100),
 food('jerky','Beef Jerky','🥩',20,0,5,300),
 drink('coffee-to-go','Coffee to Go','☕',0,20,15,250),
 {...food('clam-chowder','Clam Chowder','🥣',45,15,15,650),buyable:false},
 {...food('fish-tacos','Harbor Fish Tacos','🌮',50,5,18,750),buyable:false},
 gear('fishing-rod','Fishing Rod','🎣','Cast from Blackstone Lake or Kaspian Bay shores.',6000),
 gear('bait-pack','Bait Pack','🪱','Fresh fishing bait for lake and harbor casting.',500,{stackLimit:10}),
 gear('lure-set','Lure Set','🪝','Spinner and jig lures for bigger catches.',2500),
 gear('tent','Camp Tent','⛺','Pitch at Blackstone camps C1–C3 to rest overnight.',12000),
 gear('firewood-bundle','Firewood Bundle','🪵','Split firewood for a warm campfire at Blackstone camps.',800,{stackLimit:10}),
 gear('binoculars','Binoculars','🔭','Spot trails, wildlife, and peaks across Blackstone Pass.',8000),
 gear('trail-map','Trail Map','🗺️','Waterproof Blackstone Pass and Kaspian coast map.',1000),
 gear('motor-oil','Motor Oil','🛢️','10W-30 engine oil from Eastbank Fuel Kiosk.',1200,{stackLimit:5}),
 gear('ice-bag','Bag of Ice','🧊','Keeps catches and camp provisions cool.',400,{stackLimit:10}),
 gear('rope-coil','Marine Rope Coil','🪢','Braided dock line from Harbor Chandlery.',1400,{stackLimit:5}),
 gear('life-jacket','Life Jacket','🦺','Flotation vest for Kaspian Bay boats.',3500)
].map(Object.freeze));
export const itemById=id=>ITEMS.find(item=>item.id===id);
export const isConsumable=item=>item?.type==='food'||item?.type==='drink';
export const isBuyable=item=>item?.buyable!==false;
