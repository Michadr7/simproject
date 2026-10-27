import {createPhone} from './phone.js';
import {acceptContract,completeContract,tickContract,gigTarget,atGigPoint,refreshGigBoard} from './contracts.js';
import {GameState,initializeState,setMePosition} from './state.js';
import {loadProfile,saveProfile} from './profile.js';
import {MultiplayerClient} from './multiplayer.js';
import {createRemotePlayer,updateRemotePlayer,disposeRemotePlayer} from './remote-player.js';
import {chooseInteraction,screenAnchor} from './interactions.js';
import {createLookControls} from './look-controls.js';
import {normalizeCafe,cafeTask,cafeTransaction,expireCafe,ORDERS,MANAGER} from './cafe-job.js';
import {advanceTime,clockText,shopOpen} from './routine.js';
import {normalizeLife,tickLife,lifeTransaction} from './life.js';
import {SHOPS,SHOP_ENTRY,SHOP_EXIT,COUNTER,createShop} from './shops.js';
import {createPedestrians,createVehicles} from './neighborhood.js';
import * as THREE from './vendor/three.module.js';
import { createCameraController } from './camera.js';
import {MARKET,routeFor,targetFor,nearby,money,transactJob} from './jobs.js';
import {STUDIO,totalDue,housingTransaction,weekday,weekNumber,dueIn,estimatedUtilities} from './housing.js';
import {createApartment,EXIT,BED,ENTRY} from './apartment.js';
import {createIndoorCamera} from './indoor-camera.js';
import {polishWorld} from './visuals.js';
import {createMovementInput} from './input.js';
import {createCharacter} from './character.js';
import {palettes,styles,defaults,loadAppearance,saveAppearance} from './appearance.js';
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#b9cbd0');scene.fog=new THREE.Fog('#b9cbd0',65,155);
let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'low-power'});}catch(e){$('error').hidden=false;$('error').textContent='This prototype needs WebGL. Please try a browser with hardware acceleration enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,220);scene.add(new THREE.HemisphereLight('#d8e8f0','#777655',1.7));const sun=new THREE.DirectionalLight('#ffe3b9',3.1);sun.position.set(-24,30,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,far:130});sun.shadow.bias=-.0005;scene.add(sun);
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
 sign.position.set(x,y,z);sign.rotation.y=rot;scene.add(sign);
}

box(180,.25,180,0,-.2,0,'#8a9a7c');box(110,.12,19,0,-.03,6,'#535d60');box(16,.13,120,-30,-.02,0,'#535d60');box(92,.25,5,8,.06,-6,'#b7b6a8');box(92,.25,5,8,.06,18,'#b7b6a8');box(5,.26,98,-19,.06,-25,'#b7b6a8');
for(let x=-48;x<55;x+=8){if(x<-40||x>-20)box(3,.02,.14,x,.05,6,'#d9d5bb')}for(let z=-47;z<55;z+=8)if(z<-8||z>20)box(.14,.02,3,-30,.06,z,'#d9d5bb');for(let i=0;i<7;i++){box(.85,.025,7,-18+i*1.55,.06,6,'#dfdfd1');box(8,.025,.9,-30,.06,-7+i*1.6,'#dfdfd1')}
function building(x,z,w,d,h,c,name){const before=scene.children.length;const kind=name==='CORNER MARKET'?'market':name==='ALDER COFFEE'?'cafe':null;if(kind){const shell=box(w,h-3.5,d,x,3.5+(h-3.5)/2,z,c);shopShells[kind].push(shell);colliders.push({x,z,hx:w/2,hz:d/2});for(const side of [-1,1])shopShells[kind].push(box(1.5,3.5,10,x+side*6.75,1.75,-13.5,c));}else box(w,h,d,x,h/2,z,c,true);box(w+.35,.35,d+.35,x,h+.1,z,'#d6d2c4');box(w+.4,.22,d+.4,x,3.6,z,'#d6d2c4');const front=z+d/2+.025;for(let xx=x-w/2+1.4;xx<x+w/2-.7;xx+=2.5)for(let yy=5;yy<h-1;yy+=2.8){box(1.1,1.65,.08,xx,yy,front,'#435d68');box(1.32,.12,.22,xx,yy-.85,front+.08,'#d1c6b1')}if(name){if(name==='OAK STREET APARTMENTS')label(name,x,3.96,front+.24,7,0,'#243e3b','#f1ebd9',.42);else if(kind)label(name,x,3.96,front+.24,7,0,'#243e3b','#f1ebd9',.42);else label(name,x,3,front+.12,Math.min(w-1,7));if(!kind)for(let xx=x-w/2+1.5;xx<x+w/2;xx+=3)box(1.8,1.9,.1,xx,1.25,front,'#3d555a')}if(kind){shopShells[kind]=[...new Set([...shopShells[kind],...scene.children.slice(before)])];cameraSolids.push(shopShells[kind][0]);}}
building(1,-15,17,13,17,'#b08b74','OAK STREET APARTMENTS');building(19,-13.5,15,10,9,'#c2bc9b','CORNER MARKET');building(36,-16,15,15,13,'#82948d','ALDER COFFEE');building(-13,-18,8,19,12,'#9b9f98','LAUNDRY');
// Entrance is a distinct replaceable asset; interaction data is separate from scenery.
const entrance={x:1,z:-8.25,radius:3.3};box(2.2,2.7,.18,1,1.35,-8.36,'#213a3c');box(.08,2.3,.05,1,1.3,-8.23,'#aebeb5');box(.12,.25,.08,1.6,1.3,-8.18,'#e3cf93');box(3.6,.18,1.8,1,3.05,-7.8,'#374e46');label('18',1,2.83,-8.16,.45,0,'#213a3c','#e3cf93',.16);
building(-4,31,20,19,11,'#c4b298');building(19,33,17,23,15,'#929e9a');building(39,31,17,19,10,'#b5a38d');building(-48,-19,18,21,19,'#899c9b');building(-49,26,18,20,12,'#af9d8c');
for(let x=-65;x<80;x+=17)building(x,-61,13,17,12+((x+65)%4)*3,'#a3ada3');
const trees=[],lampMeshes=[];
function tree(x,z){
  const trunk=box(.3,3.8,.3,x,1.9,z,'#726452',true);
  // Trunks still block walking; their view fades instead of pushing the camera.
  cameraSolids.splice(cameraSolids.indexOf(trunk),1);
  trunk.material=trunk.material.clone();trunk.material.transparent=true;trunk.material.depthWrite=false;
  const canopy=new THREE.Mesh(new THREE.IcosahedronGeometry(1.35,1),mat('#617e58').clone());
  canopy.material.transparent=true;canopy.material.depthWrite=false;
  canopy.position.set(x,4.7,z);canopy.scale.y=1.1;canopy.castShadow=true;scene.add(canopy);
  trees.push({x,z,trunk,canopy});
}
// Keep tree crowns clear of shop signs, doorways and the crosswalk approach.
for(const [x,z]of[[-9,-4.5],[10,-4.5],[28,-4.5],[47,-4.5],[-14,19],[7,19],[32,19],[49,19],[-18,-31],[-18,-43],[-43,10]])tree(x,z);
function lamp(x,z){const post=box(.12,5,.12,x,2.5,z,'#354342');post.material=post.material.clone();post.material.transparent=true;lampMeshes.push(post);box(1,.15,.55,x+.35,5,z,'#394644');box(.75,.04,.4,x+.35,4.9,z,'#f2e4b7')}[-10,15,42].forEach(x=>{lamp(x,-4.6);lamp(x,17)});
const vehicles=createVehicles(scene,colliders);const pedestrians=createPedestrians(scene);
for(let x of[9,27]){box(2,.18,.7,x,.65,17.5,'#876e50');box(2,.55,.13,x,1,17.85,'#876e50');box(.12,.7,.55,x-.8,.3,17.5,'#394a42');box(.12,.7,.55,x+.8,.3,17.5,'#394a42')}box(.8,1.2,.8,11,.6,-4.5,'#435c4f',true);
polishWorld(scene,box,label,trees);for(const [x,title] of [[19,'MARKET 07–22'],[36,'CAFE 08–18']])label(title,x,2.95,-8.08,2.1,0,'#24483f','#f1ebd9',.25);
for(const x of [3.8,-10.2]){box(.85,.8,.55,x,.55,-7,'#637f70',true);label('DELIVERIES',x,1.06,-6.7,.8,0,'#29473b','#e9e3c7',.16)}
initializeState(loadProfile());
const me=GameState.me;
let phone=null,sleepElapsed=null;
let inside=false,shop=null;const apartment=createApartment();
const shops={market:createShop('market'),cafe:createShop('cafe')};for(const [kind,room] of Object.entries(shops)){room.scene.position.set(SHOPS[kind].x,.165,-13.5);scene.add(room.scene);scene.updateMatrixWorld(true);room.camera=createIndoorCamera(camera,[...room.occluders,...shopShells[kind]]);}const worldPlayer={position:new THREE.Vector3()};
const indoorCamera=createIndoorCamera(camera,apartment.occluders);
const savedCharacter=loadAppearance({getItem:key=>localStorage.getItem(key)});
const avatar=createCharacter(savedCharacter||defaults),player=avatar.group,legs=avatar.legs,arms=avatar.arms;player.name='player';scene.add(player);
// Rendering consumes the simulation state; gameplay never reads mesh transforms.
function syncPlayerMesh(){
 player.position.set(me.position.x,me.position.y,me.position.z);
 player.rotation.y=me.rotation.y;
}
function getMeWorldPosition(target){
 target.set(me.position.x,me.position.y,me.position.z);
 return player.parent.localToWorld(target);
}

