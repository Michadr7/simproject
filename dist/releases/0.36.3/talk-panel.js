// Talk panel: the docked #talk DOM (transcript, reply buttons); conversation-design C5 & hydrogen-talk-panel-fit.
// No three.js, no globals. createTalkPanel(root, {onPick,onClose,timer,typingMs}) builds its own children inside root.
// Lines are {who,text} (who: a cast id, 'you', or 'system'); replies are {id,label,asked}.
import {badgeFor,formatChip} from './talk-badge.js';
import {MAX_VISIBLE_LINES,CHARS_PER_LINE,FADE_MS,visibleLines,replyLayout} from './talk-fit.js';
export const TRANSCRIPT_MAX=6,BYE_ID='bye',CONTINUE_ID='continue',MORE_ID='__more__',TYPING_MS=350;
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
 const sheet=el('div','talk-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','Full reply');sheet.hidden=true;
 const sheetText=el('div','talk-sheet-text'),sheetClose=el('button','talk-sheet-close','Close');sheetClose.type='button';
 sheet.appendChild(sheetText);sheet.appendChild(sheetClose);
 root.setAttribute('role','dialog');root.setAttribute('aria-label','Conversation');
 root.appendChild(head);root.appendChild(log);root.appendChild(typingEl);root.appendChild(list);root.appendChild(hint);root.appendChild(chevron);root.appendChild(sheet);
 let open=false,buttons=[],ids=[],sel=0,speaker='',pendingTyping=[],typingHandle=null,fadeHandle=null,entries=[],allReplies=[],replyPage=0;
 const api={};
 const closeSheet=()=>{sheet.hidden=true};
 sheetClose.addEventListener('click',closeSheet);
 const setClass=(node,cls,on)=>{
  node.classList.toggle(cls,on);
  const parts=node.className?node.className.split(/\s+/).filter(Boolean):[];
  const has=parts.includes(cls);
  if(on&&!has)node.className=[...parts,cls].join(' ');
  else if(!on&&has)node.className=parts.filter(c=>c!==cls).join(' ');
 };
 const flushFade=()=>{
  if(fadeHandle!==null&&clearTimer){clearTimer(fadeHandle);fadeHandle=null}
  entries=entries.filter(e=>{if(!e.fading)return true;e.node.remove();return false});
 };
 const flushTyping=()=>{
  if(typingHandle!==null&&clearTimer){clearTimer(typingHandle);typingHandle=null}
  for(const n of pendingTyping)setClass(n,'typing',false);
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
 const renderReplies=(focus)=>{
  list.textContent='';buttons=[];ids=[];sel=0;
  const lay=replyLayout(allReplies,{page:replyPage});
  setClass(list,'grid',lay.columns===2);
  const addBtn=(r,i)=>{
   const b=el('button','talk-reply'+(r.asked?' asked':''));b.type='button';
   b.title=r.label;
   b.appendChild(el('span','talk-num',i+1));b.appendChild(el('span','talk-label',r.label));
   b.addEventListener('click',()=>{sel=i;mark(false);api.confirm()});
   list.appendChild(b);buttons.push(b);ids.push(r.id);
  };
  lay.items.forEach((r,i)=>addBtn(r,i));
  if(lay.hasMore)addBtn({id:MORE_ID,label:`More (${lay.remaining})`,asked:false},lay.items.length);
  mark(focus!==false&&open);
 };
 api.setReplies=(replies,focus)=>{
  let rs=Array.isArray(replies)?replies:[];
  if(!rs.length)rs=[{id:CONTINUE_ID,label:'Continue',asked:false}];
  allReplies=rs;replyPage=0;
  renderReplies(focus);
 };
 api.append=(line)=>{
  if(!line||typeof line.text!=='string'||!line.text)return;
  const w=line.who===undefined?'':String(line.who);
  const side=w==='you'?'you':w==='system'?'system':'them';
  if(side==='you')flushTyping();
  const b=el('div','talk-line '+side,line.text);
  if(side==='them')speaker=w;
  log.appendChild(b);
  const entry={node:b,text:line.text,fading:false,moreBtn:null};
  entries.push(entry);
  while(entries.length>TRANSCRIPT_MAX){entries.shift().node.remove()}
  const active=entries.filter(e=>!e.fading);
  const kept=visibleLines(active,MAX_VISIBLE_LINES,CHARS_PER_LINE);
  const keptMap=new Map(kept.map(k=>[k.line,k]));
  let anyFading=false;
  for(const e of active){
   const info=keptMap.get(e);
   if(!info){
    e.fading=true;anyFading=true;
    setClass(e.node,'fading',true);
    e.node.style.opacity='0';
   }else{
    e.node.style.opacity=info.fade<1?String(info.fade):'';
    setClass(e.node,'shrink',info.shrink);
    setClass(e.node,'clamp',info.clamp);
    if(info.clamp&&!e.moreBtn){
     const more=el('button','talk-more-btn','more');more.type='button';
     more.addEventListener('click',()=>{sheetText.textContent=e.text;sheet.hidden=false;sheetClose.focus()});
     e.node.appendChild(more);e.moreBtn=more;
    }
   }
  }
  if(anyFading&&setTimer){
   if(fadeHandle!==null&&clearTimer)clearTimer(fadeHandle);
   fadeHandle=setTimer(()=>{fadeHandle=null;flushFade()},FADE_MS);
  }
  if(side==='them'&&open&&delay>0&&setTimer){
   setClass(b,'typing',true);
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
  flushTyping();flushFade();closeSheet();
  nameEl.textContent=String(s.name||'');
  portrait.textContent=b.initial;portrait.style.backgroundColor=b.bg;portrait.style.color=b.fg;
  applyChip(s.chip);
  log.textContent='';entries=[];speaker='';open=true;root.hidden=false;
  (Array.isArray(s.lines)?s.lines:[]).forEach(api.append);
  api.setReplies(s.replies,true);
 };
 api.close=()=>{
  if(!open)return;
  flushTyping();flushFade();closeSheet();
  open=false;root.hidden=true;chevron.hidden=true;list.textContent='';buttons=[];ids=[];allReplies=[];
  if(o.onClose)o.onClose();
 };
 api.focusNext=()=>{if(!buttons.length)return;sel=(sel+1)%buttons.length;mark(true)};
 api.focusPrev=()=>{if(!buttons.length)return;sel=(sel-1+buttons.length)%buttons.length;mark(true)};
 api.confirm=()=>{
  if(!open||!buttons.length)return;
  const id=ids[sel];
  if(id===MORE_ID){replyPage++;renderReplies(true);return}
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
  if(!sheet.hidden&&KEYS_LEAVE.includes(key)){closeSheet();return true}
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
