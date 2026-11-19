// GPS rules (pure, no DOM, no three.js): routes over the road graph (MAP.roads, roadRoute/nearestRoad in map-definition.js) as a drawable polyline with turn steps, progress along it, off-route detection with a cooldown, arrival, one tapped pin snapped to a road, and a job target that routes by itself (with an off switch). Implements the handoff entry GPS (stage GP1). Nothing here uses time or randomness except the dt you pass in.
import {MAP,roadGraph,roadRoute,nearestRoad} from './map-definition.js';

export const ARRIVE_RADIUS=25; // m (straight line to the destination) at which the trip ends
export const OFF_ROUTE=40; // m from the route line before it is worked out again
export const REROUTE_COOLDOWN=4; // s between two reroutes (a route is four short Dijkstra runs: keep it rare)
export const TURN_MIN_DEG=35; // a junction bends the heading by less than this: not a turn
export const UTURN_DEG=150;
export const TURN_WINDOW=18; // m before and after a junction used to read the heading
export const PIN_MAX_SNAP=150; // m: a tapped point farther than this from every road is refused
export const START_LINK=4; // m: the player is joined to the road by a short line only when farther than this

const cumOf=P=>{const c=[0];for(let i=1;i<P.length;i++)c.push(c[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));return c};
const edgeCum=new WeakMap();
const cumOfEdge=E=>{let c=edgeCum.get(E);if(!c){c=cumOf(E.poly);edgeCum.set(E,c)}return c};
function pointAt(P,c,s){if(s<=0)return [P[0][0],P[0][1]];const n=P.length;if(s>=c[n-1])return [P[n-1][0],P[n-1][1]];let i=1;while(i<n-1&&c[i]<s)i++;const t=(s-c[i-1])/Math.max(1e-9,c[i]-c[i-1]);return [P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t]}
// The points of an edge between two distances along it (either order).
function sliceEdge(E,sa,sb){const P=E.poly,c=cumOfEdge(E),lo=Math.min(sa,sb),hi=Math.max(sa,sb),mid=[];for(let i=0;i<P.length;i++)if(c[i]>lo+1e-6&&c[i]<hi-1e-6)mid.push([P[i][0],P[i][1]]);const out=[pointAt(P,c,lo),...mid,pointAt(P,c,hi)];return sa<=sb?out:out.reverse()}
const legAt=(E,s)=>E.legs.find(l=>s>=l.s0-1e-6&&s<=l.s1+1e-6)||E.legs[E.legs.length-1];
const legSpan=(E,from,to,length)=>{const l=E.legs.find(l=>Math.abs(l.length-length)<1e-3&&l.from===from&&l.to===to)||E.legs.find(l=>Math.abs(l.length-length)<1e-3&&l.from===to&&l.to===from);if(!l)return null;return l.from===from&&l.to===to?[l.s0,l.s1]:[l.s1,l.s0]};

// Nearest road point to a tapped point: {x,z,edge,s,d} or null when there is no road within PIN_MAX_SNAP.
export function snapPin(x,z,map=MAP){const r=nearestRoad(x,z,map);return r&&r.d<=PIN_MAX_SNAP?{x:r.x,z:r.z,edge:r.edge,s:r.s,d:r.d}:null}

