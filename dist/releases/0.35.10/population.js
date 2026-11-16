// The people of the town (0.35.4, DESIGN 4.20). Pure: no three.js, no DOM, no save.
// Who lives where and who works where is DATA (map-definition.js): every property owned by an NPC and every entry of MAP.dwellings is a home, every entry of MAP.posts is work.
// buildPopulation turns that into people by fixed rules, the same people every time for the same map (MAP.seed), so nothing about them is saved and nobody is placed by hand.
// A new house, block of flats or post in the map fills itself; the people who were already there keep their ids and homes.
// schedule.js gives each person their day. Walking, driving and drawing them is A2 (not built).
import {MAP} from './map-definition.js';
import {OUTFITS,palettes} from './appearance.js';

// ── Numbers (placeholders to tune) ───────────────────────────────────────────
export const HOUSEHOLD_MAX={small:2,medium:3,large:4}; // adults in a house of this `size`; a flat holds 1 or 2
export const FLAT_MAX=2;
export const AT_HOME_SHARE=4;        // one resident in this many holds no job (retired, at home)
export const WALK_SPEED=2.1;         // m/s, the pedestrians' pace (neighborhood.js)
export const DRIVE_SPEED=9;          // m/s in town
export const DETOUR=1.3;             // a route is about this much longer than the straight line (A2 replaces the estimate with real path lengths)
export const DRIVE_OVER=150;         // a trip longer than this (metres of route) is driven by someone who has the household's car
export const WALK_LIMIT=200;         // nobody walks further than this to work (48 game minutes)
export const GAME_MINUTES_PER_SECOND=.5; // the game clock: 30 game minutes per real minute (game.js advanceTime(step*.5))
const EVERYDAY={male:['Casual_Hoodie','Casual_2'],female:['Casual','Formal']};
const FIRST={
 male:['Daniel','Marcus','Owen','Victor','Liam','Henry','Jonas','Felix','Arthur','Samuel','Theo','Malik','Diego','Kenji','Peter','Ravi','Anton','Caleb','Elliot','Bruno'],
 female:['Hannah','Lucia','Nora','Ivy','Clara','Maya','Elise','Ruth','Amara','Sofia','Dana','Iris','Leila','Tessa','Mina','Paula','Vera','Joan','Naomi','Greta']
};
const LAST=['Carver','Holt','Marsh','Okafor','Lindqvist','Baptiste','Sato','Moreno','Keane','Dalton','Ferreira','Novak','Abbott','Quinn','Rahman','Vance','Petrov','Hale','Ibarra','Sterling','Mercer','Tanaka','Boone','Castillo'];

