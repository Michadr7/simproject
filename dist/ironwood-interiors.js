// Distinct per-building interiors for all 19 Ironwood buildings (one room active at a time, 0 outdoor cost).
import * as T from './vendor/three.module.js';
import {createCharacter} from './character.js';
import {outfit} from './appearance.js';
import {createDoubleDoor} from './doors.js';
import {propInfo,createProp} from './props.js';
import {DOWNTOWN_INTERIOR,DOWNTOWN_SERVICES} from './downtown-rooms.js';

const THEMES={
 'alder-store':{floor:'#c7a982',wall:'#ece8df',counter:'#215866',role:'Shopkeeper',clerkName:'Brentster Lewis',body:'male',outfit:'Casual_2',skin:'#4b332b',hair:'#924e35',layout:'ridge-clothing'},
 'alder-bakery':{floor:'#d9c5a7',wall:'#f0e3cf',counter:'#8b4c39',role:'Baker',clerkName:'Gemma Atkins',body:'female',outfit:'Casual',skin:'#d9ae8d',hair:'#825337',layout:'bakery'},
 'ironwood-arcade':{floor:'#2d2838',wall:'#453c59',counter:'#68489c',role:'Attendant',body:'male',outfit:'Casual_Hoodie',layout:'arcade'},
 'ironwood-florist':{floor:'#b7c4ad',wall:'#e4ebd8',counter:'#466b4c',role:'Florist',body:'female',outfit:'Casual',layout:'florist'},
 'alder-hardware':{floor:'#9da09d',wall:'#cfd1c9',counter:'#5c4a38',role:'Sales clerk',body:'male',outfit:'Worker',layout:'hardware'},
 'ironwood-furniture':{floor:'#c4b299',wall:'#ebe4d7',counter:'#6b5642',role:'Sales clerk',body:'male',outfit:'Casual',layout:'furniture'},
 'ironwood-clothes':{floor:'#cfc6cf',wall:'#f0eaf0',counter:'#5b435e',role:'Sales clerk',body:'female',outfit:'Formal',layout:'clothes'},
 'alder-pharmacy':{floor:'#d6e2e0',wall:'#f2f7f6',counter:'#3b6f75',role:'Pharmacist',body:'female',outfit:'Formal',layout:'pharmacy'},
 'alder-books':{floor:'#9e7e5c',wall:'#dfd2bc',counter:'#593f2b',role:'Bookseller',body:'male',outfit:'Formal',layout:'books'},
 'alder-barber':{floor:'#c2beb6',wall:'#e6e1d8',counter:'#2c4a63',role:'Barber',body:'male',outfit:'Casual_2',layout:'barber'},
 'alder-bank':{floor:'#cfd3d6',wall:'#e9ecef',counter:'#34495e',role:'Bank teller',body:'male',outfit:'Formal',layout:'bank'},
 'police-station':{floor:'#aeb6bf',wall:'#dde3e9',counter:'#2b3e50',role:'Police officer',body:'male',outfit:'Formal',layout:'police'},
 'ironwood-post-office':{floor:'#c4c7c9',wall:'#e5e8eb',counter:'#2d4766',role:'Postal clerk',body:'female',outfit:'Casual',layout:'post'},
 'ironwood-town-hall':{floor:'#c9bea9',wall:'#ebe5d8',counter:'#4a525a',role:'Town clerk',body:'female',outfit:'Formal',layout:'hall'},
 'ironwood-clinic':{floor:'#dce6e8',wall:'#f4f9fa',counter:'#2c5a63',role:'Receptionist',body:'female',outfit:'Formal',layout:'clinic'},
 'alder-offices':{floor:'#b8bfc4',wall:'#e6eaed',counter:'#3b4b59',role:'Office manager',body:'male',outfit:'Formal',layout:'office'},
 'alder-tower':{floor:'#bfc5c9',wall:'#ebeff2',counter:'#2b3640',role:'Concierge',body:'female',outfit:'Formal',layout:'tower'},
 'eden-ridge-gazette':{floor:'#c2bcb0',wall:'#e8e2d6',counter:'#383d42',role:'Editor',body:'male',outfit:'Casual_2',layout:'gazette'},
 'alder-cinema':{floor:'#4a2b30',wall:'#6b3840',counter:'#8a6632',role:'Usher',body:'male',outfit:'Formal',layout:'cinema'},
 'eastbank-gas-kiosk':{floor:'#9fa4a8',wall:'#dce0e3',counter:'#b54434',role:'Kiosk attendant',body:'male',outfit:'Worker',layout:'kiosk'},
 'kaspian-chandlery':{floor:'#9c8a72',wall:'#dce4e8',counter:'#2e556e',role:'Chandlery clerk',body:'male',outfit:'Casual_2',layout:'chandlery'},
 'kaspian-shack':{floor:'#b89d7a',wall:'#e9e3d5',counter:'#346978',role:'Shack cook',body:'female',outfit:'Casual',layout:'shack'},
 'kaspian-harbor':{floor:'#8e969e',wall:'#dce2e6',counter:'#244359',role:'Harbor master',body:'male',outfit:'Formal',layout:'harbor'},
 'eden-hall-a':{floor:'#7f858a',wall:'#cfd4d8',counter:'#234c3a',role:'Welding foreman',body:'male',outfit:'Worker',layout:'weld'},
 'eden-outdoors':{floor:'#8a735b',wall:'#d8cbb8',counter:'#3f5e42',role:'Outfitter',body:'male',outfit:'Casual_Hoodie',layout:'outdoors'}
};

