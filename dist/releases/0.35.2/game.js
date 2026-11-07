import {createStoreUI} from './store.js';
import {createWorld,zoneAt,isWalkable,footingAt,standHeight,worldLayout} from './world.js';
import {isMarked,LANDING,treeFelled,stackLog,planksMilled,stockOf,takeLogFromPile,inLumberyard,deliverPlanks,LUMBERYARD,logGathered,stumpCleared,saplingPlanted,racksOf,RACK_CAP,stackPlanks,takeFromRack,forkUsed,forkLoadOf} from './forest.js';
import * as forklift from './forklift.js';
import {createTreeMarks,createLandingRing,createStockPiles} from './marks.js';
import {loadCarry,unloadOne,unloadKind,cargoText,LOAD_REACH,takeAll,countOf,freeCount,orderCount,orderIdsOf,addPlanks,removePlanks,removeOrderPlanks} from './cargo.js';
import {createCargoUI} from './cargo-ui.js';
import {scheduleTruck,truckOf,truckWaiting,truckDue,truckArrived,loadFromHands,loadFromStock,loadFromBed,sendOff,BAY as TRUCK_BAY} from './customers.js';
import {createCustomerTruck} from './customer-truck.js';
import {heightAt} from './height.js';
import {slabOutline,cornerRegion} from './junctions.js';
import {hire,quit,collectOwed,employerName,careerOf,promote,nextRank,ownerOf,employerById,storeItems,storeLine,buyFromCompany,changeRep} from './careers.js';
import {tickSupply,supplyOf,returnPlanks} from './supply.js';
import {addMessage,markRead} from './messages.js';
import {totalPlanks,palletsOf,floorPallets,stagingPallets,orderPallet,liftPallet,setPallet} from './pallets.js';
import * as fp from './fork-pallets.js';
import {forkGoal,forkGhost} from './fork-guide.js';
import {fillIcon} from './item-icon.js';
import {boardEntries,boardText,boardPage,orderCard,destinationName} from './order-table.js';
import {tickTickets,takeTicket,stagePlanks,stagePallet,releaseOrderPallet,shipTicket,loadTicket,deliverTicket,openTickets,takenBy,ticketText,dueText,stagingOf,ticketsOf,TAKE_RANK} from './tickets.js';
import {createOffice,createNameBoard,OFFICE_CLOCK,OFFICE_BOARD,OFFICE_COUNTER,OFFICE_STORE,OFFICE_COOLER} from './office.js';
import {useCooler,coolerWait} from './water-cooler.js';
import {dockRoute,DOCK_BAY} from './customers.js';
import {createWarehouse,createWarehouseDoorway,RACK_SLOTS,WAREHOUSE_TABLE,WAREHOUSE_STAGING} from './warehouse.js';
import {WAREHOUSE_COOLER} from './warehouse-layout.js';
import {HAND_LEVEL,DOCK_DOOR,HALL} from './warehouse-layout.js';
import {clockIn,clockOut,tickShift,onSiteAt,taskText,recordPiece,PIECE_PAY} from './shift.js';
import {deliverDue,takeDelivery,placeOrder,setMainHome,waitingHomes,waiting,dropSpot,homesHeld,mainHome,STUDIO_ID,buyVehicle,orderVehicle,displayColour,vehicleLabel,VEHICLE_PRICE,vehicleLock} from './orders.js';
import {createParcels} from './parcels.js';
import {SURFACE_LABEL,surfaceSpeed,CLASSES} from './vehicle.js';
import {trackerItems,focusedItem,nextFocus,focusAfter,distanceTo} from './tracker.js';
import {worldDoors,doorOf,propertyById} from './properties.js';
import {buildHouseRoom} from './interiors.js';
import {propertyTransaction,heldIds,listingOf} from './ownership.js';
import {CREDITS} from './credits.js';
import {createSawmillController,freshSawmill,switchSawmill,switchLabel,BELT_SLOTS,PLANK_TINT} from './sawmill.js';
import {createAudio,engineVoice} from './audio.js';
import {createSmoke,exhaustRate,START_PUFFS} from './smoke.js';
import {LOG_HOME,LOG_GROUND,LOG_HAND,LOG_POLE,carryEffects,bendLean,bendDrop,bendAmount,BEND_TIME,BEND_RELEASE,PLANK_HANDS,PLANK_STACK,PLANK_POLES,poseBlend,plankBox,quarterOf,shoulderLog,putDownLog,feedLog,takePlanks,putDownPlanks,pickUpPlanks} from './carry.js';
import {chopTree,felledTrees,plotAt,expireLogs,regrowTrees,felledStages,CHOP_RANGE,clearStump,plantSapling} from './grid.js';
import {levelOf,swingTime,perkText} from './skills.js';
import {isAxe,isSaw,hitsFor,bestAxe} from './tools.js';
import {createMinimap} from './minimap.js';
import {createHeldItem,disposeHeldItem} from './item-models.js';
import {createConsumptionAnimation} from './consumption.js';
import {itemById,ITEMS} from './items.js';
import {DEV_MODE} from './dev-flag.js';import {VERSION} from './version.js';import {installUpdateNotice} from './update-check.js';
import {createInventoryUI} from './inventory-ui.js';
import {addItem,useItem,unequipItem,hasItem,hotbarItems,equipTool,sellLogs,canOf,setCan} from './inventory.js';
import {createPhone} from './phone.js';
import {acceptContract,completeContract,tickContract,gigTarget,atGigPoint,refreshGigBoard,gameMinutes} from './contracts.js';
import {GameState,initializeState,setMePosition,tickLife,setStatDrainMultiplier} from './state.js';
import {needsEffects} from './life.js';
import {loadProfile,saveProfile} from './profile.js';
import {MultiplayerClient} from './multiplayer.js';
import {createMainMenu,relayBase,refusalText} from './main-menu.js';import {createSaveMenu} from './save-menu.js';import {createCloud,PUSH_EVERY_MS} from './cloud-save.js';import {createAccountMenu} from './account-menu.js';import {normalizeLobbyCode,REFUSED} from './relay-protocol.js';
import {findNearestClearSpot,MAX_SEARCH,OPEN_AREA} from './safe-spot.js';
import {createHouseSigns} from './house-signs.js';
import {terrain,SURFACE} from './terrain.js';
import {createRemotePlayer,updateRemotePlayer,disposeRemotePlayer} from './remote-player.js';
import {chooseInteraction,screenAnchor} from './interactions.js';
import {createLookControls} from './look-controls.js';
import {normalizeCafe,cafeTask,cafeTransaction,expireCafe,ORDERS,MANAGER} from './cafe-job.js';
import {advanceTime,clockText,shopOpen,hoursText,formatClock} from './routine.js';
import {normalizeLife,lifeTransaction} from './life.js';
import {SHOPS,SHOP_ENTRY,SHOP_EXIT,COUNTER,createShop} from './shops.js';
import {createSlidingDoor} from './doors.js';
import {MAP,roadRects} from './map-definition.js';
import {activeAction,canStart,refusal} from './actions.js';
import {resolveObjective} from './objective.js';
import {substeps,MAX_FRAME} from './timestep.js';
import {CARRY,CARRY_DIR,CARRY_POLE,GRIP,CHOP_TIMING,chopPose} from './chop-path.js';
import {createPedestrians,createVehicles} from './neighborhood.js';
import {createDriving} from './driving.js';
import {createVehicleHud,vehicleHudModel} from './vehicle-hud.js';
import {defaultColour} from './paint.js';
import {sleepThrough,passOutThrough,PASS_OUT_ONLINE_SECONDS} from './sleep.js';
import {createFuelStation} from './fuel-station.js';
import {sell,fillCan,pour,canText,CAN_CAPACITY_MGAL,STEP_MGAL,FLOW_MGAL_PER_S,REACH_M,USE_RANGE_M,fuelText,fuelTitle,fuelName,gallons} from './fuel.js';
import * as THREE from './vendor/three.module.js';
import { createCameraController } from './camera.js';
import {MARKET,routeFor,targetFor,nearby,money,transactJob} from './jobs.js';
import {STUDIO,totalDue,housingTransaction,weekday,weekNumber,dueIn,estimatedUtilities} from './housing.js';
import {createApartment,EXIT,BED,ENTRY} from './apartment.js';
import {createIndoorCamera} from './indoor-camera.js';
import {polishWorld} from './visuals.js';
import {createMovementInput} from './input.js';
import {createCharacter,loadCharacterAssets} from './character.js';
import {palettes,defaults,loadAppearance,saveAppearance,normalizeAppearance,BODIES,OUTFITS,PART_KEYS,CLOTHES_KEYS,partChoices,quickOutfits,switchBody,randomLook} from './appearance.js';
// Decode the embedded character models once, before any character (player, clerks, pedestrians) is built.
await loadCharacterAssets();
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#b9cbd0');scene.fog=new THREE.Fog('#b9cbd0',65,155);
let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'low-power'});}catch(e){$('error').hidden=false;$('error').textContent='This prototype needs WebGL. Please try a browser with hardware acceleration enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,700);scene.add(new THREE.HemisphereLight('#d8e8f0','#777655',1.7));const sun=new THREE.DirectionalLight('#ffe3b9',3.1);sun.position.set(-24,30,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,far:130});sun.shadow.bias=-.0005;scene.add(sun);
const mats=new Map(),colliders=[],cameraSolids=[],shopShells={market:[],cafe:[]};function mat(c){if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.92}));return mats.get(c)}
function box(w,h,d,x,y,z,c,solid=false){let m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=h>.3;m.receiveShadow=true;scene.add(m);if(solid){colliders.push({x,z,hx:w/2,hz:d/2});cameraSolids.push(m);}return m}
function label(text,x,y,z,width=5,rot=0,bg='#243e3b',fg='#f1ebd9',height=width/4){
 const c=document.createElement('canvas');c.width=1024;c.height=Math.max(32,Math.round(1024*height/width));
 const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=fg;
 const base=c.height*.48;ctx.font=`bold ${base}px Arial`;const measured=ctx.measureText(text).width;
 ctx.font=`bold ${Math.min(base,base*c.width*.9/Math.max(1,measured))}px Arial`;
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture}));
 sign.position.set(x,y,z);sign.rotation.y=rot;scene.add(sign);return sign;
}

box(110,.12,19,0,-.03,6,'#535d60');box(16,.13,120,-30,-.02,0,'#535d60');// The city's own pavements (the first MAP.pavements entries, the ones world.js does not draw): raised slabs whose inside corners are rounded where MAP.roundedCorners say so, and the little
// patches of street that fill those corners (junctions.js). The slab is 0.25 m thick, its top 0.185 m up, as before.
{const pavementColour=mat('#b7b6a8'),streetColour=mat('#535d60'),outline=pts=>new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
 const solid=(pts,y,depth,material,name)=>{const m=new THREE.Mesh(new THREE.ExtrudeGeometry(outline(pts),{depth,bevelEnabled:false}),material);m.rotation.x=-Math.PI/2;m.position.y=y;m.castShadow=false;m.receiveShadow=true;m.name=name;scene.add(m);return m};
 for(const p of MAP.pavements.filter(p=>!p.draw))solid(slabOutline(p,MAP.roundedCorners),-.065,.25,pavementColour,'city-pavement');
 for(const c of MAP.roundedCorners)solid(cornerRegion(c),-.1,.14,streetColour,'street-corner-'+c.id)}
for(let x=-48;x<55;x+=8){if(x<-40||x>-20)box(3,.02,.14,x,.05,6,'#d9d5bb')}for(let z=-47;z<55;z+=8)if(z<-8||z>20)box(.14,.02,3,-30,.06,z,'#d9d5bb');for(let i=0;i<7;i++){box(.85,.025,7,-18+i*1.55,.06,6,'#dfdfd1');box(8,.025,.9,-30,.06,-7+i*1.6,'#dfdfd1')}
function building(x,z,w,d,h,c,name,kind=null){const before=scene.children.length;if(kind){const shell=box(w,h-3.5,d,x,3.5+(h-3.5)/2,z,c);shopShells[kind].push(shell);{const gap=MAP.shops[kind].doorway.halfWidth;colliders.push({x:x-(w/2+gap)/2,z,hx:(w/2-gap)/2,hz:d/2},{x:x+(w/2+gap)/2,z,hx:(w/2-gap)/2,hz:d/2})} // the doorway is open ground
 for(const side of [-1,1])shopShells[kind].push(box(1.5,3.5,10,x+side*6.75,1.75,MAP.shops[kind].interior.origin.z,c));}else box(w,h,d,x,h/2,z,c,true);box(w+.35,.35,d+.35,x,h+.1,z,'#d6d2c4');box(w+.4,.22,d+.4,x,3.6,z,'#d6d2c4');const front=z+d/2+.025;for(let xx=x-w/2+1.4;xx<x+w/2-.7;xx+=2.5)for(let yy=5;yy<h-1;yy+=2.8){box(1.1,1.65,.08,xx,yy,front,'#435d68');box(1.32,.12,.22,xx,yy-.85,front+.08,'#d1c6b1')}if(name){if(name==='OAK STREET APARTMENTS')label(name,x,3.96,front+.24,7,0,'#243e3b','#f1ebd9',.42);else if(kind)label(name,x,3.96,front+.24,7,0,'#243e3b','#f1ebd9',.42);else label(name,x,3,front+.12,Math.min(w-1,7));if(!kind)for(let xx=x-w/2+1.5;xx<x+w/2;xx+=3)box(1.8,1.9,.1,xx,1.25,front,'#3d555a')}if(kind){shopShells[kind]=[...new Set([...shopShells[kind],...scene.children.slice(before)])];cameraSolids.push(shopShells[kind][0]);}}
// Every building comes from the map (map-definition.js), including the backdrop row beyond the city edge.
for(const b of MAP.buildings)building(b.x,b.z,b.w,b.d,b.h,b.color,b.name,b.shop);
// Entrance is a distinct replaceable asset; interaction data is separate from scenery.
const entrance={x:MAP.studio.x,z:MAP.studio.doorZ,radius:3.3};{const sx=MAP.studio.x,sz=MAP.studio.doorZ;box(2.2,2.7,.18,sx,1.35,sz-.11,'#213a3c');box(.08,2.3,.05,sx,1.3,sz+.02,'#aebeb5');box(.12,.25,.08,sx+.6,1.3,sz+.07,'#e3cf93');box(3.6,.18,1.8,sx,3.05,sz+.45,'#374e46');label('18',sx,2.83,sz+.09,.45,0,'#213a3c','#e3cf93',.16)} // the studio's door, placed by the map
const trees=[],lampMeshes=[]; // trees: the camera's list of fading hand-built trees. Empty now: every tree is a Quaternius model that dissolves with the sightline shader (world.js).
// Oak Street's trees. Kept clear of shop signs, doorways and the crosswalk approach. They are placed as models once the world exists (below).
const OAK_TREES=[[-9,-4.5],[10,-4.5],[28,-4.5],[43,-6.5],[-14,19],[7,19],[32,19],[49,19],[-18,-31],[-18,-43],[-43,18]]; // tests/street-trees.mjs: none may stand on a road
function lamp(x,z){const post=box(.12,5,.12,x,2.5,z,'#354342');post.material=post.material.clone();post.material.transparent=true;lampMeshes.push(post);box(1,.15,.55,x+.35,5,z,'#394644');box(.75,.04,.4,x+.35,4.9,z,'#f2e4b7')}[-10,15,42].forEach(x=>{lamp(x,-4.6);lamp(x,17)});
const pedestrians=createPedestrians(scene);
for(let x of[9,27]){box(2,.18,.7,x,.65,17.5,'#876e50');box(2,.55,.13,x,1,17.85,'#876e50');box(.12,.7,.55,x-.8,.3,17.5,'#394a42');box(.12,.7,.55,x+.8,.3,17.5,'#394a42')}box(.8,1.2,.8,11,.6,-4.5,'#435c4f',true);
polishWorld(scene,box,label,trees);for(const [x,title] of Object.values(MAP.shops).map(shop=>[shop.x,shop.sign]))label(title,x,2.95,-8.08,2.1,0,'#24483f','#f1ebd9',.25);
for(const x of [3.8,-10.2]){box(.85,.8,.55,x,.55,-7,'#637f70',true);label('DELIVERIES',x,1.06,-6.7,.8,0,'#29473b','#e9e3c7',.16)}
// Farm and forest zones, plot grid and cuttable trees (world.js). Built after polishWorld so its
// texture pass only touches city meshes.
const world=createWorld(scene,{label});
const sawmillCtl=createSawmillController(scene.getObjectByName('prop-sawmill-v4'),MAP.landmarks.find(l=>l.id==='sawmill'),{belt:()=>GameState.progress.belt}); // the sawmill's switch, blade, cut and belt (sawmill.js)
let sawmillState=freshSawmill();
// Sound (audio.js): generated with Web Audio, started by the first click or key press (browsers need one), silent beyond 40 m; volume and mute are saved and set in the main menu's Settings.
const audio=createAudio({AudioContextClass:globalThis.AudioContext||globalThis.webkitAudioContext,storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)}});
for(const type of ['pointerdown','keydown'])window.addEventListener(type,()=>audio.unlock(),{capture:true});
document.addEventListener('visibilitychange',()=>audio.setActive(!document.hidden));
const vehicles=createVehicles(scene,colliders,world.fade); // the parked cars are converted models; they need the world's sightline fade
for(const t of world.addBroadleaves(OAK_TREES.map(([x,z])=>({x,z,y:standHeight(x,z)}))))colliders.push({x:t.x,z:t.z,hx:t.radius,hz:t.radius}); // trunks block walking
// 'For rent or sale' signs on the lawns of the houses you can rent or buy; each disappears while you hold the house (synced from the ownership state in frame()).
const parcels=createParcels(scene,{colliders}); // the drop spots for Store orders (orders.js): a parcel locker by the studio door, a parcel box in front of each house
const houseSigns=createHouseSigns({scene,properties:MAP.properties,doorOf,surfaceAt:(x,z)=>terrain().surfaceAt(x,z),GRASS:SURFACE.GRASS,blocked:(x,z)=>!isWalkable(x,z)||world.blocked(x,z)||colliders.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33),solids:colliders});let signsFor=null; // blocked: the outdoor test only, because the game's blocked() reads state that is set up further down
sun.target.position.set(0,0,0);scene.add(sun.target);
initializeState(loadProfile());
for(const key of felledTrees(GameState.progress))world.setFelled(key);
world.setLogs(GameState.progress.logs);
const me=GameState.me;
// consuming: an item is being raised and used (blocks input). armRecovery: the empty hand lowering afterwards (cosmetic only).
let cargoUI=null,phone=null,inventoryUI=null,storeUI=null,consuming=null,armRecovery=null,chopping=null,sleepElapsed=null;
// Hotbar, equipped tool, hold-E chopping, plot grid toggle and tree regrowth bookkeeping.
let doorCooldown=1,doorFade=null,hotbarSignature='',eHeld=false,carried=null,carryWeight=0,gridOn=false,regrowClock=99;
const pendingLogs=new Set(),lastStages=new Map();
let inside=false,shop=null;const apartment=createApartment();
const shops={market:createShop('market'),cafe:createShop('cafe')};for(const [kind,room] of Object.entries(shops)){{const {origin}=MAP.shops[kind].interior;room.scene.position.set(SHOPS[kind].x,origin.y,origin.z)}scene.add(room.scene);scene.updateMatrixWorld(true);room.camera=createIndoorCamera(camera,[...room.occluders,...shopShells[kind]]);}const worldPlayer={position:new THREE.Vector3()};
// Company offices (0.35, DESIGN 4.15): the room stands far from the map and is drawn only while you are inside (like a shop's); the name sign by the door reads the company's current name.
const offices=MAP.offices.map(o=>{const room=(o.kind==='warehouse'?createWarehouse:createOffice)({name:employerById(o.employer).name,spec:o.interior});room.scene.position.set(o.interior.origin.x,o.interior.origin.y,o.interior.origin.z);room.scene.visible=false;scene.add(room.scene);scene.updateMatrixWorld(true);room.camera=createIndoorCamera(camera,room.occluders);
 shops[o.id]=room;
 const sign=createNameBoard({text:employerById(o.employer).name,width:3.6,height:.7});sign.mesh.position.set(o.sign.x,o.sign.y,o.sign.z);sign.mesh.rotation.y=o.sign.yaw;scene.add(sign.mesh);
 if(o.kind==='warehouse'){const d=createWarehouseDoorway();d.position.set(o.door.x,0,o.door.face??o.sign.z+.04);d.rotation.y=o.door.yaw;scene.add(d)} // the person door the building model does not have, on the wall face (door.face: the model's plinth at the door, measured from its geometry)
 return {...o,key:o.id,room,sign}});
const officeByKey=key=>offices.find(o=>o.key===key)||null;
// Ridgeline's cut blocks (forest.js, marks.js): on shift the day's marked pines wear an orange band, and the landing where logs are stacked has its ring.
const treeMarks=createTreeMarks({scene,groundAt:standHeight}),landingRing=createLandingRing({scene,x:LANDING.x,z:LANDING.z,y:standHeight(LANDING.x,LANDING.z),radius:LANDING.radius});treeMarks.setVisible(false);landingRing.visible=false;
// the company's stock, drawn: the log pile at the landing and plank stacks on the lumberyard's pallets
const YARD_PALLETS=MAP.yards.find(y=>y.id==='timber-yard').items.filter(i=>i.prop==='prop.pallet'),PALLET_CENTRE={x:YARD_PALLETS.reduce((s,p)=>s+p.x,0)/YARD_PALLETS.length,z:YARD_PALLETS[0].z+1};
const piles=createStockPiles({scene,groundAt:standHeight,landing:LANDING,pallets:YARD_PALLETS});
// the customer's truck (customers.js, customer-truck.js): due a little after clock-in when the day has a Load Truck task
const customerTruck=createCustomerTruck({scene,exit:MAP.exits[0],groundAt:standHeight});
// the warehouse dock's truck (4.16): a staged pickup order brings a customer's flatbed to the loading door; it leaves when the order is loaded. Visual only: the planks move by the ticket.
const dockTruck=createCustomerTruck({scene,exit:MAP.exits[0],groundAt:standHeight,route:dockRoute(MAP.exits[0]),name:'dock-truck'});let dockArrived=ticketsOf(GameState.progress.companies?.ridgeline).list.some(k=>k.kind==='pickup'&&k.status==='staged'),dockGoing=null; // a save with an order already staged finds its truck waiting
function updateDockTruck(dt){const staged=ticketsOf(GameState.progress.companies?.ridgeline).list.some(k=>k.kind==='pickup'&&k.status==='staged');let truck=null;if(dockGoing!==null)truck={stage:'gone',loaded:dockGoing};else if(staged)truck={stage:dockArrived?'waiting':'coming',loaded:0};dockTruck.update(dt,truck,{due:staged,arrived:()=>{dockArrived=true},gone:()=>{dockGoing=null;dockArrived=false}})}
function updateCustomerTruck(dt){customerTruck.update(dt,GameState.progress.shift?.truck||null,{due:truckDue(GameState.progress),arrived:()=>{GameState.progress=truckArrived(GameState.progress);persist();const t=truckOf(GameState.progress);if(t)toast('A customer\'s truck is waiting at the lumberyard: load it with '+t.order+' planks.')}})}
function custLoadHands(){const r=loadFromHands(GameState.progress);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)}
function custLoadStock(){const r=loadFromStock(GameState.progress);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();syncMarks();toast(r.message)}
function custFromBed(id){const r=loadFromBed(GameState.progress,driving.cargoOf(id));if(r.error){toast(r.error);return}driving.setCargo(id,r.cargo);GameState.progress=r.state;persist();toast(r.message)}
function custSend(){const r=sendOff(GameState.progress);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)}
// the Cargo panel: one row per kind on the bed, and the bulk moves that apply here
function cargoRows(id){const f=driving.byId.get(id);if(!f)return [];const c=driving.cargoOf(id),hands=!!GameState.progress.carry,rows=[];
 for(const kind of ['log','planks']){const n=freeCount(c,kind);if(n)rows.push({label:(kind==='log'?'Take a log · ':'Take planks · ')+n+' on the bed'+(hands?' (your hands are full)':''),disabled:hands,run:()=>{takeKind(id,kind);return {close:!!GameState.progress.carry}}})}
 for(const oid of orderIdsOf(c)){const k=ridgelineTickets().find(t=>t.id===oid);rows.push({label:`Order #${oid} · ${orderCount(c,oid)} planks are the customer's${k?.dest?`: unload them at ${destinationName(k.dest)}`:''}`,disabled:true,run:()=>({})})} // an order's planks cannot be taken off by hand or sold
 const planks=freeCount(c,'planks');
 if(planks&&onRidgeline()&&inLumberyard(f.state))rows.push({bulk:true,label:'Unload all '+planks+' planks at the lumberyard · $'+planks.toFixed(2),run:()=>{unloadAtDock(id);return {}}});
 if(planks&&truckWaiting(GameState.progress)&&Math.hypot(f.state.x-TRUCK_BAY.x,f.state.z-TRUCK_BAY.z)<25){const t=truckOf(GameState.progress);if(t.loaded<t.order)rows.push({bulk:true,label:'Move planks to the customer\'s truck · '+t.loaded+' / '+t.order,run:()=>{custFromBed(id);return {}}})}
 return rows}
function takeKind(id,kind){const f=driving.byId.get(id);if(!f)return;const r=unloadKind(GameState.progress.carry,driving.cargoOf(id),f.spec.model,kind);if(r.error){toast(r.error);return}driving.setCargo(id,r.cargo);GameState.progress={...GameState.progress,carry:r.carry};stowTool();persist();toast(r.message)}
function toggleGate(id){const open=driving.toggleGate(id);if(open===null)return;audio.click(me.position,listenerAt());toast(open?'Tailgate open: load or unload, H closes it.':'Tailgate closed.')}
function openCargo(id){const f=driving.byId.get(id);if(f)cargoUI.open(f.spec.name+' · '+cargoText(driving.cargoOf(id)),()=>cargoRows(id))}
let marksPlots=null,marksDay=0;
function syncMarks(){{const st=stockOf(GameState.progress);piles.setLogs(st.logs);piles.setPlanks(st.planks)}const p=GameState.progress,on=!!p.shift&&p.shift.employer==='ridgeline';treeMarks.setVisible(on);landingRing.visible=on;if(!on){marksPlots=null;return}
 if(p.plots===marksPlots&&p.shift.day===marksDay)return;marksPlots=p.plots;marksDay=p.shift.day;
 treeMarks.set(worldLayout().cuttable.filter(t=>isMarked(t,marksDay)&&plotAt(p,t.key).tree==='pine'))}