// A stable 32-bit hash of the parts (FNV-1a with a final mix): the only source of "chance" here, so the town is the same on every load and on every player's machine.
export function hashOf(...parts){let h=2166136261;for(const ch of parts.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0}
const pick=(list,...key)=>list[hashOf(...key)%list.length];

// ── Places ───────────────────────────────────────────────────────────────────
// A place is a string: 'property:house-r2', 'dwelling:oak-apartments', 'shop:market', 'office:ridgeline-office', 'zone:forest', 'plot:I5' or 'away:east' (off the map, by that exit).
export const placeKind=place=>place.slice(0,place.indexOf(':'));
export const placeId=place=>place.slice(place.indexOf(':')+1);
export const isAway=place=>typeof place==='string'&&place.startsWith('away:');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// The middle of the side of a plot that faces its street, `out` metres outside it.
function plotFront(plot,out=1){const mx=(plot.x0+plot.x1)/2,mz=(plot.z0+plot.z1)/2;
 return plot.facing==='north'?{x:mx,z:plot.z0-out}:plot.facing==='south'?{x:mx,z:plot.z1+out}:plot.facing==='east'?{x:plot.x1+out,z:mz}:{x:plot.x0-out,z:mz}}
// Where a place meets the street: the point a person walks or drives to (and from). An ESTIMATE for distances and for A2 to start from: a house's point is the street end of its front path,
// a building on a plot is the middle of the plot's street side, a building without a plot is 8 m in front of its model, a zone is its middle. A2 may pass exact door points instead.
export function placePoint(place,map=MAP){
 const kind=placeKind(place),id=placeId(place);
 if(kind==='dwelling'){const d=(map.dwellings||[]).find(x=>x.id===id);return d?{x:d.door.x,z:d.door.z}:null}
 if(kind==='shop'){const s=map.shops[id];return s?{x:s.x,z:s.z}:null}
 if(kind==='office'){const o=(map.offices||[]).find(x=>x.id===id);return o?{x:(o.door.out||o.door).x,z:(o.door.out||o.door).z}:null}
 if(kind==='zone'){const z=map.zones.find(x=>x.id===id);return z?{x:(z.bounds.x0+z.bounds.x1)/2,z:(z.bounds.z0+z.bounds.z1)/2}:null}
 if(kind==='plot'){const p=(map.reserved||[]).find(x=>x.id===id);return p?plotFront(p):null}
 if(kind==='away'){const e=(map.exits||[]).find(x=>x.id===id);if(!e)return null;const [x,z]=e.in[0];return {x:clamp(x,map.playable.x0,map.playable.x1),z:clamp(z,map.playable.z0,map.playable.z1)}}
 if(kind==='property'){const p=(map.properties||[]).find(x=>x.id===id);if(!p)return null;
  const plot=p.plot&&(map.reserved||[]).find(x=>x.id===p.plot);
  if(plot?.path){const r=plot.path,mx=(r.x0+r.x1)/2,mz=(r.z0+r.z1)/2;return plot.facing==='north'?{x:mx,z:r.z0}:plot.facing==='south'?{x:mx,z:r.z1}:plot.facing==='east'?{x:r.x1,z:mz}:{x:r.x0,z:mz}}
  if(plot)return plotFront(plot);
  const l=p.landmark&&(map.landmarks||[]).find(x=>x.id===p.landmark);return l?{x:l.x+Math.sin(l.yaw)*8,z:l.z+Math.cos(l.yaw)*8}:null}
 return null;
}
const metresBetween=(a,b,map)=>{const p=placePoint(a,map),q=placePoint(b,map);return p&&q?Math.hypot(p.x-q.x,p.z-q.z)*DETOUR:Infinity};
// One trip: how far, how (walk or drive) and how many game minutes. Someone who drives takes the car for anything over DRIVE_OVER and always to or from out of town.
export function tripOf(from,to,person,map=MAP){
 if(from===to)return {metres:0,mode:'walk',minutes:0};
 const metres=metresBetween(from,to,map),drive=!!person?.drives&&(metres>DRIVE_OVER||isAway(from)||isAway(to));
 return {metres,mode:drive?'drive':'walk',minutes:Math.max(2,Math.ceil(metres/(drive?DRIVE_SPEED:WALK_SPEED)*GAME_MINUTES_PER_SECOND))};
}
const postPlace=at=>at.shop?'shop:'+at.shop:at.office?'office:'+at.office:at.property?'property:'+at.property:at.zone?'zone:'+at.zone:'plot:'+at.plot;
function nearestExit(point,map){let best=null,bd=Infinity;for(const e of map.exits||[]){const p=placePoint('away:'+e.id,map),d=Math.hypot(p.x-point.x,p.z-point.z);if(d<bd){bd=d;best=e}}return best}

// ── The town ─────────────────────────────────────────────────────────────────
// Returns {people, households, posts}.
//   person    {id, name, body, outfit, workOutfit, skin, hair, resident, home, household, post, role, employer, work, hours, drives}
//             home and work are places; a commuter's home is 'away:<exit>', someone who works out of town has work 'away:<exit>'; hours are the post's [from, to) or null
//   household {id, home, members:[person id], car, driver}     (driver: the one member who uses the car, or null)
//   post      {id, post, place, role, employer, hours, holder} (one per person a MAP.posts entry needs; holder is a person id)
export function buildPopulation(map=MAP){
 const seed=map.seed,people=[],households=[],used=new Set();
 // every name the data fixes is taken before anyone is generated, so a generated person never borrows it
 for(const p of map.properties||[])if(p.owner?.type==='npc')used.add(p.owner.name);
 for(const d of map.dwellings||[])for(const r of d.residents||[])used.add(r.name);
 for(const p of map.posts||[])if(p.person)used.add(p.person.name);
 const outfitFor=(body,wanted,id)=>OUTFITS[body].some(o=>o[0]===wanted)?wanted:pick(EVERYDAY[body],seed,id,'outfit');
 function makePerson(id,given={},surname){
  const body=given.body||pick(['male','female'],seed,id,'body');
  let name=given.name;
  for(let salt=0;!name;salt++){const n=pick(FIRST[body],seed,id,'first',salt)+' '+(surname||pick(LAST,seed,id,'last',salt));if(!used.has(n)||salt>200){name=n;used.add(n)}}
  const p={id,name,body,outfit:outfitFor(body,given.outfit,id),workOutfit:null,skin:pick(palettes.skin,seed,id,'skin')[1],hair:pick(palettes.hair,seed,id,'hair')[1],
   resident:true,home:null,household:null,post:null,role:null,employer:null,work:null,hours:null,drives:false};
  people.push(p);return p;
 }
 function household(id,home,size,car,head,surname){
  const h={id,home,members:[],car,driver:null};households.push(h);
  for(let n=1;n<=size;n++){const p=makePerson(id+'#'+n,n===1?head:{},surname);p.home=home;p.household=id;h.members.push(p.id)}
 }
 // 1. Homes: every NPC-owned property, then every dwelling's flats.
 for(const p of map.properties||[]){if(p.owner?.type!=='npc')continue;
  const plot=p.plot&&(map.reserved||[]).find(x=>x.id===p.plot),max=HOUSEHOLD_MAX[p.size]||HOUSEHOLD_MAX.small;
  household(p.id,'property:'+p.id,1+hashOf(seed,p.id,'size')%max,!!plot?.park||p.type==='farm',p.owner,p.owner.name.split(' ').pop())}
 for(const d of map.dwellings||[]){
  const order=[...Array(d.units).keys()].sort((a,b)=>hashOf(seed,d.id,a,'car')-hashOf(seed,d.id,b,'car')||a-b),withCar=new Set(order.slice(0,d.cars));
  for(let u=0;u<d.units;u++){const head=(d.residents||[])[u],id=d.id+'/'+(u+1);
   household(id,'dwelling:'+d.id,1+hashOf(seed,id,'size')%FLAT_MAX,withCar.has(u),head||{},head?null:pick(LAST,seed,id,'family'))}}
 const residents=people.slice(),houseOf=p=>households.find(h=>h.id===p.household);
 // 2. Work: one slot per person a post needs.
 const posts=(map.posts||[]).flatMap(post=>[...Array(post.count||1).keys()].map(n=>({id:(post.count||1)>1?post.id+'#'+(n+1):post.id,post:post.id,place:postPlace(post.at),role:post.role,employer:post.employer||null,hours:[...post.hours],holder:null})));
 const dataOf=slot=>map.posts.find(p=>p.id===slot.post);
 const give=(slot,p)=>{const post=dataOf(slot);slot.holder=p.id;p.post=slot.id;p.role=slot.role;p.employer=slot.employer;p.work=slot.place;p.hours=[...slot.hours];
  p.workOutfit=post.outfit&&OUTFITS[p.body].some(o=>o[0]===post.outfit)?post.outfit:null};
 // whether this person can get from home to the place: on foot within WALK_LIMIT, or with the household's car if nobody else in the household uses it
 const reach=(p,place)=>{const metres=metresBetween(p.home,place,map),h=houseOf(p);if(metres<=WALK_LIMIT)return {metres,car:false};return h.car&&(!h.driver||h.driver===p.id)?{metres,car:true}:null};
 const takeCar=p=>{houseOf(p).driver=p.id;p.drives=true};
 const commuter=(slot,given={})=>{const post=dataOf(slot),exit=nearestExit(placePoint(slot.place,map),map),p=makePerson('commuter:'+slot.id,{outfit:post.outfit,...given});
  p.resident=false;p.home='away:'+exit.id;p.drives=true;give(slot,p)};
 // 2a. named posts: the resident of that name, else that person drives in from out of town
 for(const slot of posts){const who=dataOf(slot).person;if(!who)continue;const r=residents.find(p=>p.name===who.name);
  if(!r){commuter(slot,who);continue}
  const way=reach(r,slot.place);give(slot,r);if(way?.car||(!way&&houseOf(r).car&&!houseOf(r).driver))takeCar(r)}
 // 2b. one resident in AT_HOME_SHARE holds no job; every other post goes to the nearest free resident who can get there; what is left is a commuter's
 const idle=p=>hashOf(seed,p.id,'idle')%AT_HOME_SHARE===0;
 for(const slot of posts){if(slot.holder)continue;
  const best=residents.filter(p=>!p.post&&!idle(p)).map(p=>({p,way:reach(p,slot.place)})).filter(c=>c.way).sort((a,b)=>a.way.metres-b.way.metres||(a.p.id<b.p.id?-1:1))[0];
  if(!best){commuter(slot);continue}
  give(slot,best.p);if(best.way.car)takeCar(best.p)}
 // 2c. residents still without work: with a free household car they work out of town, the others stay home
 for(const p of residents){if(p.post||idle(p))continue;const h=houseOf(p);if(!h.car||h.driver)continue;
  const exit=nearestExit(placePoint(p.home,map),map);if(!exit)continue;takeCar(p);p.work='away:'+exit.id;p.role='Works out of town'}
 return {people,households,posts};
}
let town=null;
// The population of the game's own map, built once.
export const townPopulation=()=>town||(town=buildPopulation(MAP));
export const personById=(pop,id)=>pop.people.find(p=>p.id===id)||null;
export const residentsOf=(pop,home)=>pop.people.filter(p=>p.home===home);
export const staffOf=(pop,place)=>pop.people.filter(p=>p.post&&p.work===place);
export const employeesOf=(pop,employer)=>pop.people.filter(p=>p.employer===employer);
