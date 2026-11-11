// Mikkadr Hub P4, S5: the Waiting for you list, built by a pure function from four sources the server has already read (no files, no clock, no model here).
//   plans waiting     one item each, newest revision          action: Read and answer
//   plans found       one grouped item                         action: Review
//   assets            .hub/attention.json from npm run assets  actions: Open in 3D, Hide until it changes (hidden items are kept by content hash)
//   tokens            watcher warnings from weekly 60 / 5-hour 50, or a reading over 2 hours old (or none)   actions: Open Tokens, Copy command
// Order: stop or critical tokens, plans, high tokens, assets, notes; oldest first inside a group.
export const PROBE_COMMAND='npm run watcher -- --probe';
export const STALE_MINUTES=120;
export const RANK={'tokens-critical':0,plan:1,'tokens-high':2,asset:3,note:4};
const SEVERITY={'tokens-critical':'crit','tokens-high':'tok',plan:'plan',asset:'att',note:'info'};
const cut=(s,n)=>{s=String(s??'');return s.length>n?s.slice(0,n-1)+'…':s};
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
const ASSET_TITLE={unused:n=>`${n} is not used anywhere in the game`,outdated:n=>`${n}: the register row is outdated`,picture:n=>`${n}: the picture could not be drawn`};

// plans: [{id,title,from,status,revision,sentAt}] (summaries); found: [{path,modifiedAt}]; attention: {generatedAt,items:[{id,name,kind,text,viewable,hash}]} or null;
// hidden: [hash]; gauges: the /api/gauges answer or null; now: ms.
export function buildWaiting({plans=[],found=[],attention=null,hidden=[],gauges=null,now=0}={}){
 const items=[];
 for(const p of plans)if(p.status==='waiting')items.push({id:'plan:'+p.id,group:'plan',title:`Plan: ${cut(p.title,90)} (revision ${p.revision})`,detail:`From ${cut(p.from,40)}`,at:p.sentAt,actions:[{type:'link',label:'Read and answer',href:'#plans/'+p.id,primary:true}]});
 if(found.length){const names=found.slice(0,3).map(f=>f.path).join(', ');
  items.push({id:'found',group:'note',title:`${plural(found.length,'plan file')} found that ${found.length===1?'was':'were'} never sent`,detail:`Plans · ${cut(names,120)}${found.length>3?`, and ${found.length-3} more`:''}`,at:Math.min(...found.map(f=>f.modifiedAt||now)),actions:[{type:'link',label:'Review',href:'#plans',primary:true}]})}
 const hide=new Set(hidden);
 if(attention&&Array.isArray(attention.items))for(const a of attention.items){
  if(hide.has(a.hash)||!ASSET_TITLE[a.kind])continue;
  const acts=[];if(a.viewable)acts.push({type:'link',label:'Open in 3D',href:'/viewer.html#'+encodeURIComponent(a.id),external:true});
  acts.push({type:'hide',label:'Hide until it changes',hash:a.hash});
  items.push({id:'asset:'+a.hash,group:'asset',title:ASSET_TITLE[a.kind](cut(a.name,60)),detail:'Assets · '+cut(a.text,160),at:attention.generatedAt||0,actions:acts,sortName:a.name})}
 let tokens=0;
 if(gauges){
  const readingAt=gauges.ageMin==null?now:now-gauges.ageMin*60000;
  for(const w of gauges.warnings||[]){
   if(!['stop','critical','high','watch'].includes(w.level))continue;
   const group=w.level==='stop'||w.level==='critical'?'tokens-critical':w.level==='high'?'tokens-high':'note';
   items.push({id:'tokens:'+w.level+':'+cut(w.text,24),group,title:cut(w.text,140),detail:'Tokens',at:readingAt,actions:[{type:'link',label:'Open Tokens',href:'#tokens',primary:true},{type:'copy',label:'Copy command',text:PROBE_COMMAND}]});tokens++}
  if(gauges.ageMin==null||gauges.ageMin>=STALE_MINUTES){
   const age=gauges.ageMin==null?'There is no token reading yet':`The token reading is ${gauges.ageMin>=2880?Math.round(gauges.ageMin/1440)+' days':Math.round(gauges.ageMin/60)+' h'} old`;
   items.push({id:'tokens:stale',group:'note',title:age,detail:`Tokens · take a fresh one in the terminal: ${PROBE_COMMAND} (one small Haiku call)`,at:readingAt,actions:[{type:'link',label:'Open Tokens',href:'#tokens'},{type:'copy',label:'Copy command',text:PROBE_COMMAND,primary:true}]});tokens++}}
 for(const i of items){i.rank=RANK[i.group];i.severity=SEVERITY[i.group]}
 items.sort((a,b)=>a.rank-b.rank||a.at-b.at||String(a.sortName||a.id).localeCompare(String(b.sortName||b.id)));
 for(const i of items)delete i.sortName;
 const count=g=>items.filter(i=>i.group===g).length;
 return {items,counts:{waiting:items.length,plans:count('plan'),assets:count('asset'),tokens}}}
