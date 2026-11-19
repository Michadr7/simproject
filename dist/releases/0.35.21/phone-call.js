// PH1: the phone's Call app (UI only; the rules are phone-calls.js and the tow is garage.js towTo, run by game.js through onTow).
// Flow: contact list -> keypad tone -> ringing (1 to 2 s) -> answered (pick-up click, a line, for the tow service a list of your vehicles) or busy (busy tone, 'Line busy') -> Hang up.
// getState() -> game state; inVehicle() -> bool (are you in a vehicle now); onTow(uid) -> {message}|{error}; audio: {unlock, phone(name,{loop}) -> stop()} or null; timers: {set, clear} (setTimeout/clearTimeout, replaceable in tests).
import {CONTACTS,KIND_LABEL,dial,towOptions,towLabel,pullLabel} from './phone-calls.js';
import {statusOf,hoursNow} from './garage.js';
import {vehicleLabel} from './orders.js';

// TR4: pullInfo() -> {cents, hours} when the vehicle under you is Stuck or on soft ground, else null; onPull() -> {message}|{error} (the game moves the vehicle and charges).
export function createPhoneCall({document:doc,getState,inVehicle,onTow,pullInfo=null,onPull=null,audio=null,timers={set:(f,ms)=>setTimeout(f,ms),clear:h=>clearTimeout(h)}}){
  const root=doc.getElementById('phoneCall');let call=null,pending=[],stopTone=null;
  const el=(tag,className,text)=>{const e=doc.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
  const button=(label,onclick,id)=>{const b=el('button','phone-accept',label);b.type='button';if(id)b.id=id;b.onclick=onclick;return b};
  const later=(fn,seconds)=>{pending.push(timers.set(fn,seconds*1000))};
  const sound=(name,opts)=>{try{return audio?.phone?.(name,opts)||null}catch{return null}};
  const stopSounds=()=>{try{stopTone?.()}catch{}stopTone=null};
  const clearTimers=()=>{for(const h of pending)timers.clear(h);pending=[]};
  function render(){
    const rows=[];
    if(!call){
      rows.push(el('p','phone-subtitle','Call a business, a service or a neighbor.'));
      for(const kind of Object.keys(KIND_LABEL)){const list=CONTACTS.filter(c=>c.kind===kind);if(!list.length)continue;
        rows.push(el('h4','phone-heading',KIND_LABEL[kind]));
        for(const c of list)rows.push(button(`${c.name} · ${c.number}`,()=>start(c.id),'call-'+c.id))}
    }else{
      const card=el('article','phone-contract phone-call');card.append(el('h3','',call.contact.name),el('p','phone-home-status',call.contact.number));
      const status=el('p','phone-call-line',call.text);status.id='callLine';status.dataset.state=call.state;card.append(status);
      if(call.pull)card.append(button(pullLabel(call.pull),pullMe,'call-pull'));
      if(call.options)for(const o of call.options){const b=button(`${o.label} · ${towLabel(o)}`,()=>choose(o.uid),'call-tow-'+o.uid);b.disabled=o.inShop;card.append(b)}
      const hang=button('Hang up',hangUp,'callHangup');hang.classList.add('phone-hangup');card.append(hang);rows.push(card);
    }
    root.replaceChildren(...rows);
  }
  function start(id){
    if(call)return;const state=getState(),r=dial(id,{inVehicle:!!inVehicle?.(),minutes:state.progress.routine?.minutes??0,pull:!!pullInfo?.()});
    audio?.unlock?.();sound('key');
    call={contact:r.contact,result:r,state:'ringing',text:'Calling…',options:null};render();
    if(r.outcome==='busy'){later(()=>{if(!call)return;stopSounds();stopTone=sound('busy',{loop:true});call.state='busy';call.text=r.line;render()},.3);later(()=>stopSounds(),3.8);return}
    later(()=>{if(call)stopTone=sound('ring')},.3);
    later(()=>{if(!call)return;stopSounds();sound('pickup');call.state=r.outcome;call.text=r.line;
      if(r.pull)call.pull=pullInfo?.()||null;
      if(r.pick)call.options=towOptions(state.progress.vehicles,uid=>statusOf(getState().progress,uid,hoursNow(getState().progress)),v=>vehicleLabel(v.model,v.colour));render()},.3+r.ringSeconds);
  }
  function choose(uid){
    if(!call||call.state!=='answered')return;const r=onTow?.(uid)||{error:'Not available.'};
    if(r.error){call.text=r.error;call.options=towOptions(getState().progress.vehicles,u=>statusOf(getState().progress,u,hoursNow(getState().progress)),v=>vehicleLabel(v.model,v.colour));call.state='answered'}
    else{call.text=r.message;call.options=null;call.state='done'}
    render();
  }
  function pullMe(){
    if(!call||call.state!=='answered')return;const r=onPull?.()||{error:'Not available.'};
    if(r.error){call.text=r.error;call.pull=pullInfo?.()||null}else{call.text=r.message;call.options=null;call.pull=null;call.state='done'}
    render();
  }
  function hangUp(){if(!call)return;clearTimers();stopSounds();call=null;sound('hangup');render()}
  // Leaving the screen ends the call without the hang-up click.
  function reset(){clearTimers();stopSounds();call=null;render()}
  render();
  return {render,reset,hangUp,get active(){return !!call},get state(){return call?call.state:'idle'}};
}
