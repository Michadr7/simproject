// Mikkadr Hub 2.10: the Work page as lanes. Pure rules (no DOM): which lane a step is in, which area chip it gets, the order, the "new" dot, the Do next strip.
// Lanes, in the order they are stacked: Approve > Start > Working > Read result > Done. The plan's own status decides, so an approved plan moves to Start by itself.
export const LANES=[['approve','Approve'],['start','Start'],['work','Working'],['read','Read result'],['done','Done']];
export const laneOf=s=>s.denied||s.status==='done'?'done':s.status==='waiting'?'approve':s.status==='approved'||s.status==='blocked'?'start':s.status==='working'?'work':'read';
// The one button on a compact card: it opens the step (the real buttons, with their gates, are in the detail pane).
export const BUTTON={approve:'Approve',start:'Start',work:'Watch',read:'Read',done:'Open'};
export const buttonText=s=>s.status==='blocked'?'Open':s.status==='question'?'Answer':BUTTON[laneOf(s)];
// Area chips. Anything the master did not name gets the grey "Other" chip.
export const AREAS=[['ui','UI'],['assets','Assets'],['scene','Scene editor'],['people','People'],['characters','Characters'],['warehouse','Warehouse'],['multiplayer','Multiplayer'],['game','Game systems'],['hub','Hub']];
export const OTHER_AREA=['other','Other'];
// A project name ("Scene editor", "Hub v2", "Mikkadr Hub", "Other") -> an area key.
export function areaOf(project){
 const n=String(project||'').trim().toLowerCase();if(!n)return 'other';
 for(const [k,label] of AREAS)if(n===label.toLowerCase())return k;
 if(/^(mikkadr )?hub\b/.test(n))return 'hub';
 return 'other'}
export const areaLabel=k=>(AREAS.find(a=>a[0]===k)||OTHER_AREA)[1];
export const NEW_MS=60*60*1000;
export const isNew=(at,now=Date.now())=>!!at&&now-at>=0&&now-at<NEW_MS;
// Short age: "4 min", "3 h", "2 d".
export function ageShort(at,now=Date.now()){if(!at)return '';const m=Math.max(0,Math.round((now-at)/60000));return m<1?'now':m<60?m+' min':m<48*60?Math.round(m/60)+' h':Math.round(m/1440)+' d'}
// Cards for the lanes: [{project,step,lane,area}] newest first inside a lane. `area` is the chosen chip key or 'all'.
export function laneCards(tree,area='all'){
 const out=[];for(const p of tree.projects)for(const s of p.steps){const a=areaOf(p.name);if(area!=='all'&&a!==area)continue;out.push({project:p,step:s,lane:laneOf(s),area:a})}
 return out.sort((x,y)=>(y.step.at||0)-(x.step.at||0))}
export const byLane=cards=>Object.fromEntries(LANES.map(([k])=>[k,cards.filter(c=>c.lane===k)]));
// Which area chips to show: the areas that have a step, in the fixed order, so the strip does not fill with empty chips.
export function areaChips(tree){const have=new Set(tree.projects.filter(p=>p.steps.length).map(p=>areaOf(p.name)));return [...AREAS,OTHER_AREA].filter(([k])=>have.has(k))}
// The Do next strip: up to 3 of the most urgent. Approve first, then Start, then Read result; the oldest waiting first (it has waited longest).
export function doNext(tree,max=3,area='all'){
 const cards=laneCards(tree,area).filter(c=>c.lane==='approve'||c.lane==='start'&&c.step.status==='approved'&&c.step.canStart!==false||c.lane==='read'&&c.step.needsYou);
 const rank={approve:0,start:1,read:2};
 return cards.sort((a,b)=>rank[a.lane]-rank[b.lane]||(a.step.at||0)-(b.step.at||0)).slice(0,max)}
// Hub 2.11, the one-path queue: running (newest first), next (the Do next order, all of them), blocked (cannot start: shown with the reason, no button), rest (done and the like).
export function queueOf(tree,area='all'){
 const cards=laneCards(tree,area),next=doNext(tree,Infinity,area),used=new Set(next.map(c=>c.step.key));
 const running=cards.filter(c=>c.lane==='work');running.forEach(c=>used.add(c.step.key));
 const blocked=cards.filter(c=>c.lane==='start'&&!used.has(c.step.key)).sort((a,b)=>(a.step.at||0)-(b.step.at||0));blocked.forEach(c=>used.add(c.step.key));
 return {running,next,blocked,rest:cards.filter(c=>!used.has(c.step.key))}}
// The one plain line under the title.
export function ledeOf(s){
 if(s.denied)return 'You closed this plan. A new revision of it would put it back on your list.';
 switch(s.status){
  case 'waiting':return 'Read the plan below, then approve it. Approving does not start anything or cost tokens.';
  case 'approved':return s.runsOff?'Runs are switched off, so nothing can be started.':s.canStart===false?'This plan is approved but cannot start right now.':'Approved. Starting it is what uses tokens; pick the model and size, then press Start.';
  case 'working':return 'It is working. Nothing to press; you can watch it or stop it.';
  case 'question':return 'The run is waiting for you. Read it and answer.';
  case 'finished':return 'The run is finished. Read the result, then close it.';
  case 'stopped':return 'The run stopped. You can carry on or close it.';
  case 'blocked':return 'The hub cannot start this plan as it is written.';
  case 'done':return 'This step is done.';
  default:return s.meaning||''}}
// The "Then:" line. For a plan waiting for approval it is the part of step.next after the Approve press; otherwise step.next as it is.
export function thenOf(s){
 const n=String(s.next||''),m=/^Read the plan and press Approve\. After that, (.+)$/.exec(n);
 return m?{label:'Then:',text:m[1][0].toUpperCase()+m[1].slice(1)}:{label:s.status==='waiting'?'Then:':'Now:',text:n}}
// The file checks and the quiet notes, taken out of the lane list. Items of kind asset/filecheck are "Assets: N files have problems"; tokens and "found" go to Hub notes.
export function sideItems(tree){
 const items=tree.projects.flatMap(p=>p.items);
 return {files:items.filter(i=>i.kind==='asset'||i.kind==='filecheck'),found:items.filter(i=>i.kind==='found'),notes:items.filter(i=>i.kind!=='asset'&&i.kind!=='filecheck'&&i.kind!=='found')}}
