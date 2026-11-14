// Night lights, the pure part (notes/visual-overhaul-design.md, section 14): when lamps, windows and headlights are on and how strong, as functions of the day and night
// rig (daynight.js skyAt) and of plain data. No three.js, no DOM: tests/night-lights.mjs checks every rule. night-lights.js and vehicle-lights.js draw what these say.
// Nothing here is a real light: lamps, windows and vehicle lamps glow (emissive materials, additive sprites and ground patches). The one real light is the player's own
// headlight (a SpotLight), High quality only, in the scene only while it is dark.
import {smoothstep,wrapMinutes} from './daynight.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a*(1-t)+b*t;

// ── When it is dark ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// The switch follows the sun's height: lamps start to come on 28 game minutes before sunset (17:32) and are fully on 11 minutes after it (18:11); the mirror image at sunrise.
// The STRENGTH then grows with the night share (daynight.js weights.night): BASE_LEVEL of full at sunset, full once it is all night (19:40 to 04:20).
export const SWITCH_FROM=.12,SWITCH_FULL=-.05,BASE_LEVEL=.45,DARK_AT=.5,SHOW_FROM=.02;
export const lightSwitch=sunHeight=>smoothstep(SWITCH_FROM,SWITCH_FULL,sunHeight);
// sky: what skyAt returns (sunHeight and weights.night are read). 0 by day, 1 in full night.
export const lightLevel=sky=>{const on=lightSwitch(sky.sunHeight);return on*mix(BASE_LEVEL,1,clamp(sky.weights?.night??0,0,1))};
export const isDark=sky=>lightSwitch(sky.sunHeight)>DARK_AT; // 17:52 to 06:08: windows may be lit, headlights on auto come on
export const GLOW_SCALE_MIN=.25,GLOW_SCALE_MAX=3; // the dev panel's "Lights" slider multiplies every glow by this much
export const glowScale=v=>Number.isFinite(v)?clamp(v,GLOW_SCALE_MIN,GLOW_SCALE_MAX):1;

// ── Street lamps ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Heads: the emissive strength of the lamp-head material (0.55 by day, as it always was). Halo: a soft round sprite at each head. Pool: a round patch of light on the ground.
// poolLift: the patches float this far above the ground's height, more than a kerb (0.185 m): a patch that spans a kerb or a raised yard would otherwise cut under the higher side.
export const LAMP={headDay:.55,headNight:2.6,colour:'#ffdf9e',haloSize:2.6,haloStrength:.5,haloDrop:.25,poolRadius:7,poolStrength:.13,poolLift:.2,poolRings:6,poolSegments:24};
export const lampHeadGlow=level=>mix(LAMP.headDay,LAMP.headNight,clamp(level,0,1));
// A round ground patch as flat data: vertices [dx, dz, strength] (strength 1 in the middle, 0 at the rim: nothing is seen where it ends) and triangle indices.
export function poolShape(radius=LAMP.poolRadius,rings=LAMP.poolRings,segments=LAMP.poolSegments){
 const vertices=[[0,0,1]],indices=[];
 for(let r=1;r<=rings;r++){const k=r/rings,s=(1-k)*(1-k);for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;vertices.push([Math.cos(a)*radius*k,Math.sin(a)*radius*k,s])}}
 for(let i=0;i<segments;i++)indices.push(0,1+(i+1)%segments,1+i);
 for(let r=1;r<rings;r++){const a=1+(r-1)*segments,b=a+segments;for(let i=0;i<segments;i++){const j=(i+1)%segments;indices.push(a+i,a+j,b+i,a+j,b+j,b+i)}}
 return {vertices,indices};
}

