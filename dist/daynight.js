// The day and night rig, the pure part (notes/visual-overhaul-design.md): everything the picture needs from the clock is one function of the game minutes
// (routine.minutes, 0 to 1440, 30 game minutes per real minute), so it can be tested without a renderer. No three.js, no DOM.
// sky.js applies it to the scene (one directional light for sun and moon, the hemisphere light, fog, the sky dome, the stars) and installs the colour grade.
// Colours in MOODS are sRGB hex; everything skyAt returns is LINEAR rgb (0 to 1 arrays), mixed in linear space.
const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a*(1-t)+b*t;
export const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

export const SUNRISE=360,SUNSET=1080;               // 06:00 and 18:00: the sun's height is sin of the clock angle, as it always was
export const NIGHT_FLOOR=.12,NIGHT_FLOOR_MIN=.04,NIGHT_FLOOR_MAX=.30; // unlit night light as a share of day; the dev slider moves it, players never see it
export const EXPOSURE_MIN=.5,EXPOSURE_MAX=2;        // the dev exposure slider multiplies the mood's exposure by this much
export const FOG_FAR_MAX=155;                       // scenery is culled at 158 m (tests/culling.mjs): fog must end at or before that
export const MIN_LIGHT_ELEVATION=8;                 // degrees: the light used for shading never comes from lower than this (no endless shadows)
export const DAY_FROM=.10,DAY_FULL=.45;             // sun height where day starts to mix in and where it is all day (07:47 to 16:13)
export const NIGHT_FROM=-.08,NIGHT_FULL=-.4226;     // sun height where night starts to mix in and where it is all night: 19:40 to 04:20 (sin 25 degrees)
const TILT_UP=.82,TILT_SOUTH=.57;                   // the sun's circle leans 35 degrees to the south (+z): 55 degrees high at noon

// ── The four moods (all tune). Night's two strengths are the DAY values: skyAt multiplies them by NIGHT_FLOOR. ─────────────
export const MOODS={
 dawn: {top:'#5b7fa8',horizon:'#f2b98f',light:'#ffc48a',lightStrength:1.6,hemiSky:'#d6cfe0',hemiGround:'#6b5f52',hemiStrength:1.4,fogNear:40,fogFar:130,exposure:1.05,stars:0,glow:.6},
 day:  {top:'#4f8fd0',horizon:'#bcd6e2',light:'#fff1d6',lightStrength:3.1,hemiSky:'#d8e8f0',hemiGround:'#777655',hemiStrength:1.7,fogNear:65,fogFar:155,exposure:1.12,stars:0,glow:0},
 dusk: {top:'#3d4f86',horizon:'#f08a4b',light:'#ff9a55',lightStrength:1.8,hemiSky:'#d9b9c2',hemiGround:'#5c4a45',hemiStrength:1.3,fogNear:45,fogFar:135,exposure:1.05,stars:0,glow:.7},
 night:{top:'#070b1c',horizon:'#18233f',light:'#b4c8ff',lightStrength:3.1,hemiSky:'#8fa3dc',hemiGround:'#2a3450',hemiStrength:1.7,fogNear:30,fogFar:120,exposure:1.0,stars:1,glow:1},
};
export const MOOD_NAMES=['dawn','day','dusk','night'],COLOUR_KEYS=['top','horizon','light','hemiSky','hemiGround'],NUMBER_KEYS=['fogNear','fogFar','exposure','stars','glow'];
export const toLinear=hex=>{const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255].map(v=>{const c=v/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)})};
const LIN=Object.fromEntries(MOOD_NAMES.map(name=>[name,Object.fromEntries(COLOUR_KEYS.map(k=>[k,toLinear(MOODS[name][k])]))]));
const blend3=(w,key)=>{const out=[0,0,0];for(const name of MOOD_NAMES){const c=LIN[name][key],k=w[name];out[0]+=c[0]*k;out[1]+=c[1]*k;out[2]+=c[2]*k}return out};
const blend=(w,key)=>MOOD_NAMES.reduce((sum,name)=>sum+MOODS[name][key]*w[name],0);

