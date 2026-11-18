// timber-machine.js: warehouse timber machine rules (post, beam, dowel), warehouse-machine-design.md M-A
import {GAME_MIN_PER_REAL_SEC} from './gig-pay.js';
const freeze=Object.freeze;
export const MACHINE_VERSION=1;
const mode=(input,output,count,seconds)=>freeze({input,output,count,seconds,min:seconds*GAME_MIN_PER_REAL_SEC});
export const MODES=freeze({post:mode('log','post',1,10),beam:mode('log','beam',1,12),dowel:mode('post','dowel',6,8)});
export const MODE_LIST=freeze(['post','beam','dowel']);
export const SWITCH_SECONDS=1,SWITCH_MIN=SWITCH_SECONDS*GAME_MIN_PER_REAL_SEC;
export const MAX_LOGS_IN=8,MAX_POSTS_IN=8; // in-tray caps
export const MAX_OUT=40; // out pallet, per product kind
export const MAX_CHIPS=40,CHIPS_PER_CUT=1; // chip hopper
export const PRODUCT_CENTS=freeze({post:3000,beam:3800,dowel:700,chip:100}); // PLACEHOLDERS from the design

const clampInt=(v,lo,hi,d)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const TIME_GRID=792000; // common multiple of 30, 60, 120, 144, 165, 240, 360, 720, 1000 steps per game min
const snapTime=x=>{if(!Number.isFinite(x)||x<=0)return 0;const g=Math.round(x*TIME_GRID);if(Math.abs(x*TIME_GRID-g)<1e-6){const v=g/TIME_GRID,d=Math.round(v*1e6)/1e6;return Math.abs(v-d)<1e-9?d:v}return x};
const OUT_KEY={post:'posts',beam:'beams',dowel:'dowels'};
const IN_KEY={log:'logsIn',post:'postsIn'};
const IN_MAX={log:MAX_LOGS_IN,post:MAX_POSTS_IN};
// a cut needs its input in the tray and room on the pallet for the whole output
const canCut=(s,m)=>{const d=MODES[m];return !!d&&s[IN_KEY[d.input]]>0&&s[OUT_KEY[d.output]]+d.count<=MAX_OUT};
const make=o=>freeze({v:MACHINE_VERSION,mode:o.mode,logsIn:o.logsIn,postsIn:o.postsIn,cutMin:o.cutMin,cutKind:o.cutKind,on:o.switchMin<=0&&canCut(o,o.mode),posts:o.posts,beams:o.beams,dowels:o.dowels,chips:o.chips,postsMade:o.postsMade,beamsMade:o.beamsMade,dowelsMade:o.dowelsMade,switchMin:o.switchMin});

export function freshMachine(){
 return make({mode:'post',logsIn:0,postsIn:0,cutMin:0,cutKind:null,posts:0,beams:0,dowels:0,chips:0,postsMade:0,beamsMade:0,dowelsMade:0,switchMin:0});
}

// Any saved machine or junk -> a valid frozen state (v-less and partial saves load cleanly).
export function normalizeMachine(raw){
 const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const m=MODES[r.mode]?r.mode:'post';
 const base={mode:m,logsIn:clampInt(r.logsIn,0,MAX_LOGS_IN,0),postsIn:clampInt(r.postsIn,0,MAX_POSTS_IN,0),
  posts:clampInt(r.posts,0,MAX_OUT,0),beams:clampInt(r.beams,0,MAX_OUT,0),dowels:clampInt(r.dowels,0,MAX_OUT,0),chips:clampInt(r.chips,0,MAX_CHIPS,0),
  postsMade:clampInt(r.postsMade,0,1e9,0),beamsMade:clampInt(r.beamsMade,0,1e9,0),dowelsMade:clampInt(r.dowelsMade,0,1e9,0),
  switchMin:Number.isFinite(r.switchMin)&&r.switchMin>0?snapTime(Math.min(r.switchMin,SWITCH_MIN)):0};
 const run=r.cutKind===m&&Number.isFinite(r.cutMin)&&r.cutMin>0&&r.cutMin<MODES[m].min&&canCut(base,m)&&base.switchMin<=0;
 return make({...base,cutKind:run?m:null,cutMin:run?snapTime(r.cutMin):0});
}

// Change mode: refused while a cut runs (or while the selector is still moving). Returns {state,ok,reason}.
export function setMode(state,want){
 const s=normalizeMachine(state);
 if(!MODES[want])return freeze({state:s,ok:false,reason:'unknown mode'});
 if(s.cutKind)return freeze({state:s,ok:false,reason:'a cut is running'});
 if(s.switchMin>0)return freeze({state:s,ok:false,reason:'the selector is still moving'});
 if(want===s.mode)return freeze({state:s,ok:true,reason:'already in that mode'});
 return freeze({state:make({...s,mode:want,switchMin:SWITCH_MIN}),ok:true,reason:null});
}

