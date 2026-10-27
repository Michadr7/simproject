import {CONTRACTS} from './contracts.js';
import {money} from './jobs.js';
import {clockText} from './routine.js';
import {weekday} from './housing.js';

// UI only: transactions and movement/cursor ownership stay in game.js.
export function createPhone({document:doc,getState,canOpen,onOpen,onClose,onAccept}){
  const $=id=>doc.getElementById(id);
  let opened=false,screen='home',previousFocus=null;
  $('phoneOverlay').hidden=true;
  const cards=CONTRACTS.map(job=>{
    const card=doc.createElement('article');card.className='phone-contract';
    const title=doc.createElement('h3');title.textContent=job.title;
    const description=doc.createElement('p');description.textContent=job.description;
    const terms=doc.createElement('div');terms.className='phone-contract-terms';terms.textContent=`${money(job.reward)} · ${job.energyCost} energy`;
    const button=doc.createElement('button');button.id='accept-'+job.id;button.className='phone-accept';
    button.onclick=()=>{
      const result=onAccept(job.id);
      if(result?.error){$('phoneMessage').textContent=result.error;refresh();return}
      close();
    };
    card.append(title,description,terms,button);$('phoneContracts').append(card);
    return {job,button};
  });
  function refresh(){
    const state=getState(),progress=state.progress;
    $('phoneClock').textContent=clockText(progress.routine);
    $('phoneDate').textContent=weekday(progress.housing.day)+' · Oak Street';
    $('phoneGreeting').textContent=state.me.name?`Hello, ${state.me.name}.`:'Your life, in reach.';
    $('phoneBalance').textContent=money(progress.cash);
    $('phonePlayerName').textContent=state.me.name||'New neighbor';
    $('phoneEnergy').textContent=Math.round(progress.life.energy)+' / 100';
    $('phoneFood').textContent=Math.round(progress.life.food)+' / 100';
    $('phoneEnergyMeter').value=progress.life.energy;$('phoneFoodMeter').value=progress.life.food;
    $('phoneActiveJob').textContent=progress.activeJob?`Active: ${progress.activeJob.title}. Follow the gold marker.`:'One gig at a time. Energy is spent when you accept.';
    for(const {job,button} of cards){
      const current=progress.activeJob?.id===job.id;
      button.disabled=!!progress.activeJob||progress.life.energy<job.energyCost;
      button.textContent=current?'In progress':progress.activeJob?'Finish active gig':progress.life.energy<job.energyCost?'Not enough energy':'Accept';
    }
  }
  function showScreen(next){
    screen=next;
    for(const name of ['home','gigs','bank','player'])$('phoneScreen-'+name).hidden=name!==screen;
    $('phoneTitle').textContent=screen==='home'?'Your phone':screen[0].toUpperCase()+screen.slice(1);
    $('phoneHome').disabled=screen==='home';$('phoneMessage').textContent='';refresh();
  }
  function open(){
    if(opened||!canOpen())return;
    previousFocus=doc.activeElement;opened=true;onOpen();
    $('phoneOverlay').hidden=false;showScreen('home');$('phoneApp-gigs').focus();
  }
  function close(){
    if(!opened)return;
    opened=false;$('phoneOverlay').hidden=true;onClose();
    previousFocus?.focus?.();
  }
  for(const name of ['gigs','bank','player'])$('phoneApp-'+name).onclick=()=>showScreen(name);
  $('phoneHome').onclick=()=>showScreen('home');$('phoneClose').onclick=close;
  $('phoneButton').onclick=()=>opened?close():open();
  return {open,close,toggle:()=>opened?close():open(),get isOpen(){return opened}};
}