export const wrapMinutes=minutes=>Number.isFinite(minutes)?((minutes%1440)+1440)%1440:720;
export const clampNightFloor=v=>Number.isFinite(v)?clamp(v,NIGHT_FLOOR_MIN,NIGHT_FLOOR_MAX):NIGHT_FLOOR;
export const clampExposureScale=v=>Number.isFinite(v)?clamp(v,EXPOSURE_MIN,EXPOSURE_MAX):1;
// Sun height, -1 to 1: 0 at 06:00 and 18:00, 1 at noon, -1 at midnight.
export const sunHeight=minutes=>Math.sin((wrapMinutes(minutes)-SUNRISE)/1440*TAU);
// Unit vector towards the sun: rises in the east (+x), stands in the south (+z) at noon, sets in the west. The moon is the opposite point of the sky.
export function sunDirection(minutes){const a=(wrapMinutes(minutes)-SUNRISE)/1440*TAU,x=Math.cos(a),y=Math.sin(a)*TILT_UP,z=Math.sin(a)*TILT_SOUTH,l=Math.hypot(x,y,z);return [x/l,y/l,z/l]}
export const moonDirection=minutes=>sunDirection(minutes).map(v=>-v);
// How much of each mood: always sums to 1. The twilight share is dawn before noon and dusk after; it is 0 at noon and at midnight, so the swap is never seen.
export function moodAt(minutes){
 const m=wrapMinutes(minutes),h=sunHeight(m),day=smoothstep(DAY_FROM,DAY_FULL,h),night=smoothstep(NIGHT_FROM,NIGHT_FULL,h),twilight=Math.max(0,1-day-night);
 return {dawn:m<720?twilight:0,day,dusk:m<720?0:twilight,night};
}
// The light direction used for shading: whichever body is up, lifted so it is never under MIN_LIGHT_ELEVATION. It flips at the horizon, where the light's strength is 0.
export function lightDirection(minutes){
 const s=sunDirection(minutes),d=s[1]>=0?s:s.map(v=>-v),min=Math.sin(MIN_LIGHT_ELEVATION*Math.PI/180);
 if(d[1]>=min)return d;
 const flat=Math.hypot(d[0],d[2])||1,k=Math.sqrt(1-min*min)/flat;return [d[0]*k,min,d[2]*k];
}

// Everything a frame needs. options: nightFloor (0.04 to 0.30), exposureScale (0.5 to 2). The same minutes and options always give the same answer.
export function skyAt(minutes,options={}){
 const m=wrapMinutes(minutes),h=sunHeight(m),w=moodAt(m),nightFloor=clampNightFloor(options.nightFloor??NIGHT_FLOOR),exposureScale=clampExposureScale(options.exposureScale??1);
 // The one directional light. Above the horizon it is the sun (twilight and day colours); below, the moon (the night colour, day strength x NIGHT_FLOOR). Both fade to 0 at the horizon.
 const twilight=m<720?'dawn':'dusk',dayShare=w.day,up=h>=0;
 const sunColour=LIN[twilight].light.map((c,i)=>mix(c,LIN.day.light[i],dayShare)),sunStrength=mix(MOODS[twilight].lightStrength,MOODS.day.lightStrength,dayShare)*smoothstep(0,.10,h);
 const moonStrength=MOODS.night.lightStrength*nightFloor*smoothstep(0,.25,-h);
 // The hemisphere light carries twilight. Night's share is scaled by NIGHT_FLOOR.
 const hemiStrength=MOODS.dawn.hemiStrength*w.dawn+MOODS.day.hemiStrength*w.day+MOODS.dusk.hemiStrength*w.dusk+MOODS.night.hemiStrength*nightFloor*w.night;
 return {
  minutes:m,sunHeight:h,weights:w,nightFloor,
  sunDir:sunDirection(m),moonDir:moonDirection(m),lightDir:lightDirection(m),
  lightColor:up?sunColour:LIN.night.light.slice(),lightStrength:up?sunStrength:moonStrength,
  hemiSky:blend3(w,'hemiSky'),hemiGround:blend3(w,'hemiGround'),hemiStrength,
  top:blend3(w,'top'),horizon:blend3(w,'horizon'),                        // horizon is also the fog colour, so distance fades into the sky
  fogNear:blend(w,'fogNear'),fogFar:Math.min(FOG_FAR_MAX,blend(w,'fogFar')),
  exposure:blend(w,'exposure')*exposureScale,
  stars:blend(w,'stars'),glow:blend(w,'glow'),                            // glow: how far lamps and windows are on (Stage 3 reads it)
  sunDisc:smoothstep(-.03,.03,h),moonDisc:smoothstep(.05,.2,-h),          // how visible each body is in the dome
  sunGlow:(w.dawn+w.dusk)*smoothstep(-.35,-.02,h),                         // the warm lobe on the horizon around the sun at dawn and dusk
 };
}

