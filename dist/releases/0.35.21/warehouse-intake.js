// warehouse-intake.js: warehouse plank intake into rack/pallet cells, cell-fill pay, and pallet-truth stock conservation; implements notes/planks-economy-design.md stage P-C. Pure: no DOM, no three.js, no globals, no Math.random/Date.now.
import {RACK_CELL_PLANKS,PLANKS_PER_STACK,PAY} from './plank-economy.js';
import {takeStack,normalizeYard} from './sawmill-yard.js';
import {RACK_SLOTS,RACK_IDS,HAND_LEVEL} from './warehouse-layout.js';
import {PALLET_CAP,MAX_PALLETS,racksMap,totalPlanks,putAwayOrder} from './pallets.js';
import {PLACES,PALLET_LINK} from './world-goods.js';
export {RACK_CELL_PLANKS,PLANKS_PER_STACK,PAY};

const freeze=Object.freeze;
const SLOT_SET=new Set(RACK_IDS);
export const RACK_CELL_PAY=PAY.rackCell; // PAY.rackCell (500 c = $5.00 once per newly filled cell of RACK_CELL_PLANKS)
export const DELIVERED_PLANK_PAY=PAY.plankDelivered; // PAY.plankDelivered (730 c per delivered plank from plank-economy.js)
export const INTAKE_ORDER=freeze(putAwayOrder().map(s=>s.id)); // stable order: floor level nearest dock door first, then upper levels
export const HAND_RACK_IDS=freeze(RACK_SLOTS.filter(s=>s.level<=HAND_LEVEL).map(s=>s.id));
const HAND_SET=new Set(HAND_RACK_IDS);
export const TOTAL_RACK_CELLS=RACK_IDS.length; // 120 cells (5 faces x 8 bays x 3 levels)
export const MAX_RACK_PLANKS=TOTAL_RACK_CELLS*RACK_CELL_PLANKS;
export const HAND_RACK_MAX_PLANKS=HAND_RACK_IDS.length*RACK_CELL_PLANKS;
export const WAREHOUSE_WORLD_MAX=PLACES[PALLET_LINK.place].goods[PALLET_LINK.good].max;

const clampInt=(v,lo,hi)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):0;

// Normalize a cell map {slot: n}, a company object {pallets|racks|forkload}, an intake result {cells}, or a pallet list into a frozen {slot: 1..40} map.
export function normalizeCells(raw){
 if(!raw||typeof raw!=='object')return freeze({});
 let src=raw;
 if(Array.isArray(raw))src=racksMap({pallets:raw});
 else if(Array.isArray(raw.pallets)||(raw.racks&&typeof raw.racks==='object'))src=racksMap(raw);
 else if(raw.cells&&typeof raw.cells==='object'&&!Array.isArray(raw.cells))src=raw.cells;
 const out={};
 for(const id of RACK_IDS){
  if(!Object.prototype.hasOwnProperty.call(src,id))continue;
  const n=clampInt(src[id],0,RACK_CELL_PLANKS);
  if(n>0)out[id]=n;
 }
 return freeze(out);
}

// Represent normalized cells as a frozen pallets.js company object (the pallet truth); optional extra.pallets preserves non-rack pallets.
export function toCompany(cells,extra){
 const c=normalizeCells(cells),pallets=[];let id=1;
 for(const slot of INTAKE_ORDER){
  if(!c[slot])continue;
  pallets.push(freeze({id:id++,product:PALLET_LINK.good,count:c[slot],at:freeze({rack:slot})}));
 }
 if(Array.isArray(extra?.pallets))for(const p of extra.pallets){
  if(!p||typeof p!=='object'||p.at?.rack||pallets.length>=MAX_PALLETS)continue;
  pallets.push(freeze({...p,id:id++}));
 }
 return freeze({pallets:freeze(pallets)});
}

export const cellPlanks=cells=>totalPlanks(toCompany(cells));
export const fullCellCount=cells=>{const c=normalizeCells(cells);let n=0;for(const id of RACK_IDS)if(c[id]===RACK_CELL_PLANKS)n++;return n};

// Matches world-tick.js mirrorPallets(world, progress): clamps total pallet planks (cells + optional non-rack planks) to WAREHOUSE_WORLD_MAX.
export function mirrorPlankSum(cells,extraPlanks=0){
 const base=cellPlanks(cells),extra=Number.isFinite(extraPlanks)&&extraPlanks>0?Math.floor(extraPlanks):0;
 return Math.max(0,Math.min(WAREHOUSE_WORLD_MAX,base+extra));
}