function loadOntoBed(id){const f=driving.byId.get(id);if(!f)return;const r=loadCarry(GameState.progress.carry,driving.cargoOf(id),f.spec.model);if(r.error){toast(r.error);return}driving.setCargo(id,r.cargo);GameState.progress={...GameState.progress,carry:r.carry};persist();toast(r.message)}
function takeOffBed(id){const f=driving.byId.get(id);if(!f)return;const r=unloadOne(GameState.progress.carry,driving.cargoOf(id),f.spec.model);if(r.error){toast(r.error);return}driving.setCargo(id,r.cargo);GameState.progress={...GameState.progress,carry:r.carry};stowTool();persist();toast(r.message)}
// The warehouse (4.16): the delivery pile inside is the company's yard stock; E takes a stack of planks from it, E at a rack bay puts it in (a full bay is a rack for the Stack task).
// Company actions (DESIGN 4.16 G, the co-op seam): every change to the company's tickets goes through here as plain data {type, ...}. Offline it runs the pure rule from tickets.js on the local
// save at once and applies the effects (piece pay, reputation) to this player; in co-op the same call will go to the authority and its answer will be applied the same way. The player is 'me' offline.
const COMPANY_RULES={take:takeTicket,stage:stagePlanks,stagePallet:stagePallet,ship:shipTicket,load:loadTicket,deliver:deliverTicket};
const absoluteNow=p=>Math.floor((p.housing.day-1)*1440+p.routine.minutes);
function applyCompany(action){
 const p=GameState.progress,id='ridgeline',co=p.companies?.[id]||{},rank=careerOf(p,id).rank,base={playerId:'me',rank,now:absoluteNow(p)},act={...base,...action};let r;
 if(action.type==='releaseOrder')r={...releaseOrderPallet(co,act.id),effects:[]}; // a failed order's pallet leaves wherever it is: no shift needed
 else if(action.type==='restock')r=returnPlanks(co,act.planks); // planks coming back from a failed order: no shift needed
 else if(action.type==='supply')r=tickSupply(co,{now:act.now,carried:p.carry?.kind==='planks'?p.carry.count:0}); // the crew's delivery runs with the clock, shift or not
 else if(action.type==='tick'){const on=p.shift?.employer===id;r=tickTickets(co,{now:act.now,release:on&&rank>=4,clockedOut:on?[]:[act.playerId]})}
 else{const rule=COMPANY_RULES[action.type];if(!rule)return {error:'Unknown company action.'};if(p.shift?.employer!==id)return {error:'Clock in to work orders for Ridgeline Timber.'};r=rule(co,act)}
 if(r.error)return {error:r.error};
 let next=r.company===co?p:{...p,companies:{...(p.companies||{}),[id]:r.company}};
 for(const e of r.effects||[])if(e.playerId===act.playerId){if(e.piece)next=recordPiece(next,e.piece,1).state;if(e.rep)next=changeRep(next,id,e.rep)}
 if(next!==p){GameState.progress=next;persist()}
 return {...r,message:r.message||''};
}
// What the warehouse card says: what to do next, from the stock, the orders and the crew's delivery (supply.js)
function warehouseHint(){const pr=GameState.progress,co=pr.companies?.ridgeline,rank=careerOf(pr,'ridgeline').rank,held=totalPlanks(co),sup=supplyOf(co),taken=ticketsOf(co).list.filter(k=>k.status==='taken'),open=openTickets(co).length;
 if(!onRidgeline())return 'Clock in at the time clock (or on the phone) to work here. Open 6 AM–6 PM.';if(rank<4)return 'The warehouse is for Yard hands (rank 4). Keep earning XP in the forest and at the sawmill.';
 const lines=[];if(taken.length)lines.push('You have '+taken.length+(taken.length>1?' orders':' order')+' to fill: take planks from a pallet in the racks, set them on the order’s pallet, then load the customer’s truck at the loading door.');else if(open)lines.push('Orders are on the table: go there (front left) and take one.');else lines.push('No orders yet: new ones come to the table through the day (from 7 AM).');
 if(sup)lines.push('A Ridgeline crew is bringing '+sup.planks+' planks for the racks by '+formatClock(sup.at%1440)+'.');else if(!held)lines.push('The racks are empty: the crew brings pallets when an order needs planks.');else lines.push(held+' planks on pallets in the racks. Every pallet shows what it holds. The upper shelves need the forklift.');
 return lines.join(' ')}
const orderLine=(k,now)=>`#${k.id} · ${k.customer} · ${k.planks} planks · ${k.kind==='pickup'?'pickup':'delivery'} ${dueText(k,now)}`;
// 0.5 s: release, expire and fail tickets (only a Yard hand or better has them); a new one shakes the phone
function tickCompany(){
 const p=GameState.progress;if(!careerOf(p,'ridgeline').hired||careerOf(p,'ridgeline').rank<4)return;
 const sup=applyCompany({type:'supply'});if(!sup.error){const at=absoluteNow(GameState.progress);if(sup.delivered){notifyPhone('jobs',sup.message);syncWarehouse()}else if(sup.scheduled)notifyPhone('jobs','Ridgeline’s crew is bringing '+sup.scheduled.planks+' planks to the warehouse by '+formatClock(sup.scheduled.at%1440)+'.')}
 const r=applyCompany({type:'tick'});if(r.error)return;const now=absoluteNow(GameState.progress);
 if(r.released?.length)notifyPhone('jobs','New order '+r.released.map(k=>orderLine(k,now)).join(' · '));
 if(r.failed?.length){
   // planks that were on an order come back to open rack space as pallets: nothing just disappears (playtest 2026-11-06). A delivery already on a truck is taken off it (cargo.js: they were the customer's, selling them was an exploit); a staged order's planks come off its square.
   const notes=[];let total=0;
   for(const k of r.failed){
    let back=0;if(k.status!=='loaded'){const rel=applyCompany({type:'releaseOrder',id:k.id});back=rel.planks||k.staged||0;updateFork()} // the order's pallet goes wherever it is (the forks too); an order from before pallets falls back to its count
    if(k.status==='loaded'&&k.vehicle&&driving.byId.get(k.vehicle)){const bed=driving.cargoOf(k.vehicle),t=removeOrderPlanks(bed,k.id);if(t.count){driving.setCargo(k.vehicle,t.cargo);back=t.count}else{const old=removePlanks(bed,k.planks);if(!old.error){driving.setCargo(k.vehicle,old.cargo);back=k.planks}}} // the second try is for a save from before the tag
    if(back>0){const res=applyCompany({type:'restock',planks:back});if(!res.error){total+=back;notes.push('#'+k.id+': '+back+' planks '+(res.toStock?(res.placed?'went back to the racks and the lumberyard':'went to the lumberyard (the racks are full)'):'went back to '+((res.cells||[]).length===1?'rack '+res.cells[0]:'the racks')))}}
   }
   if(total){syncWarehouse();persist()}
   notifyPhone('jobs','Order '+r.failed.map(k=>'#'+k.id+' · '+k.customer).join(', ')+' failed: you lose reputation.'+(notes.length?' '+notes.join('; ')+'.':''));
  }
}
// E at the order table: the open orders as choices (three at a time), taken with applyCompany
function closeWorldDialog(){$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()} // what Esc does: a choice at a station is done, so the dialog goes away
function orderTable(page){
 page=typeof page==='number'?page:0;
 const pr=GameState.progress,co=pr.companies?.ridgeline,rank=careerOf(pr,'ridgeline').rank,ranks=employerById('ridgeline').ranks,entries=boardEntries(co,{now:absoluteNow(pr),rank,ranks}),view=boardPage(entries,page);
 const choices=view.items.map(e=>({label:e.label,run:()=>orderDetail(e.id)}));if(view.more)choices.push({label:view.more.label,run:()=>orderTable(view.more.page)});
 station({x:WAREHOUSE_TABLE.x,y:1.6,z:WAREHOUSE_TABLE.z},'Tasks',boardText(entries),choices);
}
// One order's card (order-table.js orderCard): who it is for, what to do and where, when it is due, what it pays; then Accept (an open order you can take) or "Show me on my task list" (your own), and Back.
function orderDetail(id){
 const pr=GameState.progress,co=pr.companies?.ridgeline,k=ticketsOf(co).list.find(t=>t.id===id);if(!k){orderTable();return}
 const rank=careerOf(pr,'ridgeline').rank,card=orderCard(k,{now:absoluteNow(pr),rank,ranks:employerById('ridgeline').ranks,company:co}),back={label:'Go back',run:()=>orderTable()};
 const choices=card.canAccept?[{label:'Accept order #'+k.id,run:()=>{closeWorldDialog();const r=applyCompany({type:'take',id:k.id});if(r.error){toast(r.error);return}setFocus('ticket:'+k.id);toast(r.message+' It is on your task list with an arrow.')}},back]
  :card.mine?[{label:'Show me on my task list',run:()=>{closeWorldDialog();setFocus('ticket:'+k.id);toast('Order #'+k.id+': follow the arrow.')}},back]:[back];
 station({x:WAREHOUSE_TABLE.x,y:1.6,z:WAREHOUSE_TABLE.z},card.title,card.text,choices);
}function syncWarehouse(){const o=offices.find(x=>x.kind==='warehouse');if(o){const co=GameState.progress.companies?.ridgeline;o.room.setStock(racksOf(GameState.progress),[...floorPallets(co).map(q=>({x:q.at.floor.x,z:q.at.floor.z,yaw:q.at.floor.yaw,count:q.count,order:q.order})),...stagingPallets(co).map(q=>({x:WAREHOUSE_STAGING[q.at.staging].x,z:WAREHOUSE_STAGING[q.at.staging].z,yaw:0,count:q.count,order:q.order}))])}}
// Picking an order (4.16 C): planks out of a floor-level rack into your hands, onto the order's staging pallet (staged through applyCompany), and the staged order loaded onto the waiting truck.
function takeFromRackNow(slot){const r=takeFromRack(GameState.progress,slot);if(r.error){toast(r.error);return}GameState.progress=r.state;stowTool();persist();syncWarehouse();toast(r.message)}
function stageOnOrder(id){const c=GameState.progress.carry;if(c?.kind!=='planks')return;const r=applyCompany({type:'stage',id,count:c.count});if(r.error){toast(r.error);return}const left=c.count-r.used;GameState.progress={...GameState.progress,carry:left>0?{kind:'planks',count:left}:null};persist();syncWarehouse();toast(r.message)}
function shipOrder(id){const k=ticketsOf(GameState.progress.companies?.ridgeline).list.find(t=>t.id===id),r=applyCompany({type:'ship',id});if(r.error){toast(r.error);return}if(k)dockGoing=k.planks;syncWarehouse();notifyPhone('jobs',r.message+' Paid '+money(PIECE_PAY.orders)+'.')}
// The forklift (4.16 D): parked in its bay in the warehouse; E at it (Yard hand or better, on shift) to drive: W S A D, R raises the forks and F lowers them. At a rack bay, a staging pallet or the delivery pile, E lifts or sets down a pallet
// of up to 40 planks (the forks' load is saved on the company, forest.js forkLoadOf). The model is about 14,000 triangles and only loaded (and drawn) in the warehouse.
const fork={on:false,state:forklift.fresh()};let forkView=null,forkGuide=null,forkLoading=false,forkHips=.95;const FORK_SIT=-.04; // forkHips: your hips' height when standing (measured as you get on); FORK_SIT: hip joint above the cushion
function loadForklift(room){if(forkView||forkLoading)return;forkLoading=true;Promise.all([import('./forklift-view.js'),import('./fork-guide-view.js')]).then(([m,g])=>{forkView=m.buildForklift();room.scene.add(forkView.group);forkGuide=g.createForkGuide();room.scene.add(forkGuide.group);updateFork()})}
function updatePalletTags(){const o=shop&&officeByKey(shop);if(!o||o.kind!=='warehouse'||!o.room.updateTags)return;const extra=[],fl=forkLoadOf(GameState.progress);if(fl>0&&forkView){const at=forklift.toWorld(fork.state,0,fp.CARRY_Z);extra.push({x:at.x,y:forkView.topY+.25,z:at.z,count:fl,product:'planks',order:palletsOf(GameState.progress.companies?.ridgeline).find(q=>q.at.fork)?.order||0})}o.room.updateTags(camera,{x:me.position.x,z:me.position.z},extra)} // the tags above the pallets (pallet-tags.js), the one on the forks too
function updateFork(){if(forkView)forkView.set(fork.state,forkLoadOf(GameState.progress))}
const forkBlocks=(x,z)=>{if(fork.on||!forkView)return false;const s=fork.state,dx=x-s.x,dz=z-s.z,c=Math.cos(s.yaw),n=Math.sin(s.yaw);return Math.abs(dx*c-dz*n)<.85&&Math.abs(dx*n+dz*c)<1.9} // a parked forklift is solid to a walker
function getOnFork(){const pr=GameState.progress;if(!onRidgeline()||careerOf(pr,'ridgeline').rank<4){toast('The forklift is for Ridgeline Yard hands (rank 4) and up, on shift.');return}if(pr.carry){toast('Put down what you are carrying first.');return}
 stowTool();{player.updateMatrixWorld(true);const h=avatar.bone?.('Hips');if(h){const v=new THREE.Vector3(),o=new THREE.Vector3();h.getWorldPosition(v);player.getWorldPosition(o);if(v.y-o.y>.6&&v.y-o.y<1.3)forkHips=v.y-o.y}}fork.on=true;fork.state={...fork.state,speed:0};keys.clear();toast('On the forklift: the controls are in the vehicle panel')}
// Seated at the wheel: the thighs forward (character.js seated pose) and both hands on the steering wheel (forklift-local (±0.14, 1.5, -0.21), turned into the character's own frame)
const forkHand={R:new THREE.Vector3(),L:new THREE.Vector3()};
function updateForkPose(){avatar.setSeated(fork.on);if(!fork.on)return;const y=1.5-(forklift.SEAT_TOP+FORK_SIT-forkHips),z=-.21-forklift.SEAT.z;forkHand.R.set(-.14,y,z);forkHand.L.set(.14,y,z);avatar.reach('R',forkHand.R,1);avatar.reach('L',forkHand.L,1);avatar.setHandCurl('R',.8);avatar.setHandCurl('L',.8)}
function getOffFork(){const s=fork.state;fork.on=false;avatar.setSeated(false);avatar.clearReach();avatar.setHandCurl('R',0);avatar.setHandCurl('L',0);fork.state={...s,speed:0};const spot=[[-1.45,0],[1.45,0],[0,-2.3],[-1.9,-1.4],[1.9,-1.4]].map(([x,z])=>forklift.toWorld(s,x,z)).find(p=>!blocked(p.x,p.z))||forklift.seatOf(s);placeSafely(spot.x,.02,spot.z);keys.clear();updateFork()}
// Physical forks (DESIGN 4.16 I, step 2): there is no E to lift or set a pallet down. The forks go into a pallet's pocket (fork-pallets.js), raising them lifts it, and lowering a carried pallet onto a free shelf
// cell, the floor or an order's staging square sets it down there (a pallet set on an order's square gives the order its planks). The panel says why the forks are stopped.
let forkListKey=null,forkBoxes=[],forkCells=new Set(),forkLock=null; // forkLock: a set-down that was refused or used up, held until the forks rise again so it is not tried every frame
function forkCtx(){
 const o=shop&&officeByKey(shop),co=GameState.progress.companies?.ridgeline,list=palletsOf(co);
 if(list!==forkListKey){forkListKey=list;forkBoxes=fp.boxesOf(list);forkCells=new Set(list.filter(q=>q.at.rack).map(q=>q.at.rack))}
 const slots=stagingOf(co),held=list.find(q=>q.at.fork),carriedOrder=held?.order||0;
 return {boxes:forkBoxes,carried:forkLoadOf(GameState.progress),carriedOrder,stagingTop:i=>{const q=list.find(x=>x.at.staging===i);return q&&!carriedOrder?fp.heightOf(q.count):0},stagingNote:i=>carriedOrder?'That is not this order\u2019s square.':slots[i]?'That order is already staged.':'No order is waiting on that square.',cellOf:slot=>RACK_SLOTS.find(c=>c.id===slot),blockedOther:(x,z)=>o.room.blockedOther(x,z),solidAt:(x,z)=>o.room.solidAt(x,z),occupied:slot=>forkCells.has(slot),stagingTaken:i=>{const k=slots[i];if(!k)return false;return carriedOrder?k.id===carriedOrder:k.status==='taken'}}
}
function forkCompany(company,message){const pr=GameState.progress;GameState.progress={...pr,companies:{...(pr.companies||{}),ridgeline:company}};persist();syncWarehouse();updateFork();if(message)toast(message)}
function stageFromForks(id){const r=applyCompany({type:'stagePallet',id});if(r.error)return r;if(r.surplus>0){const back=applyCompany({type:'restock',planks:r.surplus});r.message+=' The other '+r.surplus+' planks went '+(back.error?'nowhere':back.toStock&&!back.placed?'to the lumberyard':'back to the racks')+'.'}persist();syncWarehouse();updateFork();return r}
// after each drive step: lift a pallet the tines are in and raised, or set down the one the forks carry when it meets what is under it
// the guide: what to do next (a line in the panel) and the markers in the room (fork-guide.js, fork-guide-view.js)
let forkClock=0;
function forkGuideTick(ctx,dt){
 if(!forkGuide)return;forkClock+=dt;if(!fork.on){forkGuide.update(null,null);return}
 const g=forkGoal({carried:ctx.carried,carriedOrder:ctx.carriedOrder,boxes:ctx.boxes,staging:stagingOf(GameState.progress.companies?.ridgeline),pos:fork.state});fork.goal=g.text;forkGuide.update(g.target,forkGhost(fork.state,ctx),forkClock)
}
function forkTick(ctx,raise){
 const s=fork.state,co=GameState.progress.companies?.ridgeline;fork.hint=fp.forkHint(s,ctx);
 if(ctx.carried>0){
  const r=fp.settles(s,ctx);if(!r){forkLock=null;return}
  const key=r.kind+':'+(r.slot||r.index||'');if(raise>=0||forkLock===key)return;forkLock=key;
  if(!onRidgeline()){toast('Clock in to work the forklift for Ridgeline Timber.');return}
  if(r.kind==='rack'){const n=forkLoadOf(GameState.progress),res=setPallet(co,{rack:r.slot});if(res.placed)forkCompany(res.company,'Set the pallet in rack '+r.slot+' · '+n+' planks.');else toast(res.error)}
  else if(r.kind==='floor'){const n=forkLoadOf(GameState.progress),res=setPallet(co,{floor:{x:r.x,z:r.z,yaw:r.yaw}});if(res.placed)forkCompany(res.company,'Set the pallet down · '+n+' planks.');else toast(res.error)}
  else if(r.kind==='staging'){const k=stagingOf(co)[r.index],res=k&&stageFromForks(k.id);if(res)toast(res.error||res.message)}
  return;
 }
 forkLock=null;
 const b=fp.liftsNow(s,ctx.boxes);
 if(b){if(!onRidgeline()){toast('Clock in to work the forklift for Ridgeline Timber.');return}const res=liftPallet(co,b.id);if(res.lifted)forkCompany(res.company,'Lifted a pallet · '+res.lifted+' planks.')}
}
// E on the forklift only gets you off (and only when it is nearly stopped)
function forkOffers(add){const s=fork.state,here={x:me.position.x,z:me.position.z},at=()=>worldPoint({x:me.position.x,y:2,z:me.position.z});add('fork-off',here,at,Math.abs(s.speed)<.6?'Get off the forklift':'Stop to get off',()=>{if(Math.abs(fork.state.speed)<.6)getOffFork()},9)}
// Delivery orders (4.16 C): a staged delivery is loaded through the loading door onto a truck with a bed parked within 16 m of the dock (yours or the company's), driven to the house, and unloaded at its drop spot.
const ridgelineTickets=()=>ticketsOf(GameState.progress.companies?.ridgeline).list;
const deliveryBed=k=>driving.bedsWithin(DOCK_BAY.x,DOCK_BAY.z,16).find(b=>!addPlanks(b.cargo,b.model,k.planks).error)||null;
function loadDelivery(id){const k=ridgelineTickets().find(t=>t.id===id),bed=k&&deliveryBed(k);if(!bed){toast('Park a truck with a bed outside the loading door first.');return}
 const r=applyCompany({type:'load',id,vehicle:bed.id});if(r.error){toast(r.error);return}driving.setCargo(bed.id,addPlanks(bed.cargo,bed.model,k.planks,k.id).cargo);syncWarehouse();persist();toast(r.message+' It is marked on your task list: '+destinationName(k.dest)+'.');setFocus('ticket:'+k.id)} // the planks are tagged with the order (cargo.js): they cannot be sold or taken off anywhere but at the address
function deliverOrder(id){const k=ridgelineTickets().find(t=>t.id===id),d=k&&dropSpot(k.dest),f=k&&driving.byId.get(k.vehicle);
 if(!f||!f.present||Math.hypot(f.state.x-d.x,f.state.z-d.z)>30){toast('Bring the truck with the order here first.');return}
 const bed=driving.cargoOf(k.vehicle),tagged=removeOrderPlanks(bed,k.id),off=tagged.count>=k.planks?{cargo:tagged.cargo}:removePlanks(bed,k.planks); // a save from before the tag has planks without it
 if(off.error){toast(off.error);return}
 const r=applyCompany({type:'deliver',id,dest:k.dest});if(r.error){toast(r.error);return}driving.setCargo(k.vehicle,off.cargo);persist();notifyPhone('jobs',r.message+' Paid '+money(PIECE_PAY.deliveries)+'.')}
function stackAtRack(slot){const r=stackPlanks(GameState.progress,slot);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();syncWarehouse();toast(r.message)}
function takeFromPile(){const r=takeLogFromPile(GameState.progress,me.position);if(r.error){toast(r.error);return}GameState.progress=r.state;stowTool();persist();syncMarks();toast(r.message)}
function deliverByHand(){const c=GameState.progress.carry;if(c?.kind!=='planks')return;const r=deliverPlanks({...GameState.progress,carry:null},c.count);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();syncMarks();toast(r.message)}
function unloadAtDock(id){const t=takeAll(driving.cargoOf(id),'planks'),r=deliverPlanks(GameState.progress,t.count);if(r.error){toast(r.error);return}driving.setCargo(id,t.cargo);GameState.progress=r.state;persist();syncMarks();toast(r.message)}
function stackAtLanding(){const r=stackLog(GameState.progress,me.position);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)}
const officeOpen=o=>{const h=employerById(o.employer).hours,m=GameState.progress.routine.minutes;return m>=h.from&&m<h.to};
// Shop fronts: sliding doors that open as you walk up (only while the shop is open) and an OPEN / CLOSED sign.
const shopDoors=Object.entries(SHOPS).map(([kind,shopInfo])=>{
 const spec=MAP.shops[kind],door=createSlidingDoor(spec.door);door.group.position.set(shopInfo.x,0,spec.doorZ);scene.add(door.group);
 const open=label('OPEN',shopInfo.x+1.95,1.55,spec.doorZ+.02,.95,0,'#2d6a4f','#f4f9ef',.32),closed=label('CLOSED',shopInfo.x+1.95,1.55,spec.doorZ+.02,.95,0,'#8a2b2b','#fbeaea',.32);
 const dw=spec.doorway,blocker={x:shopInfo.x,z:dw.blocker.z,hx:dw.halfWidth,hz:dw.blocker.depth};colliders.push(blocker); // shuts the doorway while the door is closed
 colliders.push({x:shopInfo.x,z:dw.backWall.z,hx:dw.halfWidth,hz:dw.backWall.depth}); // the back of the doorway: you can step up to the threshold but never walk on into the building
 return {kind,x:shopInfo.x,door,open,closed,blocker};
});
for(const o of offices)SHOPS[o.id]={name:o.name||MAP.properties.find(p=>p.id===o.id)?.name||o.id,x:o.door.x,z:o.door.z}; // after the street shop doors are built: those loop over SHOPS, an office has no storefront
const indoorCamera=createIndoorCamera(camera,apartment.occluders);
// Where you are when you are indoors in a home: the studio (apartment.js) or a house (interiors.js, built the first time you go in). Each has its scene, bed, kitchen, door and camera.
const studioHome={kind:'studio',room:apartment,BED,ENTRY,EXIT,KITCHEN:{x:3,z:-3.5},camera:indoorCamera};let home=studioHome;const houseHomes=new Map();
function houseHome(id){let h=houseHomes.get(id);if(h)return h;const property=propertyById(id),landmark=MAP.landmarks.find(l=>l.id===property.landmark),room=buildHouseRoom(landmark.prop),door=doorOf(property);
 h={kind:'house',id,name:property.name,room,BED:room.BED,BED_FLOOR:room.BED_FLOOR,ENTRY:room.ENTRY,EXIT:room.EXIT,KITCHEN:room.KITCHEN,STAIRS:room.STAIRS,outside:{x:door.x+door.faceX*1.8,z:door.z+door.faceZ*1.8,yaw:Math.atan2(-door.faceX,-door.faceZ)},camera:createIndoorCamera(camera,room.occluders)};houseHomes.set(id,h);return h}
const savedCharacter=loadAppearance({getItem:key=>localStorage.getItem(key)});
const avatar=createCharacter(savedCharacter||defaults),player=avatar.group;player.name='player';scene.add(player);
// Carried things (carry.js): a log on the right shoulder (the ground logs' own mesh), or a stack of planks (the model's own plank mesh, about half size so it fits the avatar).
const groundLogs=scene.getObjectByName('ground-logs'),carryLog=new THREE.Group(),carryLogMesh=new THREE.Mesh(groundLogs.geometry,groundLogs.material);carryLogMesh.rotation.y=Math.PI/2;carryLog.add(carryLogMesh);carryLog.position.set(-.2,1.5,.05);carryLog.rotation.x=-.12;carryLog.visible=false;carryLog.name='carried-log';player.add(carryLog);
let carryPlanks=null,dropsFor=null,plankBoxes=[],planksPose=0; // plankBoxes: a put-down stack is a solid box (carry.js plankBox); planksPose: how far the two-handed carry pose has blended in
// The two drivable Eastbank vehicles (driving.js, vehicle.js): their poses come from the save. worldBlocked is blocked() without them, so a vehicle never collides with itself.
const driving=createDriving({scene,fade:world.fade,surface:(x,z)=>terrain().surfaceAt(x,z),footing:standHeight,baseBlocked:(x,z)=>worldBlocked(x,z),saved:GameState.progress.vehicles});let driveIdle=9,driveSave=0;const vehicleHud=createVehicleHud($);const fuel=createFuelStation({scene,fade:world.fade,footing:standHeight});const smoke=createSmoke(scene); // the Eastbank pumps: nozzles, hoses and the nozzle in your hand
function syncSawmill(){
 const p=GameState.progress,c=sawmillCtl,hands=!inside&&!shop;carryLog.visible=hands&&p.carry?.kind==='log';
 if(!c?.ready)return;
 if(!carryPlanks){carryPlanks=new THREE.Group();carryPlanks.name='carried-planks';for(let k=0;k<4;k++){const plain=c.plank.material.clone();plain.color.multiplyScalar(PLANK_TINT[k]);const m=new THREE.Mesh(c.plank.geometry,plain);m.position.y=k*.12;carryPlanks.add(m)}carryPlanks.position.set(PLANK_STACK.x,PLANK_STACK.y,PLANK_STACK.z);player.add(carryPlanks)}
 const n=p.carry?.kind==='planks'?p.carry.count:0;carryPlanks.visible=hands&&n>0;carryPlanks.children.forEach((m,i)=>m.visible=i<n);
 if(dropsFor!==p.plankDrops){dropsFor=p.plankDrops;c.setDrops(dropsFor.map(d=>({...d,floor:heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0)})));plankBoxes=dropsFor.map(d=>plankBox(d,c.plankSize))}
 if(!c.cutting&&c.count()!==p.belt)c.setBelt(p.belt); // a new game or a loaded save: the belt shows what is saved
}
// Rendering consumes the simulation state; gameplay never reads mesh transforms.
function syncPlayerMesh(){
 player.position.set(me.position.x,me.position.y,me.position.z);
 player.rotation.y=me.rotation.y;player.visible=!driving.active; // no seated pose in the cab in 0.33: the avatar is hidden while driving a truck
 if(fork.on){const p=forklift.seatOf(fork.state);player.position.set(p.x,forklift.SEAT_TOP+FORK_SIT-forkHips,p.z)} // on the forklift (an open cab) you are seen sitting on its seat: hips on the cushion
}
function getMeWorldPosition(target){
 target.set(me.position.x,me.position.y,me.position.z);
 return player.parent.localToWorld(target);
}

