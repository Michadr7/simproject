// Imported for its side effect by every test that boots the packaged game. The game's own timers (the update check at 2.5 s, a toast at 4.5 s) would keep the test process alive for seconds after the last assertion (about 4.5 s per game boot, 170 s over the suite). They are unref'd: they still fire while the test runs, but they no longer hold the process open. A timer made by the test itself (its stack has no city-* temp folder in it) keeps its normal behaviour.
import {tmpdir} from 'node:os';
if(!globalThis.__gameTimersUnref){
 globalThis.__gameTimersUnref=true;const mark=(tmpdir().replace(/\\/g,'/')+'/city-').toLowerCase(),st=globalThis.setTimeout,si=globalThis.setInterval;
 const wrap=f=>function(fn,ms,...a){const t=f(fn,ms,...a);if(new Error().stack.replace(/\\/g,'/').toLowerCase().includes(mark))t?.unref?.();return t};
 globalThis.setTimeout=wrap(st);globalThis.setInterval=wrap(si)}