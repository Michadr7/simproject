// The phone's GPS screen (stage GP1, handoff entry GPS): a second map (the same drawing as the corner map, made the first time the screen opens), a tap drops one pin that snaps to the nearest road, a Clear button, and the job auto-route switch. The rules live in gps.js; game.js owns the GPS state and calls update() every frame while the phone is open.
import {createMinimap} from './minimap.js';
import {fmtDist} from './gps.js';
export function createPhoneGps({document:doc,gps,mapOptions={}}){
 const $=id=>doc.getElementById(id);let map=null,shown=false,lastText='';
 const text=()=>{const d=gps.dest,r=gps.route,p=gps.progress;if(!d)return gps.auto?'No destination. Tap the map to drop a pin; a job you start routes by itself.':'No destination. Tap the map to drop a pin. Job routes are off.';
  const what=gps.source==='pin'?'Your pin':'Your job';return what+(r&&p?(r.direct?': no road reaches it, straight line ':': ')+fmtDist(p.remaining)+' to go.':'.')};
 const paint=()=>{const t=text(),s=$('gpsStatus');if(s&&t!==lastText){lastText=t;s.textContent=t}const a=$('gpsAuto');if(a)a.textContent='Job routes: '+(gps.auto?'on':'off');const c=$('gpsClear');if(c)c.disabled=!gps.active};
 function show(){shown=true;if(!map){const canvas=$('gpsMap');if(canvas)map=createMinimap(doc,{canvas,startSize:'large',fixedDpr:1,...mapOptions})}paint()}
 function hide(){shown=false}
 const msg=t=>{const m=$('phoneMessage');if(m)m.textContent=t};
 if($('gpsMap'))$('gpsMap').onclick=e=>{if(!map)return;const p=map.pick(e.clientX,e.clientY);if(!p)return;const r=gps.setPin(p.x,p.z);msg(r.error||'Pin dropped on the nearest road.');paint()};
 if($('gpsClear'))$('gpsClear').onclick=()=>{gps.clear();msg('Route cleared.');paint()};
 if($('gpsAuto'))$('gpsAuto').onclick=()=>{gps.setAuto(!gps.auto);msg(gps.auto?'Jobs you start will be routed.':'Job routes are off.');paint()};
 // Every frame while the phone is open: redraws the map at its own 12 fps.
 function update(dt,view){if(!shown||!map)return;paint();map.update(dt,{...view,markers:[],route:gps.ahead,pin:gps.pin})}
 return {show,hide,update,get shown(){return shown}};
}
