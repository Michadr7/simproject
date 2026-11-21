// logging-sounds.js: New World style logging & forest ambience clip registry, chopLayers, fellSequence, and pure non-repeating pickers (implements hydrogen-logging-sounds-ring.md, CC0).
const freeze=Object.freeze;
const pool=(name,n)=>freeze(Array.from({length:n},(_,i)=>name+'-'+(i+1)));

export const AXE_HITS=pool('axe-hit',6);
export const AXE_HEAVY=pool('axe-heavy',4);
export const AXE_LIGHT=pool('axe-light',2);
export const AXE_BODY=pool('axe-body',4);
export const WOOD_CRACKS=pool('wood-crack',3);
export const TRUNK_GROANS=pool('trunk-groan',4);
export const TREE_FALL_SEQS=pool('tree-fall-seq',2);
export const TREE_FALL_DEEPS=pool('tree-fall-deep',3);
export const LOG_THUDS=freeze({small:'log-thud-small',medium:'log-thud-medium',heavy:'log-thud-heavy'});
export const LOG_THUDS_DEEP=freeze({xs:'log-thud-xs',s:'log-thud-s',m:'log-thud-m',l:'log-thud-l'});
export const WOOD_CREAKS=pool('wood-creak',6);
export const CHOP_TAILS=pool('chop-tail',6);
export const FOREST_AMBIENCE=freeze({pines:'amb-forest-pines',bed:'amb-forest-bed',deep:'amb-deep-woods'});

export const LOGGING_MIX=freeze({
 axeHit:0.72,
 axeHeavy:0.84,
 axeLight:0.62,
 axeBody:0.76,
 woodCrack:0.68,
 trunkGroan:0.72,
 treeFall:0.88,
 treeFallDeep:0.90,
 buckCut:0.68,
 logThudSmall:0.65,
 logThudMedium:0.78,
 logThudHeavy:0.90,
 logThudDeepXs:0.66,
 logThudDeepS:0.74,
 logThudDeepM:0.84,
 logThudDeepL:0.94,
 woodCreak:0.42,
 chopTail:0.44,
 forestPines:0.28,
 forestBed:0.30,
 deepWoods:0.24
});

export const LOGGING_SHOTS=freeze({
 axeHit:freeze({clips:AXE_HITS,level:LOGGING_MIX.axeHit,jitter:0.09,slot:'axeHit'}),
 axeHeavy:freeze({clips:AXE_HEAVY,level:LOGGING_MIX.axeHeavy,jitter:0.12,slot:'axeHeavy'}),
 axeLight:freeze({clips:AXE_LIGHT,level:LOGGING_MIX.axeLight,jitter:0.12,slot:'axeLight'}),
 axeBody:freeze({clips:AXE_BODY,level:LOGGING_MIX.axeBody,jitter:0.12,slot:'axeBody'}),
 woodCrack:freeze({clips:WOOD_CRACKS,level:LOGGING_MIX.woodCrack,jitter:0.07,slot:'woodCrack'}),
 trunkGroan:freeze({clips:TRUNK_GROANS,level:LOGGING_MIX.trunkGroan,jitter:0.06,slot:'trunkGroan'}),
 treeFall:freeze({clips:TREE_FALL_SEQS,level:LOGGING_MIX.treeFall,jitter:0.04,slot:'treeFall'}),
 treeFallDeep:freeze({clips:TREE_FALL_DEEPS,level:LOGGING_MIX.treeFallDeep,jitter:0.04,slot:'treeFallDeep'}),
 buckCut:freeze({clips:AXE_HITS,level:LOGGING_MIX.buckCut,jitter:0.08,slot:'buckCut'}),
 logThud:freeze({clips:freeze([LOG_THUDS.small,LOG_THUDS.medium,LOG_THUDS.heavy]),level:LOGGING_MIX.logThudMedium,jitter:0.06,slot:'logThud'}),
 logThudDeep:freeze({clips:freeze(Object.values(LOG_THUDS_DEEP)),level:LOGGING_MIX.logThudDeepM,jitter:0.06,slot:'logThudDeep'}),
 woodCreak:freeze({clips:WOOD_CREAKS,level:LOGGING_MIX.woodCreak,jitter:0.08,slot:'woodCreak'}),
 chopTail:freeze({clips:CHOP_TAILS,level:LOGGING_MIX.chopTail,jitter:0.06,slot:'chopTail'})
});

export const LOGGING_LOOPS=freeze({
 forestPines:freeze({file:FOREST_AMBIENCE.pines,level:LOGGING_MIX.forestPines}),
 forestBed:freeze({file:FOREST_AMBIENCE.bed,level:LOGGING_MIX.forestBed}),
 deepWoods:freeze({file:FOREST_AMBIENCE.deep,level:LOGGING_MIX.deepWoods})
});

export const LOGGING_FILES=freeze([
 ...new Set([
  ...AXE_HITS,
  ...AXE_HEAVY,
  ...AXE_LIGHT,
  ...AXE_BODY,
  ...WOOD_CRACKS,
  ...TRUNK_GROANS,
  ...TREE_FALL_SEQS,
  ...TREE_FALL_DEEPS,
  ...Object.values(LOG_THUDS),
  ...Object.values(LOG_THUDS_DEEP),
  ...WOOD_CREAKS,
  ...CHOP_TAILS,
  ...Object.values(FOREST_AMBIENCE)
 ])
]);

