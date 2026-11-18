// sweep-sounds.js: the game-wide sound sweep (footsteps, doors, UI, money, life, fuel, vehicle bits, cargo, ambience; assets-src/sounds-sweep, CC0, SND3) and the tables audio.js plays them from. Pure data.
import {SURFACE} from './terrain.js';
const freeze=Object.freeze,pool=(name,n)=>freeze(Array.from({length:n},(_,i)=>name+'-'+(i+1)));
export const STEP_CLIPS=freeze({pave:pool('step-pave',3),grass:pool('step-grass',3),gravel:pool('step-gravel',3),wood:pool('step-wood',3)});
// terrain.js SURFACE id -> the footstep set (null = no step: water). Inside a building or on a deck the game passes 'wood'.
export const stepKind=s=>typeof s==='string'?(STEP_CLIPS[s]?s:null):s===SURFACE.STREET||s===SURFACE.ROAD||s===SURFACE.PAVEMENT||s===SURFACE.DRIVEWAY?'pave':s===SURFACE.BRIDGE?'wood':s===SURFACE.DIRT||s===SURFACE.PATH||s===SURFACE.GRAVEL?'gravel':s===SURFACE.WATER?null:'grass';
export const STEP_LEVEL=freeze({walk:.35,run:.55,jitter:.1});
// name -> {clips, level (before the distance falloff), jitter (pitch spread)}: audio.sweep(name, at, listener). at null = the player's own, full level.
const one=(clip,level,jitter=.06)=>freeze({clips:freeze([clip]),level,jitter});
export const SWEEP_SHOTS=freeze({
 'ui-click':one('ui-click',.45,.04),'ui-toast':one('ui-toast',.45,.02),'phone-ping':one('phone-ping',.45,.02),
 'cash-register':one('cash-register',.5),'coins-pay':one('coins-pay',.5),'level-up':one('level-up',.5,.02),
 'eat-bite':one('eat-bite',.8),'sleep-chime':one('sleep-chime',.45,.02),'breath-tired':one('breath-tired',.55),
 'door-open':one('door-open',.55),'door-close':one('door-close',.55),'shop-bell':one('shop-bell',.5,.03),'gate-latch':one('gate-latch',.55),
 'car-door-open':one('car-door-open',.65),'car-door-close':one('car-door-close',.65),'car-horn':one('car-horn',.75,.02),'brake-squeal':one('brake-squeal',.45),
 'crate-drop':one('crate-drop',.6),'fuel-nozzle':one('fuel-nozzle',.55)
});
export const SWEEP_LOOPS=freeze({fuel:'fuel-flow',forkBeep:'forklift-beep',forkLift:'forklift-lift',birds:'amb-birds',crickets:'amb-crickets',wind:'amb-wind',water:'amb-water'});
export const SWEEP_FILES=freeze([...new Set([...Object.values(STEP_CLIPS).flat(),...Object.values(SWEEP_SHOTS).flatMap(s=>s.clips),...Object.values(SWEEP_LOOPS)])]); // the ATV and tractor engines are in vehicle-sounds.js ENGINESexport const SWEEP_CORE=freeze([...Object.values(STEP_CLIPS).flat(),'ui-click','ui-toast','phone-ping','door-open','door-close','shop-bell','cash-register','coins-pay']); // fetched on the first sweep sound (about 250 KB); the rest load when asked for
export const SWEEP_CORE=freeze([...Object.values(STEP_CLIPS).flat(),'ui-click','ui-toast','phone-ping','door-open','door-close','shop-bell','cash-register','coins-pay']); // fetched on the first sweep sound (about 250 KB); the rest load when asked for
