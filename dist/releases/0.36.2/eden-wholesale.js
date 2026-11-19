// eden-wholesale.js: EDEN WHOLESALE, the small food-and-goods wholesaler that supplies Ironwood Bakery with flour and coffee beans (owner decision 2026-11-19; a Bruce Hughes / Eden company). Size, doors, counter, dock, pickup, lamps, sign, goods, hours. Pure data, NOT WIRED.
// No DOM, no three.js, no globals. The model is scripts/build-eden-wholesale.mjs -> dist/assets/buildings/eden-wholesale.glb (one mesh, one vertex-colour material, anchor_* empties at these points).
// LOCAL coordinates, like every house/shop prop: origin = the middle of the 12 x 9 m footprint on the ground, y up, the FRONT faces +z (shop door, sign and loading dock all on the front), 1 unit = 1 m.
// A map landmark {x,z,yaw} turns local into world with worldPoint(); yaw Math.PI makes the front face north (-z), as the Main Street shops on C1..C7 do. Hours and the counter are PLACEHOLDERS.
// v2 (visual pass 2026-11-19): light warm cladding, west-wall door and windows, back clerestories, ladder and louvre, lamps (anchor_lamp_*, glow triangles), dock rack, bin, crates, and the words baked on the sign.
import {GOOD_KEYS} from './bakery-goods.js';

export const ID='eden-wholesale',NAME='Eden Wholesale',OWNER='Bruce Hughes',COMPANY='Eden';
export const MODEL='assets/buildings/eden-wholesale.glb'; // under dist/, loaded like assets/goods (GLTFLoader, document.baseURI)
export const PLACEHOLDER=true;
export const SIZE=Object.freeze({w:12,d:9,h:6.3,wallH:5.6}); // footprint w (x) by d (z); h = the top of the roof plant, wallH = the hall roof (parapet coping to 6.08)
// The shop door, in the props-assets.js `door` shape (x along the front wall from the centre, z = the front wall) plus its facing.
export const DOOR=Object.freeze({x:-2.3,z:3.8,width:1.8,height:2.3,facing:'+z',yaw:0});
// The staff door on the WEST side wall (x -6), which faces Barber's Walk when the building stands on site 1 (yaw 0). Not enterable: a look and a future staff spot. yaw = the way it faces.
export const SIDE_DOOR=Object.freeze({x:-6,z:-3.5,width:1.0,height:2.2,facing:'-x',yaw:-Math.PI/2});
// Where the buy prompt stands: the shops are not enterable yet, so the 'counter' is outside the door (like the Eastbank garage counter point). PLACEHOLDER until an interior exists.
export const COUNTER=Object.freeze({x:-2.3,z:4.9});
// The loading dock: a flush 0.15 m concrete apron under a canopy on the right of the front, a roller shutter behind it (x 2.6..5.6).
export const DOCK=Object.freeze({x:3.7,z:4.5,y:.15,width:4.6,depth:3.3,facing:'+z'}); // DOCK.x/z = the middle of the dock's front edge: where a truck's tailgate stops
export const TRUCK_BAY=Object.freeze({x:3.7,z:8.3,yaw:0}); // a truck parked rear-to-dock: its centre and heading (yaw 0 = nose +z, away from the building); 7.6 m of clear ground in front of the front needed
export const PICKUP=Object.freeze({x:3.4,z:3.4,y:.15}); // the E prompt for the flour / coffee-bean gigs: on the dock, in front of the pallet rack
// Where the game puts the LIVE pallets (dist/assets/goods/<good>-pallet.glb) while stock is waiting: in front of the shutter, turned 90 degrees (0.76 m along x).
export const STOCK=Object.freeze({flour:Object.freeze({x:4.5,z:2.0,y:.15,yaw:Math.PI/2}),'coffee-beans':Object.freeze({x:5.5,z:2.0,y:.15,yaw:Math.PI/2})});
// The sign: the words are baked into the model as 3D block letters (cream on Eden green); the node marks the board's face for anything the game wants to add (a glow, a swap).
export const SIGN=Object.freeze({node:'sign_eden_wholesale',text:'EDEN WHOLESALE',x:-2.3,y:3.55,z:3.935,width:6.8,height:.98,facing:'+z',baked:true});
// Lamp heads (local [x,y,z] of the lens, where a game light would go) and which way they shine. The lens triangles are the mesh's LAST triangles, listed in the mesh extras.glow {from,count,color,strength}
// (the props-assets.js `glow` shape: a second material group can make them emissive). NO light is in the model.
export const LAMPS=Object.freeze([
 Object.freeze({id:'shop-w',kind:'gooseneck',x:-4.6,y:4.34,z:4.23,aim:[0,-1,0]}),Object.freeze({id:'shop',kind:'gooseneck',x:-2.3,y:4.34,z:4.23,aim:[0,-1,0]}),Object.freeze({id:'shop-e',kind:'gooseneck',x:0,y:4.34,z:4.23,aim:[0,-1,0]}),
 Object.freeze({id:'dock-w',kind:'canopy',x:2.9,y:3.86,z:2.9,aim:[0,-1,0]}),Object.freeze({id:'dock-e',kind:'canopy',x:4.9,y:3.86,z:2.9,aim:[0,-1,0]}),
 Object.freeze({id:'side',kind:'bulkhead',x:-6.16,y:2.65,z:-3.5,aim:[-1,0,0]}),Object.freeze({id:'back',kind:'bulkhead',x:3.4,y:2.85,z:-4.66,aim:[0,0,-1]})]);