setMePosition(MAP.spawn.x,MAP.spawn.y,MAP.spawn.z);let yaw=0,pitch=.38,zoom=7,zoomTarget=7,active=false,modal=false,discovered=false,phase=0,busy=null,worldPanel=null,selectedInteraction=null;const keys=createMovementInput(window,document,()=>active&&!modal&&!creatorOpen&&!actionBusy());const updateCamera=createCameraController(camera,cameraSolids,trees,lampMeshes);
// Reset safety net (safe-spot.js). Every reset, teleport and rescue goes through placeSafely: a destination that is blocked (a car parked on the spawn, a
// closed shop door's blocker) becomes the nearest clear spot instead, never a place you cannot walk out of. Runs when asked, never per frame.
function placeSafely(x,y,z,{keepIfNone=false}={}){
 const indoors=inside||shop,spot=findNearestClearSpot(blocked,x,z,{maxRadius:indoors?6:MAX_SEARCH,openArea:indoors?0:OPEN_AREA})||{x,z,distance:Infinity};
 if(spot.distance===Infinity&&keepIfNone)return {x:me.position.x,z:me.position.z,moved:false,found:false}; // a teleport that finds nothing clear stays where it is
 setMePosition(spot.x,y,spot.z);if(!indoors)camera.position.set(spot.x,4,spot.z+7);
 return {x:spot.x,z:spot.z,moved:spot.distance>.0001,found:spot.distance!==Infinity};
}
function reset(){if(driving.active)driving.leave(()=>false);fuel.putBack(); // R while driving: the vehicle stays where it is and you go to the spawn
 if(active)look.resetMotion();if(shop){const en=officeByKey(shop)?.interior.entry||SHOP_ENTRY;return placeSafely(en.x,.02,en.z)}if(inside)return placeSafely(home.ENTRY.x,.02,home.ENTRY.z);const r=placeSafely(MAP.spawn.x,MAP.spawn.y,MAP.spawn.z);yaw=0;pitch=.38;return r}reset();
// Moves you to the nearest clear spot from where you stand (the dev panel's Unstick, and the automatic rescue in the frame loop).
function unstick(){const r=placeSafely(me.position.x,me.position.y,me.position.z);if(r.moved){persist();toast('You were stuck, so you were moved to the nearest clear spot.')}return r}
if(GameState.progress.position){const p=GameState.progress.position;if(!blocked(p.x,p.z)){me.position.x=p.x;me.position.z=p.z;camera.position.set(p.x,4,p.z+7)}else{const spot=findNearestClearSpot(blocked,p.x,p.z,{openArea:OPEN_AREA}); // a blocked saved position (the 0.31 parked car) no longer sends you back to the spawn
 if(spot){me.position.x=spot.x;me.position.z=spot.z;camera.position.set(spot.x,4,spot.z+7)}}}
