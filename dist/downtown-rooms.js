// Ironwood downtown building services and interior helpers (stage 3: enterable & useful buildings).
import {WHOLESALE_INTERIOR} from './shops.js';
import {GAME_NAME} from './game-name.js';

export const DOWNTOWN_INTERIOR=Object.freeze({...WHOLESALE_INTERIOR,origin:Object.freeze({x:480,y:.165,z:1500})});

export const DOWNTOWN_SERVICES=Object.freeze({
 'ironwood-arcade':{
  role:'Attendant',
  greeting:'Welcome to Ironwood Arcade & Lounge! Ready to beat the high score?',
  actions:[
   {id:'arcade-play',label:'Play Arcade Cabinet · $2.00 (+20 Energy, +2 Standing)',cost:200,energy:20,repBoost:2,minutes:20,msg:'New high score at the cabinet! (+20 energy, +2 standing)'},
   {id:'arcade-soda',label:'Buy Cold Soda · $2.00',item:'soda'}
  ]
 },
 'ironwood-florist':{
  role:'Florist',
  greeting:'Fresh blooms cut this morning!',
  actions:[
   {id:'florist-bouquet',label:'Buy Gift Bouquet · $12.00',item:'bouquet',cost:1200,repBoost:1,msg:'Picked up a Fresh Bouquet — gift it to any neighbour to boost standing!'}
  ]
 },
 'ironwood-post-office':{
  role:'Postal clerk',
  greeting:'Ironwood Post Office — mail and parcels.',
  actions:[
   {id:'post-check',label:'Check town mail & deliveries',cost:0,kind:'mail',msg:'Mail checked.'},
   {id:'post-card',label:'Send a town postcard · $2.00',cost:200,repBoost:1,msg:'Postcard sent (+1 town standing).'}
  ]
 },
 'alder-hardware':{
  role:'Sales clerk',
  greeting:`Tools and supplies for every job in ${GAME_NAME}.`,
  actions:[
   {id:'hw-repair',label:'Buy Repair Kit · $40.00',item:'repair-kit'},
   {id:'hw-gas',label:'Buy Gas Can · $15.00',item:'gas-can'},
   {id:'hw-axe',label:'Buy Axe · $20.00',item:'axe'}
  ]
 },
 'ironwood-furniture':{
  role:'Sales clerk',
  greeting:'Quality furniture for Cedar Heights & Studio 2B.',
  actions:[
   {id:'furn-decor',label:'Home Comfort Upgrade · $25.00',cost:2500,repBoost:2,energy:15,msg:'Picked up home furnishings (+2 standing, energy +15).'}
  ]
 },
 'eden-ridge-gazette':{
  role:'Editor',
  greeting:`The ${GAME_NAME} Gazette — what is the word on the street?`,
  actions:[
   {id:'gazette-read',label:'Read today’s headlines',cost:0,kind:'news'},
   {id:'gazette-tip',label:'Submit a town tip · earn $5.00',pay:500,msg:'Editor: Great scoop! Here is $5.00 for the tip.'}
  ]
 },
 'ironwood-town-hall':{
  role:'Town clerk',
  greeting:'Ironwood Town Hall — civic services and records.',
  actions:[
   {id:'hall-bills',label:'Pay Studio 2B bills in person',cost:0,kind:'bills'},
   {id:'hall-record',label:'Check town standing & properties',cost:0,kind:'civic'}
  ]
 },
 'ironwood-clinic':{
  role:'Receptionist',
  greeting:'Ironwood Clinic — let us get you back on your feet.',
  actions:[
   {id:'clinic-checkup',label:'Full Health Checkup · $15.00',cost:1500,fullRestore:true,msg:'Clean bill of health! Food, Thirst, and Energy restored to 100%.'}
  ]
 },
 'ironwood-clothes':{
  role:'Sales clerk',
  greeting:'Fresh styles & all-weather coats at Ironwood Clothes!',
  actions:[
   {id:'clothes-style',label:'Open Wardrobe / Character Creator',cost:0,kind:'wardrobe'},
   {id:'clothes-jacket',label:'Buy Basic Jacket · $15.00',item:'basic-jacket'},
   {id:'clothes-rain',label:'Buy Rain Shell · $45.00',item:'rain-shell'},
   {id:'clothes-parka',label:'Buy Winter Parka · $85.00',item:'winter-parka'}
  ]
 }
});

const EXTRA_IRONWOOD=new Set(['alder-store','alder-offices','alder-tower','alder-bakery','alder-barber','alder-pharmacy','alder-bank','police-station','alder-books','alder-cinema','eastbank-gas-kiosk','kaspian-harbor','kaspian-chandlery','kaspian-shack','eden-hall-a','eden-outdoors']);
export const isDowntownShop=id=>Object.prototype.hasOwnProperty.call(DOWNTOWN_SERVICES,id)||EXTRA_IRONWOOD.has(id);

export function downtownOpen(property,routine){
 if(!property?.hours||!routine)return true;
 const m=routine.minutes??0,[a,b]=property.hours;
 return m>=a&&m<b;
}
