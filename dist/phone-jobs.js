// The phone's Jobs app (0.35, DESIGN 4.15 G): four views. Shift (clock in and out, today's tasks, pay so far), My job (rank, reputation, what the next rank needs, quit),
// Employers (who hires, owner, hours, ranks) and Pay (the last 7 pay stubs). UI only: the rules are careers.js and shift.js, and game.js runs the transactions.
// getState() -> the game state; isOnSite(employerId) -> boolean; onClockIn(id), onClockOut(), onQuit(id) -> {message}|{error}; say(text) shows a message on the phone.
import {MAP} from './map-definition.js';
import {money} from './jobs.js';
import {formatClock} from './routine.js';
import {weekday} from './housing.js';
import {employerName,ownerOf,careerOf,nextRank} from './careers.js';
import {canClockIn,shiftPay,taskText,OFF_SITE_LIMIT,BONUS_PER_RANK} from './shift.js';
import {itemById} from './items.js';

const TABS=[['shift','Shift'],['job','My job'],['employers','Employers'],['pay','Pay']];
const hours=m=>{const h=Math.floor(m/60),r=Math.round(m%60);return h?`${h} h ${String(r).padStart(2,'0')} min`:`${r} min`};

export function createPhoneJobs({document:doc,getState,isOnSite,onClockIn,onClockOut,onQuit,onCollect,say}){
  const root=doc.getElementById('phoneJobs');let tab='shift',confirmQuit=null;
  const el=(tag,className,text)=>{const e=doc.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
  const button=(label,onclick,{disabled=false,id}={})=>{const b=el('button','phone-accept',label);b.type='button';b.disabled=disabled;if(id)b.id=id;b.onclick=onclick;return b};
  const act=run=>{const r=run()||{};say(r.error||r.message||'');render()};

  function shiftView(progress){
    const out=[],sh=progress.shift;
    if(sh){
      const e=MAP.employers.find(x=>x.id===sh.employer),name=employerName(progress,sh.employer),on=isOnSite(sh.employer),pay=shiftPay(progress);
      const card=el('article','phone-contract');card.append(el('h3',null,name+' · on shift'));
      card.append(el('p','phone-home-status',on?'On site · being paid':`Off site · not paid · clocked out in ${Math.max(0,OFF_SITE_LIMIT-sh.offSiteMinutes)} min`));
      const left=e.hours.to-progress.routine.minutes;card.append(el('p',null,`Shift ends at ${formatClock(e.hours.to)} · ${left>0?hours(left)+' left':'ending now'}`));
      card.append(el('p',null,`Earned so far: ${money(pay.total-pay.bonus)} (wage ${money(pay.wage)}, pieces ${money(pay.piecePay)})`));
      out.push(card);
      out.push(el('h4','phone-heading',"Today's tasks"));
      for(const t of sh.tasks){const row=el('div','phone-need'),done=t.done>=t.target;row.append(el('label',null,taskText(t)),el('strong',null,done?'Done':`${t.done} / ${t.target}`));const m=el('meter');m.min=0;m.max=t.target;m.value=t.done;row.append(m);out.push(row)}
      if(!sh.tasks.length)out.push(el('p','phone-subtitle','No tasks today: you are paid by the hour.'));
      if(sh.tasks.length)out.push(el('p','phone-subtitle',`Finish every task for the shift bonus (${money(BONUS_PER_RANK*careerOf(progress,sh.employer).rank)}).`));
      out.push(button('Clock out',()=>act(onClockOut),{id:'jobs-clockout'}));
      return out;
    }
    const hired=MAP.employers.filter(e=>careerOf(progress,e.id).hired);
    if(!hired.length){out.push(el('p','phone-subtitle','You have no job yet. Open Employers to see who is hiring: you apply in person at their office.'));return out}
    out.push(el('p','phone-subtitle',`Shifts run ${formatClock(MAP.employers[0].hours.from)} to ${formatClock(MAP.employers[0].hours.to)}. It is ${weekday(progress.housing.day)}, ${formatClock(progress.routine.minutes)}.`));
    for(const e of hired){
      const card=el('article','phone-contract'),can=canClockIn(progress,e.id);
      card.append(el('h3',null,employerName(progress,e.id)),el('p',null,`${e.ranks[careerOf(progress,e.id).rank-1].name} · ${money(e.ranks[careerOf(progress,e.id).rank-1].wage)} an hour on site`));
      if(can.error)card.append(el('p','phone-home-status',can.error));
      card.append(button('Clock in',()=>act(()=>onClockIn(e.id)),{disabled:!!can.error,id:'jobs-clockin-'+e.id}));out.push(card)}
    return out;
  }

  function jobView(progress){
    const out=[],hired=MAP.employers.filter(e=>careerOf(progress,e.id).hired);
    if(!hired.length)return [el('p','phone-subtitle','You do not work for anyone yet. Open Employers.')];
    for(const e of hired){
      const c=careerOf(progress,e.id),rank=e.ranks[c.rank-1],n=nextRank(progress,e.id),card=el('article','phone-contract');
      card.append(el('h3',null,employerName(progress,e.id)),el('p',null,`${rank.name} · ${money(rank.wage)} an hour on site · ${c.shifts} shift${c.shifts===1?'':'s'} worked`));
      const rep=el('div','phone-need');rep.append(el('label',null,'Reputation'),el('strong',null,`${c.rep} / 100`));const m=el('meter');m.min=0;m.max=100;m.value=c.rep;rep.append(m);card.append(rep);
      if(n&&!n.top){
        const line=(met,text)=>el('p','phone-home-status',(met?'✓ ':'• ')+text);
        card.append(el('h4','phone-heading','Next rank: '+n.rank.name));
        card.append(line(n.met.level,`${e.skill[0].toUpperCase()+e.skill.slice(1)} level ${n.needs.level} (you are ${n.have.level})`),line(n.met.shifts,`${n.needs.shifts} shifts worked (${n.have.shifts})`),line(n.met.rep,`Reputation ${n.needs.rep} (${n.have.rep})`));
        if(n.ready)card.append(el('p','phone-active-job',`${ownerOf(progress,e.id).name} wants to see you: ask for your promotion at the office.`));
      }else card.append(el('p','phone-home-status','You are at the top rank.'));
      if(c.owed.length){card.append(el('p','phone-home-status','Waiting for you at the office: '+c.owed.map(id=>itemById(id)?.name||id).join(', ')+'.'));card.append(button('Collect',()=>act(()=>onCollect(e.id)),{id:'jobs-collect-'+e.id}))}
      const quitting=confirmQuit===e.id;
      const quitButton=button(quitting?'Really quit? Rank resets':'Quit this job',()=>{if(!quitting){confirmQuit=e.id;render();return}confirmQuit=null;act(()=>onQuit(e.id))},{id:'jobs-quit-'+e.id});quitButton.className+=quitting?' phone-quit phone-quit-sure':' phone-quit';card.append(quitButton);
      out.push(card)}
    return out;
  }

  function employersView(progress){
    const out=[el('p','phone-subtitle','Apply in person at the office. Everyone starts at the bottom, and you can work for as many employers as you like (one shift at a time).')];
    for(const e of MAP.employers){
      const c=careerOf(progress,e.id),owner=ownerOf(progress,e.id),card=el('article','phone-contract'),office=MAP.properties.find(p=>p.id===e.office);
      card.append(el('h3',null,employerName(progress,e.id)),el('p',null,`Owner: ${owner.name}${owner.kind==='npc'?'':' (player)'} · Office: ${office?.name||e.office}`),
        el('p',null,`Shifts ${formatClock(e.hours.from)} to ${formatClock(e.hours.to)} · last clock-in ${formatClock(e.hours.lastIn)}`),
        el('p','phone-home-status',c.hired?`You work here: ${e.ranks[c.rank-1].name}.`:'Not hired: apply at the office.'));
      const ranks=el('ol','phone-ranks');for(const r of e.ranks){const li=el('li',null,`${r.name} · ${money(r.wage)}/h · level ${r.needs.level}`);if(c.hired&&e.ranks[c.rank-1]===r)li.className='phone-rank-now';ranks.append(li)}
      card.append(ranks);out.push(card)}
    return out;
  }

  function payView(progress){
    const stubs=progress.payStubs||[];if(!stubs.length)return [el('p','phone-subtitle','No pay stubs yet. They appear when a shift ends.')];
    return stubs.map(s=>{const card=el('article','phone-contract');
      card.append(el('h3',null,`${s.name||employerName(progress,s.employer)} · ${weekday(s.day)}, day ${s.day}`),
        el('p',null,`${formatClock(s.from)} to ${formatClock(s.to)} · ${hours(s.paidMinutes)} paid${s.reason==='off-site'?' · left the site':s.reason==='end-of-day'?' · shift ended':''}`),
        el('p',null,`Wage ${money(s.wage)} · pieces ${money(s.piecePay)}${s.bonus?` · bonus ${money(s.bonus)}`:''}`),
        el('p','phone-home-status',`Tasks ${s.tasksDone} / ${s.tasksTotal} · Total ${money(s.total)}`));return card});
  }

  function render(){
    const progress=getState().progress,bar=el('div','phone-tabs');
    for(const [id,label] of TABS){const b=el('button','phone-tab',label);b.type='button';b.id='jobs-tab-'+id;b.setAttribute('aria-selected',String(tab===id));b.onclick=()=>{tab=id;confirmQuit=null;say('');render()};bar.append(b)}
    const view={shift:shiftView,job:jobView,employers:employersView,pay:payView}[tab](progress);
    root.replaceChildren(bar,...view);
  }
  return {render,reset(){tab='shift';confirmQuit=null},showTab(id){if(TABS.some(([t])=>t===id))tab=id}};
}
