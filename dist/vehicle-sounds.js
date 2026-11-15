// SND1: the real recorded sounds for driving (pure rules, tested; audio.js plays them). Files live in dist/assets/sounds/ (Ogg Vorbis, mono) and are recorded in ASSETS.md (all CC0).
// Nothing here touches Web Audio. If a file is missing or will not decode, audio.js keeps the generated sound.
import {PHONE_CLIPS} from './phone-calls.js';
import {SURFACE} from './terrain.js';
export const SOUND_EXT='.ogg';
// One engine loop per vehicle class (a steady idle, 5 to 6 s, cross-faded to loop). The rpm moves its playbackRate between [idle-ish, top]; the load opens a low-pass.
export const ENGINES=Object.freeze({
 shortbed:{file:'eng-s70',rate:[.75,2.0]},    // Kasumuchi S70: small petrol pickup
 worktruck:{file:'eng-worktruck',rate:[.7,1.6]}, // diesel
 offroad:{file:'eng-offroad',rate:[.75,1.9]},  // V8 pickup
 flatbed:{file:'eng-flatbed',rate:[.7,1.5]}    // big diesel semi
});
export const CRASH_CLIPS=Object.freeze({
 hard:['crash-hard-1','crash-hard-2','crash-hard-3','crash-hard-4'],
 medium:['crash-medium-1','crash-medium-2','crash-medium-3','crash-medium-4'],
 light:['crash-light-1','crash-light-2','crash-light-3','crash-light-4']
});
export const GLASS_CLIPS=Object.freeze(['glass-1','glass-2','glass-3','glass-4']);
export const PERSON_CLIPS=Object.freeze(['thud-person-1','thud-person-2']);
export const SCRAPE_CLIPS=Object.freeze(['scrape-1','scrape-2','scrape-3']); // loops
export const YELL_CLIPS=Object.freeze(['yell-m1','yell-m2','yell-m3','yell-m4','yell-f1','yell-f2','yell-f3','yell-f4']); // each under 1.2 s
export const CRANK_CLIP='start-crank',STALL_CLIP='stall'; // the crank is a loop (played for as long as the starter turns)
// Everything the game can load, with the one-time "vehicle" set (loaded when you first get into a vehicle; the engine loop of the class is loaded on its own).
export const VEHICLE_SET=Object.freeze([CRANK_CLIP,STALL_CLIP,...CRASH_CLIPS.medium,...CRASH_CLIPS.hard,...CRASH_CLIPS.light,...GLASS_CLIPS,...PERSON_CLIPS,...SCRAPE_CLIPS,...YELL_CLIPS]);
// TR6: one tyre loop per kind of ground (mono Ogg, CC0, see ASSETS.md). NOT in VEHICLE_SET: audio.drive() loads only the loop of the ground you are on, the first time you need it.
export const TYRE_CLIPS=Object.freeze({asphalt:'tyres-asphalt',gravel:'tyres-gravel',grass:'tyres-grass',mud:'tyres-mud'});
export const TYRE_FILES=Object.freeze(Object.values(TYRE_CLIPS));
export const ALL_FILES=Object.freeze([...Object.values(ENGINES).map(e=>e.file),...VEHICLE_SET,...PHONE_CLIPS,...TYRE_FILES]); // PH1: the phone clips are registered here too (loaded by audio.phone(), not on entering a vehicle)
// Budgets (tests check the files against them).
export const MAX_FILE_BYTES=60000,MAX_PAYLOAD_BYTES=2000000,MAX_VOICES=12,MAX_YELLS=2,YELL_MAX_SECONDS=1.2;
const ENG_BY_CLASS=new Map(Object.entries(ENGINES).map(([k,v])=>[k,v]));
export const engineFor=cls=>ENG_BY_CLASS.get(cls)||null;

// How a crash sounds. e: a driving.js crash event ({impact (m/s), kind 'world'|'vehicle'|'person', bandTo, changed}). impact is the speed at the hit (counted hits start above 4 m/s).
// Tier: light under 8 m/s, medium to 14, hard above. Glass joins a vehicle or wall hit that leaves the vehicle Damaged or worse and is either the hit that crossed a band or a hard one.
export const LIGHT_MAX=8,MEDIUM_MAX=14,GLASS_FROM=['damaged','limping','wrecked'];
export function tierOf(impact){const v=Math.abs(+impact||0);return v<LIGHT_MAX?'light':v<MEDIUM_MAX?'medium':'hard'}
export function crashPlan(e){
 const tier=tierOf(e.impact),v=Math.abs(+e.impact||0),k=Math.min(1,.45+v/30);
 if(e.kind==='person')return {person:true,tier:'light',thud:{pool:PERSON_CLIPS,gain:.5+.3*Math.min(1,v/12)},crunch:null,glass:null,yell:true};
 const glass=GLASS_FROM.includes(e.bandTo)&&(!!e.changed||tier==='hard');
 return {person:false,tier,thud:null,crunch:{pool:CRASH_CLIPS[tier],gain:k*(e.kind==='vehicle'?1.05:1)},glass:glass?{pool:GLASS_CLIPS,gain:.5+.3*Math.min(1,v/20),delay:.04}:null,yell:false};
}
// Picks from a pool without repeating the last pick (last: the previous index or -1). Returns the index.
export function pickIndex(length,random,last=-1){if(length<=1)return 0;let i=Math.floor(random()*length);if(i>=length)i=length-1;if(i===last)i=(i+1+Math.floor(random()*(length-1)))%length;return i}

