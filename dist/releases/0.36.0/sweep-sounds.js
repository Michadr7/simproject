// sweep-sounds.js: the game-wide sound sweep (footsteps v2, doors, UI, money, life, fuel, vehicle bits, cargo, ambience; CC0) and pure step selector.
import {SURFACE} from './terrain.js';
const freeze=Object.freeze,pool=(name,n)=>freeze(Array.from({length:n},(_,i)=>name+'-'+(i+1)));
// Even pool indices (0,2,4) = L foot, odd (1,3,5) = R foot (consecutive steps in walking/running sequences). wood 4..6 are creaky floorboards.
export const STEP_CLIPS=freeze({pave:pool('step-pave',6),grass:pool('step-grass',6),gravel:pool('step-gravel',6),wood:pool('step-wood',6),dirt:pool('step-dirt',6),mud:pool('step-mud',6),soil:pool('step-soil',6),crops:pool('step-crops',6),bank:pool('step-bank',6),tile:pool('step-tile',5),carpet:pool('step-carpet',5)});
export const STEP_RUN_CLIPS=freeze({pave:pool('step-pave-run',4),grass:pool('step-grass-run',4),gravel:pool('step-gravel-run',4),dirt:pool('step-dirt-run',4),wood:pool('step-wood-run',4)});
export const STEP_CLOTH=pool('step-cloth',4),STEP_CLOTH_LEVEL=freeze({walk:.08,run:.15,jitter:.12});
export const STEP_LEVEL=freeze({walk:.35,run:.55,jitter:.1});
// Every terrain.js SURFACE id (1..15) mapped explicitly; WATER stays null (unwalkable, no shallow id). Indoors accepts 'tile'|'carpet'|'wood'.
const S=SURFACE,SURFACE_STEP=freeze({[S.GRASS]:'grass',[S.STREET]:'pave',[S.ROAD]:'pave',[S.DIRT]:'dirt',[S.PAVEMENT]:'pave',[S.WATER]:null,[S.BANK]:'bank',[S.BRIDGE]:'wood',[S.WHEAT]:'crops',[S.PLOWED]:'soil',[S.GREEN]:'crops',[S.DRIVEWAY]:'pave',[S.PATH]:'dirt',[S.MUD]:'mud',[S.GRAVEL]:'gravel'});
export const stepKind=s=>typeof s==='string'?(STEP_CLIPS[s]?s:null):(SURFACE_STEP[s]??null);
const hash=s=>{const n=Number(s)||0;let x=((Number.isInteger(n)?n|0:Math.floor(n*4294967296)|0)+0x9e3779b9)>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b)>>>0;x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;return((x^(x>>>16))>>>0)/4294967296};
// Pure deterministic footstep selector: alternates L/R feet, never repeats lastIndex back-to-back, scales gain & rate with running, includes soft cloth layer.
export function nextStepClip(kind,lastIndex=-1,foot=null,running=false,seed=0){
 const k=stepKind(kind);if(!k)return null;
 const p=running&&STEP_RUN_CLIPS[k]?STEP_RUN_CLIPS[k]:STEP_CLIPS[k],isR=foot==='R'||foot==='r'||foot==='right'||foot===1,isL=foot==='L'||foot==='l'||foot==='left'||foot===0;
 const par=isR?1:isL?0:(lastIndex>=0?(lastIndex+1)&1:0),f=par?'R':'L';
 let cand=[];for(let i=0;i<p.length;i++)if((i&1)===par&&i!==lastIndex)cand.push(i);
 if(!cand.length)for(let i=0;i<p.length;i++)if(i!==lastIndex)cand.push(i);
 if(!cand.length)cand=[0];
 const s0=Number(seed)||0,u0=hash(s0),u1=hash(s0+101),u2=hash(s0+202),u3=hash((Number.isInteger(s0)?s0:s0*997)+303);
 const idx=cand[Math.min(cand.length-1,Math.floor(u0*cand.length))],cIdx=Math.min(STEP_CLOTH.length-1,Math.floor(u3*STEP_CLOTH.length));
 const gain=+((running?STEP_LEVEL.run:STEP_LEVEL.walk)*(.94+.12*u1)).toFixed(4),rate=+((running?1.12:1)+(u2-.5)*STEP_LEVEL.jitter).toFixed(4);
 return {file:p[idx],index:idx,foot:f,nextFoot:f==='L'?'R':'L',gain,rate,cloth:{file:STEP_CLOTH[cIdx],gain:+((running?STEP_CLOTH_LEVEL.run:STEP_CLOTH_LEVEL.walk)*(.9+.2*u1)).toFixed(4),rate:+((running?1.1:1)+(u3-.5)*STEP_CLOTH_LEVEL.jitter).toFixed(4)}};
}
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
export const SWEEP_FILES=freeze([...new Set([...Object.values(STEP_CLIPS).flat(),...Object.values(STEP_RUN_CLIPS).flat(),...STEP_CLOTH,...Object.values(SWEEP_SHOTS).flatMap(s=>s.clips),...Object.values(SWEEP_LOOPS)])]);
export const SWEEP_CORE=freeze([...['pave','grass','gravel','wood','dirt'].flatMap(k=>STEP_CLIPS[k]),...STEP_CLOTH,'ui-click','ui-toast','phone-ping','door-open','door-close','shop-bell','cash-register','coins-pay']); // fetched on the first sweep/step sound; other surfaces & run clips load on demand