function worldBlocked(x,z){if(!isWalkable(x,z)||world.blocked(x,z))return true;return colliders.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)||plankBoxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)}
function blocked(x,z){if(shop)return shops[shop].blocked(x,z)||forkBlocks(x,z);if(inside)return home.room.blocked(x,z);return worldBlocked(x,z)||driving.blocksWalker(x,z)||customerTruck.blocksWalker(x,z)||dockTruck.blocksWalker(x,z)} // a drivable vehicle is solid to a walker (its hull, inflated by the player radius)
function clearWorldPanel(){if(worldPanel?.actor){const pa=getMeWorldPosition(new THREE.Vector3()),pb=worldPanel.actor.getWorldPosition(new THREE.Vector3());yaw=Math.atan2(pa.x-pb.x,pa.z-pb.z)+.45;pitch=.32;zoom=zoomTarget=5.8;}worldPanel=null;look.resetMotion()}
function pause(show){if(sleepElapsed!==null)return;if(show){phone?.close();inventoryUI?.close();storeUI?.close();}if(show){$('dialog').hidden=true;clearWorldPanel();}$('controls').hidden=!show;modal=show;keys.clear();if(show)look.release()}
function startGame(){if(currentAppearance.name){saveMenu.backupOnPlay();$('welcome').hidden=true;active=true}else openCreator()}$('start').onclick=startGame;$('help').onclick=()=>pause(true);
// Credits (credits.js): built from the data the first time they are opened from the Controls panel.
let openCredits=()=>{};{let built=false,from='controls';function buildCredits(){const list=$('creditsList');for(const c of CREDITS){const row=document.createElement('div');row.className='credit';const who=document.createElement('b');who.textContent=c.who;const what=document.createElement('span');what.textContent=c.what;const lic=document.createElement('small');lic.textContent=c.licence+' · ';if(c.url){const a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=c.url.replace(/^https?:\/\//,'');lic.appendChild(a)}else lic.textContent=c.licence;row.append(who,what,lic);list.appendChild(row)}built=true}
 openCredits=source=>{from=source;if(!built)buildCredits();if(source==='menu')$('welcome').hidden=true;else $('controls').hidden=true;$('credits').hidden=false};
 $('showCredits').onclick=()=>openCredits('controls');$('closeCredits').onclick=()=>{$('credits').hidden=true;if(from==='menu')$('welcome').hidden=false;else $('controls').hidden=false}}$('resume').onclick=()=>{pause(false);look.capture()};
// Back to the main menu: save, leave any multiplayer server, and reload the page. The reload is the cleanest reset (scenes, timers, sockets, held input), and the save has just been written.
$('mainMenu').onclick=()=>{persist();multiplayer.disconnect();const go=()=>{if(typeof location!=='undefined')location.reload()};if(cloud.user)Promise.race([cloud.pushIfChanged(),new Promise(r=>setTimeout(r,3000))]).finally(go);else go()};$('closeDialog').onclick=()=>{$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()};
function updateHomeNotices(){const n=GameState.progress.homeNotices;if(n?.length){toast(n.join(' '));GameState.progress.homeNotices=[];persist()}} var saveLocked=false; // var, not let: persist() is hoisted and may run before this line. Set once an import or restore has written a new save: nothing may save the old game over it while the page reloads
 function persist(){if(saveLocked)return;refreshHotbar();refreshSkillHud();if(!inside&&!shop){const at=driving.active?driving.door():me.position;GameState.progress.position={x:at.x,z:at.z}} // driving: you are saved standing at the driver's door, and the vehicles where they were left
 GameState.progress.vehicles=driving.save();const ok=saveProfile({playerId:me.id,name:me.name,progress:GameState.progress});$('progressStatus').textContent=ok?'Saved on this browser':'Saving unavailable · session only';return ok}
// A phone notification (DESIGN 4.19): saved as a message for its app (messages.js), shown as a toast that waits its turn behind any toast still showing (at most three wait), the phone button shakes and every
// app badge is redrawn, and a soft two-note ping plays. `app` is the phone app it belongs to: jobs, store, bank, homes, player or gigs.
function notifyPhone(app,text){
 const p=GameState.progress,r=addMessage(p,{app,text,at:absoluteNow(p)});GameState.progress=r.state;persist();
 queueToast(text);phone?.notify(app);audio.ping();
}
function toast(text){showToast(text,4500)}
const toastQueue=[];let toastShowing=false;
function showToast(text,ms){$('jobToast').textContent=text;$('jobToast').hidden=false;toastShowing=true;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{toastShowing=false;$('jobToast').hidden=true;const next=toastQueue.shift();if(next)showToast(next,3800)},ms)}
// a notification toast: shown at once when nothing is showing, otherwise it waits (the three newest are kept); action feedback (toast) still shows at once
function queueToast(text){if(!toastShowing){showToast(text,3800);return}toastQueue.push(text);while(toastQueue.length>3)toastQueue.shift()}
function showDialog(kicker,title,text,tag,action,label){
 if(sleepElapsed!==null||consuming)return;
 phone?.close();inventoryUI?.close();storeUI?.close();
 clearWorldPanel();$('dialog').classList.remove('in-world');$('dialog').style.left='';$('dialog').style.top='';$('thirdAction').hidden=true;
 $('extraAction').hidden=true;modal=true;look.release();keys.clear();$('dialog').hidden=false;$('dialogKicker').textContent=kicker;$('dialogTitle').textContent=title;$('dialogText').textContent=text;$('dialogTag').textContent=tag;
 $('jobAction').hidden=!action;$('jobAction').textContent=label||'';$('jobAction').onclick=action||null;$('closeDialog').textContent=action?'Not now':'Keep exploring';
}
function finishJob(action){
 if(action==='pickup'&&!shopOpen('market',GameState.progress.routine)){toast('The market has closed for today.');return}
 const result=transactJob(GameState.progress,action,me.position,{shop});if(result.error){toast(result.error);return}
 GameState.progress=result.state;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
 toast(result.paid?`${money(result.paid)} earned · delivery completed`:'Order collected. Follow the marker to your customer.');
}
function enterHome(target=studioHome){target.room.frontDoor?.snap(false);  if(target.kind==='studio'&&!GameState.progress.housing.rented)return;persist();home=target;home.room.setFloor?.(0);inside=true;if(home.kind==='house')zoom=zoomTarget=9;home.room.scene.add(player);setMePosition(home.ENTRY.x,.02,home.ENTRY.z);yaw=0;pitch=home.kind==='house'?.85:.4;camera.position.set(home.ENTRY.x,3,home.ENTRY.z+5.5);$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
}
let leaveAfter=0;function leaveHomeSwing(){const d=home.room.frontDoor;if(!d||leaveAfter>0){if(!d)leaveHome();return}d.setOpen(true);leaveAfter=.5} // the door swings open, then you step outside (updateDoors)
function leaveHome(){home.room.frontDoor?.snap(false);leaveAfter=0;doorCooldown=2;look.resetMotion();inside=false;scene.add(player);const out=home.kind==='studio'?{x:STUDIO.x,z:STUDIO.z,yaw:0,y:.165}:{...home.outside,y:standHeight(home.outside.x,home.outside.z)};setMePosition(out.x,out.y,out.z);yaw=out.yaw;camera.position.set(out.x+Math.sin(out.yaw)*5,3,out.z+Math.cos(out.yaw)*5);home.room.setFloor?.(0);if(home.kind==='house')zoom=zoomTarget=7;home=studioHome;persist();keys.clear()}
 function enterHouse(id){enterHome(houseHome(id))}
 function changeFloor(n){const st=home.STAIRS;if(!st)return;home.room.setFloor(n);setMePosition(st.x,n*home.room.FLOOR_HEIGHT+.02,n?st.topZ+.1:st.footZ);look.resetMotion();keys.clear()}
function changeHousing(action){
 if(action==='rest'){startSleep();return}
 const result=housingTransaction(GameState.progress,action,{atEntrance:!inside&&!shop&&nearby(me.position,STUDIO),atBed:inside&&!shop&&Math.hypot(me.position.x-home.BED.x,me.position.z-home.BED.z)<1.4});
 if(result.error){toast(result.error);return}GameState.progress=result.state;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
 if(action==='rent'){toast('Keys received · Studio 2B is yours to rent.');enterHome()}
 else toast('Bills paid.');
}
function showBills(){const h=GameState.progress.housing,due=totalDue(h);showDialog('HOME / WEEK '+weekNumber(h.day),'Your weekly bills.',h.rented?'Unpaid rent: '+money(h.rentDue)+'. Unpaid utilities: '+money(h.utilitiesDue)+'. Next bill: '+weekday(h.nextBillDay)+' (Week '+weekNumber(h.nextBillDay)+'), in '+dueIn(h)+' days. Weekly rent is $60; estimated utilities are '+money(estimatedUtilities(h))+' ($7 base for the older studio, plus $0.15 per home-cooked meal). No offline charges.':'Visit 18 Oak Street. Move-in is $90: a $30 deposit and $60 for your first week. Utilities start at $7 per week.','Total due '+money(due)+' · cash after payment '+money(GameState.progress.cash-due),due?()=>changeHousing('pay'):null,due?'Pay bills · '+money(due):'')}
$('billsButton').onclick=()=>{if(active&&!creatorOpen){phone?.close();showBills()}}; // Home & bills lives on the phone's Bank screen
function extraAction(label,action){$('extraAction').hidden=false;$('extraAction').textContent=label;$('extraAction').onclick=action}
function enterShop(kind,entry=SHOP_ENTRY){if(!shopOpen(kind,GameState.progress.routine)){toast(`${SHOPS[kind].name} hours: ${hoursText(kind)}`);return}persist();shop=kind;shops[kind].exitDoor.manual&&shops[kind].exitDoor.snap(false);shops[kind].scene.add(player);setMePosition(entry.x,.02,entry.z);yaw=0;pitch=.4;camera.position.set(SHOPS[kind].x,3,-5.5);$('dialog').hidden=true;clearWorldPanel();keys.clear()}
function enterOffice(o){persist();shop=o.key;if(o.kind==='warehouse'){syncWarehouse();loadForklift(o.room);updateFork()}o.room.exitDoor.manual&&o.room.exitDoor.snap(false);o.room.scene.visible=true;o.room.scene.add(player);{const en=o.interior.entry||SHOP_ENTRY;setMePosition(en.x,.02,en.z);yaw=0;pitch=.4;camera.position.set(o.interior.origin.x,3,o.interior.origin.z+en.z+5.1)}$('dialog').hidden=true;clearWorldPanel();keys.clear()}
function leaveOffice(){const o=officeByKey(shop);doorCooldown=2;look.resetMotion();busy=null;for(const mesh of o.room.occluders){mesh.material.opacity=1;mesh.material.depthWrite=true}o.room.scene.visible=false;shop=null;scene.add(player);setMePosition(o.door.out.x,standHeight(o.door.out.x,o.door.out.z),o.door.out.z);me.rotation.y=o.door.yaw;yaw=0;pitch=.4;camera.position.set(o.door.out.x+1,3,o.door.out.z+7);persist();keys.clear()}
function leaveShop(exitX=0){if(officeByKey(shop)){leaveOffice();return}doorCooldown=2;look.resetMotion();busy=null;const room=shops[shop];for(const mesh of [...room.occluders,...shopShells[shop]]){mesh.material.opacity=1;mesh.material.depthWrite=true}const door=SHOPS[shop],dw=MAP.shops[shop].doorway;shop=null;scene.add(player);setMePosition(door.x+Math.max(-dw.exit.clamp,Math.min(dw.exit.clamp,exitX)),.165,dw.exit.z);camera.position.set(door.x,3,door.z+6);persist();keys.clear()}
function useLife(action){const place=shop||(inside?'home':null);const atCounter=shop&&Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)<1.6;const atKitchen=inside&&(home.room.floor||0)===0&&Math.hypot(me.position.x-home.KITCHEN.x,me.position.z-home.KITCHEN.z)<1.5;if(shop&&!shopOpen(shop,GameState.progress.routine)){toast('The shop has closed. Please return tomorrow.');return}if(!atCounter&&!atKitchen){toast('Move closer to the counter.');return}const r=lifeTransaction(GameState.progress,action,place);if(r.error){toast(r.error);return}GameState.progress=r.state;if(action==='cook'&&home.kind==='studio'&&GameState.progress.housing.rented)GameState.progress.housing.utilityUsage+=15;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();toast(r.message)}

function nearestPerson(){return pedestrians.people.find(p=>Math.hypot(me.position.x-p.group.position.x,me.position.z-p.group.position.z)<1.5)}
function commitCafe(action,drink){const r=cafeTransaction(GameState.progress,action,me.position,shop,drink);if(r.error){toast(r.error);return false}GameState.progress=r.state;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();toast(r.message);if(['hire','clockin','order','clockout'].includes(action))look.capture();return true}
function beginCafe(action,drink){if(['brew','serve','clean'].includes(action)&&!canAct('work')){toast(refusal());return}const r=cafeTransaction(GameState.progress,action,me.position,shop,drink);if(r.error){toast(r.error);return}if(['brew','serve','clean'].includes(action)){busy={action,drink,elapsed:0,duration:action==='brew'?3:action==='clean'?2.5:1.2};$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()}else commitCafe(action,drink)}
function worldPoint(point,parent=player.parent){return parent.localToWorld(new THREE.Vector3(point.x,point.y??1.2,point.z))}
function entityPoint(actor){const p=actor.getWorldPosition(new THREE.Vector3());p.y+=1.9;return p}
function showWorld(anchor,name,text,choices=[],actor=null){
 showDialog(name,'',text,'',choices[0]?.run,choices[0]?.label);worldPanel={anchor,actor};$('dialog').classList.add('in-world');$('closeDialog').textContent=actor?'See you':'Close';
 if(choices[1])extraAction(choices[1].label,choices[1].run);if(choices[2]){$('thirdAction').hidden=false;$('thirdAction').textContent=choices[2].label;$('thirdAction').onclick=choices[2].run}
 $('dialog').classList.remove('bubble-enter');void $('dialog').offsetWidth;$('dialog').classList.add('bubble-enter');
}
function speak(actor,name,text,choices=[]){showWorld(()=>entityPoint(actor),name,text,choices,actor)}
function station(point,name,text,choices){showWorld(()=>worldPoint(point),name,text,choices)}
// The owner of a company at its office (0.35, DESIGN 4.15): the interview that hires you, promotions, tools waiting for you, and how a shift works.
function ownerMenu(o){const id=o.employer,p=GameState.progress,actor=o.room.clerk.group,owner=ownerOf(p,id).name,company=employerName(p,id),c=careerOf(p,id),e=employerById(id),choices=[];
 if(!c.hired)choices.push({label:'I’m looking for work.',run:()=>speak(actor,owner,'Everyone starts at the bottom here. You get an axe, '+money(e.ranks[0].wage)+' an hour while you’re on our land, and a little for every log. Shifts run 6 AM to 6 PM, no night work.',[{label:'I’ll take it.',run:()=>interview(o)},{label:'Let me think about it.',run:()=>{}}])});
 else{const n=nextRank(p,id);if(n&&!n.top)choices.push({label:'Am I due a promotion?',run:()=>promotionTalk(o)});if(c.owed.length)choices.push({label:'Anything waiting for me?',run:()=>{const r=collectOwed(GameState.progress,id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();speak(actor,owner,'Here you go: '+r.handed.map(t=>itemById(t)?.name||t).join(', ')+'.')}});
  choices.push({label:'How does a shift work?',run:()=>speak(actor,owner,'Clock in on your phone (Jobs) or at the time clock by the wall, from 6 AM to 5:30 PM. You’re paid by the hour while you’re on our land, plus for every log and plank. Do the day’s tasks for a bonus. I close at six.')})}
 speak(actor,owner,c.hired?'Good to see you, '+(GameState.me.name||'friend')+'.':'Morning. '+company+'. Can I help you?',choices)}
function interview(o){const id=o.employer,r=hire(GameState.progress,id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();const actor=o.room.clerk.group,owner=ownerOf(GameState.progress,id).name;
 const lines=['You’re on the crew.',r.handed.length?'Here’s your '+r.handed.map(t=>(itemById(t)?.name||t).toLowerCase()).join(' and ')+'.':'',r.owed.length?'Your bag is full: come back for your '+r.owed.map(t=>(itemById(t)?.name||t).toLowerCase()).join(' and ')+'.':'',r.boughtBack?'I’ll take those '+r.boughtBack.count+' logs off you too: '+money(r.boughtBack.earned)+'.':'','Clock in from your phone, and start with the marked pines.'].filter(Boolean);
 toast('Hired · '+employerName(GameState.progress,id)+' · '+r.rank.name);speak(actor,owner,lines.join(' '))}
function promotionTalk(o){const id=o.employer,p=GameState.progress,actor=o.room.clerk.group,owner=ownerOf(p,id).name,n=nextRank(p,id);
 if(!n||n.top){speak(actor,owner,'You’re as high as I can put you.');return}
 if(!n.ready){const need=[];if(!n.met.level)need.push('level '+n.needs.level+' (you’re '+n.have.level+')');if(!n.met.shifts)need.push(n.needs.shifts+' shifts worked (you’ve done '+n.have.shifts+')');if(!n.met.rep)need.push('a reputation of '+n.needs.rep+' (yours is '+n.have.rep+')');speak(actor,owner,'Not yet. To be a '+n.rank.name+' I want '+need.join(', ')+'.');return}
 const r=promote(GameState.progress,id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast('Promoted · '+r.rank.name);
 speak(actor,owner,'You’ve earned it. You’re a '+r.rank.name+' now: '+money(r.rank.wage)+' an hour'+(r.handed.length?', and this is for you: '+r.handed.map(t=>itemById(t)?.name||t).join(', ')+'.':'.')+(r.owed.length?' Your bag is full, so come back for the '+r.owed.map(t=>itemById(t)?.name||t).join(', ')+'.':''))}
// The company store (shelf at the back right): what only the company sells, with the price and who it is sold to. Up to three things on offer at once (the dialog's three buttons).
function companyStore(o){const id=o.employer,p=GameState.progress,actor=o.room.clerk.group,owner=ownerOf(p,id).name,list=storeItems(id).slice(0,3);
 const choices=list.map(({item})=>({label:'Buy the '+item.name+' · '+money(item.price),run:()=>{const r=buyFromCompany(GameState.progress,id,item.id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message+' '+money(item.price)+' paid.')}}));
 const lines=list.map(({item,rank})=>{const e=employerById(id),why=storeLine(p,id,item.id),lvl=item.requires?' · level '+item.requires.level:'';return item.name+' '+money(item.price)+' ('+e.ranks[rank-1].name+lvl+')'+(why.error?' — '+why.error:'')});
 showWorld(()=>worldPoint({x:OFFICE_STORE.x,y:1.9,z:OFFICE_STORE.z}),'Company store',list.length?lines.join(' · ')+'.':'Nothing on the shelves.',choices)}
function noticeBoard(o){const p=GameState.progress,sh=p.shift;station({x:OFFICE_BOARD.x,y:1.7,z:OFFICE_BOARD.z},'Notice board',sh&&sh.employer===o.employer?'Today’s tasks: '+sh.tasks.map(taskText).join(' · ')+'.':'Shifts run 6 AM to 6 PM. Clock in on your phone or at the time clock, and the day’s tasks go up here.',[])}
function managerMenu(){const c=GameState.progress.cafe,actor=shops.cafe.clerk.group;const choices=[];
 if(GameState.progress.phase==='carrying'&&GameState.progress.completed%3===1)choices.push({label:'I have your delivery.',run:()=>speak(actor,'Elena','Perfect, that’s our produce order. Thank you!',[{label:'Hand over order · '+money(routeFor(GameState.progress).pay),run:()=>finishJob('deliver')}])});
 if(c.stage==='clockout')choices.push({label:'I’m ready to clock out.',run:()=>speak(actor,'Elena','Two customers served and the table reset. Good work—here are your $24 wages.',[{label:'Clock out & collect $24',run:()=>commitCafe('clockout')}])});
 else if(c.stage==='off')choices.push({label:c.employed?'I’m here for my shift.':'Are you hiring?',run:()=>speak(actor,'Elena',c.employed?'You can clock in from 8 AM to 4 PM. Serve two customers, reset their table, and come back to me for your $24 pay.':'Yes! I need a café assistant to take orders, make coffee and look after our tables. A completed shift pays $24.',[{label:c.employed?'Clock me in.':'I’d like the job.',run:()=>commitCafe(c.employed?'clockin':'hire')}])});
 else choices.push({label:'What’s my next task?',run:()=>speak(actor,'Elena',cafeTask(GameState.progress).title+'. Your order ticket is shown on the left.')});
 choices.push({label:'I’d like lunch.',run:()=>speak(actor,'Elena','A sandwich and coffee is $6. Would you like one?',[{label:'Yes, please · $6',run:()=>useLife('meal')}])});
 speak(actor,'Elena','Hi there. What can I help you with?',choices);
}
function marketWork(){
 const actor=shops.market.clerk.group,route=routeFor(GameState.progress);
 speak(actor,'Noah',GameState.progress.phase==='carrying'?'You’ve already collected an order for '+route.name+'. Bring that one over first.':'Could you take this grocery order to '+route.name+'? They’ll pay you '+money(route.pay)+'.',GameState.progress.phase==='carrying'?[]:[{label:'Sure, I’ll take it.',run:()=>finishJob('pickup')}]);
}
// Noah at the counter: browse the store, or ask about delivery work (both used to be buried in the store window).
function marketMenu(){
 speak(shops.market.clerk.group,'Noah','Welcome to the Corner Market. What can I do for you?',[
  {label:'View items for sale',run:()=>{$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();openStore()}},
  {label:'View jobs',run:marketWork}]);
}
function openStore(){if(!atMarketCounter()){toast('The market is closed. Return between 7 AM and 10 PM.');return}storeUI.open()}
function showCafe(){const c=GameState.progress.cafe,o=ORDERS[c.customer];if(c.stage==='off'||c.stage==='clockout'){managerMenu();return}if(['order','serve'].includes(c.stage)&&customerWalking){toast('Your customer is taking a seat.');return}if(c.stage==='clean'&&shops.cafe.customer.group.visible){toast('Wait for your customer to leave the table.');return}
 if(c.stage==='order'){speak(shops.cafe.customer.group,o.name,'Could I have one '+o.drink.toLowerCase()+', please?',[{label:'Of course. Coming right up.',run:()=>commitCafe('order')}]);return}
 if(c.stage==='brew'){station({x:-1.25,y:1.5,z:-3.2},'Coffee machine','Ticket: '+o.drink,[{label:'Make espresso',run:()=>beginCafe('brew','Espresso')},{label:'Make latte',run:()=>beginCafe('brew','Latte')}]);return}beginCafe(c.stage);
}
// Hinged and double exit doors are worked by hand: E opens or shuts them, and you walk through while they are open (the sliding market door opens by itself).
function exitDoorOffer(add){const d=shops[shop]?.exitDoor;if(!d?.manual)return;const spec=(MAP.shops[shop]||officeByKey(shop)).interior.exitDoor;add('exit-door',{x:0,z:spec.z-1.1},()=>worldPoint({x:0,y:1.7,z:spec.z-.4}),d.isOpen?'Close the doors':'Open the doors',()=>{d.toggle();audio.click(listenerAt(),listenerAt())},1.9)}
function candidates(){const all=[],add=(id,point,anchor,label,run,range=1.5,key)=>all.push({id,point,anchor,label,run,range,key}); // key: the key shown on the prompt (E when missing; '' shows none)
 if(driving.active){add('exit-vehicle',{x:me.position.x,z:me.position.z},()=>new THREE.Vector3(me.position.x,me.position.y+2.4,me.position.z),driving.speed<1?'Get out':'Stop to get out',exitVehicle,9);return all} // driving: E gets you out (and nothing else is on offer)
 if(shop&&officeByKey(shop)?.kind==='warehouse'){if(fork.on){forkOffers(add);return all}const pr=GameState.progress,racks=racksOf(pr),on=onRidgeline();
  if(pr.carry?.kind==='planks')for(const s of RACK_SLOTS)if(s.level<=HAND_LEVEL&&Math.hypot(s.stand.x-me.position.x,s.stand.z-me.position.z)<2.6)add('wh-rack-'+s.id,s.stand,()=>worldPoint({x:s.x,y:1.2,z:s.z}),`Stack the planks in rack ${s.id} · ${racks[s.id]||0} / ${RACK_CAP}`,()=>stackAtRack(s.id),1.3); // by hand only the floor level; the upper shelves are for the forklift
  {const co=pr.companies?.ridgeline,slots=stagingOf(co),need=slots.map(k=>k&&k.status==='taken'?k.planks-k.staged:0),ready=slots.find(k=>k&&k.kind==='pickup'&&k.status==='staged'),readyDel=slots.find(k=>k&&k.kind==='delivery'&&k.status==='staged');
   if(on&&!pr.carry)for(const s of RACK_SLOTS)if(s.level<=HAND_LEVEL&&(racks[s.id]||0)>0&&Math.hypot(s.stand.x-me.position.x,s.stand.z-me.position.z)<2.6)add('wh-take-'+s.id,s.stand,()=>worldPoint({x:s.x,y:1.2,z:s.z}),`Take a stack from rack ${s.id} · ${racks[s.id]}${need.some(n=>n>0)?' · for your order':''}`,()=>takeFromRackNow(s.id),1.3);
   if(pr.carry?.kind==='planks')slots.forEach((k,i)=>{if(k&&need[i]>0){const p=WAREHOUSE_STAGING[i];add('wh-stage-'+k.id,p,()=>worldPoint({x:p.x,y:.9,z:p.z}),`Stage the planks on order #${k.id} · ${k.staged} / ${k.planks}`,()=>stageOnOrder(k.id),1.9)}});
   if(readyDel){const at={x:DOCK_DOOR.x-1.6,z:HALL.halfD-1},bed=deliveryBed(readyDel);add('wh-load-del',at,()=>worldPoint({x:at.x,y:1.6,z:at.z}),bed?`Load order #${readyDel.id} onto the ${bed.name} · ${readyDel.planks} planks`:`Order #${readyDel.id} is staged · park a truck with a bed outside the loading door`,()=>loadDelivery(readyDel.id),2.2)}
   if(ready){const at={x:DOCK_DOOR.x,z:HALL.halfD-1};add('wh-load',at,()=>worldPoint({x:at.x,y:1.6,z:at.z}),dockTruck.parked()?`Load order #${ready.id} onto the truck · ${ready.planks} planks`:`Order #${ready.id} is staged · the truck is on its way`,dockTruck.parked()?()=>shipOrder(ready.id):()=>toast('The customer\'s truck is still on its way to the dock.'),2.2)}}
  if(forkView)add('wh-fork',{x:fork.state.x,z:fork.state.z},()=>worldPoint({x:fork.state.x,y:1.9,z:fork.state.z}),'Drive the forklift',getOnFork,2.7);
  {const w=coolerWait(pr,'warehouse');add('wh-cooler',WAREHOUSE_COOLER,()=>worldPoint({x:WAREHOUSE_COOLER.x,y:1.3,z:WAREHOUSE_COOLER.z}),w?'Water cooler · ready in '+w+' min':'Water cooler · free water',()=>drinkCooler('warehouse'),1.6)}
  add('wh-table',WAREHOUSE_TABLE,()=>entityPoint(officeByKey(shop).room.clerk.group),'Order table · '+(openTickets(pr.companies?.ridgeline).length||'no')+' open',orderTable,2.2);
  exitDoorOffer(add);return all}
 if(shop&&officeByKey(shop)){const o=officeByKey(shop),id=o.employer,c=careerOf(GameState.progress,id),owner=ownerOf(GameState.progress,id).name,onShift=GameState.progress.shift?.employer===id;
  add('office-owner',OFFICE_COUNTER,()=>entityPoint(o.room.clerk.group),'Talk to '+owner,()=>ownerMenu(o),2.2);
  if(c.hired)add('office-clock',OFFICE_CLOCK,()=>worldPoint({x:OFFICE_CLOCK.x,y:1.9,z:OFFICE_CLOCK.z}),onShift?'Time clock · clock out':'Time clock · clock in',()=>{const r=onShift?doClockOut():doClockIn(id);if(r.error)toast(r.error);else if(onShift)toast(r.message)},1.6);
  {const w=coolerWait(GameState.progress,'office');add('office-cooler',OFFICE_COOLER,()=>worldPoint({x:OFFICE_COOLER.x,y:1.3,z:OFFICE_COOLER.z}),w?'Water cooler · ready in '+w+' min':'Water cooler · free water',()=>drinkCooler('office'),1.6)}
  add('office-store',OFFICE_STORE,()=>worldPoint({x:OFFICE_STORE.x,y:1.9,z:OFFICE_STORE.z}),'Company store',()=>companyStore(o),1.8);
  add('office-board',OFFICE_BOARD,()=>worldPoint({x:OFFICE_BOARD.x,y:2.2,z:OFFICE_BOARD.z}),'Notice board',()=>noticeBoard(o),1.7);exitDoorOffer(add);return all}
 if(shop){add('clerk',COUNTER,()=>entityPoint(shops[shop].clerk.group),shop==='market'?'Talk to Noah':'Talk to Elena',shop==='market'?marketMenu:managerMenu,1.6);exitDoorOffer(add);
 if(shop==='cafe'&&!['off','clockout'].includes(GameState.progress.cafe.stage)){const task=cafeTask(GameState.progress);add('cafe-task',task,()=>GameState.progress.cafe.stage==='order'||GameState.progress.cafe.stage==='serve'?entityPoint(shops.cafe.customer.group):worldPoint({...task,y:1.2}),task.title,showCafe,1.35)}return all}
 if(inside){const K=home.KITCHEN,B=home.BED,floor=home.room.floor||0,up=floor*(home.room.FLOOR_HEIGHT||0),st=home.STAIRS;
  if(floor===0){add('exit',home.EXIT,()=>worldPoint(home.kind==='studio'?{x:0,y:1.4,z:5.3}:{x:home.EXIT.x,y:1.4,z:home.EXIT.z+.15}),'Go outside',leaveHomeSwing);
   add('cook',{x:K.x,z:K.z},()=>worldPoint({x:K.x,y:1.3,z:K.z-1}),'Prepare a meal',()=>station({x:K.x,y:1.4,z:K.z-1},'Kitchen',GameState.progress.life.groceries+' grocery packs in your inventory.',[{label:'Cook a meal',run:()=>useLife('cook')}]))}
  if(floor===(home.BED_FLOOR||0))add('bed',B,()=>worldPoint({...B,y:.8+up}),'Sleep',()=>station({...B,y:1+up},'Take a rest?',(multiplayer.online?'Restore your energy fully. The clock keeps running while you are online.':'Sleep until 6:00 AM and restore your energy fully. You wake a little hungry and thirsty.'),[{label:'Rest and recover',run:()=>changeHousing('rest')}]),1.4);
  if(st){if(floor===0)add('up',{x:st.x,z:st.footZ},()=>worldPoint({x:st.x,y:1.4,z:st.footZ}),'Go upstairs',()=>changeFloor(1),1.5);else add('down',{x:st.x,z:st.topZ},()=>worldPoint({x:st.x,y:1.4+up,z:st.topZ}),'Go downstairs',()=>changeFloor(0),1.5)}
  return all}
 const gig=GameState.progress.activeJob;
 if(gig?.stage==='return')add('phone-gig',gig.returnLocation,()=>new THREE.Vector3(gig.returnLocation.x,1.4,gig.returnLocation.z),'Report back · collect '+money(gig.reward),()=>{
   const result=completeContract(GameState.progress,me.position);
   if(result.error){toast(result.error);return}
   GameState.progress=result.state;persist();toast('Gig complete · '+money(result.paid)+' earned');
 },1.35);

 add('home',{x:STUDIO.x,z:-8.1},()=>new THREE.Vector3(1,1.5,-8.15),GameState.progress.housing.rented?'Enter your studio':'View studio listing',()=>{if(GameState.progress.housing.rented)enterHome();else showWorld(()=>new THREE.Vector3(1,1.6,-8.15),'Studio 2B · To let','Furnished studio. $90 move-in includes a $30 deposit and the first week’s $60 rent. Utilities start at $7 per week.',[{label:'Rent studio · $90',run:()=>changeHousing('rent')}])},2.8);
 if(GameState.progress.phase==='carrying'&&GameState.progress.completed%3!==1){const r=routeFor(GameState.progress);add('delivery',r,()=>new THREE.Vector3(r.x,1.3,r.z),'Leave delivery · '+money(r.pay),()=>station(r,'Delivery collection box','Order for '+r.name+'. Payment: '+money(r.pay)+'.',[{label:'Place order & collect payment',run:()=>finishJob('deliver')}]),1.4)}
 for(const person of pedestrians.people)add('person-'+person.name,person.group.position,()=>entityPoint(person.group),'Talk to '+person.name,()=>speak(person.group,person.name,'Hey! How’s your day going?',[{label:'Any advice for someone new?',run:()=>speak(person.group,person.name,person.line)},{label:'Nice to meet you.',run:()=>speak(person.group,person.name,'You too. See you around the neighborhood!')}]),1.5);
 if(!inside&&!shop){
  const pump=fuel.pumpAt(me.position.x,me.position.z,USE_RANGE_M);
  if(pump){const at=()=>new THREE.Vector3(pump.use.x,1.2,pump.use.z);
   if(fuel.held===pump)add('fuel-hang-'+pump.id,{x:pump.holster.x,z:pump.holster.z},()=>new THREE.Vector3(pump.holster.x,1.4,pump.holster.z),'Hang the nozzle back',()=>hangNozzle(),2.2,'H'); // at the holster, so a tank cap you stand at (the fill prompt) wins over it
   else if(!fuel.held&&GameState.progress.equipped==='gas-can'){const can=canOf(GameState.progress),wrong=can.mgal>0&&can.fuel!==pump.fuel,full=can.mgal>=CAN_CAPACITY_MGAL; // the gas can in hand: hold F at the pump to fill it (no nozzle)
    add('can-fill-'+pump.id,pump.use,at,full?'Gas can full':wrong?`Your can holds ${fuelName(can.fuel)}`:`Hold to fill the gas can · ${pump.price}`,()=>toast(full?'The can is full.':wrong?`This can holds ${fuelName(can.fuel)}.`:'Hold F to fill the can.'),USE_RANGE_M,!wrong&&!full?'F':'')}
   else if(!fuel.held)add('fuel-take-'+pump.id,pump.use,at,`Take the ${pump.label} nozzle · ${pump.price}`,()=>takeNozzle(pump),USE_RANGE_M,'H')}
  {const near=driving.fillerNear(me.position.x,me.position.z,REACH_M);
   if(near){const info=driving.fuelOf(near),pt=driving.fillerPoint(near),spec=driving.byId.get(near).spec,cap=()=>new THREE.Vector3(pt.x,.95,pt.z),text=`${spec.name} · takes ${fuelName(info.type)} · ${fuelText(info.mgal,info.capacityMgal)}`;
    if(fuel.held){const right=fuel.held.fuel===info.type,full=info.mgal>=info.capacityMgal,say=full?'The tank is full.':right?'Hold F to fill.':`Wrong fuel: this one takes ${fuelName(info.type)}.`;
     add('fuel-fill',pt,cap,full?'Tank full':right?`Hold to fill · ${text}`:`Wrong fuel · takes ${fuelName(info.type)}`,()=>toast(say),REACH_M,right&&!full?'F':'')}
    else if(GameState.progress.equipped==='gas-can'){const can=canOf(GameState.progress),empty=can.mgal<=0,right=can.fuel===info.type,full=info.mgal>=info.capacityMgal,say=empty?'The can is empty. Fill it at a pump.':full?'The tank is full.':right?'Hold F to pour.':`The can holds ${fuelName(can.fuel)}; this takes ${fuelName(info.type)}.`;
     add('can-pour',pt,cap,empty?'Gas can empty':full?'Tank full':right?`Hold to pour · ${text}`:`Wrong fuel · takes ${fuelName(info.type)}`,()=>toast(say),REACH_M,!empty&&right&&!full?'F':'')}
    else add('fuel-info',pt,cap,text,()=>toast(`${text}. Take a ${fuelName(info.type)} nozzle at a pump first.`),REACH_M,'')}}
  if(!fuel.held)
  for(const d of driving.doors()){const name=d.name.replace(/^Eastbank /,'');
   if(!d.display)add('drive-'+d.id+'-'+d.seat,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,1.3,d.z),(d.seat==='driver'?'Drive the ':'Ride in the ')+name,()=>enterVehicle(d.id,d.seat),2);
   else if(d.seat==='driver'&&d.colour){const lock=vehicleLock(GameState.progress,d.model);add('buy-'+d.id,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,1.3,d.z),lock?vehicleLabel(d.model,d.colour)+' · '+money(VEHICLE_PRICE[d.model])+' · '+lock:'Buy the '+vehicleLabel(d.model,d.colour)+' · '+money(VEHICLE_PRICE[d.model]),lock?()=>toast(lock):()=>buyAtLot(d.id),2)}}
  if(sawmillCtl?.ready&&!onRidgeline())add('sawmill-closed',sawmillCtl.switchPoint,sawmillCtl.promptPoint,'Sawmill · Ridgeline Timber staff on shift only',()=>toast('The sawmill belongs to Ridgeline Timber. Get hired at their Eastbank office and clock in to use it.'),2.2);else if(sawmillCtl?.ready){const pr=GameState.progress; // the switch, the bench (a carried log goes in), the belt's end (planks come off) and planks put down on the ground
   add('sawmill-switch',sawmillCtl.switchPoint,sawmillCtl.promptPoint,switchLabel(sawmillState),toggleSawmill,2.2);
   if(pr.carry?.kind==='log')add('sawmill-feed',sawmillCtl.logPoint,sawmillCtl.logPrompt,'Put the log on the bench',feedSawmill,2.4);
   if(pr.belt>0)add('sawmill-belt',sawmillCtl.clearPoint,sawmillCtl.clearPrompt,pr.carry?'Planks on the belt · your hands are full':'Take 4 planks · '+pr.belt+(pr.belt===1?' stack':' stacks')+' on the belt',takeBeltPlanks,2.4);
   for(const d of pr.plankDrops)if(Math.hypot(d.x-me.position.x,d.z-me.position.z)<2.6)add('planks-'+d.id,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,.8+heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0),d.z),'Pick up '+d.count+' planks',()=>pickPlanks(d.id),1.8)}
  // Doors of houses (properties.js): every one is locked until its owner is you, and the inside does not exist yet.
  for(const door of doorsNow())add('door-'+door.id,door,()=>new THREE.Vector3(door.x,1.4,door.z),door.label,door.open?()=>enterHouse(door.id):()=>showWorld(()=>new THREE.Vector3(door.x,1.7,door.z),door.title,door.message),2.2);
  // cargo (cargo.js): at the back or side of an owned vehicle's bed, put what you carry on it, or take one piece off
  for(const b of driving.bedsNear(me.position.x,me.position.z)){const carry=GameState.progress.carry,name=b.name,gated=b.hasGate&&b.point.side==='rear',hint=gated?' · H closes the tailgate':'',here={x:b.point.x,z:b.point.z},at=()=>new THREE.Vector3(b.point.x,1.5,b.point.z); // a flatbed's rear is worked through its tailgate: E opens it, then loads or unloads; H closes it
   if(gated&&!b.gateOpen){add('gate-open-'+b.id,here,at,'Open the tailgate · '+cargoText(b.cargo),()=>toggleGate(b.id),LOAD_REACH);continue}
   if(carry)add('cargo-load-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),(carry.kind==='log'?'Load the log onto the ':'Load the planks onto the ')+name+' · '+cargoText(b.cargo)+hint,()=>loadOntoBed(b.id),LOAD_REACH);
   else if(new Set((b.cargo||[]).map(p=>p.k)).size>1||(countOf(b.cargo,'planks')&&truckWaiting(GameState.progress)&&Math.hypot(b.x-TRUCK_BAY.x,b.z-TRUCK_BAY.z)<25))add('cargo-panel-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),'Cargo · '+cargoText(b.cargo)+hint,()=>openCargo(b.id),LOAD_REACH);
   else if(onRidgeline()&&countOf(b.cargo,'planks')&&inLumberyard(b))add('dock-truck-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),'Unload '+countOf(b.cargo,'planks')+' planks at the lumberyard · $'+countOf(b.cargo,'planks').toFixed(2)+hint,()=>unloadAtDock(b.id),LOAD_REACH);
   else if(b.cargo?.length)add('cargo-take-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),(b.cargo[b.cargo.length-1].k==='log'?'Take a log off the ':'Take planks off the ')+name+' · '+cargoText(b.cargo)+hint,()=>takeOffBed(b.id),LOAD_REACH);if(gated)add('gate-close-'+b.id,here,at,'Close the tailgate',()=>toggleGate(b.id),LOAD_REACH,'H')}
  if(truckWaiting(GameState.progress)&&customerTruck.parked()){const pr=GameState.progress,t=truckOf(pr),rp=customerTruck.rearPoint(),cp=customerTruck.cabPoint();
   if(pr.carry?.kind==='planks')add('cust-load',rp,()=>new THREE.Vector3(rp.x,1.6,rp.z),'Load the planks onto the customer\'s truck · '+t.loaded+' / '+t.order,custLoadHands,LOAD_REACH);
   else if(!pr.carry&&t.loaded<t.order&&stockOf(pr).planks)add('cust-stock',rp,()=>new THREE.Vector3(rp.x,1.6,rp.z),'Load planks from the stock · '+t.loaded+' / '+t.order+' (stock '+stockOf(pr).planks+')',custLoadStock,LOAD_REACH);
   add('cust-cab',cp,()=>new THREE.Vector3(cp.x,2.2,cp.z),t.loaded>=t.order?'Send the truck off · '+t.loaded+' planks':'Customer\'s truck · '+t.loaded+' / '+t.order+' planks loaded',t.loaded>=t.order?custSend:()=>toast('Load '+(t.order-t.loaded)+' more planks first: at the back of the truck.'),2)}
  if(onRidgeline()&&!GameState.progress.carry&&stockOf(GameState.progress).logs)add('landing-take',LANDING,()=>new THREE.Vector3(LANDING.x,1.3,LANDING.z),'Take a log from the pile · '+stockOf(GameState.progress).logs,takeFromPile,LANDING.radius);
  if(onRidgeline()&&GameState.progress.carry?.kind==='planks')add('dock-hand',PALLET_CENTRE,()=>new THREE.Vector3(PALLET_CENTRE.x,1.4,PALLET_CENTRE.z),'Deliver '+GameState.progress.carry.count+' planks to the lumberyard · $'+GameState.progress.carry.count.toFixed(2),deliverByHand,3.2);
  if(onRidgeline()&&GameState.progress.carry?.kind==='log')add('landing-stack',LANDING,()=>new THREE.Vector3(LANDING.x,1.3,LANDING.z),'Stack the log at the landing',stackAtLanding,LANDING.radius);
  for(const o of offices){const open=officeOpen(o),name=employerName(GameState.progress,o.employer);add('office-door-'+o.id,o.door,()=>new THREE.Vector3(o.door.x,1.5,o.door.z),open?'Enter · '+(o.kind==='warehouse'?o.name:name):(o.kind==='warehouse'?o.name:name)+' · closed, opens 6 AM',open?()=>startDoorFade(()=>enterOffice(o)):()=>toast((o.kind==='warehouse'?o.name:name)+' is closed. Hours 6 AM–6 PM.'),2.2)}
  const progress=GameState.progress,axe=!!bestAxe(progress),equipped=isAxe(progress.equipped),need=equipped?hitsFor(progress.equipped,levelOf(progress.skills.lumberjack.xp).level):0;
  for(const tree of world.cuttableNear(me.position.x,me.position.z,CHOP_RANGE)){
   const hits=plotAt(progress,tree.key).hits;
   add('tree-'+tree.key,tree,()=>new THREE.Vector3(tree.x,2.2,tree.z),!onRidgeline()?'Pine · Ridgeline Timber land, clock in to work it':isSaw(progress.equipped)?'Pine · chainsaw cutting arrives with fuel and wear: use an axe for now':equipped?(hits?`Chop pine · ${hits} / ${need}`:'Chop pine · hold E to keep going'):axe?'Pine · equip your axe (hotbar)':'Pine · needs an axe',()=>startChop(tree),CHOP_RANGE);
  }
  {const nowM=Math.floor((progress.housing.day-1)*1440+progress.routine.minutes); // stumps to dig out and bare ground to plant (the Ridgeline stump and replant tasks)
   for(const [key,stage] of felledStages(progress,nowM)){if(stage!=='stump'&&stage!=='cleared')continue;const t=world.trees.get(key);if(!t||Math.hypot(t.x-me.position.x,t.z-me.position.z)>CHOP_RANGE)continue;
    const lift=()=>new THREE.Vector3(t.x,.7+heightAt(t.x,t.z),t.z);
    if(stage==='stump')add('stump-'+key,{x:t.x,z:t.z},lift,!onRidgeline()?'Stump · Ridgeline Timber land, clock in to work it':equipped?'Dig out the stump':'Stump · equip your axe to dig it out',()=>startClear(key,t),CHOP_RANGE);
    else add('plant-'+key,{x:t.x,z:t.z},lift,!onRidgeline()?'Cleared ground · clock in to plant saplings':'Plant a sapling',()=>plantHere(key),CHOP_RANGE)}}
  for(const log of progress.logs)if(!pendingLogs.has(log.id)&&Math.hypot(log.x-me.position.x,log.z-me.position.z)<2.4)add('log-'+log.id,{x:log.x,z:log.z},()=>new THREE.Vector3(log.x,.5+heightAt(log.x,log.z)+(world.floorAt(log.x,log.z)??0),log.z),'Pick up wood log',()=>pickUpLog(log.id),1.8);
 }
 if(onRidgeline())for(const k of takenBy(GameState.progress.companies?.ridgeline,'me')){const d=k.status==='loaded'&&k.dest&&dropSpot(k.dest);if(d&&Math.hypot(d.x-me.position.x,d.z-me.position.z)<3)add('deliver-'+k.id,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,.9,d.z),`Unload order #${k.id} here · ${k.planks} planks for ${k.customer}`,()=>deliverOrder(k.id),2.5)}
 for(const h of waitingHomes(GameState.progress)){const d=dropSpot(h),n=waiting(GameState.progress,h);if(d&&Math.hypot(d.x-me.position.x,d.z-me.position.z)<3)add('parcel-'+h,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,d.kind==='locker'?1.1:.5,d.z),'Collect your order · '+n+(n===1?' thing':' things'),()=>collectOrder(h),2.2)}
  for(const car of vehicles)add(car.id,car,()=>new THREE.Vector3(car.x,1.3,car.z),'Inspect '+car.name,()=>showWorld(()=>new THREE.Vector3(car.x,1.4,car.z),car.name,'Parked · not owned. Driving will be available in a future update.'),1.6);return all;
}
function toggleSawmill(){if(sawmillCtl.cutting){toast('Wait for the cut to finish.');return}const r=switchSawmill(sawmillState,undefined,GameState.progress.belt);if(r.error){toast(r.error);return}sawmillState=r.state;sawmillCtl.setOn(sawmillState.on);audio.click(sawmillCtl.switchPoint,{x:me.position.x,z:me.position.z})}
// A log goes into the saw only while it is on and the belt has room; the stack is counted at once and the Cut clip shows it (carry.js).
function feedSawmill(){if(sawmillCtl.cutting){toast('The saw is still cutting the last log.');return}const r=feedLog(GameState.progress,sawmillState.on);if(r.error){toast(r.error);return}if(!sawmillCtl.startCut(onCutDone)){toast('Switch the saw on first.');return}GameState.progress=r.state;persist();toast(r.message)}
function onCutDone(){if(GameState.progress.belt>=BELT_SLOTS&&sawmillState.on){sawmillState=freshSawmill();sawmillCtl.setOn(false);toast('The belt is full. The saw switches itself off until planks are taken away.')}}
function takeBeltPlanks(){const r=takePlanks(GameState.progress);if(r.error){toast(r.error);return}if(!sawmillCtl.frontArrived()){toast('The planks are still riding down the belt.');return}sawmillCtl.take();const milled=planksMilled(r.state,r.state.carry?.count||4);GameState.progress=milled.state;persist();stowTool();toast(r.message+(milled.finished.length?' · Task done: '+milled.finished[0]+'.':''))}
function pickPlanks(id){beginBend(()=>{const r=pickUpPlanks(GameState.progress,id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();stowTool();toast(r.message)})}
// X puts down what you carry, a little way in front of you on open ground (not on a deck, not inside a wall).
let putting=null,bendNow=0; // bendNow: 0..1, how far down the bend is; the carried log, the stack and the hands go down toward the ground with it
const LOG_HOME_V=new THREE.Vector3(LOG_HOME.x,LOG_HOME.y,LOG_HOME.z),LOG_GROUND_V=new THREE.Vector3(LOG_GROUND.x,LOG_GROUND.y,LOG_GROUND.z),LOG_DOWN=LOG_GROUND_V.clone().sub(LOG_HOME_V);let logPose=0; // putting: {elapsed,done,apply}; logPose: how far the right hand has gone up to steady the shoulder log
// The bend (carry.js bendAmount): every pick-up from the ground and every put-down leans the spine 50 degrees and drops the hips 0.22 m; `apply` runs at the bottom.
function beginBend(apply){if(putting||actionBusy()||inside||shop)return false;keys.clear();fuel.putBack();putting={elapsed:0,done:false,apply};return true}
function putDownCarried(){const p=GameState.progress;if(!p.carry||inside||shop||putting||actionBusy())return;const planks=p.carry.kind==='planks',reach=planks&&sawmillCtl?.ready?Math.max(1.1,Math.max(sawmillCtl.plankSize.x,sawmillCtl.plankSize.z)/2+.7):1.1;let x=me.position.x+Math.sin(me.rotation.y)*reach,z=me.position.z+Math.cos(me.rotation.y)*reach;const bad=(a,b)=>blocked(a,b);if(bad(x,z)){x=me.position.x;z=me.position.z;if(bad(x,z)){toast('Find some clear ground to put it down.');return}}
 const rot=me.rotation.y+Math.PI/2,q=quarterOf(me.rotation.y); // the stack lies across the way you were facing, as you carried it
 beginBend(()=>{const cur=GameState.progress,log=cur.carry?.kind==='log',r=!cur.carry?{error:'Nothing to put down.'}:log?putDownLog(cur,{x,z,rot}):putDownPlanks(cur,{x,z,q});if(r.error){toast(r.error);return}GameState.progress=r.state;persist();if(log)world.setLogs(GameState.progress.logs);toast(r.message)})}
function updatePutting(dt){
 if(!putting)return;const u=putting;u.elapsed+=dt;const t=u.elapsed/BEND_TIME;bendNow=bendAmount(t);avatar.setLean(bendLean(t));avatar.setCrouch(bendDrop(t));
 if(!u.done&&u.elapsed>=BEND_TIME*BEND_RELEASE){u.done=true;u.apply()}
 if(u.elapsed>=BEND_TIME){avatar.setLean(0);avatar.setCrouch(0);bendNow=0;putting=null}
}
// The carry poses follow the carry kind in the saved state, so a load, a pick-up or a put-down always agree with what is drawn: planks (both hands under the stack) and a log (the right hand steadies it from above).
function updateCarryPose(dt){
 avatar.setHandCurl('R',logPose*0.9);
 const kind=GameState.progress.carry?.kind,free=!inside&&!shop,wasP=planksPose>0,wasL=logPose>0;planksPose=poseBlend(planksPose,kind==='planks'&&free,dt);logPose=poseBlend(logPose,kind==='log'&&free,dt);
 carryLog.position.lerpVectors(LOG_HOME_V,LOG_GROUND_V,bendNow);if(carryPlanks)carryPlanks.position.set(PLANK_STACK.x,PLANK_STACK.y-.7*bendNow,PLANK_STACK.z+.3*bendNow);
 // each hand has its own blend: the left hand holds the stack, the right hand steadies a log; a hand is let go once its own blend is back at zero (the axe, if held, keeps the right hand)
 if(planksPose>0){for(const side of Object.keys(PLANK_HANDS)){const h=PLANK_HANDS[side],pole=PLANK_POLES[side];avatar.reach(side,CARRY_HAND.set(h.x,h.y-.7*bendNow,h.z+.3*bendNow),planksPose,CARRY_POLE_V.set(pole.x,pole.y,pole.z))}}else if(wasP)avatar.reach('L',null,0);
 if(logPose>0)avatar.reach('R',CARRY_HAND2.set(LOG_HAND.x,LOG_HAND.y,LOG_HAND.z).addScaledVector(LOG_DOWN,bendNow),logPose,CARRY_POLE_V2.set(LOG_POLE.x,LOG_POLE.y,LOG_POLE.z));else if(wasL&&!GameState.progress.equipped)avatar.reach('R',null,0);
}
const CARRY_HAND2=new THREE.Vector3(),CARRY_POLE_V2=new THREE.Vector3();const CARRY_HAND=new THREE.Vector3(),CARRY_POLE_V=new THREE.Vector3();
let doorsFor=null,doorList=[];const doorsNow=()=>{const p=GameState.progress.properties;if(p!==doorsFor){doorsFor=p;doorList=worldDoors(heldIds(GameState.progress))}return doorList}; // a door opens for every home you rent or own (ownership.js)
// One thing at a time (actions.js): the flags come straight from the game's own state, so nothing can stay "held" by mistake.
const actionFlags=()=>({chop:!!chopping,consume:!!consuming,work:!!busy,sleep:sleepElapsed!==null,door:!!doorFade});
const canAct=kind=>canStart(kind,actionFlags()),actionBusy=()=>!!activeAction(actionFlags());
// Fuel (0.35): taking and hanging up a nozzle (H, so it never competes with E for doors), filling a stopped vehicle while you HOLD F (E stays for doors), and the hose limit. Rules: fuel.js. The station: fuel-station.js.
let fillBlocked=false,fillAcc=0,fillSave=0,fillToast=0,fHeld=false,fuelFlow=0,fuelFull=0,fillSale=null,nozzlePose=0;
const NOZZLE_HAND=new THREE.Vector3(-.26,1.08,.5),NOZZLE_POLE=new THREE.Vector3(-.5,-.4,-.1),nozzleHandAt=new THREE.Vector3(),listenerAt=()=>({x:me.position.x,z:me.position.z});
function takeNozzle(pump){
 if(inside||shop||driving.active||actionBusy()||putting)return;
 if(GameState.progress.carry){toast('Your hands are full. Put it down first (X).');return}
 if(fuel.held){toast('You already have a nozzle out.');return}
 stowTool();fuel.take(pump);fillBlocked=false;fillSale={mgal:0,cents:0};fuel.setReadout(pump,fillSale);audio.click(pump.use,listenerAt());
 toast(`${fuelTitle(pump.fuel)} nozzle in your hand. Go to the glowing tank cap and hold F to fill.`);
}
function hangNozzle(quiet=false){const p=fuel.putBack();fillAcc=0;fillSale=null;if(p){audio.click(p.use,listenerAt());if(!quiet){toast('Nozzle back in its holster.');persist()}}return p}
// The hose is at most HOSE_MAX_M long: past that the nozzle goes back by itself. Inside a building or in a vehicle it always does. The tank caps glow while a nozzle is in your hand.
function fuelHose(){
 driving.showFillers(!!fuel.held&&!inside&&!shop&&!driving.active,fuel.held?fuel.held.fuel:null);
 if(!fuel.held)return;
 if(inside||shop||driving.active){hangNozzle(true);return}
 avatar.hand.getWorldPosition(nozzleHandAt);
 const r=fuel.update({x:me.position.x,z:me.position.z,yaw:me.rotation.y,hand:nozzlePose>.5?nozzleHandAt:null});
 if(r&&r.limit){hangNozzle();toast('The hose is at its limit, so the nozzle went back.')}
}
// The right arm holds the nozzle out in front while it is in your hand (blended in and out like the carry poses).
function updateNozzlePose(dt){
 const want=!!fuel.held&&!inside&&!shop&&!driving.active,was=nozzlePose>0;nozzlePose=poseBlend(nozzlePose,want,dt);
 if(nozzlePose>0){avatar.reach('R',NOZZLE_HAND,nozzlePose,NOZZLE_POLE);avatar.setHandCurl('R',nozzlePose*.85)}else if(was&&!GameState.progress.equipped)avatar.reach('R',null,0);
}
// Filling: while you HOLD F with a nozzle out and a stopped vehicle's filler cap within reach, fuel flows at FLOW_MGAL_PER_S, in whole steps, paid as it goes.
// The gas can in hand: hold F at a pump to fill it (paid as it goes), or at a tank cap to pour it in (free). Rules: fillCan and pour (fuel.js); the can's fuel is saved on its inventory slot.
let canAt=null;
function canTick(dt){
 if(inside||shop||driving.active||!active||modal)return;
 const P=GameState.progress,can=canOf(P);if(!can)return;
 const id=driving.fillerNear(me.position.x,me.position.z,REACH_M),pump=fuel.pumpAt(me.position.x,me.position.z,USE_RANGE_M),pouring=!!id&&can.mgal>0;
 if(!pouring&&!pump){fillAcc=0;return}
 if(fillBlocked)return;
 fillAcc+=FLOW_MGAL_PER_S*dt;const want=Math.floor(fillAcc/STEP_MGAL)*STEP_MGAL;if(want<=0)return;
 if(pouring){const info=driving.fuelOf(id),at=driving.fillerPoint(id),r=pour({can,target:{fuel:info.type,mgal:info.mgal,capacityMgal:info.capacityMgal},mgal:want});
  if(r.error){fillBlocked=true;fillAcc=0;toast(r.error);audio.chime(at,listenerAt(),{ok:r.code==='full'});return}
  fillAcc-=want;driving.setFuel(id,r.target.mgal);GameState.progress=setCan(P,r.can);canAt=at;fuelFlow=1;fuelFull=r.target.mgal/info.capacityMgal;
  fillSave+=dt;if(fillSave>=1){persist();fillSave=0}
  fillToast+=dt;if(fillToast>=.5){fillToast=0;toast(`Pouring · ${fuelText(r.target.mgal,info.capacityMgal)} · ${canText(r.can)}`)}
  if(r.can.mgal<=0||r.target.mgal>=info.capacityMgal){fillBlocked=true;fillAcc=0;fuelFlow=0;persist();toast(r.target.mgal>=info.capacityMgal?'The tank is full.':`The can is empty. ${fuelText(r.target.mgal,info.capacityMgal)}`);audio.chime(at,listenerAt(),{ok:true})}
  return}
 const r=fillCan({cash:P.cash,can},{pump:{fuel:pump.fuel},mgal:want});
 if(r.error){fillBlocked=true;fillAcc=0;toast(r.error);audio.chime(pump.use,listenerAt(),{ok:r.code==='full'});return}
 fillAcc-=want;GameState.progress={...setCan(P,r.can),cash:r.cash};canAt=pump.use;fuelFlow=1;fuelFull=r.can.mgal/CAN_CAPACITY_MGAL;
 fillSave+=dt;if(fillSave>=1){persist();fillSave=0}
 fillToast+=dt;if(fillToast>=.5){fillToast=0;toast(`Filling the can · ${canText(r.can)} · ${money(r.cash)}`)}
 if(r.soldMgal<want||r.can.mgal>=CAN_CAPACITY_MGAL){fillBlocked=true;fillAcc=0;fuelFlow=0;persist();toast(r.can.mgal>=CAN_CAPACITY_MGAL?'The can is full.':'You cannot pay for any more fuel.');audio.chime(pump.use,listenerAt(),{ok:r.can.mgal>=CAN_CAPACITY_MGAL})}
}
function fuelTick(dt){
 if(!fHeld){fillBlocked=false;fillAcc=0;if(fillSave>0){persist();fillSave=0}return}
 if(GameState.progress.equipped==='gas-can'&&!fuel.held){canTick(dt);return}
 if(!fuel.held||inside||shop||driving.active||!active||modal)return;
 const id=driving.fillerNear(me.position.x,me.position.z,REACH_M);
 if(!id){fillAcc=0;return}
 if(fillBlocked)return;
 const info=driving.fuelOf(id);
 fillAcc+=FLOW_MGAL_PER_S*dt;
 const want=Math.floor(fillAcc/STEP_MGAL)*STEP_MGAL;if(want<=0)return;
 const r=sell({cash:GameState.progress.cash,target:{fuel:info.type,mgal:info.mgal,capacityMgal:info.capacityMgal}},{pump:{fuel:fuel.held.fuel},mgal:want});
 if(r.error){fillBlocked=true;fillAcc=0;toast(r.error);audio.chime(fuel.held.use,listenerAt(),{ok:r.code==='full'});return}
 fillAcc-=want;
 driving.setFuel(id,r.target.mgal);
 GameState.progress={...GameState.progress,cash:r.cash};
 fillSale=fillSale||{mgal:0,cents:0};fillSale={mgal:fillSale.mgal+r.soldMgal,cents:fillSale.cents+r.cents};fuel.setReadout(fuel.held,fillSale);
 fuelFlow=1;fuelFull=r.target.mgal/info.capacityMgal;
 fillSave+=dt;if(fillSave>=1){persist();fillSave=0}
 fillToast+=dt;if(fillToast>=.5){fillToast=0;toast(`Filling ${fuelName(fuel.held.fuel)} · ${fuelText(r.target.mgal,info.capacityMgal)} · ${money(r.cash)}`)}
 if(r.soldMgal<want){fillBlocked=true;fillAcc=0;fuelFlow=0;toast(r.target.mgal>=info.capacityMgal?`The tank is full. ${gallons(fillSale.mgal)} gal for ${money(fillSale.cents)}.`:'You cannot pay for any more fuel.');audio.chime(fuel.held.use,listenerAt(),{ok:r.target.mgal>=info.capacityMgal})}
}function interact(key='E'){if(!active||modal||actionBusy()||putting)return;const hit=chooseInteraction(candidates().filter(c=>key==='H'?c.key==='H':c.key!=='H'),me.position,me.rotation.y);if(hit)hit.run()}
// Driving (driving.js, vehicle.js): E at a vehicle's driver door gets in (refused while carrying), E while driving gets out once you are below 1 m/s, at the door (else the other side, behind, in front).
function enterVehicle(id,seat='driver'){
 if(driving.active||inside||shop||consuming||putting||actionBusy())return;
 if(GameState.progress.carry){toast('Your hands are full. Put it down first (X).');return}
 if(driving.byId.get(id)?.display){toast('It is not yours. Buy it at the dealership lot or order it on your phone.');return}
 if(!driving.enter(id,seat))return;fuel.putBack();if(driving.active.fuelMgal>0||!driving.active.spec.fuel){audio.ignition(me.position,listenerAt(),{tier:driving.active.cls.tier});const tip=driving.exhaust();if(tip)smoke.burst(tip,START_PUFFS[driving.active.cls.tier]??6)}
 const at=driving.seat();me.position.x=at.x;me.position.z=at.z;me.rotation.y=driving.yaw;keys.clear();look.resetMotion();
 yaw=driving.yaw+Math.PI;pitch=driving.cameraPitch();zoom=zoomTarget=driving.cameraZoom();driveIdle=9;persist();
 toast(seat==='driver'?`Driving the ${driving.active.spec.name.replace(/^Eastbank /,'')} · W S accelerate and brake, A D steer, Space brakes, E gets out`:`Riding in the ${driving.active.spec.name.replace(/^Eastbank /,'')} · you are the passenger: nobody is driving · E gets out`);
}
function drinkCooler(key){const r=useCooler(GameState.progress,key);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message);audio.drink(me.position,listenerAt())} // free water at work (water-cooler.js)
function exitVehicle(){
 if(!driving.active)return;
 if(driving.speed>=1){toast('Stop first.');return}
 const f=driving.active,seatWas=driving.seatSide,door=driving.door(),p=driving.leave((x,z)=>!blocked(x,z));
 if(p){me.position.x=p.x;me.position.z=p.z}else placeSafely(door.x,me.position.y,door.z);
 me.rotation.y=f.state.yaw+(driving.seatSide==='passenger'||seatWas==='passenger'?-Math.PI/2:Math.PI/2);keys.clear();look.resetMotion();pitch=.38;zoom=zoomTarget=7;persist();
}
function updateWorldUI(){
 vehicleHud(fork.on?vehicleHudModel({forklift:{speed:fork.state.speed,lift:fork.state.lift,load:forkLoadOf(GameState.progress),hint:fork.hint||'',goal:fork.goal||''}}):vehicleHudModel({driving:driving.active,seat:driving.seatSide,name:driving.active?.spec.name,speed:driving.speed,fuel:driving.active?driving.fuelOf(driving.active.spec.id):null,ground:driving.active?(()=>{const s=terrain().surfaceAt(driving.active.state.x,driving.active.state.z);return {label:SURFACE_LABEL[s]||'Ground',factor:surfaceSpeed(s,driving.active.cls)}})():null}));
 camera.updateMatrixWorld(true);const hit=chooseInteraction(candidates(),me.position,me.rotation.y);selectedInteraction=hit;
 { const target=chopping?chopping.tree:hit?.id?.startsWith('tree-')?hit.point:null;world.setTarget(active&&!modal?target:null); }
 const p=hit?screenAnchor(hit.anchor(),camera,innerWidth,innerHeight,THREE.Vector3):null;$('prompt').hidden=!active||modal||!!busy||!!chopping||!p||!!driving.active;
 if(p){$('prompt').style.left=p.x+'px';$('prompt').style.top=p.y+'px';$('prompt').querySelector('span').textContent=hit.label;const kbd=$('prompt').querySelector('kbd');if(kbd){kbd.hidden=hit.key==='';kbd.textContent=hit.key||'E'}}
 if(worldPanel&&!$('dialog').hidden){const anchor=screenAnchor(worldPanel.anchor(),camera,innerWidth,innerHeight,THREE.Vector3);if(anchor){const width=Math.min(320,innerWidth-24),height=$('dialog').offsetHeight||260;$('dialog').style.left=Math.max(12,Math.min(innerWidth-width-12,anchor.x+26))+'px';$('dialog').style.top=Math.max(12,Math.min(innerHeight-height-12,anchor.y-height*.55))+'px';}else{$('dialog').style.left='12px';$('dialog').style.top='100px'}}
 
}
// Small destination marker, shared by pickups and drop-offs.
const marker=new THREE.Group();marker.name='objective-beacon';const markerMaterial=new THREE.MeshBasicMaterial({color:'#d4e7b3',transparent:true,opacity:.8,depthWrite:false});
const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.72,32),markerMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.2;marker.add(ring);
const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.16),markerMaterial);diamond.position.y=2.5;marker.add(diamond);scene.add(marker);
const parcel=new THREE.Mesh(new THREE.BoxGeometry(.38,.32,.22),mat('#ad8c60'));parcel.position.set(0,1.16,-.25);player.add(parcel);
const workMarker=new THREE.Mesh(new THREE.RingGeometry(.35,.43,32),new THREE.MeshBasicMaterial({color:'#e7c681',side:THREE.DoubleSide,transparent:true,opacity:.85}));workMarker.rotation.x=-Math.PI/2;shops.cafe.scene.add(workMarker);
const drinkCup=new THREE.Mesh(new THREE.CylinderGeometry(.07,.055,.17,10),mat('#eee3ce'));drinkCup.position.set(.32,1.12,.3);player.add(drinkCup);
let customerKey='',customerRoute=[],customerWalking=false,customerLeaving=false;
function updateCafeVisuals(dt){const room=shops.cafe,c=GameState.progress.cafe,key=c.day+':'+c.customer+':'+(['clean','clockout','off'].includes(c.stage)?'leaving':'seated');if(key!==customerKey){customerKey=key;if(['order','brew','serve'].includes(c.stage)){room.customer.group.visible=true;room.customer.group.position.set(0,.02,3);customerRoute=[[-2.3,3],[-2.3,-1.55],[-3.8,-1.55]];customerLeaving=false}else if(room.customer.group.visible){customerRoute=[[-2.3,-1.55],[-2.3,3],[0,4]];customerLeaving=true}}
 customerWalking=customerRoute.length>0;if(customerWalking){const g=room.customer.group,[x,z]=customerRoute[0],dx=x-g.position.x,dz=z-g.position.z,d=Math.hypot(dx,dz);g.position.y=.02;if(d<dt*1.7){g.position.set(x,.02,z);customerRoute.shift();if(!customerRoute.length){if(customerLeaving)g.visible=false;else{g.position.y=-.35;g.rotation.y=0}}}else{g.position.x+=dx/d*dt*1.7;g.position.z+=dz/d*dt*1.7;g.rotation.y=Math.atan2(dx,dz)}}
 {const cu=room.customer;cu.setMotion(customerWalking?1.7:0);cu.setSeated(!customerWalking&&cu.group.visible);if(cu.group.visible)cu.update(dt)}room.usedCup.visible=c.stage==='clean';
 if(busy){busy.elapsed+=dt;{const wobble=Math.sin(busy.elapsed*10)*.04;avatar.reach('R',new THREE.Vector3(-.2,1.1+wobble,.42),1);avatar.reach('L',new THREE.Vector3(.2,1.1-wobble,.42),1)}if(busy.elapsed>=busy.duration){const task=busy;busy=null;avatar.clearReach();commitCafe(task.action,task.drink)}}
}
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)persist()});
let saveElapsed=0,markerTime=0;
function updateWork(dt){
 workMarker.visible=false;drinkCup.visible=shop==='cafe'&&GameState.progress.cafe.stage==='serve';
 const dest=targetFor(GameState.progress),route=routeFor(GameState.progress),carrying=GameState.progress.phase==='carrying';
 $('housingStatus').textContent=GameState.progress.housing.rented?'Studio 2B · Bills due '+money(totalDue(GameState.progress.housing))+' · next in '+dueIn(GameState.progress.housing)+' days':'No home · Studio move-in $90.00';
 $('clockStatus').textContent=weekday(GameState.progress.housing.day)+' · '+clockText(GameState.progress.routine)+' · Week '+weekNumber(GameState.progress.housing.day);$('clockChip').textContent=weekday(GameState.progress.housing.day).slice(0,3)+' · '+clockText(GameState.progress.routine);$('earningsStatus').textContent='Earned today '+money(GameState.progress.routine.earned);
 $('needsStatus').textContent='Food '+Math.round(GameState.progress.life.food)+'% · Thirst '+Math.round(GameState.progress.life.thirst)+'% · Energy '+Math.round(GameState.progress.life.energy)+'%';
 $('needsStatus').dataset.depleted=String(GameState.progress.life.food===0||GameState.progress.life.thirst===0);
 renderVitals(GameState.progress.life);
 $('locationName').textContent=shop?SHOPS[shop].name.toUpperCase():inside?(home.kind==='house'?home.name.toUpperCase():'STUDIO 2B'):zoneAt(me.position.x,me.position.z).label;$('locationSubtitle').textContent=inside&&home.kind==='house'?'Cedar Heights':shop||inside?(officeByKey(shop)?'Eastbank Works':'Oak & Alder'):zoneAt(me.position.x,me.position.z).subtitle;
 if(shop){const task=cafeTask(GameState.progress),isCafe=shop==='cafe',c=GameState.progress.cafe;const exit=Math.hypot(me.position.x-SHOP_EXIT.x,me.position.z-SHOP_EXIT.z)<1.5,counter=Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)<1.6,atTask=isCafe&&Math.hypot(me.position.x-task.x,me.position.z-task.z)<1.35;
 $('cash').textContent=money(GameState.progress.cash);$('objective').querySelector('.eyebrow').textContent=isCafe&&c.stage!=='off'?'ON SHIFT · ALDER COFFEE':'NEIGHBORHOOD';$('objective').querySelector('h2').textContent=isCafe?task.title:SHOPS[shop].name;$('objective').querySelector('p').textContent=isCafe?(c.stage==='off'?'Speak to Elena at the counter about café work. $24 per shift. Start 8 AM–4 PM.':'Orders served: '+c.served+'/2 · '+(c.stage==='brew'||c.stage==='serve'?'Ticket: '+ORDERS[c.customer].drink+'. ':'')+'Follow the floor marker. Clock out to collect wages.'):officeByKey(shop)?(officeByKey(shop).kind==='warehouse'?warehouseHint():'Talk to the owner at the counter, or use the time clock on the right wall. Open 6 AM–6 PM.'):'Visit the cashier for groceries. Open 7 AM–10 PM.';$('distance').textContent=busy?'Working… '+Math.round(busy.elapsed/busy.duration*100)+'%':'Talk at the counter (E or click) · walk out the front door to leave';$('direction').style.transform='none';$('prompt').hidden=!active||modal||!!busy||(!exit&&!counter&&!atTask);$('prompt').querySelector('span').textContent=atTask?task.title:exit?'Go outside':isCafe?'Order lunch':'Buy groceries';marker.visible=false;workMarker.visible=isCafe;workMarker.position.set(task.x,.04,task.z);parcel.visible=carrying;return}


 if(inside){$('cash').textContent=money(GameState.progress.cash);const house=home.kind==='house',held=GameState.progress.properties?.[home.id];$('objective').querySelector('.eyebrow').textContent=house?'YOUR HOME':'YOUR FIRST HOME';$('objective').querySelector('h2').textContent=house?home.name:'Make yourself at home.';$('objective').querySelector('p').textContent=house?'Rest, cook, and make yourself at home. '+(held?.tenure==='rent'?'Rent '+money(listingOf(home.id).rentCents)+' every 7 days; next due in '+Math.max(0,held.nextBillDay-GameState.progress.housing.day)+' days. Pay or leave in the Housing app.':'You own this home.'):'Rest, cook, and make yourself at home. Rent: $60 / week. Next bills: '+weekday(GameState.progress.housing.nextBillDay)+' in '+dueIn(GameState.progress.housing)+' days.';$('distance').textContent=house&&home.STAIRS?'Bed: rest · Stairs: go up or down · Door: go outside':'Bed: rest · Door: go outside';$('direction').style.transform='none';
  const floor=home.room.floor||0,st=home.STAIRS,exit=floor===0&&Math.hypot(me.position.x-home.EXIT.x,me.position.z-home.EXIT.z)<1.5,bed=floor===(home.BED_FLOOR||0)&&Math.hypot(me.position.x-home.BED.x,me.position.z-home.BED.z)<1.4,kitchen=floor===0&&Math.hypot(me.position.x-home.KITCHEN.x,me.position.z-home.KITCHEN.z)<1.5,stairs=!!st&&Math.hypot(me.position.x-st.x,me.position.z-(floor===0?st.footZ:st.topZ))<1.5;$('prompt').hidden=!active||modal||(!exit&&!bed&&!kitchen&&!stairs);$('prompt').querySelector('span').textContent=exit?'Go outside':kitchen?'Prepare a meal':stairs?(floor===0?'Go upstairs':'Go downstairs'):'Rest and recover';marker.visible=false;parcel.visible=carrying;return}
 $('cash').textContent=money(GameState.progress.cash);$('deliveryCount').textContent=GameState.progress.completed+' '+(GameState.progress.completed===1?'delivery':'deliveries')+' completed';
 $('objective').querySelector('.eyebrow').textContent=carrying?'ORDER COLLECTED':'DELIVERY WORK';
 $('objective').querySelector('h2').textContent=carrying?'Deliver to '+dest.name:GameState.progress.completed?'Ready for another?':'Earn your first wages.';
 $('objective').querySelector('p').textContent=carrying?(GameState.progress.completed%3===1?'Speak to Elena at the café counter. Payment: ':'Use the marked delivery box. Payment: ')+money(route.pay)+'.':'Speak to Noah at the market counter for delivery work. Next wage: '+money(route.pay)+'.';
 const distance=Math.hypot(me.position.x-dest.x,me.position.z-dest.z);
 $('distance').textContent=Math.round(distance)+' m · '+dest.name;
 const atJob=carrying&&nearby(me.position,dest),atApartment=nearby(me.position,STUDIO); // E here only delivers an order; shop doors need no prompt
 const atCar=vehicles.some(v=>Math.hypot(me.position.x-v.x,me.position.z-v.z)<1.6);$('prompt').hidden=!active||modal||(!atJob&&!atApartment&&!atCar&&!nearestPerson());$('prompt').querySelector('span').textContent=atJob?'Deliver order':atApartment?'Apartment entrance':atCar?'Inspect parked vehicle':'Talk to '+nearestPerson()?.name;
 parcel.visible=carrying;
 if(active&&!modal){saveElapsed+=dt;if(saveElapsed>=4){saveElapsed=0;persist()}}
}
window.addEventListener('keydown',e=>{
 if(cargoUI?.isOpen&&cargoUI.key(e.code)){e.preventDefault();return}
 if(sleepElapsed!==null){if(['Tab','Space'].includes(e.code))e.preventDefault();return}
 if(creatorOpen||e.target.matches('input,select,textarea,[contenteditable=true]'))return;
 if(e.code==='KeyY'&&active&&!inside&&(!shop||inWarehouse())&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)setFocus(nextFocus(GameState.progress,trackerItems(GameState.progress,me.position,trackerRoom())));return}
 if((e.code==='KeyT'||e.code==='KeyJ')&&active&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)toggleObjective();return}
 if(e.code==='KeyM'&&active&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)minimap.toggle();return}
 if(consuming){if(e.code==='Escape'){pause(!modal);if(!modal)look.capture()}return}
 if(e.code==='KeyO'&&active&&!modal&&!creatorOpen&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat){world.setPlotOverlay(!world.plotOverlayVisible());toast(world.plotOverlayVisible()?'Reserved plots shown (C commercial, R residential, I industrial).':'Reserved plots hidden.')}return}
 if(e.code==='KeyG'&&active&&!modal&&!creatorOpen&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat){gridOn=!gridOn;toast(gridOn?'Plot grid shown in the farm and woods.':'Plot grid hidden.')}return}
 if(e.code==='KeyX'&&active&&!modal&&!creatorOpen&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)putDownCarried();return}
 if(/^Digit[1-6]$/.test(e.code)&&active&&!modal&&!creatorOpen&&!e.ctrlKey&&!e.metaKey&&!e.altKey){if(!e.repeat)hotbarUse(Number(e.code.slice(-1))-1);return}
 if((e.code==='Tab'||e.code==='KeyP')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&active){
   e.preventDefault();if(!e.repeat){inventoryUI?.close();storeUI?.close();phone.toggle()}return;
 }
 if(storeUI?.isOpen){if(e.code==='Escape'){e.preventDefault();storeUI.close()}return}
 if(phone?.isOpen){if(e.code==='Escape'){e.preventDefault();phone.close()}return}
 if(inventoryUI?.isOpen){
  if(e.code==='Escape'||e.code==='KeyI'||e.code==='KeyQ'){e.preventDefault();if(!e.repeat)inventoryUI.close();return}
  if(/^Digit[1-6]$/.test(e.code)&&!e.repeat)inventoryUI.useQuick(Number(e.code.slice(-1))-1);
  return;
 }
 if((e.code==='KeyI'||e.code==='KeyQ')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&active){e.preventDefault();if(!e.repeat)inventoryUI.open(e.code==='KeyI'?'grid':'wheel');return}