// Plan storing `planks` into rack cells without creating or losing planks: returns {cells, stored, left, fullCellsBefore, fullCells, newlyFilled, touched}.
export function intakePlan(cells,planks,opts){
 const cur=normalizeCells(cells),offered=Number.isFinite(planks)&&planks>0?Math.min(1e9,Math.floor(planks)):0;
 const handOnly=opts?.handOnly===true,pref=typeof opts?.slot==='string'&&SLOT_SET.has(opts.slot)&&(!handOnly||HAND_SET.has(opts.slot))?opts.slot:null;
 const next={...cur},fullCellsBefore=fullCellCount(cur);
 if(offered===0)return freeze({cells:cur,stored:0,left:0,fullCellsBefore,fullCells:fullCellsBefore,newlyFilled:0,touched:freeze([])});
 const base=handOnly?INTAKE_ORDER.filter(id=>HAND_SET.has(id)):INTAKE_ORDER;
 const partial=[],empty=[];
 for(const id of base){
  if(id===pref)continue;
  const n=next[id]||0;
  if(n>=RACK_CELL_PLANKS)continue;
  (n>0?partial:empty).push(id);
 }
 const order=pref&&(next[pref]||0)<RACK_CELL_PLANKS?[pref,...partial,...empty]:[...partial,...empty];
 let rem=offered;const touched=[];
 for(const id of order){
  if(rem<=0)break;
  const have=next[id]||0,add=Math.min(rem,RACK_CELL_PLANKS-have);
  if(add>0){next[id]=have+add;rem-=add;touched.push(id)}
 }
 const frozen=freeze(next),stored=offered-rem,fullCells=fullCellCount(frozen);
 return freeze({cells:frozen,stored,left:rem,fullCellsBefore,fullCells,newlyFilled:Math.max(0,fullCells-fullCellsBefore),touched:freeze(touched)});
}

// Pay RACK_CELL_PAY (PAY.rackCell) once per newly filled full cell when planks were actually stored. Accepts numbers or an intakePlan result.
export function payFor(storedPlanks,fullCellsBefore=0,fullCellsAfter=0){
 const obj=storedPlanks&&typeof storedPlanks==='object'&&!Array.isArray(storedPlanks);
 const stored=clampInt(obj?storedPlanks.stored:storedPlanks,0,1e9);
 const before=clampInt(obj?storedPlanks.fullCellsBefore:fullCellsBefore,0,TOTAL_RACK_CELLS);
 const after=clampInt(obj?storedPlanks.fullCells:fullCellsAfter,0,TOTAL_RACK_CELLS);
 const gained=stored>0?Math.min(stored,Math.max(0,after-before)):0;
 return gained*RACK_CELL_PAY;
}

// Take up to `stacks` stacks from the P-B sawmill yard and store them via intakePlan while preserving conservation (taken === stored + left).
export function intakeFromYard(yardState,cells,stacks=1,opts){
 let y=normalizeYard(yardState),taken=0;
 const want=clampInt(stacks,0,1000);
 for(let i=0;i<want;i++){
  const r=takeStack(y);y=r.state;taken+=r.planks;
  if(r.planks===0)break;
 }
 const plan=intakePlan(cells,taken,opts);
 return freeze({yard:y,cells:plan.cells,taken,stored:plan.stored,left:plan.left,fullCellsBefore:plan.fullCellsBefore,fullCells:plan.fullCells,newlyFilled:plan.newlyFilled,payCents:payFor(plan)});
}

// Snapshot for a future warehouse UI.
export function summarize(cells){
 const c=normalizeCells(cells);
 let planks=0,usedCells=0,fullCells=0,handPlanks=0,handFullCells=0;
 for(const id of RACK_IDS){
  const n=c[id]||0;if(n<=0)continue;
  planks+=n;usedCells++;if(n===RACK_CELL_PLANKS)fullCells++;
  if(HAND_SET.has(id)){handPlanks+=n;if(n===RACK_CELL_PLANKS)handFullCells++}
 }
 return freeze({
  planks,mirroredPlanks:mirrorPlankSum(c),usedCells,fullCells,partialCells:usedCells-fullCells,
  freeCells:TOTAL_RACK_CELLS-usedCells,freePlankSpace:MAX_RACK_PLANKS-planks,
  handPlanks,handFullCells,handFreePlankSpace:HAND_RACK_MAX_PLANKS-handPlanks
 });
}
