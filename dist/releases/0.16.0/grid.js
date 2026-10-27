// Plot rules. Plots are stored sparsely in progress.plots, keyed "ix,iz" (see world.js):
// a cell with no entry is in its generated default state.
//   farm:   {type:'farm', crop:null|string, tilled:boolean}
//   forest: {type:'forest', tree:'pine'|null, hits:0..TREE_HITS-1}
import {gridZoneAt,parseCellKey,cuttableTreeAt,cellCenter} from './world.js';
import {addItem,hasItem} from './inventory.js';

export const TREE_HITS=3;
export const CHOP_RANGE=2.2;
const MAX_PLOTS=20000;

export function defaultPlot(key){
 const cell=parseCellKey(key),zone=cell&&gridZoneAt(cell.ix,cell.iz);
 if(zone==='farm')return {type:'farm',crop:null,tilled:false};
 if(zone==='forest')return {type:'forest',tree:cuttableTreeAt(key)?'pine':null,hits:0};
 return null;
}
// Drops anything malformed, off-grid, or describing a tree the world never generated.
export function normalizePlots(value){
 const plots={};if(!value||typeof value!=='object')return plots;
 let count=0;
 for(const [key,raw] of Object.entries(value)){
  if(count>=MAX_PLOTS)break;
  const base=defaultPlot(key);if(!base||!raw||typeof raw!=='object'||raw.type!==base.type)continue;
  let plot;
  if(base.type==='farm')plot={type:'farm',crop:typeof raw.crop==='string'&&/^[a-z][a-z-]{0,23}$/.test(raw.crop)?raw.crop:null,tilled:raw.tilled===true};
  else{
   if(base.tree===null)continue; // nothing generated here to remember yet
   const tree=raw.tree===null?null:'pine';
   plot={type:'forest',tree,hits:tree&&Number.isInteger(raw.hits)?Math.max(0,Math.min(TREE_HITS-1,raw.hits)):0};
  }
  // Only store plots that differ from their default.
  if(JSON.stringify(plot)!==JSON.stringify(base)){plots[key]=plot;count++}
 }
 return plots;
}
export const plotAt=(progress,key)=>progress.plots?.[key]||defaultPlot(key);
export function setPlot(progress,key,plot){
 const base=defaultPlot(key);if(!base)return progress;
 const plots={...(progress.plots||{})};
 if(JSON.stringify(plot)===JSON.stringify(base))delete plots[key];else plots[key]=plot;
 return {...progress,plots};
}
// Keys of trees the player has felled (for rebuilding the world after loading).
export const felledTrees=progress=>Object.entries(progress.plots||{}).filter(([,p])=>p.type==='forest'&&p.tree===null).map(([key])=>key);

// One swing of the axe. Returns {error} or {state, hits, felled, message}.
// The final hit is refused (and not counted) if the log will not fit in the bag.
export function chopTree(progress,key,position){
 const plot=plotAt(progress,key);
 if(plot?.type!=='forest'||plot.tree!=='pine')return {error:'There is no tree to chop here.'};
 const c=parseCellKey(key),center=cellCenter(c.ix,c.iz);
 if(position&&Math.hypot(position.x-center.x,position.z-center.z)>CHOP_RANGE)return {error:'Move closer to the tree.'};
 if(!hasItem(progress,'axe'))return {error:'You need an axe. The Corner Market sells them.'};
 const hits=plot.hits+1;
 if(hits<TREE_HITS)return {state:setPlot(progress,key,{type:'forest',tree:'pine',hits}),hits,felled:false,message:`Chop ${hits} / ${TREE_HITS}`};
 const withLog=addItem(progress,'wood-log');
 if(withLog.error)return {error:'Your bag is full. Make room for the wood log first.'};
 return {state:setPlot(withLog.state,key,{type:'forest',tree:null,hits:0}),hits,felled:true,message:'Timber! Wood log added to your bag.'};
}
