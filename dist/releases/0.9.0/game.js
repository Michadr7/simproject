import {chooseInteraction,screenAnchor} from './interactions.js';
import {createLookControls} from './look-controls.js';
import {normalizeCafe,cafeTask,cafeTransaction,expireCafe,ORDERS,MANAGER} from './cafe-job.js';
import {advanceTime,clockText,shopOpen} from './routine.js';
import {normalizeLife,tickLife,lifeTransaction} from './life.js';
import {SHOPS,SHOP_ENTRY,SHOP_EXIT,COUNTER,createShop} from './shops.js';
import {createPedestrians,createVehicles} from './neighborhood.js';
import * as THREE from './vendor/three.module.js';
import { createCameraController } from './camera.js';
import {MARKET,routeFor,targetFor,nearby,money,loadProgress,saveProgress,transactJob} from './jobs.js';
import {STUDIO,totalDue,housingTransaction} from './housing.js';
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
let progress=loadProgress({getItem:key=>localStorage.getItem(key)});
let inside=false,shop=null;const apartment=createApartment();
const shops={market:createShop('market'),cafe:createShop('cafe')};for(const [kind,room] of Object.entries(shops)){room.scene.position.set(SHOPS[kind].x,.165,-13.5);scene.add(room.scene);scene.updateMatrixWorld(true);room.camera=createIndoorCamera(camera,[...room.occluders,...shopShells[kind]]);}const worldPlayer={position:new THREE.Vector3()};
const indoorCamera=createIndoorCamera(camera,apartment.occluders);
const savedCharacter=loadAppearance({getItem:key=>localStorage.getItem(key)});
const avatar=createCharacter(savedCharacter||defaults),player=avatar.group,legs=avatar.legs,arms=avatar.arms;player.name='player';scene.add(player);
player.position.set(-5,.2,15);let yaw=0,pitch=.38,zoom=7,zoomTarget=7,active=false,modal=false,discovered=false,phase=0,busy=null,worldPanel=null,selectedInteraction=null;const keys=createMovementInput(window,document,()=>active&&!modal&&!creatorOpen&&!busy);const updateCamera=createCameraController(camera,cameraSolids,trees,lampMeshes);
function reset(){if(shop){player.position.set(SHOP_ENTRY.x,.02,SHOP_ENTRY.z);return}if(inside){player.position.set(ENTRY.x,.02,ENTRY.z);return}player.position.set(-5,.2,15);yaw=0;pitch=.38;camera.position.set(-5,4,22)}reset();
if(progress.position&&!blocked(progress.position.x,progress.position.z)){player.position.x=progress.position.x;player.position.z=progress.position.z;camera.position.set(player.position.x,4,player.position.z+7)}
function blocked(x,z){if(shop)return shops[shop].blocked(x,z);if(inside)return apartment.blocked(x,z);if(x<-61||x>58||z<-48||z>48)return true;return colliders.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33)}
function pause(show){if(show){$('dialog').hidden=true;worldPanel=null;}$('controls').hidden=!show;modal=show;keys.clear();if(show)look.release()}
$('start').onclick=()=>{if(currentAppearance.name){$('welcome').hidden=true;active=true}else openCreator()};$('help').onclick=()=>pause(true);$('resume').onclick=()=>{pause(false);look.capture()};$('closeDialog').onclick=()=>{$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();look.capture()};
function persist(){if(!inside&&!shop)progress.position={x:player.position.x,z:player.position.z};const ok=saveProgress({setItem:(k,v)=>localStorage.setItem(k,v)},progress);$('progressStatus').textContent=ok?'Saved on this browser':'Saving unavailable · session only';return ok}
function toast(text){$('jobToast').textContent=text;$('jobToast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('jobToast').hidden=true,4500)}
function showDialog(kicker,title,text,tag,action,label){
 worldPanel=null;$('dialog').classList.remove('in-world');$('dialog').style.left='';$('dialog').style.top='';$('thirdAction').hidden=true;
 $('extraAction').hidden=true;modal=true;look.release();keys.clear();$('dialog').hidden=false;$('dialogKicker').textContent=kicker;$('dialogTitle').textContent=title;$('dialogText').textContent=text;$('dialogTag').textContent=tag;
 $('jobAction').hidden=!action;$('jobAction').textContent=label||'';$('jobAction').onclick=action||null;$('closeDialog').textContent=action?'Not now':'Keep exploring';
}
function finishJob(action){
 if(action==='pickup'&&!shopOpen('market',progress.routine)){toast('The market has closed for today.');return}
 const result=transactJob(progress,action,player.position,{shop});if(result.error){toast(result.error);return}
 progress=result.state;persist();$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();
 toast(result.paid?`${money(result.paid)} earned · delivery completed`:'Order collected. Follow the marker to your customer.');
}
function enterHome(){
 if(!progress.housing.rented)return;persist();inside=true;apartment.scene.add(player);player.position.set(ENTRY.x,.02,ENTRY.z);yaw=0;pitch=.4;camera.position.set(ENTRY.x,3,ENTRY.z+5.5);$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();
}
function leaveHome(){inside=false;scene.add(player);player.position.set(STUDIO.x,.165,STUDIO.z);yaw=0;camera.position.set(STUDIO.x,3,STUDIO.z+5);persist();keys.clear()}
function changeHousing(action){
 const result=housingTransaction(progress,action,{atEntrance:!inside&&!shop&&nearby(player.position,STUDIO),atBed:inside&&!shop&&Math.hypot(player.position.x-BED.x,player.position.z-BED.z)<1.4});
 if(result.error){toast(result.error);return}progress=result.state;persist();$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();
 if(action==='rest'){expireCafe(progress);progress.routine={...progress.routine,minutes:480,earned:0,shiftStep:0};progress.life={...normalizeLife(progress.life),energy:100,food:Math.max(0,progress.life.food-12)};persist()}
 if(action==='rent'){toast('Keys received · Studio 2B is yours to rent.');enterHome()}
 else toast(action==='rest'?'Day '+progress.housing.day+' · $21.00 in new bills.':'Bills paid.');
}
function showBills(){
 const h=progress.housing,due=totalDue(h);
 showDialog('HOME / DAY '+h.day,'Your household bills.',h.rented?'Rent: '+money(h.rentDue)+'. Utilities: '+money(h.utilitiesDue)+'. Sleeping advances one game day and adds $18.00 rent plus $3.00 utilities. Rent and utilities accrue each game day, including midnight. Time pauses in menus and while away.':'You have no housing bills yet. Visit 18 Oak Street to view the studio.','Total due '+money(due)+' · after paying '+money(progress.cash-due)+' · next daily bills $21.00',due?()=>changeHousing('pay'):null,due?'Pay bills · '+money(due):'');
}
$('billsButton').onclick=()=>{if(active&&!creatorOpen)showBills()};
function extraAction(label,action){$('extraAction').hidden=false;$('extraAction').textContent=label;$('extraAction').onclick=action}
function enterShop(kind){if(!shopOpen(kind,progress.routine)){toast(kind==='market'?'Market hours: 07:00–22:00':'Café hours: 08:00–18:00');return}persist();shop=kind;shops[kind].scene.add(player);player.position.set(SHOP_ENTRY.x,.02,SHOP_ENTRY.z);yaw=0;pitch=.4;camera.position.set(SHOPS[kind].x,3,-5.5);$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear()}
function leaveShop(){busy=null;const room=shops[shop];for(const mesh of [...room.occluders,...shopShells[shop]]){mesh.material.opacity=1;mesh.material.depthWrite=true}const door=SHOPS[shop];shop=null;scene.add(player);player.position.set(door.x,.165,door.z);camera.position.set(door.x,3,door.z+6);persist();keys.clear()}
function useLife(action){const place=shop||(inside?'home':null);const atCounter=shop&&Math.hypot(player.position.x-COUNTER.x,player.position.z-COUNTER.z)<1.6;const atKitchen=inside&&Math.hypot(player.position.x-3,player.position.z+3.5)<1.5;if(shop&&!shopOpen(shop,progress.routine)){toast('The shop has closed. Please return tomorrow.');return}if(!atCounter&&!atKitchen){toast('Move closer to the counter.');return}const r=lifeTransaction(progress,action,place);if(r.error){toast(r.error);return}progress=r.state;persist();$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();toast(r.message)}
$('bagButton').onclick=()=>{if(active&&!creatorOpen)showDialog('YOUR BAG','Everyday essentials.',progress.life.groceries+' grocery packs. Each pack prepares one meal in your studio kitchen, restoring 65 food. Visit the market cashier to buy more.','Food '+Math.round(progress.life.food)+' / 100 · Energy '+Math.round(progress.life.energy)+' / 100',null)};
function nearestPerson(){return pedestrians.people.find(p=>Math.hypot(player.position.x-p.group.position.x,player.position.z-p.group.position.z)<1.5)}
function nearbyShop(){return Object.keys(SHOPS).find(k=>nearby(player.position,SHOPS[k]))}
function commitCafe(action,drink){const r=cafeTransaction(progress,action,player.position,shop,drink);if(r.error){toast(r.error);return false}progress=r.state;persist();$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();toast(r.message);if(['hire','clockin','order','clockout'].includes(action))look.capture();return true}
function beginCafe(action,drink){const r=cafeTransaction(progress,action,player.position,shop,drink);if(r.error){toast(r.error);return}if(['brew','serve','clean'].includes(action)){busy={action,drink,elapsed:0,duration:action==='brew'?3:action==='clean'?2.5:1.2};$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();look.capture()}else commitCafe(action,drink)}
function worldPoint(point,parent=player.parent){return parent.localToWorld(new THREE.Vector3(point.x,point.y??1.2,point.z))}
function entityPoint(actor){const p=actor.getWorldPosition(new THREE.Vector3());p.y+=1.9;return p}
function showWorld(anchor,name,text,choices=[],actor=null){
 showDialog(name,'',text,'',choices[0]?.run,choices[0]?.label);worldPanel={anchor,actor};$('dialog').classList.add('in-world');$('closeDialog').textContent=actor?'See you':'Close';
 if(choices[1])extraAction(choices[1].label,choices[1].run);if(choices[2]){$('thirdAction').hidden=false;$('thirdAction').textContent=choices[2].label;$('thirdAction').onclick=choices[2].run}
 $('dialog').classList.remove('bubble-enter');void $('dialog').offsetWidth;$('dialog').classList.add('bubble-enter');
}
function speak(actor,name,text,choices=[]){showWorld(()=>entityPoint(actor),name,text,choices,actor)}
function station(point,name,text,choices){showWorld(()=>worldPoint(point),name,text,choices)}
function managerMenu(){const c=progress.cafe,actor=shops.cafe.clerk.group;const choices=[];
 if(progress.phase==='carrying'&&progress.completed%3===1)choices.push({label:'I have your delivery.',run:()=>speak(actor,'Elena','Perfect, that’s our produce order. Thank you!',[{label:'Hand over order · '+money(routeFor(progress).pay),run:()=>finishJob('deliver')}])});
 if(c.stage==='clockout')choices.push({label:'I’m ready to clock out.',run:()=>speak(actor,'Elena','Two customers served and the table reset. Good work—here are your $24 wages.',[{label:'Clock out & collect $24',run:()=>commitCafe('clockout')}])});
 else if(c.stage==='off')choices.push({label:c.employed?'I’m here for my shift.':'Are you hiring?',run:()=>speak(actor,'Elena',c.employed?'You can clock in from 08:00 to 16:00. Serve two customers, reset their table, and come back to me for your $24 pay.':'Yes! I need a café assistant to take orders, make coffee and look after our tables. A completed shift pays $24.',[{label:c.employed?'Clock me in.':'I’d like the job.',run:()=>commitCafe(c.employed?'clockin':'hire')}])});
 else choices.push({label:'What’s my next task?',run:()=>speak(actor,'Elena',cafeTask(progress).title+'. Your order ticket is shown on the left.')});
 choices.push({label:'I’d like lunch.',run:()=>speak(actor,'Elena','A sandwich and coffee is $6. Would you like one?',[{label:'Yes, please · $6',run:()=>useLife('meal')}])});
 speak(actor,'Elena','Hi there. What can I help you with?',choices);
}
function marketMenu(){const actor=shops.market.clerk.group;if(!shopOpen('market',progress.routine)){speak(actor,'Noah','We’re closed for today. Come back between 07:00 and 22:00.');return}speak(actor,'Noah','Welcome in. What do you need?',[
 {label:'I’d like groceries.',run:()=>speak(actor,'Noah','A grocery pack is $4. You can cook it at home.',[{label:'Buy a pack · $4',run:()=>useLife('groceries')}])},
 {label:'Any delivery work?',run:()=>{const route=routeFor(progress);speak(actor,'Noah',progress.phase==='carrying'?'You’ve already collected an order for '+route.name+'. Bring that one over first.':'Could you take this grocery order to '+route.name+'? They’ll pay you '+money(route.pay)+'.',progress.phase==='carrying'?[]:[{label:'Sure, I’ll take it.',run:()=>finishJob('pickup')}])}}
 ])}
function showCafe(){const c=progress.cafe,o=ORDERS[c.customer];if(c.stage==='off'||c.stage==='clockout'){managerMenu();return}if(['order','serve'].includes(c.stage)&&customerWalking){toast('Your customer is taking a seat.');return}if(c.stage==='clean'&&shops.cafe.customer.group.visible){toast('Wait for your customer to leave the table.');return}
 if(c.stage==='order'){speak(shops.cafe.customer.group,o.name,'Could I have one '+o.drink.toLowerCase()+', please?',[{label:'Of course. Coming right up.',run:()=>commitCafe('order')}]);return}
 if(c.stage==='brew'){station({x:-1.25,y:1.5,z:-3.2},'Coffee machine','Ticket: '+o.drink,[{label:'Make espresso',run:()=>beginCafe('brew','Espresso')},{label:'Make latte',run:()=>beginCafe('brew','Latte')}]);return}beginCafe(c.stage);
}
function candidates(){const all=[],add=(id,point,anchor,label,run,range=1.5)=>all.push({id,point,anchor,label,run,range});
 if(shop){add('exit',SHOP_EXIT,()=>worldPoint({x:0,y:1.35,z:4.9}),'Go outside',leaveShop,1.5);add('clerk',COUNTER,()=>entityPoint(shops[shop].clerk.group),'Talk to '+(shop==='market'?'Noah':'Elena'),shop==='market'?marketMenu:managerMenu,1.6);
 if(shop==='cafe'&&!['off','clockout'].includes(progress.cafe.stage)){const task=cafeTask(progress);add('cafe-task',task,()=>progress.cafe.stage==='order'||progress.cafe.stage==='serve'?entityPoint(shops.cafe.customer.group):worldPoint({...task,y:1.2}),task.title,showCafe,1.35)}return all}
 if(inside){add('exit',EXIT,()=>worldPoint({x:0,y:1.4,z:5.3}),'Go outside',leaveHome);add('cook',{x:3,z:-3.5},()=>worldPoint({x:3,y:1.3,z:-4.5}),'Prepare a meal',()=>station({x:3,y:1.4,z:-4.5},'Kitchen',progress.life.groceries+' grocery packs in your bag.',[{label:'Cook a meal',run:()=>useLife('cook')}]));add('bed',BED,()=>worldPoint({...BED,y:.8}),'Sleep',()=>station({...BED,y:1},'Rest until morning?','A new day adds $21 in rent and utilities.',[{label:'Sleep until 08:00',run:()=>changeHousing('rest')}]),1.4);return all}
 for(const [kind,door]of Object.entries(SHOPS)){const open=shopOpen(kind,progress.routine);add('door-'+kind,{x:door.x,z:-8.1},()=>new THREE.Vector3(door.x,1.5,-8.25),open?'Enter '+door.name:'Closed · '+(kind==='market'?'07:00–22:00':'08:00–18:00'),()=>enterShop(kind),2.8)}
 add('home',{x:STUDIO.x,z:-8.1},()=>new THREE.Vector3(1,1.5,-8.15),progress.housing.rented?'Enter your studio':'View studio listing',()=>{if(progress.housing.rented)enterHome();else showWorld(()=>new THREE.Vector3(1,1.6,-8.15),'Studio 2B · To let','Furnished studio. $48 move-in; then $18 rent + $3 utilities per day.',[{label:'Rent studio · $48',run:()=>changeHousing('rent')}])},2.8);
 if(progress.phase==='carrying'&&progress.completed%3!==1){const r=routeFor(progress);add('delivery',r,()=>new THREE.Vector3(r.x,1.3,r.z),'Leave delivery · '+money(r.pay),()=>station(r,'Delivery collection box','Order for '+r.name+'. Payment: '+money(r.pay)+'.',[{label:'Place order & collect payment',run:()=>finishJob('deliver')}]),1.4)}
 for(const person of pedestrians.people)add('person-'+person.name,person.group.position,()=>entityPoint(person.group),'Talk to '+person.name,()=>speak(person.group,person.name,'Hey! How’s your day going?',[{label:'Any advice for someone new?',run:()=>speak(person.group,person.name,person.line)},{label:'Nice to meet you.',run:()=>speak(person.group,person.name,'You too. See you around the neighborhood!')}]),1.5);
 for(const car of vehicles)add(car.id,car,()=>new THREE.Vector3(car.x,1.3,car.z),'Inspect '+car.name,()=>showWorld(()=>new THREE.Vector3(car.x,1.4,car.z),car.name,'Parked · not owned. Driving will be available in a future update.'),1.6);return all;
}
function interact(){if(!active||modal||busy)return;const hit=chooseInteraction(candidates(),player.position,player.rotation.y);if(hit)hit.run()}
function updateWorldUI(){
 camera.updateMatrixWorld(true);const hit=chooseInteraction(candidates(),player.position,player.rotation.y);selectedInteraction=hit;
 const p=hit?screenAnchor(hit.anchor(),camera,innerWidth,innerHeight,THREE.Vector3):null;$('prompt').hidden=!active||modal||!!busy||!p;
 if(p){$('prompt').style.left=p.x+'px';$('prompt').style.top=p.y+'px';$('prompt').querySelector('span').textContent=hit.label}
 if(worldPanel&&!$('dialog').hidden){const anchor=screenAnchor(worldPanel.anchor(),camera,innerWidth,innerHeight,THREE.Vector3);if(anchor){const width=Math.min(320,innerWidth-24),height=$('dialog').offsetHeight||260;$('dialog').style.left=Math.max(12,Math.min(innerWidth-width-12,anchor.x+26))+'px';$('dialog').style.top=Math.max(12,Math.min(innerHeight-height-12,anchor.y-height*.55))+'px';}else{$('dialog').style.left='12px';$('dialog').style.top='100px'}}
 $('workProgress').hidden=!busy;if(busy){const task=cafeTask(progress),p=screenAnchor(worldPoint({...task,y:1.4}),camera,innerWidth,innerHeight,THREE.Vector3);if(p){$('workProgress').style.left=p.x+'px';$('workProgress').style.top=p.y+'px';$('workProgress').textContent=({brew:'Preparing coffee',serve:'Serving',clean:'Cleaning table'}[busy.action])+' · '+Math.round(busy.elapsed/busy.duration*100)+'%'}}
}
// Small destination marker, shared by pickups and drop-offs.
const marker=new THREE.Group();const markerMaterial=new THREE.MeshBasicMaterial({color:'#d4e7b3',transparent:true,opacity:.8,depthWrite:false});
const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.72,32),markerMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.2;marker.add(ring);
const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.16),markerMaterial);diamond.position.y=2.5;marker.add(diamond);scene.add(marker);
const parcel=new THREE.Mesh(new THREE.BoxGeometry(.38,.32,.22),mat('#ad8c60'));parcel.position.set(0,1.16,-.25);player.add(parcel);
const workMarker=new THREE.Mesh(new THREE.RingGeometry(.35,.43,32),new THREE.MeshBasicMaterial({color:'#e7c681',side:THREE.DoubleSide,transparent:true,opacity:.85}));workMarker.rotation.x=-Math.PI/2;shops.cafe.scene.add(workMarker);
const drinkCup=new THREE.Mesh(new THREE.CylinderGeometry(.07,.055,.17,10),mat('#eee3ce'));drinkCup.position.set(.32,1.12,.3);player.add(drinkCup);
let customerKey='',customerRoute=[],customerWalking=false,customerLeaving=false;
function updateCafeVisuals(dt){const room=shops.cafe,c=progress.cafe,key=c.day+':'+c.customer+':'+(['clean','clockout','off'].includes(c.stage)?'leaving':'seated');if(key!==customerKey){customerKey=key;if(['order','brew','serve'].includes(c.stage)){room.customer.group.visible=true;room.customer.group.position.set(0,.02,3);customerRoute=[[-2.3,3],[-2.3,-1.55],[-3.8,-1.55]];customerLeaving=false}else if(room.customer.group.visible){customerRoute=[[-2.3,-1.55],[-2.3,3],[0,4]];customerLeaving=true}}
 customerWalking=customerRoute.length>0;if(customerWalking){const g=room.customer.group,[x,z]=customerRoute[0],dx=x-g.position.x,dz=z-g.position.z,d=Math.hypot(dx,dz);g.position.y=.02;if(d<dt*1.7){g.position.set(x,.02,z);customerRoute.shift();if(!customerRoute.length){if(customerLeaving)g.visible=false;else{g.position.y=-.35;g.rotation.y=0}}}else{g.position.x+=dx/d*dt*1.7;g.position.z+=dz/d*dt*1.7;g.rotation.y=Math.atan2(dx,dz)}}
 room.customer.legs.forEach((m,i)=>m.rotation.x=customerWalking?Math.sin(performance.now()*.006+i*Math.PI)*.4:room.customer.group.visible?-1.2:0);room.usedCup.visible=c.stage==='clean';
 if(busy){busy.elapsed+=dt;arms.forEach((m,i)=>m.rotation.x=-.8+Math.sin(busy.elapsed*10+i)*.2);if(busy.elapsed>=busy.duration){const task=busy;busy=null;commitCafe(task.action,task.drink)}}
}
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)persist()});
let saveElapsed=0,markerTime=0;
function updateWork(dt){
 workMarker.visible=false;drinkCup.visible=shop==='cafe'&&progress.cafe.stage==='serve';
 const dest=targetFor(progress),route=routeFor(progress),carrying=progress.phase==='carrying';
 $('housingStatus').textContent=progress.housing.rented?'Studio 2B · Day '+progress.housing.day+' · Bills '+money(totalDue(progress.housing)):'No home · Studio move-in $48.00';
 $('clockStatus').textContent='Day '+progress.housing.day+' · '+clockText(progress.routine);$('earningsStatus').textContent='Earned today '+money(progress.routine.earned);
 $('needsStatus').textContent='Food '+Math.round(progress.life.food)+'% · Energy '+Math.round(progress.life.energy)+'%';
 $('locationName').textContent=shop?SHOPS[shop].name.toUpperCase():inside?'STUDIO 2B':'WESTSIDE';
 if(shop){const task=cafeTask(progress),isCafe=shop==='cafe',c=progress.cafe;const exit=Math.hypot(player.position.x-SHOP_EXIT.x,player.position.z-SHOP_EXIT.z)<1.5,counter=Math.hypot(player.position.x-COUNTER.x,player.position.z-COUNTER.z)<1.6,atTask=isCafe&&Math.hypot(player.position.x-task.x,player.position.z-task.z)<1.35;
 $('cash').textContent=money(progress.cash);$('objective').querySelector('.eyebrow').textContent=isCafe&&c.stage!=='off'?'ON SHIFT · ALDER COFFEE':'NEIGHBORHOOD';$('objective').querySelector('h2').textContent=isCafe?task.title:SHOPS[shop].name;$('objective').querySelector('p').textContent=isCafe?(c.stage==='off'?'Speak to Elena at the counter about café work. $24 per shift. Start 08:00–16:00.':'Orders served: '+c.served+'/2 · '+(c.stage==='brew'||c.stage==='serve'?'Ticket: '+ORDERS[c.customer].drink+'. ':'')+'Follow the floor marker. Clock out to collect wages.'):'Visit the cashier for groceries. Open 07:00–22:00.';$('distance').textContent=busy?'Working… '+Math.round(busy.elapsed/busy.duration*100)+'%':'E to interact · front door to leave';$('direction').style.transform='none';$('prompt').hidden=!active||modal||!!busy||(!exit&&!counter&&!atTask);$('prompt').querySelector('span').textContent=atTask?task.title:exit?'Go outside':isCafe?'Order lunch':'Buy groceries';marker.visible=false;workMarker.visible=isCafe;workMarker.position.set(task.x,.04,task.z);parcel.visible=carrying;return}


 if(inside){$('cash').textContent=money(progress.cash);$('objective').querySelector('.eyebrow').textContent='YOUR FIRST HOME';$('objective').querySelector('h2').textContent='Make yourself at home.';$('objective').querySelector('p').textContent='E at the bed to sleep, kitchen to cook, or door to go outside. Daily costs: $21.00.';$('distance').textContent='Bed: rest · Door: go outside';$('direction').style.transform='none';const exit=Math.hypot(player.position.x-EXIT.x,player.position.z-EXIT.z)<1.5,bed=Math.hypot(player.position.x-BED.x,player.position.z-BED.z)<1.4;const kitchen=Math.hypot(player.position.x-3,player.position.z+3.5)<1.5;$('prompt').hidden=!active||modal||(!exit&&!bed&&!kitchen);$('prompt').querySelector('span').textContent=exit?'Go outside':kitchen?'Prepare a meal':'Rest until tomorrow';marker.visible=false;parcel.visible=carrying;return}
 $('cash').textContent=money(progress.cash);$('deliveryCount').textContent=progress.completed+' '+(progress.completed===1?'delivery':'deliveries')+' completed';
 $('objective').querySelector('.eyebrow').textContent=carrying?'ORDER COLLECTED':'DELIVERY WORK';
 $('objective').querySelector('h2').textContent=carrying?'Deliver to '+dest.name:progress.completed?'Ready for another?':'Earn your first wages.';
 $('objective').querySelector('p').textContent=carrying?(progress.completed%3===1?'Speak to Elena at the café counter. Payment: ':'Use the marked delivery box. Payment: ')+money(route.pay)+'.':'Speak to Noah at the market counter for delivery work. Next wage: '+money(route.pay)+'.';
 const distance=Math.hypot(player.position.x-dest.x,player.position.z-dest.z);
 $('distance').textContent=Math.round(distance)+' m · '+dest.name;
 const angle=Math.atan2(dest.x-player.position.x,-(dest.z-player.position.z))+yaw;$('direction').style.transform=`rotate(${angle}rad)`;
 const atJob=nearby(player.position,dest),atApartment=nearby(player.position,STUDIO);
 const atShop=nearbyShop(),atCar=vehicles.some(v=>Math.hypot(player.position.x-v.x,player.position.z-v.z)<1.6);$('prompt').hidden=!active||modal||(!atJob&&!atApartment&&!atShop&&!atCar&&!nearestPerson());$('prompt').querySelector('span').textContent=atJob?(carrying?'Deliver order':'Market · work & shop'):atApartment?'Apartment entrance':atShop?'Enter '+SHOPS[atShop].name:atCar?'Inspect parked vehicle':'Talk to '+nearestPerson()?.name;
 marker.visible=active;marker.position.set(dest.x,0,dest.z);markerTime+=dt;diamond.position.y=2.5+Math.sin(markerTime*2)*.09;diamond.rotation.y+=dt*.7;parcel.visible=carrying;
 if(active&&!modal){saveElapsed+=dt;if(saveElapsed>=4){saveElapsed=0;persist()}}
}
window.addEventListener('keydown',e=>{if(creatorOpen||e.target.matches('input,select,textarea'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&active){if(!$('dialog').hidden){$('dialog').hidden=true;worldPanel=null;modal=false;keys.clear();look.capture()}else pause(true)}if(e.code==='KeyE'&&!e.repeat)interact();if(e.code==='KeyR'&&active&&!modal)reset()});
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
function openCreator(){worldPanel=null;$('dialog').hidden=true;draft={...currentAppearance};$('characterName').value=draft.name;creatorOpen=true;modal=true;look.release();keys.clear();$('welcome').hidden=true;$('controls').hidden=true;$('creator').hidden=false;document.body.classList.add('creating');updateDraft();$('characterName').focus()}
let currentAppearance={...(savedCharacter||defaults)};
if(savedCharacter){$('start').innerHTML='Continue to the neighborhood <span>↗</span>';$('customizeSaved').hidden=false}
$('customizeSaved').onclick=openCreator;$('editCharacter').onclick=openCreator;
$('characterName').oninput=updateDraft;
$('rotateLeft').onclick=()=>previewTurn-=Math.PI/4;$('rotateRight').onclick=()=>previewTurn+=Math.PI/4;
function closeCreator(){creatorOpen=false;modal=false;$('creator').hidden=true;document.body.classList.remove('creating');keys.clear()}
$('cancelCreator').onclick=()=>{closeCreator();if(!active)$('welcome').hidden=false};
$('creatorForm').onsubmit=e=>{e.preventDefault();if(!$('characterName').value.trim()){$('characterName').setCustomValidity('Enter a name to begin.');$('characterName').reportValidity();return}
 $('characterName').setCustomValidity('');updateDraft();currentAppearance={...draft};avatar.apply(draft);
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

let prev=performance.now(),frames=0,elapsed=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-prev)/1000,.04);prev=now;if(creatorOpen){drawCreator();return}frames++;elapsed+=dt;if(elapsed> .75){$('fps').textContent=Math.round(frames/elapsed)+' FPS';frames=0;elapsed=0}
let moving=false;if(active&&!modal&&!busy){let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),s=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));let len=Math.hypot(f,s);if(len){f/=len;s/=len;const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?8.2:4.5,dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed*dt,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed*dt;if(!blocked(player.position.x+dx,player.position.z))player.position.x+=dx;if(!blocked(player.position.x,player.position.z+dz))player.position.z+=dz;const angle=Math.atan2(dx,dz);player.rotation.y+=Math.atan2(Math.sin(angle-player.rotation.y),Math.cos(angle-player.rotation.y))*(1-Math.exp(-dt*24));phase+=dt*speed*2.0;moving=true}}
const poseBlend=1-Math.exp(-dt*18);
const torso=player.getObjectByName('torso');torso.rotation.y=THREE.MathUtils.lerp(torso.rotation.y,moving?Math.sin(phase)*.035:0,poseBlend);
legs.forEach((m,i)=>m.rotation.x=THREE.MathUtils.lerp(m.rotation.x,moving?Math.sin(phase+i*Math.PI)*.55:0,poseBlend));
arms.forEach((m,i)=>m.rotation.x=THREE.MathUtils.lerp(m.rotation.x,moving?-Math.sin(phase+i*Math.PI)*.45:0,poseBlend));
// Match foot height to the road, pavement, or grass rather than hovering.
const px=player.position.x,pz=player.position.z;
const sidewalk=(px>=-38&&px<=54&&((pz>=-8.5&&pz<=-3.5)||(pz>=15.5&&pz<=20.5)))||(px>=-21.5&&px<=-16.5&&pz>=-74&&pz<=24);
const road=(Math.abs(px)<=55&&pz>=-3.5&&pz<=15.5)||(px>=-38&&px<=-22&&Math.abs(pz)<=60);
player.position.y=THREE.MathUtils.lerp(player.position.y,(inside||shop)?.02:sidewalk?.165:road?.01:-.095,1-Math.exp(-dt*30));
zoom=THREE.MathUtils.lerp(zoom,zoomTarget,1-Math.exp(-dt*10));
if(active&&!modal&&!document.hidden){progress=expireCafe(advanceTime(progress,dt*.5));progress.life=tickLife(progress.life,dt,moving,moving&&(keys.has('ShiftLeft')||keys.has('ShiftRight')));if(!inside&&!shop)pedestrians.update(dt,player.position);if(inside||shop){saveElapsed+=dt;if(saveElapsed>=4){saveElapsed=0;persist()}}}
look.tick(dt);
if(worldPanel?.actor&&!$('dialog').hidden){const actor=worldPanel.actor,pa=player.getWorldPosition(new THREE.Vector3()),pb=actor.getWorldPosition(new THREE.Vector3()),mid=pa.clone().add(pb).multiplyScalar(.5);const angle=Math.atan2(pa.x-pb.x,pa.z-pb.z);actor.rotation.y=angle;player.rotation.y=angle+Math.PI;worldPlayer.position.copy(mid);if(shop)shops[shop].camera(worldPlayer,angle+.45,.32,5.8,dt);else updateCamera(worldPlayer,angle+.45,.32,5.8,dt)}else if(shop){player.getWorldPosition(worldPlayer.position);shops[shop].camera(worldPlayer,yaw,pitch,zoom,dt);}else if(inside)indoorCamera(player,yaw,pitch,zoom,dt);else updateCamera(player,yaw,pitch,zoom,dt);
const daylight=Math.max(.12,Math.sin((progress.routine.minutes-360)/1440*Math.PI*2));sun.intensity=.2+daylight*2.9;scene.background.setRGB(.08+daylight*.65,.12+daylight*.67,.2+daylight*.62);scene.fog.color.copy(scene.background);
if(active&&!modal&&!document.hidden)updateCafeVisuals(dt);updateWork(dt);updateWorldUI();renderer.render(inside?apartment.scene:scene,camera)}requestAnimationFrame(frame);
