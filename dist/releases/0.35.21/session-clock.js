// The session game clock (MP-CLOCK, DESIGN.md 4.17 shared clock): one place every system reads "what game time is it in this session".
// Pure: no DOM, no sockets, no Date.now. Alone or as the host it mirrors the saved clock (setLocal); as a joiner it follows the host's broadcast (receiveHost),
// running at the same rate and easing any drift over about 2 game minutes (no jumps). Mode 'visit' leaves the saved day/time alone; 'sync' makes the save follow.
// Reading (day, minutes, abs, now()) never allocates, so it is safe to call every frame. Weather will be weatherAt(x,z,session.abs).
export const GAME_MINUTES_PER_SECOND=.5; // the same as population.js; tests/session-clock.mjs checks it
export const CLOCK_INTERVAL_S=30; // the host broadcasts this often (real seconds)
export const EASE_GAME_MINUTES=2; // a drift is paid back over about this many game minutes
export const MAX_CATCHUP_PER_S=2; // never move the clock faster than this many extra game minutes per real second while easing
export const SNAP_GAME_MINUTES=15; // a drift beyond this is not eased (easing would freeze or race the clock for many seconds): it jumps once (a long freeze, a new host)
export const MODES=['local','visit','sync'];
export const dayMinute=abs=>({day:Math.floor(abs/1440)+1,minutes:abs-Math.floor(abs/1440)*1440});
export const absOf=(day,minutes)=>(day-1)*1440+minutes;
export const validClock=m=>!!m&&Number.isInteger(m.day)&&m.day>=1&&m.day<=100000&&Number.isFinite(m.minutes)&&m.minutes>=0&&m.minutes<1440;
export const clockMessage=(day,minutes)=>({type:'clock',day,minutes});

export function makeSessionClock({rate=GAME_MINUTES_PER_SECOND,interval=CLOCK_INTERVAL_S}={}){
 const view={day:1,minutes:540,abs:540}; // the one shared, mutated read object: do not keep it, read it
 let abs=540,debt=0,host=true,mode='local',lastHost=-Infinity,synced=false,sinceSend=0;
 const publish=()=>{view.abs=abs;view.day=Math.floor(abs/1440)+1;view.minutes=abs-(view.day-1)*1440};
 const clock={
  get day(){return view.day},get minutes(){return view.minutes},get abs(){return view.abs},
  now(){return view},
  get mode(){return mode},get isHost(){return host},get synced(){return synced},get debt(){return debt},
  // The clock follows the host only in 'visit' and 'sync'. 'local' (alone, or the host) is driven by setLocal.
  get following(){return mode!=='local'&&!host},
  get savedClockMoves(){return mode!=='visit'}, // false: the saved day/time and every day-based system stay still
  setMode(m){if(!MODES.includes(m))return false;mode=m;return true},
  setHost(isHost){const was=host;host=!!isHost;if(was!==host){lastHost=-Infinity;debt=0}return host},
  // Local source (alone or host): the saved clock is the session clock.
  setLocal(day,minutes){if(!Number.isFinite(day)||!Number.isFinite(minutes))return false;abs=absOf(day,minutes);debt=0;publish();return true},
  // Real seconds passed. In local mode the saved clock drives time (setLocal), so this does nothing there.
  advance(dt){
   if(!(dt>0)||mode==='local'&&host)return;
   let move=dt*rate;
   if(debt!==0&&!host){
    // pay the drift back linearly over EASE_GAME_MINUTES of game time, never faster than MAX_CATCHUP_PER_S, and never so slow that time runs backwards
    const pay=Math.min(Math.abs(debt),Math.abs(debt)/EASE_GAME_MINUTES*move+1e-9,MAX_CATCHUP_PER_S*dt)*Math.sign(debt);
    const net=Math.max(0,move+pay);debt-=net-move;if(Math.abs(debt)<.02)debt=0;move=net; // under about a game second left counts as paid
   }
   abs+=move;publish();
  },
  // A host broadcast. Ignored by the host itself, when malformed, or older than one already seen. The first one (the join) is taken immediately.
  receiveHost(message){
   if(host||!validClock(message))return false;
   const target=absOf(message.day,message.minutes);
   if(target<lastHost)return false;
   lastHost=target;
   if(!synced||Math.abs(target-abs)>SNAP_GAME_MINUTES){abs=target;debt=0;synced=true;publish();return true}
   debt=target-abs;return true;
  },
  // Host side: true once every `interval` real seconds (and force=true to send right now, for a player who just joined).
  dueBroadcast(dt,force=false){
   sinceSend+=dt>0?dt:0;
   if(!host)return false;
   if(force||sinceSend>=interval){sinceSend=0;return true}
   return false;
  },
  hostMessage(){return clockMessage(view.day,view.minutes)},
  reset(){abs=540;debt=0;host=true;mode='local';lastHost=-Infinity;synced=false;sinceSend=0;publish()}
 };
 return clock;
}

// What the join dialog says (shown only to a joiner, once the host's time is known).
export const SYNC_WARNING='Syncing moves your save to the host\'s day and time. Crops will grow, rent may fall due, your cat can go hungry and gig timers will run. This cannot be undone.';
export const VISIT_NOTE='You use the host\'s clock, sky and weather. Your own save day and time stay as they are, and your crops, rent, pet and gig timers wait for you.';
// Can this save sync? Not when the host's day is earlier than the save's (that would turn your calendar back).
export function canSync(savedAbs,hostAbs){return Number.isFinite(savedAbs)&&Number.isFinite(hostAbs)&&hostAbs>=savedAbs}
// How many game minutes a sync would add to the save.
export const syncAdvance=(savedAbs,hostAbs)=>Math.max(0,hostAbs-savedAbs);