// ── Windows: the occupied-hours rule ──────────────────────────────────────────────────────────────────────────────────────────
// One answer per building (or per window of the old city's flats) and 10-minute mark; the same id and minute always give the same answer. A2 can replace the hash by
// schedule.js (someone is home and awake) without changing the drawing.
export const WINDOW={colour:'#ffc978',strength:1.25,step:10,lateBy:40,bedFrom:1290,bedSpan:135,morningFrom:330,morningTo:420,morningShare:.4,awayShare:.125,shopHours:[480,1260],officeClose:1170,nightShare:.5};
export function hashOf(text,salt=0){let h=(2166136261^salt)>>>0;const s=String(text);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}h^=h>>>15;h=Math.imul(h,2246822519)>>>0;h^=h>>>13;return (h>>>0)/4294967296}
export const DUSK_MINUTE=1072,DAWN_MINUTE=368; // 17:52 and 06:08: where isDark flips (tests pin them against the rig)
// kind: 'home' (lived in: evening until bedtime, some early mornings, 1 in 8 away), 'shop' (while open and dark; hours [opens, closes)), 'office' (until 19:30; one in two leaves a
// light on all night), 'works' (industrial: one in two keeps a light on all night), 'always' (the police station, the gas kiosk), 'vacant' (never).
// dark: isDark(sky). Nothing is ever lit while it is not dark.
export function windowsLit(id,minutes,{kind='home',dark=true,hours=null}={}){
 if(!dark||kind==='vacant'||!kind)return false;
 const m=wrapMinutes(minutes);
 if(kind==='always')return true;
 if(kind==='shop'){const [open,close]=hours||WINDOW.shopHours;return m>=open&&m<close}
 if(kind==='office')return hashOf(id,3)<WINDOW.nightShare||(m>=DUSK_MINUTE-60&&m<WINDOW.officeClose);
 if(kind==='works')return hashOf(id,4)<WINDOW.nightShare;
 if(hashOf(id,1)<WINDOW.awayShare)return false;                                              // away all night
 const on=DUSK_MINUTE+hashOf(id,2)*WINDOW.lateBy,bed=WINDOW.bedFrom+hashOf(id,5)*WINDOW.bedSpan; // on from dusk, up to 40 minutes late (17:52 to 18:32); bed 21:30 to 23:45
 if(m>=on&&m<bed)return true;
 return hashOf(id,6)<WINDOW.morningShare&&m>=WINDOW.morningFrom+hashOf(id,7)*30&&m<WINDOW.morningTo; // early risers: from 05:30 to 06:00 until it is light
}
// The 10-minute mark the windows are worked out for: they change at most every 20 real seconds.
export const windowBucket=minutes=>Math.floor(wrapMinutes(minutes)/WINDOW.step)*WINDOW.step;
// What kind of building a landmark is, from the map's data: its prop model and its entry in MAP.properties (or none). held: the player rents or owns it.
// A house nobody lives in stays dark until the player takes it. Farm barns, huts, logs and parked cars have no windows to light: null.
export function buildingKind(landmark,property=null,held=false){
 const prop=landmark?.prop||'';
 if(landmark?.decor)return null;
 if(prop.startsWith('house-'))return property&&property.owner===null&&!held?'vacant':'home';
 if(prop.startsWith('industrial-'))return landmark.id==='eastbank-gas-kiosk'?'always':'works';
 if(prop.startsWith('shop-')||prop==='store'){const type=property?.type;return type==='civic'?'always':type==='commercial'?'office':'shop'}
 return null;
}
// Which texels of a building's colour texture are window glass (sRGB bytes). The Kenney kits paint every window from one light-blue gradient strip of a small palette
// texture (#cbe4fe at the top to #6c98db at the bottom; houses, shops and industrial units: measured, section 14); nothing else on those models uses it. The flat swatches
// beside it (#d0e8ff, #6794d9) are not glass. The Store model has its own texture and is left dark for now.
export const isGlass=(r,g,b)=>b>=215&&r>=105&&r<=206&&g>=150&&g<=230&&b-r>=48;
export const GLASS_PROPS=prop=>/^(house|shop|industrial)-/.test(prop);
// The emissive mask of a texture: rgba bytes in, rgba bytes out (white where the glass is, black elsewhere) and how many texels are glass.
export function glassMaskBytes(rgba){const bytes=new Uint8Array(rgba.length);let count=0;for(let i=0;i+3<rgba.length;i+=4){const on=isGlass(rgba[i],rgba[i+1],rgba[i+2]);if(on)count++;bytes[i]=bytes[i+1]=bytes[i+2]=on?255:0;bytes[i+3]=255}return {bytes,count}}