if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&active){if(!$('dialog').hidden){$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()}else {pause(!modal);if(!modal)look.capture()}}if(e.code==='KeyE'&&!e.repeat){eHeld=!modal;interact()}if(e.code==='KeyF'&&!e.repeat)fHeld=!modal;if(e.code==='KeyH'&&!e.repeat&&!modal)interact('H');});
window.addEventListener('blur',()=>{eHeld=false;fHeld=false;if(active&&!modal&&!creatorOpen)pause(true)});
window.addEventListener('keyup',e=>{if(e.code==='KeyE')eHeld=false;if(e.code==='KeyF')fHeld=false});
// Left click acts like E once the mouse is captured (the click that captures it only captures); hold to keep chopping.
window.addEventListener('mousedown',e=>{if(e.button!==0||!active||modal||creatorOpen||!look.locked())return;e.preventDefault();eHeld=true;interact()});
window.addEventListener('mouseup',e=>{if(e.button===0)eHeld=false});
const canvas=$('world');const look=createLookControls(canvas,document,()=>active&&!modal&&!creatorOpen&&!document.hidden,(dx,dy)=>{yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch+dy*.002,.08,1.05);driveIdle=0},()=>{keys.clear();if(active&&!modal&&!creatorOpen)pause(true)},info=>{$('mouseMode').textContent=info.mode==='captured'?'Mouse look: captured':info.mode==='free'?'Mouse look: free · move to screen edges to keep turning':'Click the game to look around';if(info.reason)$('mouseMode').title=info.reason});
$('retryCapture').onclick=()=>{pause(false);look.retry()};
$('lookLeft').onclick=()=>{yaw+=Math.PI/8};$('lookRight').onclick=()=>{yaw-=Math.PI/8};
canvas.addEventListener('wheel',e=>{e.preventDefault();if(active&&!modal&&!creatorOpen){const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);zoomTarget=THREE.MathUtils.clamp(zoomTarget+delta*.008,3,driving.active?Math.max(12,driving.cameraZoom()*1.4):12)}},{passive:false});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();keys.pressPointer(e.pointerId,b.dataset.key);b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=e=>keys.releasePointer(e.pointerId)});$('touchE').onclick=()=>interact();
function applyQuality(value){const high=value==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.6:1));renderer.shadowMap.enabled=high;scene.traverse(m=>{if(m.material)m.material.needsUpdate=true});renderer.setSize(innerWidth,innerHeight)}
$('quality').onchange=()=>{$('menuQuality').value=$('quality').value;$('menuQuality').onchange()}; // the main menu's setting saves and applies it
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