setMePosition(-5,.2,15);let yaw=0,pitch=.38,zoom=7,zoomTarget=7,active=false,modal=false,discovered=false,phase=0,busy=null,worldPanel=null,selectedInteraction=null;const keys=createMovementInput(window,document,()=>active&&!modal&&!creatorOpen&&!busy);const updateCamera=createCameraController(camera,cameraSolids,trees,lampMeshes);
function reset(){if(active)look.resetMotion();if(shop){setMePosition(SHOP_ENTRY.x,.02,SHOP_ENTRY.z);return}if(inside){setMePosition(ENTRY.x,.02,ENTRY.z);return}setMePosition(-5,.2,15);yaw=0;pitch=.38;camera.position.set(-5,4,22)}reset();
if(GameState.progress.position&&!blocked(GameState.progress.position.x,GameState.progress.position.z)){me.position.x=GameState.progress.position.x;me.position.z=GameState.progress.position.z;camera.position.set(me.position.x,4,me.position.z+7)}
function blocked(x,z){if(shop)return shops[shop].blocked(x,z);if(inside)return apartment.blocked(x,z);if(x<-61||x>58||z<-48||z>48)return true;return colliders.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)}
function clearWorldPanel(){if(worldPanel?.actor){const pa=getMeWorldPosition(new THREE.Vector3()),pb=worldPanel.actor.getWorldPosition(new THREE.Vector3());yaw=Math.atan2(pa.x-pb.x,pa.z-pb.z)+.45;pitch=.32;zoom=zoomTarget=5.8;}worldPanel=null;look.resetMotion()}
function pause(show){if(sleepElapsed!==null)return;if(show)phone?.close();if(show){$('dialog').hidden=true;clearWorldPanel();}$('controls').hidden=!show;modal=show;keys.clear();if(show)look.release()}
$('start').onclick=()=>{if(currentAppearance.name){$('welcome').hidden=true;active=true}else openCreator()};$('help').onclick=()=>pause(true);$('resume').onclick=()=>{pause(false);look.capture()};$('closeDialog').onclick=()=>{$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()};
function persist(){if(!inside&&!shop)GameState.progress.position={x:me.position.x,z:me.position.z};const ok=saveProfile({playerId:me.id,name:me.name,progress:GameState.progress});$('progressStatus').textContent=ok?'Saved on this browser':'Saving unavailable · session only';return ok}
function toast(text){$('jobToast').textContent=text;$('jobToast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('jobToast').hidden=true,4500)}
function showDialog(kicker,title,text,tag,action,label){
 if(sleepElapsed!==null)return;
 phone?.close();
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
function enterHome(){
 if(!GameState.progress.housing.rented)return;persist();inside=true;apartment.scene.add(player);setMePosition(ENTRY.x,.02,ENTRY.z);yaw=0;pitch=.4;camera.position.set(ENTRY.x,3,ENTRY.z+5.5);$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
}
function leaveHome(){look.resetMotion();inside=false;scene.add(player);setMePosition(STUDIO.x,.165,STUDIO.z);yaw=0;camera.position.set(STUDIO.x,3,STUDIO.z+5);persist();keys.clear()}
function changeHousing(action){
 if(action==='rest'){startSleep();return}
 const result=housingTransaction(GameState.progress,action,{atEntrance:!inside&&!shop&&nearby(me.position,STUDIO),atBed:inside&&!shop&&Math.hypot(me.position.x-BED.x,me.position.z-BED.z)<1.4});
 if(result.error){toast(result.error);return}GameState.progress=result.state;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();
 if(action==='rent'){toast('Keys received · Studio 2B is yours to rent.');enterHome()}
 else toast('Bills paid.');
}
function showBills(){const h=GameState.progress.housing,due=totalDue(h);showDialog('HOME / WEEK '+weekNumber(h.day),'Your weekly bills.',h.rented?'Unpaid rent: '+money(h.rentDue)+'. Unpaid utilities: '+money(h.utilitiesDue)+'. Next bill: '+weekday(h.nextBillDay)+' (Week '+weekNumber(h.nextBillDay)+'), in '+dueIn(h)+' days. Weekly rent is $60; estimated utilities are '+money(estimatedUtilities(h))+' ($7 base for the older studio, plus $0.15 per home-cooked meal). No offline charges.':'Visit 18 Oak Street. Move-in is $90: a $30 deposit and $60 for your first week. Utilities start at $7 per week.','Total due '+money(due)+' · cash after payment '+money(GameState.progress.cash-due),due?()=>changeHousing('pay'):null,due?'Pay bills · '+money(due):'')}
$('billsButton').onclick=()=>{if(active&&!creatorOpen)showBills()};
function extraAction(label,action){$('extraAction').hidden=false;$('extraAction').textContent=label;$('extraAction').onclick=action}
function enterShop(kind){if(!shopOpen(kind,GameState.progress.routine)){toast(kind==='market'?'Market hours: 07:00–22:00':'Café hours: 08:00–18:00');return}persist();shop=kind;shops[kind].scene.add(player);setMePosition(SHOP_ENTRY.x,.02,SHOP_ENTRY.z);yaw=0;pitch=.4;camera.position.set(SHOPS[kind].x,3,-5.5);$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear()}
function leaveShop(){look.resetMotion();busy=null;const room=shops[shop];for(const mesh of [...room.occluders,...shopShells[shop]]){mesh.material.opacity=1;mesh.material.depthWrite=true}const door=SHOPS[shop];shop=null;scene.add(player);setMePosition(door.x,.165,door.z);camera.position.set(door.x,3,door.z+6);persist();keys.clear()}
function useLife(action){const place=shop||(inside?'home':null);const atCounter=shop&&Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)<1.6;const atKitchen=inside&&Math.hypot(me.position.x-3,me.position.z+3.5)<1.5;if(shop&&!shopOpen(shop,GameState.progress.routine)){toast('The shop has closed. Please return tomorrow.');return}if(!atCounter&&!atKitchen){toast('Move closer to the counter.');return}const r=lifeTransaction(GameState.progress,action,place);if(r.error){toast(r.error);return}GameState.progress=r.state;if(action==='cook'&&GameState.progress.housing.rented)GameState.progress.housing.utilityUsage+=15;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();toast(r.message)}
$('bagButton').onclick=()=>{if(active&&!creatorOpen)showDialog('YOUR BAG','Everyday essentials.',GameState.progress.life.groceries+' grocery packs. Each pack prepares one meal in your studio kitchen, restoring 65 food and 20 energy. Visit the market cashier to buy more.','Food '+Math.round(GameState.progress.life.food)+' / 100 · Energy '+Math.round(GameState.progress.life.energy)+' / 100',null)};
function nearestPerson(){return pedestrians.people.find(p=>Math.hypot(me.position.x-p.group.position.x,me.position.z-p.group.position.z)<1.5)}
function nearbyShop(){return Object.keys(SHOPS).find(k=>nearby(me.position,SHOPS[k]))}
function commitCafe(action,drink){const r=cafeTransaction(GameState.progress,action,me.position,shop,drink);if(r.error){toast(r.error);return false}GameState.progress=r.state;persist();$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();toast(r.message);if(['hire','clockin','order','clockout'].includes(action))look.capture();return true}
function beginCafe(action,drink){const r=cafeTransaction(GameState.progress,action,me.position,shop,drink);if(r.error){toast(r.error);return}if(['brew','serve','clean'].includes(action)){busy={action,drink,elapsed:0,duration:action==='brew'?3:action==='clean'?2.5:1.2};$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()}else commitCafe(action,drink)}
function worldPoint(point,parent=player.parent){return parent.localToWorld(new THREE.Vector3(point.x,point.y??1.2,point.z))}
function entityPoint(actor){const p=actor.getWorldPosition(new THREE.Vector3());p.y+=1.9;return p}
function showWorld(anchor,name,text,choices=[],actor=null){
 showDialog(name,'',text,'',choices[0]?.run,choices[0]?.label);worldPanel={anchor,actor};$('dialog').classList.add('in-world');$('closeDialog').textContent=actor?'See you':'Close';
 if(choices[1])extraAction(choices[1].label,choices[1].run);if(choices[2]){$('thirdAction').hidden=false;$('thirdAction').textContent=choices[2].label;$('thirdAction').onclick=choices[2].run}
 $('dialog').classList.remove('bubble-enter');void $('dialog').offsetWidth;$('dialog').classList.add('bubble-enter');
}
function speak(actor,name,text,choices=[]){showWorld(()=>entityPoint(actor),name,text,choices,actor)}
function station(point,name,text,choices){showWorld(()=>worldPoint(point),name,text,choices)}
function managerMenu(){const c=GameState.progress.cafe,actor=shops.cafe.clerk.group;const choices=[];
 if(GameState.progress.phase==='carrying'&&GameState.progress.completed%3===1)choices.push({label:'I have your delivery.',run:()=>speak(actor,'Elena','Perfect, that’s our produce order. Thank you!',[{label:'Hand over order · '+money(routeFor(GameState.progress).pay),run:()=>finishJob('deliver')}])});
 if(c.stage==='clockout')choices.push({label:'I’m ready to clock out.',run:()=>speak(actor,'Elena','Two customers served and the table reset. Good work—here are your $24 wages.',[{label:'Clock out & collect $24',run:()=>commitCafe('clockout')}])});
 else if(c.stage==='off')choices.push({label:c.employed?'I’m here for my shift.':'Are you hiring?',run:()=>speak(actor,'Elena',c.employed?'You can clock in from 08:00 to 16:00. Serve two customers, reset their table, and come back to me for your $24 pay.':'Yes! I need a café assistant to take orders, make coffee and look after our tables. A completed shift pays $24.',[{label:c.employed?'Clock me in.':'I’d like the job.',run:()=>commitCafe(c.employed?'clockin':'hire')}])});
 else choices.push({label:'What’s my next task?',run:()=>speak(actor,'Elena',cafeTask(GameState.progress).title+'. Your order ticket is shown on the left.')});
 choices.push({label:'I’d like lunch.',run:()=>speak(actor,'Elena','A sandwich and coffee is $6. Would you like one?',[{label:'Yes, please · $6',run:()=>useLife('meal')}])});
 speak(actor,'Elena','Hi there. What can I help you with?',choices);
}
function marketMenu(){const actor=shops.market.clerk.group;if(!shopOpen('market',GameState.progress.routine)){speak(actor,'Noah','We’re closed for today. Come back between 07:00 and 22:00.');return}speak(actor,'Noah','Welcome in. What do you need?',[
 {label:'I’d like groceries.',run:()=>speak(actor,'Noah','A grocery pack is $4. You can cook it at home.',[{label:'Buy a pack · $4',run:()=>useLife('groceries')}])},
 {label:'Any delivery work?',run:()=>{const route=routeFor(GameState.progress);speak(actor,'Noah',GameState.progress.phase==='carrying'?'You’ve already collected an order for '+route.name+'. Bring that one over first.':'Could you take this grocery order to '+route.name+'? They’ll pay you '+money(route.pay)+'.',GameState.progress.phase==='carrying'?[]:[{label:'Sure, I’ll take it.',run:()=>finishJob('pickup')}])}},
 {label:'An energy drink, please · $3',run:()=>useLife('drink')}
 ])}
function showCafe(){const c=GameState.progress.cafe,o=ORDERS[c.customer];if(c.stage==='off'||c.stage==='clockout'){managerMenu();return}if(['order','serve'].includes(c.stage)&&customerWalking){toast('Your customer is taking a seat.');return}if(c.stage==='clean'&&shops.cafe.customer.group.visible){toast('Wait for your customer to leave the table.');return}
 if(c.stage==='order'){speak(shops.cafe.customer.group,o.name,'Could I have one '+o.drink.toLowerCase()+', please?',[{label:'Of course. Coming right up.',run:()=>commitCafe('order')}]);return}
 if(c.stage==='brew'){station({x:-1.25,y:1.5,z:-3.2},'Coffee machine','Ticket: '+o.drink,[{label:'Make espresso',run:()=>beginCafe('brew','Espresso')},{label:'Make latte',run:()=>beginCafe('brew','Latte')}]);return}beginCafe(c.stage);
}
function candidates(){const all=[],add=(id,point,anchor,label,run,range=1.5)=>all.push({id,point,anchor,label,run,range});
 if(shop){add('exit',SHOP_EXIT,()=>worldPoint({x:0,y:1.35,z:4.9}),'Go outside',leaveShop,1.5);add('clerk',COUNTER,()=>entityPoint(shops[shop].clerk.group),'Talk to '+(shop==='market'?'Noah':'Elena'),shop==='market'?marketMenu:managerMenu,1.6);
 if(shop==='cafe'&&!['off','clockout'].includes(GameState.progress.cafe.stage)){const task=cafeTask(GameState.progress);add('cafe-task',task,()=>GameState.progress.cafe.stage==='order'||GameState.progress.cafe.stage==='serve'?entityPoint(shops.cafe.customer.group):worldPoint({...task,y:1.2}),task.title,showCafe,1.35)}return all}
 if(inside){add('exit',EXIT,()=>worldPoint({x:0,y:1.4,z:5.3}),'Go outside',leaveHome);add('cook',{x:3,z:-3.5},()=>worldPoint({x:3,y:1.3,z:-4.5}),'Prepare a meal',()=>station({x:3,y:1.4,z:-4.5},'Kitchen',GameState.progress.life.groceries+' grocery packs in your bag.',[{label:'Cook a meal',run:()=>useLife('cook')}]));add('bed',BED,()=>worldPoint({...BED,y:.8}),'Sleep',()=>station({...BED,y:1},'Take a rest?','Restore your energy fully. The clock will stay where it is.',[{label:'Rest and recover',run:()=>changeHousing('rest')}]),1.4);return all}
 const gig=GameState.progress.activeJob;
 if(gig?.stage==='return')add('phone-gig',gig.returnLocation,()=>new THREE.Vector3(gig.returnLocation.x,1.4,gig.returnLocation.z),'Report back · collect '+money(gig.reward),()=>{
   const result=completeContract(GameState.progress,me.position);
   if(result.error){toast(result.error);return}
   GameState.progress=result.state;persist();toast('Gig complete · '+money(result.paid)+' earned');
 },1.35);
 for(const [kind,door]of Object.entries(SHOPS)){const open=shopOpen(kind,GameState.progress.routine);add('door-'+kind,{x:door.x,z:-8.1},()=>new THREE.Vector3(door.x,1.5,-8.25),open?'Enter '+door.name:'Closed · '+(kind==='market'?'07:00–22:00':'08:00–18:00'),()=>enterShop(kind),2.8)}
 add('home',{x:STUDIO.x,z:-8.1},()=>new THREE.Vector3(1,1.5,-8.15),GameState.progress.housing.rented?'Enter your studio':'View studio listing',()=>{if(GameState.progress.housing.rented)enterHome();else showWorld(()=>new THREE.Vector3(1,1.6,-8.15),'Studio 2B · To let','Furnished studio. $90 move-in includes a $30 deposit and the first week’s $60 rent. Utilities start at $7 per week.',[{label:'Rent studio · $90',run:()=>changeHousing('rent')}])},2.8);
 if(GameState.progress.phase==='carrying'&&GameState.progress.completed%3!==1){const r=routeFor(GameState.progress);add('delivery',r,()=>new THREE.Vector3(r.x,1.3,r.z),'Leave delivery · '+money(r.pay),()=>station(r,'Delivery collection box','Order for '+r.name+'. Payment: '+money(r.pay)+'.',[{label:'Place order & collect payment',run:()=>finishJob('deliver')}]),1.4)}
 for(const person of pedestrians.people)add('person-'+person.name,person.group.position,()=>entityPoint(person.group),'Talk to '+person.name,()=>speak(person.group,person.name,'Hey! How’s your day going?',[{label:'Any advice for someone new?',run:()=>speak(person.group,person.name,person.line)},{label:'Nice to meet you.',run:()=>speak(person.group,person.name,'You too. See you around the neighborhood!')}]),1.5);
 for(const car of vehicles)add(car.id,car,()=>new THREE.Vector3(car.x,1.3,car.z),'Inspect '+car.name,()=>showWorld(()=>new THREE.Vector3(car.x,1.4,car.z),car.name,'Parked · not owned. Driving will be available in a future update.'),1.6);return all;
}
function interact(){if(!active||modal||busy)return;const hit=chooseInteraction(candidates(),me.position,me.rotation.y);if(hit)hit.run()}
function updateWorldUI(){
 camera.updateMatrixWorld(true);const hit=chooseInteraction(candidates(),me.position,me.rotation.y);selectedInteraction=hit;
 const p=hit?screenAnchor(hit.anchor(),camera,innerWidth,innerHeight,THREE.Vector3):null;$('prompt').hidden=!active||modal||!!busy||!p;
 if(p){$('prompt').style.left=p.x+'px';$('prompt').style.top=p.y+'px';$('prompt').querySelector('span').textContent=hit.label}
 if(worldPanel&&!$('dialog').hidden){const anchor=screenAnchor(worldPanel.anchor(),camera,innerWidth,innerHeight,THREE.Vector3);if(anchor){const width=Math.min(320,innerWidth-24),height=$('dialog').offsetHeight||260;$('dialog').style.left=Math.max(12,Math.min(innerWidth-width-12,anchor.x+26))+'px';$('dialog').style.top=Math.max(12,Math.min(innerHeight-height-12,anchor.y-height*.55))+'px';}else{$('dialog').style.left='12px';$('dialog').style.top='100px'}}
 $('workProgress').hidden=!busy;if(busy){const task=cafeTask(GameState.progress),p=screenAnchor(worldPoint({...task,y:1.4}),camera,innerWidth,innerHeight,THREE.Vector3);if(p){$('workProgress').style.left=p.x+'px';$('workProgress').style.top=p.y+'px';$('workProgress').textContent=({brew:'Preparing coffee',serve:'Serving',clean:'Cleaning table'}[busy.action])+' · '+Math.round(busy.elapsed/busy.duration*100)+'%'}}
}
// Small destination marker, shared by pickups and drop-offs.
const marker=new THREE.Group();const markerMaterial=new THREE.MeshBasicMaterial({color:'#d4e7b3',transparent:true,opacity:.8,depthWrite:false});
const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.72,32),markerMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.2;marker.add(ring);
const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.16),markerMaterial);diamond.position.y=2.5;marker.add(diamond);scene.add(marker);
const parcel=new THREE.Mesh(new THREE.BoxGeometry(.38,.32,.22),mat('#ad8c60'));parcel.position.set(0,1.16,-.25);player.add(parcel);
const workMarker=new THREE.Mesh(new THREE.RingGeometry(.35,.43,32),new THREE.MeshBasicMaterial({color:'#e7c681',side:THREE.DoubleSide,transparent:true,opacity:.85}));workMarker.rotation.x=-Math.PI/2;shops.cafe.scene.add(workMarker);
const drinkCup=new THREE.Mesh(new THREE.CylinderGeometry(.07,.055,.17,10),mat('#eee3ce'));drinkCup.position.set(.32,1.12,.3);player.add(drinkCup);
let customerKey='',customerRoute=[],customerWalking=false,customerLeaving=false;
function updateCafeVisuals(dt){const room=shops.cafe,c=GameState.progress.cafe,key=c.day+':'+c.customer+':'+(['clean','clockout','off'].includes(c.stage)?'leaving':'seated');if(key!==customerKey){customerKey=key;if(['order','brew','serve'].includes(c.stage)){room.customer.group.visible=true;room.customer.group.position.set(0,.02,3);customerRoute=[[-2.3,3],[-2.3,-1.55],[-3.8,-1.55]];customerLeaving=false}else if(room.customer.group.visible){customerRoute=[[-2.3,-1.55],[-2.3,3],[0,4]];customerLeaving=true}}
 customerWalking=customerRoute.length>0;if(customerWalking){const g=room.customer.group,[x,z]=customerRoute[0],dx=x-g.position.x,dz=z-g.position.z,d=Math.hypot(dx,dz);g.position.y=.02;if(d<dt*1.7){g.position.set(x,.02,z);customerRoute.shift();if(!customerRoute.length){if(customerLeaving)g.visible=false;else{g.position.y=-.35;g.rotation.y=0}}}else{g.position.x+=dx/d*dt*1.7;g.position.z+=dz/d*dt*1.7;g.rotation.y=Math.atan2(dx,dz)}}
 room.customer.legs.forEach((m,i)=>m.rotation.x=customerWalking?Math.sin(performance.now()*.006+i*Math.PI)*.4:room.customer.group.visible?-1.2:0);room.usedCup.visible=c.stage==='clean';
 if(busy){busy.elapsed+=dt;arms.forEach((m,i)=>m.rotation.x=-.8+Math.sin(busy.elapsed*10+i)*.2);if(busy.elapsed>=busy.duration){const task=busy;busy=null;commitCafe(task.action,task.drink)}}
}
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)persist()});
let saveElapsed=0,markerTime=0;
function updateWork(dt){
 workMarker.visible=false;drinkCup.visible=shop==='cafe'&&GameState.progress.cafe.stage==='serve';
 const dest=targetFor(GameState.progress),route=routeFor(GameState.progress),carrying=GameState.progress.phase==='carrying';
 $('housingStatus').textContent=GameState.progress.housing.rented?'Studio 2B · Bills due '+money(totalDue(GameState.progress.housing))+' · next in '+dueIn(GameState.progress.housing)+' days':'No home · Studio move-in $90.00';
 $('clockStatus').textContent=weekday(GameState.progress.housing.day)+' · '+clockText(GameState.progress.routine)+' · Week '+weekNumber(GameState.progress.housing.day);$('earningsStatus').textContent='Earned today '+money(GameState.progress.routine.earned);
 $('needsStatus').textContent='Food '+Math.round(GameState.progress.life.food)+'% · Energy '+Math.round(GameState.progress.life.energy)+'%';
 $('locationName').textContent=shop?SHOPS[shop].name.toUpperCase():inside?'STUDIO 2B':'WESTSIDE';
 if(shop){const task=cafeTask(GameState.progress),isCafe=shop==='cafe',c=GameState.progress.cafe;const exit=Math.hypot(me.position.x-SHOP_EXIT.x,me.position.z-SHOP_EXIT.z)<1.5,counter=Math.hypot(me.position.x-COUNTER.x,me.position.z-COUNTER.z)<1.6,atTask=isCafe&&Math.hypot(me.position.x-task.x,me.position.z-task.z)<1.35;
 $('cash').textContent=money(GameState.progress.cash);$('objective').querySelector('.eyebrow').textContent=isCafe&&c.stage!=='off'?'ON SHIFT · ALDER COFFEE':'NEIGHBORHOOD';$('objective').querySelector('h2').textContent=isCafe?task.title:SHOPS[shop].name;$('objective').querySelector('p').textContent=isCafe?(c.stage==='off'?'Speak to Elena at the counter about café work. $24 per shift. Start 08:00–16:00.':'Orders served: '+c.served+'/2 · '+(c.stage==='brew'||c.stage==='serve'?'Ticket: '+ORDERS[c.customer].drink+'. ':'')+'Follow the floor marker. Clock out to collect wages.'):'Visit the cashier for groceries. Open 07:00–22:00.';$('distance').textContent=busy?'Working… '+Math.round(busy.elapsed/busy.duration*100)+'%':'E to interact · front door to leave';$('direction').style.transform='none';$('prompt').hidden=!active||modal||!!busy||(!exit&&!counter&&!atTask);$('prompt').querySelector('span').textContent=atTask?task.title:exit?'Go outside':isCafe?'Order lunch':'Buy groceries';marker.visible=false;workMarker.visible=isCafe;workMarker.position.set(task.x,.04,task.z);parcel.visible=carrying;return}


 if(inside){$('cash').textContent=money(GameState.progress.cash);$('objective').querySelector('.eyebrow').textContent='YOUR FIRST HOME';$('objective').querySelector('h2').textContent='Make yourself at home.';$('objective').querySelector('p').textContent='Rest, cook, and make yourself at home. Rent: $60 / week. Next bills: '+weekday(GameState.progress.housing.nextBillDay)+' in '+dueIn(GameState.progress.housing)+' days.';$('distance').textContent='Bed: rest · Door: go outside';$('direction').style.transform='none';const exit=Math.hypot(me.position.x-EXIT.x,me.position.z-EXIT.z)<1.5,bed=Math.hypot(me.position.x-BED.x,me.position.z-BED.z)<1.4;const kitchen=Math.hypot(me.position.x-3,me.position.z+3.5)<1.5;$('prompt').hidden=!active||modal||(!exit&&!bed&&!kitchen);$('prompt').querySelector('span').textContent=exit?'Go outside':kitchen?'Prepare a meal':'Rest and recover';marker.visible=false;parcel.visible=carrying;return}
 $('cash').textContent=money(GameState.progress.cash);$('deliveryCount').textContent=GameState.progress.completed+' '+(GameState.progress.completed===1?'delivery':'deliveries')+' completed';
 $('objective').querySelector('.eyebrow').textContent=carrying?'ORDER COLLECTED':'DELIVERY WORK';
 $('objective').querySelector('h2').textContent=carrying?'Deliver to '+dest.name:GameState.progress.completed?'Ready for another?':'Earn your first wages.';
 $('objective').querySelector('p').textContent=carrying?(GameState.progress.completed%3===1?'Speak to Elena at the café counter. Payment: ':'Use the marked delivery box. Payment: ')+money(route.pay)+'.':'Speak to Noah at the market counter for delivery work. Next wage: '+money(route.pay)+'.';
 const distance=Math.hypot(me.position.x-dest.x,me.position.z-dest.z);
 $('distance').textContent=Math.round(distance)+' m · '+dest.name;
 const angle=Math.atan2(dest.x-me.position.x,-(dest.z-me.position.z))+yaw;$('direction').style.transform=`rotate(${angle}rad)`;
 const atJob=nearby(me.position,dest),atApartment=nearby(me.position,STUDIO);
 const atShop=nearbyShop(),atCar=vehicles.some(v=>Math.hypot(me.position.x-v.x,me.position.z-v.z)<1.6);$('prompt').hidden=!active||modal||(!atJob&&!atApartment&&!atShop&&!atCar&&!nearestPerson());$('prompt').querySelector('span').textContent=atJob?(carrying?'Deliver order':'Market · work & shop'):atApartment?'Apartment entrance':atShop?'Enter '+SHOPS[atShop].name:atCar?'Inspect parked vehicle':'Talk to '+nearestPerson()?.name;
 marker.visible=active;marker.position.set(dest.x,0,dest.z);markerTime+=dt;diamond.position.y=2.5+Math.sin(markerTime*2)*.09;diamond.rotation.y+=dt*.7;parcel.visible=carrying;
 if(active&&!modal){saveElapsed+=dt;if(saveElapsed>=4){saveElapsed=0;persist()}}
}
window.addEventListener('keydown',e=>{
 if(sleepElapsed!==null){if(['Tab','Space'].includes(e.code))e.preventDefault();return}
 if(creatorOpen||e.target.matches('input,select,textarea,[contenteditable=true]'))return;
 if((e.code==='Tab'||e.code==='KeyP')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&active){
   e.preventDefault();if(!e.repeat)phone.toggle();return;
 }
 if(phone?.isOpen){if(e.code==='Escape'){e.preventDefault();phone.close()}return}
if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&active){if(!$('dialog').hidden){$('dialog').hidden=true;clearWorldPanel();modal=false;keys.clear();look.capture()}else pause(true)}if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='KeyR'&&active&&!modal)reset()});
window.addEventListener('blur',()=>{if(active&&!modal&&!creatorOpen)pause(true)});
const canvas=$('world');const look=createLookControls(canvas,document,()=>active&&!modal&&!creatorOpen&&!document.hidden,(dx,dy)=>{yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch+dy*.002,.08,1.05)},()=>{keys.clear();if(active&&!modal&&!creatorOpen)pause(true)},info=>{$('mouseMode').textContent=info.mode==='captured'?'Mouse look: captured':info.mode==='free'?'Mouse look: free · move to screen edges to keep turning':'Click the game to look around';if(info.reason)$('mouseMode').title=info.reason});
$('retryCapture').onclick=()=>{pause(false);look.retry()};
$('lookLeft').onclick=()=>{yaw+=Math.PI/8};$('lookRight').onclick=()=>{yaw-=Math.PI/8};
canvas.addEventListener('wheel',e=>{e.preventDefault();if(active&&!modal&&!creatorOpen){const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);zoomTarget=THREE.MathUtils.clamp(zoomTarget+delta*.008,3,12)}},{passive:false});
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();keys.pressPointer(e.pointerId,b.dataset.key);b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=b.onlostpointercapture=e=>keys.releasePointer(e.pointerId)});$('touchE').onclick=interact;
$('quality').onchange=()=>{const high=$('quality').value==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.6:1));renderer.shadowMap.enabled=high;scene.traverse(m=>{if(m.material)m.material.needsUpdate=true});renderer.setSize(innerWidth,innerHeight)};
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

