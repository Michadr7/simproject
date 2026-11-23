// Ironwood commercial properties and street-facing placement (notes/ironwood-city-design.md, I5).
import {DOWNTOWN_PROPS as PROPS} from './props-assets-downtown.js';
import {GAME_NAME} from './game-name.js';

// [plot, id, name, model, x0, x1, z0, z1, facing, type, role, opens, closes]
const sites=[
 ['C11','ironwood-arcade','Ironwood Arcade','downtown-b',57,69,-81,-73.5,'west','commercial','Attendant',600,1380],
 ['C13','ironwood-florist','Ironwood Florist','downtown-j',57,69,-59,-52,'west','shop','Florist',540,1080],
 ['C14','ironwood-post-office','Ironwood Post Office','downtown-k',57,69,-109.5,-99,'west','civic','Postal clerk',480,1020],
 ['C15','alder-hardware','Alder Hardware','downtown-n',57,69,-117,-109.5,'west','shop','Sales clerk',480,1080],
 ['C16','ironwood-furniture','Ironwood Furniture','downtown-m',57,69,-124.5,-117,'west','shop','Sales clerk',540,1080],
 ['C17','eden-ridge-gazette',GAME_NAME+' Gazette','downtown-gazette',57,69,-133,-124.5,'west','commercial','Editor',480,1080],
 ['C18','ironwood-town-hall','Ironwood Town Hall','downtown-town-hall',-20,-6.5,-131,-122,'north','civic','Town clerk',540,1020],
 ['C19','ironwood-clinic','Ironwood Clinic','downtown-clinic',-6.5,1,-131,-122,'north','civic','Receptionist',480,1080],
 ['C20','ironwood-clothes','Ironwood Clothes','downtown-clothes',1,9,-131,-122,'north','shop','Sales clerk',540,1080]
].map(([plot,id,name,prop,x0,x1,z0,z1,facing,type,role,opens,closes])=>
 ({plot,id,name,prop,x0,x1,z0,z1,facing,type,role,opens,closes}));

const frontSetback=.12;
export const DOWNTOWN_PLOTS=sites.map(({plot:id,x0,x1,z0,z1,facing})=>
 ({id,name:'Commercial plot '+id,kind:'commercial',facing,x0,x1,z0,z1}));
export const DOWNTOWN_LANDMARKS=sites.map(({plot,id,prop,x0,x1,z0,z1,facing})=>{
 const west=facing==='west',front=PROPS[prop].footprint.z1;
 const x=west?x0+front+frontSetback:(x0+x1)/2;
 const z=west?(z0+z1)/2:z0+front+frontSetback;
 return {id,prop,plot,zone:'alder',x,z,yaw:west?-Math.PI/2:Math.PI};
});
export const DOWNTOWN_PROPERTIES=sites.map(({plot,id,name,type,opens,closes})=>
 ({id,type,landmark:id,plot,name,hours:[opens,closes],access:'public',owner:null,exteriorDoor:true}));
export const DOWNTOWN_POSTS=sites.map(({id,role,opens,closes})=>({id,at:{property:id},role,hours:[opens,closes]}));

