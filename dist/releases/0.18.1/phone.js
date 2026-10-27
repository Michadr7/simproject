import {ITEMS} from './items.js';
import {CONTRACTS,availableContracts} from './contracts.js';
import {money} from './jobs.js';
import {clockText} from './routine.js';
import {weekday} from './housing.js';

// UI only: transactions and movement/cursor ownership stay in game.js.
export function createPhone({document:doc,getState,canOpen,onOpen,onClose,onAccept,onRefresh,onDrainChange,onGrantItem}){
  const $=id=>doc.getElementById(id);
  let opened=false,screen='home',previousFocus=null;
  $('phoneOverlay').hidden=true;
  for(const item of ITEMS){const option=doc.createElement('option');option.value=item.id;option.textContent=item.icon+' '+item.name;$('phoneTestItem').append(option)}
  $('phoneTestItem').value=ITEMS[0].id;
  $('phoneDrainMultiplier').onchange=()=>{onDrainChange($('phoneDrainMultiplier').value);refresh()};
  $('phoneGrantItem').onclick=()=>{const result=onGrantItem($('phoneTestItem').value);$('phoneMessage').textContent=result.error||result.message;refresh()};
  const cards=CONTRACTS.map(job=>{
    const card=doc.createElement('article');card.className='phone-contract';
    const title=doc.createElement('h3');title.textContent=job.title;
    const description=doc.createElement('p');description.textContent=job.description;
    const terms=doc.createElement('div');terms.className='phone-contract-terms';terms.textContent=`${money(job.reward)} · ${job.mode==='timed'?job.duration+'s task':job.mode==='courier'?'20m run':'Heavy load'}`;
    const button=doc.createElement('button');button.id='accept-'+job.id;button.className='phone-accept';
    button.onclick=()=>{
      const result=onAccept(job.id);
      if(result?.error){$('phoneMessage').textContent=result.error;refresh();return}
      close();
    };
    card.append(title,description,terms,button);$('phoneContracts').append(card);
    return {job,button,card};
  });
  function refresh(){
    onRefresh?.();const state=getState(),progress=state.progress;
    const available=new Set(availableContracts(progress).map(job=>job.id));
    $('phoneClock').textContent=clockText(progress.routine);
    $('phoneDate').textContent=weekday(progress.housing.day)+' · Oak Street';
    $('phoneGreeting').textContent=state.me.name?`Hello, ${state.me.name}.`:'Your life, in reach.';
    $('phoneBalance').textContent=money(progress.cash);
    $('phonePlayerName').textContent=state.me.name||'New neighbor';
    $('phoneEnergy').textContent=Math.round(progress.life.energy)+' / 100';
    $('phoneFood').textContent=Math.round(progress.life.food)+' / 100';
    $('phoneEnergyMeter').value=progress.life.energy;$('phoneFoodMeter').value=progress.life.food;
    $('phoneThirst').textContent=Math.round(progress.life.thirst)+' / 100';$('phoneThirstMeter').value=progress.life.thirst;
    $('phoneDrainMultiplier').value=String(progress.settings.statDrainMultiplier);
    $('phoneActiveJob').textContent=progress.activeJob?`Active: ${progress.activeJob.title}. Follow the gold marker.`:available.size?'No upfront energy charge. Offers refresh every 30 game minutes.': 'No offers right now. Check back after the board refreshes.';
    for(const {job,button,card} of cards){
      card.hidden=!available.has(job.id);
      const current=progress.activeJob?.id===job.id;
      button.disabled=!!progress.activeJob;
      button.textContent=current?'In progress':progress.activeJob?'Finish active gig':'Accept';
    }
  }
  function showScreen(next){
    screen=next;
    for(const name of ['home','gigs','bank','player','settings'])$('phoneScreen-'+name).hidden=name!==screen;
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
  for(const name of ['gigs','bank','player','settings'])$('phoneApp-'+name).onclick=()=>showScreen(name);
  $('phoneHome').onclick=()=>showScreen('home');$('phoneClose').onclick=close;
  $('phoneButton').onclick=()=>opened?close():open();
  return {open,close,toggle:()=>opened?close():open(),get isOpen(){return opened}};
}