// The yell: a vehicle moving faster than MIN_SPEED within RADIUS metres of a walker; the walker then stays quiet for COOLDOWN seconds. Volume falls with distance.
export const YELL={minSpeed:4,radius:4,cooldown:8};
export const yellVolume=d=>d>=YELL.radius?0:Math.max(.25,1-Math.max(0,d)/YELL.radius);
// A gate that remembers when each person last yelled. scan() returns the nearest eligible walker as a reused {id,d,vol} (or null): no allocation per frame beyond the first.
export function createYellGate(cfg=YELL){
 const last=new Map(),hit={id:'',d:0,vol:0};
 return {
  last,
  // now: seconds; (vx,vz,speed): the vehicle; people: [{name, group:{position:{x,z}}}] or [{id,x,z}]. Marks the returned person as having yelled at `now`.
  scan(now,vx,vz,speed,people){
   if(!people||Math.abs(speed)<cfg.minSpeed)return null;
   let best=null,bd=cfg.radius;
   for(let i=0;i<people.length;i++){const p=people[i],pos=p.group?p.group.position:p,id=p.name??p.id??i,t=last.get(id);if(t!==undefined&&now-t<cfg.cooldown)continue;const d=Math.hypot(pos.x-vx,pos.z-vz);if(d<bd){bd=d;best=id}}
   if(best===null)return null;
   last.set(best,now);hit.id=best;hit.d=bd;hit.vol=yellVolume(bd);return hit;
  },
  // A walker hit by the vehicle yells now regardless of the cooldown (and starts a new one).
  force(now,id){last.set(id,now)},
  reset(){last.clear()}
 };
}
// The simultaneous voice limits (a tiny counter pair; audio.js uses one).
export function createVoices(max=MAX_VOICES,maxYells=MAX_YELLS){
 let n=0,y=0;
 return {
  get total(){return n},get yells(){return y},
  take(yell=false){if(n>=max||(yell&&y>=maxYells))return false;n++;if(yell)y++;return true},
  free(yell=false){if(n>0)n--;if(yell&&y>0)y--}
 };
}
// Scrape (sliding along a wall): gain and pitch by speed; silent under MIN.
export const SCRAPE={minSpeed:2.5,fullSpeed:14,maxGain:.55};
export const scrapeGain=speed=>{const v=Math.abs(speed);return v<SCRAPE.minSpeed?0:SCRAPE.maxGain*Math.min(1,(v-SCRAPE.minSpeed)/(SCRAPE.fullSpeed-SCRAPE.minSpeed)+.25)};
export const scrapeRate=speed=>.85+.35*Math.min(1,Math.abs(speed)/SCRAPE.fullSpeed);

// TR6 tyre sounds (pure rules; audio.js plays them). The loop for a ground, how loud and how fast it plays by speed and slip, and the cross-fade when the ground changes.
const T=SURFACE;
export const TYRE_SURFACE=Object.freeze({[T.STREET]:'asphalt',[T.ROAD]:'asphalt',[T.BRIDGE]:'asphalt',[T.DRIVEWAY]:'asphalt',[T.PAVEMENT]:'asphalt',[T.DIRT]:'gravel',[T.PATH]:'gravel',[T.GRAVEL]:'gravel',[T.GRASS]:'grass',[T.GREEN]:'grass',[T.WHEAT]:'grass',[T.PLOWED]:'grass',[T.MUD]:'mud'});
export const tyreLoopOf=surface=>TYRE_SURFACE[surface]||null; // water, banks and unknown ground: silent
export const TYRE={minSpeed:.5,fullSpeed:16,fadeS:.3,spinSpeed:6,level:{asphalt:.5,gravel:.6,grass:.45,mud:.65},slipGain:.3,rate:[.8,1.3],slipRate:.1,idleStopS:.6};
// How loud and how fast one loop plays. speed m/s (signed); slip 0..1 (sliding sideways or spinning); spin: the wheels turn on the spot (Stuck, or throttle held below 3 m/s), which sounds like driving at TYRE.spinSpeed. Returns {loop, gain, rate}; gain 0 below TYRE.minSpeed.
export function tyreMix({surface,speed=0,slip=0,spin=false}={}){
 const loop=tyreLoopOf(surface);if(!loop)return {loop:null,gain:0,rate:1};
 const v=Math.max(Math.abs(speed),spin?TYRE.spinSpeed:0),s=Math.max(0,Math.min(1,slip));if(v<TYRE.minSpeed)return {loop,gain:0,rate:1};
 const k=Math.min(1,(v-TYRE.minSpeed)/(TYRE.fullSpeed-TYRE.minSpeed));
 return {loop,gain:TYRE.level[loop]*Math.sqrt(k)*(1+TYRE.slipGain*s),rate:TYRE.rate[0]+(TYRE.rate[1]-TYRE.rate[0])*k+TYRE.slipRate*s};
}
// Slip 0..1 from the steering and the grip of the ground: turning hard at speed on loose ground slips, turning on a road does not; wheelspin counts as .8.
export const slipOf=({speed=0,top=10,steer=0,grip=1,spin=false}={})=>Math.min(1,(spin?.8:0)+Math.abs(steer)*Math.min(1,Math.abs(speed)/Math.max(.1,top))*Math.max(0,1.2-grip));
export const freshTyreBlend=()=>({asphalt:0,gravel:0,grass:0,mud:0});
// One step of the cross-fade: the weight of the wanted loop rises, every other falls, each by dt / TYRE.fadeS (so a change of ground takes .3 s and the weights of two loops add up to about 1 in between). loop null: all fall. Returns the same object.
export function stepTyreBlend(w,loop,dt){const d=dt/TYRE.fadeS;for(const k of Object.keys(w))w[k]=Math.max(0,Math.min(1,w[k]+(k===loop?d:-d)));return w}