// Put logs or posts in the tray, up to the cap. kind 'log' | 'post'.
export function feed(state,kind,count=1){
 const s=normalizeMachine(state),key=IN_KEY[kind];
 if(!key||!Number.isFinite(count)||Math.floor(count)<=0)return freeze({state:s,accepted:0,refused:key?0:(Number.isFinite(count)&&count>0?Math.floor(count):0)});
 const want=Math.min(1e9,Math.floor(count)),accepted=Math.min(want,IN_MAX[kind]-s[key]);
 return freeze({state:accepted>0?make({...s,[key]:s[key]+accepted}):s,accepted,refused:want-accepted});
}

// Advance by dtGameMin game minutes (frame-rate independent). A started cut finishes first; the input is used up when the cut completes.
export function tick(state,dtGameMin){
 const s=normalizeMachine(state);
 if(!Number.isFinite(dtGameMin)||dtGameMin<=0)return s;
 let rem=Math.min(dtGameMin,1e9),lock=s.switchMin;
 if(lock>0){const use=Math.min(lock,rem);lock=snapTime(lock-use);rem=snapTime(rem-use)}
 if(lock>0)return make({...s,switchMin:lock});
 const d=MODES[s.mode];
 let st={...s,switchMin:0},t=snapTime(s.cutMin+rem),started=!!s.cutKind;
 if(!started&&!canCut(st,st.mode))return make({...st,cutMin:0,cutKind:null});
 for(let guard=0;guard<5000;guard++){
  if(!canCut(st,st.mode)){t=0;break}
  if(t+1e-9<d.min)break;
  t=snapTime(Math.max(0,t-d.min));
  const ik=IN_KEY[d.input],ok=OUT_KEY[d.output],made=d.output+'sMade';
  st={...st,[ik]:st[ik]-1,[ok]:Math.min(MAX_OUT,st[ok]+d.count),[made]:Math.min(1e9,st[made]+1),chips:Math.min(MAX_CHIPS,st.chips+CHIPS_PER_CUT)};
 }
 const active=canCut(st,st.mode)&&t>0;
 return make({...st,cutMin:active?snapTime(t):0,cutKind:active?st.mode:null});
}

// Take finished products from the out pallet. kind 'post' | 'beam' | 'dowel'.
export function take(state,kind,count=1){
 const s=normalizeMachine(state),key=OUT_KEY[kind];
 if(!key||!Number.isFinite(count)||Math.floor(count)<=0)return freeze({state:s,taken:0});
 const taken=Math.min(Math.floor(count),s[key]);
 return freeze({state:taken>0?make({...s,[key]:s[key]-taken}):s,taken});
}

// Empty the chip hopper (or part of it).
export function takeChips(state,count=MAX_CHIPS){
 const s=normalizeMachine(state);
 if(!Number.isFinite(count)||Math.floor(count)<=0)return freeze({state:s,taken:0});
 const taken=Math.min(Math.floor(count),s.chips);
 return freeze({state:taken>0?make({...s,chips:s.chips-taken}):s,taken});
}

// Snapshot for a later UI.
export function summarize(state){
 const s=normalizeMachine(state),d=MODES[s.mode];
 return freeze({
  v:s.v,mode:s.mode,input:d.input,output:d.output,perCut:d.count,seconds:d.seconds,
  logsIn:s.logsIn,postsIn:s.postsIn,logSpace:MAX_LOGS_IN-s.logsIn,postSpace:MAX_POSTS_IN-s.postsIn,
  posts:s.posts,beams:s.beams,dowels:s.dowels,chips:s.chips,
  postsMade:s.postsMade,beamsMade:s.beamsMade,dowelsMade:s.dowelsMade,
  on:s.on,cutting:!!s.cutKind,cutKind:s.cutKind,cutMin:s.cutMin,cutProgress:s.cutKind?Math.min(1,+(s.cutMin/d.min).toFixed(6)):0,
  switching:s.switchMin>0,switchMin:s.switchMin,canChangeMode:!s.cutKind&&s.switchMin<=0,
  inputMissing:s[IN_KEY[d.input]]<=0,palletFull:s[OUT_KEY[d.output]]+d.count>MAX_OUT,chipsFull:s.chips>=MAX_CHIPS,
  canTake:s.posts+s.beams+s.dowels>0,canTakeChips:s.chips>0
 });
}