// A route from a point to a point: {points:[[x,z]..], cum:[m..], length, turns:[{s,kind,angle}], direct, edges:[..]} or null. turns ends with {kind:'arrive'}. `direct` is true when no road joins the two (a straight line, no turns).
export function buildRoute(from,to,map=MAP){
 const g=roadGraph(map),a=nearestRoad(from.x,from.z,map),b=nearestRoad(to.x,to.z,map);
 const straight=()=>{const pts=[[from.x,from.z],[to.x,to.z]],cum=cumOf(pts);return {points:pts,cum,length:cum[1],turns:[{s:cum[1],kind:'arrive',angle:0}],direct:true,edges:[]}};
 if(!a||!b)return straight();
 const Ea=g.edges[a.edge],Eb=g.edges[b.edge],la=legAt(Ea,a.s),lb=legAt(Eb,b.s);
 const pieces=[]; // each piece: points of one road stretch; the join between two pieces is a junction
 if(Ea===Eb&&la===lb)pieces.push(sliceEdge(Ea,a.s,b.s));
 else{
  let best=null;
  for(const sn of [{node:la.from,s:la.s0},{node:la.to,s:la.s1}])for(const en of [{node:lb.from,s:lb.s0},{node:lb.to,s:lb.s1}]){
   const r=sn.node===en.node?{legs:[],time:0}:roadRoute(sn.node,en.node,map);if(!r)continue;
   const cost=Math.abs(a.s-sn.s)/Ea.speed+r.time+Math.abs(en.s-b.s)/Eb.speed;
   if(!best||cost<best.cost)best={cost,sn,en,r}}
  if(!best)return straight();
  pieces.push(sliceEdge(Ea,a.s,best.sn.s));
  for(const l of best.r.legs){const E=g.edges[l.edge],sp=legSpan(E,l.from,l.to,l.length);if(!sp)return straight();pieces.push(sliceEdge(E,sp[0],sp[1]))}
  pieces.push(sliceEdge(Eb,best.en.s,b.s))}
 const points=[],cuts=[];
 const push=p=>{const q=points[points.length-1];if(!q||Math.hypot(q[0]-p[0],q[1]-p[1])>1e-6)points.push(p)};
 if(Math.hypot(from.x-a.x,from.z-a.z)>START_LINK)push([from.x,from.z]);
 const cumNow=()=>{let s=0;for(let i=1;i<points.length;i++)s+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);return s};
 pieces.forEach((pc,k)=>{for(const p of pc)push(p);if(k<pieces.length-1)cuts.push(cumNow())});
 if(Math.hypot(to.x-b.x,to.z-b.z)>START_LINK)push([to.x,to.z]);
 if(points.length<2)push([to.x+.01,to.z]);
 const cum=cumOf(points),length=cum[cum.length-1];
 const turns=[];
 for(const s of cuts){
  const p0=pointAt(points,cum,Math.max(0,s-TURN_WINDOW)),p1=pointAt(points,cum,s),p2=pointAt(points,cum,Math.min(length,s+TURN_WINDOW));
  const h1=[p1[0]-p0[0],p1[1]-p0[1]],h2=[p2[0]-p1[0],p2[1]-p1[1]];
  if(Math.hypot(...h1)<1||Math.hypot(...h2)<1)continue;
  const ang=Math.atan2(h1[0]*h2[1]-h1[1]*h2[0],h1[0]*h2[0]+h1[1]*h2[1])*180/Math.PI; // + = right (north is -z, so east then south is a right turn)
  if(Math.abs(ang)<TURN_MIN_DEG)continue;
  turns.push({s,kind:Math.abs(ang)>=UTURN_DEG?'uturn':ang>0?'right':'left',angle:Math.round(ang)})}
 turns.push({s:length,kind:'arrive',angle:0});
 return {points,cum,length,turns,direct:false,edges:[...new Set([a.edge,b.edge])]};
}

// Where you are on a route: {along, off (m from the line), remaining, next:{kind,dist,angle}}. hint = the last `along`, so a route that doubles back is not mixed up.
export function routeProgress(route,x,z,hint=0){
 const P=route.points,c=route.cum;let best=null;
 const scan=(lo,hi)=>{for(let i=0;i<P.length-1;i++){if(c[i+1]<lo||c[i]>hi)continue;const ax=P[i][0],az=P[i][1],dx=P[i+1][0]-ax,dz=P[i+1][1]-az,l2=dx*dx+dz*dz,t=l2>0?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2)):0,px=ax+dx*t,pz=az+dz*t,d=Math.hypot(x-px,z-pz);if(!best||d<best.d)best={d,s:c[i]+t*Math.sqrt(l2),i}}};
 scan(hint-40,hint+250);if(!best||best.d>15)scan(-1,Infinity);
 const along=best?best.s:0,next=route.turns.find(t=>t.s>along+3)||route.turns[route.turns.length-1];
 return {along,off:best?best.d:Infinity,remaining:Math.max(0,route.length-along),segment:best?best.i:0,next:{kind:next.kind,dist:Math.max(0,next.s-along),angle:next.angle}};
}

