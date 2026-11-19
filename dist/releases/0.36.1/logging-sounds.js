// logging-sounds.js: New World style logging & forest ambience clip registry and pure non-repeating picker (implements hydrogen-logging-sounds.md, CC0).
const freeze=Object.freeze;
const pool=(name,n)=>freeze(Array.from({length:n},(_,i)=>name+'-'+(i+1)));

export const AXE_HITS=pool('axe-hit',6);
export const WOOD_CRACKS=pool('wood-crack',3);
export const TREE_FALL_SEQS=pool('tree-fall-seq',2);
export const LOG_THUDS=freeze({small:'log-thud-small',medium:'log-thud-medium',heavy:'log-thud-heavy'});
export const WOOD_CREAKS=pool('wood-creak',6);
export const FOREST_AMBIENCE=freeze({pines:'amb-forest-pines'});

export const LOGGING_MIX=freeze({
 axeHit:0.72,
 woodCrack:0.68,
 treeFall:0.88,
 buckCut:0.68,
 logThudSmall:0.65,
 logThudMedium:0.78,
 logThudHeavy:0.90,
 woodCreak:0.42,
 forestPines:0.28
});

export const LOGGING_SHOTS=freeze({
 axeHit:freeze({clips:AXE_HITS,level:LOGGING_MIX.axeHit,jitter:0.09,slot:'axeHit'}),
 woodCrack:freeze({clips:WOOD_CRACKS,level:LOGGING_MIX.woodCrack,jitter:0.07,slot:'woodCrack'}),
 treeFall:freeze({clips:TREE_FALL_SEQS,level:LOGGING_MIX.treeFall,jitter:0.04,slot:'treeFall'}),
 buckCut:freeze({clips:AXE_HITS,level:LOGGING_MIX.buckCut,jitter:0.08,slot:'buckCut'}),
 logThud:freeze({clips:freeze([LOG_THUDS.small,LOG_THUDS.medium,LOG_THUDS.heavy]),level:LOGGING_MIX.logThudMedium,jitter:0.06,slot:'logThud'}),
 woodCreak:freeze({clips:WOOD_CREAKS,level:LOGGING_MIX.woodCreak,jitter:0.08,slot:'woodCreak'})
});

export const LOGGING_LOOPS=freeze({
 forestPines:freeze({file:FOREST_AMBIENCE.pines,level:LOGGING_MIX.forestPines})
});

export const LOGGING_FILES=freeze([
 ...new Set([
  ...AXE_HITS,
  ...WOOD_CRACKS,
  ...TREE_FALL_SEQS,
  ...Object.values(LOG_THUDS),
  ...WOOD_CREAKS,
  ...Object.values(FOREST_AMBIENCE)
 ])
]);

const clamp01=v=>(Number.isFinite(v)?Math.min(0.999999999,Math.max(0,v)):0);

// Pure non-repeating picker: takes an injected random number in [0, 1) and never picks lastIndex back-to-back when pool.length > 1.
export function pickLoggingClip(kind,lastIndex=-1,rand=0){
 const entry=LOGGING_SHOTS[kind];
 if(!entry)return null;
 const clips=entry.clips;
 if(!clips.length)return null;
 const u=clamp01(rand);
 let idx=0;
 if(clips.length>1){
  const valid=[];
  for(let i=0;i<clips.length;i++)if(i!==lastIndex)valid.push(i);
  idx=valid[Math.min(valid.length-1,Math.floor(u*valid.length))];
 }
 const uRate=((u*13.37)%1);
 const rate=+(1+(uRate-0.5)*entry.jitter).toFixed(4);
 return {file:clips[idx],index:idx,level:entry.level,rate,slot:entry.slot};
}

// Pure size-keyed log thud selector ('small' | 'medium' | 'heavy').
export function pickLogThud(size='medium',rand=0){
 const file=LOG_THUDS[size]||LOG_THUDS.medium;
 const level=size==='small'?LOGGING_MIX.logThudSmall:size==='heavy'?LOGGING_MIX.logThudHeavy:LOGGING_MIX.logThudMedium;
 const u=clamp01(rand);
 const rate=+(1+(u-0.5)*0.06).toFixed(4);
 return {file,level,rate,size:LOG_THUDS[size]?size:'medium'};
}