export function createIronwoodInterior(id){
 const cfg=THEMES[id]||THEMES['alder-store'];
 const W=14,D=12,H=3.6;
 const scene=new T.Group();scene.name='iw-interior-'+id;
 scene.position.set(DOWNTOWN_INTERIOR.origin.x,DOWNTOWN_INTERIOR.origin.y,DOWNTOWN_INTERIOR.origin.z);
 const occluders=[],blocks=[];
 const box=(w,h,d,x,y,z,c,solid=false,occlude=false)=>{
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85}));
  m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);
  if(occlude&&y>0)occluders.push(m);
  if(solid)blocks.push({x,z,hx:w/2,hz:d/2});
  return m;
 };
 const put=(propId,x,z,yaw=0,solid=true)=>{
  try{
   const m=createProp(propId,{apply:mat=>mat});m.position.set(x,0,z);m.rotation.y=yaw;scene.add(m);
   if(solid){const info=propInfo(propId),s=Math.round(Math.sin(yaw)),c=Math.round(Math.cos(yaw));
    for(const b of info.colliders||[])blocks.push({x:x+b.x*c+b.z*s,z:z-b.x*s+b.z*c,hx:s?b.hz:b.hx,hz:s?b.hx:b.hz});}
  }catch{}
 };

 // Shell: floor, walls, front glass doors (Ridge Clothing matches its wide see-through street facade)
 const L=cfg.layout;
 box(W,.2,D,0,-.1,0,cfg.floor);
 box(W,H,.18,0,H/2,-D/2,cfg.wall,true,true);
 box(.18,H,D,-W/2,H/2,0,cfg.wall,true,true);
 box(.18,H,D,W/2,H/2,0,cfg.wall,true,true);
 if(L==='ridge-clothing'){
  for(const x of [-4.2,4.2]){
   box(5.6,.42,.18,x,.21,D/2,'#c2beb2',true,true);
   box(5.6,.22,.18,x,H-.11,D/2,'#2b353d',false,true);
   const win=new T.Mesh(new T.BoxGeometry(5.35,2.85,.06),new T.MeshStandardMaterial({color:'#cce6ef',transparent:true,opacity:.22,roughness:.12,depthWrite:false}));
   win.position.set(x,1.90,D/2);scene.add(win);
   blocks.push({x,z:D/2,hx:2.8,hz:.14});
  }
 }else{
  for(const x of [-4.2,4.2])box(5.6,H,.18,x,H/2,D/2,cfg.wall,true,true);
 }
 box(2.8,.8,.18,0,H-.4,D/2,cfg.wall,false,true);
 const exitDoor=createDoubleDoor({width:2.3,height:2.55});exitDoor.group.position.set(0,0,D/2);scene.add(exitDoor.group);

 // Main service counter + staff clerk
 box(4.6,1,1,0,.5,-3.5,cfg.counter,true);
 box(4.8,.1,1.15,0,1.05,-3.5,'#e5dcc8');
 const clerkExtra={...(cfg.skin?{skin:cfg.skin}:{}),...(cfg.hair?{hair:cfg.hair}:{})};
 const clerk=createCharacter(outfit(cfg.body,cfg.outfit,clerkExtra));clerk.group.position.set(0,.02,-4.45);scene.add(clerk.group);

 // Distinct per-building layout using real Kenney furniture + custom architectural fixtures
 if(L==='books'){
  for(const x of [-4.8,-2.8,2.8,4.8])for(const z of [-1.2,1.8])put('f-bookcase',x,z,x<0?Math.PI/2:-Math.PI/2);
  put('f-rug',0,1.2,0,false);put('f-table',0,1.2,0);put('f-chair',-.9,1.2,Math.PI/2);put('f-chair',.9,1.2,-Math.PI/2);put('f-lamp',5.8,-4.8,0);
 }else if(L==='cinema'){
  box(7,2.4,.15,0,1.6,-5.8,'#1c1e22');box(6.4,2,.08,0,1.6,-5.72,'#e9eef2'); // screen
  for(const z of [-0.5,1.2,2.9])for(const x of [-3.6,-1.8,1.8,3.6])put('f-chair',x,z,Math.PI);
  put('f-plant',-5.6,-4.8,0);put('f-plant',5.6,-4.8,0);
 }else if(L==='police'){
  box(3.4,3.2,.14,-4.6,1.6,-1.2,'#4b535c',true); // cell wall
  for(let x=-5.8;x<=-3.2;x+=.45)box(.07,3,.07,x,1.5,.6,'#7a828a',true); // cell bars
  put('f-bed-single',-5.2,-2.8,0);
  put('f-desk',4.2,-1.5,-Math.PI/2);put('f-desk-chair',5.1,-1.5,-Math.PI/2);put('f-cabinet',5.6,1.8,-Math.PI/2);
 }else if(L==='bank'){
  box(4.6,1.1,.06,0,1.65,-3.05,'#b9d8e4'); // teller glass
  box(2.4,2.6,.4,-4.5,1.3,-5.7,'#687078',true);box(1.4,1.4,.12,-4.5,1.3,-5.45,'#9da5ad'); // vault
  put('f-sofa',4.4,1.2,-Math.PI/2);put('f-plant',-5.8,4.2,0);put('f-plant',5.8,4.2,0);
 }else if(L==='clinic'){
  put('f-sofa',-4.2,1.6,Math.PI/2);put('f-coffee-table',-2.4,1.6,0);
  box(.12,2.6,4.2,2.6,1.3,-1.2,'#d4e4e7',true); // exam bay screen
  put('f-bed-single',4.8,-1.8,0);put('f-bath-sink',5.8,1.2,-Math.PI/2);put('f-plant',-5.8,-4.8,0);
 }else if(L==='barber'){
  for(const x of [-4.2,4.2]){put('f-chair',x,-0.6,0);put('f-cabinet',x<0?-5.8:5.8,-0.6,x<0?Math.PI/2:-Math.PI/2);box(.1,1.3,1.2,x<0?-6.8:6.8,1.5,-0.6,'#b9d8e4')}
  put('f-sofa',0,2.2,Math.PI);put('f-plant',-5.8,-4.8,0);
 }else if(L==='furniture'){
  put('f-bed-double',-4.4,-1.2,0);put('f-sofa',4.2,-1.0,-Math.PI/2);put('f-coffee-table',2.5,-1.0,0);
  put('f-table',-3.8,2.6,0);put('f-chair',-4.7,2.6,Math.PI/2);put('f-chair',-2.9,2.6,-Math.PI/2);put('f-rug',3.2,2.4,0,false);put('f-lamp',5.6,2.8,0);
 }else if(L==='clothes'){
  for(const x of [-4.6,4.6])for(const z of [-1.4,1.6])put('f-wardrobe',x,z,x<0?Math.PI/2:-Math.PI/2);
  put('f-rug',0,0.8,0,false);put('f-sofa',0,2.5,Math.PI);box(1.1,2,.08,5.8,1.2,-3.8,'#c8dfe4');
 }else if(L==='ridge-clothing'){
  box(13.6,3.4,.14,0,1.7,-5.88,'#215866'); // signature deep-teal back wall matching exterior column
  put('f-rug',0,1.2,0,false);put('f-sofa',0,2.6,Math.PI);
  box(1.1,2.0,.08,5.8,1.2,-3.8,'#c8dfe4'); // full-length mirror
  const rackCols=['#2f6f7e','#c44e43','#e0a83d','#394b63','#5e8554'];
  for(const x of [-4.6,4.6])for(const z of [-1.5,1.5]){
   box(1.6,.08,1.0,x,.04,z,'#8c969e',true);
   box(.08,1.55,.85,x,.82,z,'#b7c0c7');
   for(let i=0;i<4;i++)box(.20,.82,.42,x,.95,z-.30+i*.20,rackCols[(i+(x>0?2:0))%rackCols.length]);
  }
  for(const [mx,hex] of [[-4.0,'#215866'],[4.0,'#c44e43']]){
   box(.6,.08,.6,mx,.04,4.3,'#2b353d',true);
   box(.16,.85,.16,mx,.48,4.3,'#2b353d');
   box(.44,.65,.24,mx,1.18,4.3,hex);
   box(.22,.24,.22,mx,1.65,4.3,'#dfc3ab');
  }
  for(const x of [-5.2,5.2])put('f-wardrobe',x,-4.5,0);
 }else if(L==='florist'){
  for(const x of [-4.8,-2.4,2.4,4.8])for(const z of [-0.8,2.0])put('f-plant',x,z,0);
  put('f-table',-4.2,0.6,0);put('f-table',4.2,0.6,0);
 }else if(L==='arcade'){
  const screens=['#47e5ff','#ff6ec7','#ffd166','#7bff8a'];
  for(let i=0;i<4;i++){const x=i<2?-5.8:5.8,z=i%2?-1.4:1.6,dir=i<2?1:-1;box(.9,1.9,.85,x,.95,z,'#241d33',true);box(.08,.55,.65,x+dir*.45,1.35,z,screens[i]);box(.3,.14,.7,x+dir*.52,.98,z,'#4e3e6e')}
  put('f-rug',0,1.0,0,false);put('f-sofa',0,2.4,Math.PI);put('f-coffee-table',0,.9,0);put('f-tv',-4.6,-4.8,0);put('f-plant',5.6,-4.8,0);
 }else if(L==='bakery'){
  for(const x of [-4.4,4.4])for(const z of [-0.6,2.2]){put('f-table',x,z,0);put('f-chair',x,z-.9,0);put('f-chair',x,z+.9,Math.PI)}
  put('f-stove',-4.8,-4.8,0);put('f-fridge',4.8,-4.8,0);
 }else if(L==='office'||L==='gazette'||L==='tower'||L==='hall'){
  for(const x of [-4.4,4.4]){put('f-desk',x,-0.8,0);put('f-desk-chair',x,-1.7,0);put('f-cabinet',x,2.2,Math.PI)}
  put('f-sofa',0,2.4,Math.PI);put('f-plant',-5.8,-4.8,0);put('f-plant',5.8,-4.8,0);
 }else if(L==='kiosk'){
  put('f-fridge',-5.2,-4.6,0);put('f-fridge',5.2,-4.6,0);
  for(const x of [-4.4,4.4])put('f-cabinet',x,1.0,x<0?Math.PI/2:-Math.PI/2);
  box(1.1,1.0,.9,-1.8,.5,-3.5,'#32383e',true);box(.6,.6,.5,-1.8,1.3,-3.5,'#1d2226'); // coffee station & POS terminal
 }else if(L==='chandlery'){
  for(const x of [-4.8,4.8])for(const z of [-1.2,1.8])put('f-cabinet',x,z,x<0?Math.PI/2:-Math.PI/2);
  box(2.2,1.1,.9,0,.55,1.2,'#6e5239',true);box(.9,.5,.6,-0.5,1.35,1.2,'#c7b28f');box(.8,.45,.6,.55,1.32,1.2,'#d97a38'); // tackle table, rope coils, vests
  put('f-plant',5.6,-4.8,0);
 }else if(L==='shack'){
  for(const x of [-4.2,4.2])for(const z of [-0.6,2.0]){put('f-table',x,z,0);put('f-chair',x-.9,z,Math.PI/2);put('f-chair',x+.9,z,-Math.PI/2)}
  put('f-stove',-4.8,-4.8,0);put('f-fridge',4.8,-4.8,0);put('f-plant',-5.8,4.2,0);
 }else if(L==='harbor'){
  for(const x of [-4.4,4.4]){put('f-desk',x,-0.6,0);put('f-desk-chair',x,-1.5,0);put('f-cabinet',x,2.2,Math.PI)}
  box(2.4,.12,1.3,0,1.0,-3.5,'#234761');put('f-plant',-5.6,-4.8,0);put('f-plant',5.6,-4.8,0);
 }else if(L==='weld'){
  for(const x of [-4.8,4.8])box(1.6,.95,3.2,x,.48,.4,'#4f575e',true);
  box(2.0,.25,1.2,0,.95,1.4,'#8f5e34',true);box(1.4,.9,.9,-4.8,.45,-4.4,'#2d6346',true);
 }else if(L==='outdoors'){
  for(const x of [-4.8,4.8])for(const z of [-1.2,1.8])put('f-cabinet',x,z,x<0?Math.PI/2:-Math.PI/2);
  box(3.4,.3,2.2,-4.2,.15,2.2,'#496b45',true);box(1.4,1.1,1.6,-4.2,.85,2.2,'#b86b35',true); // pitched camp display tent
  put('f-table',4.0,.4,0);put('f-plant',-5.6,-4.8,0);put('f-plant',5.6,-4.8,0);
 }else{
  for(const x of [-4.8,4.8])for(const z of [-1.2,1.6])put('f-cabinet',x,z,x<0?Math.PI/2:-Math.PI/2);
  put('f-fridge',-5.2,-4.8,0);put('f-plant',5.6,-4.8,0);
 }

 // Custom working/patron NPCs inside the open building (each has a distinct role & meaningful line)
 const staff=[];
 const addNpc=(name,role,body,style,x,z,yaw,line)=>{
  const ch=createCharacter(outfit(body,style));ch.group.position.set(x,.02,z);ch.group.rotation.y=yaw;scene.add(ch.group);
  staff.push({name,role,group:ch.group,x,z,line});
 };
 if(L==='books'){addNpc('Clara','Librarian','female','Formal',-3.6,-.2,Math.PI/2,'We just shelved new Forestry and Hospitality manuals—check the front counter if you want to study.');addNpc('Julian','Reader','male','Casual',1.5,2.4,-Math.PI,'Quiet afternoon for reading. The Gazette says town deliveries are picking up.')}
 else if(L==='police'){addNpc('Officer Hayes','Patrol Officer','male','Formal',2.4,-1.5,-Math.PI/2,'All quiet on Ironwood Street today. Keep your truck parked off the crosswalks.');addNpc('Dispatcher Lin','Dispatcher','female','Formal',4.8,1.0,-Math.PI/2,'Monitoring the county road and Eastbank dispatch.')}
 else if(L==='bank'){addNpc('Arthur','Loan Officer','male','Formal',3.6,.4,-Math.PI/2,'Studio 2B and Cedar Heights leases are all tracked cleanly at the teller window.');addNpc('Nora','Customer','female','Casual',-2.5,2.2,0,'Checking my savings before I look at the houses on Cedar Loop.')}
 else if(L==='clinic'){addNpc('Dr. Patel','Physician','female','Formal',3.8,-1.8,-Math.PI/2,'Feeling worn down? A full checkup at the desk restores your Food, Thirst, and Energy to 100%.');addNpc('Devon','Patient','male','Casual_2',-1.6,2.4,Math.PI/2,'Just picking up a checkup after a long shift at the sawmill.')}
 else if(L==='barber'){addNpc('Marco','Stylist','male','Casual_2',-3.4,-.6,-Math.PI/2,'Hop in the chair anytime—a fresh cut always lifts your energy.');addNpc('Leo','Customer','male','Casual',1.8,2.4,Math.PI,'Best trim in Ironwood.')}
 else if(L==='cinema'){addNpc('Maya','Projectionist','female','Casual',-4.2,-2.2,0,'Evening feature starts soon—grab a ticket at the booth to unwind and recharge.')}
 else if(L==='arcade'){addNpc('Toby','Arcade Regular','male','Casual_Hoodie',-4.4,-1.4,-Math.PI/2,'Try the corner cabinet—it is tuned fastest. Step up to the counter for tokens or a cold soda.');addNpc('Lena','Lounge Patron','female','Casual',2.0,2.4,Math.PI,'Best spot in Ironwood to unwind after a shift by the river.')}
 else if(L==='florist'){addNpc('Rose','Botanist','female','Casual',-2.0,.8,Math.PI/2,'Fresh bouquets make great gifts—folks around town remember a kind gesture.')}
 else if(L==='hardware'){addNpc('Hank','Tool Specialist','male','Worker',-3.8,-1.2,Math.PI/2,'Keep a repair kit and gas can in your truck—nothing worse than stalling on Bay Road.')}
 else if(L==='gazette'){addNpc('Ben','Reporter','male','Casual_2',-2.2,-.8,0,'Always looking for tips on town shortages or busy shifts—we pay $5 for a good scoop.')}
 else if(L==='hall'){addNpc('Mayor Vance','Town Clerk','male','Formal',-2.2,-.8,0,'Your town standing grows whenever you help neighbours, send postcards, or bring flowers.')}
 else if(L==='clothes'){addNpc('Sloane','Stylist','female','Formal',-3.4,1.2,Math.PI/2,'Try a new look at the counter—our wardrobe is open to everyone.')}
 else if(L==='ridge-clothing'){addNpc('Nadia','Style Advisor','female','Formal',-2.2,1.2,Math.PI/2,'Everything from everyday jackets to waterproof Rain Shells and Winter Parkas is stocked at the counter!')}
 else if(L==='bakery'){addNpc('Sam','Bakery Assistant','male','Casual_2',-2.0,1.4,Math.PI/2,'Fresh loaves come straight from the back ovens—say hello to Gemma at the counter!')}
 else if(L==='kiosk'){addNpc('Mitch','Haulier','male','Worker',-3.6,1.2,Math.PI/2,'Nothing beats hot coffee and beef jerky before taking a load up the Blackstone Pass grade.')}
 else if(L==='chandlery'){addNpc('Capt. Reid','Harbor Skipper','male','Casual_2',-3.6,.8,Math.PI/2,'Calm tide off Kaspian Pier today—stock up on bait and tackle at the counter.')}
 else if(L==='shack'){addNpc('Tessa','Dock Angler','female','Casual',-1.8,1.6,0,'The clam chowder here warms you right up after an early harbor shift.')}
 else if(L==='harbor'){addNpc('Harbor Pilot Quinn','Harbor Pilot','male','Formal',-2.2,-.8,Math.PI/2,'Five harbor gigs run out of Kaspian Bay, plus regional Freight Exchange contracts at the counter.')}
 else if(L==='weld'){addNpc('Master Welder Ray','Fabricator','male','Worker',-3.6,.4,Math.PI/2,'Check in with the Foreman for Tier 1–5 fabrication weld passes or dock shipping tasks.')}
 else if(L==='outdoors'){addNpc('Ranger Cole','Blackstone Ranger','male','Worker',-3.6,-1.2,Math.PI/2,'Pick up a Camp Tent and firewood before heading up to C1–C3, or grab a rod for the lake.')}
 else{addNpc('Sam','Assistant','male','Casual_2',-2.0,1.4,Math.PI/2,'Restocking the shelves—let the clerk at the counter know if you need anything.')}

 const blocked=(x,z)=>Math.abs(x)>W/2-.45||z<-D/2+.45||z>D/2-.45||blocks.some(b=>Math.abs(x-b.x)<b.hx+.3&&Math.abs(z-b.z)<b.hz+.3);
 return {scene,occluders,exitDoor,clerk,staff,blocked,doorBits:[],exitSpec:{near:{halfWidth:1.6,z:4.1},trigger:{halfWidth:1.1,z:5.0}}};
}