export const fmtDist=m=>m<10?'now':m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(1)+' km';
const ARROW={left:'←',right:'→',uturn:'↶',arrive:'⚑',straight:'↑'};
const WORD={left:'Turn left',right:'Turn right',uturn:'Make a U-turn',arrive:'Arrive'};
// The row for the vehicle panel: {arrow, text} (or null with no route). Distances are rounded to 10 m so the panel only redraws now and then.
export function hudRow(route,prog,rerouting=false){
 if(!route)return null;
 if(rerouting)return {arrow:'↻',text:'Rerouting…'};
 if(route.direct)return {arrow:ARROW.straight,text:'No road: straight line, '+fmtDist(prog?prog.remaining:route.length)};
 if(!prog)return {arrow:ARROW.straight,text:'Route '+fmtDist(route.length)};
 const n=prog.next;
 return {arrow:ARROW[n.kind]||ARROW.straight,text:n.kind==='arrive'?'Arrive in '+fmtDist(prog.remaining):WORD[n.kind]+(n.dist<10?' now':' in '+fmtDist(n.dist))+' · '+fmtDist(prog.remaining)+' to go'};
}

// The GPS state machine. One destination at a time: a tapped pin (wins) or the active job's target (when `auto` is on). update(dt,pos) once per frame is cheap; a route is only built when the destination changes or after an off-route cooldown.
export function createGps({map=MAP,build=buildRoute}={}){
 const s={dest:null,source:null,pin:null,auto:true,job:null,jobKey:null,doneKey:null,route:null,prog:null,need:false,cool:REROUTE_COOLDOWN,rerouting:false,last:null};
 const key=p=>p?Math.round(p.x)+','+Math.round(p.z):null;
 function pick(){ // the destination that should be active now
  if(s.pin){s.dest={x:s.pin.x,z:s.pin.z};s.source='pin';s.need=true;return}
  if(s.auto&&s.job&&s.jobKey!==s.doneKey){s.dest={x:s.job.x,z:s.job.z};s.source='job';s.need=true;return}
  s.dest=null;s.source=null;s.route=null;s.prog=null;s.need=false;s.rerouting=false}
 const api={
  get dest(){return s.dest},get source(){return s.source},get pin(){return s.pin},get auto(){return s.auto},get route(){return s.route},get progress(){return s.prog},get rerouting(){return s.rerouting},get active(){return !!s.dest},
  get hud(){return hudRow(s.route,s.prog,s.rerouting)},
  // What the minimap draws: the route from your place on it onward ({points, from, start}) or null. One small array per call.
  get ahead(){return s.route&&s.prog?{points:s.route.points,from:s.prog.segment+1,start:pointAt(s.route.points,s.route.cum,s.prog.along)}:null},
  // A tapped point: snapped to the nearest road; replaces any earlier pin. {pin} or {error}.
  setPin(x,z){const q=snapPin(x,z,map);if(!q)return {error:'No road near there.'};s.pin={x:q.x,z:q.z};pick();return {pin:s.pin}},
  clear(){s.pin=null;if(s.source==='job')s.doneKey=s.jobKey;pick()}, // the "Clear" button: ends a pin, or a job route (until the job target changes)
  setAuto(on){s.auto=!!on;pick();return s.auto},
  // The active job's target (a point) or null; called every frame, cheap.
  setJobTarget(p){const k=key(p);if(k===s.jobKey&&!!p===!!s.job)return;s.job=p?{x:p.x,z:p.z}:null;if(k!==s.jobKey)s.doneKey=null;s.jobKey=k;if(!s.pin)pick()},
  // Per frame. Returns null or an event: 'routed', 'rerouted', 'arrived'.
  update(dt,pos){
   s.last=pos;if(!s.dest)return null;s.cool+=dt;
   if(s.need){s.route=build(pos,s.dest,map);s.need=false;s.cool=0;s.rerouting=false;s.prog=routeProgress(s.route,pos.x,pos.z,0);return 'routed'}
   if(Math.hypot(pos.x-s.dest.x,pos.z-s.dest.z)<ARRIVE_RADIUS){const was=s.source;if(was==='job')s.doneKey=s.jobKey;s.pin=null;pick();return 'arrived'}
   s.prog=routeProgress(s.route,pos.x,pos.z,s.prog?s.prog.along:0);
   if(s.prog.off>OFF_ROUTE){s.rerouting=true;if(s.cool>=REROUTE_COOLDOWN){s.route=build(pos,s.dest,map);s.cool=0;s.rerouting=false;s.prog=routeProgress(s.route,pos.x,pos.z,0);return 'rerouted'}}else s.rerouting=false;
   return null}
 };
 return api;
}
