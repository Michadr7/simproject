import assert from 'node:assert/strict';
import {addMessage,markRead,unreadByApp,unreadTotal,messagesOf,timeText,normalizeMessages,MAX_MESSAGES,APPS,APP_NAMES} from '../dist/messages.js';

// The phone's Messages (DESIGN 4.19): saved newest first with an app, a game time and a read flag.
{let p={};const m1=addMessage(p,{app:'jobs',text:'New order #1',at:2*1440+430});assert.equal(m1.message.id,1);assert.equal(m1.message.read,false);p=m1.state;
 p=addMessage(p,{app:'store',text:'Your order has arrived',at:2*1440+500}).state;p=addMessage(p,{app:'jobs',text:'Order failed',at:2*1440+900}).state;
 assert.deepEqual(messagesOf(p).map(m=>m.id),[3,2,1],'newest first');assert.deepEqual(unreadByApp(p),{jobs:2,store:1});assert.equal(unreadTotal(p),3);
 assert.equal(addMessage(p,{app:'nowhere',text:'x',at:1}).message.app,'player','an unknown app is the Player\'s');assert.equal(addMessage({},{app:'bank',text:'t'.repeat(500),at:-5}).message.text.length,300,'long text is cut');assert.equal(addMessage({},{app:'bank',text:'x',at:-5}).message.at,0);
 // opening an app reads its messages only; Messages (null) reads all; nothing unread: the same object
 const afterJobs=markRead(p,'jobs');assert.deepEqual(unreadByApp(afterJobs),{store:1});assert.equal(afterJobs.messages.find(m=>m.id===2).read,false);assert.equal(markRead(afterJobs,'jobs'),afterJobs,'nothing to read: unchanged');
 const all=markRead(p,null);assert.equal(unreadTotal(all),0);assert.equal(markRead(all,null),all);assert.equal(p.messages[0].read,false,'the old state is never changed')}
// at most 50, the oldest dropped
{let p={};for(let i=1;i<=60;i++)p=addMessage(p,{app:'jobs',text:'m'+i,at:i}).state;assert.equal(messagesOf(p).length,MAX_MESSAGES);assert.equal(messagesOf(p)[0].text,'m60');assert.equal(messagesOf(p).at(-1).text,'m11');assert.equal(addMessage(p,{app:'jobs',text:'next',at:99}).message.id,61,'ids keep counting')}
// the time as the game shows it
assert.equal(timeText(1440+630),'Tue 10:30 AM','day 2 is Tuesday');assert.equal(timeText(2*1440+630),'Wed 10:30 AM');assert.equal(timeText(0),'Mon 12:00 AM');
// saved: junk dropped, bounded, newest first
{const n=normalizeMessages([{id:1,app:'jobs',text:'a',at:5,read:true},{id:3,app:'bank',text:'c',at:9},{id:3,app:'bank',text:'dup',at:9},{id:2,app:'zzz',text:'b',at:7,read:'yes'},{id:'x',app:'jobs',text:'bad'},{id:4,app:'jobs',text:''},null,'str',{id:5,app:'jobs',text:'e'.repeat(900),at:-4}]);
 assert.deepEqual(n.map(m=>[m.id,m.app,m.read]),[[5,'jobs',false],[3,'bank',false],[2,'player',false],[1,'jobs',true]],'newest first, unknown app to Player, read only when exactly true, junk and duplicates dropped');assert.equal(n[0].text.length,300);assert.equal(n[0].at,0);
 assert.deepEqual(normalizeMessages(null),[]);assert.equal(normalizeMessages(Array.from({length:90},(_,i)=>({id:i+1,app:'jobs',text:'x'}))).length,MAX_MESSAGES)}
assert.deepEqual(APPS,Object.keys(APP_NAMES));assert.equal(APP_NAMES.homes,'Housing');
console.log('PASS messages.mjs: saved newest first with an app, time and read flag (at most 50, text cut at 300), unread counts per app and in total, reading one app or all, the game weekday and clock, and a clean save.');