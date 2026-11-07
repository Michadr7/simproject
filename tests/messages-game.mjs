import assert from 'node:assert/strict';
globalThis.location={search:'?debug',hostname:'localhost',href:'http://localhost/?debug',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');

// The phone's Messages in the game (DESIGN 4.19): every notification is saved with its app, the phone button and each app icon count the unread ones, opening an app reads its messages,
// Messages lists everything newest first and a tap opens the app, and toasts for notifications wait their turn instead of overwriting each other.
const g=await bootGame({});
try{
 const {GameState,pump,ids,win}=g,p=()=>GameState.progress,btn=ids.get('phoneButton'),badge=id=>ids.get('phoneBadge-'+id),city=()=>win.__city;
 assert(!btn.dataset.unread,'nothing unread to begin with');assert.deepEqual(p().messages,[]);
 // a notification: saved, counted on the button and on its app's icon, shows as a toast, shakes the phone
 city().notify('jobs','New order #1 · Greenway Builders · 12 planks');pump(.3);
 assert.equal(p().messages.length,1);assert.deepEqual([p().messages[0].app,p().messages[0].read],['jobs',false]);assert(Number.isInteger(p().messages[0].at),'stamped with the game time');
 assert.equal(btn.dataset.unread,'1');assert(btn.classList.contains('ring')&&btn.classList.contains('has-unread'));assert.match(city().toastState().text,/New order #1/);
 // more, for other apps: the badges are per app, the toast queue keeps the three newest waiting and every message is kept
 city().notify('bank','Rent and bills are due: $60.00');city().notify('store','Your order has arrived');city().notify('jobs','Order #1 failed');city().notify('player','You are getting thirsty');city().notify('store','A vehicle was delivered');
 assert.equal(p().messages.length,6,'all six are saved');assert.equal(btn.dataset.unread,'6');
 {const t=city().toastState();assert.equal(t.showing,true);assert.match(t.text,/New order #1/,'the first one is still showing: later ones did not overwrite it');assert.deepEqual(t.waiting,['Order #1 failed','You are getting thirsty','A vehicle was delivered'],'at most three wait, the newest three')}
 // the phone: opening it does not clear anything; each icon shows its own count; Messages shows the total
 btn.click();assert.equal(btn.dataset.unread,'6');
 for(const [id,n] of [['jobs','2'],['store','2'],['bank','1'],['player','1'],['messages','6']]){assert.equal(badge(id).hidden,false,id+' has a badge');assert.equal(badge(id).textContent,n,id+' count')}
 assert.equal(badge('gigs').hidden,true);assert.equal(badge('homes').hidden,true,'apps with nothing unread show no badge');
 // opening an app reads its messages only
 ids.get('phoneApp-bank').click();assert.equal(badge('bank').hidden,true);assert.equal(btn.dataset.unread,'5');assert(p().messages.filter(m=>m.app==='bank').every(m=>m.read)&&p().messages.filter(m=>m.app==='store').every(m=>!m.read));
 // Messages: newest first, each names its app and time, the unread ones are marked; reading them all; a tap opens the app
 ids.get('phoneBack').click();ids.get('phoneApp-messages').click();
 {const rows=ids.get('phoneMessages').children;assert.equal(rows.length,6);assert.match(rows[0].children[1].textContent,/A vehicle was delivered/,'the newest is first');assert.equal(rows[0].children[0].children[0].textContent,'Store');assert.match(rows[0].children[0].children[1].textContent,/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+:\d\d (AM|PM)$/,'with the game time');
  assert.equal(rows[0].dataset.unread,'true','unread ones are marked as such when the list opens');assert(rows.some(r=>r.dataset.unread==='false'),'the bank one was already read');
  assert.equal(btn.dataset.unread,'','opening Messages reads them all');assert.equal(badge('messages').hidden,true);assert(p().messages.every(m=>m.read));
  rows[3].onclick();assert.equal(ids.get('phoneTitle').textContent,({jobs:'Jobs',store:'Store',bank:'Bank',player:'Player'})[rows[3].dataset.app],'a tap opens that message\'s app: '+ids.get('phoneTitle').textContent)}
 // a message that comes while the phone is open on its own app is read at once; one for another app is not
 city().notify('jobs','Order #2 is staged');assert.equal(btn.dataset.unread,'1','a message for another app waits: '+btn.dataset.unread);
 ids.get('phoneBack').click();ids.get('phoneApp-jobs').click();city().notify('jobs','Order #3 is staged');assert.equal(p().messages[0].read,true,'a message for the app you are looking at is read at once');ids.get('phoneClose').click();
 // nothing was lost: six, then the two staged messages
 assert.equal(p().messages.length,8);
 console.log('PASS messages-game.mjs: every notification is saved with its app and time; the phone button and each app icon count the unread ones; opening the phone clears nothing, opening an app reads its messages, Messages lists everything newest first and reads it all, a tap opens the app; a message for the app you are on is read at once; toasts wait their turn (three newest) instead of overwriting.');
}finally{g.close?.()}