let creatorOpen=false,draft={...(savedCharacter||defaults)},previewTurn=.25;
const previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#38584e');
previewScene.add(new THREE.HemisphereLight('#edf5e9','#334f40',2.7));const previewLight=new THREE.DirectionalLight('#fff0d6',3);previewLight.position.set(3,5,4);previewScene.add(previewLight);
const previewAvatar=createCharacter(draft);previewScene.add(previewAvatar.group);
const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1,1.1,.12,32),new THREE.MeshStandardMaterial({color:'#527363',roughness:1}));plinth.position.y=-.06;previewScene.add(plinth);
const previewCamera=new THREE.PerspectiveCamera(34,1,.1,30);previewCamera.position.set(0,1.35,4.9);previewCamera.lookAt(0,1.02,0);
const optionLabels={skin:'Skin tone',hair:'Hair color',shirt:'Top color',trousers:'Trousers'};
function updateDraft(){draft.name=$('characterName').value;previewAvatar.apply(draft);$('previewName').textContent=draft.name.trim()||'Your character';
 document.querySelectorAll('[data-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(draft[b.dataset.appearance]===b.dataset.value)));
}
for(const key of ['skin','style','hair','shirt','trousers']){
 const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=key==='style'?'Hairstyle':optionLabels[key];field.append(legend);const row=document.createElement('div');row.className='options';
 const values=key==='style'?styles.map(v=>[v,v]):palettes[key];
 for(const [label,value]of values){const b=document.createElement('button');b.type='button';b.dataset.appearance=key;b.dataset.value=value;b.className=key==='style'?'style-option':'swatch';b.setAttribute('aria-label',label);b.title=label;if(key==='style')b.textContent=label;else b.style.setProperty('--color',value);b.onclick=()=>{draft[key]=value;updateDraft()};row.append(b)}field.append(row);$('appearanceOptions').append(field);
}
function openCreator(){phone?.close();clearWorldPanel();$('dialog').hidden=true;draft={...currentAppearance};$('characterName').value=draft.name;creatorOpen=true;modal=true;look.release();keys.clear();$('welcome').hidden=true;$('controls').hidden=true;$('creator').hidden=false;document.body.classList.add('creating');updateDraft();$('characterName').focus()}
let currentAppearance={...(savedCharacter||defaults)};
if(savedCharacter){$('start').innerHTML='Continue to the neighborhood <span>↗</span>';$('customizeSaved').hidden=false}
$('customizeSaved').onclick=openCreator;$('editCharacter').onclick=openCreator;
$('characterName').oninput=updateDraft;
$('rotateLeft').onclick=()=>previewTurn-=Math.PI/4;$('rotateRight').onclick=()=>previewTurn+=Math.PI/4;
function closeCreator(){creatorOpen=false;modal=false;$('creator').hidden=true;document.body.classList.remove('creating');keys.clear()}
$('cancelCreator').onclick=()=>{closeCreator();if(!active)$('welcome').hidden=false};
$('creatorForm').onsubmit=e=>{e.preventDefault();if(!$('characterName').value.trim()){$('characterName').setCustomValidity('Enter a name to begin.');$('characterName').reportValidity();return}
 $('characterName').setCustomValidity('');updateDraft();currentAppearance={...draft};avatar.apply(draft);me.name=draft.name;persist();
 const saved=saveAppearance({setItem:(key,value)=>localStorage.setItem(key,value)},draft);
 closeCreator();active=true;$('customizeSaved').hidden=false;$('start').innerHTML='Continue to the neighborhood <span>↗</span>';
 if(!saved){$('objective').querySelector('p').textContent='Browser saving is unavailable. Your character will last for this session.'}
};
$('characterName').addEventListener('input',()=>$('characterName').setCustomValidity(''));
function drawCreator(){
 const narrow=innerWidth<=700,left=narrow?0:410;
 const top=narrow?Math.round(innerHeight*.38):innerHeight;
 const reserved=narrow?0:150,h=Math.max(1,top-reserved),w=narrow?innerWidth:Math.max(1,innerWidth-410);
 renderer.setViewport(0,0,innerWidth,innerHeight);renderer.clear();
 renderer.setViewport(left,innerHeight-top+reserved,w,h);
 previewCamera.aspect=w/h;previewCamera.updateProjectionMatrix();previewAvatar.group.rotation.y=previewTurn;
 renderer.render(previewScene,previewCamera);renderer.setViewport(0,0,innerWidth,innerHeight);
}


// Phone owns only its overlay; existing modal guards stop WASD and mouse look.
phone=createPhone({document,getState:()=>GameState,
 canOpen:()=>active&&!modal&&!creatorOpen&&!busy,
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
$('objectiveToggle').onclick=()=>{
 objectiveCollapsed=!objectiveCollapsed;
 $('objective').classList.toggle('collapsed',objectiveCollapsed);
 $('objectiveDetails').hidden=objectiveCollapsed;
 $('objectiveToggle').setAttribute('aria-expanded',String(!objectiveCollapsed));
 $('objectiveToggle').setAttribute('aria-label',objectiveCollapsed?'Expand objective':'Minimize objective');
};
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
 const direction=room===target.room?target:shop||inside?null:display;
 $('direction').style.transform=direction?`rotate(${Math.atan2(direction.x-me.position.x,-(direction.z-me.position.z))+yaw}rad)`:'none';
 if(GameState.progress.phase!=='carrying')marker.visible=false;
}
function startSleep(){
 if(sleepElapsed!==null||!inside||shop||!GameState.progress.housing.rented||Math.hypot(me.position.x-BED.x,me.position.z-BED.z)>=1.4)return;
 phone?.close();$('dialog').hidden=true;clearWorldPanel();modal=true;keys.clear();look.release();
 sleepElapsed=0;$('sleepFade').hidden=false;$('sleepFade').style.opacity='0';
}
function updateSleep(dt){
 if(sleepElapsed===null||document.hidden)return;
 sleepElapsed+=dt;
 // Fade in, hold black for one second, then fade out. Clock/life ticks are paused.
 $('sleepFade').style.opacity=String(sleepElapsed<.25?sleepElapsed/.25:sleepElapsed<1.25?1:Math.max(0,(1.5-sleepElapsed)/.25));
 if(sleepElapsed>=1.5){
   GameState.progress.life={...normalizeLife(GameState.progress.life),energy:100};
   sleepElapsed=null;$('sleepFade').hidden=true;modal=false;keys.clear();look.resetMotion();persist();toast('Rested · Energy restored');
 }
}

// Local multiplayer relay. Register callbacks before opening the socket.
const multiplayer=new MultiplayerClient();
const remoteMeshes=Object.create(null);
const currentRoom=()=>shop||(inside?'home':'street');
const roomScene=room=>room==='home'?apartment.scene:shops[room]?.scene||scene;
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
multiplayer.onConnected(()=>{lastSent=null;sendLocalPosition()});
multiplayer.connect('ws://localhost:8080');
function updateMultiplayer(now,moving,dt){
 networkTimer+=lastNetworkTime===null?0:Math.max(0,now-lastNetworkTime);
 lastNetworkTime=now;
 const changed=!lastSent||lastSent.room!==currentRoom()||
   ['x','y','z'].some(k=>Math.abs(me.position[k]-lastSent[k])>.0001);
 // Also send the final stopped position and door/reset teleports, at the same cap.
 if(networkTimer>=50&&(moving||changed))sendLocalPosition();
 for(const mesh of Object.values(remoteMeshes))updateRemotePlayer(mesh,dt);
}

let prev=performance.now(),frames=0,elapsed=0;function frame(now){requestAnimationFrame(frame);const actionDt=Math.max(0,Math.min((now-prev)/1000,.25)),dt=Math.min(actionDt,.04);prev=now;if(creatorOpen){drawCreator();return}frames++;elapsed+=dt;if(elapsed> .75){$('fps').textContent=Math.round(frames/elapsed)+' FPS';frames=0;elapsed=0}
const frameX=me.position.x,frameZ=me.position.z;
let moving=false;if(active&&!modal&&!busy){let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),s=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let len=Math.hypot(f,s);if(len){f/=len;s/=len;const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?8.2:4.5,dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*dt,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*dt;if(!blocked(me.position.x+dx,me.position.z))me.position.x+=dx;if(!blocked(me.position.x,me.position.z+dz))me.position.z+=dz;const angle=Math.atan2(dx,dz);me.rotation.y+=Math.atan2(Math.sin(angle-me.rotation.y),Math.cos(angle-me.rotation.y))*(1-Math.exp(-dt*24));phase+=dt*speed*2.0;moving=true}}
const movedDistance=Math.hypot(me.position.x-frameX,me.position.z-frameZ);moving=moving&&movedDistance>.000001;
const running=moving&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));
const poseBlend=1-Math.exp(-dt*18);
const torso=player.getObjectByName('torso');torso.rotation.y=THREE.MathUtils.lerp(torso.rotation.y,moving?Math.sin(phase)*.035:0,poseBlend);
legs.forEach((m,i)=>m.rotation.x=THREE.MathUtils.lerp(m.rotation.x,moving?Math.sin(phase+i*Math.PI)*.55:0,poseBlend));
arms.forEach((m,i)=>m.rotation.x=THREE.MathUtils.lerp(m.rotation.x,moving?-Math.sin(phase+i*Math.PI)*.45:0,poseBlend));
// Match foot height to the road, pavement, or grass rather than hovering.
const px=me.position.x,pz=me.position.z;
const sidewalk=(px>=-38&&px<=54&&((pz>=-8.5&&pz<=-3.5)||(pz>=15.5&&pz<=20.5)))||(px>=-21.5&&px<=-16.5&&pz>=-74&&pz<=24);
const road=(Math.abs(px)<=55&&pz>=-3.5&&pz<=15.5)||(px>=-38&&px<=-22&&Math.abs(pz)<=60);
me.position.y=THREE.MathUtils.lerp(me.position.y,(inside||shop)?.02:sidewalk?.165:road?.01:-.095,1-Math.exp(-dt*30));
zoom=THREE.MathUtils.lerp(zoom,zoomTarget,1-Math.exp(-dt*10));
if(active&&!modal&&!document.hidden){GameState.progress=expireCafe(advanceTime(GameState.progress,actionDt*.5));const oldStage=GameState.progress.activeJob?.stage;
const load=GameState.progress.activeJob?.id==='heavy-delivery'&&oldStage==='task'?2:1;
GameState.progress.life=tickLife(GameState.progress.life,actionDt,moving,running,load);
GameState.progress=tickContract(GameState.progress,{position:me.position,room:currentRoom(),dt:actionDt,moving,running,distance:movedDistance});
if(oldStage!==GameState.progress.activeJob?.stage)persist();if(!inside&&!shop)pedestrians.update(dt,me.position);if(inside||shop){saveElapsed+=dt;if(saveElapsed>=4){saveElapsed=0;persist()}}}
look.tick(dt);
if(worldPanel?.actor&&!$('dialog').hidden){const actor=worldPanel.actor,pa=getMeWorldPosition(new THREE.Vector3()),pb=actor.getWorldPosition(new THREE.Vector3()),mid=pa.clone().add(pb).multiplyScalar(.5);const angle=Math.atan2(pa.x-pb.x,pa.z-pb.z);actor.rotation.y=angle;me.rotation.y=angle+Math.PI;worldPlayer.position.copy(mid);if(shop)shops[shop].camera(worldPlayer,angle+.45,.32,5.8,dt);else updateCamera(worldPlayer,angle+.45,.32,5.8,dt)}else if(shop){getMeWorldPosition(worldPlayer.position);shops[shop].camera(worldPlayer,yaw,pitch,zoom,dt);}else if(inside)indoorCamera(me,yaw,pitch,zoom,dt);else updateCamera(me,yaw,pitch,zoom,dt);
const daylight=Math.max(.12,Math.sin((GameState.progress.routine.minutes-360)/1440*Math.PI*2));sun.intensity=.2+daylight*2.9;scene.background.setRGB(.08+daylight*.65,.12+daylight*.67,.2+daylight*.62);scene.fog.color.copy(scene.background);
if(active&&!modal&&!document.hidden)updateCafeVisuals(dt);updateSleep(actionDt);updateWork(dt);updateGig(dt);updateWorldUI();updateMultiplayer(now,moving,dt);syncPlayerMesh();renderer.render(inside?apartment.scene:scene,camera)}requestAnimationFrame(frame);
