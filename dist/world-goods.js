// world-goods.js: the DATA of the living world (goods, places, regions, supply truck) for the town + Willow Farm scope; implements notes/world-system-design.md (stage W-A). Pure data, no code paths.
// Money is integer cents, quantities are whole units. Place ids use population.js's 'kind:id' strings so a person's dayPlan 'shop' block names the same place.
// UNVERIFIED placeholders (tune later): every base price except gas/diesel (fuel.js:5), every stock, rate and basket. Only shop:market and shop:cafe are visited by errands (map-definition.js:177-178); the other places use a daily baseline.

// unit = what one unit is; baseCents = price of one unit at the target stock; decayDays = shelf life (DATA ONLY in W-A: nothing spoils yet, so conservation stays simple).
export const GOODS=Object.freeze({
 eggs:Object.freeze({id:'eggs',label:'Eggs',unit:'dozen',baseCents:450,decayDays:21,group:'food'}),
 milk:Object.freeze({id:'milk',label:'Milk',unit:'jug',baseCents:400,decayDays:7,group:'food'}),
 produce:Object.freeze({id:'produce',label:'Fresh produce',unit:'bag',baseCents:500,decayDays:10,group:'food'}),
 bread:Object.freeze({id:'bread',label:'Bread',unit:'loaf',baseCents:350,decayDays:4,group:'food'}),
 planks:Object.freeze({id:'planks',label:'Planks',unit:'plank',baseCents:900,group:'lumber'}),   // price ASSUMED (no plank price exists in dist/)
 logs:Object.freeze({id:'logs',label:'Logs',unit:'log',baseCents:1500,group:'lumber'}),          // price ASSUMED
 trunks:Object.freeze({id:'trunks',label:'Trunks',unit:'trunk',baseCents:2800,group:'lumber'}),   // timber redesign T-A, price ASSUMED
 slabs:Object.freeze({id:'slabs',label:'Slabs',unit:'slab',baseCents:1800,group:'lumber'}),      // timber redesign T-A, price ASSUMED
 posts:Object.freeze({id:'posts',label:'Posts',unit:'post',baseCents:3000,group:'lumber'}),
 beams:Object.freeze({id:'beams',label:'Beams',unit:'beam',baseCents:3800,group:'lumber'}),
 dowels:Object.freeze({id:'dowels',label:'Dowels',unit:'dowel',baseCents:700,group:'lumber'}),
 chips:Object.freeze({id:'chips',label:'Chips',unit:'chip',baseCents:100,group:'lumber'}),   // warehouse timber machine M-A, prices PLACEHOLDER
 gas:Object.freeze({id:'gas',label:'Gasoline',unit:'gal',baseCents:400,group:'fuel'}),           // fuel.js:5 PRICE_CENTS_PER_GAL.gas (fuel.js counts milli-gallons: 1 unit = 1000 mgal)
 diesel:Object.freeze({id:'diesel',label:'Diesel',unit:'gal',baseCents:420,group:'fuel'})         // fuel.js:5
});

export const REGIONS=Object.freeze({
 town:Object.freeze({id:'town',label:'Alder Center'}),
 eastbank:Object.freeze({id:'eastbank',label:'Eastbank and the woods'}),
 farm:Object.freeze({id:'farm',label:'Willow Fields'})
});

