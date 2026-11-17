// The people of the town on screen (0.35.11, DESIGN 4.20 A2). Draws buildPopulation's people where schedule.js says they are (npc-walk.js does the maths).
// The six Oak Street pedestrians (neighborhood.js: Alex, Sophie, Robert, Julia, Carlos, Megan) are population people too: their avatars are driven from their plan here instead of walking to and fro.
// Everyone else is drawn with a small pool of characters, only within `radius` metres of the player; a person who is not drawn costs a plan lookup, and the position is a function of the time, so it is right when you return.
// planOf(personId, day) -> plan replaces schedule.planOf (W-D3: npc-dialogue.js createRosterPlanner wraps the named NPCs in namedPlan: sick people stay home).
// exclude lists people someone else already draws (Hal Brennan, hal.js). Not drawn: people indoors, asleep, in a car (no NPC car system yet) or off the map. Needs three.js (the characters), so it is not unit tested; npc-walk.js is.
import {MAP} from './map-definition.js';
import {WALK_SPEED,placePoint} from './population.js';
import {personPose,findRoute} from './npc-walk.js';

export const DRAW_RADIUS=120;   // metres: nobody is drawn further from the player than this
export const DRAW_HYSTERESIS=10; // someone already drawn stays until this much further
export const POOL=9;            // characters shared by everyone who is not one of the six (6 + 9 = 15 skinned characters at most)
export const ROUTES_PER_FRAME=1; // route searches per frame (a search is a few milliseconds at worst)
export const PERSONAL_SPACE=1.1; // a person steps aside when the player is closer than this
export const SEPARATION=.8;       // metres: two drawn people are never closer than this (drawing only: the plan does not change)
const TURN_RATE=8;               // 1/s: how fast the heading eases to the path direction
const HIDE_Y=-50;
const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};