// ── The colour grade: a fixed curve inside the tone-mapping step (three.js CustomToneMapping), so every material gets it with no extra pass. ──
// Order, on linear colour after exposure x gain: split tone (shadows to blue, highlights to warm), saturation (dark things lose colour), a soft shoulder (white at GRADE.white).
// The numbers live here once: grade() is the JavaScript twin of the GLSL that gradeGLSL() writes, and tests/daynight.mjs checks both carry the same constants.
export const GRADE={gain:1.6,white:3,luma:[.2126,.7152,.0722],shadowTint:[.86,.96,1.12],shadowEnd:.35,highTint:[1.06,1,.92],highStart:.4,highEnd:1.2,satLow:.75,satHigh:1.12,satEnd:.25};
export function grade(rgb,exposure=1){
 const G=GRADE,luma=c=>c[0]*G.luma[0]+c[1]*G.luma[1]+c[2]*G.luma[2];
 let c=rgb.map(v=>Math.max(0,v)*exposure*G.gain);
 const l=luma(c),shadow=1-smoothstep(0,G.shadowEnd,l),high=smoothstep(G.highStart,G.highEnd,l);
 c=c.map((v,i)=>v*mix(1,G.shadowTint[i],shadow)*mix(1,G.highTint[i],high));
 const sat=mix(G.satLow,G.satHigh,smoothstep(0,G.satEnd,l)),grey=luma(c);
 c=c.map(v=>Math.max(0,mix(grey,v,sat)));
 return c.map(v=>clamp(v*(1+v/(G.white*G.white))/(1+v),0,1));
}
const f=v=>Number.isInteger(v)?v+'.0':String(v),v3=a=>`vec3( ${a.map(f).join(', ')} )`;
export function gradeGLSL(){
 const G=GRADE;
 return `vec3 CustomToneMapping( vec3 color ) {
	color = max( vec3( 0.0 ), color ) * toneMappingExposure * ${f(G.gain)};
	float l = dot( color, ${v3(G.luma)} );
	float shadow = 1.0 - smoothstep( 0.0, ${f(G.shadowEnd)}, l );
	float high = smoothstep( ${f(G.highStart)}, ${f(G.highEnd)}, l );
	color *= mix( vec3( 1.0 ), ${v3(G.shadowTint)}, shadow ) * mix( vec3( 1.0 ), ${v3(G.highTint)}, high );
	float sat = mix( ${f(G.satLow)}, ${f(G.satHigh)}, smoothstep( 0.0, ${f(G.satEnd)}, l ) );
	color = max( vec3( 0.0 ), mix( vec3( dot( color, ${v3(G.luma)} ) ), color, sat ) );
	color = color * ( 1.0 + color / ${f(G.white*G.white)} ) / ( 1.0 + color );
	return saturate( color );
}`;
}
// What an upward-facing matt surface of this (linear) colour looks like under the rig, before the grade: three.js's own sum for a hemisphere and a directional light.
export function litGround(sky,albedo){const cos=Math.max(0,sky.lightDir[1]);return albedo.map((a,i)=>a*(sky.hemiSky[i]*sky.hemiStrength+sky.lightColor[i]*sky.lightStrength*cos)/Math.PI)}
