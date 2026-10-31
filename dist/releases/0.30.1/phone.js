import {levelOf,perkText,perksText} from './skills.js';
import {ITEMS} from './items.js';
import {CONTRACTS,availableContracts} from './contracts.js';
import {money} from './jobs.js';
import {clockText} from './routine.js';
import {weekday} from './housing.js';
import {LISTED} from './ownership.js';

// UI only: transactions and movement/cursor ownership stay in game.js.
export function createPhone({document:doc,getState,canOpen,onOpen,onClose,onAccept,onRefresh,onDrainChange,onGrantItem,onHomeAction}){
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
  // The Homes app: one card per home for rent or sale (built once, updated in place): a status line and the buttons that apply to where you stand with it.
  const homeCards=LISTED.map(h=>{
    const card=doc.createElement('article');card.className='phone-contract phone-home';
    const title=doc.createElement('h3');title.textContent=h.name;
    const terms=doc.createElement('p');terms.textContent=`Rent ${money(h.rentCents)} a week · deposit ${money(h.depositCents)} · buy for ${money(h.priceCents)}`;
    const status=doc.createElement('p');status.className='phone-home-status';
    const actions=doc.createElement('div');actions.className='phone-home-actions';
    const buttons={};
    for(const [action,label] of [['rent','Rent'],['buy','Buy'],['pay','Pay rent'],['leave','Move out']]){
      const button=doc.createElement('button');button.id=`home-${action}-${h.id}`;button.className='phone-accept';button.textContent=label;
      button.onclick=()=>{const result=onHomeAction?.(action,h.id)||{};$('phoneMessage').textContent=result.error||result.message||'';refresh()};
      buttons[action]=button;actions.append(button);
    }
    card.append(title,terms,status,actions);$('phoneHomes').append(card);
    return {h,status,buttons};
  });
  function refresh(){
    onRefresh?.();const state=getState(),progress=state.progress;
    const available=new Set(availableContracts(progress).map(job=>job.id));
    $('phoneClock').textContent=clockText(progress.routine);
    $('phoneDate').textContent=weekday(progress.housing.day)+' · Oak Street';
    $('phoneGreeting').textContent=state.me.name?`Hello, ${state.me.name}.`:'Your life, in reach.';
    $('phoneBalance').textContent=money(progress.cash);
    $('phonePlayerName').textContent=state.me.name||'New neighbor';
    {const xp=progress.skills.lumberjack.xp,{level,into,next}=levelOf(xp);
     $('phoneLumberLevel').textContent=level>=20?'Lv 20 · max':'Lv '+level;$('phoneLumberMeter').max=next||1;$('phoneLumberMeter').value=next?into:1;
     $('phoneLumberPerks').textContent=perksText(level);$('phoneLumberNext').textContent=level>=20?'Every perk unlocked.':`${into} / ${next} XP to level ${level+1}: ${perkText(level+1)}`;
     $('phoneTrees').textContent=String(progress.stats.treesFelled);$('phoneLogs').textContent=String(progress.stats.logsCollected);$('phoneDeliveries').textContent=String(progress.completed)}
    $('phoneEnergy').textContent=Math.round(progress.life.energy)+' / 100';
    $('phoneFood').textContent=Math.round(progress.life.food)+' / 100';
    $('phoneEnergyMeter').value=progress.life.energy;$('phoneFoodMeter').value=progress.life.food;
    $('phoneThirst').textContent=Math.round(progress.life.thirst)+' / 100';$('phoneThirstMeter').value=progress.life.thirst;
    $('phoneDrainMultiplier').value=String(progress.settings.statDrainMultiplier);
    $('phoneActiveJob').textContent=progress.activeJob?`Active: ${progress.activeJob.title}. Follow the gold marker.`:available.size?'No upfront energy charge. Offers refresh every 30 game minutes.': 'No offers right now. Check back after the board refreshes.';
    for(const {h,status,buttons} of homeCards){
      const held=progress.properties?.[h.id],renting=held?.tenure==='rent',owning=held?.tenure==='own';
      status.textContent=owning?'You own this home.':renting?(held.rentDue?`Rent overdue: ${money(held.rentDue)}.`:`Renting · rent due in ${Math.max(0,held.nextBillDay-progress.housing.day)} days.`):'For rent or sale.';
      buttons.rent.hidden=!!held;buttons.buy.hidden=owning;buttons.pay.hidden=!(renting&&held.rentDue>0);buttons.leave.hidden=!renting;
      buttons.buy.textContent=renting?`Buy · ${money(h.priceCents-held.deposit)}`:`Buy · ${money(h.priceCents)}`;
    }
    for(const {job,button,card} of cards){
      card.hidden=!available.has(job.id);
      const current=progress.activeJob?.id===job.id;
      button.disabled=!!progress.activeJob;
      button.textContent=current?'In progress':progress.activeJob?'Finish active gig':'Accept';
    }
  }
  function showScreen(next){
    screen=next;
    for(const name of ['home','gigs','bank','homes','player','settings'])$('phoneScreen-'+name).hidden=name!==screen;
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
  for(const name of ['gigs','bank','homes','player','settings'])$('phoneApp-'+name).onclick=()=>showScreen(name);
  $('phoneHome').onclick=()=>showScreen('home');$('phoneClose').onclick=close;
  $('phoneButton').onclick=()=>opened?close():open();
  return {open,close,toggle:()=>opened?close():open(),get isOpen(){return opened}};
}
