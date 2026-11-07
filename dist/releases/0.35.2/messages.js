// The phone's Messages (DESIGN 4.19): every notification is kept, newest first, with the app it belongs to, when it came (game time) and whether you have read it. Pure: state in, state out.
//   progress.messages = [{id, app, text, at, read}]  (at: absolute game minutes; at most MAX_MESSAGES; saved with the game)
// An app's icon shows how many of its messages are unread; the phone button shows the total. Opening an app reads its messages, opening Messages reads all of them.
import {formatClock} from './routine.js';
import {weekday} from './housing.js';

export const MAX_MESSAGES=50;
// the phone's apps a message can belong to (the ids of the phone's app buttons), with their names
export const APP_NAMES=Object.freeze({jobs:'Jobs',store:'Store',bank:'Bank',homes:'Housing',player:'Player',gigs:'Gigs'});
export const APPS=Object.freeze(Object.keys(APP_NAMES));
export const messagesOf=progress=>Array.isArray(progress?.messages)?progress.messages:[];

// A new message at the top. Returns {state, message}.
export function addMessage(progress,{app,text,at}){
 const list=messagesOf(progress),id=1+list.reduce((m,x)=>Math.max(m,x.id),0);
 const message={id,app:APP_NAMES[app]?app:'player',text:String(text).slice(0,300),at:Number.isFinite(at)?Math.max(0,Math.floor(at)):0,read:false};
 return {state:{...progress,messages:[message,...list].slice(0,MAX_MESSAGES)},message};
}
// {jobs: n, store: n, ...} for the apps that have unread messages
export function unreadByApp(progress){const out={};for(const m of messagesOf(progress))if(!m.read)out[m.app]=(out[m.app]||0)+1;return out}
export const unreadTotal=progress=>messagesOf(progress).filter(m=>!m.read).length;
// Read one app's messages (app = its id) or every message (app = null). The same object comes back when nothing was unread.
export function markRead(progress,app=null){
 const list=messagesOf(progress);if(!list.some(m=>!m.read&&(!app||m.app===app)))return progress;
 return {...progress,messages:list.map(m=>!m.read&&(!app||m.app===app)?{...m,read:true}:m)};
}
// 'Tue 10:21 AM' for a message's time (the game's own clock and weekday)
export const timeText=at=>`${weekday(Math.floor(at/1440)+1).slice(0,3)} ${formatClock(at%1440)}`;
// Saved messages: junk dropped, text and counts bounded, newest first, ids unique.
export function normalizeMessages(value){
 if(!Array.isArray(value))return [];
 const seen=new Set(),out=[];
 for(const m of value){
  if(!m||typeof m!=='object'||typeof m.text!=='string'||!m.text||!Number.isSafeInteger(m.id)||m.id<1||seen.has(m.id))continue;
  seen.add(m.id);out.push({id:m.id,app:APP_NAMES[m.app]?m.app:'player',text:m.text.slice(0,300),at:Number.isSafeInteger(m.at)&&m.at>=0?m.at:0,read:m.read===true});
 }
 return out.sort((a,b)=>b.id-a.id).slice(0,MAX_MESSAGES);
}