const clamp01=v=>(Number.isFinite(v)?Math.min(0.999999999,Math.max(0,v)):0);
const clampUnit=v=>(Number.isFinite(v)?Math.min(1,Math.max(0,v)):0);

function pickFromPool(clips,lastIndex,rand){
 const u=clamp01(rand);
 if(!clips.length)return {file:null,index:-1};
 if(clips.length===1)return {file:clips[0],index:0};
 const valid=[];
 for(let i=0;i<clips.length;i++)if(i!==lastIndex)valid.push(i);
 const idx=valid[Math.min(valid.length-1,Math.floor(u*valid.length))];
 return {file:clips[idx],index:idx};
}

// Pure non-repeating picker: takes an injected random number in [0, 1) and never picks lastIndex back-to-back when pool.length > 1.
export function pickLoggingClip(kind,lastIndex=-1,rand=0){
 const entry=LOGGING_SHOTS[kind];
 if(!entry||!entry.clips.length)return null;
 const {file,index}=pickFromPool(entry.clips,lastIndex,rand);
 const u=clamp01(rand);
 const uRate=((u*13.37)%1);
 const rate=+(1+(uRate-0.5)*entry.jitter).toFixed(4);
 return {file,index,level:entry.level,rate,slot:entry.slot};
}

// Pure size-keyed log thud selector ('small'|'medium'|'heavy' or 'xs'|'s'|'m'|'l').
export function pickLogThud(size='medium',rand=0){
 const u=clamp01(rand);
 const rate=+(1+(u-0.5)*0.06).toFixed(4);
 if(LOG_THUDS_DEEP[size]){
  const lvMap={xs:LOGGING_MIX.logThudDeepXs,s:LOGGING_MIX.logThudDeepS,m:LOGGING_MIX.logThudDeepM,l:LOGGING_MIX.logThudDeepL};
  return {file:LOG_THUDS_DEEP[size],level:lvMap[size],rate,size};
 }
 const file=LOG_THUDS[size]||LOG_THUDS.medium;
 const level=size==='small'?LOGGING_MIX.logThudSmall:size==='heavy'?LOGGING_MIX.logThudHeavy:LOGGING_MIX.logThudMedium;
 return {file,level,rate,size:LOG_THUDS[size]?size:'medium'};
}

const CHOP_POOLS=freeze({
 heavy:freeze({clips:AXE_HEAVY,level:LOGGING_MIX.axeHeavy}),
 light:freeze({clips:AXE_LIGHT,level:LOGGING_MIX.axeLight}),
 body:freeze({clips:AXE_BODY,level:LOGGING_MIX.axeBody}),
 axeHit:freeze({clips:freeze([...AXE_HEAVY,...AXE_BODY]),level:LOGGING_MIX.axeBody}),
 buckCut:freeze({clips:freeze([...AXE_BODY,...AXE_LIGHT]),level:LOGGING_MIX.buckCut})
});

// Pure layered axe chop planner: picks non-repeating hit + forest tail, scales tailDelayMs (120..700 ms) & tailGain with depth01 (0..1), pitch +-6%, gain +-1.5 dB.
export function chopLayers(kind='body',depth01=0,randomA=0,randomB=0,lastHitIdx=-1,lastTailIdx=-1){
 const poolEntry=CHOP_POOLS[kind]||CHOP_POOLS.body;
 const uA=clamp01(randomA),uB=clamp01(randomB),d=clampUnit(depth01);
 const hitPick=pickFromPool(poolEntry.clips,lastHitIdx,uA);
 const tailPick=pickFromPool(CHOP_TAILS,lastTailIdx,uB);
 const tailDelayMs=Math.round(120+d*580);
 const tailGain=+(LOGGING_MIX.chopTail*(0.18+d*0.82)).toFixed(4);
 const pitch=+(1+(uA-0.5)*0.12).toFixed(4);
 const dbDelta=(uB-0.5)*3.0;
 const gain=+(poolEntry.level*Math.pow(10,dbDelta/20)).toFixed(4);
 return {
  hit:hitPick.file,
  hitIndex:hitPick.index,
  tail:tailPick.file,
  tailIndex:tailPick.index,
  tailDelayMs,
  tailGain,
  pitch,
  gain
 };
}

// Pure timed tree-fall sequence: returns ascending [{atMs, clip, gain}] for creak -> crack -> fall -> thud.
export function fellSequence(randomA=0){
 const u=clamp01(randomA);
 const u1=(u*7.31)%1,u2=(u*13.73)%1,u3=(u*23.19)%1;
 const groan=pickFromPool(TRUNK_GROANS,-1,u);
 const crack=pickFromPool(WOOD_CRACKS,-1,u1);
 const fall=pickFromPool(TREE_FALL_DEEPS,-1,u2);
 const tCrack=550+Math.round(u1*250);
 const tFall=1150+Math.round(u2*300);
 const tThud=4200+Math.round(u3*600);
 return [
  {atMs:0,clip:groan.file,gain:LOGGING_MIX.trunkGroan},
  {atMs:tCrack,clip:crack.file,gain:LOGGING_MIX.woodCrack},
  {atMs:tFall,clip:fall.file,gain:LOGGING_MIX.treeFallDeep},
  {atMs:tThud,clip:LOG_THUDS_DEEP.l,gain:LOGGING_MIX.logThudDeepL}
 ];
}
