// Mikkadr Hub P5 R7b step 2: the corner bot's pure rules and its wiring. No browser, no model call.
// What it pins: the three fold states and what a click does, the poll pace by mood, the speech line and the count, where "open it" leads, that the page makes room for the bot (so it never covers content),
// that it builds its DOM with text only and sends nothing, and that /api/activity says when runs are off.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BOT_STATES,MOOD_LABEL,moodOf,botStateOf,afterFace,afterLine,pollMs,lineOf,countOf,linkOf,faceLabel} from '../hub/web/bot.js';
import {MOODS} from '../hub/activity.js';
import {SCENES,ROUTES,sceneOf} from '../hub/web/shell.js';
import {activityOf,resolveRoute} from '../hub/server.js';

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.deepEqual(BOT_STATES,['mini','line','open']);assert.deepEqual(Object.keys(MOOD_LABEL).sort(),[...MOODS].sort(),'a label for every mood the server can send');
assert.equal(botStateOf(null,null),'line');assert.equal(botStateOf('open','mini'),'open','the query wins');assert.equal(botStateOf('nope','mini'),'mini');assert.equal(botStateOf(null,'x'),'line');
assert.equal(afterFace('mini'),'line');assert.equal(afterFace('line'),'mini');assert.equal(afterFace('open'),'mini');
assert.equal(afterLine('line'),'open');assert.equal(afterLine('open'),'line');
assert.equal(pollMs('working'),2000);for(const m of ['idle','question','stopped'])assert.equal(pollMs(m),10000);
assert.equal(moodOf({mood:'question'}),'question');assert.equal(moodOf({mood:'constructor'}),'idle');assert.equal(moodOf(null),'idle');
assert.equal(lineOf(null),'The hub is not answering.');assert.equal(lineOf({enabled:false,line:'x'}),'Runs and the chat are switched off.');assert.equal(lineOf({enabled:true,line:'The master is thinking.'}),'The master is thinking.');
assert.equal(countOf({tokens:6350,cap:200000}),'6,350 / 200,000');assert.equal(countOf({tokens:6350,cap:null}),'6,350');assert.equal(countOf({tokens:0,cap:5}),'');assert.equal(countOf(null),'');
assert.deepEqual(linkOf({source:'run',runId:'run-20261111-160310-66c6'}),{href:'#runs/run-20261111-160310-66c6',label:'Open the run'});
assert.equal(linkOf({source:'run',runId:'../x'}),null,'only a real run id becomes a link');assert.equal(linkOf({source:'chat'}).href,'#chat');assert.equal(linkOf({source:null}),null);
assert.match(faceLabel({mood:'working'},'mini'),/working\. Show/);assert.match(faceLabel(null,'open'),/idle\. Hide/);

// wiring: served, mounted by the shell, text only, reads one GET and nothing else
const js=fs.readFileSync(path.join(root,'hub','web','bot.js'),'utf8'),app=fs.readFileSync(path.join(root,'hub','web','app.js'),'utf8'),css=fs.readFileSync(path.join(root,'hub','web','hub.css'),'utf8');
assert.ok(fs.existsSync(resolveRoute(root,'/web/bot.js','127.0.0.1:1',1).file));assert.ok(app.includes("'./bot.js'")&&app.includes('mountBot('));
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(js),'the bot sets text only');
assert.deepEqual(js.match(/fetch\([^)]*\)/g),["fetch('/api/activity',{cache:'no-store'})"],'one read, no write');assert.ok(!/method:|POST/.test(js));
// the page makes room: each fold state sets --bot-h, and the main area and the menu panel end above it
for(const s of ['line','open'])assert.match(css,new RegExp(`html\\[data-bot=${s}\\]\\{--bot-h:\\d+px\\}`));
assert.match(css,/\.main\{bottom:calc\(18px \+ var\(--bot-h\)\)/);assert.match(css,/\.panel\{bottom:calc\(16px \+ var\(--bot-h\)\)/);
const hOf=s=>Number(new RegExp(`data-bot=${s}\\]\\{--bot-h:(\\d+)px`).exec(css)[1]),px=re=>Number(re.exec(css)[1]);
const lineH=px(/\.bot-line\{[^}]*height:(\d+)px/),listH=px(/\.bot-list\{height:(\d+)px/),bottom=px(/\.bot-bubble\{[^}]*bottom:(\d+)px/);
assert.ok(hOf('line')>=lineH+bottom+2,'the strip is as tall as the speech line');assert.ok(hOf('open')>=lineH+listH+bottom+2,'and as tall as the open list');
assert.match(css,/prefers-reduced-motion:reduce\)\{\.bot/);
// the activity answer says when runs and the chat are off
assert.equal(activityOf(null,null).enabled,false);assert.equal(activityOf(null,null).mood,'idle');
// the scene: every page has a hue, the stylesheet has a rule for each, hovering a row previews it, and what the hub is doing changes the background
assert.deepEqual(Object.keys(SCENES).sort(),[...ROUTES].sort(),'a scene for every page');for(const [k,hue] of Object.entries(SCENES)){assert.ok(css.includes(`html[data-scene=${k}]{--hue:${hue}}`),'css scene '+k);assert.ok(css.includes(`.wave[data-scene=${k}]{--wh:${hue}}`),'css wave '+k)}
assert.equal(sceneOf('plans',null),'plans');assert.equal(sceneOf('plans','runs'),'runs','the hovered row wins');assert.equal(sceneOf('nope',null),'waiting');assert.equal(sceneOf('plans','constructor'),'plans');
assert.ok(css.includes("@property --hue{syntax:'<number>'")&&/html\[data-mood=working\]\{--glow:/.test(css)&&/html\[data-mood=question\]:not\(\[data-hover\]\)\{--hue:/.test(css)&&/html\[data-mood=stopped\]:not\(\[data-hover\]\)\{--hue:/.test(css));
assert.ok(js.includes('root.dataset.mood=m')&&app.includes("pill.className='nav-pill'")&&css.includes('.nav-pill{')&&/prefers-reduced-motion:reduce\)\{\.scene i\{animation:none/.test(css));
console.log('hub-bot: fold states, clicks, poll pace, speech line, count, link, room made on the page, text-only DOM with one read, and the runs-off notice passed.');