let creatorOpen=false,draft={...(savedCharacter||defaults)},previewTurn=.25;
const previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#38584e');
previewScene.add(new THREE.HemisphereLight('#edf5e9','#334f40',2.7));const previewLight=new THREE.DirectionalLight('#fff0d6',3);previewLight.position.set(3,5,4);previewScene.add(previewLight);
const previewAvatar=createCharacter(draft);previewScene.add(previewAvatar.group);
const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1,1.1,.12,32),new THREE.MeshStandardMaterial({color:'#527363',roughness:1}));plinth.position.y=-.06;previewScene.add(plinth);
const previewCamera=new THREE.PerspectiveCamera(34,1,.1,30);
// The preview frames a band of the figure: whole body (feet to above the head) or a close-up. previewFrame eases toward previewFocus each frame.
const PREVIEW_FRAMES={body:{y:1.02,span:2.45},head:{y:1.68,span:.75}};let previewFocus=PREVIEW_FRAMES.body;const previewFrame={...PREVIEW_FRAMES.body};
function framePreview(aspect){previewFrame.y+=(previewFocus.y-previewFrame.y)*.18;previewFrame.span+=(previewFocus.span-previewFrame.span)*.18;const half=THREE.MathUtils.degToRad(previewCamera.fov/2),span=Math.max(previewFrame.span,previewFrame.span*.62/aspect),d=span/2/Math.tan(half);previewCamera.position.set(0,previewFrame.y+d*.08,d);previewCamera.lookAt(0,previewFrame.y,0)}
// Two tabs: body and hair, then clothes. Every button names the part itself (PART_NAMES); a quick outfit sets the clothes only.
const optionLabels={body:'Body type',skin:'Skin tone',head:'Hairstyle',hair:'Hair color',outfit:'Quick outfits',top:'Top',legs:'Bottoms',feet:'Shoes'};
const CREATOR_TABS=[['look','Body & hair',['body','skin','head','hair']],['clothes','Clothes',['outfit','top','legs','feet']]];let creatorTab='look';
// The figure's height (hats and mohawks included) frames the preview: the whole body, or the head while a hairstyle or hair color is being picked.
const previewBox=new THREE.Box3();let previewHeight=1.9;
function focusPreview(head){previewFocus=head?{y:previewHeight-.32,span:.85}:{y:previewHeight/2+.02,span:previewHeight+.55}}
function updateDraft(){draft.name=$('characterName').value;previewAvatar.apply(draft);previewAvatar.group.updateMatrixWorld(true);previewBox.setFromObject(previewAvatar.group);if(Number.isFinite(previewBox.max.y))previewHeight=THREE.MathUtils.clamp(previewBox.max.y,1.4,2.4);$('previewName').textContent=draft.name.trim()||'Your character';
 document.querySelectorAll('[data-appearance]').forEach(b=>{const k=b.dataset.appearance;b.setAttribute('aria-pressed',String(k==='outfit'?CLOTHES_KEYS.every(part=>draft[part]===b.dataset.value):draft[k]===b.dataset.value))});
}
// Body type picks which parts are on offer, so the rows are rebuilt when it (or the tab) changes.
function renderOptions(){
 const host=$('appearanceOptions');host.replaceChildren();
 const tabs=document.createElement('div');tabs.className='creator-tabs';tabs.setAttribute('role','tablist');
 for(const [id,label] of CREATOR_TABS){const t=document.createElement('button');t.type='button';t.className='creator-tab';t.textContent=label;t.setAttribute('role','tab');t.setAttribute('aria-selected',String(id===creatorTab));t.onclick=()=>{creatorTab=id;renderOptions();updateDraft();focusPreview(false)};tabs.append(t)}
 const random=document.createElement('button');random.type='button';random.className='creator-random';random.textContent='Surprise me';random.title='A random hairstyle, outfit and colors';
 random.onclick=()=>{draft=randomLook({...draft,name:$('characterName').value});renderOptions();updateDraft();focusPreview(false)};tabs.append(random);host.append(tabs);
 const fixed={body:BODIES.map(([id,label])=>[label,id]),skin:palettes.skin,hair:palettes.hair,outfit:quickOutfits(draft.body).map(([id,label])=>[label,id])};
 for(const key of CREATOR_TABS.find(([id])=>id===creatorTab)[2]){
  const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=optionLabels[key];field.append(legend);
  if(key==='outfit'){const hint=document.createElement('p');hint.className='option-hint';hint.textContent='Sets your top, bottoms and shoes. Your hairstyle stays.';field.append(hint)}
  const row=document.createElement('div');row.className='options';const swatches=key==='skin'||key==='hair';
  for(const [label,value] of fixed[key]||partChoices(draft.body,key,draft[key])){
   const b=document.createElement('button');b.type='button';b.dataset.appearance=key;b.dataset.value=value;b.className=swatches?'swatch':'style-option';b.setAttribute('aria-label',label);b.title=label;
   if(swatches)b.style.setProperty('--color',value);else b.textContent=label;
   b.onclick=()=>{
    if(key==='body'){if(value!==draft.body){draft=switchBody(draft,value);renderOptions()}}
    else if(key==='outfit')for(const part of CLOTHES_KEYS)draft[part]=value; // the clothes of one outfit; the hairstyle stays
    else draft[key]=value;
    updateDraft();focusPreview(key==='head'||key==='hair');
   };
   row.append(b);
  }
  field.append(row);host.append(field);
 }
}
// Drag on the empty stage beside the panel to turn the figure.
{let dragX=null;const stage=$('creator');stage.addEventListener('pointerdown',e=>{if(e.target!==stage)return;dragX=e.clientX;stage.setPointerCapture?.(e.pointerId)});stage.addEventListener('pointermove',e=>{if(dragX===null)return;previewTurn+=(e.clientX-dragX)*.012;dragX=e.clientX});for(const type of ['pointerup','pointercancel'])stage.addEventListener(type,()=>{dragX=null})}
renderOptions();
function openCreator(){if(consuming)return;phone?.close();inventoryUI?.close();storeUI?.close();clearWorldPanel();$('dialog').hidden=true;draft={...currentAppearance};$('characterName').value=draft.name;creatorOpen=true;modal=true;look.release();keys.clear();$('welcome').hidden=true;$('controls').hidden=true;$('creator').hidden=false;document.body.classList.add('creating');creatorTab='look';renderOptions();updateDraft();focusPreview(false);Object.assign(previewFrame,previewFocus);$('characterName').focus()}
let currentAppearance={...(savedCharacter||defaults)};
if(savedCharacter)$('customizeSaved').hidden=false;
$('customizeSaved').onclick=openCreator;$('editCharacter').onclick=openCreator;
$('characterName').oninput=updateDraft;
$('rotateLeft').onclick=()=>previewTurn-=Math.PI/4;$('rotateRight').onclick=()=>previewTurn+=Math.PI/4;
function closeCreator(){creatorOpen=false;modal=false;$('creator').hidden=true;document.body.classList.remove('creating');keys.clear()}
$('cancelCreator').onclick=()=>{closeCreator();if(!active)$('welcome').hidden=false};
$('creatorForm').onsubmit=e=>{e.preventDefault();if(!$('characterName').value.trim()){$('characterName').setCustomValidity('Enter a name to begin.');$('characterName').reportValidity();return}
 $('characterName').setCustomValidity('');updateDraft();currentAppearance={...draft};avatar.apply(draft);me.name=draft.name;persist();
 const saved=saveAppearance({setItem:(key,value)=>localStorage.setItem(key,value)},draft);
 closeCreator();active=true;$('customizeSaved').hidden=false;
 if(!saved){$('objective').querySelector('p').textContent='Browser saving is unavailable. Your character will last for this session.'}
};
$('characterName').addEventListener('input',()=>$('characterName').setCustomValidity(''));
function drawCreator(){
 const narrow=innerWidth<=700,left=narrow?0:410;
 const top=narrow?Math.round(innerHeight*.38):innerHeight;
 const reserved=narrow?0:150,h=Math.max(1,top-reserved),w=narrow?innerWidth:Math.max(1,innerWidth-410);
 const y=innerHeight-top+reserved;renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);renderer.setScissor(left,y,w,h);renderer.setViewport(left,y,w,h);
 previewCamera.aspect=w/h;framePreview(w/h);previewCamera.updateProjectionMatrix();previewAvatar.group.rotation.y=previewTurn;
 renderer.render(previewScene,previewCamera);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
}


// Store orders (orders.js): a parcel moves from the queue to its home's drop spot when its time comes, and is collected there into the inventory.
let orderClock=0;
// Shifts (shift.js): on site means standing on one of the employer's sites (a zone, a plot or an interior room), or in a company vehicle (none yet). Checked twice a second with the game clock; a shift ends by itself at closing time or after an hour off site.
function doClockIn(id){const r=clockIn(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=scheduleTruck(r.state);persist();toast('Clocked in · '+employerName(GameState.progress,id));return {message:'Clocked in. '+r.tasks.length+' tasks today.'}}
function doClockOut(){const r=clockOut(GameState.progress);if(r.error)return {error:r.error};GameState.progress=r.state;persist();shiftEnded(r);return {message:'Clocked out. Paid '+money(r.stub.total)+'.'}}
const onRidgeline=()=>GameState.progress.shift?.employer==='ridgeline'; // Pine Ridge and the sawmill are the company's: they open on shift only
const CLOSED_FOREST='Pine Ridge belongs to Ridgeline Timber. Clock in to work it: your phone (Jobs) or the time clock at their Eastbank office.';
function shiftOnSite(id){return onSiteAt(id,{x:me.position.x,z:me.position.z,room:currentRoom(),inCompanyVehicle:false})}
function shiftEnded(r){const why=r.stub.reason==='end-of-day'?'The shift is over for the day.':r.stub.reason==='off-site'?'You left the site: clocked out.':'Clocked out.';toast(why+' Paid '+money(r.stub.total)+(r.repDelta?' · reputation '+(r.repDelta>0?'+':'')+r.repDelta:''))}
let shiftClock=0;function tickShifts(dt){shiftClock+=dt;if(shiftClock<.5)return;shiftClock=0;for(const o of offices){const name=employerName(GameState.progress,o.employer);o.sign.setName(name);o.room.board.setName(name)}tickCompany();syncMarks();if(shop&&officeByKey(shop)?.kind==='warehouse')syncWarehouse();const p=GameState.progress;if(!p.shift)return;const r=tickShift(p,{onSite:shiftOnSite(p.shift.employer)});if(r.state!==p){GameState.progress=r.state;if(r.stub){persist();shiftEnded(r)}}phone?.showJobs()}
let lastDue=null;function tickOrders(dt){orderClock+=dt;if(orderClock<.5)return;orderClock=0;{const h=GameState.progress.housing,due=h?totalDue(h):0;if(lastDue!==null&&due>lastDue)notifyPhone('bank','Rent and bills are due: '+money(due)+'. Pay them on the phone (Bank).');lastDue=due} const had=driving.fleet.length,before=new Set(waitingHomes(GameState.progress)),next=deliverDue(GameState.progress);
 if(next!==GameState.progress){GameState.progress=next;driving.sync(next.vehicles||[]);persist();const fresh=waitingHomes(next).filter(h=>!before.has(h))[0];if(fresh)notifyPhone('store','Your order has arrived: collect it from the '+(fresh===STUDIO_ID?'parcel locker by the studio door.':'parcel box in front of the door.'))}
 // vehicles: owned ones come into the world (a delivery just made one), the lot's display vehicles show a colour that is in stock, and a bought vehicle takes its place on the lot
 {driving.sync(GameState.progress.vehicles||[]);if(driving.fleet.length>had){const v=driving.fleet[driving.fleet.length-1];notifyPhone('store','Your '+vehicleLabel(v.spec.model,v.colour)+' has been delivered: it is parked on your driveway.')}
  for(const f of driving.fleet)if(f.display){const standing=driving.fleet.some(o=>!o.display&&o.present&&Math.hypot(o.state.x-f.spec.home.x,o.state.z-f.spec.home.z)<8);driving.setDisplay(f.spec.id,standing?null:displayColour(GameState.progress,f.spec.model))}} parcels.update(GameState.progress)}
function buyAtLot(id){const f=driving.byId.get(id);if(!f?.display||!f.colour)return;const r=buyVehicle(GameState.progress,f.spec.model,f.colour);if(r.error){toast(r.error);return}GameState.progress=r.state;driving.sync(r.state.vehicles);persist();toast(r.message)}
function collectOrder(home){const r=takeDelivery(GameState.progress,home);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)}
function commitInventory(result){
 if(result.error)return result;
 GameState.progress=result.state;persist();return result;
}
function atMarketCounter(){return shop==='market'&&Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)<1.6&&shopOpen('market',GameState.progress.routine)}
function beginConsumption(index){
 if(!canAct('consume'))return {error:refusal()};
 const item=itemById(GameState.progress.inventory.slots[index]?.id);
 if(item?.type==='tool'){inventoryUI.close();return toggleEquip(item.id)}
 const check=useItem(GameState.progress,index);
 if(check.error)return check;
 if(item.type==='equipment')return commitInventory(check);
 // Validate now, but keep ownership/stats unchanged until the animation finishes.
 inventoryUI.close();keys.clear();look.resetMotion();
 armRecovery=null; // A new use starts from wherever a still-lowering arm is.
 consuming={id:item.id,index,animation:createConsumptionAnimation(avatar,item)};
 $('consumeStatus').hidden=false;$('consumeStatus').textContent=(item.type==='drink'?'Drinking ':'Eating ')+item.name+'…';
 return {message:'Using '+item.name};
}
// Lumberjacking. E near a pine swings the equipped axe once and holding E keeps swinging (at the nearest tree in
// reach); the rules (axe, range, hits, logs, XP) live in grid.js and skills.js. The right hand follows a path in the
// character's own space: rest, overhead wind-up, then down through the trunk.
// The swing is chop-path.js: the hand follows a smooth path, the left hand joins the handle and the body leans into the blow.
function startChop(tree,{quiet=false}={}){
 if(!onRidgeline()){if(!quiet)toast(CLOSED_FOREST);return false}
 if(!canAct('chop'))return false;
 const check=chopTree(GameState.progress,tree.key,me.position);
 if(check.error){if(!quiet)toast(check.error);return false}
 me.rotation.y=Math.atan2(tree.x-me.position.x,tree.z-me.position.z);
 armRecovery=null;keys.clear();updateEquipped(0);carryWeight=1;
 const total=swingTime(levelOf(GameState.progress.skills.lumberjack.xp).level);
 chopping={tree,elapsed:0,struck:false,total,impact:CHOP_TIMING.impact*total};
 return true;
}
function updateChop(dt){
 if(!chopping||modal||document.hidden)return;
 const c=chopping;c.elapsed=Math.min(c.total,c.elapsed+dt);
 const pose=chopPose(c.elapsed/c.total);
 avatar.reach('R',pose.point,1,CARRY_POLE);avatar.setLean(pose.lean);avatar.setTwoHanded(pose.twoHand);
 if(!c.struck&&c.elapsed>=c.impact){c.struck=true;strikeTree(c)}
 if(c.elapsed>=c.total){avatar.reach('R',CARRY,1,CARRY_POLE);avatar.setLean(0);avatar.setTwoHanded(1);carryWeight=1;chopping=null;keys.clear();if(eHeld&&!modal&&!c.tree.stump)chopNext()}
}
// Digging out a stump (a Ridgeline task): the same swing as chopping, the stump is gone afterwards and the ground is bare until a sapling goes in.
function startClear(key,t){
 if(!onRidgeline()){toast(CLOSED_FOREST);return}
 if(!canAct('chop'))return;
 const check=clearStump(GameState.progress,key,me.position);if(check.error){toast(check.error);return}
 me.rotation.y=Math.atan2(t.x-me.position.x,t.z-me.position.z);armRecovery=null;keys.clear();updateEquipped(0);carryWeight=1;
 const total=swingTime(levelOf(GameState.progress.skills.lumberjack.xp).level);
 chopping={tree:{key,x:t.x,z:t.z,stump:true},elapsed:0,struck:false,total,impact:CHOP_TIMING.impact*total};
}
function strikeStump(c){
 const result=clearStump(GameState.progress,c.tree.key,me.position);if(result.error){toast(result.error);return}
 const sc=stumpCleared(result.state);GameState.progress=sc.state;persist();lastStages.set(c.tree.key,'cleared');world.setStage(c.tree.key,'cleared');minimap.invalidate();
 toast(result.message+(sc.message?' · '+sc.message:'')+(result.leveledUp?` Lumberjack level ${result.level}! ${perkText(result.level)}`:''));
}
function plantHere(key){
 if(!onRidgeline()){toast(CLOSED_FOREST);return}
 const r=plantSapling(GameState.progress,key,me.position);if(r.error){toast(r.error);return}
 const sp=saplingPlanted(r.state);GameState.progress=sp.state;persist();lastStages.set(key,'sapling');world.setStage(key,'sapling');minimap.invalidate();
 toast(r.message+(sp.message?' · '+sp.message:''));
}
function strikeTree(c){
 if(c.tree.stump){strikeStump(c);return}
 const result=chopTree(GameState.progress,c.tree.key,me.position);
 if(result.error){toast(result.error);return}
 GameState.progress=result.state;persist();
 let shiftNote='';if(result.felled){const tf=treeFelled(GameState.progress,c.tree);if(tf.state!==GameState.progress){GameState.progress=tf.state;persist()}shiftNote=tf.message?' · '+tf.message:''}
 if(result.felled){
  // The trunk falls first; its logs appear on the ground (and can be picked up) once it has landed.
  const ids=result.logs.map(l=>l.id);ids.forEach(id=>pendingLogs.add(id));
  world.fellTree(c.tree.key,me.position,()=>{ids.forEach(id=>pendingLogs.delete(id));world.setLogs(GameState.progress.logs)});
  minimap.invalidate();
  toast((result.leveledUp?`${result.message} Lumberjack level ${result.level}! ${perkText(result.level)}`:result.message)+shiftNote);
 }else{
  world.hitTree(c.tree.key,me.position);
  if(result.leveledUp)toast(`Lumberjack level ${result.level}! ${perkText(result.level)}`);
 }
}
function chopNext(){
 const next=world.cuttableNear(me.position.x,me.position.z,CHOP_RANGE).sort((a,b)=>Math.hypot(a.x-me.position.x,a.z-me.position.z)-Math.hypot(b.x-me.position.x,b.z-me.position.z))[0];
 if(next)startChop(next,{quiet:true});
}
// Whatever is picked up goes in the hands or on the shoulder, so the tool in the hand is put away first (it stays in your inventory and on the hotbar).
function stowTool(){const id=GameState.progress.equipped;if(id)toggleEquip(id,{silent:true})}
function pickUpLog(id){
 beginBend(()=>{
  const result=shoulderLog(GameState.progress,id);
  if(result.error){toast(result.error);return}
  GameState.progress=result.state;const g=logGathered(GameState.progress,id);if(g.counted)GameState.progress=g.state;persist();stowTool();world.setLogs(GameState.progress.logs);toast(result.message+(g.counted&&g.message?' · '+g.message:''));
 });
}
// Equipped tool: shown in the hand and carried at the ready (the arm blends back in after chopping or eating).
function toggleEquip(id,{silent=false}={}){if(fuel.held)return {error:'Hang up the nozzle first.'};
 if(!canAct('equip'))return {error:refusal()};
 if(GameState.progress.carry&&GameState.progress.equipped!==id)return {error:'Your hands are full. Put it down first (X).'};
 const result=equipTool(GameState.progress,id);
 if(result.error)return result;
 GameState.progress=result.state;persist();if(!silent)toast(result.message+(result.equipped===id&&id==='gas-can'?` ${canText(canOf(result.state))}. Hold F at a pump to fill it.`:''));
 return result;
}
function updateEquipped(dt){
 const want=GameState.progress.equipped;
 if(!want){if(carried){if(carried.parent===avatar.hand)avatar.release();disposeHeldItem(carried);carried=null}avatar.alignHeld(null);
  // The carrying arm lowers back into the animation instead of staying posed once the axe is away.
  avatar.setTwoHanded(0);
  if(carryWeight>0){carryWeight=Math.max(0,carryWeight-dt*5);avatar.reach('R',CARRY,carryWeight,CARRY_POLE)}
  return}
 if(consuming||busy){avatar.setTwoHanded(0);return} // they own the hand until they finish
 if(!carried||carried.userData.itemId!==want){
  if(carried){if(carried.parent===avatar.hand)avatar.release();disposeHeldItem(carried)}
  carried=createHeldItem(itemById(want));avatar.hold(carried,want==='gas-can'?{upright:true,curl:1}:{axis:'z',grip:GRIP,curl:1});
 }else if(carried.parent!==avatar.hand)avatar.hold(carried,want==='gas-can'?{upright:true,curl:1}:{axis:'z',grip:GRIP,curl:1});
 if(want==='gas-can'){ // the can hangs level from the hand at the side (the arm swings with the walk); no chest carry
  avatar.alignHeld(null);avatar.setTwoHanded(0);if(carryWeight>0){carryWeight=Math.max(0,carryWeight-dt*5);avatar.reach('R',CARRY,carryWeight,CARRY_POLE)}return}
 const idle=!chopping&&!armRecovery;
 avatar.alignHeld(chopping?null:CARRY_DIR); // carried across the chest; follows the forearm while swinging
 if(idle){carryWeight=Math.min(1,carryWeight+dt*4);avatar.reach('R',CARRY,carryWeight,CARRY_POLE)}else if(!chopping)carryWeight=0;
 avatar.setTwoHanded(chopping?1:carryWeight); // both hands are on the handle while carrying and swinging
}
// Hotbar: every tool and consumable you own, in inventory order. Number keys (or a click) equip a tool or use food and drink.
function refreshHotbar(){
 const p=GameState.progress,items=hotbarItems(p),signature=items.map(h=>h.item.id+':'+h.quantity).join()+'|'+p.equipped;
 if(signature===hotbarSignature)return;
 hotbarSignature=signature;
 const bar=$('hotbar');bar.replaceChildren();bar.hidden=!items.length;
 items.forEach((entry,i)=>{
  const button=document.createElement('button');button.type='button';button.className='hotbar-slot';button.title=entry.item.name;
  button.setAttribute('aria-label',`${entry.item.name}, slot ${i+1}`);button.setAttribute('aria-pressed',String(p.equipped===entry.item.id));
  const key=document.createElement('span');key.className='hotbar-key';key.textContent=String(i+1);
  const icon=document.createElement('span');fillIcon(icon,entry.item);button.append(key,icon);
  if(entry.item.type!=='tool'){const count=document.createElement('span');count.className='hotbar-count';count.textContent='×'+entry.quantity;button.append(count)}
  button.onclick=e=>{e.preventDefault();hotbarUse(i)};
  bar.append(button);
 });
}
function hotbarUse(i){
 if(!active||modal||creatorOpen||driving.active)return; // no tools or food from the hotbar while driving
 const entry=hotbarItems(GameState.progress)[i];if(!entry)return;
 const result=entry.item.type==='tool'?toggleEquip(entry.item.id):beginConsumption(entry.index);
 if(result?.error)toast(result.error);
}
function refreshSkillHud(){
 const xp=GameState.progress.skills.lumberjack.xp,{level,into,next}=levelOf(xp);
 $('skillStatus').textContent=xp?`Lumberjack Lv ${level} · ${level>=20?'max level':`${into} / ${next} XP`}`:'';
}
// Felled trees grow back slowly (see grid.js); logs left lying eventually rot away.
function tickRegrowth(){
 const now=gameMinutes(GameState.progress);
 let progress=expireLogs(GameState.progress,now);
 const grown=regrowTrees(progress,now,key=>{const t=world.trees.get(key);return !t||Math.hypot(t.x-me.position.x,t.z-me.position.z)<1.4});
 progress=grown.state;
 if(progress!==GameState.progress){const logsChanged=progress.logs!==GameState.progress.logs;GameState.progress=progress;persist();if(logsChanged)world.setLogs(progress.logs)}
 for(const key of grown.restored){world.setRegrown(key);lastStages.delete(key)}
 if(grown.restored.length)minimap.invalidate();
 for(const [key,stage] of felledStages(GameState.progress,now))if(lastStages.get(key)!==stage){lastStages.set(key,stage);world.setStage(key,stage)}
}
// Zones: grid overlay, tree sightline fade, sun/shadows following the player, minimap.
const fadeTarget=new THREE.Vector3();
const minimap=createMinimap(document,{canvas:$('minimap'),
 cityRoads:roadRects('asphalt'),
 buildings:MAP.buildings.map(b=>({x:b.x,z:b.z,hx:b.w/2,hz:b.d/2})),
 trees:()=>world.trees.values()});
