// Talk panel: the docked #talk DOM (transcript, reply buttons); conversation-design C5.
// No three.js, no globals. createTalkPanel(root, {onPick,onClose,timer,typingMs}) builds its own children inside root.
// Lines are {who,text} (who: a cast id, 'you', or 'system'); replies are {id,label,asked}.
import {badgeFor,formatChip} from './talk-badge.js';
export const TRANSCRIPT_MAX=6,BYE_ID='bye',CONTINUE_ID='continue',TYPING_MS=350;
const KEYS_LEAVE=['Escape','q','Q'],KEYS_CONFIRM=['Enter','e','E'];
export function createTalkPanel(root,opts){
 const o=opts||{},doc=root.ownerDocument;
 const timer=o.timer||globalThis,setTimer=typeof timer.setTimeout==='function'?timer.setTimeout.bind(timer):null,clearTimer=typeof timer.clearTimeout==='function'?timer.clearTimeout.bind(timer):null;
 const delay=typeof o.typingMs==='number'&&o.typingMs>=0?o.typingMs:TYPING_MS;
 // talk-bug (2026-11-18): the panel lives at body level. 0.35.20's index.html nested #talk inside the hidden #settings, so it could never show in a real browser.
 const body=doc&&doc.body;if(body&&typeof body.appendChild==='function'&&root.parentNode&&root.parentNode!==body)body.appendChild(root);
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
 const head=el('div','talk-head'),nameEl=el('h2','talk-name'),chipEl=el('span','talk-chip'),clockEl=el('span','talk-clock');
 const portrait=el('div','talk-portrait');portrait.setAttribute('aria-hidden','true');
 const who=el('div','talk-who');who.appendChild(nameEl);who.appendChild(chipEl);
 head.appendChild(portrait);head.appendChild(who);head.appendChild(clockEl);
 const log=el('div','talk-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');
 const typingEl=el('div','talk-typing');typingEl.setAttribute('aria-hidden','true');typingEl.hidden=true;
 for(let i=0;i<3;i++)typingEl.appendChild(el('span','talk-dot'));
 const list=el('div','talk-replies');list.setAttribute('role','group');list.setAttribute('aria-label','Your reply');
 const hint=el('p','talk-hint','1-7 or Up/Down then E. Esc: see you.');
 const chevron=el('div','talk-chevron');chevron.setAttribute('aria-hidden','true');chevron.hidden=true;
 root.setAttribute('role','dialog');root.setAttribute('aria-label','Conversation');
 root.appendChild(head);root.appendChild(log);root.appendChild(typingEl);root.appendChild(list);root.appendChild(hint);root.appendChild(chevron);
 let open=false,buttons=[],ids=[],sel=0,speaker='',pendingTyping=[],typingHandle=null;
 const api={};
 const flushTyping=()=>{
  if(typingHandle!==null&&clearTimer){clearTimer(typingHandle);typingHandle=null}
  for(const n of pendingTyping){n.className=n.className.replace(/\s*\btyping\b/g,'');n.classList.toggle('typing',false)}
  pendingTyping=[];typingEl.hidden=true;log.scrollTop=log.scrollHeight;
 };
 const applyChip=(raw)=>{
  chipEl.textContent='';
  const info=formatChip(raw);
  if(!info){chipEl.setAttribute('title','');return}
  if(info.dotColor){const dot=el('span','talk-mood-dot');dot.setAttribute('aria-hidden','true');dot.style.backgroundColor=info.dotColor;chipEl.appendChild(dot)}
  chipEl.appendChild(el('span','talk-chip-text',info.label));
  chipEl.setAttribute('title',info.title);
 };
 const mark=(focus)=>{buttons.forEach((b,i)=>{b.classList.toggle('sel',i===sel)});if(focus&&buttons[sel])buttons[sel].focus()};
 api.setReplies=(replies,focus)=>{
  list.textContent='';buttons=[];ids=[];sel=0;
  let rs=Array.isArray(replies)?replies:[];
  if(!rs.length)rs=[{id:CONTINUE_ID,label:'Continue',asked:false}];
  rs.forEach((r,i)=>{
   const b=el('button','talk-reply'+(r.asked?' asked':''));b.type='button';
   b.appendChild(el('span','talk-num',i+1));b.appendChild(el('span','talk-label',r.label));
   b.addEventListener('click',()=>{sel=i;mark(false);api.confirm()});
   list.appendChild(b);buttons.push(b);ids.push(r.id);
  });
  mark(focus!==false&&open);
 };
 api.append=(line)=>{
  if(!line||typeof line.text!=='string'||!line.text)return;
  const w=line.who===undefined?'':String(line.who);
  const side=w==='you'?'you':w==='system'?'system':'them';
  if(side==='you')flushTyping();
  const b=el('div','talk-line '+side,line.text);
  if(side==='them')speaker=w;
  log.appendChild(b);
  while(log.children.length>TRANSCRIPT_MAX)log.children[0].remove();
  if(side==='them'&&open&&delay>0&&setTimer){
   b.className='talk-line them typing';b.classList.toggle('typing',true);
   pendingTyping.push(b);typingEl.hidden=false;
   if(typingHandle!==null&&clearTimer)clearTimer(typingHandle);
   typingHandle=setTimer(()=>{typingHandle=null;flushTyping()},delay);
  }
  log.scrollTop=log.scrollHeight;
 };
 api.setChip=applyChip;
 api.setClock=(t)=>{clockEl.textContent=t?String(t):''};
 api.show=(d)=>{
  const s=d||{},b=badgeFor(s.name||'');
  flushTyping();
  nameEl.textContent=String(s.name||'');
  portrait.textContent=b.initial;portrait.style.backgroundColor=b.bg;portrait.style.color=b.fg;
  applyChip(s.chip);
  log.textContent='';speaker='';open=true;root.hidden=false;
  (Array.isArray(s.lines)?s.lines:[]).forEach(api.append);
  api.setReplies(s.replies,true);
 };
 api.close=()=>{
  if(!open)return;
  flushTyping();
  open=false;root.hidden=true;chevron.hidden=true;list.textContent='';buttons=[];ids=[];
  if(o.onClose)o.onClose();
 };
 api.focusNext=()=>{if(!buttons.length)return;sel=(sel+1)%buttons.length;mark(true)};
 api.focusPrev=()=>{if(!buttons.length)return;sel=(sel-1+buttons.length)%buttons.length;mark(true)};
 api.confirm=()=>{
  if(!open||!buttons.length)return;
  const id=ids[sel];
  if(id===CONTINUE_ID){api.close();return}
  if(o.onPick)o.onPick(id);
 };
 // Escape/Q: say "See you" when that reply is offered, otherwise just close (hand-offs, ended talks).
 api.leave=()=>{
  if(!open)return;
  if(ids.includes(BYE_ID)&&o.onPick)o.onPick(BYE_ID);else api.close();
 };
 // C6 calls this from its keydown handler while isOpen(); true means the key was used.
 api.handleKey=(key)=>{
  if(!open)return false;
  if(KEYS_LEAVE.includes(key)){api.leave();return true}
  if(key==='ArrowDown'){api.focusNext();return true}
  if(key==='ArrowUp'){api.focusPrev();return true}
  if(KEYS_CONFIRM.includes(key)){api.confirm();return true}
  if(/^[1-7]$/.test(key)){const i=Number(key)-1;if(i<buttons.length){sel=i;mark(true);api.confirm()}return true}
  return false;
 };
 // The speaking chevron: C6 passes smoothed screen pixels; visible=false hides it. One style write.
 api.moveChevron=(x,y,visible)=>{
  chevron.hidden=!(open&&visible);
  if(open&&visible)chevron.style.transform='translate3d('+Math.round(x)+'px,'+Math.round(y)+'px,0)';
 };
 api.isOpen=()=>open;
 api.speaker=()=>speaker;
 root.hidden=true;
 return api;
}
