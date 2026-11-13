// Mikkadr Hub 2.6: the sounds. Pure rules (which change deserves which sound, the switches, the cooldown) and the wiring; the tones themselves are Web Audio and were not heard here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SOUNDS,DEFAULTS,COOLDOWN_MS,readSettings,soundFor,shouldPlay} from '../hub/web/sound.js';
import {activityOf} from '../hub/server.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// off by default; each sound has its own switch; broken stored settings fall back to the defaults
assert.equal(DEFAULTS.on,false,'off until the owner turns it on');assert.deepEqual(SOUNDS.map(s=>s.key),['finished','needs','stopped']);
for(const s of SOUNDS){assert.ok(s.label&&s.about&&s.notes.length>=2);assert.ok(s.key in DEFAULTS,'each sound has a switch')}
assert.deepEqual(readSettings(null),DEFAULTS);assert.deepEqual(readSettings('{nope'),DEFAULTS);assert.deepEqual(readSettings('{"on":true,"needs":false,"x":1,"stopped":"yes"}'),{on:true,finished:true,needs:false,stopped:true});

// which change deserves which sound
const A=(mood,asks=0,jobRunning=false)=>({mood,jobRunning,facts:{asks}});
assert.equal(soundFor(null,A('idle')),null,'the first answer after the page opens is silent');assert.equal(soundFor(A('working'),null),null);
assert.equal(soundFor(A('working'),A('working')),null,'nothing repeats while the state holds');assert.equal(soundFor(A('idle'),A('idle')),null);
assert.equal(soundFor(A('working'),A('idle')),'finished','a chat reply or a run finished');
assert.equal(soundFor(A('idle',0,true),A('idle',0,false)),'finished','a tool job finished');
assert.equal(soundFor(A('working'),A('question',1)),'needs','a question waits for you');assert.equal(soundFor(A('idle',0),A('question',1)),'needs');assert.equal(soundFor(A('question',1),A('question',2)),'needs','one more thing waiting');
assert.equal(soundFor(A('question',2),A('question',1)),null,'fewer waiting is not a sound');assert.equal(soundFor(A('question',1),A('idle',0)),null,'answering it is not a sound');
assert.equal(soundFor(A('working'),A('stopped')),'stopped');assert.equal(soundFor(A('stopped'),A('stopped')),null,'a stopped run waiting is not repeated');assert.equal(soundFor(A('idle'),A('stopped')),null,'only a run that was working and stopped');
assert.equal(soundFor(A('working',0,true),A('working',0,false)),null);assert.equal(soundFor(A('idle'),A('working')),null,'starting work is silent');

// the switches and the cooldown
const on={...DEFAULTS,on:true};
assert.equal(shouldPlay('finished',DEFAULTS,null,1e6),false,'the master switch is off');assert.equal(shouldPlay('finished',on,null,1e6),true);assert.equal(shouldPlay(null,on,null,1e6),false);
assert.equal(shouldPlay('needs',{...on,needs:false},null,1e6),false,'a sound switched off stays silent while the others play');assert.equal(shouldPlay('finished',{...on,needs:false},null,1e6),true);
assert.equal(shouldPlay('finished',on,1e6,1e6+COOLDOWN_MS-1),false,'never twice inside the cooldown');assert.equal(shouldPlay('finished',on,1e6,1e6+COOLDOWN_MS),true);

// the activity answer says whether a tool job runs (so a finished test chimes), and the wiring is in the pages
assert.equal(activityOf(null,null,{jobs:{list:()=>({running:{key:'test'}})}}).jobRunning,true);assert.equal(activityOf(null,null,{jobs:{list:()=>({running:null})}}).jobRunning,false);assert.equal(activityOf(null,null).jobRunning,false);
const app=fs.readFileSync(path.join(root,'hub','web','app.js'),'utf8'),bot=fs.readFileSync(path.join(root,'hub','web','bot.js'),'utf8'),sound=fs.readFileSync(path.join(root,'hub','web','sound.js'),'utf8'),html=fs.readFileSync(path.join(root,'hub','web','index.html'),'utf8');
assert.ok(app.includes("mountSound(")&&app.includes('sound.observe(a)')&&bot.includes('onActivity')&&html.includes('id="soundslot"'),'the sound settings are mounted and fed by the bot\'s own poll');
assert.ok(!/fetch\(|innerHTML|outerHTML|insertAdjacentHTML|https?:\/\//.test(sound),'sound.js reads and sends nothing and sets text only');
assert.ok(fs.existsSync(path.join(root,'hub','web','sound.js')));
console.log('hub-sound: off by default, a switch for every sound, which change deserves which sound, silent first answer, no repeat while the state holds, the cooldown, and the wiring passed.');