export const ALL_IRONWOOD_SERVICES=Object.freeze({
 ...DOWNTOWN_SERVICES,
 'alder-store':{name:'Brentster Lewis',npcId:'brentster',role:'Shopkeeper · Ridge Clothing',greeting:'Welcome to Ridge Clothing! Jackets, rain shells, winter parkas, and backpacks — Junior already inspected the display racks.',actions:[{id:'rc-wardrobe',label:'Open Wardrobe / Try On Outfits',cost:0,kind:'wardrobe'},{id:'rc-jacket',label:'Buy Basic Jacket · $15.00',item:'basic-jacket'},{id:'rc-rain',label:'Buy Rain Shell · $45.00',item:'rain-shell'},{id:'rc-parka',label:'Buy Winter Parka · $85.00',item:'winter-parka'},{id:'rc-pack-s',label:'Buy Small Backpack · $25.00',item:'small-backpack'},{id:'rc-pack-l',label:'Buy Large Backpack · $45.00',item:'large-backpack'}]},
 'alder-bakery':{name:'Gemma Atkins',npcId:'gemma',role:'Head Baker · Ironwood Bakery',greeting:'Fresh loaves & pastries out of the oven!',actions:[{id:'bake-bread',label:'Buy Fresh Bread Loaf · $2.20',item:'bread-loaf'},{id:'bake-flour',label:'Buy Bag of Flour · $2.00',item:'flour-bag'},{id:'bake-coffee',label:'Buy Fresh Coffee · $2.50',item:'coffee'}]},
 'alder-pharmacy':{role:'Pharmacist',greeting:'Ironwood Pharmacy — health & recovery.',actions:[{id:'pharm-tonic',label:'Energy & Vitamin Tonic · $8.00',cost:800,food:15,thirst:40,energy:45,msg:'Pharmacy tonic · thirst +40, energy +45, food +15.'}]},
 'alder-books':{role:'Bookseller',greeting:'Browse the Ironwood Books shelves.',actions:[{id:'book-hosp',label:'Hospitality Field Guide · $12.00 (+15 XP)',cost:1200,skill:'hospitality',xp:15,msg:'Studied hospitality guide (+15 Hospitality XP).'},{id:'book-lumb',label:'Forestry Manual · $12.00 (+15 XP)',cost:1200,skill:'lumberjack',xp:15,msg:'Studied forestry manual (+15 Lumberjack XP).'}]},
 'alder-barber':{role:'Barber',greeting:'Looking for a fresh cut or trim?',actions:[{id:'barber-cut',label:'Haircut & Shave · $10.00 (Wardrobe + Energy)',cost:1000,energy:25,kind:'wardrobe',msg:'Fresh trim (+25 energy).'}]},
 'alder-bank':{role:'Bank teller',greeting:'Ironwood Bank — accounts and municipal billing.',actions:[{id:'bank-bal',label:'Check Account & Bills Summary',cost:0,kind:'bills'},{id:'bank-rep',label:'Inspect Town Standing & Assets',cost:0,kind:'civic'}]},
 'police-station':{role:'Police officer',greeting:'Ironwood Police Department — keep the streets safe.',actions:[{id:'pd-board',label:'Check Town Safety & Lost & Found',cost:0,kind:'mail'}]},
 'alder-offices':{role:'Office manager',greeting:'Ironwood Offices — regional contracts & dispatch.',actions:[{id:'off-gigs',label:'Check Open Town Contracts',cost:0,kind:'mail'}]},
 'alder-tower':{role:'Concierge',greeting:'Ironwood Tower — corporate directory & town overview.',actions:[{id:'twr-stats',label:'View Town Standing & Properties',cost:0,kind:'civic'}]},
 'alder-cinema':{role:'Usher',greeting:'Now showing at Ironwood Cinema!',actions:[{id:'cin-ticket',label:'Watch Evening Feature · $8.00 (+2h, +35 Energy)',cost:800,energy:35,minutes:120,msg:'Enjoyed the movie (+35 energy, +2 hours).'}]},
 'eastbank-gas-kiosk':{
  role:'Kiosk attendant',
  greeting:'Eastbank Fuel Kiosk — fuel snacks, oil, or pick up a POS cashier shift.',
  actions:[
   {id:'kiosk-shift',label:'Work Kiosk Cashier Shift (POS · 4 sales)',cost:0,kind:'kiosk-shift'},
   {id:'kiosk-freight',label:'Freight Exchange Board (BZ3)',cost:0,kind:'freight-board'},
   {id:'kiosk-coffee',label:'Buy Coffee to Go · $2.50',item:'coffee-to-go'},
   {id:'kiosk-jerky',label:'Buy Beef Jerky · $3.00',item:'jerky'},
   {id:'kiosk-hotdog',label:'Buy Hotdog · $3.50',item:'hotdog'},
   {id:'kiosk-sandwich',label:'Buy Sandwich · $4.00',item:'sandwich'},
   {id:'kiosk-water',label:'Buy Water · $1.00',item:'water'},
   {id:'kiosk-soda',label:'Buy Soda · $2.00',item:'soda'},
   {id:'kiosk-oil',label:'Buy Motor Oil · $12.00',item:'motor-oil'},
   {id:'kiosk-gascan',label:'Buy Gas Can · $15.00',item:'gas-can'},
   {id:'kiosk-map',label:'Buy Trail Map · $10.00',item:'trail-map'},
   {id:'kiosk-ice',label:'Buy Bag of Ice · $4.00',item:'ice-bag'}
  ]
 },
 'eden-outdoors':{
  role:'Outfitter',
  greeting:'Welcome to Eden Outdoors! Gear up for Blackstone Lake, camps C1–C3, and the Pass.',
  actions:[
   {id:'out-rod',label:'Buy Fishing Rod · $60.00',item:'fishing-rod'},
   {id:'out-bait',label:'Buy Bait Pack · $5.00',item:'bait-pack'},
   {id:'out-lure',label:'Buy Lure Set · $25.00',item:'lure-set'},
   {id:'out-tent',label:'Buy Camp Tent · $120.00',item:'tent'},
   {id:'out-wood',label:'Buy Firewood Bundle · $8.00',item:'firewood-bundle'},
   {id:'out-bino',label:'Buy Binoculars · $80.00',item:'binoculars'},
   {id:'out-map',label:'Buy Trail Map · $10.00',item:'trail-map'},
   {id:'out-jerky',label:'Buy Beef Jerky · $3.00',item:'jerky'},
   {id:'out-rain',label:'Buy Rain Shell · $45.00',item:'rain-shell'},
   {id:'out-parka',label:'Buy Winter Parka · $85.00',item:'winter-parka'},
   {id:'out-licence',label:'Buy 7-Day Hunting Licence · $150.00',cost:15000,kind:'hunting-licence'},
   {id:'out-sell-hunt',label:'Sell Meat & Pelts (Buy-Back)',cost:0,kind:'sell-hunt'}
  ]
 },
 'kaspian-harbor':{
  role:'Harbor master',
  greeting:'Kaspian Bay Harbor Master — check the Freight Exchange or pick up a coastal harbor gig.',
  actions:[
   {id:'hrb-freight',label:'Freight Exchange Board (BZ3)',cost:0,kind:'freight-board'},
   {id:'hrb-ferry',label:'Work: Ferry Deckhand (BZ7)',cost:0,kind:'harbor-gig',gigId:'ferry-deckhand'},
   {id:'hrb-porter',label:'Work: Fish Market Porter (5 AM–12 PM)',cost:0,kind:'harbor-gig',gigId:'fish-porter'},
   {id:'hrb-recovery',label:'Work: Boat Rental Recovery',cost:0,kind:'harbor-gig',gigId:'boat-recovery'},
   {id:'hrb-tour',label:'Work: Bay Tour Guide',cost:0,kind:'harbor-gig',gigId:'bay-tour'},
   {id:'hrb-spotter',label:'Work: Container Spotter',cost:0,kind:'harbor-gig',gigId:'container-spotter'}
  ]
 },
 'eden-hall-a':{
  role:'Welding foreman',
  greeting:'Eden Industries Hall A — steel fabrication weld passes and shipping dock shifts (6 AM–6 PM).',
  actions:[
   {id:'wld-t1',label:'Weld Tier 1: Mounting Bracket ($18+)',cost:0,kind:'weld-job',jobId:'bracket-t1'},
   {id:'wld-t2',label:'Weld Tier 2: Frame Gusset ($24+)',cost:0,kind:'weld-job',jobId:'gusset-t2'},
   {id:'wld-t3',label:'Weld Tier 3: Trailer Hitch ($32+)',cost:0,kind:'weld-job',jobId:'hitch-t3'},
   {id:'wld-t4',label:'Weld Tier 4: Chassis Rail ($42+)',cost:0,kind:'weld-job',jobId:'rail-t4'},
   {id:'wld-t5',label:'Weld Tier 5: ATV Frame ($56+)',cost:0,kind:'weld-job',jobId:'atv-frame-t5'},
   {id:'shp-steel',label:'Shipping: Load Steel Bundle · $16.00',cost:0,kind:'eden-ship',taskId:'load-steel'},
   {id:'shp-manifest',label:'Shipping: Check Manifest · $14.00',cost:0,kind:'eden-ship',taskId:'check-manifest'},
   {id:'eden-freight',label:'Freight Exchange Board (BZ3)',cost:0,kind:'freight-board'}
  ]
 },
 'kaspian-chandlery':{
  role:'Chandlery clerk',
  greeting:'Harbor Chandlery — tackle, bait, rope, and coast gear.',
  actions:[
   {id:'chan-rod',label:'Buy Fishing Rod · $60.00',item:'fishing-rod'},
   {id:'chan-bait',label:'Buy Bait Pack · $5.00',item:'bait-pack'},
   {id:'chan-lure',label:'Buy Lure Set · $25.00',item:'lure-set'},
   {id:'chan-rope',label:'Buy Marine Rope Coil · $14.00',item:'rope-coil'},
   {id:'chan-vest',label:'Buy Life Jacket · $35.00',item:'life-jacket'},
   {id:'chan-ice',label:'Buy Bag of Ice · $4.00',item:'ice-bag'},
   {id:'chan-gascan',label:'Buy Gas Can · $15.00',item:'gas-can'}
  ]
 },
 'kaspian-shack':{
  role:'Shack cook',
  greeting:'Kaspian Seafood Shack — hot chowder and fresh harbor tacos!',
  actions:[
   {id:'shack-chowder',label:'Buy Clam Chowder · $6.50',item:'clam-chowder'},
   {id:'shack-tacos',label:'Buy Harbor Fish Tacos · $7.50',item:'fish-tacos'},
   {id:'shack-coffee',label:'Buy Coffee to Go · $2.50',item:'coffee-to-go'},
   {id:'shack-water',label:'Buy Water · $1.00',item:'water'},
   {id:'shack-meal',label:'Harbor Platter · $9.00 (Eat Here, Warm Meal)',cost:900,food:60,thirst:25,energy:25,warm:'good',msg:'Fresh harbor platter! Food +60, Thirst +25, Energy +25 (warm meal buff).'}
  ]
 }
});