// Solid boxes for collision (local x0..x1, z0..z1, top y): the hall, the shop front, the two canopy posts, the dock rack, the bin, the crates and the empty pallets. The dock apron is walkable.
export const SOLIDS=Object.freeze([{id:'hall',x0:-6,x1:6,z0:-4.5,z1:1.2,y:6.08},{id:'shop-front',x0:-6,x1:1.4,z0:1.2,z1:3.8,y:4.3},{id:'post-w',x0:1.5,x1:1.64,z0:4.2,z1:4.34,y:3.95},{id:'post-e',x0:5.78,x1:5.92,z0:4.2,z1:4.34,y:3.95},
 {id:'rack',x0:1.4,x1:2.42,z0:1.2,z1:3.5,y:2.5},{id:'bin',x0:.8,x1:1.38,z0:3.82,z1:4.42,y:1.12},{id:'crates',x0:4.68,x1:5.72,z0:3.58,z1:4.2,y:1.0},{id:'pallet-stack',x0:5.05,x1:5.85,z0:2.62,z1:3.58,y:.51}].map(Object.freeze));
// The anchor_* empties in the GLB (build-props.mjs reads anchor_* as `anchors`), [x,y,z] local.
export const ANCHORS=Object.freeze({anchor_door:[DOOR.x,0,DOOR.z],anchor_side_door:[SIDE_DOOR.x,0,SIDE_DOOR.z],anchor_counter:[COUNTER.x,0,COUNTER.z],anchor_dock:[DOCK.x,DOCK.y,DOCK.z],anchor_pickup:[PICKUP.x,PICKUP.y,PICKUP.z],anchor_truck:[TRUCK_BAY.x,0,TRUCK_BAY.z],
 'anchor_stock_flour':[STOCK.flour.x,STOCK.flour.y,STOCK.flour.z],'anchor_stock_coffee-beans':[STOCK['coffee-beans'].x,STOCK['coffee-beans'].y,STOCK['coffee-beans'].z],
 ...Object.fromEntries(LAMPS.map(l=>['anchor_lamp_'+l.id,[l.x,l.y,l.z]]))});
export const GOODS_SOLD=Object.freeze([...GOOD_KEYS]); // ['flour','coffee-beans'] from bakery-goods.js; prices live there (priceOf)
export const sells=key=>GOODS_SOLD.includes(key);
// Opening hours in minutes after midnight (the map-definition.js `hours:[open,close]` shape): 07:00-17:00, PLACEHOLDER.
export const HOURS=Object.freeze([420,1020]),HOURS_LABEL='07:00-17:00';
export const isOpen=minute=>Number.isFinite(minute)&&(((minute%1440)+1440)%1440)>=HOURS[0]&&(((minute%1440)+1440)%1440)<HOURS[1];
// Brand colours (sRGB hex) used by the model. v2: light warm-grey cladding (sits with the pale Kenney shops of Ironwood; the v1 navy read as a black box), slate trim, Eden green stripe/board, cream letters.
export const BRAND=Object.freeze({cladding:'#b9b6ac',trim:'#465057',green:'#2f8a55',board:'#1f5c3c',letters:'#f4eedc',render:'#e4dbc7',brick:'#9b5b44',lens:'#ffe2a8'});
// local [x,y,z] or {x,y,z} -> world {x,y,z} for a landmark pose {x,z,yaw} (three.js rotation about y: front +z turns to (sin yaw, cos yaw))
export function worldPoint(p,pose){const [x,y,z]=Array.isArray(p)?p:[p.x,p.y||0,p.z],c=Math.cos(pose.yaw||0),s=Math.sin(pose.yaw||0);return {x:+(pose.x+x*c+z*s).toFixed(4),y,z:+(pose.z-x*s+z*c).toFixed(4)}}
// The world rectangle the footprint covers for a pose (yaw a multiple of 90 degrees)
export function footprintAt(pose){const a=worldPoint([-SIZE.w/2,0,-SIZE.d/2],pose),b=worldPoint([SIZE.w/2,0,SIZE.d/2],pose);return {x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z)}}
// Two candidate sites in Ironwood (zone x -20..70, z -142..-48; notes/ironwood-city-design.md 1.4). The owner chose site 1 (behind-c6-c7); the map lane places it.
export const SITE_CANDIDATES=Object.freeze([
 Object.freeze({id:'behind-c6-c7',pose:Object.freeze({x:36,z:-67.5,yaw:0}),note:'behind the Pharmacy and Bank (C6/C7), front and dock facing south onto the car park; about 40 m on foot to the bakery door via Barber\'s Walk; the truck backs in over car-park bay 20 (x 37.8..40.5)'}),
 Object.freeze({id:'back-court-west',pose:Object.freeze({x:-15.5,z:-115.5,yaw:-Math.PI/2}),note:'the west end of the paved back court behind the Police Station, front and dock facing west onto the County Road verge (x -26..-20); about 85 m by road to the bakery'})]);