function updateZones(dt){
 const outdoors=!inside&&!shop,zone=zoneAt(me.position.x,me.position.z).id;
 world.targetCell=world.updateGrid(me.position,me.rotation.y,gridOn&&outdoors&&active&&!modal&&zone!=='city');
 world.fade.uniforms.uFadeEnabled.value=outdoors?1:0;
 fadeTarget.set(me.position.x,me.position.y+1.5,me.position.z);
 world.update(dt,camera,fadeTarget);sawmillCtl?.update(dt);syncSawmill();if(sawmillCtl?.ready)audio.update({listener:{x:me.position.x,z:me.position.z},blade:{at:sawmillCtl.bladePoint,level:sawmillCtl.speed,sawing:sawmillCtl.sawing},belt:{at:sawmillCtl.beltPoint,level:sawmillCtl.beltLevel}});
 if(outdoors){sun.position.set(me.position.x-24,30,me.position.z+22);sun.target.position.set(me.position.x,0,me.position.z);sun.target.updateMatrixWorld()}
 const markers=[];
 if(outdoors){const job=GameState.progress.activeJob;if(job&&gigMarker.visible)markers.push({x:gigMarker.position.x,z:gigMarker.position.z,color:'#f2ca79'});if(marker.visible)markers.push({x:marker.position.x,z:marker.position.z,color:'#d4e7b3'})}
 const p=outdoors?me.position:shop?SHOPS[shop]:STUDIO;
 minimap.update(dt,{player:{x:p.x,z:p.z},heading:outdoors?me.rotation.y:0,yaw,markers});
}
function updateConsumption(dt){
 if(document.hidden)return;
 // The lowering phase is cosmetic, so it keeps playing while menus are open and the player can walk.
 if(armRecovery&&armRecovery.update(dt)==='done')armRecovery=null;
 if(!consuming||modal)return;
 if(consuming.animation.update(dt)!=='used')return;
 const action=consuming;consuming=null;armRecovery=action.animation;$('consumeStatus').hidden=true;
 // Resolve against current state so clock, survival and job updates are preserved.
 const index=GameState.progress.inventory.slots[action.index]?.id===action.id?action.index:GameState.progress.inventory.slots.findIndex(slot=>slot.id===action.id);
 const result=commitInventory(useItem(GameState.progress,index));
 keys.clear();toast(result.error||result.message);
}
inventoryUI=createInventoryUI({document,getState:()=>GameState,onBeforeOpen:()=>phone?.close(),
 canOpen:()=>active&&!modal&&!creatorOpen&&!actionBusy(),
 onOpen:()=>{clearWorldPanel();modal=true;keys.clear();look.release()},
 onClose:()=>{modal=false;keys.clear();look.resetMotion()},
 onUse:beginConsumption,
 onUnequip:type=>commitInventory(unequipItem(GameState.progress,type))
});
storeUI=createStoreUI({document,getState:()=>GameState,
 canOpen:()=>active&&!modal&&!creatorOpen&&!actionBusy()&&atMarketCounter(),
 onOpen:()=>{clearWorldPanel();modal=true;keys.clear();look.release()},
 onClose:()=>{modal=false;keys.clear();look.resetMotion()},
 onBuy:id=>atMarketCounter()?commitInventory(addItem(GameState.progress,id,{purchase:true})):{error:'Visit the open market counter to shop.'},
 onSell:()=>({error:'The Corner Market no longer buys timber. Ridgeline Timber, at Eastbank, takes logs and planks.'}),
 onGroceries:()=>atMarketCounter()?commitInventory(lifeTransaction(GameState.progress,'groceries','market')):{error:'Visit the open market counter to shop.'},
 onWork:marketWork
});
// Phone owns only its overlay; existing modal guards stop WASD and mouse look.
cargoUI=createCargoUI({document,onOpen:()=>{clearWorldPanel();modal=true;keys.clear();look.release()},onClose:()=>{modal=false;keys.clear();look.resetMotion()}});
phone=createPhone({document,getState:()=>GameState,onRead:app=>{const next=markRead(GameState.progress,app);if(next!==GameState.progress){GameState.progress=next;persist()}},isOnSite:id=>shiftOnSite(id),onClockIn:id=>doClockIn(id),onClockOut:()=>doClockOut(),onQuit:id=>{const r=quit(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:'You quit '+employerName(GameState.progress,id)+'. Your rank is reset.'}},onCollect:id=>{const r=collectOwed(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:'Collected '+r.handed.map(t=>itemById(t)?.name||t).join(', ')+'.'}},onOrder:(cart,home)=>{const r=placeOrder(GameState.progress,cart,home);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},onOrderVehicle:(model,colour,home)=>{const r=orderVehicle(GameState.progress,model,colour,home);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},onSetMain:id=>{const r=setMainHome(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},onHomeAction:(action,id)=>{const r=propertyTransaction(GameState.progress,action,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},
 canOpen:()=>active&&!modal&&!creatorOpen&&!actionBusy(),
 onOpen:()=>{clearWorldPanel();modal=true;keys.clear();look.release()},
 onClose:()=>{modal=false;keys.clear();look.resetMotion()},
 onRefresh:()=>{const next=refreshGigBoard(GameState.progress);if(next!==GameState.progress){GameState.progress=next;persist()}},
 onAccept:id=>{
   const result=acceptContract(GameState.progress,id);
   if(result.error)return result;
   GameState.progress=result.state;persist();
   toast('Gig accepted · '+GameState.progress.activeJob.title+' · Follow the gold marker');
   return result;
 }
});
// Dedicated gold marker: accepting a phone gig never overwrites a delivery route.
const gigMarker=new THREE.Group();gigMarker.name='gig-marker';gigMarker.visible=false;
const gigMaterial=new THREE.MeshBasicMaterial({color:'#f2ca79',transparent:true,opacity:.9,depthWrite:false});
const gigRing=new THREE.Mesh(new THREE.RingGeometry(.75,.85,32),gigMaterial);
gigRing.rotation.x=-Math.PI/2;gigRing.position.y=.2;gigMarker.add(gigRing);
const gigDiamond=new THREE.Mesh(new THREE.OctahedronGeometry(.22),gigMaterial);
gigDiamond.position.y=2.1;gigMarker.add(gigDiamond);scene.add(gigMarker);
let objectiveCollapsed=false;
// Shop doors have no E. They slide open as you walk up (only while the shop is open); walking through the doorway fades
// to the other side. A closed shop keeps its door shut, shows CLOSED and tells you its hours. Your studio still uses E.
function startDoorFade(action){if(doorFade||modal||!canAct('door'))return;doorFade={t:0,phase:'out',action};keys.clear()}
function updateDoorFade(dt){
 if(!doorFade||modal)return; // a menu freezes the transition; only pause() owns `modal`
 const veil=$('doorFade');doorFade.t+=dt;
 if(doorFade.phase==='out'){veil.style.opacity=String(Math.min(1,doorFade.t/.16));if(doorFade.t>=.16){doorFade.action();doorFade.phase='in';doorFade.t=0}}
 else{veil.style.opacity=String(Math.max(0,1-doorFade.t/.22));if(doorFade.t>=.22){veil.style.opacity='0';doorFade=null}}
}
function updateDoors(dt){
 if(modal)return; // doors, like everything else, wait while a menu is open
 updateDoorFade(dt);if(inside&&home.room.frontDoor){home.room.frontDoor.update(dt);if(leaveAfter>0){leaveAfter-=dt;if(leaveAfter<=0)leaveHome()}}
 doorCooldown=Math.max(0,doorCooldown-dt);
 const ready=doorCooldown<=0&&active&&!modal&&!actionBusy(),routine=GameState.progress.routine;
 for(const front of shopDoors){
  const dw=MAP.shops[front.kind].doorway,open=shopOpen(front.kind,routine);front.open.visible=open;front.closed.visible=!open;
  const dx=me.position.x-front.x,near=!inside&&!shop&&Math.abs(dx)<dw.approach.halfWidth&&me.position.z<dw.approach.z1&&me.position.z>dw.approach.z0;
  front.door.setOpen(open&&near);front.door.update(dt);
  // The doorway is open ground only while the door is open (and never traps you standing in it).
  const standing=Math.abs(dx)<dw.halfWidth+.35&&Math.abs(me.position.z-dw.blocker.z)<dw.blocker.depth+.35,passable=(open&&near&&front.door.amount>.7)||(standing&&!inside&&!shop),blocked=colliders.includes(front.blocker);
  if(passable&&blocked)colliders.splice(colliders.indexOf(front.blocker),1);else if(!passable&&!blocked)colliders.push(front.blocker);
  if(!ready||!near||Math.abs(dx)>=dw.enterHalfWidth)continue;
  if(open&&front.door.amount>.85&&me.position.z<dw.threshold){doorCooldown=1;startDoorFade(()=>enterShop(front.kind,{x:Math.max(-dw.exit.clamp,Math.min(dw.exit.clamp,dx)),z:MAP.shops[front.kind].interior.entry.z}));return}
  if(!open&&me.position.z<dw.closedTouch){doorCooldown=3;toast(`${SHOPS[front.kind].name} is closed. Hours ${hoursText(front.kind)}.`)}
 }
 if(shop){
  const room=shops[shop],exitSpec=(MAP.shops[shop]||officeByKey(shop)).interior.exitDoor,near=Math.abs(me.position.x)<exitSpec.near.halfWidth&&me.position.z>exitSpec.near.z;
  if(!room.exitDoor.manual)room.exitDoor.setOpen(near);room.exitDoor.update(dt); // hinged and double doors are opened by hand (E)
  if(ready&&near&&Math.abs(me.position.x)<exitSpec.trigger.halfWidth&&me.position.z>exitSpec.trigger.z&&room.exitDoor.amount>.85){doorCooldown=1;const exitX=me.position.x;startDoorFade(()=>leaveShop(exitX))}
 }
}
// The task tracker (tracker.js, 0.35). The focused task takes over the card (title, progress, the arrow); the story objective and every other task are listed under it with a tick and a distance.
// Y switches the focus; clicking a tick does too. The DOM is rebuilt only when the list changes and the distances are written four times a second.
let storyAim=null,trackerKey='',trackerClock=1;const trackerDist=new Map();
const inWarehouse=()=>!!shop&&officeByKey(shop)?.kind==='warehouse',trackerRoom=()=>inWarehouse()?{carryPlanks:GameState.progress.carry?.kind==='planks'}:null; // inside the warehouse the arrow points at places in the room (tracker.js warehouseTarget)
function setFocus(id){GameState.progress={...GameState.progress,focus:id};persist();trackerKey=''}
// Sections of the list, in this order; a row is {id,title,pos,done,group}. The row with the dot is the one on the card (its arrow points at it).
const TRACKER_GROUPS=['Orders','Shift','Gigs','Getting started'];let prevJob=null,prevShift=false,trackerSeen=false;const prevSections=new Map(); // fixed order (DESIGN 4.19); prev* detect accepting a gig and clocking in
function updateTracker(dt){
 const list=$('trackerList');if(!active||inside||(shop&&!inWarehouse())){list.hidden=true;return}
 const p=GameState.progress,items=trackerItems(p,me.position,trackerRoom()),focus=focusedItem(p,items),card=$('objective');
 {const jobId=p.activeJob?.id||null,hasShift=!!p.shift,was=trackerSeen;let moved=false;trackerSeen=true;const seenJob=prevJob,seenShift=prevShift;prevJob=jobId;prevShift=hasShift;
  if(was&&jobId&&jobId!==seenJob){if(p.focus){setFocus(null);moved=true}} // accepting a gig focuses it (the story is the gig)
  else if(was&&hasShift&&!seenShift&&!jobId&&!p.focus){const first=items.find(i=>i.section==='Shift'&&!i.done);if(first){setFocus(first.id);moved=true}} // clocking in focuses the first unfinished shift task
  if(moved){for(const i of items)prevSections.set(i.id,i.section);return}}
 if(p.focus&&!focus){const gone=items.find(i=>i.id===p.focus);setFocus(focusAfter(items,gone?gone.section:prevSections.get(p.focus)))} // a finished (or vanished) focus moves to the next task in its section, then the next section, then the story
 for(const i of items)prevSections.set(i.id,i.section);
 const story={id:'story',title:card.querySelector('h2').textContent,pos:storyAim,done:false,place:'',group:p.activeJob?'Gigs':'Getting started'};
 if(focus){card.querySelector('.eyebrow').textContent='FOCUS · '+focus.group.toUpperCase();card.querySelector('h2').textContent=focus.title;card.querySelector('p').textContent=focus.detail;$('gigChecklist').hidden=true;marker.visible=false;gigMarker.visible=false;
  const d=distanceTo(me.position,focus.pos);$('distance').textContent=d===null?(focus.place||'Nowhere to go yet'):d+' m · '+focus.place;$('direction').style.transform=focus.pos?`rotate(${Math.atan2(focus.pos.x-me.position.x,-(focus.pos.z-me.position.z))+yaw}rad)`:'none'}
 const rows=[story,...items],focusId=focus?focus.id:'story';list.hidden=items.length===0;
 const key=focusId+'#'+rows.map(r=>r.id+'|'+r.title+'|'+r.done+'|'+r.group).join(';');
 if(key!==trackerKey){trackerKey=key;list.replaceChildren();trackerDist.clear();
  const groupOf=r=>r===story?story.group:r.section;for(const name of TRACKER_GROUPS){const inGroup=rows.filter(r=>groupOf(r)===name);
   
   if(!inGroup.length)continue;const h=document.createElement('h4');h.className='tracker-group';h.textContent=name==='Shift'?'Shift · '+(inGroup[0].group):name;list.append(h);
   for(const r of inGroup){const row=document.createElement('button'),dot=document.createElement('span'),title=document.createElement('span'),dist=document.createElement('span');row.className='tracker-row'+(r.id===focusId?' focus':'')+(r.done?' done':'');row.disabled=r.done;
    row.setAttribute('aria-pressed',String(r.id===focusId));row.setAttribute('aria-label',(r.done?'Done: ':'Focus on: ')+r.title);row.onclick=()=>setFocus(r.id==='story'?null:r.id);
    dot.className='tracker-dot';dot.textContent=r.done?'☑':r.id===focusId?'◉':'○';title.className='tracker-title';title.textContent=r.title;dist.className='tracker-dist';row.append(dot,title,dist);list.append(row);trackerDist.set(r.id,dist)}}trackerClock=1}
 trackerClock+=dt;if(trackerClock>=.25){trackerClock=0;for(const r of rows){const el=trackerDist.get(r.id),d=r.done?null:distanceTo(me.position,r.pos);if(el)el.textContent=d===null?'':d+' m'}}
}
function toggleObjective(){
 objectiveCollapsed=!objectiveCollapsed;
 $('objective').classList.toggle('collapsed',objectiveCollapsed);
 $('objectiveDetails').hidden=objectiveCollapsed;
 $('objectiveToggle').setAttribute('aria-expanded',String(!objectiveCollapsed));
 $('objectiveToggle').setAttribute('aria-label',objectiveCollapsed?'Show task panel (T)':'Hide task panel (T)');
}
$('objectiveToggle').onclick=toggleObjective;
// Radial progress for timed work: café steps and timed gigs show a ring that fills around the spot (seconds left in the middle).
function updateRing(){
 let ring=null;
 if(busy){const task=cafeTask(GameState.progress);ring={point:worldPoint({...task,y:1.4}),label:({brew:'Preparing coffee',serve:'Serving',clean:'Cleaning table'})[busy.action],fraction:busy.elapsed/busy.duration,left:busy.duration-busy.elapsed}}
 else{const job=GameState.progress.activeJob;if(job?.mode==='timed'&&job.stage==='task'&&job.workSeconds>0&&!inside&&!shop)ring={point:{x:me.position.x,y:me.position.y+2.45,z:me.position.z},label:job.title,fraction:job.workSeconds/job.duration,left:job.duration-job.workSeconds}}
 const p=ring&&active&&!modal?screenAnchor(ring.point,camera,innerWidth,innerHeight,THREE.Vector3):null,el=$('workProgress');
 el.hidden=!p;if(!p)return;
 const percent=Math.round(Math.max(0,Math.min(1,ring.fraction))*100);
 el.style.left=p.x+'px';el.style.top=p.y+'px';el.setAttribute('aria-valuenow',String(percent));el.querySelector('.ring').style.setProperty('--p',String(percent));
 $('workRingTime').textContent=Math.ceil(Math.max(0,ring.left))+'s';$('workRingLabel').textContent=ring.label;
}
// The objective beacon (ring and diamond) and the arrow: objective.js decides what to point at (one answer for the gig, the delivery and
// the market); this is the only place that draws it. The beacon disappears when you are already there (the prompt takes over).
const OBJECTIVE_WORLD={marketDoor:{x:SHOPS.market.x,z:MAP.shops.market.doorway.beaconZ},counter:{local:COUNTER,world:{x:SHOPS.market.x+COUNTER.x,y:MAP.shops.market.interior.origin.y,z:MAP.shops.market.interior.origin.z+COUNTER.z}},cafeDoor:{x:SHOPS.cafe.x,z:SHOPS.cafe.z}};
function updateObjective(dt){
 const progress=GameState.progress,objective=resolveObjective({progress,place:{inside:!!inside,shop},room:currentRoom(),gigTarget,delivery:targetFor(progress),world:OBJECTIVE_WORLD});
 const spot=objective.beacon,near=spot?Math.hypot(me.position.x-(spot.local?.x??spot.x),me.position.z-(spot.local?.z??spot.z)):0;
 marker.visible=!!spot&&active&&near>spot.hideWithin;
 if(spot){marker.position.set(spot.x,spot.y,spot.z);markerTime+=dt;diamond.position.y=2.5+spot.lift+Math.sin(markerTime*2)*.09;diamond.rotation.y+=dt*.7}
 const aim=objective.aim;storyAim=aim;
 $('direction').style.transform=aim?`rotate(${Math.atan2(aim.x-me.position.x,-(aim.z-me.position.z))+yaw}rad)`:'none';
}
// The needs bars (bottom right): food, thirst and energy as 0-100 bars that turn orange when low and red, with a pulsing icon, when critical.
const needWarned=new Set(),NEED_WORDS={food:'hungry',thirst:'thirsty',energy:'tired'};
function renderVitals(life){
 const fx=needsEffects(life);document.body.classList.toggle('thirst-dry',fx.dry); // the screen edges dim at 0 thirst
 for(const k of ['food','thirst','energy']){if(fx.warn.includes(k)){if(!needWarned.has(k)){needWarned.add(k);if(active)notifyPhone('player','You’re getting '+NEED_WORDS[k]+'.')}}else if(life[k]>30)needWarned.delete(k)}
 for(const [key,id] of [['food','vitalFood'],['thirst','vitalThirst'],['energy','vitalEnergy']]){
  const value=Math.max(0,Math.min(100,Math.round(life[key]))),row=$(id);
  row.dataset.level=value<=10?'critical':value<=25?'low':'ok';
  if(row.dataset.value===String(value))continue;
  row.dataset.value=String(value);$(id+'Fill').style.width=value+'%';$(id+'Value').textContent=String(value);
 }
}
function updateGig(dt){
 const job=GameState.progress.activeJob;$('gigChecklist').hidden=!job;
 gigMarker.visible=active&&!!job&&!inside;
 if(!job)return;
 if(job.id==='heavy-delivery'&&job.stage==='task')parcel.visible=true;
 const target=gigTarget(job),room=currentRoom();
 let display=target,parent=scene;
 if(target.room==='cafe'){
   if(shop==='cafe')parent=shops.cafe.scene;
   else display={x:SHOPS.cafe.x,z:SHOPS.cafe.z};
 }else if(shop)gigMarker.visible=false;
 if(inside)gigMarker.visible=false;
 parent.add(gigMarker);gigMarker.position.set(display.x,0,display.z);gigDiamond.rotation.y+=dt*.9;
 const arrived=job.stage!=='travel',finished=job.stage==='return';
 const returned=finished&&atGigPoint(me.position,room,job.returnLocation);
 for(const [id,done] of [['gigStepGo',arrived],['gigStepTask',finished],['gigStepReturn',returned]]){
   $(id).textContent=done?'☑':'☐';$(id).setAttribute('aria-label',done?'Complete':'Incomplete');
 }
 $('gigTaskLabel').textContent=job.mode==='timed'?`Complete task · ${Math.floor(job.workSeconds)} / ${job.duration}s`:job.mode==='courier'?`Deliver envelope · ${Math.floor(job.runMetres)} / ${job.runDistance}m run`:'Deliver the heavy box';
 $('objective').querySelector('.eyebrow').textContent='ACTIVE GIG · '+money(job.reward);
 $('objective').querySelector('h2').textContent=job.title;
 $('objective').querySelector('p').textContent=finished?'Return to the gold marker and press E to collect your pay.':job.stage==='travel'?job.description:job.mode==='timed'?'Stay still at the marked station. Moving or leaving resets this task’s timer.':job.mode==='courier'?'Run with Shift toward the delivery marker. Only distance actually run counts.':'Carry the box to the gold delivery marker. Movement uses twice the energy.';
 $('distance').textContent=target.room!==room?(target.room==='cafe'?'Enter Alder Coffee':'Go outside to continue'):Math.round(Math.hypot(me.position.x-target.x,me.position.z-target.z))+' m · '+(finished?'Return for payment':'Gig location');
}
// Passing out (DESIGN 4.18): black fade, then (at black) the vehicle or forklift stops, a carried log or planks are put down, and you are moved to your main home's bed
// (or beside the starter apartment's door with no home); two game hours pass and you wake with energy 25. Online the clock cannot jump: a 60 s black screen with a countdown.
let passT=null,passMoved=false;
function startPassOut(){passT=0;passMoved=false;phone?.close();$('dialog').hidden=true;clearWorldPanel();modal=true;keys.clear();look.release();const fe=$('sleepFade');fe.hidden=false;fe.style.opacity='0';fe.textContent='You passed out from exhaustion'}
function passOutMove(){
 if(fork.on)getOffFork();
 if(driving.active){driving.active.state.speed=0;exitVehicle()}
 busy=null;putting=null;
 {const cur=GameState.progress;if(cur.carry&&!inside&&!shop){const log=cur.carry.kind==='log',x=me.position.x,z=me.position.z,r=log?putDownLog(cur,{x,z,rot:me.rotation.y+Math.PI/2}):putDownPlanks(cur,{x,z,q:quarterOf(me.rotation.y)});if(!r.error){GameState.progress=r.state;if(log)world.setLogs(GameState.progress.logs)}}}
 if(shop)leaveShop(0);
 doorCooldown=2;const id=mainHome(GameState.progress),target=id===null?null:id===STUDIO_ID?studioHome:houseHome(id);
 if(target){enterHome(target);const fl=home.BED_FLOOR||0;home.room.setFloor?.(fl);setMePosition(home.BED.x,fl*(home.room.FLOOR_HEIGHT||0)+.02,home.BED.z)}
 else{if(inside)leaveHome();placeSafely(STUDIO.x,.165,STUDIO.z)}
 const r=passOutThrough(GameState.progress,{online:multiplayer.online,drainMultiplier:GameState.progress.settings?.statDrainMultiplier});GameState.progress=expireCafe(r.state);
 notifyPhone('player',target?'You passed out from exhaustion and woke up in your bed.'+(r.minutes?' Two hours passed.':''):'You passed out from exhaustion and woke up by the apartment door.'+(r.minutes?' Two hours passed.':''));
 keys.clear();look.resetMotion();persist();
}
function updatePassOut(dt){
 if(passT===null||document.hidden)return;passT+=dt;
 const fadeIn=.6,hold=multiplayer.online?PASS_OUT_ONLINE_SECONDS:1.4,end=fadeIn+hold,fe=$('sleepFade');
 if(passT>=fadeIn&&!passMoved){passMoved=true;passOutMove()}
 fe.style.opacity=String(passT<fadeIn?passT/fadeIn:passT<end?1:Math.max(0,1-(passT-end)/.5));
 if(multiplayer.online&&passT>=fadeIn&&passT<end)fe.textContent='You passed out from exhaustion · '+Math.ceil(end-passT)+' s';
 if(passT>=end+.5){passT=null;fe.hidden=true;fe.textContent='';modal=false;keys.clear();look.resetMotion();persist()}
}
function startSleep(){
 if(!canAct('sleep')||!inside||shop||(home.kind==='studio'&&!GameState.progress.housing.rented)||(home.room.floor||0)!==(home.BED_FLOOR||0)||Math.hypot(me.position.x-home.BED.x,me.position.z-home.BED.z)>=1.4)return;
 phone?.close();$('dialog').hidden=true;clearWorldPanel();modal=true;keys.clear();look.release();
 sleepElapsed=0;$('sleepFade').hidden=false;$('sleepFade').style.opacity='0';
}
function updateSleep(dt){
 if(sleepElapsed===null||document.hidden)return;
 sleepElapsed+=dt;
 // Fade in, hold black for one second, then fade out. Clock/life ticks are paused.
 $('sleepFade').style.opacity=String(sleepElapsed<.25?sleepElapsed/.25:sleepElapsed<1.25?1:Math.max(0,(1.5-sleepElapsed)/.25));
 if(sleepElapsed>=1.5){
   const slept=sleepThrough(GameState.progress,{online:multiplayer.online,drainMultiplier:GameState.progress.settings?.statDrainMultiplier});GameState.progress=expireCafe(slept.state);
   sleepElapsed=null;$('sleepFade').hidden=true;modal=false;keys.clear();look.resetMotion();persist();toast(slept.message);
 }
}

// Local multiplayer relay. Register callbacks before opening the socket.
const multiplayer=new MultiplayerClient();
const remoteMeshes=Object.create(null);
const currentRoom=()=>shop||(inside?(home.kind==='house'?'house:'+home.id:'home'):'street'); const roomScene=room=>room==='home'?apartment.scene:room.startsWith('house:')?(houseHomes.get(room.slice(6))?.room.scene||scene):shops[room]?.scene||scene;
function removeRemote(id){
 if(remoteMeshes[id])disposeRemotePlayer(remoteMeshes[id]);
 delete remoteMeshes[id];delete GameState.otherPlayers[id];
}
function receiveRemote(remote){
 const previous=GameState.otherPlayers[remote.id];
 GameState.otherPlayers[remote.id]=remote;
 let mesh=remoteMeshes[remote.id];
 if(!mesh){mesh=remoteMeshes[remote.id]=createRemotePlayer(remote.position);}
 // Room changes teleport; ordinary movement interpolates in the frame loop.
 if(!previous||previous.room!==remote.room){
   roomScene(remote.room).add(mesh);
   mesh.position.set(remote.position.x,remote.position.y,remote.position.z);
 }
 mesh.userData.target.set(remote.position.x,remote.position.y,remote.position.z);
}
multiplayer.onPlayerJoined(receiveRemote);
multiplayer.onPlayerMoved(receiveRemote);
multiplayer.onPlayerLeft(removeRemote);
multiplayer.onDisconnected(()=>{for(const id of Object.keys(remoteMeshes))removeRemote(id)});
let networkTimer=0,lastNetworkTime=null,lastSent=null;
function sendLocalPosition(){
 const room=currentRoom();
 if(!multiplayer.sendPosition(GameState.me.position,room))return false;
 lastSent={...me.position,room};networkTimer=0;return true;
}
// Online: the lobby code shows in the pause menu. A dropped connection during play is retried (after 2, 5 and 10 s) to the same lobby; if the relay wants a newer game, the update banner appears (its Reload saves first, then the page starts at the main menu).
const RECONNECT_MS=[2000,5000,10000],LOBBY_UPDATE='The online lobby needs the new version. Your game is saved before it reloads.';let reconnectTries=0;
function showLobby(){const code=normalizeLobbyCode(multiplayer.lobby);$('lobbyInfo').hidden=!multiplayer.online;$('lobbyInfo').innerHTML=code?`Online lobby <b>${code}</b> · share the code to play together`:'Online · local server'}
multiplayer.onConnected(()=>{lastSent=null;sendLocalPosition();showLobby();if(reconnectTries)toast('Back in the lobby.');reconnectTries=0});
multiplayer.onDropped(({wasIn,refused})=>{showLobby();if(!$('welcome').hidden)return; // on the main menu the menu reports it
 if(refused){reconnectTries=0;if(refused===REFUSED.update)updateNotice.announce(LOBBY_UPDATE);toast('Could not rejoin the lobby. '+refusalText(refused)+' Playing offline.');return}
 if(!wasIn&&!reconnectTries)return;
 const url=multiplayer.rejoinUrl;
 if(!url||reconnectTries>=RECONNECT_MS.length){reconnectTries=0;toast('Lost the lobby. Playing offline; join again from the main menu.');return}
 toast(reconnectTries?'Still trying to reach the lobby…':'Lost the connection to the lobby. Reconnecting…');
 setTimeout(()=>{if(!multiplayer.socket)multiplayer.connect(url)},RECONNECT_MS[reconnectTries++]);
});
// Main menu (main-menu.js). Play is offline; Host and Join open a connection first and start the game once the server has answered.
const mainMenu=createMainMenu({$,storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},connect:url=>multiplayer.connect(url),disconnect:()=>multiplayer.disconnect(),onConnected:cb=>multiplayer.onConnected(cb),onDisconnected:cb=>multiplayer.onDisconnected(cb),onRefused:cb=>multiplayer.onRefused(cb),needUpdate:()=>updateNotice.announce(LOBBY_UPDATE),relay:relayBase(typeof location!=='undefined'?location:null),play:startGame,applyQuality,openCredits:()=>openCredits('menu')});
// Settings > Your save (save-menu.js): export, import, backups. A replaced save reloads the page with persist() locked, or pagehide would write the old game back.
const downloadText=(name,text)=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const saveStore={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem?.(k)};
const reloadWithNewSave=()=>{saveLocked=true;if(typeof location!=='undefined'&&location.reload)location.reload();else globalThis.__reloaded=true};
const saveMenu=createSaveMenu({$,doc:document,storage:saveStore,version:VERSION,download:(...a)=>globalThis.__download?globalThis.__download(...a):downloadText(...a),reload:reloadWithNewSave});
// Account and cloud save (cloud-save.js, account-menu.js; the server is worker/accounts.js). Synced when the page loads, every 2 minutes while playing if the save changed, and before "Save and go to the main menu".
const cloud=createCloud({fetchFn:(...a)=>(globalThis.__fetch||fetch)(...a),storage:saveStore,version:VERSION});
// Back from Google: /?signedin=google or /?signin=cancelled|failed|unavailable. Read once, then removed from the address bar so a reload does not repeat it.
const signinReturn=(()=>{if(typeof location==='undefined')return null;const q=new URLSearchParams(location.search),r={signedin:q.get('signedin'),signin:q.get('signin')};if(!r.signedin&&!r.signin)return null;try{history.replaceState(null,'',location.pathname)}catch{}return r})();
const accountMenu=createAccountMenu({$,cloud,reload:reloadWithNewSave,show:()=>mainMenu.show('menuAccountPanel'),navigate:url=>{persist();location.assign(url)},returned:signinReturn});
if(typeof location!=='undefined'||globalThis.__fetch)accountMenu.start();
const cloudConflictToast=r=>{if(r?.status==='conflict')toast('Your cloud save changed on another browser. Choose which one to keep in Account, on the main menu.')};
setInterval(()=>{if(active&&$('welcome').hidden&&cloud.user){persist();cloud.pushIfChanged().then(cloudConflictToast)}},PUSH_EVERY_MS)?.unref?.();
$('quality').value=mainMenu.settings.quality;
$('menuVolume').value=Math.round(audio.settings.volume*100);$('menuMute').checked=audio.settings.muted;$('menuVolume').oninput=()=>audio.setVolume($('menuVolume').value/100);$('menuMute').onchange=()=>audio.setMuted($('menuMute').checked);
function updateMultiplayer(now,moving,dt){
 networkTimer+=lastNetworkTime===null?0:Math.max(0,now-lastNetworkTime);
 lastNetworkTime=now;
 const changed=!lastSent||lastSent.room!==currentRoom()||
   ['x','y','z'].some(k=>Math.abs(me.position[k]-lastSent[k])>.0001);
 // Also send the final stopped position and door/reset teleports, at the same cap.
 if(networkTimer>=50&&(moving||changed))sendLocalPosition();
 for(const mesh of Object.values(remoteMeshes))updateRemotePlayer(mesh,dt);
}

let prev=performance.now(),frames=0,elapsed=0,menuDrawn=false,stuckTime=0;
// One slice of simulated time (see timestep.js). Everything that has to advance with real time runs here, once per slice.
// Returns whether a movement key was pressed during the slice.
// Carrying and the needs (DESIGN 4.18) together decide how fast you walk and whether Shift runs.
function moveFx(){const fx=carryEffects(GameState.progress.carry),n=needsEffects(GameState.progress.life);return {...fx,speed:fx.speed*n.speed,sprint:fx.sprint&&n.canRun}}
function stepWorld(step){
 let startX=me.position.x,startZ=me.position.z;
 let pressed=false;
 if(fork.on){if(active&&!modal&&!document.hidden){const k=c=>keys.has(c),ctx=forkCtx();fork.state=forklift.step(fork.state,{throttle:Number(k('KeyW')||k('ArrowUp'))-Number(k('KeyS')||k('ArrowDown')),steer:Number(k('KeyA')||k('ArrowLeft'))-Number(k('KeyD')||k('ArrowRight')),raise:Number(k('KeyR'))-Number(k('KeyF')),boost:k('ShiftLeft')||k('ShiftRight')},step,blocked,{forksClear:s=>fp.forksClear(s,ctx),liftRange:s=>fp.liftRange(s,ctx)});{const c2=forkCtx(),held=k('KeyR')||k('KeyF'),a=fp.assist(fork.state,c2,step,{forksHeld:held});if(a!==fork.state&&forklift.clear(a,blocked,{forksClear:s=>fp.forksClear(s,c2)}))fork.state=a;forkTick(c2,Number(k('KeyR'))-Number(k('KeyF')))}const seat=forklift.seatOf(fork.state);me.position.x=seat.x;me.position.z=seat.z;me.rotation.y=fork.state.yaw;startX=seat.x;startZ=seat.z}}else if(driving.active){ // driving: the keys steer the vehicle and you ride at its seat (nothing paused is simulated: a paused game leaves the vehicle where it is)
  if(active&&!modal&&!document.hidden){driving.step(step,{throttle:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),steer:Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight')),brake:keys.has('Space')},pedestrians.people.map(p=>({x:p.group.position.x,z:p.group.position.z,r:.45})));
   const seat=driving.seat();me.position.x=seat.x;me.position.z=seat.z;me.rotation.y=driving.yaw;startX=seat.x;startZ=seat.z; // riding is not walking: no walked distance, no stuck check
   driveSave+=step;if(driveSave>=5){driveSave=0;persist()}}
 }else if(active&&!modal&&!actionBusy()&&!putting){let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),s=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let len=Math.hypot(f,s);if(len){f/=len;s/=len;const fx=moveFx(),speed=(fx.sprint&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))?8.2:4.5)*fx.speed,dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*step,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*step;if(!blocked(me.position.x+dx,me.position.z))me.position.x+=dx;if(!blocked(me.position.x,me.position.z+dz))me.position.z+=dz;const angle=Math.atan2(dx,dz);me.rotation.y+=Math.atan2(Math.sin(angle-me.rotation.y),Math.cos(angle-me.rotation.y))*(1-Math.exp(-step*24));phase+=step*speed*2.0;pressed=true}}
 const movedStep=Math.hypot(me.position.x-startX,me.position.z-startZ),moving=pressed&&movedStep>.000001,running=moving&&moveFx().sprint&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));
 if(active&&!modal&&!document.hidden){GameState.progress=expireCafe(advanceTime(GameState.progress,step*.5));const oldStage=GameState.progress.activeJob?.stage;
const load=Math.max(GameState.progress.activeJob?.id==='heavy-delivery'&&oldStage==='task'?2:1,carryEffects(GameState.progress.carry).load);
tickLife(step,moving,running,load);if(passT===null&&sleepElapsed===null&&needsEffects(GameState.progress.life).passOut)startPassOut();
GameState.progress=tickContract(GameState.progress,{position:me.position,room:currentRoom(),dt:step,moving,paused:!!consuming,running,distance:movedStep});
if(oldStage!==GameState.progress.activeJob?.stage)persist();if(!inside&&!shop)pedestrians.update(step,me.position);regrowClock+=step;if(regrowClock>=5){regrowClock=0;tickRegrowth()}if(inside||shop){saveElapsed+=step;if(saveElapsed>=4){saveElapsed=0;persist()}}}
 if(active&&!modal&&!document.hidden)updateCafeVisuals(step);updateConsumption(step);updateDoors(step);updateChop(step);updatePutting(step);fuelTick(step);
 return pressed;
}
function frame(now){
 requestAnimationFrame(frame);
 const real=Math.max(0,Math.min((now-prev)/1000,MAX_FRAME)),view=Math.min(real,.1); // real time drives the simulation; visuals smooth over at most 0.1 s
 prev=now;
 if(GameState.progress.properties!==signsFor){signsFor=GameState.progress.properties;houseSigns.sync(heldIds(GameState.progress))} // rent, buy, move out, eviction: the sign follows
 if(creatorOpen){previewAvatar.update(view);drawCreator();return}
 // Before the game starts only the main menu is visible: draw the world once (this warms the shaders and textures), then stop until Play.
 if(!active){if(menuDrawn)return;menuDrawn=true}else menuDrawn=false;
 frames++;elapsed+=real;if(elapsed> .75){$('fps').textContent=Math.round(frames/elapsed)+' FPS';frames=0;elapsed=0}
 const frameX=me.position.x,frameZ=me.position.z;
 let pressed=false;{const {count,step}=substeps(real);for(let i=0;i<count;i++)if(stepWorld(step))pressed=true}
 driving.setWalker(driving.active||inside||shop?null:me.position);driving.update(view);updateCustomerTruck(view);updateDockTruck(view);updateFork();if(driving.active){driveIdle+=view;if(driveIdle>1.5){const k=1-Math.exp(-4*view);yaw+=Math.atan2(Math.sin(driving.yaw+Math.PI-yaw),Math.cos(driving.yaw+Math.PI-yaw))*k;pitch+=(driving.cameraPitch()-pitch)*k}} // the chase camera springs back behind the vehicle 1.5 s after the mouse stops
 const movedDistance=Math.hypot(me.position.x-frameX,me.position.z-frameZ),moving=pressed&&movedDistance>.000001;
 // Safety net: holding a move key for a second without moving, while standing inside something solid, moves you to the nearest clear spot. The search only runs then.
 if(pressed&&!moving){stuckTime+=real;if(stuckTime>1){stuckTime=0;if(blocked(me.position.x,me.position.z))unstick()}}else stuckTime=0;
 const running=moving&&moveFx().sprint&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));
