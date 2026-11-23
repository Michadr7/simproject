import {createStoreUI} from './store.js';
import {createWorld,zoneAt,isWalkableLive as isWalkable,isWalkable as isWalkableMap,footingAt,standHeight,worldLayout,setGroundQuality} from './world.js';import {makeWindClock,advanceWindClock,windSample,makeWind} from './wind.js';const windClock=makeWindClock(),windNow=makeWind();
import {isMarked,LANDING,treeFelled,stackLog,planksMilled,stockOf,takeLogFromPile,inLumberyard,deliverPlanks,LUMBERYARD,logGathered,trunkBucked,sawFed,slabMilled,deliverSlabs,stumpCleared,saplingPlanted,racksOf,RACK_CAP,stackPlanks,takeFromRack,forkUsed,forkLoadOf} from './forest.js';
import * as forklift from './forklift.js';
import {createTreeMarks,createLandingRing,createStockPiles} from './marks.js';
import {loadCarry,unloadOne,unloadKind,cargoText,LOAD_REACH,takeAll,countOf,freeCount,orderCount,orderIdsOf,addPlanks,removePlanks,removeOrderPlanks,hasCrates,hasBed,slotPositions} from './cargo.js';import {summarize,fromLegacyCargo,needCratesFit,NEED_BED_BUSY} from './cargo-items.js';
import {createCargoUI} from './cargo-ui.js';
import {scheduleTruck,truckOf,truckWaiting,truckDue,truckArrived,loadFromHands,loadFromStock,loadFromBed,sendOff,BAY as TRUCK_BAY} from './customers.js';
import {createCustomerTruck} from './customer-truck.js';
import {heightAt} from './height.js';
import {kindOf as beaconKindOf,colourFor as beaconColour,fadeFor as beaconFade,FLASH_SECONDS} from './beacon-style.js';
import {slabOutline,cornerRegion} from './junctions.js';
import {hire,quit,collectOwed,employerName,careerOf,promote,nextRank,ownerOf,employerById,storeItems,storeLine,buyFromCompany,changeRep} from './careers.js';
import {tickSupply,supplyOf,returnPlanks} from './supply.js';import {workforceTicketStep} from './workforce-tick.js';import {deliveryPay,refusalReason,bedCapacity} from './plank-delivery.js';import {priceTable} from './plank-economy.js';
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
import {createWarehouse,createWarehouseDoorway,createDockPanel,RACK_SLOTS,WAREHOUSE_TABLE,WAREHOUSE_STAGING} from './warehouse.js';
import {WAREHOUSE_COOLER} from './warehouse-layout.js';
import {HAND_LEVEL,DOCK_DOOR,HALL} from './warehouse-layout.js';
import {OUT,ZONE,toOutside,toInside,crossesOut,crossesIn,freshDoor,stepDoor,passable,nearDoor,inYard,inDoorwayOut} from './dock.js';
import {clockIn,clockOut,tickShift,onSiteAt,taskText,recordPiece,unrecordPiece,PIECE_PAY} from './shift.js';
import {deliverDue,takeDelivery,placeOrder,setMainHome,waitingHomes,waiting,dropSpot,homesHeld,mainHome,STUDIO_ID,buyVehicle,orderVehicle,displayColour,vehicleLabel,VEHICLE_PRICE,vehicleLock} from './orders.js';
import {createParcels} from './parcels.js';
import {boxPose,freshBoxPose,BOX_POLES,poseFor} from './carry-pose.js';
import {SURFACE_LABEL,surfaceSpeed,CLASSES} from './vehicle.js';
import {trackerItems,focusedItem,nextFocus,focusAfter,distanceTo} from './tracker.js';
import {worldDoors,doorOf,propertyById} from './properties.js';
import {buildHouseRoom} from './interiors.js';
import {propertyTransaction,heldIds,listingOf} from './ownership.js';
import {CREDITS} from './credits.js';
import {createSawmillController,freshSawmill,switchSawmill,switchLabel,BELT_SLOTS,PLANK_TINT,anchorWorld} from './sawmill.js';import {pilePlanks,topStack,pileBounds,logPile,logBounds,PILE_SLOTS,LOG_SLOTS,PLANK_PITCH,trunkPile,trunkBounds,slabPile,slabBounds,TRUNK_SLOTS,SLAB_SLOTS,SLAB_THICK,TRUNK_RADIUS} from './sawmill-pile.js';
import {createAudio,engineVoice} from './audio.js';
import {createSmoke,exhaustRate,START_PUFFS} from './smoke.js';
import {LOG_HOME,LOG_GROUND,LOG_HAND,LOG_POLE,carryEffects,bendLean,bendDrop,bendAmount,BEND_TIME,BEND_RELEASE,PLANK_HANDS,PLANK_STACK,PLANK_POLES,poseBlend,plankBox,quarterOf,shoulderLog,putDownLog,feedLog,takePlanks,putDownPlanks,pickUpPlanks,putDownCrate,pickUpCrate,CRATE_SIZE,MAX_CRATE_DROPS,putDownSlab,pickUpSlab,MAX_SLAB_DROPS} from './carry.js';
import {chopTree,felledTrees,plotAt,expireLogs,regrowTrees,felledStages,CHOP_RANGE,clearStump,plantSapling,buckTrunk,buckTool,BUCK_RANGE,MAX_LOGS} from './grid.js';
import {levelOf,swingTime,perkText as perkTextBase} from './skills.js';const perkText=lv=>{audio.sweep('level-up');return perkTextBase(lv)}; // SND-hooks: perkText is only asked for when a level-up message is built
import {isAxe,isSaw,hitsFor,bestAxe,buckHitsFor,buckTimeSec} from './tools.js';import {GLTFLoader} from './vendor/GLTFLoader.js';import {GOODS as BAKERY_GOODS,SACKS_PER_PALLET,isBakeryGood} from './bakery-goods.js';
import {setTimberParts,setBakeryPalletParts} from './cargo-view.js';// T-E: bucking and the timber models (trunk, two logs, slab); quest rework: slabs are delivered (forest.js deliverSlabs), there is no cash sale
import {createMinimap} from './minimap.js';
import {createHeldItem,disposeHeldItem} from './item-models.js';
import {createConsumptionAnimation} from './consumption.js';
import {itemById,ITEMS} from './items.js';
import {DEV_MODE} from './dev-flag.js';import {VERSION} from './version.js';import {installUpdateNotice} from './update-check.js';
import {createInventoryUI} from './inventory-ui.js';
import {addItem,useItem,unequipItem,hasItem,hotbarItems,equipTool,sellLogs,canOf,setCan} from './inventory.js';
import {createPhone} from './phone.js';import {chatLine} from './npc-chat.js';import {createGps} from './gps.js';
import {acceptContract,completeContract,tickContract,gigTarget,atGigPoint,refreshGigBoard,gameMinutes,marketContracts,gigDoor,dropGigParcel,pickGigParcel,pickNeedCrates,deliverNeedCrates,settleNeedGig,abandonContract,NO_WORK_POSTED,pickUpGigBox,gigPickupHere} from './gig-bridge.js';import {parcelHeld as parcelHeldRaw,parcelWaiting,PARCEL_HANDS,parcelModelId,PARCEL_DEFAULT,mountError,canStow,STOW_TOAST,UNSTOW_TOAST,RACK_BUSY,parcelAway,PARCEL_ON_BED} from './gig-parcel.js';import {createProp} from './props.js';import {createHal} from './hal.js';import {storyDeck,storyPalletHidden,halHere,applyStory,alreadyHoused,startLoan,ensureLoan,halTalk,buyFromHal,knockQuality,aimPoint,CRATE_REACH,MARKET_REACH,advanceStarter,starterObjective,skipStarter,PLACES as STORY_PLACES,SKIP_SALE_PRICE} from './starter.js';
import {GameState,initializeState,setMePosition,tickLife,setStatDrainMultiplier} from './state.js';
import {needsEffects} from './life.js';
import {loadProfile,saveProfile,wipePlayerKeys} from './profile.js';
import {MultiplayerClient} from './multiplayer.js';import {makeSessionClock,canSync,syncAdvance,SYNC_WARNING,VISIT_NOTE} from './session-clock.js';const sessionClock=makeSessionClock(); // the session game clock (session-clock.js): equals the saved clock alone or as host, follows the host's when you join
import {createMainMenu,relayBase,refusalText,loadSettings} from './main-menu.js';import {createSaveMenu} from './save-menu.js';import {createCloud,PUSH_EVERY_MS} from './cloud-save.js';import {createAccountMenu} from './account-menu.js';import {normalizeLobbyCode,REFUSED} from './relay-protocol.js';
import {findNearestClearSpot,MAX_SEARCH,OPEN_AREA} from './safe-spot.js';
import {createHouseSigns} from './house-signs.js';
import {terrain,SURFACE} from './terrain.js';
import {createRemotePlayer,updateRemotePlayer,disposeRemotePlayer} from './remote-player.js';
import {chooseInteraction,screenAnchor} from './interactions.js';
import {createLookControls} from './look-controls.js';
import {dinerAct,dinerSpots,dinerHint,dinerOf} from './diner-flow.js';import {TABLES} from './diner-job.js'; // diner D-A2: the cafe shift is the diner career (shift.js + diner-flow.js); cafe-job.js is gone
import {advanceTime,clockText,shopOpen,hoursText,formatClock} from './routine.js';import {shopPresence} from './shop-presence.js';
import {normalizeLife,lifeTransaction} from './life.js';
import {SHOPS,SHOP_ENTRY,SHOP_EXIT,COUNTER,WHOLESALE_INTERIOR,createShop} from './shops.js';
import {ID as WHOLESALE_ID,COUNTER as WHOLESALE_APPROACH,RETAIL_GOODS,TRUCK_BAY as WHOLESALE_TRUCK_BAY,worldPoint as wholesalePoint} from './eden-wholesale.js';
import {createSlidingDoor} from './doors.js';
import {MAP,roadRects,nearestRescuePoint,roadGraph} from './map-definition.js';import {streetChips} from './hud-cards.js';import {shouldShow as shouldShowLoggingTutorial,markSeen as markLoggingTutorialSeen,buildOverlay as buildLoggingTutorial,bindClose as bindLoggingTutorialClose} from './logging-tutorial.js';
import {activeAction,canStart,refusal} from './actions.js';
import {resolveObjective} from './objective.js';
import {substeps,MAX_FRAME} from './timestep.js';
import {CARRY,CARRY_DIR,CARRY_POLE,CHOP_IMPACT,HITS_PER_SWING,swingSeconds,chopVariant,chopPose,carryGrip,SAW_CARRY,SAW_DIR,sawPose,sawStand,sawCutting} from './chop-path.js';import {spawn as spawnDust} from './sawdust.js';import {forestTarget,forestDuck,createCreakGate,thudSizeForLogs} from './logging-wiring.js'; // LOG1: logging sounds (audio.logging, the forest loop, seeded creaks) // STEP 4: trail carry, chainsaw bucking pose, sawdust chips into the sawmill's one Points pool
import {createPedestrians,createVehicles} from './neighborhood.js';import {createNpcCrowd} from './npc-crowd.js';import {townPopulation} from './population.js';import {createSchedule,dayPlan} from './schedule.js';import {createRouteTable,tripWithTable,walkPairsOf} from './npc-routes.js';import {busyness} from './busyness.js';import {createWalkSchedule,walkLegCandidatePairs,townWalkBlocked,townWalkCost} from './walk-legs.js';
import {createDriving} from './driving.js';import {shakeAmplitude,shakeOffset,SHAKE_SECONDS,ENERGY_COST,bandToast,smokeOf,hitStopOf,stopSlice,flashOf} from './damage.js';import {createDebris} from './debris.js'; // VD7a: crash feedback
import {pullOutAvailable,BOG_PULL_HOURS} from './surface-table.js';import {pullOut,pullFee,hoursNow,shopList,offers as garageQuotes,collect as collectRepair,startRepair,useKit,towTo,bayPose,inBay,inShop,condOf,hoursText as repairText,KIT_CAP} from './garage.js';import {percent as condPct} from './damage.js'; // VD4: the repair shop (garage.js holds every rule)
import {createVehicleHud,vehicleHudModel} from './vehicle-hud.js';import {createNightLights} from './night-lights.js';import {LIGHT_KEY,nextLightMode,lightsLabel} from './night-lights-rules.js';
import {defaultColour} from './paint.js';import {createPetActor} from './pet-actor.js';import {clipFor,nextWaypoint,interiorSpawn,petSnapshot,applyPetSnapshot} from './pet-view.js';import {adoptionOffer,declineOffer,accept as adoptPet,feed as feedPet,pat as patPet,hungerOf,moodOf,tickPets,rehome as rehomePet,DEFAULT_NAME as PET_DEFAULT,NAME_MAX as PET_NAME_MAX,MSG as PET_MSG} from './pets.js';import {collidersOf} from './interiors.js';import {MEOW_GAP} from './cat-sounds.js'; // PET3: the cat
import {sleepThrough,passOutThrough,PASS_OUT_ONLINE_SECONDS} from './sleep.js';
import {createFuelStation} from './fuel-station.js';
import {worldDue,runWorldDay,pumpGate,pumpSold,SOLD_OUT_TEXT,newsFor} from './world-tick.js'; // W-D1: the daily world tick at 05:00 and the pump stock
import {hutPlanks,hutTopStack,hutSlabs,hutRect,hutWorld,nearestOn,putDownRule,HUT,HUT_DECK,BOARD_HALF,SLAB_HALF,BOARD_SLOTS,HUT_SLAB_SLOTS,HUT_REACH} from './lumber-hut.js';import {normalizeYard,feed as feedYard,tick as tickYard,takeStack,takeSlab,storeInYard,YARD_MAX_TRUNKS,YARD_MAX_SLABS,switchSaw,summarize as yardSummary,PLANKS_PER_STACK as YARD_STACK,YARD_MAX_LOGS,YARD_MAX_PLANKS} from './sawmill-yard.js'; // P-B wiring: the player-fed sawmill yard (the sawmill's one plank stock)
import {stockAt,priceOf} from './world-state.js';import {PLACES as WORLD_PLACES,GOODS as WORLD_GOODS,CRATE_UNITS} from './world-goods.js';import {moodLine,tierFor,moodWord,gainStanding,meet as npcMeet,talk as npcTalk} from './npc-life.js';import {talkContext,openConversation,chooseReply,remember} from './talk-engine.js';import {castOf} from './cast.js';import {createTalkPanel} from './talk-panel.js';import {withMem} from './talk-memory.js';import {openTalk,talkOutcome,registerTalk,knock,flatDoors,topicsFor,pagedChoices,createRosterPlanner,rosterByPersonId} from './npc-dialogue.js';import {ROSTER as NPC_ROSTER,byId as npcById} from './npc-roster.js';const parcelHeld=p=>parcelHeldRaw(p)&&!p.gigs.active.needId; // a need gig has no box in the hands (gig-parcel.js counts every active gig as a box): the egg run drives, the crates ride on the truck
import {removeBakeryPallet,addCrates as addNeedCrates,removeCrates as removeNeedCrates,capacity as crateCapacity,acceptsCrates,takesCrateGigs,usesLoadDrag,BEDS} from './cargo.js';import {loadFactor,isHeavy,cargoMassKg,parcelMassKg,HEAVY_TEXT} from './load-drag.js'; // W-D2: the egg run, the shelves, Noah's mood line
import {sell,fillCan,pour,canText,CAN_CAPACITY_MGAL,STEP_MGAL,FLOW_MGAL_PER_S,REACH_M,USE_RANGE_M,fuelText,fuelTitle,fuelName,gallons} from './fuel.js';
import * as THREE from './vendor/three.module.js';import {backendFlag,backendLabel,setTslKit,tslKit,directOutputWanted} from './render-backend.js'; // WebGPU T5: ?webgpu=1 (default stays WebGL)
import { createCameraController } from './camera.js';
import {MARKET,routeFor,targetFor,nearby,money,transactJob} from './jobs.js';
import {STUDIO,totalDue,housingTransaction,weekday,weekNumber,dueIn,estimatedUtilities} from './housing.js';
import {createApartment,EXIT,BED,ENTRY} from './apartment.js';
import {createIndoorCamera} from './indoor-camera.js';
import {polishWorld} from './visuals.js';
import {createMovementInput} from './input.js';
import {createCharacter,loadCharacterAssets,characterAssetsReady,SOLE_LIFT} from './character.js';import {createMenuScene} from './menu-scene.js';import {createSky,INDOOR_EXPOSURE} from './sky.js';import {createShadows} from './shadows.js';import {createMenuLive,MENU_FPS,MENU_FPS_LOW,MENU_STILL,creatorReturn,menuVehicleFor} from './menu-scene-rules.js';
import {outfit as makeOutfit,palettes,defaults,loadAppearance,saveAppearance,normalizeAppearance,BODIES,OUTFITS,PART_KEYS,CLOTHES_KEYS,partChoices,quickOutfits,switchBody,randomLook} from './appearance.js';
// Decode the embedded character models once, before any character (player, clerks, pedestrians) is built.
await loadCharacterAssets();
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#b9cbd0');scene.fog=new THREE.Fog('#b9cbd0',65,155);
const backendWanted=backendFlag(globalThis.location?.search||'',typeof globalThis.location?.search==='string'),startSettings=loadSettings({getItem:k=>localStorage.getItem(k)});let renderer=null,renderBackend='WebGL';const perfMod=/[?&]perf\b/.test(globalThis.location?.search||'')?await import('./perf-probe.js'):null,perfWanted=!!perfMod&&perfMod.perfFlag(globalThis.location?.search||'',true);let perf=null; /* WebGPU T6: ?perf=1 loads perf-probe.js and turns on GPU timestamps; the probe itself starts in the Dev Mode block at the end */ // WebGPU T5: only ?webgpu=1 loads three.webgpu.js + three.tsl.js (2.3 MB) and makes a WebGPURenderer (the library falls back to WebGL2 without an adapter; &webgl=1 forces that); without the flag nothing here changes
if(backendWanted.webgpu){try{const [WGPU,TSL,OUT]=await Promise.all([import('./vendor/three.webgpu.js'),import('./vendor/three.tsl.js'),import('./tsl-output.js')]);const r=new WGPU.WebGPURenderer({canvas:$('world'),antialias:true,powerPreference:startSettings.quality==='high'?'high-performance':'low-power',forceWebGL:backendWanted.forceWebGL,trackTimestamp:perfWanted});if(directOutputWanted(globalThis.location?.search||''))OUT.installDirectOutputTSL({THREE:WGPU,TSL,renderer:r});await r.init();renderer=r;setTslKit({TSL,NodeMaterial:WGPU.NodeMaterial,MeshBasicNodeMaterial:WGPU.MeshBasicNodeMaterial,MeshStandardNodeMaterial:WGPU.MeshStandardNodeMaterial,MeshLambertNodeMaterial:WGPU.MeshLambertNodeMaterial,PointsNodeMaterial:WGPU.PointsNodeMaterial});renderBackend=backendLabel(r,true);setGroundQuality(startSettings.quality==='high');console.info('[renderer] '+renderBackend+' (?webgpu=1): TSL materials on, grade + sRGB per material as WebGL (tsl-output.js; &direct=0 = the T5 output pass); compileAsync + hidden-twin warm-up instead of renderer.compile; the ground rebuilds live when WebGPU is on')}catch(e){console.warn('[renderer] WebGPURenderer did not start, using WebGLRenderer',e);setTslKit(null);renderer=null}}
if(!renderer)try{renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:startSettings.quality==='high'?'high-performance':'low-power'});}catch(e){$('error').hidden=false;$('error').textContent='This prototype needs WebGL. Please try a browser with hardware acceleration enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,700);const hemi=new THREE.HemisphereLight('#d8e8f0','#777655',1.7);scene.add(hemi);const sun=new THREE.DirectionalLight('#ffe3b9',3.1);sun.position.set(-24,30,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,far:130});sun.shadow.bias=-.0005;scene.add(sun);
const sky=createSky({scene,renderer,sun,hemi});let frameProbe=null; // day and night (sky.js, daynight.js): this one light is the sun and the moon; the grade replaces ACES through CustomToneMapping. frameProbe: the dev panel's frame timer
const mats=new Map(),colliders=[],cameraSolids=[],shopShells={market:[],cafe:[]},cityWindows=[],cityLampHeads=[];function mat(c){if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.92}));return mats.get(c)}
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

box(110,.12,19,0,-.05,6,'#535d60');box(16,.13,120,-30,-.055,0,'#535d60'); /* PB2: street tops at .01 (the footing), were .03 and .045 */ // The city's own pavements (the first MAP.pavements entries, the ones world.js does not draw): raised slabs whose inside corners are rounded where MAP.roundedCorners say so, and the little
// patches of street that fill those corners (junctions.js). The slab is 0.25 m thick, its top 0.185 m up, as before.
{const pavementColour=mat('#b7b6a8'),streetColour=mat('#535d60'),outline=pts=>new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
 const solid=(pts,y,depth,material,name)=>{const m=new THREE.Mesh(new THREE.ExtrudeGeometry(outline(pts),{depth,bevelEnabled:false}),material);m.rotation.x=-Math.PI/2;m.position.y=y;m.castShadow=false;m.receiveShadow=true;m.name=name;scene.add(m);return m};
 for(const p of MAP.pavements.filter(p=>!p.draw))solid(slabOutline(p,MAP.roundedCorners),-.085,.25,pavementColour,'city-pavement');
 for(const c of MAP.roundedCorners)solid(cornerRegion(c),-.13,.14,streetColour,'street-corner-'+c.id)}
for(let x=-48;x<55;x+=8){if(x<-40||x>-20)box(3,.02,.14,x,.03,6,'#d9d5bb')}for(let z=-47;z<55;z+=8)if(z<-8||z>20)box(.14,.02,3,-30,.04,z,'#d9d5bb');for(let i=0;i<7;i++){box(.85,.025,7,-18+i*1.55,.04,6,'#dfdfd1');box(8,.025,.9,-30,.04,-7+i*1.6,'#dfdfd1')}
function building(x,z,w,d,h,c,name,kind=null){const before=scene.children.length;if(kind){const shell=box(w,h-3.5,d,x,3.5+(h-3.5)/2,z,c);shopShells[kind].push(shell);{const gap=MAP.shops[kind].doorway.halfWidth;colliders.push({x:x-(w/2+gap)/2,z,hx:(w/2-gap)/2,hz:d/2},{x:x+(w/2+gap)/2,z,hx:(w/2-gap)/2,hz:d/2})} // the doorway is open ground
 for(const side of [-1,1])shopShells[kind].push(box(1.5,3.5,10,x+side*6.75,1.75,MAP.shops[kind].interior.origin.z,c));}else box(w,h,d,x,h/2,z,c,true);box(w+.35,.35,d+.35,x,h+.1,z,'#d6d2c4');box(w+.4,.22,d+.4,x,3.6,z,'#d6d2c4');const front=z+d/2+.025;for(let xx=x-w/2+1.4;xx<x+w/2-.7;xx+=2.5)for(let yy=5;yy<h-1;yy+=2.8){cityWindows.push({mesh:box(1.1,1.65,.08,xx,yy,front,'#435d68'),id:'city@'+x+','+z});box(1.32,.12,.22,xx,yy-.85,front+.08,'#d1c6b1')}if(name){if(name==='OAK STREET APARTMENTS')label(name,x,3.96,front+.24,7,0,'#243e3b','#f1ebd9',.42);else if(kind)label(name,x,3.96,front+.24,7,0,'#243e3b','#f1ebd9',.42);else label(name,x,3,front+.12,Math.min(w-1,7));if(!kind)for(let xx=x-w/2+1.5;xx<x+w/2;xx+=3)box(1.8,1.9,.1,xx,1.25,front,'#3d555a')}if(kind){shopShells[kind]=[...new Set([...shopShells[kind],...scene.children.slice(before)])];cameraSolids.push(shopShells[kind][0]);}}
// Every building comes from the map (map-definition.js), including the backdrop row beyond the city edge.
for(const b of MAP.buildings)building(b.x,b.z,b.w,b.d,b.h,b.color,b.name,b.shop);
// Entrance is a distinct replaceable asset; interaction data is separate from scenery.
const entrance={x:MAP.studio.x,z:MAP.studio.doorZ,radius:3.3};{const sx=MAP.studio.x,sz=MAP.studio.doorZ;box(2.2,2.7,.18,sx,1.35,sz-.11,'#213a3c');box(.08,2.3,.05,sx,1.3,sz+.02,'#aebeb5');box(.12,.25,.08,sx+.6,1.3,sz+.07,'#e3cf93');box(3.6,.18,1.8,sx,3.05,sz+.45,'#374e46');label('18',sx,2.83,sz+.09,.45,0,'#213a3c','#e3cf93',.16)} // the studio's door, placed by the map
const trees=[],lampMeshes=[]; // trees: the camera's list of fading hand-built trees. Empty now: every tree is a Quaternius model that dissolves with the sightline shader (world.js).
// Oak Street's trees. Kept clear of shop signs, doorways and the crosswalk approach. They are placed as models once the world exists (below).
const OAK_TREES=[[-9,-4.5],[10,-4.5],[28,-4.5],[43,-6.5],[-14,19],[7,19],[32,19],[49,19],[-18,-31],[-18,-43],[-43,18]]; // tests/street-trees.mjs: none may stand on a road
function lamp(x,z){const post=box(.12,5,.12,x,2.5,z,'#354342');post.material=post.material.clone();post.material.transparent=true;lampMeshes.push(post);box(1,.15,.55,x+.35,5,z,'#394644');cityLampHeads.push(box(.75,.04,.4,x+.35,4.9,z,'#f2e4b7'))}[-10,15,42].forEach(x=>{lamp(x,-4.6);lamp(x,17)});
const pedestrians=createPedestrians(scene);const npcWeather=day=>NPC_WEATHER_WORD,npcTown=townPopulation(),npcPlanCtx={weather:npcWeather};let npcSchedBase=createSchedule(npcTown,npcPlanCtx),npcStaticRoutes=true;const npcSchedule={planOf:(id,day)=>npcSchedBase.planOf(id,day),at:(id,day,minute)=>npcSchedBase.at(id,day,minute),present:(place,day,minute)=>npcSchedBase.present(place,day,minute),travelling:(day,minute)=>npcSchedBase.travelling(day,minute)},rosterPlanner=createRosterPlanner({schedule:npcSchedule,getNpcs:()=>GameState.progress.npcs,seed:MAP.seed});let npcWalkSched=rosterPlanner;const rosterPersonIds=new Set(NPC_ROSTER.map(r=>r.personId)),pedRoster=new Map(pedestrians.people.map(p=>[p.name,npcTown.people.find(q=>q.name===p.name&&rosterPersonIds.has(q.id))?.id]).filter(e=>e[1]).map(e=>[e[0],rosterByPersonId(e[1]).id])); // W-D3: roster people the crowd draws can be talked to (pedRoster = the pedestrian avatars that are roster people)
const npcCrowdBlocked=(x,z)=>npcStaticRoutes?npcStaticBlocked(x,z):worldBlocked(x,z),npcWalkBlock=townWalkBlocked(npcCrowdBlocked,(x,z)=>terrain().surfaceAt(x,z),(x,z)=>terrain().zoneAt(x,z),SURFACE,MAP),npcWalkCostFn=townWalkCost((x,z)=>terrain().surfaceAt(x,z),SURFACE,MAP);const npcCrowd=createNpcCrowd({scene,createCharacter,outfit:makeOutfit,population:npcTown,seed:MAP.seed,workProps:{axe:()=>createHeldItem(itemById('axe')),log:()=>{const g=new THREE.Group(),m=new THREE.Mesh(groundLogs.geometry,groundLogs.material);m.rotation.y=Math.PI/2;g.add(m);return g},planks:()=>{if(!sawmillCtl?.ready)return null;const m=new THREE.Mesh(sawmillCtl.plank.geometry,sawmillCtl.plank.material);m.scale.y=4;return m}},/* W3: one prop per worker role, shared geometry (the axe's, the ground logs', the sawmill plank's), made when first needed */schedule:npcSchedule,planOf:(id,day)=>npcWalkSched.planOf(id,day),pedestrians:pedestrians.people,exclude:['Hal Brennan','Noah'],blocked:npcWalkBlock,cost:npcWalkCostFn,groundAt:standHeight}); // A2: the town's people follow their plans (npc-crowd.js); the six pedestrians are driven by it too, no more walking to and fro
// N2 (notes/npc-movement-design.md, notes/eval/outbox/N2-pure.md): the walking length of every place pair the plans use is measured once (npc-routes.js crowdWarm, about 0.4 s in all) in 4 ms slices per frame while the main menu shows; then the schedule is rebuilt with blocks sized from those lengths (tripWithTable) and the weather word (busyness.js). Until then the old estimate is used and nobody is drawn (the crowd only updates in play).
// The table is measured with STATIC obstacles only (npcStaticRoutes: the whole-map walk mask, not the streamed one; world.blockedStatic = every world collider as built, whatever chunks are loaded or trees felled; building colliders except the shop door blockers; never plank stacks, crates or vehicles), so co-op machines size the same blocks. There is no weather system yet: every day is NPC_WEATHER_WORD.
const NPC_WEATHER_WORD='clear',NPC_WARM_DAYS=[1,2,3,4,5,6,7],NPC_WARM_MS=4,npcRouteTable=createRouteTable(),npcWarmTried=new Set();let npcWarm=null,npcWarmRound=0;
function npcStaticBlocked(x,z){return !isWalkableMap(x,z)||world.blockedStatic(x,z)||colliders.some(b=>!b.door&&Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)}
function npcWarmStart(pairs){const list=pairs.filter(q=>!npcWarmTried.has(q.from+'>'+q.to));for(const q of list)npcWarmTried.add(q.from+'>'+q.to);npcWarm=list.length?npcCrowd.warm(list,{table:npcRouteTable,now:()=>performance.now(),budgetMs:NPC_WARM_MS}):null;return !!npcWarm}
function npcRoutesReady(){const trip=tripWithTable(npcRouteTable,MAP);if(npcWarmRound++<1&&npcWarmStart(walkPairsOf(npcTown.people,NPC_WARM_DAYS,(p,d)=>dayPlan(p,d,{trip,weather:npcWeather}))))return;npcWarm=null;npcStaticRoutes=false;npcPlanCtx.trip=trip;npcSchedBase=createSchedule(npcTown,npcPlanCtx);rosterPlanner.clear();npcWalkSched=createWalkSchedule(rosterPlanner,npcTown,{table:npcRouteTable,seed:MAP.seed,skip:p=>!!npcById(rosterByPersonId(p.id)?.id)?.homebody});globalThis.__npcRoutes={pairs:npcRouteTable.size,signature:npcRouteTable.signature()}}
if(!npcWarmStart([...walkPairsOf(npcTown.people,NPC_WARM_DAYS,(p,d)=>dayPlan(p,d)),...walkLegCandidatePairs(npcTown.people,MAP)]))npcRoutesReady();
const hal=createHal({scene,createCharacter,outfit:makeOutfit,groundAt:standHeight}); // G3: Hal Brennan in person at the farm (hal.js)
for(let x of[9,27]){box(2,.18,.7,x,.65,17.5,'#876e50');box(2,.55,.13,x,1,17.85,'#876e50');box(.12,.7,.55,x-.8,.3,17.5,'#394a42');box(.12,.7,.55,x+.8,.3,17.5,'#394a42')}box(.8,1.2,.8,11,.6,-4.5,'#435c4f',true);
polishWorld(scene,box,label,trees);for(const [x,title] of Object.values(MAP.shops).map(shop=>[shop.x,shop.sign]))label(title,x,2.95,-8.08,2.1,0,'#24483f','#f1ebd9',.25);
for(const x of [3.8,-10.2]){box(.85,.8,.55,x,.55,-7,'#637f70',true);label('DELIVERIES',x,1.06,-6.7,.8,0,'#29473b','#e9e3c7',.16)}
// Farm and forest zones, plot grid and cuttable trees (world.js). Built after polishWorld so its
// texture pass only touches city meshes.
const world=createWorld(scene,{label,streaming:true});
const sawmillCtl=createSawmillController(scene.getObjectByName('prop-sawmill-v4'),MAP.landmarks.find(l=>l.id==='sawmill'),{belt:()=>0}); // the sawmill's switch, blade, cut and belt (sawmill.js); the belt only carries a fresh stack to its end, the yard's planks lie on the pile in the shed (syncYardPile)
let sawmillState=freshSawmill();
// Sound (audio.js): generated with Web Audio, started by the first click or key press (browsers need one), silent beyond 40 m; volume and mute are saved and set in the main menu's Settings.
const driveFx={on:false,sliding:false,speed:0,x:0,z:0,dt:0,people:null}; // reused every frame (audio.drive)
const audio=createAudio({AudioContextClass:globalThis.AudioContext||globalThis.webkitAudioContext,soundBase:globalThis.document?.baseURI?new URL('assets/sounds/',document.baseURI).href:null,sampleUrl:globalThis.document?.baseURI?new URL('assets/sounds/water_drink.wav',document.baseURI).href:null,storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)}});
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
let sawRecover=null,sawLean=false,heldHeadEnd=NaN,heldGrip=carryGrip(),carryAt=CARRY,sawDustLive=0;const SAW_OUT=sawPose(0,1),SAW_STEP=sawPose(0,1),SAW_STAND_AT={x:0,z:0,yaw:0},CHOP_OUT=chopPose(0),CHOP_VAR=chopVariant(0,0),CHOP_NUDGE={amp:.035,t:.16},SAW_DUST_RATE=45,SAW_DUST_BURST=10; // STEP 4: the chainsaw's recoil after a cut, the axe's sliding grip, the arm's carry target, the chips
// Hotbar, equipped tool, hold-E chopping, plot grid toggle and tree regrowth bookkeeping.
let doorCooldown=1,doorFade=null,hotbarSignature='',eHeld=false,carried=null,carryWeight=0,gridOn=false,regrowClock=99;
const pendingLogs=new Set(),lastStages=new Map();
let inside=false,shop=null;const apartment=createApartment();
const shops={market:createShop('market'),cafe:createShop('cafe')};for(const [kind,room] of Object.entries(shops)){const {origin}=MAP.shops[kind].interior;room.scene.position.set(SHOPS[kind].x,origin.y,origin.z);scene.add(room.scene);scene.updateMatrixWorld(true);room.camera=createIndoorCamera(camera,[...room.occluders,...shopShells[kind]],{minDistance:2.2,maxDistance:5.5,bounds:{minX:SHOPS[kind].x-5.57,maxX:SHOPS[kind].x+5.57,minY:origin.y+.35,maxY:origin.y+3.05,minZ:origin.z-4.57,maxZ:origin.z+4.57}});roomDoorShown(room,false);}
const wholesaleDoor=doorOf(propertyById(WHOLESALE_ID)),wholesaleApproach=wholesalePoint(WHOLESALE_APPROACH,WHOLESALE_POSE);
const wholesaleRoom=shops[WHOLESALE_ID]=createShop(WHOLESALE_ID),wholesaleOrigin=WHOLESALE_INTERIOR.origin;
SHOPS[WHOLESALE_ID]={name:propertyById(WHOLESALE_ID).name,x:wholesaleApproach.x,z:wholesaleApproach.z};
wholesaleRoom.scene.position.set(wholesaleOrigin.x,wholesaleOrigin.y,wholesaleOrigin.z);wholesaleRoom.scene.visible=false;scene.add(wholesaleRoom.scene);
wholesaleRoom.camera=createIndoorCamera(camera,wholesaleRoom.occluders,{minDistance:2.2,maxDistance:5.5,bounds:{minX:wholesaleOrigin.x-5.57,maxX:wholesaleOrigin.x+5.57,minY:wholesaleOrigin.y+.35,maxY:wholesaleOrigin.y+3.05,minZ:wholesaleOrigin.z-4.57,maxZ:wholesaleOrigin.z+4.57}});
const worldPlayer={position:new THREE.Vector3()};
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
 for(const s of summarize(fromLegacyCargo(c))){if(!s.free)continue;const kind=s.kind,lock=kind==='crate'?runCrates(id):'';rows.push({label:(lock||TAKE_ROW[kind])+' · '+s.free+' on the bed'+(hands&&!lock?' (your hands are full)':''),disabled:hands||!!lock,run:()=>{takeKind(id,kind);return {close:!!GameState.progress.carry}}})} // C-B: one row per kind (cargo-items.js summarize: log, planks, crate, parcel, box); a running delivery's crates are shown, not taken
 for(const oid of orderIdsOf(c)){const k=ridgelineTickets().find(t=>t.id===oid);rows.push({label:`Order #${oid} · ${orderCount(c,oid)} planks are the customer's${k?.dest?`: unload them at ${destinationName(k.dest)}`:''}`,disabled:true,run:()=>({})})} // an order's planks cannot be taken off by hand or sold
 const planks=freeCount(c,'planks');
 if(planks&&onRidgeline()&&inLumberyard(f.state))rows.push({bulk:true,label:'Unload all '+planks+' planks at the lumberyard · '+money(planks*PIECE_PAY.delivered),run:()=>{unloadAtDock(id);return {}}});
 if(timberValue(c)&&onRidgeline()&&inLumberyard(f.state))rows.push({bulk:true,label:'Deliver '+cargoText((c||[]).filter(p=>p.k==='slab'))+' to the lumberyard · '+money(timberValue(c)),run:()=>{deliverSlabsAtDock(id);return {}}}); // quest rework: slabs only, no trunk sale
 if(planks&&truckWaiting(GameState.progress)&&Math.hypot(f.state.x-TRUCK_BAY.x,f.state.z-TRUCK_BAY.z)<25){const t=truckOf(GameState.progress);if(t.loaded<t.order)rows.push({bulk:true,label:'Move planks to the customer\'s truck · '+t.loaded+' / '+t.order,run:()=>{custFromBed(id);return {}}})}
 return rows}
function takeKind(id,kind){const f=driving.byId.get(id);if(!f)return;if(kind==='crate'&&runCrates(id)){toast(runCrates(id)+'.');return}const r=unloadKind(GameState.progress.carry,driving.cargoOf(id),f.spec.model,kind);if(r.error){toast(r.error);return}driving.setCargo(id,r.cargo);GameState.progress={...GameState.progress,carry:r.carry};stowTool();persist();toast(r.message)}
function toggleGate(id){const open=driving.toggleGate(id);if(open===null)return;audio.click(me.position,listenerAt());toast(open?'Tailgate open: load or unload, H closes it.':'Tailgate closed.')}
const TAKE_ROW={trunk:'Take a trunk (heavy: slow walk)',slab:'Take a slab',log:'Take a log',planks:'Take planks',crate:'Take a crate (heavy: slow walk)',parcel:'Take the parcel',box:'Take a box'},TAKE_OFF={trunk:'Take a trunk off the ',slab:'Take a slab off the ',log:'Take a log off the ',planks:'Take planks off the ',crate:'Take a crate off the ',parcel:'Take the parcel off the ',box:'Take a box off the '},LOAD_ONTO={trunk:'Load the trunk onto the ',slab:'Load the slab onto the ',log:'Load the log onto the ',planks:'Load the planks onto the ',crate:'Load the crate onto the ',parcel:'Load the parcel onto the ',box:'Load the box onto the '};
// C-B: crates of a running delivery (a need run's truck, the story's egg crates on the loan truck) are put back on the deck every frame (syncNeedCargo, syncStoryCargo), so taking one by hand would copy it: they stay until the hand-over. '' = free to take.
function runCrates(id){const p=GameState.progress,a=p.gigs?.active,s=p.starter;if(a?.needId&&a.truck===id&&a.haul>0)return 'These crates are for '+keeperName(a)+': hand them over at the door';if(s&&!s.done&&s.step===4&&s.loaded&&s.loanUid===id)return 'These egg crates are for Noah: hand them over at the market';return ''}
function openCargo(id){const f=driving.byId.get(id);if(f)cargoUI.open(f.spec.name+' · '+cargoText(driving.cargoOf(id)),()=>cargoRows(id))}
let marksPlots=null,marksDay=0;
function syncMarks(){piles.setPlanks(stockOf(GameState.progress).planks);const p=GameState.progress,on=!!p.shift&&p.shift.employer==='ridgeline';treeMarks.setVisible(on);landingRing.visible=false;if(!on){marksPlots=null;return}
 if(p.plots===marksPlots&&p.shift.day===marksDay)return;marksPlots=p.plots;marksDay=p.shift.day;
 treeMarks.set(worldLayout().cuttable.filter(t=>isMarked(t,marksDay)&&plotAt(p,t.key).tree==='pine'))}
function loadOntoBed(id){const f=driving.byId.get(id);if(!f)return;const r=loadCarry(GameState.progress.carry,driving.cargoOf(id),f.spec.model);if(r.error){toast(r.error);return}driving.setCargo(id,r.cargo);GameState.progress={...GameState.progress,carry:r.carry};persist();toast(r.message)}
function takeOffBed(id){const f=driving.byId.get(id);if(!f)return;{const c0=driving.cargoOf(id)||[];let i=c0.length-1;while(i>=0&&c0[i].o)i--;if(i>=0&&c0[i].k==='crate'&&runCrates(id)){toast(runCrates(id)+'.');return}}const r=unloadOne(GameState.progress.carry,driving.cargoOf(id),f.spec.model);if(r.error){toast(r.error);return}driving.setCargo(id,r.cargo);GameState.progress={...GameState.progress,carry:r.carry};stowTool();persist();toast(r.message)}
// The warehouse (4.16): the delivery pile inside is the company's yard stock; E takes a stack of planks from it, E at a rack bay puts it in (a full bay is a rack for the Stack task).
// Company actions (DESIGN 4.16 G, the co-op seam): every change to the company's tickets goes through here as plain data {type, ...}. Offline it runs the pure rule from tickets.js on the local
// save at once and applies the effects (piece pay, reputation) to this player; in co-op the same call will go to the authority and its answer will be applied the same way. The player is 'me' offline.
const COMPANY_RULES={take:takeTicket,stage:stagePlanks,stagePallet:stagePallet,ship:shipTicket,load:loadTicket,deliver:deliverTicket};
const absoluteNow=p=>Math.floor((p.housing.day-1)*1440+p.routine.minutes);
function applyCompany(action){
 const p=GameState.progress,id='ridgeline',co=p.companies?.[id]||{},rank=careerOf(p,id).rank,base={playerId:'me',rank,now:absoluteNow(p)},act={...base,...action};let r;
 if(action.type==='releaseOrder')r={...releaseOrderPallet(co,act.id),effects:[]}; // a failed order's pallet leaves wherever it is: no shift needed
 else if(action.type==='restock')r=returnPlanks(co,act.planks); // planks coming back from a failed order: no shift needed
 else if(action.type==='supply')r=tickSupply(co,{now:act.now,carried:p.carry?.kind==='planks'?p.carry.count:0,yard:p.sawmillYard}); // the crew's delivery runs with the clock, shift or not; W3: from the lumberyard stock, then the sawmill yard (no free planks)
 else if(action.type==='workforceTicket')r=workforceTicketStep(co,{now:act.now}); // W3: an order nobody touched for 3 game hours is slowly staged by the crew from the racks ($0, no rep for anyone)
 else if(action.type==='tick'){const on=p.shift?.employer===id;r=tickTickets(co,{now:act.now,release:on&&rank>=4,clockedOut:on?[]:[act.playerId]})}
 else{const rule=COMPANY_RULES[action.type];if(!rule)return {error:'Unknown company action.'};if(p.shift?.employer!==id)return {error:'Clock in to work orders for Ridgeline Timber.'};r=rule(co,act)}
 if(r.error)return {error:r.error};
 let next=r.company===co?p:{...p,companies:{...(p.companies||{}),[id]:r.company}};
 if(r.yard)next={...next,sawmillYard:r.yard,belt:beltOf({sawmillYard:r.yard})}; // W3: the crew's supply took planks out of the sawmill yard
 for(const e of r.effects||[])if(e.playerId===act.playerId){if(e.piece)next=recordPiece(next,e.piece,1).state;if(e.rep)next=changeRep(next,id,e.rep)}
 if(action.type==='deliver'&&Number.isSafeInteger(act.payCents))next=plankDeliveryPaid(next,act.payCents); // P-D: paid by the plank price for the planks that really moved, not the flat piece
 if(next!==p){GameState.progress=next;persist()}
 return {...r,message:r.message||''};
}
// P-D (notes/planks-economy-design.md, plank-delivery.js): a delivered order pays now, in whole dollars, by the plank price at the warehouse for the planks that came off the bed; the flat 'deliveries' piece is taken back off the shift (its task still counts)
function plankDeliveryPaid(p,cents){const sh=p.shift,n=(sh?.pieces?.deliveries||0)-1,pieces=sh?{...sh.pieces}:null;if(pieces){if(n>0)pieces.deliveries=n;else delete pieces.deliveries}return {...p,...(sh?{shift:{...sh,pieces}}:{}),cash:p.cash+cents,routine:{...p.routine,earned:(p.routine?.earned||0)+cents}}}
const plankPay=(p,planks)=>deliveryPay(planks,priceTable(p.world,(p.housing?.day||1)-1,p.routine?.minutes),{placeKey:'warehouse'});
// What the warehouse card says: what to do next, from the stock, the orders and the crew's delivery (supply.js)
function warehouseHint(){const pr=GameState.progress,co=pr.companies?.ridgeline,rank=careerOf(pr,'ridgeline').rank,held=totalPlanks(co),sup=supplyOf(co),taken=ticketsOf(co).list.filter(k=>k.status==='taken'),open=openTickets(co).length;
 if(!onRidgeline())return 'Clock in at the time clock (or on the phone) to work here. Open 6 AM–6 PM.';if(rank<4)return 'The warehouse is for Yard hands (rank 4). Keep earning XP in the forest and at the sawmill.';
 const lines=[];if(taken.length)lines.push('You have '+taken.length+(taken.length>1?' orders':' order')+' to fill: take planks from a pallet in the racks, set them on the order’s pallet, then load the customer’s truck at the loading door.');else if(open)lines.push('Orders are on the table: go there (front left) and take one.');else lines.push('No orders yet: new ones come to the table through the day (from 7 AM).');
 if(sup)lines.push('A Ridgeline crew is bringing '+sup.planks+' planks for the racks by '+formatClock(sup.at%1440)+'.');else if(!held)lines.push('The racks are empty: when an order needs planks the crew brings what the lumberyard and the sawmill yard hold.');else lines.push(held+' planks on pallets in the racks. Every pallet shows what it holds. The upper shelves need the forklift.');
 return lines.join(' ')}
const orderLine=(k,now)=>`#${k.id} · ${k.customer} · ${k.planks} planks · ${k.kind==='pickup'?'pickup':'delivery'} ${dueText(k,now)}`;
// 0.5 s: release, expire and fail tickets (only a Yard hand or better has them); a new one shakes the phone
function tickCompany(){
 const p=GameState.progress;if(!careerOf(p,'ridgeline').hired||careerOf(p,'ridgeline').rank<4)return;
 const sup=applyCompany({type:'supply'});if(!sup.error){const at=absoluteNow(GameState.progress);if(sup.delivered){notifyPhone('jobs',sup.message);syncWarehouse()}else if(sup.scheduled)notifyPhone('jobs','Ridgeline’s crew is bringing '+sup.scheduled.planks+' planks to the warehouse by '+formatClock(sup.scheduled.at%1440)+'.')}
 const r=applyCompany({type:'tick'});if(r.error)return;const now=absoluteNow(GameState.progress);
 if(r.released?.length)notifyPhone('jobs','New order '+r.released.map(k=>orderLine(k,now)).join(' · '));
 {let back=0;for(const k of r.expired||[])if(k.staged>0){const rel=applyCompany({type:'releaseOrder',id:k.id}),n=rel.planks||k.staged;if(n>0&&!applyCompany({type:'restock',planks:n}).error)back+=n}if(back){updateFork();syncWarehouse()}} // W3: planks the crew had staged on an order nobody took go back to the racks when it expires
 {const w=applyCompany({type:'workforceTicket'});if(!w.error&&w.staged){syncWarehouse();if(w.completed?.length)notifyPhone('jobs','Ridgeline’s crew filled order '+w.completed.map(id=>'#'+id).join(', ')+' from the racks. Nobody took it for 3 hours, so it pays nothing.')}} // W3: untouched orders are slowly staged by the crew (workforce-tick.js)
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
 const rank=careerOf(pr,'ridgeline').rank,card=orderCard(k,{now:absoluteNow(pr),rank,ranks:employerById('ridgeline').ranks,company:co,priceTable:priceTable(pr.world,(pr.housing?.day||1)-1,pr.routine?.minutes)}),back={label:'Go back',run:()=>orderTable()};
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
const fork={on:false,where:'inside',state:forklift.fresh()};let forkView=null,forkGuide=null,forkLoading=false,forkHips=.95;const FORK_SIT=-.04; // fork.where: 'inside' (the hall, room metres) or 'outside' (the apron, world metres: through the roller door, DESIGN 4.16 J step 2).  // forkHips: your hips' height when standing (measured as you get on); FORK_SIT: hip joint above the cushion
function loadForklift(room){if(forkView||forkLoading)return;forkLoading=true;Promise.all([import('./forklift-view.js'),import('./fork-guide-view.js')]).then(([m,g])=>{forkView=m.buildForklift();room.scene.add(forkView.group);forkGuide=g.createForkGuide();room.scene.add(forkGuide.group);updateFork()})}
function updatePalletTags(){const o=shop&&officeByKey(shop);if(!o||o.kind!=='warehouse'||!o.room.updateTags)return;const extra=[],fl=forkLoadOf(GameState.progress);if(fl>0&&forkView){const at=forklift.toWorld(fork.state,0,fp.CARRY_Z);extra.push({x:at.x,y:forkView.topY+.25,z:at.z,count:fl,product:'planks',order:palletsOf(GameState.progress.companies?.ridgeline).find(q=>q.at.fork)?.order||0})}o.room.updateTags(camera,{x:me.position.x,z:me.position.z},extra)} // the tags above the pallets (pallet-tags.js), the one on the forks too
function updateFork(){if(forkView)forkView.set(fork.state,forkLoadOf(GameState.progress))}
const forkBlocks=(x,z)=>{if(fork.on||!forkView||(fork.where==='outside')!==!shop)return false;const s=fork.state,dx=x-s.x,dz=z-s.z,c=Math.cos(s.yaw),n=Math.sin(s.yaw);return Math.abs(dx*c-dz*n)<.85&&Math.abs(dx*n+dz*c)<1.9} // a parked forklift is solid to a walker
function getOnFork(){const pr=GameState.progress;if(!onRidgeline()||careerOf(pr,'ridgeline').rank<4){toast('The forklift is for Ridgeline Yard hands (rank 4) and up, on shift.');return}if(pr.carry||parcelHeld(pr)){toast(pr.carry?'Put down what you are carrying first.':PARCEL_HANDS);return}
 stowTool();{player.updateMatrixWorld(true);const h=avatar.bone?.('Hips');if(h){const v=new THREE.Vector3(),o=new THREE.Vector3();h.getWorldPosition(v);player.getWorldPosition(o);if(v.y-o.y>.6&&v.y-o.y<1.3)forkHips=v.y-o.y}}fork.on=true;fork.state={...fork.state,speed:0};keys.clear();toast('On the forklift: the controls are in the vehicle panel')}
// Seated at the wheel: the thighs forward (character.js seated pose) and both hands on the steering wheel (forklift-local (±0.14, 1.5, -0.21), turned into the character's own frame)
const forkHand={R:new THREE.Vector3(),L:new THREE.Vector3()};
let cabHeld=false;const cabHand=new THREE.Vector3(),cabRim=new THREE.Vector3(),cabZ=new THREE.Vector3(0,0,1);function updateCabPose(){const s=driving.seatedAt();avatar.setSeated(!!s);const rh=s&&s.driver?driving.riderHands(forkHips):null;if(rh){for(const [sd,p] of rh){avatar.reach(sd,cabHand.set(p.x,p.y,p.z),1);avatar.setHandCurl(sd,.8)}avatar.setLean(driving.active.mesh.userData.grip.lean);cabHeld=true}else if(s&&s.driver){const m=driving.active.mesh.userData,sw=m.steeringWheel,a=m.seats.driver,g=m.grip;for(const [side,k] of [['R',-1],['L',1]]){cabRim.set(Math.sin(k*g.angle)*g.radius,Math.cos(k*g.angle)*g.radius,0).applyAxisAngle(cabZ,sw.rotation.z);avatar.reach(side,cabHand.set(sw.position.x+cabRim.x-a[0],sw.position.y+cabRim.y-(a[1]-forkHips),sw.position.z-g.back-(a[2]+g.hips)),1);avatar.setHandCurl(side,.8)}avatar.setLean(g.lean);cabHeld=true}else if(cabHeld){cabHeld=false;avatar.clearReach();avatar.setLean(0);avatar.setHandCurl('R',0);avatar.setHandCurl('L',0)}} // seated in the shortbed: both hands on the steering wheel (reach targets are in the player's own frame, which here is the truck's)
function updateForkPose(){if(!fork.on){updateCabPose();return}avatar.setSeated(true);const y=1.5-(forklift.SEAT_TOP+FORK_SIT-forkHips),z=-.21-forklift.SEAT.z;forkHand.R.set(-.14,y,z);forkHand.L.set(.14,y,z);avatar.reach('R',forkHand.R,1);avatar.reach('L',forkHand.L,1);avatar.setHandCurl('R',.8);avatar.setHandCurl('L',.8)}
function getOffFork(){const s=fork.state;fork.on=false;avatar.setSeated(false);avatar.clearReach();avatar.setHandCurl('R',0);avatar.setHandCurl('L',0);fork.state={...s,speed:0};const spot=[[-1.45,0],[1.45,0],[0,-2.3],[-1.9,-1.4],[1.9,-1.4]].map(([x,z])=>forklift.toWorld(s,x,z)).find(p=>!blocked(p.x,p.z))||forklift.seatOf(s);placeSafely(spot.x,.02,spot.z);keys.clear();updateFork()}
// Physical forks (DESIGN 4.16 I, step 2): there is no E to lift or set a pallet down. The forks go into a pallet's pocket (fork-pallets.js), raising them lifts it, and lowering a carried pallet onto a free shelf
// cell, the floor or an order's staging square sets it down there (a pallet set on an order's square gives the order its planks). The panel says why the forks are stopped.
let forkListKey=null,forkBoxes=[],forkCells=new Set(),forkLock=null; // forkLock: a set-down that was refused or used up, held until the forks rise again so it is not tried every frame
function forkCtx(){
 const o=shop&&officeByKey(shop),co=GameState.progress.companies?.ridgeline,list=palletsOf(co);
 if(list!==forkListKey){forkListKey=list;forkBoxes=fp.boxesOf(list);forkCells=new Set(list.filter(q=>q.at.rack).map(q=>q.at.rack))}
 const slots=stagingOf(co),held=list.find(q=>q.at.fork),carriedOrder=held?.order||0;
 return {outdoors:!o,zoneNote,boxes:o?forkBoxes:[],carried:forkLoadOf(GameState.progress),carriedOrder,stagingTop:i=>{const q=list.find(x=>x.at.staging===i);return q&&!carriedOrder?fp.heightOf(q.count):0},stagingNote:i=>carriedOrder?'That is not this order\u2019s square.':slots[i]?'That order is already staged.':'No order is waiting on that square.',cellOf:slot=>RACK_SLOTS.find(c=>c.id===slot),blockedOther:(x,z)=>o?o.room.blockedOther(x,z):forkBlockedFn(x,z),solidAt:(x,z)=>o?o.room.solidAt(x,z):forkBlockedFn(x,z),occupied:slot=>!o||forkCells.has(slot),stagingTaken:i=>{const k=slots[i];if(!k)return false;return carriedOrder?k.id===carriedOrder:k.status==='taken'}}
}
function forkCompany(company,message){const pr=GameState.progress;GameState.progress={...pr,companies:{...(pr.companies||{}),ridgeline:company}};persist();syncWarehouse();updateFork();if(message)toast(message)}
function stageFromForks(id){const r=applyCompany({type:'stagePallet',id});if(r.error)return r;if(r.surplus>0){const back=applyCompany({type:'restock',planks:r.surplus});r.message+=' The other '+r.surplus+' planks went '+(back.error?'nowhere':back.toStock&&!back.placed?'to the lumberyard':'back to the racks')+'.'}persist();syncWarehouse();updateFork();return r}
// after each drive step: lift a pallet the tines are in and raised, or set down the one the forks carry when it meets what is under it
// the guide: what to do next (a line in the panel) and the markers in the room (fork-guide.js, fork-guide-view.js)
let forkClock=0;
function forkGuideTick(ctx,dt){
 if(!forkGuide)return;forkClock+=dt;if(fork.on&&fork.where==='outside'&&ctx){fork.goal=ctx.carriedOrder?(zoneNote()||'Lower the order pallet onto the green loading zone to load the truck.'):ctx.carried>0?'Take the pallet back inside: only an order pallet loads here.':'';forkGuide.update(null,null);return}if(!fork.on){forkGuide.update(null,null);return}
 const g=forkGoal({carried:ctx.carried,carriedOrder:ctx.carriedOrder,boxes:ctx.boxes,staging:stagingOf(GameState.progress.companies?.ridgeline),pos:fork.state});fork.goal=g.text;forkGuide.update(g.target,forkGhost(fork.state,ctx),forkClock)
}
function forkTick(ctx,raise){
 const s=fork.state,co=GameState.progress.companies?.ridgeline;fork.hint=fp.forkHint(s,ctx);if(fork.where==='outside'){const a=forklift.toWorld(s,0,forklift.TIP+.6);if(!inYard(a.x,a.z)&&!(passable(dockDoor)&&inDoorwayOut(a.x,a.z)))fork.hint='The forklift stays in the yard.'}
 if(ctx.carried>0){
  const r=fp.settles(s,ctx);if(!r){forkLock=null;return}
  const key=r.kind+':'+(r.slot||r.index||'');if(raise>=0||forkLock===key)return;forkLock=key;
  if(!onRidgeline()){toast('Clock in to work the forklift for Ridgeline Timber.');return}
  if(r.kind==='rack'){const n=forkLoadOf(GameState.progress),res=setPallet(co,{rack:r.slot});if(res.placed)forkCompany(res.company,'Set the pallet in rack '+r.slot+' · '+n+' planks.');else toast(res.error)}
  else if(r.kind==='floor'){const n=forkLoadOf(GameState.progress),res=setPallet(co,{floor:{x:r.x,z:r.z,yaw:r.yaw}});if(res.placed)forkCompany(res.company,'Set the pallet down · '+n+' planks.');else toast(res.error)}
  else if(r.kind==='zone')loadAtZone();
  else if(r.kind==='staging'){const k=stagingOf(co)[r.index],res=k&&stageFromForks(k.id);if(res)toast(res.error||res.message)}
  return;
 }
 forkLock=null;
 const b=fp.liftsNow(s,ctx.boxes);
 if(b){if(!onRidgeline()){toast('Clock in to work the forklift for Ridgeline Timber.');return}const res=liftPallet(co,b.id);if(res.lifted)forkCompany(res.company,'Lifted a pallet · '+res.lifted+' planks.')}
}
// E on the forklift only gets you off (and only when it is nearly stopped)
// The roller door and the way through it (dock.js): the panels roll up when the driven forklift is near, it crosses between the hall and the apron with a short fade (same forklift, half a turn about the door), and outside it stays on the apron.
const zonePaint=new THREE.Mesh(new THREE.PlaneGeometry(ZONE.hx*2,ZONE.hz*2),new THREE.MeshBasicMaterial({color:'#3fae5a',transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-16,polygonOffsetUnits:-32}));zonePaint.renderOrder=2;zonePaint.name='loading-zone';zonePaint.rotation.x=-Math.PI/2;zonePaint.position.set(ZONE.x,.03,ZONE.z);scene.add(zonePaint); // the loading zone, painted on the apron
const dockOut=createDockPanel();dockOut.position.set(OUT.x,2.15,OUT.wall-.04);scene.add(dockOut);let dockDoor=freshDoor(),dockShown=-1,forkCrossing=false;
const forkBlockedFn=(x,z)=>fork.where==='outside'?(passable(dockDoor)&&inDoorwayOut(x,z)?false:(!inYard(x,z)||blocked(x,z))):blocked(x,z); // outdoors the apron only
function updateDock(dt){
 const o=offices.find(x=>x.kind==='warehouse'),near=fork.on&&nearDoor(fork.where,fork.state),next=stepDoor(dockDoor,{near,dt});
 if(next===dockDoor&&dockShown===(fork.on?1:0))return;dockDoor=next;dockShown=fork.on?1:0;
 dockOut.scale.y=Math.max(.04,1-dockDoor.t*.96);dockOut.visible=dockDoor.t<.995;if(o)o.room.setDock(dockDoor.t,fork.on&&fork.where==='inside');
}
function forkCrossCheck(){
 if(forkCrossing||doorFade)return;const open=passable(dockDoor),s=fork.state;
 if(fork.where==='inside'&&crossesOut(s,open)||fork.where==='outside'&&crossesIn(s,open)){const dir=fork.where==='inside'?'out':'in';forkCrossing=true;doorFade={t:0,phase:'out',action:()=>{forkCross(dir);forkCrossing=false}}}
}
function forkCross(dir){
 const o=offices.find(x=>x.kind==='warehouse');if(!o||!fork.on)return;
 if(dir==='out'){fork.state=toOutside(fork.state);fork.where='outside';for(const mesh of o.room.occluders){mesh.material.opacity=1;mesh.material.depthWrite=true}o.room.scene.visible=false;shop=null;scene.add(player);if(forkView)scene.add(forkView.group);
  const seat=forklift.seatOf(fork.state);setMePosition(seat.x,.02,seat.z);me.rotation.y=fork.state.yaw;yaw=0;pitch=.4;camera.position.set(seat.x,3,seat.z+7)}
 else{fork.state=toInside(fork.state);fork.where='inside';enterOffice(o);if(forkView)o.room.scene.add(forkView.group);
  const seat=forklift.seatOf(fork.state);setMePosition(seat.x,.02,seat.z);me.rotation.y=fork.state.yaw;yaw=0}
 updateFork();
}
function forkOffers(add){const s=fork.state,here={x:me.position.x,z:me.position.z},at=()=>worldPoint({x:me.position.x,y:2,z:me.position.z});add('fork-off',here,at,Math.abs(s.speed)<.6?'Get off the forklift':'Stop to get off',()=>{if(Math.abs(fork.state.speed)<.6)getOffFork()},9)}
// Delivery orders (4.16 C): a staged delivery is loaded through the loading door onto a truck with a bed parked within 16 m of the dock (yours or the company's), driven to the house, and unloaded at its drop spot.
const ridgelineTickets=()=>ticketsOf(GameState.progress.companies?.ridgeline).list;
const deliveryBed=k=>driving.bedsWithin(ZONE.x,ZONE.z,9).find(b=>!addPlanks(b.cargo,b.model,k.planks).error)||null;
// The loading zone (D3): an order's complete pallet lowered onto the green zone in front of the roller door loads itself onto the waiting truck (a pickup: the customer's flatbed; a delivery: any stopped truck with a bed beside the zone).
// Why it cannot yet is the forklift panel's note (fork-pallets.js restingOn). The pallet is consumed from the forks (tickets.js zone).
function zoneNote(){
 const co=GameState.progress.companies?.ridgeline,held=palletsOf(co).find(q=>q.at.fork);if(!held?.order)return 'Only an order\u2019s pallet goes on the loading zone.';
 const k=ridgelineTickets().find(t=>t.id===held.order);if(!k||k.status!=='staged')return `Order #${held.order} is not complete (${k?k.staged:0} of ${k?k.planks:'?'} planks).`;
 if(k.kind==='pickup')return dockTruck.parked()?'':'The customer\u2019s truck has not arrived yet.';
 return deliveryBed(k)?'':bedRefusal(k);
}
function loadAtZone(){
 const co=GameState.progress.companies?.ridgeline,held=palletsOf(co).find(q=>q.at.fork&&q.order),k=held&&ridgelineTickets().find(t=>t.id===held.order);if(!k)return;
 if(k.kind==='pickup'){const r=applyCompany({type:'ship',id:k.id,zone:true});if(r.error){toast(r.error);return}dockGoing=k.planks;audio.sweep('coins-pay');notifyPhone('jobs',r.message+' Paid '+money(PIECE_PAY.orders)+'.')}
 else loadDelivery(k.id);
 syncWarehouse();updateFork();persist();
}
function loadDelivery(id){const k=ridgelineTickets().find(t=>t.id===id),bed=k&&deliveryBed(k);if(!bed){toast(k?bedRefusal(k):'Park a truck with a bed beside the loading zone first.');return}
 const r=applyCompany({type:'load',id,vehicle:bed.id,zone:true});if(r.error){toast(r.error);return}driving.setCargo(bed.id,addPlanks(bed.cargo,bed.model,k.planks,k.id).cargo);syncWarehouse();persist();toast(r.message+' It is marked on your task list: '+destinationName(k.dest)+'. It pays '+money(plankPay(GameState.progress,k.planks).payCents)+' on delivery.');setFocus('ticket:'+k.id)}
// P-D: why no truck by the zone can take this order (plank-delivery.js refusalReason; the bed's model decides how many planks one run carries)
function bedRefusal(k){const near=driving.bedsWithin(ZONE.x,ZONE.z,9);if(!near.length)return 'Park a truck with a bed beside the loading zone first.';const b=near[0],why=refusalReason({model:b.model,cargo:b.cargo},{planks:k.planks,status:'staged'})||'The bed is full.';return why+(why.startsWith('The order does not fit')?' The '+b.name+' carries '+bedCapacity(b.model)+' planks; order #'+k.id+' is '+k.planks+'.':'')} // the planks are tagged with the order (cargo.js): they cannot be sold or taken off anywhere but at the address
function deliverOrder(id){const k=ridgelineTickets().find(t=>t.id===id),d=k&&dropSpot(k.dest),f=k&&driving.byId.get(k.vehicle);
 if(!f||!f.present||Math.hypot(f.state.x-d.x,f.state.z-d.z)>30){toast('Bring the truck with the order here first.');return}
 const bed=driving.cargoOf(k.vehicle),tagged=removeOrderPlanks(bed,k.id),off=tagged.count>=k.planks?{cargo:tagged.cargo}:removePlanks(bed,k.planks); // a save from before the tag has planks without it
 if(off.error){toast(off.error);return}
 const moved=Math.max(0,Math.min(k.planks,countOf(bed,'planks')-countOf(off.cargo,'planks'))),pay=plankPay(GameState.progress,moved); // P-D: pay only for the planks that really came off the bed
 const r=applyCompany({type:'deliver',id,dest:k.dest,payCents:pay.payCents});if(r.error){toast(r.error);return}driving.setCargo(k.vehicle,off.cargo);persist();audio.sweep('coins-pay');notifyPhone('jobs',r.message+' Paid '+money(pay.payCents)+' ('+moved+' planks at '+money(pay.unitPayCents)+').')}
function stackAtRack(slot){const r=stackPlanks(GameState.progress,slot);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();syncWarehouse();toast(r.message)}
function takeFromPile(){const r=takeLogFromPile(GameState.progress,me.position);if(r.error){toast(r.error);return}GameState.progress=r.state;stowTool();persist();syncMarks();toast(r.message)}
function deliverByHand(){const c=GameState.progress.carry;if(c?.kind!=='planks')return;const r=deliverPlanks({...GameState.progress,carry:null},c.count);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();syncMarks();toast(r.message)}
function unloadAtDock(id){const t=takeAll(driving.cargoOf(id),'planks'),r=deliverPlanks(GameState.progress,t.count);if(r.error){toast(r.error);return}driving.setCargo(id,t.cargo);GameState.progress=r.state;persist();syncMarks();toast(r.message)}
function stackAtLanding(){const c=GameState.progress.carry,two=c?.kind==='log'&&c.count===2;let r=stackLog(two?{...GameState.progress,carry:{kind:'log'}}:GameState.progress,me.position);if(r.error){toast(r.error);return}if(two){const r2=stackLog({...r.state,carry:{kind:'log'}},me.position);if(!r2.error)r=r2}GameState.progress=r.state;persist();toast(r.message)} // T-E: two logs on the shoulder are stacked as two
const officeOpen=o=>{const h=employerById(o.employer).hours,m=GameState.progress.routine.minutes;return m>=h.from&&m<h.to};
// Shop fronts: sliding doors that open as you walk up (only while the shop is open) and an OPEN / CLOSED sign.
const shopDoors=Object.entries(SHOPS).filter(([kind])=>kind!==WHOLESALE_ID).map(([kind,shopInfo])=>{
 const spec=MAP.shops[kind],door=createSlidingDoor(spec.door);door.group.position.set(shopInfo.x,0,spec.doorZ);scene.add(door.group);
 const open=label('OPEN',shopInfo.x+1.95,1.55,spec.doorZ+.02,.95,0,'#2d6a4f','#f4f9ef',.32),closed=label('CLOSED',shopInfo.x+1.95,1.55,spec.doorZ+.02,.95,0,'#8a2b2b','#fbeaea',.32);
 const dw=spec.doorway,blocker={x:shopInfo.x,z:dw.blocker.z,hx:dw.halfWidth,hz:dw.blocker.depth,door:true};colliders.push(blocker); // shuts the doorway while the door is closed (door: npcStaticBlocked skips it, it comes and goes)
 colliders.push({x:shopInfo.x,z:dw.backWall.z,hx:dw.halfWidth,hz:dw.backWall.depth}); // the back of the doorway: you can step up to the threshold but never walk on into the building
 return {kind,x:shopInfo.x,door,open,closed,blocker};
});
for(const o of offices)SHOPS[o.id]={name:o.name||MAP.properties.find(p=>p.id===o.id)?.name||o.id,x:o.door.x,z:o.door.z}; // after the street shop doors are built: those loop over SHOPS, an office has no storefront
const indoorCamera=createIndoorCamera(camera,apartment.occluders);
// Where you are when you are indoors in a home: the studio (apartment.js) or a house (interiors.js, built the first time you go in). Each has its scene, bed, kitchen, door and camera.
const studioHome={kind:'studio',room:apartment,BED,ENTRY,EXIT,KITCHEN:{x:3,z:-3.5},camera:indoorCamera};let home=studioHome;const houseHomes=new Map();
// PET3: the cat (pets.js rules, pet-view.js clips/wander/snapshot, pet-actor.js model: one SkinnedMesh sharing the GLB's geometry). It lives in the room scene of its home and is hidden anywhere else; a co-op visitor's cat is a second actor made only when one is seen.
const catActor=createPetActor({THREE,GLTFLoader}),catGo={x:0,z:0,yaw:0,clip:'idle',loop:true,speed:1},catVisit={x:0,z:0,yaw:0,clip:'idle',speed:1},catNow={min:-1,cmin:-1,home:null,box:null,step:0,wp:null,asked:false,shown:'idle',meowAt:-1e9,greet:-1,input:null,visit:null};catActor.visible=false;if(globalThis.document?.baseURI)catActor.load().catch(e=>console.warn('Cat model missing: dist/assets/pets/cat.glb',e)); // tests (no baseURI) skip the load: the group still moves, nothing is drawn
function houseHome(id){let h=houseHomes.get(id);if(h)return h;const property=propertyById(id),landmark=MAP.landmarks.find(l=>l.id===property.landmark),room=buildHouseRoom(landmark.prop),door=doorOf(property);
 h={kind:'house',id,name:property.name,room,BED:room.BED,BED_FLOOR:room.BED_FLOOR,ENTRY:room.ENTRY,EXIT:room.EXIT,KITCHEN:room.KITCHEN,STAIRS:room.STAIRS,outside:{x:door.x+door.faceX*1.8,z:door.z+door.faceZ*1.8,yaw:Math.atan2(-door.faceX,-door.faceZ)},camera:createIndoorCamera(camera,room.occluders)};houseHomes.set(id,h);return h}
const savedCharacter=loadAppearance({getItem:key=>localStorage.getItem(key)});
const avatar=createCharacter(savedCharacter||defaults),player=avatar.group;player.name='player';scene.add(player);
// Carried things (carry.js): a log on the right shoulder (the ground logs' own mesh), or a stack of planks (the model's own plank mesh, about half size so it fits the avatar).
const groundLogs=scene.getObjectByName('ground-logs'),carryLog=new THREE.Group(),carryLogMesh=new THREE.Mesh(groundLogs.geometry,groundLogs.material);carryLogMesh.rotation.y=Math.PI/2;carryLog.add(carryLogMesh);carryLog.position.set(-.2,1.5,.05);carryLog.rotation.x=-.12;carryLog.visible=false;carryLog.name='carried-log';player.add(carryLog);
// W4 (crew timber): the trunk a Ridgeline feller is bucking and the logs cut from it lie on the ground while the feller is drawn (npc-crowd.js forEachWork: a function of the clock, the same on every co-op client).
// They go into the player's own meshes after the player's pieces (ground-trunks; world.js ground-logs, whose setLogs is wrapped so the crew's logs are put back after it): no new mesh, no new draw call.
const crewTimber={sig:NaN,trunks:0,logs:groundLogs.count,nt:0,nl:0,t:new Float64Array(12),l:new Float64Array(24)},CREW_ALONG=.6;{const own=world.setLogs.bind(world);world.setLogs=list=>{own(list);crewTimber.logs=groundLogs.count;crewTimber.sig=NaN}}
// T-E (timber redesign): the owner's timber models (dist/assets/timber: trunk, logs2 = two logs, slab; not in props-assets.js) are loaded once with GLTFLoader. Carried, they ride on the shoulder in the log's place (the carried-log group);
// on the ground and at the saw they are InstancedMeshes (syncTimber): ground-trunks, yard-trunks (the waiting trunks, in the sawmill's own group like yard-logs) and yard-slabs (the yard's slab pile AND the slabs put down, one mesh): 3 draw calls at most.
// A model that fails to load is simply not drawn; the console names the missing file. Tests (no document.baseURI) skip the load.
const TIMBER={},carryTimber={},TIMBER_M=new THREE.Matrix4(),TIMBER_Q=new THREE.Quaternion(),TIMBER_P=new THREE.Vector3(),TIMBER_S=new THREE.Vector3(1,1,1),TIMBER_UP=new THREE.Vector3(0,1,0),tFor={logs:null,pend:-1,drops:null,yt:-1,ys:-1,host:null,parts:0};let groundTrunks=null,yardTrunks=null,slabMesh=null,timberBoxes=[];
if(globalThis.document?.baseURI)Promise.all(['trunk','logs2','slab'].map(n=>new GLTFLoader().loadAsync(new URL('assets/timber/'+n+'.glb',document.baseURI).href).then(g=>{let mesh=null;g.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o});if(!mesh)throw new Error('no mesh in the file');TIMBER[n]={geometry:mesh.geometry,material:mesh.material}}).catch(e=>console.warn('Timber model missing: dist/assets/timber/'+n+'.glb',e)))).then(timberLoaded);
import {POSE as WHOLESALE_POSE,splitTriangles as edenSplit,glowAt as edenGlowAt,WINDOW_GLOW as EDEN_WINDOW} from './eden-wholesale-place.js';const edenLit={win:null,lamp:null,key:-1};{const eden=scene.getObjectByName('prop-eden-wholesale');if(eden&&globalThis.document?.baseURI)new GLTFLoader().loadAsync(new URL(eden.userData.model,document.baseURI).href).then(g=>{let mesh=null;g.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o});if(!mesh)throw new Error('no mesh in the file');const geo=mesh.geometry,glow=mesh.userData.glow||null,col=geo.attributes.color,s=edenSplit(geo.index.array,col.array,col.itemSize,glow);geo.setIndex(new THREE.BufferAttribute(s.index,1));geo.clearGroups();for(const gr of s.groups)geo.addGroup(gr.start,gr.count,gr.material);const lens=new THREE.Color().setRGB(...(glow?.color||[255,226,168]).map(v=>v/255),THREE.SRGBColorSpace);const body=eden.userData.fade.apply(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,shadowSide:THREE.FrontSide})),win=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.4,shadowSide:THREE.FrontSide,emissive:new THREE.Color(EDEN_WINDOW.colour),emissiveIntensity:0}),lamp=new THREE.MeshStandardMaterial({color:lens,emissive:lens,emissiveIntensity:.15,roughness:.5,shadowSide:THREE.FrontSide});const m=new THREE.Mesh(geo,[body,win,lamp]);m.name='eden-wholesale-model';m.castShadow=m.receiveShadow=true;eden.add(m);edenLit.win=win;edenLit.lamp=lamp}).catch(e=>console.warn('Eden Wholesale model missing: dist/'+eden.userData.model,e))} // W-PLACE: the Eden Wholesale GLB into its landmark's empty group (placeholders.js); 3 groups: body (sightline fade), window glass (lit at night in staff hours), lamp lenses (emissive). Collision is the landmark's (SOLIDS via eden-wholesale-place.js)
function timberLoaded(){setTimberParts(TIMBER);for(const [n,y] of [['trunk',-.17],['logs2',-.12],['slab',-.03]])if(TIMBER[n]){const m=new THREE.Mesh(TIMBER[n].geometry,TIMBER[n].material);m.rotation.y=Math.PI/2;m.position.y=y;m.visible=false;m.name='carried-'+n;carryLog.add(m);carryTimber[n]=m}tFor.parts++} // the models lie along x with the origin at the bottom middle: a quarter turn lays them along the shoulder like the log, y centres them on it
function showShoulder(c){const k=c?.kind==='log'&&c.count===2?'logs2':c?.kind;carryLogMesh.visible=k==='log'||(k==='logs2'&&!carryTimber.logs2);for(const n of Object.keys(carryTimber))carryTimber[n].visible=n===k}
const timberMesh=(n,name,max,shadow,parent)=>{const m=new THREE.InstancedMesh(TIMBER[n].geometry,TIMBER[n].material,max);m.name=name;m.count=0;m.castShadow=shadow;m.receiveShadow=true;m.frustumCulled=false;parent.add(m);return m};
let timberHost=null; // the sawmill's own group (found once: a scene search every frame would cost)
function syncTimber(p){const host=sawmillCtl?.ready?timberHost||(timberHost=scene.getObjectByName('belt-planks')?.parent||null):null,yt=p.sawmillYard?.trunks||0,ys=p.sawmillYard?.slabs||0,drops=p.slabDrops||NO_DROPS,T=tFor,fresh=T.parts!==T.drawn;T.drawn=T.parts;
 if(TIMBER.trunk&&(fresh||T.logs!==p.logs||T.pend!==pendingLogs.size)){T.logs=p.logs;T.pend=pendingLogs.size;if(!groundTrunks)groundTrunks=timberMesh('trunk','ground-trunks',MAX_LOGS,true,scene);let n=0;for(const l of p.logs)if(l.kind==='trunk'&&!pendingLogs.has(l.id)&&n<MAX_LOGS){TIMBER_Q.setFromAxisAngle(TIMBER_UP,l.rot);groundTrunks.setMatrixAt(n++,TIMBER_M.compose(TIMBER_P.set(l.x,heightAt(l.x,l.z)+(world.floorAt(l.x,l.z)??0),l.z),TIMBER_Q,TIMBER_S))}groundTrunks.count=n;crewTimber.trunks=n;crewTimber.sig=NaN;groundTrunks.instanceMatrix.needsUpdate=true} // a trunk lies like a ground log: along x turned by rot, on the ground
 if(fresh||T.yt!==yt||T.ys!==ys||T.drops!==drops||T.host!==host){
  if(TIMBER.trunk&&host){if(!yardTrunks)yardTrunks=timberMesh('trunk','yard-trunks',TRUNK_SLOTS,false,host);const list=trunkPile(yt);TIMBER_Q.identity();list.forEach((s,i)=>yardTrunks.setMatrixAt(i,TIMBER_M.compose(TIMBER_P.set(s.x,s.y-TRUNK_RADIUS,s.z),TIMBER_Q,TIMBER_S)));yardTrunks.count=list.length;yardTrunks.instanceMatrix.needsUpdate=true} // sawmill-pile.js trunkSlot y is the trunk's axis; the model's origin is its bottom
  if(TIMBER.slab){if(!slabMesh)slabMesh=timberMesh('slab','yard-slabs',HUT_SLAB_SLOTS+MAX_SLAB_DROPS,false,scene);let n=0;{const base=heightAt(HUT.x,HUT.z);TIMBER_Q.setFromAxisAngle(TIMBER_UP,HUT.yaw+Math.PI/2);for(const s of hutSlabs(ys)){const w=hutWorld(s.x,s.z);slabMesh.setMatrixAt(n++,TIMBER_M.compose(TIMBER_P.set(w.x,base+s.y-SLAB_THICK/2,w.z),TIMBER_Q,TIMBER_S))}} // timber storage (owner 2026-11-18): the yard's slabs lie in the lumber hut (lumber-hut.js), along its length; the model lies along x, a quarter turn lays it along z
   for(const d of drops){TIMBER_Q.setFromAxisAngle(TIMBER_UP,(d.q||0)*Math.PI/2);slabMesh.setMatrixAt(n++,TIMBER_M.compose(TIMBER_P.set(d.x,heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0),d.z),TIMBER_Q,TIMBER_S))}slabMesh.count=n;slabMesh.instanceMatrix.needsUpdate=true}
  T.yt=yt;T.ys=ys;T.drops=drops;T.host=host;timberBoxes=[yardRect(trunkBounds(yt))].filter(Boolean)}} // the trunk pile blocks like the log deck (the slabs are inside the hut's own colliders)
const crewVisit=(x,z,yaw,trunk,logs)=>{const C=crewTimber,rot=yaw-Math.PI/2; // the models lie along x: a quarter turn back from the pose's trunkYaw lays them across the feller's heading
 if(trunk){if(C.nt<4){C.t[C.nt*3]=x;C.t[C.nt*3+1]=z;C.t[C.nt*3+2]=rot;C.nt++}return}
 const ax=Math.cos(rot),az=-Math.sin(rot);for(let i=0;i<logs&&C.nl<8;i++){const along=i?-CREW_ALONG:CREW_ALONG;C.l[C.nl*3]=x+ax*along;C.l[C.nl*3+1]=z+az*along;C.l[C.nl*3+2]=rot;C.nl++}}; // two logs where the trunk lay, as grid.js buckTrunk lays the player's
function syncCrewTimber(){const C=crewTimber;C.nt=C.nl=0;npcCrowd.forEachWork(crewVisit);let sig=C.nt*31+C.nl*7;for(let i=0;i<C.nt*3;i++)sig=sig*1.0001+C.t[i];for(let i=0;i<C.nl*3;i++)sig=sig*1.0001+C.l[i];if(sig===C.sig)return;C.sig=sig; // rewritten only when a piece appears, moves or goes
 if(groundTrunks){let n=C.trunks;for(let i=0;i<C.nt&&n<MAX_LOGS;i++){const x=C.t[i*3],z=C.t[i*3+1];TIMBER_Q.setFromAxisAngle(TIMBER_UP,C.t[i*3+2]);groundTrunks.setMatrixAt(n++,TIMBER_M.compose(TIMBER_P.set(x,heightAt(x,z)+(world.floorAt(x,z)??0),z),TIMBER_Q,TIMBER_S))}groundTrunks.count=n;groundTrunks.instanceMatrix.needsUpdate=true}
 {let n=C.logs;const cap=groundLogs.instanceMatrix.count;for(let i=0;i<C.nl&&n<cap;i++){const x=C.l[i*3],z=C.l[i*3+1];TIMBER_Q.setFromAxisAngle(TIMBER_UP,C.l[i*3+2]);groundLogs.setMatrixAt(n++,TIMBER_M.compose(TIMBER_P.set(x,heightAt(x,z)+.12+(world.floorAt(x,z)??0),z),TIMBER_Q,TIMBER_S))}groundLogs.count=n;groundLogs.instanceMatrix.needsUpdate=true}}
function slabTakeAt(){const top=hutSlabs(GameState.progress.sawmillYard?.slabs||0).at(-1);if(!top)return null;const w=hutWorld(top.x,top.z),y=heightAt(HUT.x,HUT.z)+top.y+.5;return {point:nearestOn(hutRect(SLAB_HALF),me.position.x,me.position.z),anchor:()=>new THREE.Vector3(w.x,y,w.z)}} // the slabs' half of the lumber hut, worked over the rail
let crateMesh=null,boxDropMesh=null,crateDropsFor=null,crateBoxes=[],handBox=null,handBoxKind='',parcelStowedOn=''; // C-B: crates and boxes put down on the ground are ONE InstancedMesh of the crate prop (MAX_CRATE_DROPS instances, one draw call) and block like plank stacks (crateBoxes); handBox: the crate or box in the arms; parcelStowedOn: the vehicle the parcel piece went onto when you got in
const crateProtos=new Map(),crateProto=id=>{let m=crateProtos.get(id);if(!m){m=createProp(id,{apply:x=>x});crateProtos.set(id,m)}return m},CRATE_M=new THREE.Matrix4(),CRATE_Q=new THREE.Quaternion(),CRATE_P=new THREE.Vector3(),CRATE_S=new THREE.Vector3(1,1,1),CRATE_UP=new THREE.Vector3(0,1,0),NO_DROPS=[],handBoxSize=new THREE.Vector3(.58,.44,.38);
const bakeryAssets=new Map();
function bakeryModels(good){
 if(!isBakeryGood(good)||!globalThis.document?.baseURI)return null;
 let assets=bakeryAssets.get(good);if(assets)return assets;
 assets={};bakeryAssets.set(good,assets);const loader=new GLTFLoader();
 for(const [kind,path] of Object.entries(BAKERY_GOODS[good].models))loader.loadAsync(new URL(path,document.baseURI).href).then(g=>{let mesh=null;g.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o});if(!mesh)throw Error('No mesh in '+path);assets[kind]={geometry:mesh.geometry,material:mesh.material};if(kind==='pallet')setBakeryPalletParts(good,assets[kind])}).catch(error=>console.warn('Bakery cargo model missing: '+path,error));
 return assets;
}
function holdHandBox(bend){boxPose(handBoxSize,bend,boxP);handBox.position.set(boxP.box.x,boxP.box.y,boxP.box.z)}
function syncCrates(){const p=GameState.progress,drops=p.crateDrops||NO_DROPS,k=p.carry?.kind,sack=k==='sack'?bakeryModels(p.carry.good)?.carry:null,want=!inside&&!shop&&(k==='crate'||k==='box'||sack)?(sack?'sack:'+p.carry.good:k):'';
 if(want!==handBoxKind){handBoxKind=want;if(want){const pr=sack||crateProto(want==='crate'?'prop.crate-bin':'prop.carton-medium');if(!handBox){handBox=new THREE.Mesh(pr.geometry,pr.material);handBox.name='carried-crate';handBox.castShadow=true;player.add(handBox)}else{handBox.geometry=pr.geometry;handBox.material=pr.material}if(!pr.geometry.boundingBox)pr.geometry.computeBoundingBox();pr.geometry.boundingBox.getSize(handBoxSize);holdHandBox(bendNow)}if(handBox)handBox.visible=!!want}
 if(drops===crateDropsFor)return;crateDropsFor=drops;crateBoxes=drops.map(d=>plankBox(d,CRATE_SIZE));if(!crateMesh&&!drops.length)return;
 if(!crateMesh){const mk=(id,name)=>{const pr=crateProto(id),m=new THREE.InstancedMesh(pr.geometry,pr.material,MAX_CRATE_DROPS);m.name=name;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;scene.add(m);return m};crateMesh=mk('prop.crate-bin','crate-drops');boxDropMesh=mk('prop.carton-medium','box-drops')} /* audit minor: a box put down is drawn as the medium carton (the one in the arms), a crate as the crate bin; one InstancedMesh each */
 const n=Math.min(drops.length,MAX_CRATE_DROPS);let nc=0,nb=0;for(let i=0;i<n;i++){const d=drops[i];CRATE_Q.setFromAxisAngle(CRATE_UP,(d.q||0)*Math.PI/2);CRATE_M.compose(CRATE_P.set(d.x,heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0),d.z),CRATE_Q,CRATE_S);if(d.k==='box')boxDropMesh.setMatrixAt(nb++,CRATE_M);else crateMesh.setMatrixAt(nc++,CRATE_M)}crateMesh.count=nc;boxDropMesh.count=nb;crateMesh.visible=nc>0;boxDropMesh.visible=nb>0;crateMesh.instanceMatrix.needsUpdate=boxDropMesh.instanceMatrix.needsUpdate=true}
let carryPlanks=null,dropsFor=null,plankBoxes=[],planksPose=0,yardBoxes=[],yardPile=null; // plankBoxes: a put-down stack is a solid box (carry.js plankBox); planksPose: how far the two-handed carry pose has blended in
// The two drivable Eastbank vehicles (driving.js, vehicle.js): their poses come from the save. worldBlocked is blocked() without them, so a vehicle never collides with itself.
for(const v of GameState.progress.vehicles||[])world.ensure(v.x,v.z); // a saved vehicle is placed against real ground: build its chunks first
const surfaceLive=(x,z)=>{const s=world.chunks?.surfaceAt?.(x,z)||0;return s||terrain().surfaceAt(x,z)};const footstep=run=>{const sf=inside||shop?'wood':surfaceLive(me.position.x,me.position.z);audio.step(sf,null,null,run)};let ambClock=0,ambWater=Infinity;const forestSt={on:false,d:Infinity,x:0,z:0},creakGate=createCreakGate();function forestScan(){forestSt.d=Infinity;if(inside||shop)return;const px=me.position.x,pz=me.position.z;let best=Infinity;for(const t of world.trees.values()){if(!t.standing)continue;const dx=t.x-px,dz=t.z-pz,d=dx*dx+dz*dz;if(d<best){best=d;forestSt.x=t.x;forestSt.z=t.z}}forestSt.d=Math.sqrt(best)}function ambienceTick(dt){ambClock+=dt;if(ambClock>=.25){ambClock=0;const sf=surfaceLive(me.position.x,me.position.z);ambWater=sf===6||sf===7||sf===8?5:Infinity;forestScan()}const m=GameState.progress.routine?.minutes||0;const fp=forestTarget(forestSt,forestSt.d,!inside&&!shop),working=!!chopping?.tree&&!chopping.tree.stump&&!chopping.tree.buck;if(creakGate.tick(dt,fp,working))audio.logging('woodCreak',working?{x:chopping.tree.x,z:chopping.tree.z}:{x:forestSt.x,z:forestSt.z},listenerAt());audio.ambience({outdoors:!inside&&!shop,isNight:m<330||m>=1230,windSpeed:5,waterDist:ambWater,forest:fp,duck:forestDuck({vehicle:!!driving.driving||!!fork.on,talking:talking()})})} // LOG1: forest loop + one seeded, timer-gated creak every 16-38 s (7-15 s while a tree is being worked) // SND3: footsteps by surface (a step every PI of phase) and the ambience bed (birds by day, crickets by night, a little wind, water at the lake and the river) // PB1: the ground under a vehicle: the loaded tiles first (the wilds east of x 300 and beyond the other rims), the whole-map mask inside the old ground
const driving=createDriving({scene,fade:world.fade,surface:surfaceLive,footing:standHeight,baseBlocked:(x,z)=>worldBlocked(x,z),saved:GameState.progress.vehicles});let driveIdle=9,driveSave=0;const vehicleHud=createVehicleHud($);const fuel=createFuelStation({scene,fade:world.fade,footing:standHeight});const smoke=createSmoke(scene);const debris=createDebris(scene);let voiceT=0;const nightLights=createNightLights({scene,footing:standHeight,cityWindows,cityLampHeads,high:startSettings.quality==='high'});const shadows=createShadows({scene,renderer,sun,footing:standHeight,people:()=>[driving.active?null:me,...Object.values(remoteMeshes),...pedestrians.people.map(p=>p.group)],vehicles:()=>[...driving.fleet.map(f=>({mesh:f.mesh,hx:f.cls.hx,hz:f.cls.hz})),...[customerTruck,dockTruck].map(t=>({mesh:t.mesh,hx:CLASSES.flatbed.hx,hz:CLASSES.flatbed.hz})),...vehicles.map(v=>({mesh:v.group}))]});let lightMode='auto',lightsHeldFor=null,lightsHeld=[]; // night lights (night-lights.js): lamps, windows, vehicle lamps; lightMode: the L key's switch for the vehicle you drive. Before that: the Eastbank pumps: nozzles, hoses and the nozzle in your hand
// P-B wiring (notes/planks-economy-design.md): the yard (progress.sawmillYard, sawmill-yard.js) is the sawmill's ONE plank stock: logs wait on the bench, the saw cuts one in 4 game minutes (game time, so any frame rate), planks wait in the yard.
// Every board of the yard is drawn in the lumber hut (owner 2026-11-18: the sawmill deck is no store; lumber-hut.js), the waiting logs beside the feed end (syncYardPile, sawmill-pile.js); progress.belt stays derived for old saves; the lever follows the yard's switch; the daily trickle and the supply to the Eastbank supplier run in world-tick.js.
function beltOf(p){return Math.min(BELT_SLOTS,Math.floor((p?.sawmillYard?.planks||0)/YARD_STACK))}
function yardLine(y){const s=yardSummary(y);return `${s.logs} ${s.logs===1?'log':'logs'} waiting · ${s.planks} ${s.planks===1?'plank':'planks'} in the yard`+(s.trunks||s.slabs?` · ${s.trunks} ${s.trunks===1?'trunk':'trunks'} waiting · ${s.slabs} ${s.slabs===1?'slab':'slabs'}`:'')} // T-E: trunks and slabs only once there are any
function setYard(y,extra){GameState.progress={...GameState.progress,...extra,sawmillYard:y,belt:beltOf({sawmillYard:y})};persist()}
let yardSeen=null; // the game minute the saw last ran to (not saved: after a load it counts from the loaded minute)
function tickSawYard(){const p=GameState.progress,now=gameMinutes(p),last=yardSeen;yardSeen=now;const y=p.sawmillYard;if(!y?.on||last===null||!(now>last))return;const n=tickYard(y,Math.min(now-last,1440));GameState.progress={...p,sawmillYard:n,belt:beltOf({sawmillYard:n})};if(n.logs!==y.logs||n.trunks!==y.trunks)persist();if(!n.on&&sawmillCtl?.ready&&Math.hypot(me.position.x-sawmillCtl.switchPoint.x,me.position.z-sawmillCtl.switchPoint.z)<25)toast((n.logs||n.trunks?'The lumber hut is full: the saw stops until '+(n.logs?'boards':'slabs')+' are taken out':'The saw has cut every log and stops')+' · '+yardLine(n))}
const SAW_MARK=MAP.landmarks.find(l=>l.id==='sawmill'),PILE_GLOW=.14;function yardRect(r){if(!r)return null;const a=anchorWorld(SAW_MARK,[r.x0,0,r.z0]),b=anchorWorld(SAW_MARK,[r.x1,0,r.z1]),x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),z0=Math.min(a.z,b.z),z1=Math.max(a.z,b.z);return {x:(x0+x1)/2,z:(z0+z1)/2,hx:(x1-x0)/2,hz:(z1-z0)/2}}function syncYardPile(p,c){const planks=p.sawmillYard?.planks||0,logs=p.sawmillYard?.logs||0;if(!yardPile){const host=scene.getObjectByName('belt-planks')?.parent;if(!host)return;const mat=c.plank.material.clone();mat.name='yard-pile-plank';mat.emissive.copy(mat.color).multiplyScalar(PILE_GLOW);const pm=new THREE.InstancedMesh(c.plank.geometry,mat,BOARD_SLOTS*YARD_STACK),lm=new THREE.InstancedMesh(groundLogs.geometry,groundLogs.material,LOG_SLOTS);pm.name='yard-pile';lm.name='yard-logs';for(const o of [pm,lm]){o.count=0;o.castShadow=false;o.receiveShadow=true;o.frustumCulled=false;(o===pm?scene:host).add(o)}pm.setColorAt(0,new THREE.Color(1,1,1));yardPile={pm,lm,planks:-1,logs:-1,pileBox:null,base:heightAt(HUT.x,HUT.z),m:new THREE.Matrix4(),q:new THREE.Quaternion(),at:new THREE.Vector3(),one:new THREE.Vector3(1,1,1),tint:new THREE.Color()}}const Y=yardPile;if(Y.planks===planks&&Y.logs===logs)return;const {pm,lm,m,q,at,one,tint}=Y;if(Y.planks!==planks){const list=hutPlanks(planks);list.forEach((s,i)=>{const r=s.rot+HUT.yaw,w=hutWorld(s.x,s.z);q.set(0,Math.sin(r/2),0,Math.cos(r/2));pm.setMatrixAt(i,m.compose(at.set(w.x,Y.base+s.y,w.z),q,one));pm.setColorAt(i,tint.setScalar(PLANK_TINT[s.k]))});pm.count=list.length;pm.instanceMatrix.needsUpdate=true;if(pm.instanceColor)pm.instanceColor.needsUpdate=true;Y.planks=planks}if(Y.logs!==logs){const list=logPile(logs);list.forEach((s,i)=>{const a=i*2.4;q.set(Math.sin(a/2),0,0,Math.cos(a/2));lm.setMatrixAt(i,m.compose(at.set(s.x,s.y,s.z),q,one))});lm.count=list.length;lm.instanceMatrix.needsUpdate=true;Y.logs=logs;Y.logBox=yardRect(logBounds(logs))}yardBoxes=[Y.logBox].filter(Boolean)}function yardTakeAt(){const top=hutTopStack(GameState.progress.sawmillYard?.planks||0);if(!top)return null;const w=hutWorld(top.x,top.z),y=heightAt(HUT.x,HUT.z)+top.y+top.count*PLANK_PITCH+.35;return {point:nearestOn(hutRect(BOARD_HALF),me.position.x,me.position.z),anchor:()=>new THREE.Vector3(w.x,y,w.z)}}function syncSawmill(){
 const p=GameState.progress,c=sawmillCtl,hands=!inside&&!shop,ck=p.carry?.kind;carryLog.visible=hands&&(ck==='log'||ck==='trunk'||ck==='slab');showShoulder(p.carry);syncCrates();syncTimber(p);syncCrewTimber(); // T-E: a trunk, two logs or a slab ride on the shoulder like the log
 if(!c?.ready)return;
 if(!carryPlanks){carryPlanks=new THREE.Group();carryPlanks.name='carried-planks';for(let k=0;k<4;k++){const plain=c.plank.material.clone();plain.color.multiplyScalar(PLANK_TINT[k]);const m=new THREE.Mesh(c.plank.geometry,plain);m.position.y=k*.12;carryPlanks.add(m)}carryPlanks.position.set(PLANK_STACK.x,PLANK_STACK.y,PLANK_STACK.z);player.add(carryPlanks)}
 const n=p.carry?.kind==='planks'?p.carry.count:0;carryPlanks.visible=hands&&n>0;carryPlanks.children.forEach((m,i)=>m.visible=i<n);
 if(dropsFor!==p.plankDrops){dropsFor=p.plankDrops;c.setDrops(dropsFor.map(d=>({...d,floor:heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0)})));plankBoxes=dropsFor.map(d=>plankBox(d,c.plankSize))}
 {const on=!!p.sawmillYard?.on;if(c.on!==on){c.setOn(on);sawmillState={on}}if(on&&(p.sawmillYard.logs>0||p.sawmillYard.trunks>0)&&!c.cutting)c.startCut(null)} // P-B: the lever follows the yard; the Cut clip plays while logs (or trunks, T-E) wait, at its own cadence
 if(c.count()>0&&c.frontArrived())c.take();syncYardPile(p,c); // a fresh stack rides to the belt's end and is lifted off there (the deck stores nothing: the yard's count is the lumber hut's); the pile and the waiting logs are drawn from the yard's numbers (sawmill-pile.js), rebuilt only when they change
}
// Rendering consumes the simulation state; gameplay never reads mesh transforms.
function syncPlayerMesh(){
 player.position.set(me.position.x,me.position.y,me.position.z);
 player.rotation.y=me.rotation.y;player.visible=!driving.active||!!driving.seatedAt(); // the shortbed shows you seated in its cab (hips on the seat anchor); the other vehicles have no seat model: the avatar is hidden there
 {const s=driving.seatPose(forkHips);player.rotation.order='YXZ';if(s){player.rotation.set(s.rx,s.ry,s.rz);player.position.set(s.x,s.y,s.z)}else{player.rotation.x=0;player.rotation.z=0}} if(fork.on){const p=forklift.seatOf(fork.state);player.position.set(p.x,forklift.SEAT_TOP+FORK_SIT-forkHips,p.z)} // on the forklift (an open cab) you are seen sitting on its seat: hips on the cushion
}
function getMeWorldPosition(target){
 target.set(me.position.x,me.position.y,me.position.z);
 return player.parent.localToWorld(target);
}

setMePosition(MAP.spawn.x,MAP.spawn.y,MAP.spawn.z);let editorHook=null,yaw=0,pitch=.38,zoom=7,zoomTarget=7,active=false,modal=false,dialogTalking=false,discovered=false,phase=0,busy=null,worldPanel=null,selectedInteraction=null;const keys=createMovementInput(window,document,()=>active&&!modal&&!creatorOpen&&!actionBusy()&&!talking());const updateCamera=createCameraController(camera,cameraSolids,trees,lampMeshes);
// Reset safety net (safe-spot.js). Every reset, teleport and rescue goes through placeSafely: a destination that is blocked (a car parked on the spawn, a
// closed shop door's blocker) becomes the nearest clear spot instead, never a place you cannot walk out of. Runs when asked, never per frame.
function placeSafely(x,y,z,{keepIfNone=false}={}){
 if(!(inside||shop))world.ensure(x,z); // chunks round the destination are built first (a 0.3 s fade only if it was outside the loaded ring), so the ground there is real
 const indoors=inside||shop,spot=findNearestClearSpot(blocked,x,z,{maxRadius:indoors?6:MAX_SEARCH,openArea:indoors?0:OPEN_AREA})||{x,z,distance:Infinity};
 if(spot.distance===Infinity&&keepIfNone)return {x:me.position.x,z:me.position.z,moved:false,found:false}; // a teleport that finds nothing clear stays where it is
 setMePosition(spot.x,y,spot.z);if(!indoors)camera.position.set(spot.x,4,spot.z+7);
 return {x:spot.x,z:spot.z,moved:spot.distance>.0001,found:spot.distance!==Infinity};
}
function reset(){if(driving.active){const fa=driving.active;driving.leave(()=>false);unstowParcel(fa)}fuel.putBack(); // R while driving: the vehicle stays where it is and you go to the spawn
 if(active)look.resetMotion();if(shop){const en=officeByKey(shop)?.interior.entry||SHOP_ENTRY;return placeSafely(en.x,.02,en.z)}if(inside)return placeSafely(home.ENTRY.x,.02,home.ENTRY.z);const rp=nearestRescuePoint(me.position.x,me.position.z)||MAP.spawn,r=placeSafely(rp.x,MAP.spawn.y,rp.z);yaw=0;/* RU2: R goes to the nearest region's safe point (the Ironwood point is the spawn) */pitch=.38;return r}reset();
// Moves you to the nearest clear spot from where you stand (the dev panel's Unstick, and the automatic rescue in the frame loop).
function unstick(){const r=placeSafely(me.position.x,me.position.y,me.position.z);if(r.moved){persist();toast('You were stuck, so you were moved to the nearest clear spot.')}return r}
if(GameState.progress.position){const p=GameState.progress.position;world.ensure(p.x,p.z);if(!blocked(p.x,p.z)){me.position.x=p.x;me.position.z=p.z;camera.position.set(p.x,4,p.z+7)}else{const spot=findNearestClearSpot(blocked,p.x,p.z,{openArea:OPEN_AREA}); // a blocked saved position (the 0.31 parked car) no longer sends you back to the spawn
 if(spot){me.position.x=spot.x;me.position.z=spot.z;camera.position.set(spot.x,4,spot.z+7)}}}
function worldBlocked(x,z){if(!isWalkable(x,z)||world.blocked(x,z))return true;return colliders.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)||plankBoxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)||yardBoxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)||timberBoxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)||crateBoxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)}
function blocked(x,z){if(shop)return shops[shop].blocked(x,z)||forkBlocks(x,z);if(inside)return home.room.blocked(x,z);return worldBlocked(x,z)||driving.blocksWalker(x,z)||customerTruck.blocksWalker(x,z)||dockTruck.blocksWalker(x,z)||forkBlocks(x,z)} // a drivable vehicle is solid to a walker (its hull, inflated by the player radius)
function clearWorldPanel(){if(worldPanel?.actor){const pa=getMeWorldPosition(new THREE.Vector3()),pb=worldPanel.actor.getWorldPosition(new THREE.Vector3());yaw=Math.atan2(pa.x-pb.x,pa.z-pb.z)+.45;pitch=.32;zoom=zoomTarget=5.8;}worldPanel=null;dialogTalking=false;look.resetMotion()}
function pause(show){if(sleepElapsed!==null)return;if(show&&talking())talkPanel.close();if(show){phone?.close();inventoryUI?.close();storeUI?.close();}if(show){$('dialog').hidden=true;clearWorldPanel();}$('controls').hidden=!show;$('settings').hidden=true;$('credits').hidden=true;modal=show;keys.clear();if(show)look.release()}
// WebGPU pipeline warm-up runs while the menu is visible. Play can be requested before it finishes.
let playQueued=false,worldWarm=null,worldWarmReady=false,qualityRevision=0,appliedQuality='high',qualityWarm=null;
function enterWorld(){
 const start=$('start');
 if(renderBackend!=='WebGL'&&!worldWarmReady){playQueued=true;start.disabled=true;start.textContent='Preparing world…';$('welcome').hidden=false;return}
 if(playQueued){playQueued=false;start.disabled=false;start.textContent='Play'}
 $('welcome').hidden=true;active=true;
}
function startGame(){if(playQueued)return;if(currentAppearance.name){saveMenu.backupOnPlay();enterWorld()}else openCreator()}$('start').onclick=startGame;$('help').onclick=()=>pause(true);
// Credits (credits.js): built from the data the first time they are opened from the Controls panel.
let openCredits=()=>{};{let built=false,from='controls';function buildCredits(){const list=$('creditsList');for(const c of CREDITS){const row=document.createElement('div');row.className='credit';const who=document.createElement('b');who.textContent=c.who;const what=document.createElement('span');what.textContent=c.what;const lic=document.createElement('small');lic.textContent=c.licence+' · ';if(c.url){const a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=c.url.replace(/^https?:\/\//,'');lic.appendChild(a)}else lic.textContent=c.licence;row.append(who,what,lic);list.appendChild(row)}built=true}
 openCredits=source=>{from=source;if(!built)buildCredits();if(source==='menu')$('welcome').hidden=true;else $('settings').hidden=true;$('credits').hidden=false};
 $('showCredits').onclick=()=>openCredits('settings');$('closeCredits').onclick=()=>{$('credits').hidden=true;if(from==='menu')$('welcome').hidden=false;else $('settings').hidden=false}}$('resume').onclick=()=>{pause(false);look.capture()};
// Pause menu -> Settings and back: only the two panels swap; pause(false) is never called here, so modal, keys, look.release and look.capture stay paired.
const showSettings=on=>{$('controls').hidden=on;$('settings').hidden=!on};$('showSettings').onclick=()=>showSettings(true);$('settingsBack').onclick=()=>showSettings(false);
// Back to the main menu: save, leave any multiplayer server, and reload the page. The reload is the cleanest reset (scenes, timers, sockets, held input), and the save has just been written.
$('mainMenu').onclick=()=>{persist();multiplayer.disconnect();const go=()=>{if(typeof location!=='undefined')location.reload()};if(cloud.user)Promise.race([cloud.pushIfChanged(),new Promise(r=>setTimeout(r,3000))]).finally(go);else go()};$('closeDialog').onclick=()=>{$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()};
function updateHomeNotices(){const n=GameState.progress.homeNotices;if(n?.length){toast(n.join(' '));GameState.progress.homeNotices=[];persist()}} var saveLocked=false; // var, not let: persist() is hoisted and may run before this line. Set once an import or restore has written a new save: nothing may save the old game over it while the page reloads
 function persist(){if(saveLocked)return;refreshHotbar();refreshSkillHud();if(!inside&&!shop){const at=driving.active?driving.door():me.position;GameState.progress.position={x:at.x,z:at.z}} // driving: you are saved standing at the driver's door, and the vehicles where they were left
 syncBakeryCargo();GameState.progress.vehicles=driving.save();const ok=saveProfile({playerId:me.id,name:me.name,progress:GameState.progress});$('progressStatus').textContent=ok?'Saved on this browser':'Saving unavailable · session only';return ok}
// A phone notification (DESIGN 4.19): saved as a message for its app (messages.js), shown as a toast that waits its turn behind any toast still showing (at most three wait), the phone button shakes and every
// app badge is redrawn, and a soft two-note ping plays. `app` is the phone app it belongs to: jobs, store, bank, homes, player or gigs.
function notifyPhone(app,text){
 const p=GameState.progress,r=addMessage(p,{app,text,at:absoluteNow(p)});GameState.progress=r.state;persist();
 queueToast(text);phone?.notify(app);audio.ping();
}
function toast(text){showToast(text,4500)}
function takeGig(id){const r=acceptContract(GameState.progress,id,me.position);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast('Gig accepted · '+GameState.progress.activeJob.title+' · '+(GameState.progress.activeJob.pickup?'Go and pick up the parcel first':'Follow the gold marker'))}
// The starter story (starter.js, "A Hand for Hal"): events move it on; the truck beats wait for the short flatbed.
let storyKnocks=0; // counted crashes of the loan truck while the egg crates are on it (not saved: a reload mid-drive forgives them)
function storyEvent(event,data){const r=applyStory(GameState.progress,event,data);if(r.error){if(r.soft)notifyPhone('player',r.error);return false}GameState.progress=r.progress;if(r.moved)driving.place(r.moved.uid,r.moved.pose);if(r.removed)driving.sync(r.progress.vehicles);notifyPhone('player',r.text);persist();return true}
let storyCargoKey='',storyPallet=null;
function syncStoryCargo(s){const uid=s?.loanUid,want=storyPalletHidden(s),f=uid?driving.byId.get(uid):null; // G3b: Hal's crates: while the story says 'loaded' there are STORY_CRATES crates on the loan truck's deck (cargo.js, one InstancedMesh) and the pallet by the barn is shrunk away; otherwise the deck is cleared of crates and the pallet is back
if(f){const d=storyDeck(s,driving.cargoOf(uid),f.spec.model);if(d)driving.setCargo(uid,d.cargo)} // every frame, cheap: a driving.sync from the saved list cannot lose the crates
const key=want?'1':'0';if(key===storyCargoKey)return;storyCargoKey=key;if(!storyPallet){scene.traverse(o=>{if(!storyPallet&&o.isMesh&&o.name==='prop-prop.pallet-crate'&&Math.abs(o.position.x-STORY_PLACES.crates.x)<.5&&Math.abs(o.position.z-STORY_PLACES.crates.z)<.5)storyPallet=o})}if(!storyPallet)return;storyPallet.scale.setScalar(want?.001:1)}
 // the pallet: world.js sets only .visible each frame, never the scale; its collider stays (removing it would need a world.js edit)
function storyTick(){const p=GameState.progress,s=p.starter;syncStoryCargo(s);syncNeedCargo();if(!s||s.done||inside)return;if(s.step===0){if(!(p.messages||[]).some(m=>m.text.startsWith('Noah: Come by')))notifyPhone('player','Noah: Come by the market, I could use a hand.')}else if(s.step>=4&&s.step<=9){const r=ensureLoan(p);if(r){GameState.progress=r.progress;driving.sync(r.progress.vehicles);notifyPhone('player',r.text);persist()}if(alreadyHoused(p))storyEvent('rented')}}
// PET3: the adoption text and offer (when you have a home), hunger by game minutes (the phone warnings, running away after 3 weeks unfed), moving with you, the cat's spot and wander, E to feed or pat, co-op snapshots.
const PET_OFFER_AFTER=60,petHomeId=()=>home.kind==='studio'?STUDIO_ID:home.id;
function petTick(){const p=GameState.progress,t=absoluteNow(p);if(!inside)catNow.asked=false;if(t===catNow.min)return;catNow.min=t; // once a game minute; tickPets only reads the clock, so a big jump (sleep, a long absence) fires every missed event in order
 const r=tickPets(p.pets,t);let pets=r.pets;const pet=pets.pet;if(pet&&!homesHeld(p).some(h=>h.id===pet.homeId)){const main=mainHome(p);if(main){pets={...pets,pet:rehomePet(pet,main)};r.events.push({text:pet.name+' moved with you to your main home.'})}}
 if(r.events.length){GameState.progress={...GameState.progress,pets};for(const e of r.events)notifyPhone('homes',e.text);persist()}
 if(!adoptionOffer(GameState.progress,GameState.progress.pets,t))return;
 {const ps=GameState.progress.pets;if(ps?.offer?.status==='none'){if(ps.offer.at==null){GameState.progress={...GameState.progress,pets:{...ps,offer:{status:'none',at:t}}};return} // offer.at: when you first had a home; the shelter texts an hour later, when you are at home
  if(t-ps.offer.at<PET_OFFER_AFTER||!inside)return;if(!catNow.texted&&!(GameState.progress.messages||[]).some(m=>m.text?.includes(PET_MSG.offer)))notifyPhone('homes','The animal shelter: '+PET_MSG.offer);catNow.texted=true}}
 if(inside&&!catNow.asked&&!modal&&!talking())petOffer()}
function petOffer(){catNow.asked=true;const input=catNow.input||(catNow.input=document.createElement('input'));input.id='petName';input.type='text';input.maxLength=PET_NAME_MAX;input.placeholder=PET_DEFAULT;input.value=''; // asked once per visit home; 'Not now' leaves the offer open
 showDialog('PHONE · ANIMAL SHELTER','A cat for your new home?',PET_MSG.offer+' Type a name, or keep '+PET_DEFAULT+'.','FREE TO ADOPT',()=>{const p=GameState.progress;GameState.progress={...p,pets:adoptPet(p.pets,petHomeId(),absoluteNow(p),input.value)};catNow.home=null;$('closeDialog').onclick();const n=GameState.progress.pets.pet?.name||PET_DEFAULT;notifyPhone('homes',n+' has moved in. Feed '+n+' every few days (one grocery pack) and give a pat now and then.')},'Adopt');
 if(!$('dialog').hidden){$('dialogText').appendChild(input);input.focus?.();extraAction('No thanks',()=>{GameState.progress={...GameState.progress,pets:declineOffer(GameState.progress.pets,absoluteNow(GameState.progress))};$('closeDialog').onclick();persist();toast('Maybe another time. The shelter may ask again in a few days.')})}}
function petWaypoint(pet){const g=catActor.group.position,room=home.room;for(let i=0;i<6;i++){const w=nextWaypoint(catNow.box,pet.adoptedAt,catNow.step++);if(!w||room.blocked(w.x,w.z))continue;let ok=true;for(let k=1;k<4&&ok;k++)ok=!room.blocked(g.x+(w.x-g.x)*k/4,g.z+(w.z-g.z)*k/4);if(ok)return w}return null} // a free spot with a clear straight line to it
function petFrame(dt){const pet=inside?GameState.progress.pets?.pet:null; // every frame: no allocation except when the cat is placed or picks a new spot (once a game minute at most)
 if(!pet||pet.homeId!==petHomeId()){catActor.visible=false;catNow.home=null}else{
  if(catNow.home!==home){catNow.home=home;const L=home.room.layout;catNow.box=L?{...L,colliders:collidersOf(L,0)}:{x0:-5.6,x1:5.6,z0:-4.6,z1:4.6};const sp=interiorSpawn(petHomeId(),L?catNow.box:null)||{x:0,z:0,yaw:0};catActor.group.position.set(sp.x,0,sp.z);catActor.group.rotation.y=sp.yaw;catNow.wp=null;catNow.cmin=-1;home.room.scene.add(catActor.group);audio.cat('warm');catNow.greet=absoluteNow(GameState.progress)+2}
  catActor.visible=true;const t=absoluteNow(GameState.progress);
  if(t!==catNow.cmin){catNow.cmin=t;const walk=moodOf(pet,t)==='walk',st=hungerOf(pet,t).stage;if(!walk)catNow.wp=null;else if(!catNow.wp&&(home.room.floor||0)===0)catNow.wp=petWaypoint(pet);const c=clipFor(pet,t,{moving:!!catNow.wp,seed:pet.adoptedAt});catGo.clip=c.clip;catGo.loop=c.loop;catGo.speed=c.speed;
   if((st==='hungry'||st==='starving')&&t-catNow.meowAt>=MEOW_GAP){catNow.meowAt=t;audio.cat(st==='starving'?'meow-sad':'meow',catActor.group.position,me.position)}else if(catNow.greet>=0&&t>=catNow.greet){catNow.greet=-1;if(c.clip!=='sleep')audio.cat('meow',catActor.group.position,me.position)}}
  const g=catActor.group.position;catGo.x=catNow.wp?catNow.wp.x:g.x;catGo.z=catNow.wp?catNow.wp.z:g.z;catGo.yaw=catActor.group.rotation.y;const r=catActor.update(dt,catGo);catNow.shown=r.clip;if(r.arrived&&catNow.wp)catNow.wp=null}
 petVisit(dt)}
function petVisit(dt){let snap=null;if(inside){const room=currentRoom();for(const id in GameState.otherPlayers){const o=GameState.otherPlayers[id];if(o.pet&&o.room===room){snap=o.pet;break}}} // a co-op player's cat in the room you are in (validated on arrival in receiveRemote)
 if(!snap){if(catNow.visit)catNow.visit.visible=false;return}
 if(!catNow.visit){catNow.visit=createPetActor({THREE,GLTFLoader});if(globalThis.document?.baseURI)catNow.visit.load().catch(()=>{})}
 const v=catNow.visit;if(v.group.parent!==home.room.scene)home.room.scene.add(v.group);if(!v.visible||Math.hypot(v.group.position.x-snap.x,v.group.position.z-snap.z)>1.5)v.group.position.set(snap.x,0,snap.z);v.visible=true;catVisit.x=snap.x;catVisit.z=snap.z;catVisit.yaw=snap.yaw;catVisit.clip=snap.clip;v.update(dt,catVisit)}
function petCandidate(add){const pet=GameState.progress.pets?.pet;if(!pet||!catActor.visible)return;const feed=hungerOf(pet,absoluteNow(GameState.progress)).stage!=='fed',g=catActor.group.position;add('cat',{x:g.x,z:g.z},()=>catActor.anchorPoint(feed?'mouth':'head'),(feed?'Feed ':'Pet ')+pet.name,()=>petAct(feed),1.15+catActor.pickRadius)}
function petAct(feed){const p=GameState.progress,pet=p.pets?.pet,t=absoluteNow(p);if(!pet)return;if(feed&&!(p.life?.groceries>0)){toast('You need a grocery pack to feed '+pet.name+'. The Corner Market sells them.');return} // no cat food item yet: a meal is one grocery pack
 const r=feed?feedPet(pet,t):patPet(pet,t);if(!r.ok){toast(r.reason==='cooldown'?pet.name+' just had a pat.':pet.name+' is not hungry yet.');return}
 GameState.progress={...p,pets:{...p.pets,pet:r.pet},...(feed?{life:{...p.life,groceries:p.life.groceries-1}}:{})};catNow.cmin=-1;catNow.wp=null;persist();audio.cat(feed?'eat':'purr',catActor.group.position,me.position);toast(feed?pet.name+' is eating · one grocery pack used':pet.name+' purrs · affection '+r.affection+' / 100')}
const catShare=()=>catActor.visible&&GameState.progress.pets?.pet?petSnapshot(GameState.progress.pets.pet,{x:catActor.group.position.x,z:catActor.group.position.z,yaw:catActor.group.rotation.y,clip:catNow.shown}):null; // what a visitor sees (petSnapshot is checked again by the relay and by them)
const storyKnock=e=>{const s=GameState.progress.starter;if(s&&s.step===4&&s.loaded&&e.id===s.loanUid)storyKnocks++};
const storyFuel=(id,frac)=>{const s=GameState.progress.starter;if(s&&s.step===5&&id===s.loanUid&&frac>=.5)storyEvent('refuelled')}; // half a tank counts as filling up
const loanNear=(pt,r)=>{const s=GameState.progress.starter,f=s?.loanUid&&driving.byId.get(s.loanUid);return !!f&&Math.hypot(f.state.x-pt.x,f.state.z-pt.z)<r};
function halAct(id){if(id==='groceries'){const r=startLoan(GameState.progress);if(r.error)return {error:r.error};GameState.progress=r.progress;driving.sync(r.progress.vehicles);notifyPhone('player',r.text);persist();return {text:''}}if(id==='buy'){const r=buyFromHal(GameState.progress);if(r.error)return {error:r.error};GameState.progress=r.progress;driving.sync(r.progress.vehicles);persist();return {text:r.text}}return {error:'Hal has nothing for that.'}}
function halChoice(id){const r=halAct(id);if(r.error){toast(r.error);return}if(id==='groceries')speak(hal.group,'Hal Brennan','Keys are in her. Four crates of eggs are on the pallet by the barn: take them to Noah.');else if(id==='buy'){speak(hal.group,'Hal Brennan','She is in the yard. Keep her running.');toast(r.text)}}
function talkHal(){const t=halTalk(GameState.progress);speak(hal.group,'Hal Brennan',t.text.replace(/^Hal: /,''),t.choices.map(c=>({label:c.label,run:()=>halChoice(c.id)})))}
// ---- W-D3: named NPC dialogue, the flat buzzers and the People page (npc-dialogue.js has the rules and the tests; notes/world-system-design.md NEW NPCS). A talk's effects (mood, standing) are applied ONCE when a topic is chosen; Next, Skip or walking away only change what is shown.
const npcDay=()=>Math.max(0,(GameState.progress.housing?.day||1)-1),BUZZER={x:STUDIO.x-2.4,z:-8.1}; // the buzzer panel of the Oak Street Apartments (the building has one door; flat interiors do not exist yet)
function npcKeep(s){GameState.progress={...GameState.progress,npcs:s.npcs,standing:s.standing}}
function recordTalk(id){npcKeep(registerTalk(GameState.progress,id,npcDay()));persist()} // Noah's counter and Hal keep their own menus: only the effects (mood, standing, met) are added
function npcSay(v,actor,at,text,choices){if(actor)speak(actor,v.name,text,choices);else station(at,v.name,text,choices)}
function topicMenu(v,actor,at,text,page=0){const pc=pagedChoices(topicsFor(v.id),page),choices=pc.items.map(t=>({label:t.label,run:()=>topicRun(v,actor,at,t.id)}));if(pc.nextPage!==null)choices.push({label:'More topics',run:()=>topicMenu(v,actor,at,text,pc.nextPage)});npcSay(v,actor,at,text,choices)}
function topicRun(v,actor,at,topic){const r=talkOutcome(GameState.progress,v.id,topic,npcDay(),MAP.seed);if(!r)return;npcKeep(r.state);persist();
 const page=i=>{const last=i>=r.pages.length-1;npcSay(v,actor,at,r.pages[i],last?(r.refused?[]:[{label:'Ask something else',run:()=>topicMenu(v,actor,at,'Anything else?')}]):[{label:'Next',run:()=>page(i+1)},{label:'Skip',run:()=>topicMenu(v,actor,at,'Anything else?')}])};page(0)}
function talkNamed(id,actor,at=null,lead=''){const v=openTalk(GameState.progress,id,npcDay(),MAP.seed);if(!v)return;npcKeep(v.state);persist();topicMenu(v,actor,at,(lead?lead+' ':'')+v.text)}
// ---- C6 (notes/conversation-design.md 4; OPUS-cast-review B1-B6; C4-fixes rules 1-10): everyone with a cast talks through talk-engine.js in the docked #talk panel (talk-panel.js). Game time never pauses while talking: modal stays off, only walking, looking and the other keys are locked.
var talkPanel=null,talkNow=null;let talkTimer=0;const talkRing=[],talkChev={x:0,y:0,on:false,t:0,min:-1},talkV=new THREE.Vector3(),talkW=new THREE.Vector3(),pedPids=new Map(),TALK_KEYS={KeyE:'e',KeyQ:'q',Escape:'Escape',Enter:'Enter',NumpadEnter:'Enter',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown'};
function talking(){return !!talkNow&&!!talkPanel&&talkPanel.isOpen()}
function pedPid(name){if(!pedPids.has(name))pedPids.set(name,npcTown.people.find(q=>q.name===name)?.id||'ped:'+name);return pedPids.get(name)} // one prompt id per person (talk:<personId>) for the pedestrian and the crowd prompts
// recentEvents (review C): a ring of 8 {ev, at} with at = day*1440+minute; env.recent holds what happened in the last game day. Not saved: a reload forgets it, which is harmless.
function pushRecent(ev){talkRing.push({ev,at:Math.floor(hudDay())*1440+Math.floor(hudMinutes())});while(talkRing.length>8)talkRing.shift()}
function recentEvents(){const now=Math.floor(hudDay())*1440+Math.floor(hudMinutes());return talkRing.filter(e=>e.at>=now-1440).map(e=>e.ev)}
// derived beats (env.flags): rebuilt from the save on EVERY turn and never stored (remember() gets the stored mem; talkContext puts these only in the view)
function talkFlags(){const p=GameState.progress,s=p.starter||{};return {skipped:s.skipped===true,loaded:s.step===4&&s.loaded===true,ownsShortbed:(p.vehicles||[]).some(v=>v.model==='shortbed'&&!v.loan),rented:p.housing?.rented===true,carryingCafe:p.phase==='carrying'&&p.completed%3===1}}
function talkCtx(t){return talkContext(GameState.progress,t.who,{day:Math.floor(hudDay()),minute:Math.floor(hudMinutes()),weather:'clear',place:t.place,seed:MAP.seed,recent:recentEvents(),flags:talkFlags()})}
function talkChip(who){const p=GameState.progress,n=p.npcs?.[who];let tier='stranger';try{tier=tierFor(p.standing,who)}catch(_){}return tier[0].toUpperCase()+tier.slice(1)+(n?' · '+moodWord(n.mood):'')}
function talkEffects(who,effects){const p=GameState.progress,d=npcDay(),npcs={...(p.npcs||{})};let npc=npcs[who],standing=p.standing;if(!npc)return;for(const e of effects){if(e.kind==='meet')npc=npcMeet(npc,d);else if(e.kind==='standing')standing=gainStanding(standing,who,e.amount,d);else if(e.kind==='mood')npc={...npc,mood:Math.max(0,Math.min(100,npc.mood+e.amount))};else if(e.kind==='topic')npc=npcTalk(npc,e.id,d)}npcs[who]=npc;GameState.progress={...p,npcs,standing}}
// The acts: a cast act name -> the game's transaction. Each does the transaction plus persist() and returns {text} | {error} | {handoff}; none touches #dialog, modal, clearWorldPanel or look.capture (review B1).
function collectAct(id){const r=collectOwed(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();audio.sweep('coins-pay');return {text:'Here you go: '+r.handed.map(t=>itemById(t)?.name||t).join(', ')+'.'}}
function skipAct(){const s=GameState.progress.starter;if(!(s&&!s.done&&s.step<=1))return {error:'The introduction has already moved on.'};GameState.progress={...GameState.progress,starter:skipStarter()};persist();return {text:'Introduction skipped.'}}
const TALK_ACTS={openStore:()=>atMarketCounter()?{handoff:()=>openStore()}:{error:'The market is closed. Return between 7 AM and 10 PM.'},gigBoard:()=>({handoff:()=>marketWork()}),shelves:()=>{const l=shelfLines();return {text:l.length?l:['The shelves are being restocked.']}},
 'hal.groceries':()=>halAct('groceries'),'hal.buy':()=>halAct('buy'),'walt.hire':t=>t.office?hireAct(t.office):{error:'Walt hires at the Ridgeline office.'},'walt.promote':t=>t.office?promoteAct(t.office):{error:'Ask Walt at the Ridgeline office.'},'walt.collect':t=>t.office?collectAct(t.office.employer):{error:'Ask Walt at the Ridgeline office.'},
 'cafe.hire':()=>dinerHireAct(),'cafe.clockin':()=>dinerClockAct(true),'cafe.clockout':()=>dinerClockAct(false),'cafe.promote':()=>promoteAct(dinerOffice()),'cafe.meal':()=>lifeAct('meal'),'job.pickup':()=>jobAct('pickup'),'job.deliver':()=>jobAct('deliver'),skipStory:()=>skipAct()};
function talkRunActs(t,r){const out={texts:[],handoff:null},done=new Set();for(const e of r.effects){if(e.kind!=='act'||done.has(e.id))continue;done.add(e.id);const f=TALK_ACTS[e.id];if(!f)continue;const a=f(t)||{};if(a.error)return {error:a.error};if(a.handoff)out.handoff=a.handoff;for(const x of [].concat(a.text||[]))if(x)out.texts.push(x)}return out}
function talkShow(lines,texts){for(const l of lines)talkPanel.append(l);for(const x of texts)talkPanel.append({who:'system',text:x})}
// talkWith(who, actor, place, {office, at, lead}) opens the panel; false when the person has no cast (the caller keeps its old #dialog talk). place: counter, cafe, office, door, farm or street.
function talkWith(who,actor,place,o={}){const cast=castOf(who);if(!cast||!npcById(cast.id)||!$('talk'))return false;const id=cast.id,s0=GameState.progress.starter;
 if(talkNow)talkPanel.close();if(!talkPanel)talkPanel=createTalkPanel($('talk'),{onPick:talkPick,onClose:talkClosed});
 if(id==='noah'&&s0&&!s0.done&&s0.step===0)storyEvent('read-message'); // H7: his phone message counts as read, so a pickup cannot stall the story at step 0
 if(id==='walt'&&o.office?.employer==='ridgeline')storyEvent('note-given'); // before the context, so Walt sees steps 7/8 and reads Hal's note
 const t={who:id,cast,actor:actor||null,place,office:o.office||null,at:o.at||null,from:{x:me.position.x,z:me.position.z},shop,inside,slotId:actor?crowdSlotId(actor):null,session:null,handoff:false},r=openConversation(cast,id,talkCtx(t));if(!r.lines.length&&r.ended)return false;
 npcKeep(registerTalk(GameState.progress,id,npcDay())); // one talk counts once (talk, met, standing +1 capped at 3 a day), as recordTalk did; recordTalk('hal') is gone
 const a=talkRunActs(t,r);t.session=r.session;talkEffects(id,r.effects.filter(e=>e.kind!=='act'));talkNow=t;
 phone?.close();inventoryUI?.close();storeUI?.close();if(!$('dialog').hidden){$('dialog').hidden=true;clearWorldPanel();modal=false}keys.clear();
 talkPanel.show({name:cast.name,chip:talkChip(id),lines:o.lead?[{who:'system',text:o.lead}]:[],replies:r.ended?[]:r.replies});talkShow(r.lines,a.error?[a.error]:a.texts);talkPanel.setClock(formatClock(hudMinutes()));talkChev.on=false;talkChev.min=-1;look.release();persist();return true}
// One reply. The act runs FIRST (review B1): on {error} the error is shown and the old session and replies stay; only a success commits the new session, its effects and its lines.
function talkPick(id){const t=talkNow;if(!t||!t.session)return;clearTimeout(talkTimer);const r=chooseReply(t.session,t.cast,id,talkCtx(t));
 if(!r.echo){talkPanel.setReplies(r.replies);return}
 const a=talkRunActs(t,r);if(a.error){talkPanel.append(r.echo);talkPanel.append({who:'system',text:a.error});return}
 t.session=r.session;talkEffects(t.who,r.effects.filter(e=>e.kind!=='act'));talkPanel.append(r.echo);talkShow(r.lines,a.texts);talkPanel.setChip(talkChip(t.who));persist();
 if(a.handoff){t.handoff=true;talkPanel.close();a.handoff();return}
 if(r.ended){talkPanel.setReplies([]);if(!a.texts.length)talkTimer=setTimeout(()=>{if(talkNow===t)talkPanel.close()},1500);return}
 talkPanel.setReplies(r.replies)}
// The panel closed (Continue, Esc after an end, walking away, a hand-off, the pause menu): the memory is written from the STORED mem, never from the flagged view.
function talkClosed(){const t=talkNow;if(!t)return;talkNow=null;clearTimeout(talkTimer);const p=GameState.progress,n=p.npcs?.[t.who];if(t.session&&n)GameState.progress={...p,npcs:{...p.npcs,[t.who]:withMem(n,remember(n.mem,t.session))}};
 if(t.actor){const pa=getMeWorldPosition(talkW),pb=t.actor.getWorldPosition(talkV);yaw=Math.atan2(pa.x-pb.x,pa.z-pb.z)+.45;pitch=.32;zoom=zoomTarget=5.8}look.resetMotion();persist();keys.clear();if(!t.handoff)look.capture()}
// Every frame while talking (instead of the #dialog anchoring): walking more than 3 m away (or the speaker more than 12 m off) says "See you" and closes; the speaking chevron is smoothed, one style write.
const crowdSlotId=actor=>npcCrowd.slots.find(s=>s.avatar.group===actor)?.id||null,roomOpen=()=>!shop||(officeByKey(shop)?officeOpen(officeByKey(shop)):shopOpen(shop,GameState.progress.routine)),actorShown=a=>{for(let p=a;p;p=p.parent){if(!p.visible)return false;if(p===scene||p===shops[shop]?.scene||p===home?.room?.scene)return true}return false};function actorGone(actor,slotId){if(!actor)return false;if(!actorShown(actor))return true;if(slotId){const s=npcCrowd.slots.find(q=>q.avatar.group===actor);if(!s||!s.owner||s.id!==slotId)return true}actor.getWorldPosition(talkV);getMeWorldPosition(talkW);return Math.hypot(talkW.x-talkV.x,talkW.z-talkV.z)>12||Math.abs(talkW.y-talkV.y)>4}const vehicleHit=()=>!inside&&!shop&&(driving.blocksWalker(me.position.x,me.position.z)||customerTruck.blocksWalker(me.position.x,me.position.z)||dockTruck.blocksWalker(me.position.x,me.position.z)||((customerTruck.phase==='in'||customerTruck.phase==='out')&&Math.hypot(customerTruck.mesh.position.x-me.position.x,customerTruck.mesh.position.z-me.position.z)<2.2)||((dockTruck.phase==='in'||dockTruck.phase==='out')&&Math.hypot(dockTruck.mesh.position.x-me.position.x,dockTruck.mesh.position.z-me.position.z)<2.2)),talkGone=t=>Math.hypot(me.position.x-t.from.x,me.position.z-t.from.z)>3||t.shop!==shop||t.inside!==inside||(shop&&!roomOpen())||driving.active||fork.on||actorGone(t.actor,t.slotId)||vehicleHit();function worldPanelFrame(){const w=worldPanel;if(talkGone(w)){closeWorldDialog();return}const anchor=screenAnchor(w.anchor(),camera,innerWidth,innerHeight,THREE.Vector3);if(anchor){const width=Math.min(320,innerWidth-24),height=$('dialog').offsetHeight||260;$('dialog').style.left=Math.max(12,Math.min(innerWidth-width-12,anchor.x+26))+'px';$('dialog').style.top=Math.max(12,Math.min(innerHeight-height-12,anchor.y-height*.55))+'px'}else{$('dialog').style.left='12px';$('dialog').style.top='100px'}}function talkFrame(){const t=talkNow,now=performance.now(),dt=Math.min(.1,Math.max(0,(now-talkChev.t)/1000));talkChev.t=now;
 const gone=talkGone(t);
 if(gone){if(t.session&&!t.session.ended){const r=chooseReply(t.session,t.cast,'bye',talkCtx(t));if(r.session)t.session=r.session}talkPanel.close();return}
 let a=null;if(t.actor){talkV.y+=2.15;a=screenAnchor(talkV,camera,innerWidth,innerHeight,THREE.Vector3)}else if(t.at){talkV.set(t.at.x,(t.at.y||1.5)+.5,t.at.z);a=screenAnchor(talkV,camera,innerWidth,innerHeight,THREE.Vector3)}
 if(a){if(talkChev.on){const k=1-Math.exp(-14*dt);talkChev.x+=(a.x-talkChev.x)*k;talkChev.y+=(a.y-talkChev.y)*k}else{talkChev.x=a.x;talkChev.y=a.y;talkChev.on=true}}else talkChev.on=false;talkPanel.moveChevron(talkChev.x,talkChev.y,!!a);
 const m=Math.floor(hudMinutes());if(m!==talkChev.min){talkChev.min=m;talkPanel.setClock(formatClock(hudMinutes()))}}
function buzzerPanel(page=0){const pc=pagedChoices(flatDoors(GameState.progress.npcs).map(d=>({id:d.id,label:'Knock · '+d.label})),page),choices=pc.items.map(d=>({label:d.label,run:()=>knockAt(d.id)}));if(pc.nextPage!==null)choices.push({label:'More flats',run:()=>buzzerPanel(pc.nextPage)});station({x:BUZZER.x,y:1.5,z:BUZZER.z},'Oak Street Apartments','Flat doors. Knock on one.',choices)}
function knockAt(id){const p=GameState.progress,r=npcById(id),at={x:BUZZER.x,y:1.5,z:BUZZER.z},res=r&&knock(p,id,{day:npcDay(),minute:p.routine?.minutes||0,plan:rosterPlanner.planOf(r.personId,p.housing?.day||1),seed:MAP.seed});if(!res)return;npcKeep(res.state);persist();
 if(res.talk){if(!talkWith(id,null,'door',{at,lead:res.text}))talkNamed(id,null,at,res.text)}else station(at,'Flat '+flatDoors(p.npcs).find(d=>d.id===id)?.flat,res.text,[{label:'Knock on another door',run:()=>buzzerPanel()}])}
// ---- W-D2: the egg run (gigs.js needs board; notes/world-system-design.md First slice). A need gig takes crates from Hal's pallet (the farm's egg stock goes down: world-state buy) and hands them over at the market door (the shelf goes up, pay, Noah's mood, standing). Only an owned crate-bed truck: never Hal's loan truck.
function worldDayPassed(){const before=GameState.progress.needs||[],plots0=GameState.progress.plots,co0=GameState.progress.companies?.ridgeline,yard0=GameState.progress.sawmillYard;GameState.progress=runWorldDay(GameState.progress);
 {const p=GameState.progress;if(p.plots!==plots0){for(const key of felledTrees(p))if(!plots0?.[key]||plots0[key].tree!==null){world.setFelled(key);const t=world.trees.get(key);if(t)minimap.invalidateAt(t.x,t.z)}regrowClock=99;syncMarks()}if(p.companies?.ridgeline!==co0)syncWarehouse();if(p.sawmillYard!==yard0)GameState.progress={...p,belt:beltOf(p)}}/* W3: the crew's stumps (at most 2, yesterday's block), its haul to the racks and the yard */const st=settleNeedGig(GameState.progress);if(st.text){GameState.progress=st.state;toast(st.text)}persist();for(const t of newsFor(before,GameState.progress.needs,2))notifyPhone('gigs',t)} // town news: at most 2 phone lines per tick
let bakeryTruck=null,bakeryDockMesh=null;
function syncBakeryCargo(){
 const p=GameState.progress,a=p.gigs?.active,bakery=a?.needId&&isBakeryGood(a.needGood);
 const loaded=bakery&&a.haul>0&&a.truck?a:null;
 if(bakeryTruck&&(!loaded||loaded.id!==bakeryTruck.id||loaded.truck!==bakeryTruck.truck)){const cargo=driving.cargoOf(bakeryTruck.truck);if(cargo?.some(c=>c.k==='bakery-pallet'&&c.j===bakeryTruck.id))driving.setCargo(bakeryTruck.truck,removeBakeryPallet(cargo,bakeryTruck.id));bakeryTruck=null}
 if(loaded){const saved=p.vehicles?.find(v=>v.uid===loaded.truck)?.cargo;const live=driving.cargoOf(loaded.truck);if(!live?.some(c=>c.k==='bakery-pallet'&&c.j===loaded.id)&&saved?.some(c=>c.k==='bakery-pallet'&&c.j===loaded.id))driving.setCargo(loaded.truck,saved);bakeryTruck=loaded}
 const parts=bakery?bakeryModels(a.needGood):null,stock=bakery&&!(a.haul>0)?parts?.[a.mode==='vehicle'?'pallet':'sack']:null;
 if(stock){if(!bakeryDockMesh){bakeryDockMesh=new THREE.Mesh(stock.geometry,stock.material);bakeryDockMesh.name='bakery-pickup-load';bakeryDockMesh.castShadow=bakeryDockMesh.receiveShadow=true;scene.add(bakeryDockMesh)}if(bakeryDockMesh.geometry!==stock.geometry){bakeryDockMesh.geometry=stock.geometry;bakeryDockMesh.material=stock.material}bakeryDockMesh.position.set(a.origin.x,heightAt(a.origin.x,a.origin.z)+.165,a.origin.z)}
 if(bakeryDockMesh)bakeryDockMesh.visible=!!stock&&!shop&&!inside;
}
let needCrateUid='',needPlankId='';
function syncNeedCargo(){const a=GameState.progress.gigs?.active,h=a?.needId&&a.haul>0&&a.truck&&!isBakeryGood(a.needGood)?a:null;syncBakeryCargo(); // every frame, cheap: the crates of the loaded run sit on the truck's deck; they leave with the gig
 if(h){needCrateUid=h.truck;const f=driving.byId.get(h.truck);if(!f)return;const bed=driving.cargoOf(h.truck);if(h.needGood==='planks'){needPlankId=h.needId;if(orderCount(bed,h.needId)===h.haul)return;const r=addPlanks(removeOrderPlanks(bed,h.needId).cargo,f.spec.model,h.haul,h.needId);if(!r.error)driving.setCargo(h.truck,r.cargo);return}needPlankId='';const want=Math.ceil(h.haul/(CRATE_UNITS[h.needGood]||1));if(countOf(bed,'crate')===want)return;const r=addNeedCrates(removeNeedCrates(bed).cargo,f.spec.model,want);if(!r.error)driving.setCargo(h.truck,r.cargo)}
 else if(needCrateUid){const f=driving.byId.get(needCrateUid);if(f){const bed=driving.cargoOf(needCrateUid);if(needPlankId){if(orderCount(bed,needPlankId))driving.setCargo(needCrateUid,removeOrderPlanks(bed,needPlankId).cargo)}else if(hasCrates(bed))driving.setCargo(needCrateUid,removeNeedCrates(bed).cargo)}needCrateUid='';needPlankId=''}}
function crateTruckNear(pt,r){let best=null;for(const v of GameState.progress.vehicles||[]){if(v.loan||!takesCrateGigs(v.model))continue;const f=driving.byId.get(v.uid);if(!f)continue;const d=Math.hypot(f.state.x-pt.x,f.state.z-pt.z);if(d<r&&(!best||d<best.d))best={uid:v.uid,model:v.model,d}}return best}function plankTruckNear(pt,r){let best=null;for(const v of GameState.progress.vehicles||[]){if(v.loan||!hasBed(v.model))continue;const f=driving.byId.get(v.uid);if(!f)continue;const d=Math.hypot(f.state.x-pt.x,f.state.z-pt.z);if(d<r&&(!best||d<best.d))best={uid:v.uid,model:v.model,d}}return best}
const pedObs=[],pedPool=[],talkA=new THREE.Vector3(),talkB=new THREE.Vector3(),talkMid=new THREE.Vector3(); // audit B9: reused every frame (the driving step and the talk camera used to allocate a filtered/mapped array and three Vector3s per frame)
function pedObstacles(){let n=0;for(const p of pedestrians.people){if(!p.group.visible)continue;const o=pedPool[n]||(pedPool[n]={x:0,z:0,r:.45});o.x=p.group.position.x;o.z=p.group.position.z;pedObs[n++]=o}pedObs.length=n;return pedObs}
const destShopId=a=>String((a?.needId||'').split('|')[1]||'shop:market').replace(/^shop:/,''),keeperName=a=>destShopId(a)==='cafe'?'Elena':'Noah',needDest=a=>{const q=a?.places?.[0];return destShopId(a)!=='market'&&q&&Number.isFinite(q.x)&&Number.isFinite(q.z)?{x:q.x,z:q.z}:STORY_PLACES.market}; // audit A F3: a cafe restock is handed over at the cafe (its point, hours and keeper), not at the market
function needCandidates(add,p,s){const a=p.gigs?.active;if(!a?.needId||a.type!=='need-restock')return;
 if(isBakeryGood(a.needGood)){const point=a.haul>0?a.places[0]:a.origin;if(point)add(a.haul>0?'need-drop':'need-load',point,()=>new THREE.Vector3(point.x,1.3,point.z),a.haul>0?'Deliver to Ironwood Bakery':a.mode==='vehicle'?'Load the bakery pallet':'Pick up a bakery sack',a.haul>0?needDrop:needLoad,1.8);return}
 if(a.needGood==='planks'){const P=a.origin,D=a.places?.[0];if(!(a.haul>0)&&P)add('need-load',P,()=>new THREE.Vector3(P.x,1.3,P.z),'Load the planks onto the truck',needLoad,4);else if(a.haul>0&&D)add('need-drop',D,()=>new THREE.Vector3(D.x,1.3,D.z),'Unload the planks at '+(D.name||'the destination'),needDrop,6);return}if(!CRATE_UNITS[a.needGood]||(!s.done&&s.step===4))return;const C=STORY_PLACES.crates,M=needDest(a); // the story's own crate beat (step 4) keeps its prompts
 if(!(a.haul>0))add('need-load',C,()=>new THREE.Vector3(C.x,1.3,C.z),'Load the crates onto the truck',needLoad,2.6);
 else add('need-drop',M,()=>new THREE.Vector3(M.x,1.3,M.z),'Hand the crates to '+keeperName(a),needDrop,6)}
function needLoad(){const a=GameState.progress.gigs?.active;
 if(isBakeryGood(a?.needGood)){
  if(!shopOpen(WHOLESALE_ID,GameState.progress.routine)){toast('Eden Wholesale dock hours: '+hoursText(WHOLESALE_ID));return}
  const bay=wholesalePoint(WHOLESALE_TRUCK_BAY,WHOLESALE_POSE),t=a.mode==='vehicle'?crateTruckNear(bay,5):null;
  if(a.mode==='vehicle'&&!t){toast('Park your truck at the Wholesale dock.');return}
  const r=pickNeedCrates(GameState.progress,t?{uid:t.uid,bed:driving.cargoOf(t.uid),maxUnits:SACKS_PER_PALLET}:{});if(r.error){toast(r.error);return}
  stowTool();GameState.progress={...r.state,equipped:null};persist();toast(r.message);return
 }
 if(a?.needGood==='planks'){const P=a.origin,t=P&&plankTruckNear(P,9);if(!t){toast('Park a truck with a bed beside the sawmill yard first.');return}const bed=driving.cargoOf(t.uid);let n=crateCapacity(t.model,'planks');while(n>0&&addPlanks(removeOrderPlanks(bed,a.needId).cargo,t.model,n,a.needId).error)n-=4;const r=pickNeedCrates(GameState.progress,{uid:t.uid,maxUnits:n});if(r.error){toast(r.error);return}GameState.progress={...r.state,belt:beltOf(r.state)};syncNeedCargo();persist();toast(r.message);return}const C=STORY_PLACES.crates,t=crateTruckNear(C,CRATE_REACH);if(!t){toast('Park a truck with a bed beside the crates first.');return}
 const bed=driving.cargoOf(t.uid);if(!needCratesFit(bed)){toast(NEED_BED_BUSY);return}
 const good=GameState.progress.gigs.active.needGood;let n=crateCapacity(t.model,'crate');while(n>0&&addNeedCrates(removeNeedCrates(bed).cargo,t.model,n).error)n--;
 const r=pickNeedCrates(GameState.progress,{uid:t.uid,maxUnits:n*CRATE_UNITS[good]});if(r.error){toast(r.error);return}GameState.progress=r.state;syncNeedCargo();persist();toast(r.message)}
function needDrop(){const a=GameState.progress.gigs?.active,M=needDest(a),f=a?.truck&&driving.byId.get(a.truck);
 if(isBakeryGood(a?.needGood)){
  if(a.truck&&(!f||Math.hypot(f.state.x-M.x,f.state.z-M.z)>=MARKET_REACH)){toast('Bring the loaded truck to Ironwood Bakery.');return}
  const r=deliverNeedCrates(GameState.progress,{});if(r.error){toast(r.error);return}GameState.progress=r.state;persist();flashDone();audio.sweep('coins-pay');toast('Bakery delivery · '+money(r.paid)+' earned');return
 }
 if(a?.needGood==='planks'){const D=a.places?.[0]||M;if(!f||Math.hypot(f.state.x-D.x,f.state.z-D.z)>=MARKET_REACH){toast('Bring the truck to '+(D.name||'the destination')+' first.');return}const r=deliverNeedCrates(GameState.progress,{});if(r.error){toast(r.error);return}GameState.progress={...r.state,belt:beltOf(r.state)};syncNeedCargo();persist();flashDone();audio.sweep('coins-pay');toast(`Delivered ${r.units} planks · ${money(r.paid)} earned`+(r.tooFast?' (handling only: too fast)':''));notifyPhone('gigs',`${D.name||'Delivery'}: thanks for the planks.`);return}
 if(!shopOpen(destShopId(a),GameState.progress.routine)){toast(destShopId(a)==='market'?'The market has closed for today.':'The '+destShopId(a)+' has closed for today.');return}
 if(!f||Math.hypot(f.state.x-M.x,f.state.z-M.z)>=MARKET_REACH){toast('Bring the truck to '+(destShopId(a)==='market'?'the market':'the '+destShopId(a))+' first.');return}
 const r=deliverNeedCrates(GameState.progress,{});if(r.error){toast(r.error);return}const label=(WORLD_GOODS[a.needGood]?.label||'goods').toLowerCase();GameState.progress=r.state;syncNeedCargo();persist();flashDone();if(a.needGood==='eggs')pushRecent('egg-run');
 audio.sweep('coins-pay');toast(`Delivered ${r.units} ${WORLD_GOODS[a.needGood]?.unit||'unit'} of ${label} · ${money(r.paid)} earned`+(r.tooFast?' (handling only: too fast)':''));notifyPhone('gigs',r.needFilled?`${keeperName(a)}: the ${label} shelf is stocked again. Thank you.`:`${keeperName(a)}: thanks for the ${label}.`)}function storyCandidates(add){const p=GameState.progress,s=p.starter;if(!s||inside||shop)return;needCandidates(add,p,s);
 if(hal.visible&&halHere(p))add('hal',{x:hal.x,z:hal.z},()=>entityPoint(hal.group),'Talk to Hal',()=>{if(!talkWith('hal',hal.group,'farm'))talkHal()},2.4);
 if(s.done||s.step!==4)return;const C=STORY_PLACES.crates,M=STORY_PLACES.market;
 if(!s.loaded)add('story-load',C,()=>new THREE.Vector3(C.x,1.3,C.z),'Load the egg crates onto the truck',()=>{if(!loanNear(C,CRATE_REACH)){toast('Park the truck beside the crates first.');return}{const lu=GameState.progress.starter?.loanUid,bed=lu?driving.cargoOf(lu):null;if(!needCratesFit(bed)){toast(NEED_BED_BUSY);return}}storyKnocks=0;storyEvent('loaded')},2.6);
 else add('story-unload',M,()=>new THREE.Vector3(M.x,1.3,M.z),'Hand the egg crates to Noah',()=>{if(!loanNear(M,MARKET_REACH)){toast('Bring the truck to the market first.');return}if(storyEvent('delivered-crates',{quality:knockQuality(storyKnocks)})){storyKnocks=0;pushRecent('egg-run')}},6)} // 6 m: the prompt must show anywhere at the market front (it was 3.2 and missed the street side); the truck check inside is the real gate
function storyAimed(o){if(o.kind!=='door'||inside||shop)return o;const so=starterObjective(GameState.progress),pt=so&&so.aim!=='market'?aimPoint(so.aim):null;return pt?{...o,aim:pt,beacon:{x:pt.x,z:pt.z,y:standHeight(pt.x,pt.z),lift:.7,hideWithin:2.4}}:o}
// G3: the story ticks and Hal live above (storyTick, storyCandidates, halChoice)
function skipChoice(){const p=GameState.progress,s=p.starter;return s&&!s.done&&s.step<=1?[{label:'Skip the introduction',run:()=>speak(shops.market.clerk.group,'Noah','If you skip, there is no story and no truck from Hal. He will sell you one for \$'+SKIP_SALE_PRICE/100+' later. Skip anyway?',[{label:'Yes, skip it',run:()=>{GameState.progress={...GameState.progress,starter:skipStarter()};persist();toast('Introduction skipped.')}},{label:'No, keep going',run:()=>{}}])}]:[]}
const toastQueue=[];let toastShowing=false;let toastSoundAt=0;const toastSound=()=>{const n=performance.now();if(n-toastSoundAt>1500){toastSoundAt=n;audio.sweep('ui-toast')}};
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
function jobAct(action){if(action==='pickup'&&!shopOpen('market',GameState.progress.routine))return {error:'The market has closed for today.'};const result=transactJob(GameState.progress,action,me.position,{shop});if(result.error)return {error:result.error};GameState.progress=result.state;persist();if(action==='deliver'){if(storyEvent('delivered'))pushRecent('delivered:sophie');flashDone();if(result.paid)audio.sweep('coins-pay')}return {result,text:result.paid?money(result.paid)+' earned · delivery completed':'Order collected. Follow the marker to your customer.'}}
function finishJob(action){
 const r=jobAct(action);if(r.error){toast(r.error);return}const result=r.result;
 $('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
 // C6: the transaction, the story beat and flashDone are in jobAct (shared with the talk acts)
 toast(result.paid?`${money(result.paid)} earned · delivery completed`:'Order collected. Follow the marker to your customer.');
}
function enterHome(target=studioHome){target.room.frontDoor?.snap(false);  if(target.kind==='studio'&&!GameState.progress.housing.rented)return;persist();audio.sweep('door-close');home=target;home.room.setFloor?.(0);inside=true;if(home.kind==='house')zoom=zoomTarget=9;home.room.scene.add(player);setMePosition(home.ENTRY.x,.02,home.ENTRY.z);yaw=0;pitch=home.kind==='house'?.85:.4;camera.position.set(home.ENTRY.x,3,home.ENTRY.z+5.5);$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
}
let leaveAfter=0;function leaveHomeSwing(){const d=home.room.frontDoor;if(!d||leaveAfter>0){if(!d)leaveHome();return}d.setOpen(true);leaveAfter=.5;audio.sweep('door-open')} // the door swings open, then you step outside (updateDoors)
function leaveHome(){home.room.frontDoor?.snap(false);leaveAfter=0;doorCooldown=2;look.resetMotion();inside=false;scene.add(player);const out=home.kind==='studio'?{x:STUDIO.x,z:STUDIO.z,yaw:0,y:.165}:{...home.outside,y:standHeight(home.outside.x,home.outside.z)};setMePosition(out.x,out.y,out.z);yaw=out.yaw;camera.position.set(out.x+Math.sin(out.yaw)*5,3,out.z+Math.cos(out.yaw)*5);home.room.setFloor?.(0);if(home.kind==='house')zoom=zoomTarget=7;home=studioHome;persist();keys.clear()}
 function enterHouse(id){enterHome(houseHome(id))}
 function changeFloor(n){const st=home.STAIRS;if(!st)return;home.room.setFloor(n);setMePosition(st.x,n*home.room.FLOOR_HEIGHT+.02,n?st.topZ+.1:st.footZ);look.resetMotion();keys.clear()}
function changeHousing(action){
 if(action==='rest'){startSleep();return}
 const result=housingTransaction(GameState.progress,action,{atEntrance:!inside&&!shop&&nearby(me.position,STUDIO),atBed:inside&&!shop&&Math.hypot(me.position.x-home.BED.x,me.position.z-home.BED.z)<1.4});
 if(result.error){toast(result.error);return}GameState.progress=result.state;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
 if(action==='rent'){audio.sweep('cash-register');toast('Keys received · Studio 2B is yours to rent.');enterHome();storyEvent('rented')}
 else{audio.sweep('cash-register');toast('Bills paid.')}
}
function showBills(){const h=GameState.progress.housing,due=totalDue(h);showDialog('HOME / WEEK '+weekNumber(h.day),'Your weekly bills.',h.rented?'Unpaid rent: '+money(h.rentDue)+'. Unpaid utilities: '+money(h.utilitiesDue)+'. Next bill: '+weekday(h.nextBillDay)+' (Week '+weekNumber(h.nextBillDay)+'), in '+dueIn(h)+' days. Weekly rent is $60; estimated utilities are '+money(estimatedUtilities(h))+' ($7 base for the older studio, plus $0.15 per home-cooked meal). No offline charges.':'Visit 18 Oak Street. Move-in is $90: a $30 deposit and $60 for your first week. Utilities start at $7 per week.','Total due '+money(due)+' · cash after payment '+money(GameState.progress.cash-due),due?()=>changeHousing('pay'):null,due?'Pay bills · '+money(due):'')}
$('billsButton').onclick=()=>{if(active&&!creatorOpen){phone?.close();showBills()}}; // Home & bills lives on the phone's Bank screen
function extraAction(label,action){$('extraAction').hidden=false;$('extraAction').textContent=label;$('extraAction').onclick=action}
function roomDoorShown(room,v){if(room.exitDoor?.group)room.exitDoor.group.visible=v;for(const m of room.doorBits||[])m.visible=v} // a shop room's own doorway (exit door, glass pane, frame posts, handle) shows only from inside
function enterShop(kind,entry=SHOP_ENTRY){if(!shopOpen(kind,GameState.progress.routine)){toast(`${SHOPS[kind].name} hours: ${hoursText(kind)}`);return}persist();shop=kind;shops[kind].scene.visible=true;shops[kind].exitDoor.manual&&shops[kind].exitDoor.snap(false);roomDoorShown(shops[kind],true);audio.sweep('shop-bell');shops[kind].scene.add(player);setMePosition(entry.x,.02,entry.z);yaw=0;pitch=.4;const origin=shops[kind].scene.position;camera.position.set(origin.x,2.4,origin.z+4.2);$('dialog').hidden=true;clearWorldPanel();keys.clear()}
function enterOffice(o){persist();shop=o.key;if(o.kind==='warehouse'){syncWarehouse();loadForklift(o.room);updateFork()}o.room.exitDoor.manual&&o.room.exitDoor.snap(false);o.room.scene.visible=true;o.room.scene.add(player);{const en=o.interior.entry||SHOP_ENTRY;setMePosition(en.x,.02,en.z);yaw=0;pitch=.4;camera.position.set(o.interior.origin.x,3,o.interior.origin.z+en.z+5.1)}$('dialog').hidden=true;clearWorldPanel();keys.clear()}
function leaveOffice(){const o=officeByKey(shop);doorCooldown=2;look.resetMotion();busy=null;for(const mesh of o.room.occluders){mesh.material.opacity=1;mesh.material.depthWrite=true}o.room.scene.visible=false;shop=null;scene.add(player);setMePosition(o.door.out.x,standHeight(o.door.out.x,o.door.out.z),o.door.out.z);me.rotation.y=o.door.yaw;yaw=0;pitch=.4;camera.position.set(o.door.out.x+1,3,o.door.out.z+7);persist();keys.clear()}
function leaveShop(exitX=0){if(officeByKey(shop)){leaveOffice();return}doorCooldown=2;look.resetMotion();busy=null;const room=shops[shop];roomDoorShown(room,false);for(const mesh of [...room.occluders,...(shopShells[shop]||[])]){mesh.material.opacity=1;mesh.material.depthWrite=true}if(shop===WHOLESALE_ID){room.scene.visible=false;shop=null;scene.add(player);setMePosition(wholesaleApproach.x,standHeight(wholesaleApproach.x,wholesaleApproach.z),wholesaleApproach.z);camera.position.set(wholesaleApproach.x,3,wholesaleApproach.z+6);persist();keys.clear();return}const door=SHOPS[shop],dw=MAP.shops[shop].doorway;shop=null;scene.add(player);setMePosition(door.x+Math.max(-dw.exit.clamp,Math.min(dw.exit.clamp,exitX)),.165,dw.exit.z);camera.position.set(door.x,3,door.z+6);persist();keys.clear()}
function lifeAct(action){const place=shop||(inside?'home':null);const atCounter=shop&&Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)<1.6;const atKitchen=inside&&(home.room.floor||0)===0&&Math.hypot(me.position.x-home.KITCHEN.x,me.position.z-home.KITCHEN.z)<1.5;if(shop&&!shopOpen(shop,GameState.progress.routine))return {error:'The shop has closed. Please return tomorrow.'};if(!atCounter&&!atKitchen)return {error:'Move closer to the counter.'};const r=lifeTransaction(GameState.progress,action,place);if(r.error)return {error:r.error};GameState.progress=r.state;if(action==='cook'&&home.kind==='studio'&&GameState.progress.housing.rented)GameState.progress.housing.utilityUsage+=15;persist();if(action==='meal'){storyEvent('ate');audio.sweep('eat-bite');audio.sweep('cash-register')}return {text:r.message}}
function useLife(action){const r=lifeAct(action);if(r.error){toast(r.error);return}$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();toast(r.text)}

function nearestPerson(){return pedestrians.people.find(p=>p.group.visible&&Math.hypot(me.position.x-p.group.position.x,me.position.z-p.group.position.z)<1.5)}
const dinerOffice=()=>({employer:'diner',room:shops.cafe}); // diner D-A2: Elena's counter is the diner's office (hireAct, promoteAct and interview take {employer, room})
function dinerHireAct(){const r=hireAct(dinerOffice());if(!r.error)notifyPhone('jobs','Elena: Welcome to the crew! Clock in on your phone (Jobs) or with me at the counter from 8 AM.');return r}
function dinerClockAct(on){if(on){const r=doClockIn('diner');return r.error?{error:r.error}:{text:'Clocked in. Take the orders at the tables, collect them at the pass, serve and clear.'}}if(GameState.progress.shift?.employer!=='diner')return {error:'You are not clocked in here.'};const r=doClockOut();if(r.error)return {error:r.error};pushRecent('cafe-shift');return {text:r.message}}
function worldPoint(point,parent=player.parent){return parent.localToWorld(new THREE.Vector3(point.x,point.y??1.2,point.z))}
function entityPoint(actor){const p=actor.getWorldPosition(new THREE.Vector3());p.y+=1.9;return p}
function showWorld(anchor,name,text,choices=[],actor=null){
 if(sleepElapsed!==null||consuming)return;showDialog(name,'',text,'',choices[0]?.run,choices[0]?.label);worldPanel={anchor,actor,from:{x:me.position.x,z:me.position.z},shop,inside,slotId:actor?crowdSlotId(actor):null};dialogTalking=true;$('dialog').classList.add('in-world');$('closeDialog').textContent=actor?'See you':'Close';
 if(choices[1])extraAction(choices[1].label,choices[1].run);if(choices[2]){$('thirdAction').hidden=false;$('thirdAction').textContent=choices[2].label;$('thirdAction').onclick=choices[2].run}
 $('dialog').classList.remove('bubble-enter');void $('dialog').offsetWidth;$('dialog').classList.add('bubble-enter');
}
function speak(actor,name,text,choices=[]){showWorld(()=>entityPoint(actor),name,text,choices,actor)}
function station(point,name,text,choices){showWorld(()=>worldPoint(point),name,text,choices)}
// The owner of a company at its office (0.35, DESIGN 4.15): the interview that hires you, promotions, tools waiting for you, and how a shift works.
function ownerMenu(o){if(o.employer==='ridgeline')storyEvent('note-given');const id=o.employer,p=GameState.progress,actor=o.room.clerk.group,owner=ownerOf(p,id).name,company=employerName(p,id),c=careerOf(p,id),e=employerById(id),choices=[];
 if(!c.hired)choices.push({label:'I’m looking for work.',run:()=>speak(actor,owner,'Everyone starts at the bottom here. You get an axe, '+money(e.ranks[0].wage)+' an hour while you’re on our land, and a little for every log. Shifts run 6 AM to 6 PM, no night work.',[{label:'I’ll take it.',run:()=>interview(o)},{label:'Let me think about it.',run:()=>{}}])});
 else{const n=nextRank(p,id);if(n&&!n.top)choices.push({label:'Am I due a promotion?',run:()=>promotionTalk(o)});if(c.owed.length)choices.push({label:'Anything waiting for me?',run:()=>{const r=collectAct(id);if(r.error){toast(r.error);return}speak(actor,owner,r.text)}});
  choices.push({label:'How does a shift work?',run:()=>speak(actor,owner,'Clock in on your phone (Jobs) or at the time clock by the wall, from 6 AM to 5:30 PM. You’re paid by the hour while you’re on our land, plus for every log and plank. Do the day’s tasks for a bonus. I close at six.')})}
 speak(actor,owner,c.hired?'Good to see you, '+(GameState.me.name||'friend')+'.':'Morning. '+company+'. Can I help you?',choices)}
function hireAct(o){const id=o.employer,r=hire(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();
 if(id==='diner'){toast('Hired · '+employerName(GameState.progress,id)+' · '+r.rank.name);return {text:'Welcome aboard! You start as a Waiter. Clock in on your phone (Jobs) or with me at the counter, take the orders at the tables, collect them at the pass and clear the tables afterwards.'}}
 const lines=['You’re on the crew.',r.handed.length?'Here’s your '+r.handed.map(t=>(itemById(t)?.name||t).toLowerCase()).join(' and ')+'.':'',r.owed.length?'Your bag is full: come back for your '+r.owed.map(t=>(itemById(t)?.name||t).toLowerCase()).join(' and ')+'.':'',r.boughtBack?'I’ll take those '+r.boughtBack.count+' logs off you too: '+money(r.boughtBack.earned)+'.':'','Clock in from your phone, and start with the marked pines.'].filter(Boolean);
 toast('Hired · '+employerName(GameState.progress,id)+' · '+r.rank.name);return {text:lines.join(' ')}}
function interview(o){const r=hireAct(o);if(r.error){toast(r.error);return}speak(o.room.clerk.group,ownerOf(GameState.progress,o.employer).name,r.text)}
function promoteAct(o){const id=o.employer,p=GameState.progress,n=nextRank(p,id);
 if(!n||n.top)return {text:'You’re as high as I can put you.'};
 if(!n.ready){const need=[];if(!n.met.level)need.push('level '+n.needs.level+' (you’re '+n.have.level+')');if(!n.met.shifts)need.push(n.needs.shifts+' shifts worked (you’ve done '+n.have.shifts+')');if(!n.met.rep)need.push('a reputation of '+n.needs.rep+' (yours is '+n.have.rep+')');return {text:'Not yet. To be a '+n.rank.name+' I want '+need.join(', ')+'.'}}
 const r=promote(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();audio.sweep('level-up');toast('Promoted · '+r.rank.name);pushRecent('promoted');
 return {text:'You’ve earned it. You’re a '+r.rank.name+' now: '+money(r.rank.wage)+' an hour'+(r.handed.length?', and this is for you: '+r.handed.map(t=>itemById(t)?.name||t).join(', ')+'.':'.')+(r.owed.length?' Your bag is full, so come back for the '+r.owed.map(t=>itemById(t)?.name||t).join(', ')+'.':'')}}
function promotionTalk(o){const r=promoteAct(o);if(r.error){toast(r.error);return}speak(o.room.clerk.group,ownerOf(GameState.progress,o.employer).name,r.text)}
// The company store (shelf at the back right): what only the company sells, with the price and who it is sold to. Up to three things on offer at once (the dialog's three buttons).
function companyStore(o){const id=o.employer,p=GameState.progress,actor=o.room.clerk.group,owner=ownerOf(p,id).name,list=storeItems(id).slice(0,3);
 const choices=list.map(({item})=>({label:'Buy the '+item.name+' · '+money(item.price),run:()=>{const r=buyFromCompany(GameState.progress,id,item.id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message+' '+money(item.price)+' paid.')}}));
 const lines=list.map(({item,rank})=>{const e=employerById(id),why=storeLine(p,id,item.id),lvl=item.requires?' · level '+item.requires.level:'';return item.name+' '+money(item.price)+' ('+e.ranks[rank-1].name+lvl+')'+(why.error?' — '+why.error:'')});
 showWorld(()=>worldPoint({x:OFFICE_STORE.x,y:1.9,z:OFFICE_STORE.z}),'Company store',list.length?lines.join(' · ')+'.':'Nothing on the shelves.',choices)}
function noticeBoard(o){const p=GameState.progress,sh=p.shift;station({x:OFFICE_BOARD.x,y:1.7,z:OFFICE_BOARD.z},'Notice board',sh&&sh.employer===o.employer?'Today’s tasks: '+sh.tasks.map(taskText).join(' · ')+'.':'Shifts run 6 AM to 6 PM. Clock in on your phone or at the time clock, and the day’s tasks go up here.',[])}
function managerMenu(){const p=GameState.progress,c=careerOf(p,'diner'),actor=shops.cafe.clerk.group,on=p.shift?.employer==='diner',choices=[],tell=r=>toast(r.error||r.text); // the fallback when Elena's cast does not open: the same choices as her talk
 if(p.phase==='carrying'&&p.completed%3===1)choices.push({label:'I have your delivery.',run:()=>speak(actor,'Elena','Perfect, that’s our produce order. Thank you!',[{label:'Hand over order · '+money(routeFor(GameState.progress).pay),run:()=>finishJob('deliver')}])});
 if(!c.hired)choices.push({label:'Are you hiring?',run:()=>speak(actor,'Elena','Yes! I need waiters: '+money(employerById('diner').ranks[0].wage)+' an hour plus tips. You take orders, serve the tables and clear them. Do well and you move up to the espresso bar and the kitchen.',[{label:'I’d like the job.',run:()=>interview(dinerOffice())},{label:'Let me think about it.',run:()=>{}}])});
 else{choices.push(on?{label:'I’m ready to clock out.',run:()=>tell(dinerClockAct(false))}:{label:'I’m here for my shift.',run:()=>tell(dinerClockAct(true))});if(choices.length<2)choices.push({label:'Am I due a promotion?',run:()=>promotionTalk(dinerOffice())})}
 choices.push({label:'I’d like lunch.',run:()=>speak(actor,'Elena','A sandwich and coffee is $6. Would you like one?',[{label:'Yes, please · $6',run:()=>useLife('meal')}])});
 speak(actor,'Elena','Hi there. What can I help you with?',choices);
}
function marketWork(){
 const actor=shops.market.clerk.group,route=routeFor(GameState.progress),first=GameState.progress.phase!=='carrying'&&GameState.progress.completed===0,offers=marketContracts(GameState.progress);
 speak(actor,'Noah',GameState.progress.phase==='carrying'?'You’ve already collected an order for '+route.name+'. Bring that one over first.':first?'Could you take this grocery order to '+route.name+'? They’ll pay you '+money(route.pay)+'.':offers.length?'Here is what the board has for today.':NO_WORK_POSTED,GameState.progress.phase==='carrying'?[]:[...(first?[{label:'Sure, I’ll take it.',run:()=>finishJob('pickup')}]:[]),...offers.map(o=>({label:'Gig: '+o.title+' · '+money(o.reward),run:()=>takeGig(o.id)})),...skipChoice()]);
}
// Noah at the counter: browse the store, or ask about delivery work (both used to be buried in the store window).
const unitText=(n,u)=>u==='dozen'||n===1?u:u==='loaf'?'loaves':u+'s';
function shelfLines(){const p=GameState.progress,w=p.world,m=p.routine?.minutes||0,pl='shop:market';if(!w)return [];return Object.keys(WORLD_PLACES[pl].goods).map(g=>{const n=stockAt(w,pl,g,m),d=WORLD_GOODS[g];return n>0?`${d.label}: In stock: ${n} ${unitText(n,d.unit)} at ${money(priceOf(w,pl,g,m))} a ${d.unit}`:`${d.label}: Sold out`})} // W-D2: the live shelf (stockAt) and price (priceOf)
function marketMenu(){const p=GameState.progress,hi=p.npcs?.noah&&p.world?moodLine(p.npcs.noah,p.world.day,MAP.seed):'';
 speak(shops.market.clerk.group,'Noah',hi||'Welcome to the Corner Market. What can I do for you?',[
  {label:'What is on the shelves?',run:()=>speak(shops.market.clerk.group,'Noah',shelfLines().join(' | ')||'The shelves are being restocked.',[{label:'Thanks.',run:marketMenu}])},
  {label:'View items for sale',run:()=>{$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();openStore()}},
  {label:'View jobs',run:marketWork}]);
}
function wholesaleCounter(){
 if(shop!==WHOLESALE_ID||Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)>=1.6)return;
 if(!shopOpen(WHOLESALE_ID,GameState.progress.routine)){toast('Eden Wholesale has closed for the day.');return}
 speak(wholesaleRoom.clerk.group,'Dana Sato','What can I get you?',RETAIL_GOODS.map(id=>{const item=itemById(id);return {label:item.name+' · '+money(item.price),run:()=>{
  if(shop!==WHOLESALE_ID||!shopOpen(WHOLESALE_ID,GameState.progress.routine)||Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)>=1.6)return;
  const r=commitInventory(addItem(GameState.progress,id,{purchase:true}));if(!r.error)audio.sweep('cash-register');toast(r.error||r.message);
 }}}));
}
function openStore(){if(!atMarketCounter()){toast('The market is closed. Return between 7 AM and 10 PM.');return}storeUI.open()}
// diner D-A2: one action of the shift (take, make, pick up, serve; bussing takes a moment). The rules are diner-flow.js dinerAct; this only shows the result.
function dinerRun(s){const r=dinerAct(GameState.progress,s.act,s.ref);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message);audio.sweep(r.sound);for(const f of r.finished||[])toast('Task done · '+f)}
function dinerDo(s){if(s.act!=='bus'){dinerRun(s);return}if(!canAct('work')){toast(refusal());return}busy={action:'bus',elapsed:0,duration:1.5,point:{x:s.x,z:s.z},label:'Clearing the table',run:()=>dinerRun(s)};keys.clear()}
// Hinged and double exit doors are worked by hand: E opens or shuts them, and you walk through while they are open (the sliding market door opens by itself).
function exitDoorOffer(add){const d=shops[shop]?.exitDoor;if(!d?.manual)return;const spec=(MAP.shops[shop]||officeByKey(shop)).interior.exitDoor;add('exit-door',{x:0,z:spec.z-1.1},()=>worldPoint({x:0,y:1.7,z:spec.z-.4}),d.isOpen?'Close the doors':'Open the doors',()=>{audio.sweep(d.toggle()?'door-open':'door-close')},1.9)}
function candidates(){const all=[],add=(id,point,anchor,label,run,range=1.5,key)=>all.push({id,point,anchor,label,run,range,key}); // key: the key shown on the prompt (E when missing; '' shows none)
 if(driving.active){add('exit-vehicle',{x:me.position.x,z:me.position.z},()=>new THREE.Vector3(me.position.x,me.position.y+2.4,me.position.z),driving.speed<1?'Get out':'Stop to get out',exitVehicle,9);return all} // driving: E gets you out (and nothing else is on offer)
 if(!shop&&fork.where==='outside'){if(fork.on){forkOffers(add);return all}if(forkView)add('wh-fork-out',{x:fork.state.x,z:fork.state.z},()=>worldPoint({x:fork.state.x,y:1.9,z:fork.state.z}),'Drive the forklift',getOnFork,2.7)} // the forklift left outside is driven from there
 if(shop&&officeByKey(shop)?.kind==='warehouse'){if(fork.on){forkOffers(add);return all}const pr=GameState.progress,racks=racksOf(pr),on=onRidgeline();
  if(pr.carry?.kind==='planks')for(const s of RACK_SLOTS)if(s.level<=HAND_LEVEL&&Math.hypot(s.stand.x-me.position.x,s.stand.z-me.position.z)<2.6)add('wh-rack-'+s.id,s.stand,()=>worldPoint({x:s.x,y:1.2,z:s.z}),`Stack the planks in rack ${s.id} · ${racks[s.id]||0} / ${RACK_CAP}`,()=>stackAtRack(s.id),1.3); // by hand only the floor level; the upper shelves are for the forklift
  {const co=pr.companies?.ridgeline,slots=stagingOf(co),need=slots.map(k=>k&&k.status==='taken'?k.planks-k.staged:0),ready=slots.find(k=>k&&k.kind==='pickup'&&k.status==='staged'),readyDel=slots.find(k=>k&&k.kind==='delivery'&&k.status==='staged');
   if(on&&!pr.carry&&(need.some(n=>n>0)||pr.shift?.tasks?.some(k=>k.kind==='stack'&&k.done<k.target)))for(const s of RACK_SLOTS)if(s.level<=HAND_LEVEL&&(racks[s.id]||0)>0&&Math.hypot(s.stand.x-me.position.x,s.stand.z-me.position.z)<2.6)add('wh-take-'+s.id,s.stand,()=>worldPoint({x:s.x,y:1.2,z:s.z}),`Take a stack from rack ${s.id} · ${racks[s.id]}${need.some(n=>n>0)?' · for your order':''}`,()=>takeFromRackNow(s.id),1.3);
   if(pr.carry?.kind==='planks')slots.forEach((k,i)=>{if(k&&need[i]>0){const p=WAREHOUSE_STAGING[i];add('wh-stage-'+k.id,p,()=>worldPoint({x:p.x,y:.9,z:p.z}),`Stage the planks on order #${k.id} · ${k.staged} / ${k.planks}`,()=>stageOnOrder(k.id),1.9)}});
   }
  if(forkView)add('wh-fork',{x:fork.state.x,z:fork.state.z},()=>worldPoint({x:fork.state.x,y:1.9,z:fork.state.z}),'Drive the forklift',getOnFork,2.7);
  {const w=coolerWait(pr,'warehouse');add('wh-cooler',WAREHOUSE_COOLER,()=>worldPoint({x:WAREHOUSE_COOLER.x,y:1.3,z:WAREHOUSE_COOLER.z}),w?'Water cooler · ready in '+w+' min':'Water cooler · free water',()=>drinkCooler('warehouse'),1.6)}
  add('wh-table',WAREHOUSE_TABLE,()=>entityPoint(officeByKey(shop).room.clerk.group),'Order table · '+(openTickets(pr.companies?.ridgeline).length||'no')+' open',orderTable,2.2);
  exitDoorOffer(add);return all}
 if(shop&&officeByKey(shop)){const o=officeByKey(shop),id=o.employer,c=careerOf(GameState.progress,id),owner=ownerOf(GameState.progress,id).name,onShift=GameState.progress.shift?.employer===id;
  add('office-owner',OFFICE_COUNTER,()=>entityPoint(o.room.clerk.group),'Talk to '+owner,()=>{if(id!=='ridgeline'||!talkWith('walt',o.room.clerk.group,'office',{office:o}))ownerMenu(o)},2.2);
  if(c.hired)add('office-clock',OFFICE_CLOCK,()=>worldPoint({x:OFFICE_CLOCK.x,y:1.9,z:OFFICE_CLOCK.z}),onShift?'Time clock · clock out':'Time clock · clock in',()=>{const r=onShift?doClockOut():doClockIn(id);if(r.error)toast(r.error);else if(onShift)toast(r.message)},1.6);
  {const w=coolerWait(GameState.progress,'office');add('office-cooler',OFFICE_COOLER,()=>worldPoint({x:OFFICE_COOLER.x,y:1.3,z:OFFICE_COOLER.z}),w?'Water cooler · ready in '+w+' min':'Water cooler · free water',()=>drinkCooler('office'),1.6)}
  add('office-store',OFFICE_STORE,()=>worldPoint({x:OFFICE_STORE.x,y:1.9,z:OFFICE_STORE.z}),'Company store',()=>companyStore(o),1.8);
  add('office-board',OFFICE_BOARD,()=>worldPoint({x:OFFICE_BOARD.x,y:2.2,z:OFFICE_BOARD.z}),'Notice board',()=>noticeBoard(o),1.7);exitDoorOffer(add);return all}
 if(shop===WHOLESALE_ID){const open=shopOpen(shop,GameState.progress.routine);if(open)add('wholesale-counter',COUNTER,()=>entityPoint(wholesaleRoom.clerk.group),'Buy ingredients',wholesaleCounter,1.6);return all}
 if(shop){add('clerk',COUNTER,()=>entityPoint(shops[shop].clerk.group),shop==='market'?'Talk to Noah':'Talk to Elena',shop==='market'?()=>{if(!talkWith('noah',shops.market.clerk.group,'counter')){recordTalk('noah');marketMenu()}}:()=>{if(!talkWith('elena',shops.cafe.clerk.group,'cafe')){recordTalk('elena');managerMenu()}},1.6);exitDoorOffer(add);
 if(shop==='cafe')for(const s of dinerSpots(GameState.progress))add('diner-'+s.id,{x:s.x,z:s.z},()=>worldPoint({x:s.x,y:s.act==='make'||s.act==='pickup'?1.4:1.3,z:s.z}),s.label,()=>dinerDo(s),s.range);return all} // diner D-A2: the tables and the pass (diner-flow.js dinerSpots)
 if(inside){const K=home.KITCHEN,B=home.BED,floor=home.room.floor||0,up=floor*(home.room.FLOOR_HEIGHT||0),st=home.STAIRS;
  if(floor===0){add('exit',home.EXIT,()=>worldPoint(home.kind==='studio'?{x:0,y:1.4,z:5.3}:{x:home.EXIT.x,y:1.4,z:home.EXIT.z+.15}),'Go outside',leaveHomeSwing);
   add('cook',{x:K.x,z:K.z},()=>worldPoint({x:K.x,y:1.3,z:K.z-1}),'Prepare a meal',()=>station({x:K.x,y:1.4,z:K.z-1},'Kitchen',GameState.progress.life.groceries+' grocery packs in your inventory.',[{label:'Cook a meal',run:()=>useLife('cook')}]));petCandidate(add)}
  if(floor===(home.BED_FLOOR||0))add('bed',B,()=>worldPoint({...B,y:.8+up}),'Sleep',()=>station({...B,y:1+up},'Take a rest?',(multiplayer.online?'Restore your energy fully. The clock keeps running while you are online.':'Sleep until 6:00 AM and restore your energy fully. You wake a little hungry and thirsty.'),[{label:'Rest and recover',run:()=>changeHousing('rest')}]),1.4);
  if(st){if(floor===0)add('up',{x:st.x,z:st.footZ},()=>worldPoint({x:st.x,y:1.4,z:st.footZ}),'Go upstairs',()=>changeFloor(1),1.5);else add('down',{x:st.x,z:st.topZ},()=>worldPoint({x:st.x,y:1.4+up,z:st.topZ}),'Go downstairs',()=>changeFloor(0),1.5)}
  return all}
 const gig=GameState.progress.activeJob;{const dr=GameState.progress.gigs?.active?.drop;if(dr&&Math.hypot(dr.x-me.position.x,dr.z-me.position.z)<2.6)add('parcel-pick',{x:dr.x,z:dr.z},()=>new THREE.Vector3(dr.x,.6+heightAt(dr.x,dr.z)+(world.floorAt(dr.x,dr.z)??0),dr.z),'Pick up the parcel',pickUpParcel,1.8)}
 {const ga=GameState.progress.gigs?.active;if(ga&&gigPickupHere(GameState.progress,me.position,currentRoom()))add('gig-pickup',{x:ga.origin.x,z:ga.origin.z},()=>new THREE.Vector3(ga.origin.x,.6+heightAt(ga.origin.x,ga.origin.z)+(world.floorAt(ga.origin.x,ga.origin.z)??0),ga.origin.z),'Pick up the parcel',pickUpGigAtOrigin,2)} // G-D: the box waits at the pickup point until E
 if(gig?.stage==='return'&&gig.dropped)add('phone-gig-wait',gig.returnLocation,()=>new THREE.Vector3(gig.returnLocation.x,1.4,gig.returnLocation.z),'Pick up the parcel first',()=>toast('Your parcel is on the ground. Pick it up first.'));else if(gig?.stage==='return')add('phone-gig',gig.returnLocation,()=>new THREE.Vector3(gig.returnLocation.x,1.4,gig.returnLocation.z),'Report back · collect '+money(gig.reward),()=>{
   if(parcelAwayNow()){toast(PARCEL_ON_BED);return}const dd=gigDoor(GameState.progress);if(dd){showWorld(()=>new THREE.Vector3(gig.returnLocation.x,1.4,gig.returnLocation.z),dd.name,dd.text,dd.choices.map(c=>({label:c.label,run:()=>{closeWorldDialog();const r=completeContract(GameState.progress,me.position,'street',c.tip);if(r.error){toast(r.error);return}GameState.progress=r.state;settleParcel();persist();storyEvent('gig-done');flashDone();audio.sweep('coins-pay');toast('Gig complete, '+money(r.paid)+' earned'+(c.tip?' (tip '+money(c.tip)+')':''))}})));return}const result=completeContract(GameState.progress,me.position);
   if(result.error){toast(result.error);return}
   if(result.failed){GameState.progress=result.state;settleParcel();persist();toast(result.closed?'That job was already taken care of.':'The gig could not be completed.');return}
    GameState.progress=result.state;settleParcel();persist();storyEvent('gig-done');flashDone();audio.sweep('coins-pay');toast('Gig complete · '+money(result.paid)+' earned');
 },1.35);

 add('home',{x:STUDIO.x,z:-8.1},()=>new THREE.Vector3(1,1.5,-8.15),GameState.progress.housing.rented?'Enter your studio':'View studio listing',()=>{if(GameState.progress.housing.rented)enterHome();else showWorld(()=>new THREE.Vector3(1,1.6,-8.15),'Studio 2B · To let','Furnished studio. $90 move-in includes a $30 deposit and the first week’s $60 rent. Utilities start at $7 per week.',[{label:'Rent studio · $90',run:()=>changeHousing('rent')}])},2.8);
 if(GameState.progress.phase==='carrying'&&GameState.progress.completed%3!==1){const r=routeFor(GameState.progress);add('delivery',r,()=>new THREE.Vector3(r.x,1.3,r.z),'Leave delivery · '+money(r.pay),()=>station(r,'Delivery collection box','Order for '+r.name+'. Payment: '+money(r.pay)+'.',[{label:'Place order & collect payment',run:()=>finishJob('deliver')}]),1.4)}
 storyCandidates(add);for(const person of pedestrians.people)if(person.group.visible)add('talk:'+pedPid(person.name),person.group.position,()=>entityPoint(person.group),'Talk to '+person.name,pedRoster.has(person.name)?()=>{if(!talkWith(pedRoster.get(person.name),person.group,'street'))talkNamed(pedRoster.get(person.name),person.group)}:()=>talkWith(pedPid(person.name),person.group,'street')||speak(person.group,person.name,'Hey! How’s your day going?',[{label:'Any advice for someone new?',run:()=>speak(person.group,person.name,person.line)},{label:'Nice to meet you.',run:()=>speak(person.group,person.name,'You too. See you around the neighborhood!')}]),1.5);
 if(!inside&&!shop){add('flat-buzzers',{x:BUZZER.x,z:BUZZER.z},()=>new THREE.Vector3(BUZZER.x,1.5,BUZZER.z),'Knock on a flat door',()=>buzzerPanel(),1.6);const near=npcCrowd.talkable(me.position.x,me.position.z,2.2,null);if(near)for(const t of near)if(!pedRoster.has(t.name)&&!all.some(c=>c.id==='talk:'+t.id))add('talk:'+t.id,{x:t.x,z:t.z},()=>entityPoint(t.group),'Talk to '+t.name,rosterPersonIds.has(t.id)?()=>{const rid=rosterByPersonId(t.id).id;if(!talkWith(rid,t.group,'street'))talkNamed(rid,t.group)}:()=>{if(!talkWith(t.id,t.group,'street'))talkCrowd(t)},1.6)} // W-D3: pooled crowd people who are roster members can be talked to
 if(!inside&&!shop){
  const pump=fuel.pumpAt(me.position.x,me.position.z,USE_RANGE_M);
  if(pump){const at=()=>new THREE.Vector3(pump.use.x,1.2,pump.use.z);
   if(fuel.held===pump)add('fuel-hang-'+pump.id,{x:pump.holster.x,z:pump.holster.z},()=>new THREE.Vector3(pump.holster.x,1.4,pump.holster.z),'Hang the nozzle back',()=>hangNozzle(),2.2,'H'); // at the holster, so a tank cap you stand at (the fill prompt) wins over it
   else if(!fuel.held&&GameState.progress.equipped==='gas-can'){const can=canOf(GameState.progress),wrong=can.mgal>0&&can.fuel!==pump.fuel,full=can.mgal>=CAN_CAPACITY_MGAL; // the gas can in hand: hold F at the pump to fill it (no nozzle)
    add('can-fill-'+pump.id,pump.use,at,full?'Gas can full':wrong?`Your can holds ${fuelName(can.fuel)}`:`Hold to fill the gas can · ${pump.price}`,()=>toast(full?'The can is full.':wrong?`This can holds ${fuelName(can.fuel)}.`:'Hold F to fill the can.'),USE_RANGE_M,!wrong&&!full?'F':'')}
   else if(!fuel.held)add('fuel-take-'+pump.id,pump.use,at,`Take the ${pump.label} nozzle · ${pump.price}`,()=>takeNozzle(pump),USE_RANGE_M,'H')}
  kitOffers(add);garageOffers(add);
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
   add('sawmill-switch',sawmillCtl.switchPoint,sawmillCtl.promptPoint,switchLabel({on:!!pr.sawmillYard?.on})+' · '+yardLine(pr.sawmillYard),toggleSawmill,2.2);
   {const k=pr.carry?.kind;if(k==='log'||k==='trunk')add('sawmill-feed',sawmillCtl.logPoint,sawmillCtl.logPrompt,k==='trunk'?'Put the trunk on the bench · 2 slabs':pr.carry.count===2?'Put the two logs on the bench':'Put the log on the bench',feedSawmill,2.4)} // T-E: a trunk is sawn whole into slabs
   {const sl=(pr.sawmillYard?.slabs||0)>0&&!pr.carry?slabTakeAt():null;if(sl)add('hut-slabs',sl.point,sl.anchor,'Take a slab from the lumber hut · '+pr.sawmillYard.slabs+' in the hut',takeYardSlab,HUT_REACH)} // timber storage: boards and slabs are taken from the lumber hut only
   const pile=(pr.sawmillYard?.planks||0)>0&&!pr.carry?yardTakeAt():null;if(pile)add('hut-boards',pile.point,pile.anchor,'Take '+Math.min(YARD_STACK,pr.sawmillYard.planks)+' boards from the lumber hut · '+pr.sawmillYard.planks+' in the hut',takeBeltPlanks,HUT_REACH);
   for(const d of pr.plankDrops)if(Math.hypot(d.x-me.position.x,d.z-me.position.z)<2.6)add('planks-'+d.id,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,.8+heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0),d.z),'Pick up '+d.count+' planks',()=>pickPlanks(d.id),1.8)}
  {const pr=GameState.progress,k=pr.carry?.kind;if(k==='planks'||k==='slab'){const pt=nearestOn(hutRect(HUT_DECK),me.position.x,me.position.z),y=pr.sawmillYard||{},full=k==='slab'?(y.slabs||0)>=YARD_MAX_SLABS:(y.planks||0)>=YARD_MAX_PLANKS; // timber storage: boards and slabs go INTO the lumber hut (E here, or X beside it)
   add('hut-store',pt,()=>new THREE.Vector3(pt.x,1.6+heightAt(HUT.x,HUT.z),pt.z),full?'The lumber hut is full · '+(k==='slab'?(y.slabs||0)+' slabs':(y.planks||0)+' boards'):k==='slab'?'Put the slab in the lumber hut · '+(y.slabs||0)+' / '+YARD_MAX_SLABS:'Put the '+pr.carry.count+' boards in the lumber hut · '+(y.planks||0)+' / '+YARD_MAX_PLANKS,storeInHut,HUT_REACH)}}
  // Doors of houses (properties.js): every one is locked until its owner is you, and the inside does not exist yet.
  for(const door of doorsNow()){if(door.id===WHOLESALE_ID){const open=shopOpen(WHOLESALE_ID,GameState.progress.routine);add('door-'+door.id,wholesaleApproach,()=>new THREE.Vector3(wholesaleDoor.x,1.4,wholesaleDoor.z),open?door.label:'Eden Wholesale · Closed',open?()=>startDoorFade(()=>enterShop(WHOLESALE_ID)):()=>toast('Eden Wholesale hours: '+hoursText(WHOLESALE_ID)),1.7);continue}add('door-'+door.id,door,()=>new THREE.Vector3(door.x,1.4,door.z),door.label,door.open?()=>enterHouse(door.id):()=>showWorld(()=>new THREE.Vector3(door.x,1.7,door.z),door.title,door.message),2.2)}
  // cargo (cargo.js): at the back or side of an owned vehicle's bed, put what you carry on it, or take one piece off
  for(const b of driving.bedsNear(me.position.x,me.position.z)){if(b.cargo?.some(piece=>piece.k==='bakery-pallet'))continue;const carry=GameState.progress.carry,name=b.name,gated=b.hasGate&&b.point.side==='rear',hint=gated?' · H closes the tailgate':'',here={x:b.point.x,z:b.point.z},at=()=>new THREE.Vector3(b.point.x,1.5,b.point.z); // a flatbed's rear is worked through its tailgate: E opens it, then loads or unloads; H closes it
   if(gated&&!b.gateOpen){add('gate-open-'+b.id,here,at,'Open the tailgate · '+cargoText(b.cargo),()=>toggleGate(b.id),LOAD_REACH);continue}
   if(carry)add('cargo-load-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),(LOAD_ONTO[carry.kind]||'Load it onto the ')+name+' · '+cargoText(b.cargo)+hint,()=>loadOntoBed(b.id),LOAD_REACH);
   else if(new Set((b.cargo||[]).map(p=>p.k)).size>1||(countOf(b.cargo,'planks')&&truckWaiting(GameState.progress)&&Math.hypot(b.x-TRUCK_BAY.x,b.z-TRUCK_BAY.z)<25))add('cargo-panel-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),'Cargo · '+cargoText(b.cargo)+hint,()=>openCargo(b.id),LOAD_REACH);
   else if(onRidgeline()&&countOf(b.cargo,'planks')&&inLumberyard(b))add('dock-truck-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),'Unload '+countOf(b.cargo,'planks')+' planks at the lumberyard · '+money(countOf(b.cargo,'planks')*PIECE_PAY.delivered)+hint,()=>unloadAtDock(b.id),LOAD_REACH);
   else if(onRidgeline()&&inLumberyard(b)&&timberValue(b.cargo))add('dock-timber-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),'Deliver '+cargoText((b.cargo||[]).filter(p=>p.k==='slab'))+' to the lumberyard · '+money(timberValue(b.cargo))+hint,()=>deliverSlabsAtDock(b.id),LOAD_REACH); // quest rework
   else if(b.cargo?.length&&!(b.cargo[b.cargo.length-1].k==='crate'&&runCrates(b.id)))add('cargo-take-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),(TAKE_OFF[b.cargo[b.cargo.length-1].k]||'Take it off the ')+name+' · '+cargoText(b.cargo)+hint,()=>takeOffBed(b.id),LOAD_REACH);if(b.cargo?.length)add('cargo-wheel-'+b.id,{x:b.point.x,z:b.point.z},()=>new THREE.Vector3(b.point.x,1.5,b.point.z),'Open the cargo list ('+cargoText(b.cargo)+')',()=>openCargo(b.id),LOAD_REACH,'C');if(gated)add('gate-close-'+b.id,here,at,'Close the tailgate',()=>toggleGate(b.id),LOAD_REACH,'H')}
  if(truckWaiting(GameState.progress)&&customerTruck.parked()){const pr=GameState.progress,t=truckOf(pr),rp=customerTruck.rearPoint(),cp=customerTruck.cabPoint();
   if(pr.carry?.kind==='planks')add('cust-load',rp,()=>new THREE.Vector3(rp.x,1.6,rp.z),'Load the planks onto the customer\'s truck · '+t.loaded+' / '+t.order,custLoadHands,LOAD_REACH);
   else if(!pr.carry&&t.loaded<t.order&&stockOf(pr).planks)add('cust-stock',rp,()=>new THREE.Vector3(rp.x,1.6,rp.z),'Load planks from the stock · '+t.loaded+' / '+t.order+' (stock '+stockOf(pr).planks+')',custLoadStock,LOAD_REACH);
   add('cust-cab',cp,()=>new THREE.Vector3(cp.x,2.2,cp.z),t.loaded>=t.order?'Send the truck off · '+t.loaded+' planks':'Customer\'s truck · '+t.loaded+' / '+t.order+' planks loaded',t.loaded>=t.order?custSend:()=>toast('Load '+(t.order-t.loaded)+' more planks first: at the back of the truck.'),2)}
  if(onRidgeline()&&!GameState.progress.carry&&stockOf(GameState.progress).logs)add('landing-take',LANDING,()=>new THREE.Vector3(LANDING.x,1.3,LANDING.z),'Take a log from the company stock · '+stockOf(GameState.progress).logs,takeFromPile,LANDING.radius);
  if(onRidgeline()&&GameState.progress.carry?.kind==='planks')add('dock-hand',PALLET_CENTRE,()=>new THREE.Vector3(PALLET_CENTRE.x,1.4,PALLET_CENTRE.z),'Deliver '+GameState.progress.carry.count+' planks to the lumberyard · '+money(GameState.progress.carry.count*PIECE_PAY.delivered),deliverByHand,3.2);
  // timber storage (owner 2026-11-18): logs are no longer stacked at the landing (the decor pile is gone; logs go to the saw's feed end)
  if(onRidgeline()&&GameState.progress.carry?.kind==='slab')add('dock-timber',PALLET_CENTRE,()=>new THREE.Vector3(PALLET_CENTRE.x,1.4,PALLET_CENTRE.z),'Deliver the slab to the lumberyard · '+money(PIECE_PAY.slabsDelivered),deliverSlabByHand,3.2); // quest rework: a slab pays the piece rate (no raw cash sale of a trunk or a slab)
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
  for(const d of progress.crateDrops||NO_DROPS)if(Math.hypot(d.x-me.position.x,d.z-me.position.z)<2.4)add('crate-'+d.id,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,.7+heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0),d.z),progress.carry?'A '+d.k+' · your hands are full':'Pick up the '+d.k+' (heavy: slow walk)',()=>pickCrate(d.id),1.8);for(const d of progress.slabDrops||NO_DROPS)if(Math.hypot(d.x-me.position.x,d.z-me.position.z)<2.4)add('slab-'+d.id,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,.5+heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0),d.z),progress.carry?'A slab · your hands are full':'Pick up the slab',()=>pickSlab(d.id),1.8);for(const log of progress.logs)if(!pendingLogs.has(log.id)&&Math.hypot(log.x-me.position.x,log.z-me.position.z)<(log.kind==='trunk'?BUCK_RANGE:2.4))logOffer(add,log,progress);
 }
 if(onRidgeline())for(const k of takenBy(GameState.progress.companies?.ridgeline,'me')){const d=k.status==='loaded'&&k.dest&&dropSpot(k.dest);if(d&&Math.hypot(d.x-me.position.x,d.z-me.position.z)<3)add('deliver-'+k.id,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,.9,d.z),`Unload order #${k.id} here · ${k.planks} planks for ${k.customer}`,()=>deliverOrder(k.id),2.5)}
 for(const h of waitingHomes(GameState.progress)){const d=dropSpot(h),n=waiting(GameState.progress,h);if(d&&Math.hypot(d.x-me.position.x,d.z-me.position.z)<3)add('parcel-'+h,{x:d.x,z:d.z},()=>new THREE.Vector3(d.x,d.kind==='locker'?1.1:.5,d.z),'Collect your order · '+n+(n===1?' thing':' things'),()=>collectOrder(h),2.2)}
  for(const car of vehicles)add(car.id,car,()=>new THREE.Vector3(car.x,1.3,car.z),'Inspect '+car.name,()=>showWorld(()=>new THREE.Vector3(car.x,1.4,car.z),car.name,'Parked · not owned. Driving will be available in a future update.'),1.6);return all;
}
function toggleSawmill(){const y=normalizeYard(GameState.progress.sawmillYard),want=!y.on,n=switchSaw(y,want);if(want&&!n.on){toast(y.planks>=YARD_MAX_PLANKS?'The lumber hut is full ('+YARD_MAX_PLANKS+' boards). Take some boards out first.':'Put a log on the bench first.');return}setYard(n);sawmillState={on:n.on};sawmillCtl.setOn(n.on);audio.click(sawmillCtl.switchPoint,{x:me.position.x,z:me.position.z});toast((n.on?'The saw is on':'The saw is off')+' · '+yardLine(n))}
// P-B: a carried log goes onto the bench (up to YARD_MAX_LOGS wait) and the saw switches itself on; it cuts with game time (tickSawYard) and the planks go to the yard. Stacks of 4 come off the top of the pile in the shed into the hands.
function feedSawmill(){const p=GameState.progress,c=p.carry,k=c?.kind;if(k!=='log'&&k!=='trunk'){toast('You need a log or a trunk on your shoulder.');return}const want=k==='log'&&c.count===2?2:1,r=feedYard(p.sawmillYard,want,k);if(!r.accepted){toast(k==='trunk'?'The trunk deck is full: '+YARD_MAX_TRUNKS+' trunks are waiting. Let the saw catch up.':'The bench is full: '+YARD_MAX_LOGS+' logs are waiting. Let the saw catch up.');return}setYard(r.state,{carry:want-r.accepted?{kind:'log'}:null});{const sf=sawFed(GameState.progress,k,r.accepted);if(sf.counted){GameState.progress=sf.state;persist()}} // T-E: two logs go in together (one stays on the shoulder if the bench has room for one); a trunk waits on its own deck and is sawn into 2 slabs
 const what=k==='trunk'?'The trunk is on the bench':r.accepted===2?'The logs are on the bench':'The log is on the bench';toast((r.state.on?what+'. The saw is running':what+'. The yard is full: take '+(k==='trunk'?'slabs':'planks')+' away so the saw can run')+' · '+yardLine(r.state))}
function takeYardSlab(){const p=GameState.progress;if(p.carry||parcelHeld(p)){toast(p.carry?'Your hands are full.':PARCEL_HANDS);return}const r=takeSlab(p.sawmillYard);if(!r.slabs){toast('There are no slabs in the lumber hut.');return}setYard(r.state,{carry:{kind:'slab'}});const sm=slabMilled(GameState.progress);if(sm.counted){GameState.progress=sm.state;persist()}stowTool();toast('Slab on your shoulder · '+yardLine(r.state)+(sm.finished.length?' · Task done: '+sm.finished[0]+'.':''))}
function storeInHut(){const p=GameState.progress,k=p.carry?.kind;if(k!=='planks'&&k!=='slab')return;const n=c=>k==='slab'?1:c?.count||0;if(!storeInYard(p.sawmillYard,n(p.carry),k).stored){toast(k==='slab'?'The lumber hut is full: '+YARD_MAX_SLABS+' slabs. Take some to the lumberyard first.':'The lumber hut is full: '+YARD_MAX_PLANKS+' boards. Take some to the lumberyard first.');return} // full: say so and keep them in the hands (never on the ground)
 beginBend(()=>{const cur=GameState.progress;if(cur.carry?.kind!==k)return;const r=storeInYard(cur.sawmillYard,n(cur.carry),k);if(!r.stored)return;const back=unrecordPiece(cur,k==='slab'?'slabs':'planks',r.stored).state;setYard(r.state,{shift:back.shift,carry:r.left?{kind:'planks',count:r.left}:null});audio.timber(k==='slab'?'logDrop':'plankDrop');toast((k==='slab'?'The slab is in the lumber hut':r.stored+' boards are in the lumber hut')+(r.left?' · it is full, '+r.left+' stay in your hands':'')+' · '+yardLine(r.state))})} // boards/slabs taken out paid the Mill piece: putting them back takes it back (no take/store loop)
function pickSlab(id){beginBend(()=>{const r=pickUpSlab(GameState.progress,id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();stowTool();toast(r.message)})}
const timberValue=c=>countOf(c,'slab')*PIECE_PAY.slabsDelivered; // slabs on a bed, at the piece rate
function deliverSlabByHand(){if(GameState.progress.carry?.kind!=='slab')return;const r=deliverSlabs({...GameState.progress,carry:null},1);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)}
function deliverSlabsAtDock(id){const c=driving.cargoOf(id)||[],r=deliverSlabs(GameState.progress,countOf(c,'slab'));if(r.error){toast(r.error);return}const left=c.filter(p=>p.k!=='slab');driving.setCargo(id,left.length?left:null);GameState.progress=r.state;persist();toast(r.message)}
// T-E: what lies on the ground at a log entry: a log (pick it up; a second joins the first) or a trunk (an axe or chainsaw in the hand cuts it into logs, empty hands pick it up)
function logOffer(add,log,p){const here={x:log.x,z:log.z},at=()=>new THREE.Vector3(log.x,.5+heightAt(log.x,log.z)+(world.floorAt(log.x,log.z)??0),log.z);
 if(log.kind!=='trunk'){add('log-'+log.id,here,at,p.carry?.kind==='log'&&p.carry.count!==2?'Pick up a second log':'Pick up wood log',()=>pickUpLog(log.id),1.8);return}
 const tool=buckTool(p);if(tool&&!p.carry){const done=buckHits.get(log.id)||0;add('trunk-'+log.id,here,at,isSaw(tool)?'Cut the trunk into logs · hold E':`Cut the trunk into logs · ${done?done+' / ':''}${buckHitsFor(tool,levelOf(p.skills.lumberjack.xp).level)} swings`,()=>startBuck(log),BUCK_RANGE);return}
 add('trunk-'+log.id,here,at,p.carry?'A trunk · your hands are full':'Pick up the trunk (heavy: slow walk) · an axe cuts it into logs',()=>pickUpLog(log.id),1.8)}
function takeBeltPlanks(){const p=GameState.progress;if(p.carry||parcelHeld(p)){toast(p.carry?'Your hands are full.':PARCEL_HANDS);return}const r=takeStack(p.sawmillYard);if(!r.planks){toast('The lumber hut has no boards.');return}setYard(r.state,{carry:{kind:'planks',count:r.planks}});const milled=planksMilled(GameState.progress,r.planks);GameState.progress=milled.state;persist();stowTool();toast('You take '+r.planks+' boards from the lumber hut · '+yardLine(r.state)+(milled.finished.length?' · Task done: '+milled.finished[0]+'.':''))}
function pickCrate(id){beginBend(()=>{const r=pickUpCrate(GameState.progress,id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();stowTool();toast(r.message)})}
function pickPlanks(id){beginBend(()=>{const r=pickUpPlanks(GameState.progress,id);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();stowTool();toast(r.message)})}
// X puts down what you carry, a little way in front of you on open ground (not on a deck, not inside a wall).
let putting=null,bendNow=0; // bendNow: 0..1, how far down the bend is; the carried log, the stack and the hands go down toward the ground with it
const LOG_HOME_V=new THREE.Vector3(LOG_HOME.x,LOG_HOME.y,LOG_HOME.z),LOG_GROUND_V=new THREE.Vector3(LOG_GROUND.x,LOG_GROUND.y,LOG_GROUND.z),LOG_DOWN=LOG_GROUND_V.clone().sub(LOG_HOME_V);let logPose=0; // putting: {elapsed,done,apply}; logPose: how far the right hand has gone up to steady the shoulder log
// The bend (carry.js bendAmount): every pick-up from the ground and every put-down leans the spine 50 degrees and drops the hips 0.22 m; `apply` runs at the bottom.
function beginBend(apply){if(putting||actionBusy()||inside||shop)return false;keys.clear();fuel.putBack();putting={elapsed:0,done:false,apply};return true}
function putDownCarried(){const p=GameState.progress;if(p.carry?.kind==='sack'){toast('Deliver the sack to Ironwood Bakery or give up the gig.');return}if((!p.carry&&parcelHeld(p))||p.carry?.kind==='parcel'){putDownParcel();return}if(p.carry&&(inside||shop)&&!putting&&!actionBusy()){toast(p.carry.kind==='planks'?'Stack them in a floor rack, or carry them outside to put them down.':'Carry it outside to put it down.');return}if(!p.carry||inside||shop||putting||actionBusy())return;{const rule=putDownRule(p.carry.kind,me.position.x,me.position.z);if(rule==='store'&&storeInYard(p.sawmillYard,p.carry.kind==='slab'?1:p.carry.count,p.carry.kind).stored){storeInHut();return}} /* owner 2026-11-19: boards and slabs can always be put down; at the hut X stores them while there is room, a full hut (or anywhere else) puts them on the ground */const planks=p.carry.kind==='planks',reach=planks&&sawmillCtl?.ready?Math.max(1.1,Math.max(sawmillCtl.plankSize.x,sawmillCtl.plankSize.z)/2+.7):1.1;let x=me.position.x+Math.sin(me.rotation.y)*reach,z=me.position.z+Math.cos(me.rotation.y)*reach;const bad=(a,b)=>blocked(a,b);if(bad(x,z)){ // in front is blocked: try the spot underfoot, then a ring around you, so a put-down is never a dead end
  let found=false;for(const [d,k] of [[0,0],[1.1,8],[1.8,8],[2.6,8]]){for(let i=0;i<(k||1)&&!found;i++){const a=i/(k||1)*Math.PI*2,cx=me.position.x+Math.sin(a)*d,cz=me.position.z+Math.cos(a)*d;if(!bad(cx,cz)){x=cx;z=cz;found=true}}if(found)break}
  if(!found){toast('Find some clear ground to put it down.');return}}
 const rot=me.rotation.y+Math.PI/2,q=quarterOf(me.rotation.y); // the stack lies across the way you were facing, as you carried it
 beginBend(()=>{const cur=GameState.progress,log=cur.carry?.kind==='log'||cur.carry?.kind==='trunk',r=!cur.carry?{error:'Nothing to put down.'}:log?putDownLog(cur,{x,z,rot}):cur.carry.kind==='planks'?putDownPlanks(cur,{x,z,q}):cur.carry.kind==='slab'?putDownSlab(cur,{x,z,q}):putDownCrate(cur,{x,z,q}); /* T-E: a trunk or two logs go down like the log, a slab onto slabDrops */if(r.error){toast(r.error);return}GameState.progress=r.state;persist();if(log)world.setLogs(GameState.progress.logs);{const k=cur.carry.kind;if(k==='crate'||k==='box')audio.sweep('crate-drop');else if(log)audio.logging('logThud',null,null,{size:'medium'});else audio.timber(k==='slab'?'logDrop':'plankDrop')}toast(r.message)})}
function updatePutting(dt){
 if(!putting)return;const u=putting;u.elapsed+=dt;const t=u.elapsed/BEND_TIME;bendNow=bendAmount(t);avatar.setLean(bendLean(t));avatar.setCrouch(bendDrop(t));
 if(!u.done&&u.elapsed>=BEND_TIME*BEND_RELEASE){u.done=true;u.apply()}
 if(u.elapsed>=BEND_TIME){avatar.setLean(0);avatar.setCrouch(0);bendNow=0;putting=null}
}
// The carry poses follow the carry kind in the saved state, so a load, a pick-up or a put-down always agree with what is drawn: planks (both hands under the stack) and a log (the right hand steadies it from above).
function updateCarryPose(dt){
 avatar.setHandCurl('R',logPose*0.9);
 const kind=GameState.progress.carry?.kind,free=!inside&&!shop,wasP=planksPose>0,wasL=logPose>0;planksPose=poseBlend(planksPose,kind==='planks'&&free,dt);logPose=poseBlend(logPose,(kind==='log'||kind==='trunk'||kind==='slab')&&free,dt);
 carryLog.position.lerpVectors(LOG_HOME_V,LOG_GROUND_V,bendNow);carryLog.position.y+=SOLE_LIFT*.7; /* PB2: the model stands SOLE_LIFT higher but the hand targets stay put: the log rises 0.7 as much (carry tests: arm depth 0.017 m under 0.02, knuckle gap 0.068 m under 0.07) */ if(carryPlanks)carryPlanks.position.set(PLANK_STACK.x,PLANK_STACK.y-.7*bendNow,PLANK_STACK.z+.3*bendNow);
 // each hand has its own blend: the left hand holds the stack, the right hand steadies a log; a hand is let go once its own blend is back at zero (the axe, if held, keeps the right hand)
 if(planksPose>0){for(const side of Object.keys(PLANK_HANDS)){const h=PLANK_HANDS[side],pole=PLANK_POLES[side];avatar.reach(side,CARRY_HAND.set(h.x,h.y-.7*bendNow,h.z+.3*bendNow),planksPose,CARRY_POLE_V.set(pole.x,pole.y,pole.z))}}else if(wasP)avatar.reach('L',null,0);
 {const seated=!!driving.active||fork.on,wantB=poseFor(GameState.progress,{seated,parcelInHands:parcelMode==='held'})==='box'||(!seated&&!GameState.progress.equipped&&(!!handBoxKind||(GameState.progress.carry?.kind==='parcel'&&parcelMode==='held'))),wasB=boxPoseW>0;boxPoseW=seated?0:poseBlend(boxPoseW,wantB,dt); // G2c: both hands on the sides of the held box, elbows bent forward; released when the box is put down, delivered, the gig ends, or a seat is taken
  if(boxPoseW>0){if(handBoxKind)holdHandBox(bendNow);else if(parcelMode==='held')holdParcel(bendNow);avatar.reach('R',BOX_H.set(boxP.R.x,boxP.R.y,boxP.R.z),boxPoseW,BOX_PV.set(BOX_POLES.R.x,BOX_POLES.R.y,BOX_POLES.R.z));avatar.reach('L',BOX_H.set(boxP.L.x,boxP.L.y,boxP.L.z),boxPoseW,BOX_PV.set(BOX_POLES.L.x,BOX_POLES.L.y,BOX_POLES.L.z))}else if(wasB){if(!GameState.progress.equipped)avatar.reach('R',null,0);avatar.reach('L',null,0)}}
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
 if(GameState.progress.carry||parcelHeld(GameState.progress)){toast(GameState.progress.carry?'Your hands are full. Put it down first (X).':PARCEL_HANDS);return}
 if(fuel.held){toast('You already have a nozzle out.');return}
 stowTool();fuel.take(pump);fillBlocked=false;fillSale={mgal:0,cents:0};fuel.setReadout(pump,fillSale);audio.sweep('fuel-nozzle',pump.use,me.position);
 toast(`${fuelTitle(pump.fuel)} nozzle in your hand. Go to the glowing tank cap and hold F to fill.`);
}
function hangNozzle(quiet=false){const p=fuel.putBack();fillAcc=0;fillSale=null;if(p){audio.sweep('fuel-nozzle',p.use,me.position);if(!quiet){toast('Nozzle back in its holster.');persist()}}return p}
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
 const gate=pumpGate(P,pump.fuel,want,STEP_MGAL);if(gate.soldOut){fillBlocked=true;fillAcc=0;toast(SOLD_OUT_TEXT);audio.chime(pump.use,listenerAt(),{ok:false});return}const r=fillCan({cash:P.cash,can},{pump:{fuel:pump.fuel},mgal:gate.mgal}); // W-D1: the pump sells from the world's stock
 if(r.error){fillBlocked=true;fillAcc=0;toast(r.error);audio.chime(pump.use,listenerAt(),{ok:r.code==='full'});return}
 fillAcc-=want;GameState.progress=pumpSold({...setCan(P,r.can),cash:r.cash},pump.fuel,r.soldMgal);canAt=pump.use;fuelFlow=1;fuelFull=r.can.mgal/CAN_CAPACITY_MGAL;
 fillSave+=dt;if(fillSave>=1){persist();fillSave=0}
 fillToast+=dt;if(fillToast>=.5){fillToast=0;toast(`Filling the can · ${canText(r.can)} · ${money(r.cash)}`)}
 if(r.soldMgal<want||r.can.mgal>=CAN_CAPACITY_MGAL){fillBlocked=true;fillAcc=0;fuelFlow=0;persist();toast(r.can.mgal>=CAN_CAPACITY_MGAL?'The can is full.':gate.mgal<want?SOLD_OUT_TEXT:'You cannot pay for any more fuel.');audio.chime(pump.use,listenerAt(),{ok:r.can.mgal>=CAN_CAPACITY_MGAL})}
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
 const gate=pumpGate(GameState.progress,fuel.held.fuel,want,STEP_MGAL);if(gate.soldOut){fillBlocked=true;fillAcc=0;fuelFlow=0;toast(SOLD_OUT_TEXT);audio.chime(fuel.held.use,listenerAt(),{ok:false});return}const r=sell({cash:GameState.progress.cash,target:{fuel:info.type,mgal:info.mgal,capacityMgal:info.capacityMgal}},{pump:{fuel:fuel.held.fuel},mgal:gate.mgal}); // W-D1: the pump sells from the world's stock
 if(r.error){fillBlocked=true;fillAcc=0;toast(r.error);audio.chime(fuel.held.use,listenerAt(),{ok:r.code==='full'});return}
 fillAcc-=want;
 driving.setFuel(id,r.target.mgal);
 GameState.progress=pumpSold({...GameState.progress,cash:r.cash},fuel.held.fuel,r.soldMgal);
 fillSale=fillSale||{mgal:0,cents:0};fillSale={mgal:fillSale.mgal+r.soldMgal,cents:fillSale.cents+r.cents};fuel.setReadout(fuel.held,fillSale);
 fuelFlow=1;fuelFull=r.target.mgal/info.capacityMgal;storyFuel(id,fuelFull);
 fillSave+=dt;if(fillSave>=1){persist();fillSave=0}
 fillToast+=dt;if(fillToast>=.5){fillToast=0;toast(`Filling ${fuelName(fuel.held.fuel)} · ${fuelText(r.target.mgal,info.capacityMgal)} · ${money(r.cash)}`)}
 if(r.soldMgal<want){fillBlocked=true;fillAcc=0;fuelFlow=0;toast(r.target.mgal>=info.capacityMgal?`The tank is full. ${gallons(fillSale.mgal)} gal for ${money(fillSale.cents)}.`:gate.mgal<want?SOLD_OUT_TEXT:'You cannot pay for any more fuel.');audio.chime(fuel.held.use,listenerAt(),{ok:r.target.mgal>=info.capacityMgal})}
}function interact(key='E'){if(!active||modal||talking()||actionBusy()||putting)return;const hit=chooseInteraction(candidates().filter(c=>key==='E'?c.key!=='H'&&c.key!=='C':c.key===key),me.position,me.rotation.y);if(hit)hit.run()}
// Damage events from driving.js (VD2): a counted crash shakes the camera by its size, costs 5 energy when it stalls the engine, and says so in a toast when the band gets worse; the starter and a Wrecked vehicle that will not start.
const shake={t:0,amp:0,off:new THREE.Vector3()};let hitStop=0;const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches; // VD7a: hitStop = seconds of vehicle freeze still owed (eaten by stepWorld; the loop, clock and saves never pause); calm = reduced motion: no shake, no freeze, a softer flash
function crashFeedback(e){const q=calm();if(e.at&&e.dir)debris.burst(e.at,e.dir,e.points);const fl=$('hitFlash');if(fl){fl.style.setProperty('--flash',(flashOf(e.total)*(q?.4:1)).toFixed(2));fl.classList.remove('on');void fl.offsetWidth;fl.classList.add('on')}vehicleHud.pulse();if(!q)hitStop=Math.max(hitStop,hitStopOf(e.total))} // red edge flash (CSS animation, once), debris at the contact point, the panel pulse, the hit-stop
function driveEvent(e){const f=driving.byId.get(e.id);if(!f)return;const nm=f.spec.name.replace(/^Eastbank /,'');
 if(e.type==='crash'){storyKnock(e);if(!calm()){shake.amp=Math.max(shake.t>0?shake.amp:0,shakeAmplitude(e.total));shake.t=SHAKE_SECONDS}crashFeedback(e);audio.crash(e);if(e.stall){audio.stall();const L=GameState.progress.life;GameState.progress.life={...L,energy:Math.max(0,L.energy-ENERGY_COST)}}if(e.changed)toast(bandToast(nm,e.cond));else if(e.stall)toast('The engine stalled. Press W to restart.')}
 else if(e.type==='crank')audio.ignition(me.position,listenerAt(),{tier:f.cls.tier,seconds:e.seconds});
 else if(e.type==='start'){const tip=driving.exhaust(f);if(tip)smoke.burst(tip,START_PUFFS[f.cls.tier]??6)}
 else if(e.type==='dead')toast('It will not start: it is wrecked.');else if(e.type==='bog'&&!driveEvent.told){driveEvent.told=true;toast('Stuck in the mud: rock it with W and S, wait a few seconds, or call the tow service for a pull-out.')}}
function applyShake(dt){if(shake.t>0){shake.t-=dt;const o=shakeOffset(shake.t,shake.amp);shake.off.set(o.x,o.y,o.z);camera.position.add(shake.off)}else shake.off.set(0,0,0)}// Driving (driving.js, vehicle.js): E at a vehicle's driver door gets in (refused while carrying), E while driving gets out once you are below 1 m/s, at the door (else the other side, behind, in front).
function enterVehicle(id,seat='driver',go=false){
 if(driving.active||inside||shop||consuming||putting||actionBusy())return;
 if(GameState.progress.carry?.kind==='sack'){toast('Carry the sack to Ironwood Bakery on foot.');return}
 {const why=mountError(GameState.progress,driving.byId.get(id)?.spec.model,driving.cargoOf(id));if(why){toast(why);return}}let stowParcel=null;{const pc=GameState.progress.carry,model=driving.byId.get(id)?.spec.model;if(pc?.kind==='parcel'&&hasBed(model)){const r=loadCarry(pc,driving.cargoOf(id),model);if(r.error){toast(RACK_BUSY);return}stowParcel=r.cargo}} // ATV-STOW: a held parcel is stowed on the ATV's rack (no other vehicle has one yet)
 if(driving.byId.get(id)?.display){toast('It is not yours. Buy it at the dealership lot or order it on your phone.');return}
 if(!go)audio.sweep('car-door-open',driving.byId.get(id)?.state,me.position);if(!go&&driving.doorThen(id,seat,()=>enterVehicle(id,seat,true)))return;const stowKg=stowKgFor(driving.byId.get(id)?.spec.model);if(!driving.enter(id,seat,stowKg))return;if(stowParcel){driving.setCargo(id,stowParcel);GameState.progress={...GameState.progress,carry:null};parcelStowedOn=id}audio.prepare(driving.active.cls.id);audio.sweep('car-door-close',driving.active.state,me.position);fuel.putBack();if((driving.active.fuelMgal>0||!driving.active.spec.fuel)&&driving.active.cond>0){audio.ignition(me.position,listenerAt(),{tier:driving.active.cls.tier,seconds:driving.damageOf().crank});const tip=driving.exhaust();if(tip)smoke.burst(tip,START_PUFFS[driving.active.cls.tier]??6)}
 const at=driving.seat();me.position.x=at.x;me.position.z=at.z;me.rotation.y=driving.yaw;keys.clear();look.resetMotion();
 yaw=driving.yaw+Math.PI;pitch=driving.cameraPitch();zoom=zoomTarget=driving.cameraZoom();driveIdle=9;persist();
 let more='';if(stowKg>0||stowParcel)more=' · '+STOW_TOAST;if(!heavyTold&&usesLoadDrag(driving.active.spec.model)&&isHeavy(stowKg+cargoMassKg(driving.cargoOf(id)))){heavyTold=true;more+=' · '+HEAVY_TEXT} // ATV-STOW: load drag toast, once per session
 toast((seat==='driver'?`Driving the ${driving.active.spec.name.replace(/^Eastbank /,'')} · W S accelerate and brake, A D steer, Space brakes, E gets out`:`Riding in the ${driving.active.spec.name.replace(/^Eastbank /,'')} · you are the passenger: nobody is driving · E gets out`)+more);
}
let heavyTold=false;const stowKgFor=model=>canStow(model)&&parcelHeld(GameState.progress)?parcelMassKg(GameState.progress.gigs.active):0; // kg of the gig parcel that rides on this vehicle's rack (0 = none; load-drag.js)
// The repair shop (VD4, garage.js holds the rules; here the bay, the counter, the repair kit and the tow). Everything works on the saved vehicle list (driving.save()); garageSync then makes the world match it: conditions, vehicles in the shop hidden, a towed or collected vehicle placed.
const GARAGE_REACH=5,GARAGE_NAME='Eastbank repair shop',garageToldReady=new Set();
const vname=uid=>driving.byId.get(uid)?.spec.name.replace(/^Eastbank /,'')||'vehicle';
function garageSync(appear){const p=GameState.progress,shopMap=p.garage?.shop||{};
 if(appear)driving.place(appear.uid,{x:appear.x,z:appear.z,yaw:appear.yaw});
 for(const v of p.vehicles||[]){if(!driving.byId.has(v.uid))continue;driving.setCond(v.uid,condOf(v));if(driving.active?.spec.id!==v.uid)driving.setPresent(v.uid,!shopMap[v.uid])}}
// PB1: call a tow from a vehicle; if it is the one you sit in, you step out first (no door animation: a tow truck hooks it up) and stand at the shop counter afterwards. The tow is checked on a copy first, so a refused tow (no cash, already at the shop) leaves you in your seat. Every path returns {message} or {error} and also toasts, so the Call app and the screen both say what happened.
// PB1: a vehicle that bumps the world's last 14 m (map.wilds is the open country; past it the mask is a wall) says why, at most every 6 s.
let edgeNoteAt=-1e9;function edgeNote(){const f=driving.active,w=MAP.wilds;if(!f||!w)return;const x=f.state.x,z=f.state.z,m=14;if(x>w.x0+m&&x<w.x1-m&&z>w.z0+m&&z<w.z1-m)return;const t=performance.now();if(t-edgeNoteAt<6000)return;edgeNoteAt=t;setTimeout(()=>toast('You are at the edge of the map'),400)} // a beat later, so a crash toast from the same bump does not hide it
function towCall(uid){try{const p0={...GameState.progress,vehicles:driving.save()},drivenNow=driving.active?.spec.id===uid,probe=towTo(p0,uid,bayPose(),{now:hoursNow(p0)});if(probe.error){toast(probe.error);return {error:probe.error}}
 if(drivenNow){const fa=driving.active;driving.leave(()=>false);unstowParcel(fa);fuel.putBack();keys.clear();look.resetMotion();pitch=.38;zoom=zoomTarget=7}
 const r=garageDo(q=>towTo(q,uid,bayPose(),{now:hoursNow(q)}));if(r.error){toast(r.error);return {error:r.error}}
 let text=r.message;if(drivenNow){const c=MAP.garage.counter;placeSafely(c.x,me.position.y,c.z);text+=' You are on foot at the shop.'}
 toast(text);return {message:text}}catch(e){const m='The tow service could not do that: '+(e?.message||e);toast(m);return {error:m}}}function garageDo(run){const r=run({...GameState.progress,vehicles:driving.save()});if(r.error)return r;GameState.progress=r.state;garageSync(r.appear);persist();return r}
const garageBay=p=>(p.vehicles||[]).filter(v=>inBay(v)&&!inShop(p,v.uid)&&driving.byId.get(v.uid)?.present&&driving.active?.spec.id!==v.uid&&condOf(v)<1000).sort((a,b)=>Math.hypot(a.x-MAP.garage.pose.x,a.z-MAP.garage.pose.z)-Math.hypot(b.x-MAP.garage.pose.x,b.z-MAP.garage.pose.z))[0]||null;
function garageOffers(add){const g=MAP.garage;if(!g||driving.active||Math.hypot(me.position.x-g.counter.x,me.position.z-g.counter.z)>GARAGE_REACH)return;
 const p={...GameState.progress,vehicles:driving.save()},now=hoursNow(p),list=shopList(p,now),done=list.find(s=>s.done),wait=list.find(s=>!s.done),v=garageBay(p);
 add('garage',g.counter,()=>worldPoint({x:g.counter.x,y:1.7,z:g.counter.z}),done?`Repair shop · collect the ${done.name}`:v?`Repair shop · ${vname(v.uid)} at ${condPct(condOf(v))}%`:wait?`Repair shop · ${wait.name} ready in ${repairText(Math.max(0,wait.readyAt-now))}`:`Repair shop · repair kits ${money(itemById('repair-kit').price)}`,garageMenu,GARAGE_REACH)}
function garageMenu(){const g=MAP.garage,p={...GameState.progress,vehicles:driving.save()},now=hoursNow(p),list=shopList(p,now),done=list.find(s=>s.done),wait=list.find(s=>!s.done),v=garageBay(p),ch=[],lines=[];
 const act=fn=>()=>{$('closeDialog').onclick();const r=garageDo(fn);toast(r.error||r.message)};
 if(done){ch.push({label:`Collect the ${done.name} · ${condPct(done.to)}%`,run:act(q=>collectRepair(q,done.uid,hoursNow(q)))});lines.push(`Your ${done.name} is ready.`)}
 if(wait)lines.push(`${wait.name}: ready in ${repairText(Math.max(0,wait.readyAt-now))}.`);
 if(v){const os=garageQuotes(p,v.uid),free=os.find(o=>o.free);lines.push(`${vname(v.uid)} at ${condPct(condOf(v))}%: you leave it here and collect it when the work is done (it takes game time).`);
  for(const o of [...(free?[free]:[]),...os.filter(o=>!o.free)])ch.push({label:o.label,run:act(q=>startRepair(q,v.uid,hoursNow(q),o.free?{free:true}:{to:o.to}))})}
 else if(!done&&!wait)lines.push('Park a damaged vehicle in the painted bay to repair it. A repair costs a quarter of the price times the share lost (at least $25).');
 ch.push({label:`Buy a repair kit · ${money(itemById('repair-kit').price)}`,run:()=>{$('closeDialog').onclick();const r=addItem(GameState.progress,'repair-kit',{purchase:true});if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast('Repair kit bought. Equip it, then press E at a damaged vehicle.')}});
 station({x:g.counter.x,y:1.7,z:g.counter.z},GARAGE_NAME,lines.join(' '),ch.slice(0,3))}
function kitOffers(add){const p=GameState.progress;if(p.equipped!=='repair-kit'||!hasItem(p,'repair-kit')||driving.active)return;
 for(const f of driving.fleet){if(f.display||f.dev||!f.present||f.cond>=KIT_CAP||Math.hypot(f.state.x-me.position.x,f.state.z-me.position.z)>f.cls.hz+1.4)continue; // (a vehicle past what a kit can fix offers nothing, so the shop counter next to it stays reachable)
  add('kit-'+f.spec.id,{x:f.state.x,z:f.state.z},()=>new THREE.Vector3(f.state.x,1.3,f.state.z),`Use a repair kit · ${vname(f.spec.id)} ${condPct(f.cond)}%`,()=>{const r=garageDo(q=>useKit(q,f.spec.id));toast(r.error||r.message)},f.cls.hz+1.4)}}
function garageTick(){const p=GameState.progress,s=p.garage?.shop;if(!s||!Object.keys(s).length)return;const now=hoursNow(p);for(const e of shopList(p,now))if(e.done&&!garageToldReady.has(e.uid)){garageToldReady.add(e.uid);notifyPhone('player',`Your ${e.name} is ready at the ${GARAGE_NAME}.`)}}
garageSync();for(const e of shopList(GameState.progress,hoursNow(GameState.progress)))if(e.done)garageToldReady.add(e.uid); // a repair already done when the game loads is not announced again
function drinkCooler(key){const r=useCooler(GameState.progress,key);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message);audio.drink(me.position,listenerAt())} // free water at work (water-cooler.js)
function exitVehicle(now){
 if(!driving.active)return;
 if(driving.speed>=1){toast('Stop first.');return}if(now!==true&&driving.doorThen(null,driving.seatSide,()=>exitVehicle(true)))return; // the door opens first, then you step out (shortbed)
 const f=driving.active,seatWas=driving.seatSide,door=driving.door(),p=driving.leave((x,z)=>!blocked(x,z));audio.sweep('car-door-close',f.state,me.position);
 if(p){me.position.x=p.x;me.position.z=p.z}else placeSafely(door.x,me.position.y,door.z);
 me.rotation.y=f.state.yaw+(driving.seatSide==='passenger'||seatWas==='passenger'?-Math.PI/2:Math.PI/2);keys.clear();look.resetMotion();pitch=.38;zoom=zoomTarget=7;persist();
 const unst=unstowParcel(f);
 if(!unst&&canStow(f.spec.model)&&parcelHeld(GameState.progress))toast(UNSTOW_TOAST); // ATV-STOW (an old save's flag parcel, not a piece): it comes off the rack into your hands (syncParcel moves the mesh)
}
// NPC-NAMES: anybody without roster dialogue can be talked to (npc-chat.js). The floating name tags were removed (owner, 2026-11-17: they stuttered when people moved); the name shows in the dialogue panel.
function talkCrowd(t){const person=npcTown.people.find(p=>p.id===t.id);if(!person)return;const l=chatLine(person,{day:GameState.progress.housing?.day||1,minute:GameState.progress.routine?.minutes||0});speak(t.group,l.name,l.text,[{label:'Nice to meet you',run:()=>closeWorldDialog()}])}
function updateWorldUI(){
 vehicleHud(fork.on?vehicleHudModel({forklift:{speed:fork.state.speed,lift:fork.state.lift,load:forkLoadOf(GameState.progress),hint:fork.hint||'',goal:fork.goal||''}}):vehicleHudModel({driving:driving.active,seat:driving.seatSide,name:driving.active?.spec.name,speed:driving.speed,topSpeed:driving.active?.cls?.top||29,lights:driving.driving?lightsLabel(lightMode,nightLights.ownOn):null,fuel:driving.active?driving.fuelOf(driving.active.spec.id):null,damage:driving.active?driving.damageOf():null,bog:driving.driving?driving.bogOf():null,gps:driving.driving?gps.hud:null,ground:driving.active?(()=>{const s=surfaceLive(driving.active.state.x,driving.active.state.z);return {label:SURFACE_LABEL[s]||'Ground',factor:surfaceSpeed(s,driving.active.cls)}})():null}));
 camera.updateMatrixWorld(true);const allC=candidates(),hit=chooseInteraction(allC.some(c=>c.key!=='C'&&c.key!=='H')?allC.filter(c=>c.key!=='C'):allC,me.position,me.rotation.y);selectedInteraction=hit; // the C (cargo list) prompt only shows when nothing else is on offer here: E keeps its prompts
 { const target=chopping?chopping.tree:hit?.id?.startsWith('tree-')?hit.point:null;world.setTarget(active&&!modal?target:null); }
 const p=hit?screenAnchor(hit.anchor(),camera,innerWidth,innerHeight,THREE.Vector3):null;$('prompt').hidden=!active||modal||talking()||!!busy||!!chopping||!p||!!driving.active;
 if(p){$('prompt').style.left=p.x+'px';$('prompt').style.top=p.y+'px';$('prompt').querySelector('span').textContent=hit.label;const kbd=$('prompt').querySelector('kbd');if(kbd){kbd.hidden=hit.key==='';kbd.textContent=hit.key||'E'}}
 if(talking())talkFrame();else if(worldPanel&&!$('dialog').hidden)worldPanelFrame();
 
}
// Small destination marker, shared by pickups and drop-offs.
const marker=new THREE.Group();marker.name='objective-beacon';const markerMaterial=new THREE.MeshBasicMaterial({color:'#d4e7b3',transparent:true,opacity:.8,depthWrite:false});
// OBJ-BEACON (beacon-style.js): a soft ground glow, a faint light beam and the small diamond, tinted by purpose. Two textures and one plane geometry are made once and shared; each beacon owns two additive materials (no allocation per frame).
const beaconPlane=new THREE.PlaneGeometry(1,1);
function beaconTexture(beam){const c=document.createElement('canvas');c.width=beam?16:64;c.height=64;const g=c.getContext('2d');
 if(beam){const v=g.createLinearGradient(0,64,0,0),h=g.createLinearGradient(0,0,16,0);if(v&&h){v.addColorStop(0,'rgba(255,255,255,.9)');v.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=v;g.fillRect(0,0,16,64);h.addColorStop(0,'rgba(0,0,0,0)');h.addColorStop(.5,'rgba(0,0,0,1)');h.addColorStop(1,'rgba(0,0,0,0)');g.globalCompositeOperation='destination-in';g.fillStyle=h;g.fillRect(0,0,16,64)}}
 else{const r=g.createRadialGradient(32,32,0,32,32,32);if(r){r.addColorStop(0,'rgba(255,255,255,.85)');r.addColorStop(.55,'rgba(255,255,255,.35)');r.addColorStop(.85,'rgba(255,255,255,.08)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)}}
 return new THREE.CanvasTexture(c)}
const beaconGlowTex=beaconTexture(false),beaconBeamTex=beaconTexture(true);
function makeBeacon(){const mat=map=>new THREE.MeshBasicMaterial({map,color:'#ffffff',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,side:THREE.DoubleSide}),mGlow=mat(beaconGlowTex),mBeam=mat(beaconBeamTex);
 const group=new THREE.Group(),glow=new THREE.Mesh(beaconPlane,mGlow),beamA=new THREE.Mesh(beaconPlane,mBeam),beamB=new THREE.Mesh(beaconPlane,mBeam);
 glow.rotation.x=-Math.PI/2;glow.position.y=.08;glow.renderOrder=2;beamA.position.y=beamB.position.y=7;beamB.rotation.y=Math.PI/2;beamA.scale.set(1.1,14,1);beamB.scale.set(1.1,14,1);beamA.renderOrder=beamB.renderOrder=2;group.add(glow,beamA,beamB);
 const self={group,colour:'',apply(colour,fade,t,boost=1,grow=0){if(colour!==self.colour){self.colour=colour;mGlow.color.set(colour);mBeam.color.set(colour)}
  const pulse=1+.06*Math.sin(t*1.6),breathe=.88+.12*Math.sin(t*1.6);glow.scale.setScalar(3.4*fade.padScale*pulse*(1+grow));mGlow.opacity=Math.min(1,fade.ringAlpha*breathe*boost);mBeam.opacity=Math.min(1,fade.beamAlpha*.5*boost);beamA.visible=beamB.visible=fade.beamAlpha>.01}};
 return self}
const markerBeacon=makeBeacon(),ghostBeacon=makeBeacon();let markerKind='story',gigKind='pickup',markerNear=0,gigNear=0,ghostT=-1;marker.add(markerBeacon.group);
let beaconTime=0; // FIX-R1: one clock for both beacons (markerTime only ran while the story/work spot existed, so the gig beacon never pulsed)
const daylightNow=()=>{if(shop||inside)return 0;try{return sky.state()?.weights?.day??0}catch{return 0}};
// Completion: a beacon that vanishes while you stood close to it flashes and dissolves in its colour (one ghost beacon, reused).
function flashBeacon(kind,position){if(!active||!position)return;ghostBeacon.apply(beaconColour(kind),beaconFade(20,0),0);ghostBeacon.group.position.copy(position);scene.add(ghostBeacon.group);ghostT=0} // FIX-R1: explicit, called only when a gig or a delivery is completed (never on a failed or abandoned gig, a shop door or a tracker change)
const flashDone=()=>{toastSound();if(gigMarker.visible)flashBeacon(gigKind,gigMarker.position);else if(marker.visible)flashBeacon(markerKind,marker.position)};
function updateBeacons(dt){beaconTime+=dt;const t=beaconTime,day=daylightNow();
 if(marker.visible){const f=beaconFade(markerNear,day),c=beaconColour(markerKind);if(markerBeacon.colour!==c)markerMaterial.color.set(c);markerBeacon.apply(c,f,t);markerMaterial.opacity=.35+.5*f.padScale;diamond.scale.setScalar(f.padScale)}
 if(gigMarker.visible){const f=beaconFade(gigNear,day),c=beaconColour(gigKind);if(gigBeacon.colour!==c)gigMaterial.color.set(c);gigBeacon.apply(c,f,t);gigMaterial.opacity=.35+.5*f.padScale;gigDiamond.scale.setScalar(f.padScale)}
 if(ghostT>=0){ghostT+=dt;const k=ghostT/FLASH_SECONDS;if(k>=1){ghostT=-1;ghostBeacon.group.removeFromParent()}else{ghostBeacon.apply(ghostBeacon.colour,{ringAlpha:(1-k)*1.4,beamAlpha:(1-k)*1.6,padScale:1},0,1,k*1.8)}}}
const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.16),markerMaterial);diamond.position.y=2.5;marker.add(diamond);scene.add(marker);
const parcelProtos=new Map(),parcelProto=id=>{let m=parcelProtos.get(id);if(!m){m=createProp(id,{apply:x=>x});parcelProtos.set(id,m)}return m},parcel=createProp(PARCEL_DEFAULT,{apply:m=>m});let parcelModel=PARCEL_DEFAULT;;parcel.name='gig-parcel';parcel.visible=false;player.add(parcel); // G2b/G3b: the real carton model (small 0.30 x 0.20 x 0.20 m or medium 0.40 x 0.30 x 0.30 m, clean or dirty by client hash), ONE pooled mesh that swaps geometry and material (the other prototypes are never in the scene): in the arms in front of the chest while held, on the ground (scene child) once put down; the old brown BoxGeometry is gone
const parcelSize=new THREE.Vector3(.3,.155,.2),boxP=freshBoxPose(),BOX_H=new THREE.Vector3(),BOX_PV=new THREE.Vector3();let boxPoseW=0; // G2c: the carton's bounding size (measured when the model changes), the held pose numbers (carry-pose.js) and the arm blend
function measureParcel(){const g=parcel.geometry;if(!g.boundingBox)g.computeBoundingBox();g.boundingBox.getSize(parcelSize)}function holdParcel(bend){boxPose(parcelSize,bend,boxP);parcel.position.set(boxP.box.x,boxP.box.y,boxP.box.z)} // held: base at belly height, its back against the sweater (was (0,1,.36), floating in front of the hip)
measureParcel();let parcelMode='',parcelX=NaN,parcelZ=NaN,parcelRack=null,parcelRackSlot=-1,parcelBedSlot=-1,parcelRackCargo=null; // syncParcel only moves the mesh when the mode or the saved drop spot changes: no per-frame allocation
function parcelBedOf(a){for(const f of driving.fleet){const c=f.cargo;if(!c)continue;for(let i=0;i<c.length;i++)if(c[i].k==='parcel'&&c[i].g===a.id){parcelBedSlot=i;return f}}parcelBedSlot=-1;return null}
// C-B: keeps the parcel piece honest every frame (cheap: a few short cargo lists). A piece whose gig is over, or whose parcel lies on the ground, goes from the hands and every bed (the gig rules clear the SAVED list; driving holds the live one). A taken parcel that is a piece nowhere (an old save, a bed that was cleared) comes back into free hands.
function reconcileParcel(a){const ok=a&&!a.drop&&(!a.origin||a.pickedAt!=null)?a.id:0;let p=GameState.progress,here=false;if(p.carry?.kind==='parcel'){if(p.carry.gig!==ok)GameState.progress=p={...p,carry:null};else here=true}
 for(const f of driving.fleet){const c=f.cargo;if(!c)continue;let bad=false;for(let i=0;i<c.length;i++){if(c[i].k!=='parcel')continue;if(c[i].g===ok)here=true;else bad=true}if(bad)driving.setCargo(f.spec.id,c.filter(q=>!(q.k==='parcel'&&q.g!==ok)))}
 if(ok&&!here&&!p.carry&&!driving.active)GameState.progress={...p,carry:{kind:'parcel',gig:a.id,model:parcelModelId(a),...(a.large?{large:true}:{})}}}
function settleParcel(){const a=GameState.progress.gigs?.active;reconcileParcel(a?.needId?null:a)} /* audit #7: a gig that just ended (paid, given up, timed out) clears its parcel from the live beds BEFORE persist() saves driving.save() */ function parcelAwayNow(){return parcelAway(GameState.progress,driving.fleet,me.position,driving.active)} /* audit #3: the parcel sits on a bed far from you (gig-parcel.js) */
function unstowParcel(f){if(!f||parcelStowedOn!==f.spec.id)return false;parcelStowedOn='';const a=GameState.progress.gigs?.active,c=driving.cargoOf(f.spec.id),r=a&&!GameState.progress.carry&&(c||[]).some(q=>q.k==='parcel'&&q.g===a.id)?unloadKind(null,c,f.spec.model,'parcel'):null;if(r&&!r.error){driving.setCargo(f.spec.id,r.cargo);GameState.progress={...GameState.progress,carry:r.carry};persist();toast(UNSTOW_TOAST)}return true} // audit #4: the parcel stowed when you got in comes back into your hands on every way out (E, a tow, R); true = it was stowed on f
function syncParcel(old){const a=GameState.progress.gigs?.active?.needId?null:GameState.progress.gigs?.active,want=a?parcelModelId(a):parcelModel;if(want!==parcelModel){const pr=parcelProto(want);parcel.geometry=pr.geometry;parcel.material=pr.material;parcelModel=want;measureParcel()}reconcileParcel(a);const wait=!!a&&parcelWaiting(GameState.progress),bed=a&&!a.drop&&!wait?parcelBedOf(a):null,legacy=!!a&&parcelHeld(GameState.progress),rack=bed||(legacy&&driving.active&&canStow(driving.active.spec.model)?driving.active:null),slot=bed?parcelBedSlot:-1,mode=rack?'stowed':old||(a&&!a.drop&&!wait)?'held':wait&&a.origin.room==='street'&&!inside&&!shop?'ground':a&&a.drop&&!inside&&!shop?'ground':'';parcel.visible=mode!=='';if(!mode){parcelMode='';return}const d=mode==='ground'?(a.drop||a.origin):null;if(mode!==parcelMode||(d&&(d.x!==parcelX||d.z!==parcelZ))||(rack&&(rack!==parcelRack||slot!==parcelRackSlot||rack.cargo!==parcelRackCargo))){parcelMode=mode;parcelRack=rack;parcelRackSlot=slot;parcelRackCargo=rack?rack.cargo:null;if(d){parcelX=d.x;parcelZ=d.z;scene.add(parcel);parcel.position.set(d.x,heightAt(d.x,d.z)+(world.floorAt(d.x,d.z)??0),d.z)}else if(rack){const b=BEDS[rack.spec.model],s=slot>=0?slotPositions(rack.spec.model,rack.cargo)[slot]:null;rack.mesh.add(parcel);if(s)parcel.position.set(s.x,s.y-(rack.cargo[slot].l?.2:.15),s.z);else parcel.position.set(0,b.y,(b.z0+b.z1)/2);parcel.rotation.set(0,0,0)}else{player.add(parcel);holdParcel(bendNow)}}}
function putDownParcel(){if(driving.active){toast('The parcel is stowed on the rack. Get off to take it.');return}if(inside||shop){toast('Put the parcel down outside.');return}if(putting||actionBusy())return;let x=me.position.x+Math.sin(me.rotation.y)*.9,z=me.position.z+Math.cos(me.rotation.y)*.9; // same spot search as putDownCarried: in front, else underfoot, else a ring
  if(blocked(x,z)){let found=false;for(const [d,k] of [[0,0],[1.1,8],[1.8,8],[2.6,8]]){for(let i=0;i<(k||1)&&!found;i++){const a=i/(k||1)*Math.PI*2,cx=me.position.x+Math.sin(a)*d,cz=me.position.z+Math.cos(a)*d;if(!blocked(cx,cz)){x=cx;z=cz;found=true}}if(found)break}if(!found){toast('Find some clear ground to put it down.');return}}
  beginBend(()=>{const r=dropGigParcel(GameState.progress,{x,z});if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)})}
function pickUpGigAtOrigin(){if(gigPickupHere(GameState.progress,me.position,currentRoom()))stowTool();beginBend(()=>{const r=pickUpGigBox(GameState.progress,me.position,currentRoom());if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)})} // G-D: the pickup step (E at the pickup point); the carton appears in the hands via syncParcel
function pickUpParcel(){if(GameState.progress.gigs?.active?.drop&&!GameState.progress.carry)stowTool();beginBend(()=>{const r=pickGigParcel(GameState.progress);if(r.error){toast(r.error);return}GameState.progress=r.state;persist();toast(r.message)})}
const workMarker=new THREE.Mesh(new THREE.RingGeometry(.35,.43,32),new THREE.MeshBasicMaterial({color:'#e7c681',side:THREE.DoubleSide,transparent:true,opacity:.85}));workMarker.rotation.x=-Math.PI/2;shops.cafe.scene.add(workMarker);
const drinkCup=new THREE.Mesh(new THREE.CylinderGeometry(.07,.055,.17,10),mat('#eee3ce'));drinkCup.name='diner-held-cup';drinkCup.visible=false;player.add(drinkCup);
const DINER_CUP_HAND=new THREE.Vector3(.24,1.16,.34),dinerCupWrist=new THREE.Vector3(),dinerCupForearm=new THREE.Vector3();
function poseDinerCup(){
 const visible=shop==='cafe'&&!busy&&!!dinerOf(GameState.progress)?.carried.length&&!!avatar.bone('WristL');
 if(visible){avatar.reach('L',DINER_CUP_HAND,1);avatar.setHandCurl('L',.85)}
 else if(drinkCup.visible){if(!busy)avatar.reach('L',null,0);avatar.setHandCurl('L',0)}
 drinkCup.visible=visible;
}
function placeDinerCup(){
 if(!drinkCup.visible)return;
 avatar.bone('WristL').getWorldPosition(dinerCupWrist);
 avatar.bone('LowerArmL').getWorldPosition(dinerCupForearm);
 player.worldToLocal(dinerCupWrist);player.worldToLocal(dinerCupForearm);
 // Extend from the wrist into the palm and put the upright cup against the inside of the hand.
 dinerCupForearm.subVectors(dinerCupWrist,dinerCupForearm).normalize();
 drinkCup.position.copy(dinerCupWrist).addScaledVector(dinerCupForearm,.045);
 drinkCup.position.x-=.055;
}
const dinerCust=TABLES.map(()=>({here:false,leaving:false,route:[]})); // diner D-A2: the four pooled customers (shops.js), one per table; their seats come from the shift's table states (diner-job.js)
function updateCafeVisuals(dt){const room=shops.cafe,d=dinerOf(GameState.progress);
 const cafeOpen=shopOpen('cafe',GameState.progress.routine);for(let i=0;i<TABLES.length;i++){const cu=room.customers[i],v=dinerCust[i],tb=d?.tables[i],g=cu.group,chair=TABLES[i].chairs[0],aisle=TABLES[i].x<0?-2.3:2.3,want=cafeOpen&&!!tb&&(tb.status==='seated'||tb.status==='ordered'||tb.status==='eating');
  if(!d&&v.here){v.here=false;v.leaving=false;v.route=[];g.visible=false}
  else if(want&&!v.here){v.here=true;v.leaving=false;g.visible=true;g.position.set(0,.02,3);g.rotation.y=0;v.route=[[aisle,3],[aisle,chair.z],[chair.x,chair.z]]}
  else if(!want&&v.here&&!v.leaving){v.leaving=true;g.position.y=.02;v.route=[[aisle,chair.z],[aisle,3],[0,4]]}
  const walking=v.route.length>0;
  if(walking){const [x,z]=v.route[0],dx=x-g.position.x,dz=z-g.position.z,dd=Math.hypot(dx,dz);g.position.y=.02;if(dd<dt*1.7){g.position.set(x,.02,z);v.route.shift();if(!v.route.length){if(v.leaving){g.visible=false;v.here=false;v.leaving=false}else{g.position.y=-.35;g.rotation.y=chair.yaw}}}else{g.position.x+=dx/dd*dt*1.7;g.position.z+=dz/dd*dt*1.7;g.rotation.y=Math.atan2(dx,dz)}}
  cu.setMotion(walking?1.7:0);cu.setSeated(!walking&&g.visible);if(g.visible)cu.update(dt);room.usedCups[i].visible=tb?.status==='dirty'}
 if(busy){busy.elapsed+=dt;{const wobble=Math.sin(busy.elapsed*10)*.04;avatar.reach('R',new THREE.Vector3(-.2,1.1+wobble,.42),1);avatar.reach('L',new THREE.Vector3(.2,1.1-wobble,.42),1)}if(busy.elapsed>=busy.duration){const task=busy;busy=null;avatar.clearReach();task.run()}}
}
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)persist()});
let saveElapsed=0,markerTime=0;
function updateWork(dt){
 workMarker.visible=false;
 const dest=targetFor(GameState.progress),route=routeFor(GameState.progress),carrying=GameState.progress.phase==='carrying';
 $('housingStatus').textContent=GameState.progress.housing.rented?'Studio 2B · Bills due '+money(totalDue(GameState.progress.housing))+' · next in '+dueIn(GameState.progress.housing)+' days':'No home · Studio move-in $90.00';
 $('clockStatus').textContent=weekday(hudDay())+' · '+formatClock(hudMinutes())+' · Week '+weekNumber(hudDay())+hudTag();$('clockChip').textContent=weekday(hudDay()).slice(0,3)+' · '+formatClock(hudMinutes());$('earningsStatus').textContent='Earned today '+money(GameState.progress.routine.earned);
 $('needsStatus').textContent='Food '+Math.round(GameState.progress.life.food)+'% · Thirst '+Math.round(GameState.progress.life.thirst)+'% · Energy '+Math.round(GameState.progress.life.energy)+'%';
 $('needsStatus').dataset.depleted=String(GameState.progress.life.food===0||GameState.progress.life.thirst===0);
 renderVitals(GameState.progress.life);
 $('locationName').textContent=shop?SHOPS[shop].name.toUpperCase():inside?(home.kind==='house'?home.name.toUpperCase():'STUDIO 2B'):zoneAt(me.position.x,me.position.z).label;$('locationSubtitle').textContent=inside&&home.kind==='house'?'Cedar Heights':shop||inside?(shop===WHOLESALE_ID?'Ironwood':officeByKey(shop)?'Eastbank Works':'Oak & Alder'):zoneAt(me.position.x,me.position.z).subtitle;
 if(shop){const isCafe=shop==='cafe',hint=isCafe?dinerHint(GameState.progress):null,spot=hint?hint.spots.find(s=>Math.hypot(me.position.x-s.x,me.position.z-s.z)<s.range):null,hired=careerOf(GameState.progress,'diner').hired;const exit=Math.hypot(me.position.x-SHOP_EXIT.x,me.position.z-SHOP_EXIT.z)<1.5,counter=Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)<1.6,atTask=!!spot; // diner D-A2: on shift the card shows the next job and the tables; the prompt names the spot you stand at
 $('cash').textContent=money(GameState.progress.cash);$('objective').querySelector('.eyebrow').textContent=hint?'ON SHIFT · ALDER COFFEE & DINER':'NEIGHBORHOOD';$('objective').querySelector('h2').textContent=isCafe&&hint?hint.title:SHOPS[shop].name;$('objective').querySelector('p').textContent=isCafe?(hint?hint.detail:hired?'Clock in with Elena or on your phone (Jobs), 8 AM to 5 PM.':'Speak to Elena at the counter about work: eight dollars an hour plus tips.'):officeByKey(shop)?(officeByKey(shop).kind==='warehouse'?warehouseHint():'Talk to the owner at the counter, or use the time clock on the right wall. Open 6 AM–6 PM.'):shop===WHOLESALE_ID?'Flour and ground coffee at the trade counter. Open 7 AM–5 PM.':'Visit the cashier for groceries. Open 7 AM–10 PM.';$('distance').textContent=busy?'Working… '+Math.round(busy.elapsed/busy.duration*100)+'%':'Talk at the counter (E or click) · walk out the front door to leave';$('direction').style.transform='none';$('prompt').hidden=!active||modal||talking()||!!busy||(!exit&&!counter&&!atTask);$('prompt').querySelector('span').textContent=atTask?spot.label:exit?'Go outside':isCafe?'Order lunch':shop===WHOLESALE_ID?'Buy ingredients':'Buy groceries';marker.visible=false;workMarker.visible=!!hint?.next;if(hint?.next)workMarker.position.set(hint.next.mx,.04,hint.next.mz);syncParcel(carrying);return}


 if(inside){$('cash').textContent=money(GameState.progress.cash);const house=home.kind==='house',held=GameState.progress.properties?.[home.id];$('objective').querySelector('.eyebrow').textContent=house?'YOUR HOME':'YOUR FIRST HOME';$('objective').querySelector('h2').textContent=house?home.name:'Make yourself at home.';$('objective').querySelector('p').textContent=house?'Rest, cook, and make yourself at home. '+(held?.tenure==='rent'?'Rent '+money(listingOf(home.id).rentCents)+' every 7 days; next due in '+Math.max(0,held.nextBillDay-GameState.progress.housing.day)+' days. Pay or leave in the Housing app.':'You own this home.'):'Rest, cook, and make yourself at home. Rent: $60 / week. Next bills: '+weekday(GameState.progress.housing.nextBillDay)+' in '+dueIn(GameState.progress.housing)+' days.';$('distance').textContent=house&&home.STAIRS?'Bed: rest · Stairs: go up or down · Door: go outside':'Bed: rest · Door: go outside';$('direction').style.transform='none';
  const floor=home.room.floor||0,st=home.STAIRS,exit=floor===0&&Math.hypot(me.position.x-home.EXIT.x,me.position.z-home.EXIT.z)<1.5,bed=floor===(home.BED_FLOOR||0)&&Math.hypot(me.position.x-home.BED.x,me.position.z-home.BED.z)<1.4,kitchen=floor===0&&Math.hypot(me.position.x-home.KITCHEN.x,me.position.z-home.KITCHEN.z)<1.5,stairs=!!st&&Math.hypot(me.position.x-st.x,me.position.z-(floor===0?st.footZ:st.topZ))<1.5;$('prompt').hidden=!active||modal||(!exit&&!bed&&!kitchen&&!stairs);$('prompt').querySelector('span').textContent=exit?'Go outside':kitchen?'Prepare a meal':stairs?(floor===0?'Go upstairs':'Go downstairs'):'Rest and recover';marker.visible=false;syncParcel(carrying);return}
 $('cash').textContent=money(GameState.progress.cash);$('deliveryCount').textContent=GameState.progress.completed+' '+(GameState.progress.completed===1?'delivery':'deliveries')+' completed';
 $('objective').querySelector('.eyebrow').textContent=carrying?'ORDER COLLECTED':starterObjective(GameState.progress)?'GETTING STARTED':'DELIVERY WORK';
 $('objective').querySelector('h2').textContent=carrying?'Deliver to '+dest.name:starterObjective(GameState.progress)?.title||(GameState.progress.completed?'Ready for another?':'Earn your first wages.');
 $('objective').querySelector('p').textContent=carrying?(GameState.progress.completed%3===1?'Speak to Elena at the café counter. Payment: ':'Use the marked delivery box. Payment: ')+money(route.pay)+'.':starterObjective(GameState.progress)?.text||(GameState.progress.completed?'Speak to Noah at the market counter, or take a gig on your phone.':'Speak to Noah at the market counter for delivery work. Next wage: '+money(route.pay)+'.');
 const story=!carrying&&starterObjective(GameState.progress),sPt=story&&story.aim?aimPoint(story.aim):null,aimAt=sPt?{...sPt,name:STORY_PLACE_NAME[story.aim]||story.title}:dest; // the story step measures to ITS place, not the market
 const distance=Math.hypot(me.position.x-aimAt.x,me.position.z-aimAt.z);
 $('distance').textContent=Math.round(distance)+' m · '+aimAt.name;
 const atJob=carrying&&nearby(me.position,dest),atApartment=nearby(me.position,STUDIO); // E here only delivers an order; shop doors need no prompt
 const atCar=vehicles.some(v=>Math.hypot(me.position.x-v.x,me.position.z-v.z)<1.6);$('prompt').hidden=!active||modal||(!atJob&&!atApartment&&!atCar&&!nearestPerson());$('prompt').querySelector('span').textContent=atJob?'Deliver order':atApartment?'Apartment entrance':atCar?'Inspect parked vehicle':'Talk to '+nearestPerson()?.name;
 syncParcel(carrying);
 if(active&&(!modal||dialogTalking)){saveElapsed+=dt;if(saveElapsed>=4){saveElapsed=0;persist()}}
}
window.addEventListener('keydown',e=>{
 if(cargoUI?.isOpen&&cargoUI.key(e.code)){e.preventDefault();return}
 if(sleepElapsed!==null){if(['Tab','Space'].includes(e.code))e.preventDefault();return}
 if(creatorOpen||editorHook||e.target.matches('input,select,textarea,[contenteditable=true]'))return;
 if(talking()){const k=e.key||TALK_KEYS[e.code]||(/^Digit[1-7]$/.test(e.code)?e.code.slice(5):'');if(!e.repeat&&talkPanel.handleKey(k)){e.preventDefault();return}if(!['KeyT','KeyJ','KeyM'].includes(e.code)){if(['Tab','Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();return}}
 if(e.code==='KeyY'&&active&&!inside&&(!shop||inWarehouse()||inDiner())&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)setFocus(nextFocus(GameState.progress,trackerItems(GameState.progress,me.position,trackerRoom())));return}
 if((e.code==='KeyT'||e.code==='KeyJ')&&active&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)toggleObjective();return}
 if(e.code==='KeyM'&&active&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)minimap.toggle();return}
 if(consuming){if(e.code==='Escape'){pause(!modal);if(!modal)look.capture()}return}
 if(e.code==='KeyO'&&active&&!modal&&!creatorOpen&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat){world.setPlotOverlay(!world.plotOverlayVisible());toast(world.plotOverlayVisible()?'Reserved plots shown (C commercial, R residential, I industrial).':'Reserved plots hidden.')}return}
 if(e.code==='KeyG'&&active&&!modal&&!creatorOpen&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat){gridOn=!gridOn;toast(gridOn?'Plot grid shown in the farm and woods.':'Plot grid hidden.')}return}
 if(e.code===LIGHT_KEY&&active&&!modal&&!creatorOpen&&driving.driving&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)lightMode=nextLightMode(lightMode);return} // L: the headlights of the vehicle you drive: auto, on, off (the vehicle panel shows it)
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
if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&active){if(!$('dialog').hidden){$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()}else if(modal&&!$('credits').hidden)$('closeCredits').onclick();else if(modal&&!$('settings').hidden)showSettings(false);else {pause(!modal);if(!modal)look.capture()}}if(e.code==='KeyE'&&!e.repeat){eHeld=!modal;interact()}if(e.code==='KeyF'&&!e.repeat)fHeld=!modal;if(e.code==='KeyH'&&!e.repeat&&!modal)interact('H');if(e.code==='KeyN'&&!e.repeat&&!modal&&driving.active&&driving.driving)hornSound();if(e.code==='KeyC'&&!e.repeat&&!modal)interact('C');});
window.addEventListener('blur',()=>{eHeld=false;fHeld=false;if(active&&!modal&&!creatorOpen&&!editorHook)pause(true)});
window.addEventListener('keyup',e=>{if(e.code==='KeyE')eHeld=false;if(e.code==='KeyF')fHeld=false});
// Left click acts like E once the mouse is captured (the click that captures it only captures); hold to keep chopping.
window.addEventListener('mousedown',e=>{if(e.button!==0||!active||modal||talking()||creatorOpen||!look.locked())return;e.preventDefault();eHeld=true;interact()});
window.addEventListener('mouseup',e=>{if(e.button===0)eHeld=false});
document.addEventListener('click',e=>{const b=e.target?.closest?.('button');if(b&&b.closest('#store,#phone,#inventory,#welcome,#dialog,#settings'))audio.sweep('ui-click')},true); // SND3: one click sound for the menu, phone, store, inventory and dialog buttons
const canvas=$('world');const look=createLookControls(canvas,document,()=>active&&!modal&&!talking()&&!creatorOpen&&!editorHook&&!document.hidden,(dx,dy)=>{yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch+dy*.002,.08,1.05);driveIdle=0},()=>{keys.clear();if(active&&!modal&&!talking()&&!creatorOpen)pause(true)},info=>{$('mouseMode').textContent=info.mode==='captured'?'Mouse look: captured':info.mode==='free'?'Mouse look: free · move to screen edges to keep turning':'Click the game to look around';if(info.reason)$('mouseMode').title=info.reason});
$('retryCapture').onclick=()=>{pause(false);look.retry()};
canvas.addEventListener('wheel',e=>{e.preventDefault();if(active&&!modal&&!creatorOpen&&!editorHook){const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);zoomTarget=THREE.MathUtils.clamp(zoomTarget+delta*.008,3,driving.active?Math.max(12,driving.cameraZoom()*1.4):12)}},{passive:false});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();keys.pressPointer(e.pointerId,b.dataset.key);b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=e=>keys.releasePointer(e.pointerId)});$('touchE').onclick=()=>interact();
function applyQuality(value){
 if(appliedQuality===value)return;
 appliedQuality=value;const high=value==='high';
 setGroundQuality(high);if(tslKit())world.rebuildGroundTSL(high);world.setCoverTier(high?'high':'low');
 renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.6:1));renderer.shadowMap.enabled=high;nightLights.setHigh(high);
 // The node renderer tracks lights and shadow state in the pipeline key; only GLSL ground patches need an explicit refresh.
 if(!tslKit())scene.traverse(m=>{if(m.material)m.material.needsUpdate=true});
 if(!active){qualityRevision++;worldWarmReady=false}
 else if(typeof renderer.compileAsync==='function'){
  // Prepare the new shader variants while the browser can still service the settings UI.
  const pending=Promise.resolve().then(()=>qualityWarm===pending?renderer.compileAsync(inside?home.room.scene:scene,camera):null);
  qualityWarm=pending;pending.catch(error=>console.warn('[renderer] Quality compilation failed',error)).finally(()=>{if(qualityWarm===pending)qualityWarm=null});
 }
}
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
function openCreator(){if(consuming)return;if(talking())talkPanel.close();phone?.close();inventoryUI?.close();storeUI?.close();clearWorldPanel();$('dialog').hidden=true;draft={...currentAppearance};$('characterName').value=draft.name;creatorOpen=true;modal=true;look.release();keys.clear();$('welcome').hidden=true;$('controls').hidden=true;$('creator').hidden=false;document.body.classList.add('creating');creatorTab='look';renderOptions();updateDraft();focusPreview(false);Object.assign(previewFrame,previewFocus);$('characterName').focus()}
let currentAppearance={...(savedCharacter||defaults)};
if(savedCharacter)$('customizeSaved').hidden=false;
let creatorFromMenu=false;$('customizeSaved').onclick=()=>{openCreator();creatorFromMenu=creatorOpen}; // Edit character on the main menu: saving goes back to the menu (menu-scene-rules.js creatorReturn)
$('editCharacter').onclick=openCreator;
$('characterName').oninput=updateDraft;
$('rotateLeft').onclick=()=>previewTurn-=Math.PI/4;$('rotateRight').onclick=()=>previewTurn+=Math.PI/4;
function closeCreator(){creatorOpen=false;creatorFromMenu=false;modal=false;$('creator').hidden=true;document.body.classList.remove('creating');keys.clear()}
$('cancelCreator').onclick=()=>{closeCreator();if(!active)$('welcome').hidden=false};
$('creatorForm').onsubmit=e=>{e.preventDefault();if(!$('characterName').value.trim()){$('characterName').setCustomValidity('Enter a name to begin.');$('characterName').reportValidity();return}
 $('characterName').setCustomValidity('');updateDraft();currentAppearance={...draft};avatar.apply(draft);menuLive.setAppearance(draft);me.name=draft.name;persist();
 const saved=saveAppearance({setItem:(key,value)=>localStorage.setItem(key,value)},draft);
 const back=creatorReturn({active,fromMenu:creatorFromMenu})==='menu';closeCreator();if(back)$('welcome').hidden=false;else enterWorld();$('customizeSaved').hidden=false;
 if(!saved){$('objective').querySelector('p').textContent='Browser saving is unavailable. Your character will last for this session.'}
};
$('characterName').addEventListener('input',()=>$('characterName').setCustomValidity(''));
function drawCreator(){
 const narrow=innerWidth<=700,left=narrow?0:410;
 const top=narrow?Math.round(innerHeight*.38):innerHeight;
 const reserved=narrow?0:150,h=Math.max(1,top-reserved),w=narrow?innerWidth:Math.max(1,innerWidth-410);
 const y0=innerHeight-top+reserved,y=renderBackend==='WebGL'?y0:innerHeight-y0-h;renderer.setViewport(0,0,innerWidth,innerHeight); // WebGPU T5: WebGPURenderer counts viewport and scissor y from the toprenderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);renderer.setScissor(left,y,w,h);renderer.setViewport(left,y,w,h);
 previewCamera.aspect=w/h;framePreview(w/h);previewCamera.updateProjectionMatrix();previewAvatar.group.rotation.y=previewTurn;
 renderer.toneMappingExposure=INDOOR_EXPOSURE;renderer.render(previewScene,previewCamera);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
}


// Store orders (orders.js): a parcel moves from the queue to its home's drop spot when its time comes, and is collected there into the inventory.
let orderClock=0;
// Shifts (shift.js): on site means standing on one of the employer's sites (a zone, a plot or an interior room), or in a company vehicle (none yet). Checked twice a second with the game clock; a shift ends by itself at closing time or after an hour off site.
function openLoggingTutorial(){if(typeof document.body?.appendChild!=='function'||document.getElementById('logging-tutorial'))return;modal=true;keys.clear();look.release();const el=buildLoggingTutorial(document);document.body.appendChild(el);bindLoggingTutorialClose(el,document,()=>{el.remove();setTimeout(()=>{modal=false;keys.clear();look.resetMotion()},0)})} /* talk-bug: modal drops AFTER the closing key's event, so the E that closes the guide does not also press E (it clocked you straight out at the time clock) */ // T-C: the first-day logging guide (logging-tutorial.js), also opened from the phone's Jobs screen
function doClockIn(id){const r=clockIn(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=scheduleTruck(r.state);if(id==='ridgeline'&&shouldShowLoggingTutorial(GameState.progress)){GameState.progress=markLoggingTutorialSeen(GameState.progress);openLoggingTutorial()}persist();toast('Clocked in · '+employerName(GameState.progress,id));return {message:'Clocked in. '+r.tasks.length+' tasks today.'}}
function doClockOut(){const r=clockOut(GameState.progress);if(r.error)return {error:r.error};GameState.progress=r.state;persist();shiftEnded(r);return {message:'Clocked out. Paid '+money(r.stub.total)+'.'}}
const onRidgeline=()=>GameState.progress.shift?.employer==='ridgeline'; // Pine Ridge and the sawmill are the company's: they open on shift only
const CLOSED_FOREST='Pine Ridge belongs to Ridgeline Timber. Clock in to work it: your phone (Jobs) or the time clock at their Eastbank office.';
function shiftOnSite(id){return onSiteAt(id,{x:me.position.x,z:me.position.z,room:currentRoom(),inCompanyVehicle:false})}
function shiftEnded(r){if(r.stub?.total>0)audio.sweep('coins-pay');const why=r.stub.reason==='end-of-day'?'The shift is over for the day.':r.stub.reason==='off-site'?'You left the site: clocked out.':'Clocked out.';toast(why+' Paid '+money(r.stub.total)+(r.repDelta?' · reputation '+(r.repDelta>0?'+':'')+r.repDelta:''))}
let shiftClock=0;function tickShifts(dt){shiftClock+=dt;if(shiftClock<.5)return;shiftClock=0;for(const o of offices){const name=employerName(GameState.progress,o.employer);o.sign.setName(name);o.room.board.setName(name)}tickCompany();syncMarks();if(shop&&officeByKey(shop)?.kind==='warehouse')syncWarehouse();const p=GameState.progress;if(!p.shift)return;const r=tickShift(p,{onSite:shiftOnSite(p.shift.employer)});if(r.state!==p){GameState.progress=r.state;if(r.stub){persist();shiftEnded(r)}}dinerEvents(r.events);phone?.showJobs()}
// diner D-A2: what happened at the tables while the diner clock ran (diner-job.js step events): a customer sat down, an order is ready on the pass, someone gave up (-2 reputation at clock-out, never wages)
function dinerEvents(list){for(const e of list||[]){if(e.type==='customer-arrived'){toast(e.customerName+' sat down at '+TABLES[e.tableId].name+'.');audio.sweep('shop-bell')}else if(e.type==='order-ready'){toast('Order ready on the pass · '+TABLES[e.tableId].name);audio.sweep('ui-toast')}else if(e.type==='order-expired'||e.type==='seat-expired'){toast('A customer gave up and left. Reputation -2.');audio.sweep('ui-toast')}}}
let lastDue=null;function tickOrders(dt){orderClock+=dt;if(orderClock<.5)return;orderClock=0;{const h=GameState.progress.housing,due=h?totalDue(h):0;if(lastDue!==null&&due>lastDue)notifyPhone('bank','Rent and bills are due: '+money(due)+'. Pay them on the phone (Bank).');lastDue=due} const had=driving.fleet.length,before=new Set(waitingHomes(GameState.progress)),next=deliverDue(GameState.progress);
 if(next!==GameState.progress){GameState.progress=next;driving.sync(next.vehicles||[]);persist();const fresh=waitingHomes(next).filter(h=>!before.has(h))[0];if(fresh)notifyPhone('store','Your order has arrived: collect it from the '+(fresh===STUDIO_ID?'parcel locker by the studio door.':'parcel box in front of the door.'))}
 // vehicles: owned ones come into the world (a delivery just made one), the lot's display vehicles show a colour that is in stock, and a bought vehicle takes its place on the lot
 {driving.sync(GameState.progress.vehicles||[]);if(driving.fleet.length>had){const v=driving.fleet[driving.fleet.length-1];notifyPhone('store','Your '+vehicleLabel(v.spec.model,v.colour)+' has been delivered: it is parked on your driveway.')}
  for(const f of driving.fleet)if(f.display){const standing=driving.fleet.some(o=>!o.display&&o.present&&Math.hypot(o.state.x-f.spec.home.x,o.state.z-f.spec.home.z)<8);driving.setDisplay(f.spec.id,standing?null:displayColour(GameState.progress,f.spec.model))}} parcels.update(GameState.progress)}
function buyAtLot(id){const f=driving.byId.get(id);if(!f?.display||!f.colour)return;const r=buyVehicle(GameState.progress,f.spec.model,f.colour);if(r.error){toast(r.error);return}GameState.progress=r.state;driving.sync(r.state.vehicles);persist();audio.sweep('cash-register');toast(r.message)}
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
 chopping={tree,elapsed:0,struck:false,total:swingSeconds(total,hitsFor(GameState.progress.equipped,levelOf(GameState.progress.skills.lumberjack.xp).level)),variant:chopVariant(Math.floor((GameState.progress.plots?.[tree.key]?.hits|0)/HITS_PER_SWING),tree.key,CHOP_VAR)};chopping.impact=CHOP_IMPACT*chopping.total; // logging polish: one heavy swing lands HITS_PER_SWING hits (same felling time); a seeded variant per swing (the plot's hits so far, so co-op clients agree)
 return true;
}
function updateChop(dt){
 if(!chopping||modal||document.hidden)return;
 const c=chopping;if(c.saw){if(!eHeld){chopping=null;sawRecover={t:c.elapsed,release:c.elapsed,total:c.total};toast('Hold E to cut through the trunk.');return}c.elapsed=Math.min(c.total,c.elapsed+dt);sawStep(c,dt);if(c.elapsed>=c.total){chopping=null;sawRecover={t:c.total,release:c.total,total:c.total};keys.clear();strikeBuck(c,true)}return} // T-E: the chainsaw cut is a hold, not a swing; STEP 4: letting go or finishing starts the recoil (sawRecover), updateEquipped draws the pose
 c.elapsed=Math.min(c.total,c.elapsed+dt);
 const pose=chopPose(c.elapsed/c.total,CHOP_OUT,carryGrip(heldHeadEnd),c.variant);
 avatar.reach('R',pose.point,1,CARRY_POLE);avatar.setLean(pose.lean);avatar.setCrouch(pose.crouch);avatar.setTwoHanded(pose.twoHand);heldGrip=pose.grip;avatar.alignHeld(pose.align?CARRY_DIR:null); // trail carry -> both hands on the handle -> trail carry
 if(!c.struck&&c.elapsed>=c.impact){c.struck=true;strikeTree(c);if(!calm()){shake.amp=Math.max(shake.t>0?shake.amp:0,CHOP_NUDGE.amp);shake.t=Math.max(shake.t,CHOP_NUDGE.t)}} // the blade lands at CHOP_IMPACT: chips, the chop sound and a small camera nudge (the crash shake helper)
 if(c.elapsed>=c.total){avatar.reach('R',CARRY,1,CARRY_POLE);avatar.setLean(0);avatar.setCrouch(0);avatar.setTwoHanded(0);avatar.alignHeld(CARRY_DIR);heldGrip=carryGrip(heldHeadEnd);carryWeight=1;chopping=null;keys.clear();if(eHeld&&!modal&&!c.tree.stump){if(c.tree.buck){const t=(GameState.progress.logs||[]).find(l=>l.id===c.tree.buck);if(t)startBuck(t)}else chopNext()}}
}
// Digging out a stump (a Ridgeline task): the same swing as chopping, the stump is gone afterwards and the ground is bare until a sapling goes in.
function startClear(key,t){
 if(!onRidgeline()){toast(CLOSED_FOREST);return}
 if(!canAct('chop'))return;
 const check=clearStump(GameState.progress,key,me.position);if(check.error){toast(check.error);return}
 me.rotation.y=Math.atan2(t.x-me.position.x,t.z-me.position.z);armRecovery=null;keys.clear();updateEquipped(0);carryWeight=1;
 const total=swingTime(levelOf(GameState.progress.skills.lumberjack.xp).level);
 chopping={tree:{key,x:t.x,z:t.z,stump:true},elapsed:0,struck:false,total:swingSeconds(total),variant:chopVariant(0,key,CHOP_VAR)};chopping.impact=CHOP_IMPACT*chopping.total;
}
function strikeStump(c){
 const result=clearStump(GameState.progress,c.tree.key,me.position);if(result.error){toast(result.error);return}
 const sc=stumpCleared(result.state);GameState.progress=sc.state;persist();lastStages.set(c.tree.key,'cleared');world.setStage(c.tree.key,'cleared');minimap.invalidateAt(c.tree.x,c.tree.z);
 toast(result.message+(sc.message?' · '+sc.message:'')+(result.leveledUp?` Lumberjack level ${result.level}! ${perkText(result.level)}`:''));
}
function plantHere(key){
 if(!onRidgeline()){toast(CLOSED_FOREST);return}
 const r=plantSapling(GameState.progress,key,me.position);if(r.error){toast(r.error);return}
 const sp=saplingPlanted(r.state);GameState.progress=sp.state;persist();lastStages.set(key,'sapling');world.setStage(key,'sapling');{const t=world.trees.get(key);if(t)minimap.invalidateAt(t.x,t.z)}
 toast(r.message+(sp.message?' · '+sp.message:''));
}
function strikeTree(c){
 if(c.tree.stump){strikeStump(c);return}if(c.tree.buck){strikeBuck(c,false);return}
 let result=null,up=null;for(let i=0;i<HITS_PER_SWING;i++){const r=chopTree(GameState.progress,c.tree.key,me.position);if(r.error){if(!result)result=r;break}result=r;GameState.progress=r.state;if(r.leveledUp)up=r;if(r.felled)break}if(up&&!result.leveledUp)result={...result,leveledUp:true,level:up.level}; // logging polish: one heavy swing lands HITS_PER_SWING hits
 if(result.error){toast(result.error);return}
 GameState.progress=result.state;persist();
 let shiftNote='';if(result.felled){const tf=treeFelled(GameState.progress,c.tree,result.logs.map(l=>l.id));if(tf.state!==GameState.progress){GameState.progress=tf.state;persist()}shiftNote=tf.message?' · '+tf.message:''}
 if(result.felled){
  audio.logging('axeHit',{x:c.tree.x,z:c.tree.z},listenerAt());audio.logging('woodCrack',{x:c.tree.x,z:c.tree.z},listenerAt(),{scale:.55});audio.logging('treeFall',{x:c.tree.x,z:c.tree.z},listenerAt()); // LOG1: the last hit (axe + a quieter crack), then the recorded fall sequence (replaces timber chop/fall)
  // The trunk falls first; its logs appear on the ground (and can be picked up) once it has landed.
  const ids=result.logs.map(l=>l.id);ids.forEach(id=>pendingLogs.add(id));
  world.fellTree(c.tree.key,me.position,()=>{ids.forEach(id=>pendingLogs.delete(id));world.setLogs(GameState.progress.logs);audio.logging('logThud',{x:c.tree.x,z:c.tree.z},listenerAt(),{size:thudSizeForLogs(ids.length),scale:.6})}); // LOG1: the trunk lands: a log thud sized by how many logs it gives
  minimap.invalidateAt(c.tree.x,c.tree.z);
  toast((result.leveledUp?`${result.message} Lumberjack level ${result.level}! ${perkText(result.level)}`:result.message)+shiftNote);
 }else{
  audio.logging('axeHit',{x:c.tree.x,z:c.tree.z},listenerAt());world.hitTree(c.tree.key,me.position);
  if(result.leveledUp)toast(`Lumberjack level ${result.level}! ${perkText(result.level)}`);
 }
}
// Bucking (T-E): E at a trunk on the ground with an axe swings the chop swing (tools.js buckHitsFor swings, hold E to keep going); with a chainsaw, hold E for buckTimeSec seconds (letting go stops the cut).
// The last cut is grid.js buckTrunk: the trunk becomes logsFromTrunk(level) logs where it lay. The swings already in a trunk are not saved (a reload starts that trunk again).
const buckHits=new Map();
function startBuck(log){
 if(!canAct('chop'))return false;const p=GameState.progress,tool=buckTool(p);if(p.carry){toast('Your hands are full. Put it down first (X).');return false}
 const check=buckTrunk(p,log.id,me.position);if(check.error){toast(check.error);return false}
 me.rotation.y=Math.atan2(log.x-me.position.x,log.z-me.position.z);armRecovery=null;keys.clear();updateEquipped(0);carryWeight=1;const target={buck:log.id,key:'buck-'+log.id,x:log.x,z:log.z};
 if(isSaw(tool)){const st=sawStand(log.x,log.z,log.rot||0,me.position.x,me.position.z,SAW_STAND_AT),free=!worldBlocked(st.x,st.z),yaw0=me.rotation.y;sawRecover=null; // STEP 4: step in beside the trunk's middle, facing across it (where you stand is blocked: cut from here)
  chopping={tree:target,saw:true,elapsed:0,struck:false,total:buckTimeSec(tool),impact:Infinity,step:0,dx:free?st.x-me.position.x:0,dz:free?st.z-me.position.z:0,yaw0,turn:free?Math.atan2(Math.sin(st.yaw-yaw0),Math.cos(st.yaw-yaw0)):0,dust:0,bit:false,rng:(log.id*2654435761)>>>0,ground:heightAt(log.x,log.z)+(world.floorAt(log.x,log.z)??0)};return true}
 const lv=levelOf(p.skills.lumberjack.xp).level,total=swingSeconds(swingTime(lv),isAxe(tool)?buckHitsFor(tool,lv):HITS_PER_SWING);chopping={tree:target,elapsed:0,struck:false,total,impact:CHOP_IMPACT*total,variant:chopVariant(Math.floor((buckHits.get(log.id)||0)/HITS_PER_SWING),target.key,CHOP_VAR)};return true;
}
// One step of the chainsaw hold: the step in and the turn follow sawPose's step (added as a change, so it never fights other movement); while the bar is in the wood, chips fly from the kerf
// into the sawmill's sawdust pool (sawdust.js spawn: the one Points object, no new draw call), from a seeded generator (the trunk's id), never Math.random.
function sawStep(c,dt){const p=sawPose(c.elapsed,c.total,-1,SAW_STEP),k=p.step-c.step;if(k>0){me.position.x+=c.dx*k;me.position.z+=c.dz*k;c.step=p.step}me.rotation.y=c.yaw0+c.turn*p.step;
 const sd=sawmillCtl?.ready&&sawmillCtl.dust;if(!p.cutting||!sd)return;if(!c.bit){c.bit=true;c.dust+=SAW_DUST_BURST}c.dust+=SAW_DUST_RATE*dt;const fx=Math.sin(me.rotation.y),fz=Math.cos(me.rotation.y),rx=-Math.cos(me.rotation.y),rz=Math.sin(me.rotation.y),y=c.ground+2*TRUNK_RADIUS+.03;
 const rnd=()=>(c.rng=(Math.imul(c.rng,1664525)+1013904223)>>>0)/4294967296;while(c.dust>=1){c.dust--;const back=.4+rnd()*.7,side=.15+rnd()*.5,up=1.1+rnd()*.9;spawnDust(sd.particles,c.tree.x+(rnd()-.5)*.08,y,c.tree.z+(rnd()-.5)*.08,-fx*back+rx*side,up,-fz*back+rz*side,.35+rnd()*.3)}sawDustLive=1} // chips fly back toward the cutter's right, up and out of the kerf
function strikeBuck(c,last){
 const p=GameState.progress,tool=buckTool(p),id=c.tree.buck;if(!last&&isAxe(tool))audio.logging('buckCut',{x:c.tree.x,z:c.tree.z},listenerAt());
 if(!last&&isAxe(tool)){const n=(buckHits.get(id)||0)+HITS_PER_SWING,need=buckHitsFor(tool,levelOf(p.skills.lumberjack.xp).level);if(n<need){buckHits.set(id,n);toast(`Cut ${n} / ${need}`);return}}
 buckHits.delete(id);const was=(p.logs||[]).find(l=>l.id===id),r=buckTrunk(p,id,me.position);if(r.error){toast(r.error);return}
 {const bp=trunkBucked(r.state,!!was?.unmarked);r.state=bp.state;r.message+=bp.message}GameState.progress=r.state;persist();world.setLogs(GameState.progress.logs);audio.logging('woodCrack',{x:c.tree.x,z:c.tree.z},listenerAt(),{scale:.55});audio.logging('logThud',{x:c.tree.x,z:c.tree.z},listenerAt(),{size:'medium',delay:.12,scale:.7});toast(r.leveledUp?`${r.message} Lumberjack level ${r.level}! ${perkText(r.level)}`:r.message);
}
function chopNext(){
 const next=world.cuttableNear(me.position.x,me.position.z,CHOP_RANGE).sort((a,b)=>Math.hypot(a.x-me.position.x,a.z-me.position.z)-Math.hypot(b.x-me.position.x,b.z-me.position.z))[0];
 if(next)startChop(next,{quiet:true});
}
// Whatever is picked up goes in the hands or on the shoulder, so the tool in the hand is put away first (it stays in your inventory and on the hotbar).
function stowTool(){const id=GameState.progress.equipped;if(id)toggleEquip(id,{silent:true})}
function pickUpLog(id){
 beginBend(()=>{
  const wasTrunk=(GameState.progress.logs||[]).some(l=>l.id===id&&l.kind==='trunk'),result=shoulderLog(GameState.progress,id);
  if(result.error){toast(result.error);return}
  GameState.progress=result.state;const g=wasTrunk?logGathered(GameState.progress,id):{counted:false};if(g.counted)GameState.progress=g.state;persist();stowTool();world.setLogs(GameState.progress.logs);toast(result.message+(g.counted&&g.message?' · '+g.message:''));
 });
}
// Equipped tool: shown in the hand and carried at the ready (the arm blends back in after chopping or eating).
function toggleEquip(id,{silent=false}={}){if(fuel.held)return {error:'Hang up the nozzle first.'};
 if(!canAct('equip'))return {error:refusal()};
 if(GameState.progress.carry&&GameState.progress.equipped!==id)return {error:'Your hands are full. Put it down first (X).'};
 if(parcelHeld(GameState.progress)&&GameState.progress.equipped!==id)return {error:'Drop the parcel before equipping an item (X).'}; // a held parcel and a tool never share the hands
 const result=equipTool(GameState.progress,id);
 if(result.error)return result;
 GameState.progress=result.state;persist();if(!silent)toast(result.message+(result.equipped===id&&id==='gas-can'?` ${canText(canOf(result.state))}. Hold F at a pump to fill it.`:''));
 return result;
}
function updateEquipped(dt){
 const want=GameState.progress.equipped;
 if(!want){if(carried){if(carried.parent===avatar.hand)avatar.release();disposeHeldItem(carried);carried=null}avatar.alignHeld(null);sawRecover=null;sawRest();
  // The carrying arm lowers back into the animation instead of staying posed once the tool is away.
  avatar.setTwoHanded(0);
  if(carryWeight>0){carryWeight=Math.max(0,carryWeight-dt*5);avatar.reach('R',carryAt,carryWeight,CARRY_POLE)}
  return}
 if(consuming||busy){avatar.setTwoHanded(0);return} // they own the hand until they finish
 if(!carried||carried.userData.itemId!==want){
  if(carried){if(carried.parent===avatar.hand)avatar.release();disposeHeldItem(carried)}
  carried=createHeldItem(itemById(want));avatar.hold(carried,want==='gas-can'?{upright:true,curl:1}:{axis:'z',curl:1});heldHeadEnd=headEndOf(carried);heldGrip=carryGrip(heldHeadEnd);
 }else if(carried.parent!==avatar.hand)avatar.hold(carried,want==='gas-can'?{upright:true,curl:1}:{axis:'z',curl:1});
 if(want==='gas-can'){ // the can hangs level from the hand at the side (the arm swings with the walk); no chest carry
  avatar.alignHeld(null);avatar.setTwoHanded(0);sawRecover=null;sawRest();if(carryWeight>0){carryWeight=Math.max(0,carryWeight-dt*5);avatar.reach('R',carryAt,carryWeight,CARRY_POLE)}return}
 if(isSaw(want)){sawEquipped(dt);return}
 sawRecover=null;sawRest();carryAt=CARRY;
 // The axe (owner 2026-11-18, chop-path.js): a one-handed trail carry at the side, choked up under the head; while chopping, updateChop takes the grip, the alignment and the left hand from chopPose.
 const idle=!chopping&&!armRecovery;
 if(!chopping){heldGrip+=(carryGrip(heldHeadEnd)-heldGrip)*(1-Math.exp(-dt*10));avatar.alignHeld(CARRY_DIR);avatar.setTwoHanded(0)}
 if(carried.children[0])carried.children[0].position.z=-heldGrip; // the axe slides through the hand: the palm holds the held group's origin, so the mesh moves back by the grip
 if(idle){carryWeight=Math.min(1,carryWeight+dt*4);avatar.reach('R',CARRY,carryWeight,CARRY_POLE)}else if(!chopping)carryWeight=0;
}
// The chainsaw (owner 2026-11-18, chop-path.js sawPose): carried two-handed low in front, the bar forward; while bucking (chopping.saw) and during the recoil after it (sawRecover) the pose drives both arms, the lean and the crouch.
function sawEquipped(dt){carryAt=SAW_CARRY;const c=chopping?.saw?chopping:null,r=c?null:sawRecover;
 if(c||r){if(r)r.t+=dt;const p=c?sawPose(c.elapsed,c.total,-1,SAW_OUT):sawPose(r.t,r.total,r.release,SAW_OUT);
  avatar.reach('R',p.point,1);avatar.alignHeld(p.dir);avatar.setLean(p.lean);avatar.setCrouch(p.crouch);avatar.setTwoHanded(1);sawLean=true;carryWeight=1;if(r&&p.done)sawRecover=null;return}
 sawRest();if(chopping)return;
 avatar.alignHeld(SAW_DIR);if(!armRecovery){carryWeight=Math.min(1,carryWeight+dt*4);avatar.reach('R',SAW_CARRY,carryWeight,CARRY_POLE)}else carryWeight=0;
 avatar.setTwoHanded(carryWeight);
}
function sawRest(){if(sawLean){sawLean=false;avatar.setLean(0);avatar.setCrouch(0)}} // the saw's lean and crouch end once (other poses, such as bending to pick up, set their own)
function headEndOf(item){const g=item?.children[0]?.geometry;if(!g)return NaN;if(!g.boundingBox)g.computeBoundingBox();return g.boundingBox.max.z} // the far end of an axe's head (shared geometry: measured once)
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
 for(const key of grown.restored){const t=world.trees.get(key);if(t)minimap.invalidateAt(t.x,t.z)}
 for(const [key,stage] of felledStages(GameState.progress,now))if(lastStages.get(key)!==stage){lastStages.set(key,stage);world.setStage(key,stage)}
}
// Zones: grid overlay, tree sightline fade, sun/shadows following the player, minimap.
const fadeTarget=new THREE.Vector3();
const minimap=createMinimap(document,{canvas:$('minimap'),
 cityRoads:roadRects('asphalt'),
 buildings:MAP.buildings.map(b=>({x:b.x,z:b.z,hx:b.w/2,hz:b.d/2})),
 trees:()=>world.trees.values()});
const gps=createGps(); // GP1: the route, the pin and the job auto-route (gps.js); the phone's GPS screen sets them, updateZones feeds it your position
// HUD restyle (hud-restyle-spec.md): the street-sign chips above the map and the round walking card. Road edges are read once; the DOM is touched only when a name or the mode changes.
const ROAD_EDGES=Object.values(roadGraph(MAP).edges);let lastStreet='',lastCross='',lastWalk=null,lastChipsOn=null,chipClock=0;
function hudChips(outdoors,p,dt){const card=$('minimapCard');if(card){const walk=!driving.active;if(walk!==lastWalk){lastWalk=walk;card.classList.toggle('walk',walk)}}const box=$('streetChips');if(!box)return;if(lastChipsOn!==outdoors){lastChipsOn=outdoors;box.hidden=!outdoors;if(!outdoors){lastStreet=lastCross=''}}if(!outdoors)return;chipClock+=dt;if(chipClock<.25)return;chipClock=0;const c=streetChips(p.x,p.z,ROAD_EDGES),s=c.street||'',x=c.cross||'';if(s!==lastStreet||x!==lastCross){lastStreet=s;lastCross=x;const a=$('chipStreet'),b=$('chipCross');if(a){a.textContent=s;a.hidden=!s}if(b){b.textContent=x;b.hidden=!x}}}
function updateZones(dt){
 const outdoors=!inside&&!shop,zone=zoneAt(me.position.x,me.position.z).id;
 world.targetCell=world.updateGrid(me.position,me.rotation.y,gridOn&&outdoors&&active&&!modal&&zone!=='city');
 world.fade.uniforms.uFadeEnabled.value=outdoors?1:0;
 fadeTarget.set(me.position.x,me.position.y+1.5,me.position.z);
 advanceWindClock(windClock,dt);world.setWind(windSample(windClock.t,windNow,windClock.weather));world.update(dt,camera,fadeTarget);sawmillCtl?.update(dt);if(sawDustLive>0){sawDustLive-=dt;const sd=sawmillCtl?.dust;if(sd&&!sd.points.visible)sd.update(dt)}audio.chainsaw({active:isSaw(GameState.progress.equipped)&&!modal,cutting:!!chopping?.saw&&sawCutting(chopping.elapsed,chopping.total),at:me.position,listener:me.position});tickSawYard();syncSawmill();if(sawmillCtl?.ready)audio.update({listener:{x:me.position.x,z:me.position.z},blade:{at:sawmillCtl.bladePoint,level:sawmillCtl.speed,sawing:sawmillCtl.sawing},belt:{at:sawmillCtl.beltPoint,level:sawmillCtl.beltLevel}});
 const markers=[];
 if(outdoors){const job=GameState.progress.activeJob;if(job&&gigMarker.visible)markers.push({x:gigMarker.position.x,z:gigMarker.position.z,color:beaconColour(gigKind)});if(marker.visible)markers.push({x:marker.position.x,z:marker.position.z,color:beaconColour(markerKind)});for(const v of driving.fleet)if(v.present&&!v.display&&!v.dev&&v!==driving.active)markers.push({x:v.state.x,z:v.state.z,color:'#6fb7ff'})} // your own vehicles show on the minimap in blue
 const p=outdoors?me.position:shop?SHOPS[shop]:STUDIO;
 if(outdoors){const jb=GameState.progress.activeJob;gps.setJobTarget(active&&jb&&gigMarker.visible?{x:gigMarker.position.x,z:gigMarker.position.z}:null);if(gps.update(dt,{x:p.x,z:p.z})==='arrived')toast('You have arrived.')}
 minimap.update(dt,{player:{x:p.x,z:p.z},heading:outdoors?me.rotation.y:0,yaw,markers,route:outdoors?gps.ahead:null,pin:outdoors?gps.pin:null,speed:driving.speed,driving:!!driving.active});
 if(phone?.isOpen)phone.gpsUpdate(dt,{player:{x:p.x,z:p.z},heading:outdoors?me.rotation.y:0,yaw});hudChips(outdoors,p,dt);
}
function updateConsumption(dt){
 if(document.hidden)return;
 // The lowering phase is cosmetic, so it keeps playing while menus are open and the player can walk.
 if(armRecovery&&armRecovery.update(dt)==='done')armRecovery=null;
 if(!consuming||modal)return;
 if(consuming.animation.update(dt)!=='used')return;
 const action=consuming;consuming=null;armRecovery=action.animation;if(itemById(action.id)?.type==='food'){storyEvent('ate');audio.sweep('eat-bite')}$('consumeStatus').hidden=true;
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
 onBuy:id=>{if(!atMarketCounter())return {error:'Visit the open market counter to shop.'};const r=commitInventory(addItem(GameState.progress,id,{purchase:true}));if(!r.error)audio.sweep('cash-register');return r},
 onSell:()=>({error:'The Corner Market no longer buys timber. Ridgeline Timber, at Eastbank, takes logs and planks.'}),
 onGroceries:()=>atMarketCounter()?commitInventory(lifeTransaction(GameState.progress,'groceries','market')):{error:'Visit the open market counter to shop.'},
 onWork:marketWork
});
// Phone owns only its overlay; existing modal guards stop WASD and mouse look.
cargoUI=createCargoUI({document,onOpen:()=>{clearWorldPanel();modal=true;keys.clear();look.release()},onClose:()=>{modal=false;keys.clear();look.resetMotion()}});
phone=createPhone({document,getState:()=>GameState,gps:{state:gps,mapOptions:{buildings:MAP.buildings.map(b=>({x:b.x,z:b.z,hx:b.w/2,hz:b.d/2})),trees:()=>world.trees.values()}},inVehicle:()=>!!driving.active||!!fork.on,audio,pullInfo:()=>{const b=driving.driving?driving.bogOf():null;return pullOutAvailable({inVehicle:!!b,stuck:b?.stuck,soft:b?.soft})?{cents:pullFee(GameState.progress),hours:BOG_PULL_HOURS}:null},onPull:()=>{try{const b=driving.driving?driving.bogOf():null;if(!pullOutAvailable({inVehicle:!!b,stuck:b?.stuck,soft:b?.soft})){toast('You are not stuck.');return {error:'You are not stuck.'}}const spot=driving.firmSpot(),f=driving.active,r=garageDo(q=>pullOut(q,f.spec.id,spot,{drivenUid:f.spec.id,available:true}));if(r.error){toast(r.error);return {error:r.error}}driving.relocate(spot);toast(r.message);return {message:r.message}}catch(e){const m='The tow service could not do that: '+(e?.message||e);toast(m);return {error:m}}},onGiveUp:()=>{const r=abandonContract(GameState.progress);if(r.error)return {error:r.error};GameState.progress=r.state;settleParcel();persist();toast('Gig given up.');return {message:r.text}},onRead:app=>{const next=markRead(GameState.progress,app);if(next!==GameState.progress){GameState.progress=next;persist()}},isOnSite:id=>shiftOnSite(id),onClockIn:id=>doClockIn(id),onClockOut:()=>doClockOut(),onLoggingGuide:()=>{phone.close();openLoggingTutorial()},onQuit:id=>{const r=quit(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:'You quit '+employerName(GameState.progress,id)+'. Your rank is reset.'}},onCollect:id=>{const r=collectOwed(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:'Collected '+r.handed.map(t=>itemById(t)?.name||t).join(', ')+'.'}},onOrder:(cart,home)=>{const r=placeOrder(GameState.progress,cart,home);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},onOrderVehicle:(model,colour,home)=>{const r=orderVehicle(GameState.progress,model,colour,home);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},onSetMain:id=>{const r=setMainHome(GameState.progress,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},onTow:uid=>towCall(uid),onHomeAction:(action,id)=>{const r=propertyTransaction(GameState.progress,action,id);if(r.error)return {error:r.error};GameState.progress=r.state;persist();return {message:r.message}},
 canOpen:()=>active&&!modal&&!creatorOpen&&!actionBusy(),
 onOpen:()=>{clearWorldPanel();modal=true;keys.clear();look.release()},
 onClose:()=>{modal=false;keys.clear();look.resetMotion()},
 onRefresh:()=>{storyEvent('read-message');const next=refreshGigBoard(GameState.progress);if(next!==GameState.progress){GameState.progress=next;persist()}},
 onAccept:id=>{
   const result=acceptContract(GameState.progress,id,me.position);
   if(result.error)return result;
   GameState.progress=result.state;persist();
   toast('Gig accepted · '+GameState.progress.activeJob.title+' · '+(GameState.progress.activeJob.pickup?'Go and pick up the parcel first':'Follow the gold marker'));
   return result;
 }
});
// Dedicated gold marker: accepting a phone gig never overwrites a delivery route.
const gigMarker=new THREE.Group();gigMarker.name='gig-marker';gigMarker.visible=false;
const gigMaterial=new THREE.MeshBasicMaterial({color:'#f2ca79',transparent:true,opacity:.9,depthWrite:false});
const gigBeacon=makeBeacon();gigMarker.add(gigBeacon.group); // the ring is now the soft glow and beam of makeBeacon (beacon-style.js)
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
 if(modal&&!dialogTalking)return; // doors wait while a blocking menu is open, but keep running during in-world NPC talk
 updateDoorFade(dt);if(inside&&home.room.frontDoor){home.room.frontDoor.update(dt);if(leaveAfter>0){leaveAfter-=dt;if(leaveAfter<=0)leaveHome()}}
 doorCooldown=Math.max(0,doorCooldown-dt);
 const ready=doorCooldown<=0&&active&&!modal&&!actionBusy(),routine=GameState.progress.routine;
 for(const front of shopDoors){
  const dw=MAP.shops[front.kind].doorway,pres=shopPresence(front.kind,routine.minutes/60,MAP.shops),open=pres.open;front.open.visible=open;front.closed.visible=!open;{const rm=shops[front.kind];rm.clerk.group.visible=pres.clerkVisible;rm.setLight(pres.lightScale);if(!pres.customersVisible)for(const c of rm.customers)c.group.visible=false;if(!pres.cupsVisible)for(const u of rm.usedCups)u.visible=false}
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
  const room=shops[shop],exitSpec=(shop===WHOLESALE_ID?WHOLESALE_INTERIOR:(MAP.shops[shop]||officeByKey(shop)).interior).exitDoor,near=Math.abs(me.position.x)<exitSpec.near.halfWidth&&me.position.z>exitSpec.near.z;
  if(!room.exitDoor.manual)room.exitDoor.setOpen(near);room.exitDoor.update(dt); // hinged and double doors are opened by hand (E)
  if(ready&&near&&Math.abs(me.position.x)<exitSpec.trigger.halfWidth&&me.position.z>exitSpec.trigger.z&&room.exitDoor.amount>.85){doorCooldown=1;const exitX=me.position.x;startDoorFade(()=>leaveShop(exitX))}
 }
}
// The task tracker (tracker.js, 0.35). The focused task takes over the card (title, progress, the arrow); the story objective and every other task are listed under it with a tick and a distance.
// Y switches the focus; clicking a tick does too. The DOM is rebuilt only when the list changes and the distances are written four times a second.
let storyAim=null,trackerKey='',trackerClock=1;const trackerDist=new Map();
const inWarehouse=()=>!!shop&&officeByKey(shop)?.kind==='warehouse',inDiner=()=>shop==='cafe'&&GameState.progress.shift?.employer==='diner',trackerRoom=()=>inWarehouse()?{carryPlanks:GameState.progress.carry?.kind==='planks'}:inDiner()?{diner:true}:null; // inside the warehouse the arrow points at places in the room (tracker.js warehouseTarget)
function setFocus(id){GameState.progress={...GameState.progress,focus:id};persist();trackerKey=''}
// Sections of the list, in this order; a row is {id,title,pos,done,group}. The row with the dot is the one on the card (its arrow points at it).
const TRACKER_GROUPS=['Orders','Shift','Gigs','Getting started'];let prevJob=null,prevShift=false,trackerSeen=false;const prevSections=new Map(); // fixed order (DESIGN 4.19); prev* detect accepting a gig and clocking in
function updateTracker(dt){
 const list=$('trackerList');if(!active||inside||(shop&&!inWarehouse()&&!inDiner())){list.hidden=true;return}
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
 if(busy){ring={point:worldPoint({x:busy.point.x,y:1.4,z:busy.point.z}),label:busy.label,fraction:busy.elapsed/busy.duration,left:busy.duration-busy.elapsed}}
 const p=ring&&active&&!modal?screenAnchor(ring.point,camera,innerWidth,innerHeight,THREE.Vector3):null,el=$('workProgress');
 el.hidden=!p;if(!p)return;
 const percent=Math.round(Math.max(0,Math.min(1,ring.fraction))*100);
 el.style.left=p.x+'px';el.style.top=p.y+'px';el.setAttribute('aria-valuenow',String(percent));el.querySelector('.ring').style.setProperty('--p',String(percent));
 $('workRingTime').textContent=Math.ceil(Math.max(0,ring.left))+'s';$('workRingLabel').textContent=ring.label;
}
// The objective beacon (ring and diamond) and the arrow: objective.js decides what to point at (one answer for the gig, the delivery and
// the market); this is the only place that draws it. The beacon disappears when you are already there (the prompt takes over).
const OBJECTIVE_WORLD={marketDoor:{x:SHOPS.market.x,z:MAP.shops.market.doorway.beaconZ},counter:{local:COUNTER,world:{x:SHOPS.market.x+COUNTER.x,y:MAP.shops.market.interior.origin.y,z:MAP.shops.market.interior.origin.z+COUNTER.z}},cafeDoor:{x:SHOPS.cafe.x,z:SHOPS.cafe.z}};
const STORY_PLACE_NAME={market:'Corner Market',oakStreet18:'18 Oak Street',farmhouse:'Willow Farmhouse',hal:'Hal Brennan',crates:'The egg crates',farmTruck:"Hal's truck",gas:'Gas station',apartments:'Oak Street Apartments',ridgeline:'Ridgeline office',spawn:'Start'};
function updateObjective(dt){
 const progress=GameState.progress,objective=storyAimed(resolveObjective({progress,place:{inside:!!inside,shop},room:currentRoom(),gigTarget,delivery:targetFor(progress),world:OBJECTIVE_WORLD}));
 const spot=objective.beacon,near=spot?Math.hypot(me.position.x-(spot.local?.x??spot.x),me.position.z-(spot.local?.z??spot.z)):0;
 marker.visible=!!spot&&active&&near>spot.hideWithin;
 markerNear=near;markerKind=beaconKindOf({source:objective.kind});
 if(spot){marker.position.set(spot.x,spot.y+(spot.y===0?heightAt(spot.x,spot.z):0),spot.z);markerTime+=dt;diamond.position.y=2.5+spot.lift+Math.sin(markerTime*2)*.09;diamond.rotation.y+=dt*.7}
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
let gigLabelId='',gigLabelDone=-1;function updateGig(dt){
 const job=GameState.progress.activeJob;$('gigChecklist').hidden=!job;
 gigMarker.visible=active&&!!job&&!inside;
 if(!job)return;
 const target=gigTarget(job),room=currentRoom();
 let display=target,parent=scene;
 if(target.room==='cafe'){
   if(shop==='cafe')parent=shops.cafe.scene;
   else display={x:SHOPS.cafe.x,z:SHOPS.cafe.z};
 }else if(shop)gigMarker.visible=false;
 if(inside)gigMarker.visible=false;
 parent.add(gigMarker);gigMarker.position.set(display.x,parent===scene?heightAt(display.x,display.z):0,display.z);gigDiamond.rotation.y+=dt*.9;
 gigKind=beaconKindOf({source:'gig',stage:job.stage==='return'?'return':'travel'});gigNear=Math.hypot(me.position.x-display.x,me.position.z-display.z);
 const gig=GameState.progress.gigs.active,bakery=gig?.needId&&isBakeryGood(gig.needGood),arrived=bakery?gig.haul>0:job.stage!=='travel',finished=job.stage==='return';
 const returned=finished&&atGigPoint(me.position,room,job.returnLocation);
 for(const [id,done] of [['gigStepGo',arrived],['gigStepTask',finished],['gigStepReturn',returned]]){
   $(id).textContent=done?'☑':'☐';$(id).setAttribute('aria-label',done?'Complete':'Incomplete');
 }
 if(job.id!==gigLabelId||job.done!==gigLabelDone){gigLabelId=job.id;gigLabelDone=job.done;$('gigGoLabel').textContent=bakery?'Pick up at Eden Wholesale':'Go to location';$('gigReturnRow').hidden=!!bakery;$('gigTaskLabel').textContent=bakery?'Deliver to Ironwood Bakery for payment':job.stops>1?'Make the deliveries ('+job.done+' of '+job.stops+' done)':job.kind==='parcel'?'Deliver the parcel':'Make the delivery'}
 $('objective').querySelector('.eyebrow').textContent='ACTIVE GIG · '+money(job.reward);
 $('objective').querySelector('h2').textContent=job.title;
 $('objective').querySelector('p').textContent=job.pickup?'Pick up the parcel at '+(job.pickupName||'the pickup point')+' (E when you are there). Then follow the marker to the stops.':job.dropped?'Your parcel is on the ground: press E beside it to pick it up.':finished?job.kind==='parcel'?'Go to the door and press E: how you greet the client earns a tip.':'Return to the gold marker and press E to collect your pay.':job.stage==='travel'?job.description:'Carry the order to the gold delivery marker.';
 $('distance').textContent=target.room!==room?(target.room==='cafe'?'Enter Alder Coffee':'Go outside to continue'):Math.round(Math.hypot(me.position.x-target.x,me.position.z-target.z))+' m · '+(bakery?(arrived?'Ironwood Bakery':'Eden Wholesale'):finished?'Return for payment':'Gig location');
}
// Passing out (DESIGN 4.18): black fade, then (at black) the vehicle or forklift stops, a carried log or planks are put down, and you are moved to your main home's bed
// (or beside the starter apartment's door with no home); two game hours pass and you wake with energy 25. Online the clock cannot jump: a 60 s black screen with a countdown.
let passT=null,passMoved=false;
function startPassOut(){passT=0;passMoved=false;if(talking())talkPanel.close();phone?.close();$('dialog').hidden=true;clearWorldPanel();modal=true;keys.clear();look.release();const fe=$('sleepFade');fe.hidden=false;fe.style.opacity='0';fe.textContent='You passed out from exhaustion'}
function passOutMove(){
 if(fork.on)getOffFork();
 if(driving.active){driving.active.state.speed=0;exitVehicle(true)}
 busy=null;putting=null;
 {const c0=GameState.progress,k0=c0.carry?.kind;if((k0==='planks'||k0==='slab')&&!inside&&!shop&&putDownRule(k0,me.position.x,me.position.z)!=='ground'){const r=storeInYard(c0.sawmillYard,k0==='slab'?1:c0.carry.count,k0);if(r.stored)GameState.progress={...unrecordPiece(c0,k0==='slab'?'slabs':'planks',r.stored).state,sawmillYard:r.state,belt:beltOf({sawmillYard:r.state}),carry:r.left?{kind:'planks',count:r.left}:null}}}
 {const cur=GameState.progress;if(cur.carry&&cur.carry.kind!=='parcel'&&!inside&&!shop){const log=cur.carry.kind==='log'||cur.carry.kind==='trunk',x=me.position.x,z=me.position.z,r=log?putDownLog(cur,{x,z,rot:me.rotation.y+Math.PI/2}):cur.carry.kind==='planks'?putDownPlanks(cur,{x,z,q:quarterOf(me.rotation.y)}):cur.carry.kind==='slab'?putDownSlab(cur,{x,z,q:quarterOf(me.rotation.y)}):putDownCrate(cur,{x,z,q:quarterOf(me.rotation.y)});if(!r.error){GameState.progress=r.state;if(log)world.setLogs(GameState.progress.logs)}}}
 if(shop)leaveShop(0);
 doorCooldown=2;const id=mainHome(GameState.progress),target=id===null?null:id===STUDIO_ID?studioHome:houseHome(id);
 if(target){enterHome(target);const fl=home.BED_FLOOR||0;home.room.setFloor?.(fl);setMePosition(home.BED.x,fl*(home.room.FLOOR_HEIGHT||0)+.02,home.BED.z)}
 else{if(inside)leaveHome();placeSafely(STUDIO.x,.165,STUDIO.z)}
 const r=passOutThrough(GameState.progress,{online:multiplayer.online,drainMultiplier:GameState.progress.settings?.statDrainMultiplier});GameState.progress=r.state;
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
 if(talking())talkPanel.close();sleepElapsed=0;$('sleepFade').hidden=false;$('sleepFade').style.opacity='0';
}
function updateSleep(dt){
 if(sleepElapsed===null||document.hidden)return;
 sleepElapsed+=dt;
 // Fade in, hold black for one second, then fade out. Clock/life ticks are paused.
 $('sleepFade').style.opacity=String(sleepElapsed<.25?sleepElapsed/.25:sleepElapsed<1.25?1:Math.max(0,(1.5-sleepElapsed)/.25));
 if(sleepElapsed>=1.5){
   const slept=sleepThrough(GameState.progress,{online:multiplayer.online,drainMultiplier:GameState.progress.settings?.statDrainMultiplier});GameState.progress=slept.state;
   sleepElapsed=null;$('sleepFade').hidden=true;modal=false;keys.clear();look.resetMotion();persist();toast(slept.message);storyEvent('slept');audio.sweep('sleep-chime');
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
 remote.pet=applyPetSnapshot(remote.pet);GameState.otherPlayers[remote.id]=remote; // PET3: a co-op player's cat, validated (null when absent or junk)
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
 if(!multiplayer.sendPosition(GameState.me.position,room,multiplayer.online?catShare():null))return false;
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
// MP-CLOCK (session-clock.js): a joiner uses the host's game clock. The HUD and sky read the session clock while you follow the host; 'visit' leaves your saved day and time (and so crops, rent, pet and gig timers) still, 'sync' moves them along.
function hudDay(){return sessionClock.following?sessionClock.day:GameState.progress.housing.day}function hudMinutes(){return sessionClock.following?sessionClock.minutes:GameState.progress.routine.minutes}function hudTag(){return sessionClock.following&&sessionClock.mode==='visit'?' · Visiting':''}
let clockChoice=null,clockSendNow=false; // clockChoice = {key,mode}: what this player picked for this lobby, kept for the session only
function sessionStep(step){const P=GameState.progress,sc=sessionClock;
 if(sc.mode==='local'){const next=advanceTime(P,step*.5);sc.setLocal(next.housing.day,next.routine.minutes);return next}
 sc.advance(step);
 if(sc.mode==='sync'){const d=sc.abs-gameMinutes(P);return d>0?advanceTime(P,d):P}
 return P} // 'visit': nothing of the saved clock moves
function clockDialog(step){$('clockChoice').hidden=step==='none';$('clockAsk').hidden=step!=='ask';$('clockWarn').hidden=step!=='warn'}
function chooseClock(mode){clockDialog('none');sessionClock.setMode(mode);clockChoice={key:multiplayer.rejoinUrl||'',mode};toast(mode==='sync'?'Your save now follows the host\'s clock.':'Visiting: your own day and time wait for you.')}
function askClockChoice(){const P=GameState.progress,ok=canSync(gameMinutes(P),sessionClock.abs),add=Math.round(syncAdvance(gameMinutes(P),sessionClock.abs));
 $('clockHost').textContent='Host time: day '+sessionClock.day+', '+formatClock(sessionClock.minutes)+'.';$('clockVisitNote').textContent=VISIT_NOTE;$('clockWarnText').textContent=SYNC_WARNING+(add>=60?' About '+Math.round(add/60)+' game hours will pass for you.':'');
 $('clockSync').disabled=!ok;$('clockSyncNote').textContent=ok?'':'The host\'s day is earlier than your save, so syncing would turn your calendar back. You can only visit.';
 clockDialog('ask');$('clockVisit').focus()}
$('clockVisit').onclick=()=>chooseClock('visit');$('clockSync').onclick=()=>{clockDialog('warn');$('clockSyncGo').focus()};$('clockSyncGo').onclick=()=>chooseClock('sync');$('clockSyncBack').onclick=()=>{clockDialog('ask');$('clockVisit').focus()};
$('clockChoice').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!$('clockWarn').hidden){clockDialog('ask');$('clockVisit').focus()}else chooseClock('visit')}});
multiplayer.onConnected(()=>{sessionClock.setHost(multiplayer.isHost);if(multiplayer.isHost){sessionClock.setMode('local');clockSendNow=true}});
multiplayer.onHost(()=>{const was=sessionClock.isHost;sessionClock.setHost(multiplayer.isHost);if(multiplayer.isHost&&!was){clockDialog('none');if(!sessionClock.synced)sessionClock.setMode('local');clockSendNow=true;toast('You are the host now: your clock is the session clock.')}});
multiplayer.onClock(m=>{if(sessionClock.isHost)return;const first=!sessionClock.synced;if(first&&sessionClock.mode==='local')sessionClock.setMode('visit');sessionClock.receiveHost(m);
 if(first){if(clockChoice&&clockChoice.key===(multiplayer.rejoinUrl||''))chooseClock(clockChoice.mode);else askClockChoice()}});
multiplayer.onPlayerJoined(()=>{if(sessionClock.isHost)clockSendNow=true});
multiplayer.onDisconnected(()=>{clockDialog('none');sessionClock.reset();sessionClock.setLocal(GameState.progress.housing.day,GameState.progress.routine.minutes)});
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
 if(networkTimer>=50&&(moving||changed||(catActor.visible&&networkTimer>=250)))sendLocalPosition(); // PET3: while your cat is shown, 4 a second so a visitor sees it move
 for(const mesh of Object.values(remoteMeshes))updateRemotePlayer(mesh,dt);
 if(sessionClock.dueBroadcast(dt,clockSendNow)){clockSendNow=false;multiplayer.sendClock(sessionClock.hostMessage())} // the host's game clock, every 30 s and when someone joins
}

let prev=performance.now(),frames=0,elapsed=0,menuDrawn=false,stuckTime=0,warmed=false;
// The live scene behind the main menu (menu-scene.js, rules in menu-scene-rules.js): drawn at a capped frame rate while #welcome is showing, freed when the game starts. If it cannot be built, or the player asks for reduced motion, the menu keeps its picture.
const menuLive=createMenuLive({build:()=>{const s=createMenuScene({createCharacter,appearance:currentAppearance,vehicle:menuVehicleFor(GameState.progress.vehicles),minutes:GameState.progress.routine.minutes,renderer,cover:mainMenu.settings.quality==='low'?.4:1});return {update:s.update,setAppearance:s.setAppearance,dispose:s.dispose,render(){s.frame(innerWidth,innerHeight);renderer.toneMappingExposure=s.exposure();renderer.render(s.scene,s.camera)}}},ready:characterAssetsReady,menuVisible:()=>!$('welcome').hidden,pageHidden:()=>typeof document!=='undefined'&&!!document.hidden,reducedMotion:()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,setLive:on=>$('welcome').classList.toggle('live',on),setStill:on=>{$('welcome').style.backgroundImage=on?MENU_STILL:''},fps:()=>mainMenu.settings.quality==='low'?MENU_FPS_LOW:MENU_FPS});
// One slice of simulated time (see timestep.js). Everything that has to advance with real time runs here, once per slice.
// Returns whether a movement key was pressed during the slice.
// Carrying and the needs (DESIGN 4.18) together decide how fast you walk and whether Shift runs.
function moveFx(){const fx=carryEffects(GameState.progress.carry),n=needsEffects(GameState.progress.life);return {...fx,speed:fx.speed*n.speed,sprint:fx.sprint&&n.canRun}}
// SND-hooks: small sound helpers (cooldowns by wall clock; the forklift call reuses one object, so nothing is allocated per frame).
let sndBrakeAt=-1e9,sndBreathAt=-1e9,forkSndOn=false;const forkSnd={on:false,speed:0,raise:0,at:null,listener:null};
function brakeSqueal(){const t=performance.now();if(t-sndBrakeAt<1500)return;sndBrakeAt=t;audio.sweep('brake-squeal',driving.active?.state,me.position)}
function breathTired(){const t=performance.now();if(t-sndBreathAt<8000)return;sndBreathAt=t;audio.sweep('breath-tired')}
function hornSound(){audio.sweep('car-horn',driving.active?.state,me.position)}
function forkSound(){const on=fork.on;if(!on&&!forkSndOn)return;forkSnd.on=on;forkSnd.speed=fork.state.speed;forkSnd.raise=on&&active&&!modal?Number(keys.has('KeyR'))-Number(keys.has('KeyF')):0;forkSnd.at=fork.state;forkSnd.listener=me.position;audio.forklift(forkSnd);forkSndOn=on}
function stepWorld(step){
 let startX=me.position.x,startZ=me.position.z;
 let pressed=false;
 if(fork.on){if(active&&!modal&&!document.hidden){const k=c=>keys.has(c),ctx=forkCtx();fork.state=forklift.step(fork.state,{throttle:Number(k('KeyW')||k('ArrowUp'))-Number(k('KeyS')||k('ArrowDown')),steer:Number(k('KeyA')||k('ArrowLeft'))-Number(k('KeyD')||k('ArrowRight')),raise:Number(k('KeyR'))-Number(k('KeyF')),boost:k('ShiftLeft')||k('ShiftRight')},step,forkBlockedFn,{forksClear:s=>fp.forksClear(s,ctx),liftRange:s=>fp.liftRange(s,ctx)});{const c2=forkCtx(),held=k('KeyR')||k('KeyF'),a=fp.assist(fork.state,c2,step,{forksHeld:held});if(a!==fork.state&&forklift.clear(a,forkBlockedFn,{forksClear:s=>fp.forksClear(s,c2)}))fork.state=a;forkTick(c2,Number(k('KeyR'))-Number(k('KeyF')));forkCrossCheck()}const seat=forklift.seatOf(fork.state);me.position.x=seat.x;me.position.z=seat.z;me.rotation.y=fork.state.yaw;startX=seat.x;startZ=seat.z}}else if(driving.active){ // driving: the keys steer the vehicle and you ride at its seat (nothing paused is simulated: a paused game leaves the vehicle where it is)
  if(active&&!modal&&!document.hidden){const hs=stopSlice(hitStop,step);hitStop=hs.left;if(hs.dt>0)driving.step(hs.dt,{throttle:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),steer:Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight')),brake:keys.has('Space')},pedObstacles()); if(driving.driving&&driving.hit)edgeNote();if(keys.has('Space')&&Math.abs(driving.speed)>6)brakeSqueal();
   for(const e of driving.takeEvents())driveEvent(e);const seat=driving.seat();me.position.x=seat.x;me.position.z=seat.z;me.rotation.y=driving.yaw;startX=seat.x;startZ=seat.z; // riding is not walking: no walked distance, no stuck check
   driveSave+=step;if(driveSave>=5){driveSave=0;persist()}}
 }else if(active&&!modal&&!talking()&&!actionBusy()&&!putting){let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),s=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let len=Math.hypot(f,s);if(len){f/=len;s/=len;const fx=moveFx(),speed=(fx.sprint&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))?8.2:4.5)*fx.speed,dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*step,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*step;if(!blocked(me.position.x+dx,me.position.z))me.position.x+=dx;if(!blocked(me.position.x,me.position.z+dz))me.position.z+=dz;const angle=Math.atan2(dx,dz);me.rotation.y+=Math.atan2(Math.sin(angle-me.rotation.y),Math.cos(angle-me.rotation.y))*(1-Math.exp(-step*24));{const pb=Math.floor(phase/Math.PI);phase+=step*speed*2.0;if(Math.floor(phase/Math.PI)!==pb)footstep(speed>5)}pressed=true}}
 const movedStep=Math.hypot(me.position.x-startX,me.position.z-startZ),moving=pressed&&movedStep>.000001,running=moving&&moveFx().sprint&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));if(moving&&!running&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&!needsEffects(GameState.progress.life).canRun)breathTired();
 if(active&&(!modal||dialogTalking)&&!document.hidden){GameState.progress=sessionStep(step);if(worldDue(GameState.progress,!multiplayer.online||multiplayer.isHost))worldDayPassed();const oldStage=GameState.progress.activeJob?.stage;
const load=Math.max(1,carryEffects(GameState.progress.carry).load);
tickLife(step,moving,running,load);if(passT===null&&sleepElapsed===null&&needsEffects(GameState.progress.life).passOut)startPassOut();
GameState.progress=tickContract(GameState.progress,{position:parcelAwayNow()?null:me.position,room:currentRoom(),dt:step,moving,paused:!!consuming,running,distance:movedStep});
if(oldStage&&!GameState.progress.activeJob)notifyPhone('gigs','Gig failed: the time ran out.');storyTick();petTick();garageTick();if(oldStage!==GameState.progress.activeJob?.stage){settleParcel();persist()}if(!inside&&!shop){{const day=GameState.progress.housing?.day||1,minute=GameState.progress.routine?.minutes||0;const conversation=talking()?talkNow:!$('dialog').hidden?worldPanel:null;npcCrowd.update(step,me.position,{day,minute,busy:busyness({weather:npcWeather(day),minute,weekday:day})},conversation?.actor,conversation?.slotId)}hal.update(step,me.position,halHere(GameState.progress))}else npcCrowd.hideAll();regrowClock+=step;if(regrowClock>=5){regrowClock=0;tickRegrowth()}if(inside||shop){saveElapsed+=step;if(saveElapsed>=4){saveElapsed=0;persist()}}}
 if(active&&(!modal||dialogTalking)&&!document.hidden)updateCafeVisuals(step);updateConsumption(step);updateDoors(step);updateChop(step);updatePutting(step);fuelTick(step);forkSound();
 return pressed;
}
function warmWorld(){
 if(worldWarm||worldWarmReady)return;
 const revision=qualityRevision,t0=performance.now();
 updateCamera(me,yaw,pitch,zoom,0);
 const visible=async()=>renderer.compileAsync(scene,camera);
 const hidden=async()=>renderer.__directOutput?.warmHidden(scene,camera);
 worldWarm=Promise.allSettled([visible(),hidden()]).then(results=>{
  worldWarm=null;
  if(revision!==qualityRevision)return;
  worldWarmReady=true;globalThis.__warmMs=Math.round(performance.now()-t0);
  if(results[0].status==='rejected')console.warn('[renderer] World shader warm-up failed',results[0].reason);
 });
}
function frame(now){
 requestAnimationFrame(frame);if(frameProbe)frameProbe(now);if(perf)perf.begin(active);
 const real=Math.max(0,Math.min((now-prev)/1000,MAX_FRAME)),view=Math.min(real,.1); // real time drives the simulation; visuals smooth over at most 0.1 s
 prev=now;
 if(renderBackend==='WebGL'){
  if(!warmed){warmed=true;const w0=performance.now();try{renderer.compile(scene,camera)}catch{}globalThis.__warmMs=Math.round(performance.now()-w0)}
 }else if(!active){warmWorld();if(playQueued&&worldWarmReady)enterWorld()}
 if(npcWarm){npcWarm.step();if(npcWarm.done)npcRoutesReady()} /* 0.36.3: never finish the route table in one blocking call on Play (measured 2-4.7 s freeze, Neo 2026-11-19): it keeps filling in 4 ms slices and the static routes cover until it is done */ // // N2: the route table fills in slices on the menu; pressing Play first finishes it at once, so the schedule is rebuilt before anyone is drawn
 if(GameState.progress.properties!==signsFor){signsFor=GameState.progress.properties;houseSigns.sync(heldIds(GameState.progress))} // rent, buy, move out, eviction: the sign follows
 if(creatorOpen){previewAvatar.update(view);drawCreator();return}
 if(editorHook){editorHook.frame(view);renderer.render(scene,camera);return} // the scene editor (scene-editor.js) is open: the world is paused, only its camera and helpers move
 // The WebGPU world waits for compilation. Classic WebGL still uses the first world draw to warm textures.
 if(!active){if(renderBackend!=='WebGL'||menuDrawn){menuLive.tick(now);return}menuDrawn=true}else{menuDrawn=false;menuLive.dispose()}
 frames++;elapsed+=real;if(elapsed> .75){$('fps').textContent=Math.round(frames/elapsed)+' FPS'+(renderBackend==='WebGL'?'':' | '+renderBackend);frames=0;elapsed=0}
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
const talkActor=talking()&&talkNow.actor?talkNow.actor:worldPanel?.actor&&!$('dialog').hidden?worldPanel.actor:null;if(talkActor){const actor=talkActor,pa=getMeWorldPosition(talkA),pb=actor.getWorldPosition(talkB),mid=talkMid.copy(pa).add(pb).multiplyScalar(.5);mid.y-=.35;const angle=Math.atan2(pa.x-pb.x,pa.z-pb.z);actor.rotation.y=angle;me.rotation.y=angle+Math.PI;worldPlayer.position.copy(mid);if(shop)shops[shop].camera(worldPlayer,angle+.45,.26,5.8,view);else updateCamera(worldPlayer,angle+.45,.26,5.8,view)}else if(shop){getMeWorldPosition(worldPlayer.position);shops[shop].camera(worldPlayer,yaw,pitch,zoom,view);}else if(inside)(home.camera||indoorCamera)(me,yaw,pitch,zoom,view);else{camera.position.sub(shake.off);updateCamera(me,yaw,pitch,zoom,view);applyShake(view)}
sky.update(sessionClock.following?sessionClock.minutes:GameState.progress.routine.minutes,{target:inside||shop?null:me.position,indoors:!!shop});if(inside)renderer.toneMappingExposure=INDOOR_EXPOSURE;else shadows.update({sky:sky.state(),outdoors:!shop,indoors:!!shop,low:mainMenu.settings.quality!=='high',centre:me.position}); // shadows.js: the shadow box snaps to texels and fades at low sun (High), patches under people and vehicles (Low). Before that: the sun or moon follows the player outdoors; rooms stay day-bright for now
if(!driving.driving)lightMode='auto';if(GameState.progress.properties!==lightsHeldFor){lightsHeldFor=GameState.progress.properties;lightsHeld=heldIds(GameState.progress)}
if(!inside)nightLights.update(view,{sky:sky.state(),high:mainMenu.settings.quality==='high',held:lightsHeld,vehicles:[driving.driving?{key:'own',mesh:driving.active.mesh,model:driving.active.spec.model,use:'driver',mode:lightMode,own:true}:null,{key:'customer-truck',mesh:customerTruck.mesh,model:'flatbed',use:customerTruck.phase==='in'||customerTruck.phase==='out'?'driver':'parked'},{key:'dock-truck',mesh:dockTruck.mesh,model:'flatbed',use:dockTruck.phase==='in'||dockTruck.phase==='out'?'driver':'parked'}]}); // lamps, windows and vehicle lamps follow the picture's time (night-lights.js); a parked vehicle is dark
if(!inside&&edenLit.win){const st=sky.state(),g=edenGlowAt(st.minutes,st);if(g.key!==edenLit.key){edenLit.key=g.key;edenLit.win.emissiveIntensity=g.windows;edenLit.lamp.emissiveIntensity=g.lamps}} // W-PLACE: Eden Wholesale's windows and lamp lenses (eden-wholesale-place.js glowAt); only a uniform changes

ambienceTick(view);updateEquipped(modal?0:view);updateCarryPose(view);updateNozzlePose(view);updateForkPose();updateDock(modal?0:view);if(forkGuide)forkGuideTick(fork.on?forkCtx():null,view);poseDinerCup();avatar.update(modal?0:view);placeDinerCup();if(shop)shops[shop].clerk.update(modal?0:view);updatePalletTags();updateZones(view);petFrame(view);updatePassOut(real);updateSleep(real);updateWork(view);updateGig(view);updateObjective(view);updateWorldUI();updateTracker(real);updateBeacons(view);updateHomeNotices();tickOrders(real);tickShifts(real);updateRing();updateMultiplayer(now,moving,view);syncPlayerMesh();fuelHose();{const dv=driving.active,on=!!dv&&(dv.fuelMgal>0||!dv.spec.fuel)&&!modal,run=on&&(!driving.driving||dv.engine.mode==='run'),dm=dv?smokeOf(dv.cond,driving.damageOf(dv).sinceCrash):null;voiceT+=view;const thr=keys.has('KeyW')||keys.has('ArrowUp')||keys.has('KeyS')||keys.has('ArrowDown')?1:0;{const tip=dv&&run?driving.exhaust(dv):null;if(tip)smoke.emit(dv.spec.id,view,tip,exhaustRate({running:true,throttle:driving.driving&&(keys.has('KeyW')||keys.has('ArrowUp'))?1:0,speed:dv.state.speed,top:dv.cls.top,tier:dv.cls.tier})*dm.exhaustMul,dm.tier);const hp=dv&&!modal&&dm.hoodRate>0?driving.hood(dv):null;if(hp)smoke.emit(dv.spec.id+'-hood',view,hp,dm.hoodRate,dm.tier);smoke.update(view,!inside);if(!modal)driving.sprayWheels(debris,view,{throttle:thr,quality:mainMenu.settings.quality,calm:calm()});debris.update(view,!inside)}audio.engine(engineVoice({speed:dv?dv.state.speed:0,top:dv?dv.cls.top:10,throttle:dv&&driving.driving&&(keys.has('KeyW')||keys.has('ArrowUp'))?1:0,tier:dv?dv.cls.tier:'low',running:run,cond:dv?dv.cond:1000,time:voiceT}),dv?dv.cls.id:null);driveFx.on=!!dv&&driving.driving&&!modal;driveFx.sliding=driving.hit;driveFx.speed=dv?dv.state.speed:0;driveFx.x=dv?dv.state.x:0;driveFx.z=dv?dv.state.z:0;driveFx.dt=view;driveFx.people=pedestrians.people;driving.tyreFx(driveFx,thr);audio.drive(driveFx)}audio.fuel({listener:listenerAt(),at:fuel.held?fuel.held.use:canAt,level:fuelFlow,fullness:fuelFull});fuelFlow=0;canAt=null;if(!qualityWarm)renderer.render(inside?home.room.scene:scene,camera)}requestAnimationFrame(frame);

// Development hook: open the game with ?debug to inspect state from the console (window.__city).
if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('debug'))window.__city={blockedAt:(x,z)=>blocked(x,z),renderer,smoke,debris,GameState,world,scene,camera,avatar,driving,nightLights,shadows,lookAt:minutes=>sky.tune({minutes}),pedestrians,audio,sawmillCtl,enterOffice:key=>{const o=officeByKey(key);if(o)enterOffice(o);return !!o},holdBend:a=>{bendNow=a;avatar.setLean(a*.87);avatar.setCrouch(a*.22)},
 teleport(x,z){if(inside||shop)return false;setMePosition(x,me.position.y,z);return true},
 view(newYaw,newPitch,newZoom){yaw=newYaw??yaw;pitch=newPitch??pitch;zoom=zoomTarget=newZoom??zoom},
 give(id){return commitInventory(addItem(GameState.progress,id))},equip:id=>toggleEquip(id,{silent:true}),hotbarUse,eHold(on){eHeld=on},place(x,z){setMePosition(x,me.position.y,z)},get shop(){return shop},get beacon(){return {visible:marker.visible,x:+marker.position.x.toFixed(2),y:+marker.position.y.toFixed(2),z:+marker.position.z.toFixed(2),diamondY:+diamond.position.y.toFixed(2)}},doors(){return {modal,active,busy:!!busy,fade:!!doorFade,cooldown:+doorCooldown.toFixed(2),fronts:shopDoors.map(f=>({kind:f.kind,amount:+f.door.amount.toFixed(2),open:shopOpen(f.kind,GameState.progress.routine),blocked:colliders.includes(f.blocker),dx:+(me.position.x-f.x).toFixed(2),z:+me.position.z.toFixed(2)}))}},get pos(){return {x:+me.position.x.toFixed(2),z:+me.position.z.toFixed(2),ry:+me.rotation.y.toFixed(2)}},get doorCooldown(){return +doorCooldown.toFixed(2)},get inside(){return inside},get hidden(){return $('objectiveDetails').hidden},get fork(){return fork},notify:notifyPhone,toastState:()=>({showing:toastShowing,waiting:[...toastQueue],text:$('jobToast').textContent}),tagsShown(){const o=shop&&officeByKey(shop);return o?.room?.tags?.shown||[]},tickRegrowth,
 use(index){return beginConsumption(index)},chop:startChop,get acting(){return !!(chopping||consuming||armRecovery)},fps:()=>$("fps").textContent};

// Update notice (update-check.js): asks the site for version.json a few seconds after loading and every 10 minutes; a newer version shows the banner, and Reload saves first (only once you are in the game, not on the menu).
const updateNotice=installUpdateNotice({document,version:VERSION,fetchJson:url=>fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null),beforeReload:()=>{if($('welcome').hidden)persist()},reload:()=>location.reload()});
// Dev mode (dev.js): one flag, dev-flag.js. With it off, dev.js is never fetched. To remove it for good, delete dev-flag.js, dev.js, the DEV_MODE import and this block.
// Everything the panel can do goes through the object below.
if(DEV_MODE){try{if(perfWanted)perf=perfMod.createPerfProbe({renderer,backend:renderBackend}); // ?perf=1 (WebGPU T6): 600 frames of CPU, interval and GPU time, printed as a table (perf-probe.js)
 const edit=await import('./interior-edit.js'),rooms=await import('./interiors.js'),currentRoom2=()=>inside&&home.kind==='house'?home.room:null;let problemsKey='',problemsNow=[];
 const {installDevMode}=await import('./dev.js'),centre=id=>{const b=MAP.zones.find(zone=>zone.id===id).bounds;return {x:(b.x0+b.x1)/2,z:(b.z0+b.z1)/2}},at=(id,label,x,z)=>({id,label,x,z}),street=kind=>({x:MAP.shops[kind].x,z:MAP.shops[kind].doorZ+4});
 installDevMode({
  $,items:ITEMS,
  places:[at('spawn','Spawn · Oak Street',MAP.spawn.x,MAP.spawn.z),at('market','Corner Market (street)',street('market').x,street('market').z),at('cafe','Alder Coffee (street)',street('cafe').x,street('cafe').z),
   ...['alder','cedar','eastbank','farm','forest'].map(id=>at(id,MAP.zones.find(zone=>zone.id===id).name,centre(id).x,centre(id).z)),
   ...MAP.water.bridges.map(b=>at(b.id,b.name||(b.id==='county-bridge'?'County Bridge':'Freight Bridge'),(b.x0+b.x1)/2,(b.z0+b.z1)/2))],
  position(){const p=me.position;return {x:p.x,z:p.z,where:shop?'Inside a shop':inside?'Inside a home':(zoneAt(p.x,p.z)?.label||'Open Country')}},
  wipePlayer(){const removed=wipePlayerKeys(localStorage);reloadWithNewSave();return {removed}}, // PB1: removes only the player keys (profile.js wipePlayerKeys), locks persist() so pagehide cannot write the old game back, reloads
  snapshot:()=>({minutes:GameState.progress.routine.minutes,cash:GameState.progress.cash}),
  setShadows(on){renderer.shadowMap.enabled=!!on;scene.traverse(m=>{if(m.material)m.material.needsUpdate=true})}, // for finding what causes a glitch on your GPU
  setTreeFade(on){world.fade.uniforms.uFadeEnabled.value=on?1:0},
  sky:{tune:v=>sky.tune(v),tuning:()=>sky.tuning(),state:()=>sky.state(),cost:()=>{const d=renderer.__directOutput?.last;return {calls:d?d.calls:renderer.info?.render.drawCalls??renderer.info?.render.calls??0,triangles:d?d.triangles:renderer.info?.render.triangles??0,programs:renderer.info?.programs?.length??0}},probe:fn=>{frameProbe=fn}}, // the look sliders and the cost line (sky.js)
  lights:{tune:v=>nightLights.tune(v),tuning:()=>nightLights.tuning(),state:()=>nightLights.state()}, // the "Lights" slider and what is lit now (night-lights.js)
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
  editor:{camera,scene,canvas:$('world'),world,on:()=>!!editorHook, // the scene editor (scene-editor.js): it pauses the world by taking over frame(); leave() puts the player back with placeSafely
   blocked:()=>!active?'Start the game first.':modal?'Close the open menu first.':inside||shop?'Go outdoors first.':driving.active||fork.on?'Get out of the vehicle first.':null,
   player:()=>({x:me.position.x,z:me.position.z}),
   enter(hook){editorHook=hook;keys.clear();eHeld=false;fHeld=false;look.release()},
   leave(){editorHook=null;keys.clear();eHeld=false;fHeld=false;return placeSafely(me.position.x,me.position.y,me.position.z)}},
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
