// Schedule-aware Oak Street Apartments elevator directory, residential floors & hallway knocking (Phase B).
import {ROSTER,KNOCK_LINES,OSCAR_DOOR_STRANGER} from './npc-roster.js';
import {canVisit,isSick,tierFor} from './npc-life.js';

export const OAK_FLOORS=Object.freeze([2,3,4]);
export const STUDIO_DOOR_X=3.0;

const FLOOR_LAYOUT=Object.freeze({
 2:{floor:2,doorX:-3.0},
 7:{floor:3,doorX:-4.2},
 8:{floor:3,doorX:0},
 9:{floor:3,doorX:4.2},
 10:{floor:4,doorX:-2.8},
 11:{floor:4,doorX:2.8}
});

const FLOOR_LABELS=Object.freeze({
 2:'Floor 2 · Unit 2 (Sophie) & Studio 2B',
 3:'Floor 3 · Units 7–9 (Elena, Noah, Oscar)',
 4:'Floor 4 · Units 10–11 (Lincoln, Brentster)'
});

export const OAK_UNITS=Object.freeze(
 ROSTER.filter(r=>r.home==='dwelling:oak-apartments'&&r.flat).map(r=>{
  const unit=r.flat.split('/')[1],lay=FLOOR_LAYOUT[Number(unit)]||{floor:3,doorX:0};
  return {
   id:r.id,
   personId:r.personId,
   unit,
   floor:lay.floor,
   doorX:lay.doorX,
   name:r.name,
   role:r.role
  };
 })
);

export const unitsOnFloor=floor=>OAK_UNITS.filter(u=>u.floor===floor).sort((a,b)=>a.doorX-b.doorX);
export const floorLabel=floor=>FLOOR_LABELS[floor]||('Floor '+floor);

const ACT_LABEL={
 sleep:'Asleep',
 home:'At home',
 work:'At work',
 shop:'Out running errands',
 outside:'Out on the street',
 travel:'Walking across town',
 away:'Out of town'
};

export function unitStatus(unit,progress,plan){
 const m=((Math.floor(progress?.routine?.minutes||0)%1440)+1440)%1440;
 const day=progress?.housing?.day||1;
 const npc=progress?.npcs?.[unit.id];
 const sick=isSick(npc,day);
 const b=Array.isArray(plan)?plan.find(x=>m>=x.from&&m<x.to):null;
 const act=b?.act||'home';
 const status=sick&&act==='home'?'Home (sick)':(ACT_LABEL[act]||'At home');
 const tier=tierFor(progress?.standing,unit.id);
 const visit=canVisit(unit.id,tier,m,plan,{sick});
 return {...unit,act,status,tier,visit,sick};
}

export function oakElevatorUnits({progress,planOf,otherPlayers=[]}={}){
 const day=progress?.housing?.day||1;
 const list=[
  {kind:'studio',id:'studio',label:progress?.housing?.rented?'Floor 2 · Studio 2B (Your Apartment)':'Floor 2 · Studio 2B (Rent at Desk first)',locked:!progress?.housing?.rented}
 ];
 for(const u of OAK_UNITS){
  const plan=typeof planOf==='function'?(planOf(u.personId,day)||planOf(u.id,day)):null;
  const info=unitStatus(u,progress,plan);
  list.push({kind:'npc',...info,label:`Unit ${info.unit} · ${info.name} (${info.status})`});
 }
 for(const p of otherPlayers){
  if(p?.name)list.push({kind:'player',id:'player:'+p.id,label:`Floor 5 · ${p.name}'s Studio (Co-op)`,player:p});
 }
 return list;
}

export function hallwayKnockOutcome(unit,progress,plan){
 const m=((Math.floor(progress?.routine?.minutes||0)%1440)+1440)%1440;
 const day=progress?.housing?.day||1;
 const b=Array.isArray(plan)?plan.find(x=>m>=x.from&&m<x.to):null;
 const act=b?.act||'home';
 const sick=isSick(progress?.npcs?.[unit?.id],day);
 const tier=tierFor(progress?.standing,unit?.id);
 if(act!=='home'&&act!=='sleep')return {home:false,asleep:false,answered:false,act,tier,reason:'not-home',text:"There's nobody home."};
 if(act==='sleep')return {home:true,asleep:true,answered:false,act,tier,reason:'asleep',text:"There's nobody answering — the lights are off. They must be asleep."};
 if(sick)return {home:true,asleep:false,answered:false,act,tier,reason:'sick',text:KNOCK_LINES.sick[0]};
 return {home:true,asleep:false,answered:true,act,tier,reason:null,text:`${unit?.name||'Someone'} opens the door.`};
}

export function knockMessage(unit,visitResult){
 if(visitResult?.allowed){
  return visitResult.inside
   ?`${unit.name} opens the door wide: "Come on in, good to see you!"`
   :`${unit.name} cracks the door open: "Oh, hey there. What brings you by?"`;
 }
 const r=visitResult?.reason||'unknown';
 if(unit.id==='oscar'&&r==='stranger')return OSCAR_DOOR_STRANGER;
 const lines=KNOCK_LINES[r]||KNOCK_LINES.unknown;
 return lines[0].replace('{name}',unit.name);
}
