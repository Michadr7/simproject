// GD4 wind (notes/ground-detail-design.md section 2c): one shared wind (direction, strength, gusts, per-position sway phase) as pure functions of game time, for the cover shader (uniforms) or the CPU (chaff, later trees); no DOM, no three.js.
export const TAU=Math.PI*2;
export const WIND_BASE={dx:.97,dz:.243,lean:.03,sway:.02,gust:.04,speed:1.7,k:.54}; // same numbers as menu-scene-rules COVER_WIND (lean/sway/gust metres at bend 1, speed rad/s, k = wave number along the wind, |(.45,.3)|)
export const WIND_DIR_DRIFT=[[.35,53,0],[.15,17,1]]; // [amplitude rad, period s, phase]: the wind direction wanders slowly around its base
export const WIND_GUST_MAX=1; // windGust returns 0..1
export const WIND_STRENGTH=[.7,.3]; // overall strength = [.7 + .3*gust] x weather
export const WIND_PHASE_CELL=2, WIND_PHASE_JITTER=.9; // sway phase offset per 2 m cell (radians x TAU x .9): neighbouring tufts do not move in lockstep
export const WIND_KIND_MUL=Object.freeze({grass:1,tallgrass:1.2,clover:.5,fern:.9,flower:1.1,bush:.6,pebble:0,rock:0,mushroom:0,reed:1.8,crop:1.3}); // design: reeds x1.8, crop x1.3
export const WIND_MAX_DT=5, WIND_WEATHER_TAU=3; // one frame step is clamped to 5 s (a tab-away must not jump); weather strength eases with time constant 3 s
const sat=v=>v<0?0:v>1?1:v;
const num=(v,d)=>Number.isFinite(v)?v:d;
// Wind gusts 0..1 (same curve as menu-scene-rules gust).
export const windGust=t=>.5+.3*Math.sin(num(t,0)*TAU/7.5)+.2*Math.sin(num(t,0)*TAU/3.1+2);
// Direction angle in radians at time t (base direction plus slow drift).
export function windAngle(t){t=num(t,0);let a=Math.atan2(WIND_BASE.dz,WIND_BASE.dx);for(let i=0;i<WIND_DIR_DRIFT.length;i++){const d=WIND_DIR_DRIFT[i];a+=d[0]*Math.sin(t*TAU/d[1]+d[2])}return a}
// The whole wind at time t, written into `out` (no allocation): {dx,dz,gust,strength,t}. `weather` 0..2 multiplies the strength (calm 0, storm 2).
export function windSample(t,out,weather=1){t=num(t,0);const g=windGust(t),a=windAngle(t);out.dx=Math.cos(a);out.dz=Math.sin(a);out.gust=g;out.strength=(WIND_STRENGTH[0]+WIND_STRENGTH[1]*g)*Math.min(2,Math.max(0,num(weather,1)));out.t=t;return out}
export const makeWind=()=>({dx:1,dz:0,gust:0,strength:0,t:0});
// Per-position sway phase 0..TAU (hash of a 2 m cell, bilinear so it is continuous): a shader can use the same arithmetic.
const fract=x=>x-Math.floor(x);
const cellHash=(x,y)=>{let a=fract(x*.1031),b=fract(y*.1031),c=fract(x*.1031);const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);a+=d;b+=d;c+=d;return fract((a+b)*c)}; // Hoskins hash12, as ground-rules hash2
export function swayPhase(x,z){x=num(x,0)/WIND_PHASE_CELL;z=num(z,0)/WIND_PHASE_CELL;const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz),a=cellHash(ix,iz),b=cellHash(ix+1,iz),c=cellHash(ix,iz+1),d=cellHash(ix+1,iz+1);
 return (a+(b-a)*sx+(c-a)*sz+(a-b-c+d)*sx*sz)*TAU*WIND_PHASE_JITTER}
// How far (metres) a vertex with `bend` 0..1 (0 at the root, 1 at the tip) at ground spot x,z is pushed, along the wind. `wind` is a windSample result. `mul` is the kind multiplier (WIND_KIND_MUL). Bend is squared so roots stay put; the sway wave runs downwind. Returns the signed distance along (wind.dx, wind.dz); `out` (optional) gets the x,z push.
export function windBend(wind,x,z,bend,mul=1,out=null){x=num(x,0);z=num(z,0);const W=WIND_BASE,b=sat(num(bend,0)),g=wind.gust,ph=wind.t*W.speed-(x*wind.dx+z*wind.dz)*W.k+swayPhase(x,z)*.35;
 const m=b*b*(W.lean*g+(W.sway+W.gust*g)*Math.sin(ph))*wind.strength*num(mul,1)/.85; // /.85: the strength averages .85 at weather 1, so a mean wind gives the menu's amplitudes
 if(out){out.x=wind.dx*m;out.z=wind.dz*m}return m}
// The four numbers a shader needs per frame, written into a Float32Array/array: [dx, dz, strength, gust].
export function windUniform(wind,arr){arr[0]=wind.dx;arr[1]=wind.dz;arr[2]=wind.strength;arr[3]=wind.gust;return arr}
// A running clock for the game loop: advance it once per frame with the real dt. Time is the sum of the steps (clamped), so the result does not depend on the frame rate; the weather strength eases to its target with an exact exponential.
export const makeWindClock=()=>({t:0,weather:1,target:1});
export function advanceWindClock(clock,dt){dt=num(dt,0);if(dt<=0)return clock;if(dt>WIND_MAX_DT)dt=WIND_MAX_DT;clock.t+=dt;clock.weather=clock.target+(clock.weather-clock.target)*Math.exp(-dt/WIND_WEATHER_TAU);return clock}
export const setWindWeather=(clock,w)=>{clock.target=Math.min(2,Math.max(0,num(w,1)));return clock};