const PAVED=0.165;
const SIGN_COLORS={
 'ironwood-arcade':['IRONWOOD ARCADE','#3a2d5c'],
 'ironwood-florist':['IRONWOOD FLORIST','#2f5d46'],
 'ironwood-post-office':['POST OFFICE','#2d4766'],
 'alder-hardware':['ALDER HARDWARE','#4b453c'],
 'ironwood-furniture':['IRONWOOD FURNITURE','#5c4632'],
 'eden-ridge-gazette':[GAME_NAME.toUpperCase()+' GAZETTE','#383d42'],
 'ironwood-town-hall':['TOWN HALL','#3d454c'],
 'ironwood-clinic':['IRONWOOD CLINIC','#2c5a63'],
 'ironwood-clothes':['IRONWOOD CLOTHES','#583b5c']
};
const AWNINGS={
 'ironwood-arcade':'awning','ironwood-florist':'awning','ironwood-post-office':'overhang-wide',
 'alder-hardware':'awning','ironwood-furniture':'awning-wide','eden-ridge-gazette':'awning',
 'ironwood-town-hall':'overhang-wide','ironwood-clinic':'overhang','ironwood-clothes':'awning'
};
const DOWNTOWN_OVERRIDES={
 'ironwood-arcade':{offset:-1.6,sy:0.92,signY:3.55},
 'ironwood-florist':{sy:0.78,signY:2.95},
 'ironwood-post-office':{signY:4.05},
 'alder-hardware':{offset:-1.05,sy:0.92,signY:3.55},
 'ironwood-furniture':{signY:3.80},
 'eden-ridge-gazette':{offset:-1.0,sy:0.85,signY:3.25},
 'ironwood-town-hall':{signY:4.10},
 'ironwood-clinic':{signY:4.05},
 'ironwood-clothes':{sy:0.92,signY:3.55}
};
const LEGACY_FRONTS=[
 {id:'alder-store',text:'RIDGE CLOTHING',bg:'#1f4e5a',awning:'awning-wide',x:-13.5,z:-80.70,yaw:Math.PI,y:4.15,w:4.4},
 {id:'alder-offices',text:'IRONWOOD OFFICES',bg:'#36444d',awning:'overhang-wide',x:-2,z:-80.71,yaw:Math.PI,y:4.05,w:3.6},
 {id:'alder-tower',text:'IRONWOOD TOWER',bg:'#2b3640',awning:'overhang-wide',x:8.5,z:-80.71,yaw:Math.PI,y:4.05,w:3.6},
 {id:'alder-bakery',text:'IRONWOOD BAKERY',bg:'#7a3b2e',awning:'awning',x:17.75,z:-80.71,yaw:Math.PI,y:3.55,sy:0.92,w:3.2},
 {id:'alder-barber',text:'IRONWOOD BARBER',bg:'#2c4a63',awning:'awning',x:57.0,z:-62.5,awningX:57.28,yaw:-Math.PI/2,y:3.60,sy:0.92,w:3.2}
];
const CANOPY_SCALE={'overhang-wide':1.72,'overhang':1.40,'awning-wide':1.24,'awning':1.0};
const awningSpot=(prop,fx,fz,yaw,syOverride)=>{const hz=PROPS[prop].footprint.z1,west=yaw===-Math.PI/2,sy=syOverride||CANOPY_SCALE[prop]||1;return {prop,x:+(fx-(west?hz:0)).toFixed(2),y:PAVED,z:+(fz-(west?0:hz)).toFixed(2),yaw,sy}};
export const DOWNTOWN_DETAILS=[
 {prop:'parasol-a',x:40.5,y:PAVED,z:-104,yaw:0},
 {prop:'parasol-b',x:40.5,y:PAVED,z:-114,yaw:Math.PI/3},
 {prop:'parasol-a',x:12.5,y:PAVED,z:-103,yaw:Math.PI/5},
 {prop:'parasol-b',x:12.5,y:PAVED,z:-115,yaw:-Math.PI/4},
 ...DOWNTOWN_LANDMARKS.map(l=>{const west=l.yaw===-Math.PI/2,front=PROPS[l.prop].footprint.z1,ov=DOWNTOWN_OVERRIDES[l.id],off=ov?.offset||0;
  return awningSpot(AWNINGS[l.id],l.x-(west?front:off),l.z+(west?off:-front),l.yaw,ov?.sy)}),
 ...LEGACY_FRONTS.map(f=>awningSpot(f.awning,f.awningX??f.x,f.z,f.yaw,f.sy))
];
export const HOTEL_LANDMARKS=[
 {id:'ironwood-hotel',prop:'shop-l',zone:'alder',x:23.5,z:-125.31,yaw:0},
 {id:'ironwood-hotel-w',prop:'shop-g',zone:'alder',x:14.1,z:-123.39,yaw:0},
 {id:'ironwood-hotel-e',prop:'shop-f',zone:'alder',x:32.4,z:-123.82,yaw:0}
];
export const HOTEL_PROPERTIES=[
 {id:'ironwood-hotel',type:'commercial',landmark:'ironwood-hotel',name:'The Ironwood Hotel',hours:[0,1440],access:'public',owner:null,exteriorDoor:true},
 {id:'ironwood-hotel-w',type:'commercial',landmark:'ironwood-hotel-w',name:'Ironwood Hotel West Wing',enterable:false,reason:'Guest rooms are reached from the hotel lobby.'},
 {id:'ironwood-hotel-e',type:'commercial',landmark:'ironwood-hotel-e',name:'Ironwood Hotel East Wing',enterable:false,reason:'Guest rooms are reached from the hotel lobby.'}
];
export const HOTEL_POSTS=[
 {id:'ironwood-hotel',at:{property:'ironwood-hotel'},role:'Receptionist',hours:[420,1380]}
];
export const DOWNTOWN_SIGNS=[
 ...DOWNTOWN_LANDMARKS.map(l=>{const west=l.yaw===-Math.PI/2,front=PROPS[l.prop].footprint.z1+0.06,[text,bg]=SIGN_COLORS[l.id],h=PROPS[l.prop].height,ov=DOWNTOWN_OVERRIDES[l.id],off=ov?.offset||0;
  return {id:l.id,text,bg,fg:'#f4ead2',x:+(l.x-(west?front:off)).toFixed(2),y:ov?.signY||(h<5?4.15:4.75),z:+(l.z+(west?off:-front)).toFixed(2),yaw:l.yaw,w:3.2,h:0.64}}),
 ...LEGACY_FRONTS.map(f=>{const west=f.yaw===-Math.PI/2;return {id:f.id,text:f.text,bg:f.bg,fg:'#f4ead2',x:+(f.x-(west?0.06:0)).toFixed(2),y:f.y,z:+(f.z-(west?0:0.06)).toFixed(2),yaw:f.yaw,w:f.w,h:0.64}}),
 {id:'ironwood-hotel',text:'THE IRONWOOD HOTEL',bg:'#22383b',fg:'#f4ead2',x:23.5,y:4.2,z:-119.62,yaw:0,w:5.2,h:0.78}
];