const poseBlend=1-Math.exp(-view*18);
avatar.setMotion(moving&&!fork.on?(running?8.2:4.5)*moveFx().speed:0);
// Match foot height to the road, pavement, or grass rather than hovering.
const px=me.position.x,pz=me.position.z;
 const deck=world.floorAt(px,pz);
 me.position.y=THREE.MathUtils.lerp(me.position.y,(inside||shop)?.02+(inside&&home.room.floor?home.room.floor*home.room.FLOOR_HEIGHT:0):standHeight(px,pz,deck),1-Math.exp(-view*30));
zoom=THREE.MathUtils.lerp(zoom,zoomTarget,1-Math.exp(-view*10));

look.tick(view);
if(worldPanel?.actor&&!$('dialog').hidden){const actor=worldPanel.actor,pa=getMeWorldPosition(new THREE.Vector3()),pb=actor.getWorldPosition(new THREE.Vector3()),mid=pa.clone().add(pb).multiplyScalar(.5);const angle=Math.atan2(pa.x-pb.x,pa.z-pb.z);actor.rotation.y=angle;me.rotation.y=angle+Math.PI;worldPlayer.position.copy(mid);if(shop)shops[shop].camera(worldPlayer,angle+.45,.32,5.8,view);else updateCamera(worldPlayer,angle+.45,.32,5.8,view)}else if(shop){getMeWorldPosition(worldPlayer.position);shops[shop].camera(worldPlayer,yaw,pitch,zoom,view);}else if(inside)(home.camera||indoorCamera)(me,yaw,pitch,zoom,view);else updateCamera(me,yaw,pitch,zoom,view);
const daylight=Math.max(.12,Math.sin((GameState.progress.routine.minutes-360)/1440*Math.PI*2));sun.intensity=.2+daylight*2.9;scene.background.setRGB(.08+daylight*.65,.12+daylight*.67,.2+daylight*.62);scene.fog.color.copy(scene.background);

updateEquipped(modal?0:view);updateCarryPose(view);updateNozzlePose(view);updateForkPose();if(forkGuide)forkGuideTick(fork.on?forkCtx():null,view);avatar.update(modal?0:view);if(shop)shops[shop].clerk.update(modal?0:view);updatePalletTags();updateZones(view);updatePassOut(real);updateSleep(real);updateWork(view);updateGig(view);updateObjective(view);updateWorldUI();updateTracker(real);updateHomeNotices();tickOrders(real);tickShifts(real);updateRing();updateMultiplayer(now,moving,view);syncPlayerMesh();fuelHose();{const dv=driving.active,on=!!dv&&(dv.fuelMgal>0||!dv.spec.fuel)&&!modal;{const tip=dv&&on?driving.exhaust(dv):null;if(tip)smoke.emit(dv.spec.id,view,tip,exhaustRate({running:true,throttle:driving.driving&&(keys.has('KeyW')||keys.has('ArrowUp'))?1:0,speed:dv.state.speed,top:dv.cls.top,tier:dv.cls.tier}));smoke.update(view,!inside)}audio.engine(engineVoice({speed:dv?dv.state.speed:0,top:dv?dv.cls.top:10,throttle:dv&&driving.driving&&(keys.has('KeyW')||keys.has('ArrowUp'))?1:0,tier:dv?dv.cls.tier:'low',running:on}))}audio.fuel({listener:listenerAt(),at:fuel.held?fuel.held.use:canAt,level:fuelFlow,fullness:fuelFull});fuelFlow=0;canAt=null;renderer.render(inside?home.room.scene:scene,camera)}requestAnimationFrame(frame);

// Development hook: open the game with ?debug to inspect state from the console (window.__city).
if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('debug'))window.__city={GameState,world,scene,camera,avatar,driving,pedestrians,audio,sawmillCtl,enterOffice:key=>{const o=officeByKey(key);if(o)enterOffice(o);return !!o},holdBend:a=>{bendNow=a;avatar.setLean(a*.87);avatar.setCrouch(a*.22)},
 teleport(x,z){if(inside||shop)return false;setMePosition(x,me.position.y,z);return true},
 view(newYaw,newPitch,newZoom){yaw=newYaw??yaw;pitch=newPitch??pitch;zoom=zoomTarget=newZoom??zoom},
 give(id){return commitInventory(addItem(GameState.progress,id))},equip:id=>toggleEquip(id,{silent:true}),hotbarUse,eHold(on){eHeld=on},place(x,z){setMePosition(x,me.position.y,z)},get shop(){return shop},get beacon(){return {visible:marker.visible,x:+marker.position.x.toFixed(2),y:+marker.position.y.toFixed(2),z:+marker.position.z.toFixed(2),diamondY:+diamond.position.y.toFixed(2)}},doors(){return {modal,active,busy:!!busy,fade:!!doorFade,cooldown:+doorCooldown.toFixed(2),fronts:shopDoors.map(f=>({kind:f.kind,amount:+f.door.amount.toFixed(2),open:shopOpen(f.kind,GameState.progress.routine),blocked:colliders.includes(f.blocker),dx:+(me.position.x-f.x).toFixed(2),z:+me.position.z.toFixed(2)}))}},get pos(){return {x:+me.position.x.toFixed(2),z:+me.position.z.toFixed(2),ry:+me.rotation.y.toFixed(2)}},get doorCooldown(){return +doorCooldown.toFixed(2)},get inside(){return inside},get hidden(){return $('objectiveDetails').hidden},get fork(){return fork},notify:notifyPhone,toastState:()=>({showing:toastShowing,waiting:[...toastQueue],text:$('jobToast').textContent}),tagsShown(){const o=shop&&officeByKey(shop);return o?.room?.tags?.shown||[]},tickRegrowth,
 use(index){return beginConsumption(index)},chop:startChop,get acting(){return !!(chopping||consuming||armRecovery)},fps:()=>$("fps").textContent};

// Update notice (update-check.js): asks the site for version.json a few seconds after loading and every 10 minutes; a newer version shows the banner, and Reload saves first (only once you are in the game, not on the menu).
const updateNotice=installUpdateNotice({document,version:VERSION,fetchJson:url=>fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null),beforeReload:()=>{if($('welcome').hidden)persist()},reload:()=>location.reload()});
// Dev mode (dev.js): one flag, dev-flag.js. With it off, dev.js is never fetched. To remove it for good, delete dev-flag.js, dev.js, the DEV_MODE import and this block.
// Everything the panel can do goes through the object below.
if(DEV_MODE){try{
 const edit=await import('./interior-edit.js'),rooms=await import('./interiors.js'),currentRoom2=()=>inside&&home.kind==='house'?home.room:null;let problemsKey='',problemsNow=[];
 const {installDevMode}=await import('./dev.js'),centre=id=>{const b=MAP.zones.find(zone=>zone.id===id).bounds;return {x:(b.x0+b.x1)/2,z:(b.z0+b.z1)/2}},at=(id,label,x,z)=>({id,label,x,z}),street=kind=>({x:MAP.shops[kind].x,z:MAP.shops[kind].doorZ+4});
 installDevMode({
  $,items:ITEMS,
  places:[at('spawn','Spawn · Oak Street',MAP.spawn.x,MAP.spawn.z),at('market','Corner Market (street)',street('market').x,street('market').z),at('cafe','Alder Coffee (street)',street('cafe').x,street('cafe').z),
   ...['alder','cedar','eastbank','farm','forest'].map(id=>at(id,MAP.zones.find(zone=>zone.id===id).name,centre(id).x,centre(id).z)),
   ...MAP.water.bridges.map(b=>at(b.id,b.id==='county-bridge'?'County Bridge':'Freight Bridge',(b.x0+b.x1)/2,(b.z0+b.z1)/2))],
  position(){const p=me.position;return {x:p.x,z:p.z,where:shop?'Inside a shop':inside?'Inside a home':(zoneAt(p.x,p.z)?.label||'Open Country')}},
  snapshot:()=>({minutes:GameState.progress.routine.minutes,cash:GameState.progress.cash}),
  setShadows(on){renderer.shadowMap.enabled=!!on;scene.traverse(m=>{if(m.material)m.material.needsUpdate=true})}, // for finding what causes a glitch on your GPU
  setTreeFade(on){world.fade.uniforms.uFadeEnabled.value=on?1:0},
  vehicles:{ // the drivable vehicles: spawn one in front of the player (or the nearest free spot), or take it out of the world; never the one the player is in
   list:()=>MAP.vehicles.filter(v=>v.sale!=='online').map(v=>({id:v.id,name:v.name,present:driving.present(v.id)})),
   spawn(id){const spec=MAP.vehicles.find(v=>v.id===id);if(!spec)return {error:'Unknown vehicle.'};if(inside||shop)return {error:'Go outdoors first.'}; // a free dev copy: no ownership, room, stock, price or lock, and never saved
    const d=CLASSES[spec.model].hz+3.2,r=driving.addDev(spec.model,null,{x:me.position.x+Math.sin(me.rotation.y)*d,z:me.position.z+Math.cos(me.rotation.y)*d,yaw:me.rotation.y});if(!r)return {error:'No free spot near you.'};return {message:`${spec.name} is ${Math.hypot(r.pose.x-me.position.x,r.pose.z-me.position.z).toFixed(1)} m away.`}},
   own(model,colour){const c=colour||defaultColour(model),r=buyVehicle({...GameState.progress,cash:GameState.progress.cash+(VEHICLE_PRICE[model]||0)},model,c);if(r.error)return {error:r.error};GameState.progress={...r.state,cash:GameState.progress.cash};driving.sync(GameState.progress.vehicles);persist();return {message:'ok',uid:r.vehicle.uid}},
   remove(id){const spec=MAP.vehicles.find(v=>v.id===id);if(!spec)return {error:'Unknown vehicle.'}; // removes the nearest dev copy of that model (never the one you are in; owned vehicles are not touched)
    const near=driving.devIds().map(u=>driving.byId.get(u)).filter(f=>f.spec.model===spec.model&&driving.active!==f).sort((a,b)=>Math.hypot(a.state.x-me.position.x,a.state.z-me.position.z)-Math.hypot(b.state.x-me.position.x,b.state.z-me.position.z))[0];
    if(!near)return {error:driving.devIds().some(u=>driving.active===driving.byId.get(u))?'You are in it. Get out first.':'No spawned '+spec.name+' to remove.'};driving.removeDev(near.spec.id);return {message:`${spec.name} removed.`}}},
  // The interior editor: move the furniture of any house about (you do not have to rent it), see what is wrong with the layout, and save it into the code (needs `npm run dev`).
  interior:{
   houses:MAP.properties.filter(p=>p.landmark&&rooms.FLOORS[MAP.landmarks.find(l=>l.id===p.landmark)?.prop]!==undefined).map(p=>({id:p.id,name:p.name})),
   catalogue:edit.FURNITURE.map(id=>({id,label:id.replace(/^f-/,'').replace(/-/g,' ')})),
   steps:edit.STEPS,
   visit(id){if(shop)return {ok:false,message:'Leave the shop first.'};if(!this.houses.some(h=>h.id===id))return {ok:false,message:'Unknown house.'};if(inside&&home.id===id)return {ok:true};if(inside)leaveHome();enterHouse(id);return {ok:true}},
   info(){
    const r=inside&&home.kind==='house'?home.room:null;if(!r)return null;
    const L=r.layout,key=JSON.stringify(L.items);if(key!==problemsKey){problemsKey=key;problemsNow=rooms.layoutProblems(L)}
    return {prop:L.prop,id:home.id,name:home.name,floor:r.floor,floors:L.floors,problems:problemsNow,items:L.items[r.floor].map((item,index)=>({index,id:item.id,text:edit.describe(item),locked:rooms.LOCKED.has(item.id)}))};
   },
   move(i,dx,dz){const r=currentRoom2();return !!r&&edit.moveItem(r.layout,r.floor,i,dx,dz)&&(r.refresh(),r.highlight(r.floor,i),true)},
   rotate(i,dir){const r=currentRoom2();return !!r&&edit.rotateItem(r.layout,r.floor,i,dir)&&(r.refresh(),r.highlight(r.floor,i),true)},
   remove(i){const r=currentRoom2();if(!r||!edit.removeItem(r.layout,r.floor,i))return false;r.refresh();r.highlight(null);return true},
   duplicate(i){const r=currentRoom2();const n=r?edit.duplicateItem(r.layout,r.floor,i):-1;if(n>=0){r.refresh();r.highlight(r.floor,n)}return n},
   add(id){const r=currentRoom2();const n=r?edit.addItem(r.layout,r.floor,id):-1;if(n>=0){r.refresh();r.highlight(r.floor,n)}return n},
   select(i){const r=currentRoom2();r?.highlight(i==null?null:r.floor,i)},
   reset(){const r=currentRoom2();if(!r)return false;edit.restoreItems(r.layout,rooms.houseLayout(r.layout.prop,{saved:false}));r.refresh();r.highlight(null);return true},
   async save(){
    const r=currentRoom2();if(!r)return {ok:false,message:'Go inside a house first.'};
    const body=JSON.stringify({prop:r.layout.prop,layout:edit.toSaved(r.layout)});
    try{const response=await fetch('/__dev/save-interior',{method:'POST',headers:{'content-type':'application/json','x-city-dev':'1'},body}),result=await response.json().catch(()=>({}));
     if(response.ok&&result.ok)return {ok:true,message:`Saved ${result.pieces} pieces of ${result.prop} into ${result.files.join(' and ')}.`};
     if(response.status!==404&&response.status!==501)return {ok:false,message:result.error||`The dev server refused it (${response.status}).`};
    }catch{}
    try{await navigator.clipboard.writeText(body);return {ok:false,copied:true,message:'No dev server here, so the layout is copied to your clipboard. Run npm run dev (instead of another server) to save straight into the code.'}}catch{return {ok:false,message:'No dev server here (run npm run dev), and the clipboard is not available.'}}
   }
  },
  start:startGame,active:()=>active,releaseCursor:()=>look.release(),reset,unstick,
  teleport(x,z){
   if(inside||shop)return {ok:false,message:'Go outside first: teleporting works on the street.'};
   if(!Number.isFinite(x)||!Number.isFinite(z))return {ok:false,message:'That is not a place.'};
   const r=placeSafely(x,me.position.y,z,{keepIfNone:true});
   if(!r.found)return {ok:false,message:'No clear ground within 30 m of that point.'};
   persist();return {ok:true,snapped:r.moved,x:r.x,z:r.z};
  },
  setTime(minutes){ // time of day only: the day, week and bills are untouched
   const m=Number.isFinite(minutes)?Math.max(0,Math.min(1439,Math.floor(minutes))):GameState.progress.routine.minutes;
   GameState.progress={...GameState.progress,routine:{...GameState.progress.routine,minutes:m}};persist();return m;
  },
  addMoney(cents){
   if(!Number.isSafeInteger(cents)||cents<=0||cents>1e9)return {error:'Money is added in whole cents, from 1 to 1,000,000,000.'};
   const cash=Math.min(1e10,GameState.progress.cash+cents);GameState.progress={...GameState.progress,cash};persist();return {cash};
  },
  statDrain(){return GameState.progress.settings.statDrainMultiplier},
  careers:{ // dev: be hired at an employer without the interview, or quit; promote when the needs are met
   hire(id){const r=hire(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:'Hired as '+r.rank.name+'.'}},
   quit(id){const r=quit(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:'Quit.'}},
   promote(id){const r=promote(GameState.progress,id,undefined,{force:true});if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:'Promoted to '+r.rank.name+'.'}},
   list:()=>MAP.employers.map(e=>({id:e.id,name:employerName(GameState.progress,e.id),hired:careerOf(GameState.progress,e.id).hired}))
  },
  setStatDrain(value){setStatDrainMultiplier(value);persist();return {value:GameState.progress.settings.statDrainMultiplier}}, // the old phone Settings app's one real control, now a dev tool
  giveItem(id,quantity){
   const item=itemById(id);if(!item)return {added:0,error:'Unknown item.'};
   const count=Math.max(1,Math.min(20,Math.floor(Number(quantity))||1));let progress=GameState.progress,added=0,error=null;
   for(let i=0;i<count;i++){const r=addItem(progress,id);if(r.error){error=r.error;break}progress=r.state;added++}
   if(added){GameState.progress=progress;persist()}
   return {added,error,name:item.name};
  }
 });
}catch(error){console.warn('Dev mode could not start:',error)}}
