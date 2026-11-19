// Objective beacon colours and fade rules (stage OBJ-BEACON). Pure: which colour a marker gets for its purpose, and how strongly the ground glow, the light beam and the pad show at a distance and in daylight.
export const BEACON_KINDS=['pickup','dropoff','shop','story','urgent'];
export const BEACON_COLOURS={pickup:'#f2ca79',dropoff:'#6fdc8c',shop:'#6fb7ff',story:'#ffe9a8',urgent:'#ff5a4a'}; // amber, green, blue, white-gold, red
export const STOP_ZONE=3;      // metres: inside this the beacon is a small pad that never blocks the view
export const BEAM_NEAR=6;      // the beam is gone at this distance and closer
export const BEAM_FAR=40;      // the beam is at full strength from here out
export const GLOW_FULL=12;     // the ground glow is at full strength from here out
export const PAD_MIN=.4;       // padScale inside the stop zone
export const DAY_DIM=.55;      // brightness multiplier in full daylight (night is 1)
export const FLASH_SECONDS=.7; // how long the flash and dissolve at completion lasts
const clamp01=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
const ramp=(v,a,b)=>clamp01((v-a)/(b-a));
// Purpose of a marker. source: the objective resolver kind ('gig' | 'delivery' | 'door' | 'counter' | 'story'), stage: a gig stage ('travel', 'work', 'return'), urgent: a deadline is close.
export function kindOf({source,stage,urgent}={}){
 if(urgent)return 'urgent';
 if(source==='gig')return stage==='return'?'dropoff':'pickup';
 if(source==='delivery')return 'dropoff';
 if(source==='door'||source==='counter'||source==='shop'||source==='work')return 'shop';
 return 'story';
}
export const colourFor=kind=>BEACON_COLOURS[kind]??BEACON_COLOURS.story;
// distance in metres, daylight 0 (night) to 1 (full day). All three values are 0..1 and never fall as the distance grows.
export function fadeFor(distance,daylight=0){
 const d=Number.isFinite(distance)?Math.max(0,distance):0,dim=1-(1-DAY_DIM)*clamp01(daylight);
 return {ringAlpha:clamp01((.5+.5*ramp(d,STOP_ZONE,GLOW_FULL))*dim),beamAlpha:clamp01(ramp(d,BEAM_NEAR,BEAM_FAR)*dim),padScale:PAD_MIN+(1-PAD_MIN)*ramp(d,STOP_ZONE,BEAM_NEAR)};
}