export function createNpcCrowd({scene,createCharacter,outfit,population,schedule,pedestrians=[],blocked,cost=null,groundAt=null,map=MAP,radius=DRAW_RADIUS,pool=POOL,exclude=[],planOf=null}){
 const bounds=map.playable,points=new Map(),routes=new Map(),placedX=[],placedZ=[];let budget=ROUTES_PER_FRAME,hidden=false;
 const point=place=>{if(!points.has(place))points.set(place,placePoint(place,map));return points.get(place)};
 const route=(from,to)=>{const key=from+'>'+to;if(routes.has(key))return routes.get(key);
  const a=point(from),b=point(to);if(!a||!b){routes.set(key,null);return null}
  if(budget<=0)return null; // later this frame or the next
  budget--;const r=findRoute(a,b,{blocked,cost,bounds});routes.set(key,r);return r};
 const ctx={point,route};
 const named=new Map(pedestrians.map(p=>[p.name,p]));
 const entries=population.people.filter(p=>!exclude.includes(p.name)).map(person=>({person,named:named.get(person.name)||null,slot:null,shown:false,yaw:0,ox:0,oz:0,pose:{state:'hidden',x:0,z:0,yaw:NaN,moving:false,walked:0}}));
 for(const e of entries)if(e.named)e.named.group.visible=false; // the six start drawn at their old lanes (neighborhood.js); the plan decides when they appear, so nobody stands frozen outside while the schedule has them indoors
 const slots=[];for(let i=0;i<pool;i++){const avatar=createCharacter(outfit('male','Casual_2',{}));avatar.group.visible=false;avatar.group.position.y=HIDE_Y;scene.add(avatar.group);slots.push({avatar,owner:null,id:null})}
 const lookOf=person=>outfit(person.body,person.workOutfit||person.outfit,{skin:person.skin,hair:person.hair});
 function show(e,x,z,dt,player){
  const avatar=e.named||e.slot.avatar,g=avatar.group,p=e.pose;
  if(!e.shown){e.shown=true;e.ox=e.oz=0;g.visible=true;if(Number.isFinite(p.yaw))e.yaw=p.yaw;else if(!e.named)e.yaw=(e.person.id.length*1.7)%6.28}
  if(p.moving&&Number.isFinite(p.yaw))e.yaw+=wrap(p.yaw-e.yaw)*(1-Math.exp(-dt*TURN_RATE));
  // step aside from the player (drawing only: the plan does not change)
  const dx=x-player.x,dz=z-player.z,d=Math.hypot(dx,dz),push=d<PERSONAL_SPACE&&d>.01?(PERSONAL_SPACE-d)/d:0,k=1-Math.exp(-dt*6);
  // keep apart from the people already placed this frame (flatmates with the same job and the same minute walk the exact same route and stood on top of each other)
  let wx=dx*push,wz=dz*push;
  for(let i=0;i<placedX.length;i++){const sx=x-placedX[i],sz=z-placedZ[i],sd=Math.hypot(sx,sz);if(sd<SEPARATION){if(sd>.05){const m=(SEPARATION-sd)/sd;wx+=sx*m;wz+=sz*m}else{wx+=Math.cos(e.yaw)*SEPARATION;wz-=Math.sin(e.yaw)*SEPARATION}}}
  e.ox+=(wx-e.ox)*k;e.oz+=(wz-e.oz)*k;
  const px=x+e.ox,pz=z+e.oz;placedX.push(px);placedZ.push(pz);g.position.set(px,groundAt?groundAt(px,pz):.165,pz);g.rotation.y=e.yaw;
  avatar.setMotion(p.moving?WALK_SPEED:0);avatar.update(dt);
 }
 function hide(e){
  if(e.named){e.named.group.visible=false;e.shown=false;return}
  if(e.slot){e.slot.avatar.group.visible=false;e.slot.avatar.group.position.y=HIDE_Y;e.slot.owner=null;e.slot=null}e.shown=false;
 }
 return {
  entries,slots,get routeCount(){return routes.size},
  // time: {day, minute} from the game clock. Call once per frame while the player is outdoors.
  update(dt,player,time){
   budget=ROUTES_PER_FRAME;hidden=false;placedX.length=0;placedZ.length=0;
   for(const e of entries){
    const plan=planOf?planOf(e.person.id,time.day):schedule.planOf(e.person.id,time.day);if(!plan)continue;
    personPose(e.pose,plan,time.minute,ctx);
    const p=e.pose;let want=false;
    if(p.state!=='hidden'){const d=Math.hypot(p.x-player.x,p.z-player.z);want=d<(e.shown?radius+DRAW_HYSTERESIS:radius)}
    if(!want){if(e.shown||e.slot)hide(e);continue}
    if(!e.named&&!e.slot){let slot=null;for(let i=0;i<slots.length;i++)if(!slots[i].owner){slot=slots[i];break}if(!slot)continue;slot.owner=e;e.slot=slot;
     if(slot.id!==e.person.id){slot.id=e.person.id;slot.avatar.apply(lookOf(e.person))}}
    show(e,p.x,p.z,dt,player);
   }
  },
  // The player is indoors or in a shop: nothing outside is drawn (and nothing is updated). Cheap to call every frame.
  hideAll(){if(hidden)return;hidden=true;for(const e of entries)if(e.shown||e.slot)hide(e)},
  // W-D3: the drawn people within `range` metres of (x,z) whose person id is in `ids` (a Set of personIds), nearest first, as {id,name,x,z,group,d}, or null when nobody is near (nothing is allocated then). Called from the interaction pass.
  talkable(x,z,range,ids){let out=null;for(const e of entries){if(!e.shown||!ids.has(e.person.id))continue;const px=e.pose.x+e.ox,pz=e.pose.z+e.oz,d=Math.hypot(px-x,pz-z);if(d<range)(out||(out=[])).push({id:e.person.id,name:e.person.name,x:px,z:pz,group:(e.named||e.slot.avatar).group,d})}return out&&out.sort((a,b)=>a.d-b.d)},
  // Debug: who is drawn now, with names.
  drawn:()=>entries.filter(e=>e.shown).map(e=>({name:e.person.name,x:e.pose.x,z:e.pose.z,state:e.pose.state,moving:e.pose.moving,pedestrian:!!e.named}))
 };
}