// A place's goods: target = the stock that sells at the base price; max = the shelf/store cap; start = a fresh world's stock;
// rate = produced per day (producers); basket = used per errand visit to this place (shops); daily = used per day whatever the visits (fuel pumps, builders, off-map customers).
const g=(target,max,start,extra={})=>Object.freeze({target,max,start,...extra});
export const PLACES=Object.freeze({
 'shop:market':Object.freeze({id:'shop:market',label:'Corner Market',kind:'shop',region:'town',hours:[420,1320],goods:Object.freeze({   // map-definition.js:177
  eggs:g(20,60,18,{basket:1}),milk:g(16,48,14,{basket:1}),produce:g(24,70,20,{basket:1}),bread:g(16,40,16,{basket:1})})}),
 'shop:cafe':Object.freeze({id:'shop:cafe',label:'Alder Coffee',kind:'shop',region:'town',hours:[480,1080],goods:Object.freeze({           // map-definition.js:178
  eggs:g(8,24,8,{basket:1}),milk:g(10,30,10,{basket:1}),bread:g(8,24,8,{basket:1})})}),
 'property:alder-bakery':Object.freeze({id:'property:alder-bakery',label:'Ironwood Bakery',kind:'producer',region:'town',hours:[330,840],goods:Object.freeze({ // map-definition.js:289
  bread:g(20,60,20,{rate:14})})}),
 'property:farm-house':Object.freeze({id:'property:farm-house',label:'Willow Farm',kind:'producer',region:'farm',hours:[390,1050],health:'farm',goods:Object.freeze({ // map-definition.js:297 (Hal Brennan)
  eggs:g(30,120,40,{rate:8}),milk:g(24,90,30,{rate:6}),produce:g(30,100,40,{rate:10})})}),
 'zone:forest':Object.freeze({id:'zone:forest',label:'Pine Ridge logging',kind:'producer',region:'eastbank',hours:[360,1080],goods:Object.freeze({
  logs:g(60,150,60,{rate:16})})}),
 'property:sawmill':Object.freeze({id:'property:sawmill',label:'Sawmill',kind:'producer',region:'eastbank',hours:[360,1080],goods:Object.freeze({  // map-definition.js:304
  planks:g(60,160,0)})}), // P-B wiring: no rate (the world mints nothing here). This stock IS the player-fed yard (progress.sawmillYard, sawmill-yard.js): world-tick.js copies the yard in before the day's supply and back after; the yard's daily trickle (6) is the only free supply
 'office:ridgeline-warehouse':Object.freeze({id:'office:ridgeline-warehouse',label:'Ridgeline Warehouse',kind:'depot',region:'eastbank',hours:[360,1080],goods:Object.freeze({ // map-definition.js:359
  planks:g(60,200,60,{daily:10})})}),
 'property:eastbank-supply':Object.freeze({id:'property:eastbank-supply',label:'Eastbank Building Supplier',kind:'shop',region:'eastbank',hours:[420,1020],goods:Object.freeze({ // map-definition.js:308
  planks:g(30,100,30,{daily:6})})}),
 'property:eastbank-gas-kiosk':Object.freeze({id:'property:eastbank-gas-kiosk',label:'Eastbank Gas Station',kind:'shop',region:'eastbank',hours:[360,1320],goods:Object.freeze({ // map-definition.js:309, FUEL_STATIONS :323
  gas:g(600,1000,700,{daily:45}),diesel:g(500,800,600,{daily:30})})})
});
export const PLACE_IDS=Object.freeze(Object.keys(PLACES));

// The weekly supply truck refills the gas station from outside the map (this is the only import into the world).
export const TRUCK=Object.freeze({place:'property:eastbank-gas-kiosk',everyDays:7,load:Object.freeze({gas:420,diesel:280}),firstOffset:3});
// Event kinds (ctx.events) that stop the truck for a day and cost prosperity.
export const BLOCKING_EVENTS=Object.freeze(['storm','road-blocked']);

// W-A2 (supply): a producer's own stock moves to a shop every tick (conserved: removed from the producer, capped at the shop's target and room). perDay = most units moved in a day.
// The sawmill has no shop in the market or cafe (they sell no planks), so its planks go to the Eastbank Building Supplier (property:eastbank-supply, map-definition.js:308).
export const SUPPLY=Object.freeze([
 Object.freeze({from:'property:alder-bakery',to:'shop:market',good:'bread',perDay:6}),
 Object.freeze({from:'property:alder-bakery',to:'shop:cafe',good:'bread',perDay:3}),
 Object.freeze({from:'property:sawmill',to:'property:eastbank-supply',good:'planks',perDay:6})
]);
// The Ridgeline warehouse's planks ARE the pallets in progress.companies.ridgeline (pallets.js totalPlanks): world-tick.js copies that total into this world place at every tick (pallets are the truth).
// NOT linked yet: the world's daily 'use' at the warehouse is not taken out of the pallets, and the sawmill's planks do not become pallets by themselves (the player hauls them).
export const PALLET_LINK=Object.freeze({place:'office:ridgeline-warehouse',good:'planks',company:'ridgeline'});
// Crates (cargo.js 'crate', STORY_CRATES = 4 in starter.js): one crate holds this many UNITS of the good (egg unit = a DOZEN, owner decision), so 4 crates = 16 dozen eggs. PLACEHOLDER numbers; always whole units.
export const CRATE_UNITS=Object.freeze({eggs:4,milk:6,produce:5});
// A pump sells whole gallons from the world's stock (1 unit = 1 gallon); fuel.js counts milli-gallons (1000 per gallon). Pumps of the Eastbank gas station:
export const PUMP_PLACE='property:eastbank-gas-kiosk',MGAL_PER_GAL=1000,SOLD_OUT_TEXT='Sold out until the next delivery.';