// ── Vehicles ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// mode: the driver's switch, 'auto' (on when dark), 'on', 'off'. Key L cycles it for the vehicle you drive; it goes back to auto when you get out and is never saved.
// A vehicle nobody is using is always dark, whatever the switch says.
export const LIGHT_KEY='KeyL',LIGHT_MODES=Object.freeze(['auto','on','off']);
export const nextLightMode=mode=>LIGHT_MODES[(Math.max(0,LIGHT_MODES.indexOf(mode))+1)%LIGHT_MODES.length];
export function headlightsOn({inUse=false,dark=false,mode='auto'}={}){return !!inUse&&(mode==='on'||(mode!=='off'&&!!dark))}
export const lightsLabel=(mode,on)=>`Lights: ${LIGHT_MODES.includes(mode)?mode:'auto'}${mode==='auto'||!LIGHT_MODES.includes(mode)?on?' (on)':' (off)':''}`;
// How bright a vehicle's lamps and beam are: with the night, but never under DAY_BEAM when the driver switched them on by day.
export const DAY_BEAM=.5;
export const vehicleGlow=level=>Math.max(DAY_BEAM,clamp(level,0,1));
// A vehicle that moved within the last HOLD seconds counts as in use (the customer and dock trucks: lit while they drive, dark once parked).
export const MOVING_HOLD=1.5,MOVING_SPEED=.2;
// Lamp spots in the vehicle's own frame (metres; +z is forward, y from the ground under it), one side: the other is mirrored in x. First guesses from the models' shapes.
export const VEHICLE_LAMPS=Object.freeze({
 worktruck:{front:{x:.72,y:1.05,z:3.02},rear:{x:.85,y:.8,z:-3.02}},
 offroad:{front:{x:.6,y:1.08,z:2.82},rear:{x:.88,y:1.12,z:-2.68}},
 flatbed:{front:{x:1,y:.86,z:4.47},rear:{x:1.2,y:1,z:-4.32}},
});
export const LAMP_SPRITE={frontSize:.9,rearSize:.6,front:[1,.95,.8],rear:[1,.12,.08],frontStrength:1.1,rearStrength:.8};
// size: {hx, hz, height} (vehicle.js CLASSES and the prop's height). A model without its own entry gets lamps from its size.
export function lampPoints(model,size={}){
 const own=VEHICLE_LAMPS[model],hx=size.hx||1,hz=size.hz||2.2,h=size.height||1.5;
 const f=own?.front||{x:hx*.66,y:h*.4,z:hz+.02},r=own?.rear||{x:hx*.74,y:h*.42,z:-hz-.02};
 return {front:[[-f.x,f.y,f.z],[f.x,f.y,f.z]],rear:[[-r.x,r.y,r.z],[r.x,r.y,r.z]]};
}
// The beam on the ground: a fan from BEAM.start ahead of the nose, BEAM.length long, widening from near to far; brightest near the vehicle, nothing at its end and its sides.
// Returns vertices [lx, lz, strength] in the vehicle's frame (rows + 1 rows of 3: left edge, middle, right edge) and triangle indices. The same for every vehicle but for hz.
export const BEAM={start:1.2,length:15,nearWidth:2.2,farWidth:7,rows:5,strength:.2,colour:[1,.93,.74],spotShare:.45};
export const BEAM_VERTICES=(BEAM.rows+1)*3,BEAM_INDICES=BEAM.rows*12;
export function beamShape(hz=2.2){
 const vertices=[],indices=[];
 for(let r=0;r<=BEAM.rows;r++){const k=r/BEAM.rows,z=hz+BEAM.start+BEAM.length*k,w=mix(BEAM.nearWidth,BEAM.farWidth,k)/2,s=r===0?0:(1-k)*(1-k)*(r===1?.85:1);vertices.push([-w,z,0],[0,z,s],[w,z,0])}
 for(let r=0;r<BEAM.rows;r++){const a=r*3,b=a+3;indices.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2)}
 return {vertices,indices};
}
// The player's own headlight on High: ONE SpotLight. It is put in the scene the first time it is needed in the dark and taken out again when day comes or the quality drops
// to Low (each of the two costs one shader recompile, a hitch the user accepted); while it is dark and the lamps are merely switched off it stays in, at strength 0.
export const SPOT={colour:'#fff2d0',intensity:420,distance:48,angle:.42,penumbra:.6,decay:2,height:1.1,aimDrop:.9,aimAhead:14};
export function spotlightPlan({high=false,on=false,level=0,present=false}={}){
 if(!high||level<=SHOW_FROM)return {present:false,intensity:0};
 if(on)return {present:true,intensity:SPOT.intensity*clamp(level,0,1)};
 return {present:!!present,intensity:0};
}
