// Mikkadr Hub v2, V1: the shell's pure rules (no DOM, so tests can import it): the tree, the hash routes, the accent from the weekly gauge, the tab title.
// The hub's own version, shown at the top of the menu, in GET /api/hub-id and in the start-up line. Hub 2.<step>: 2.1 shell and Work, 2.2 Tools, 2.3 Commit and Push, 2.4 Assets and records (2.4.1 attach a file, 2.4.2 new layout, 2.5 cache strip and live Tokens, 2.6 panda facts and sound, 2.7 Deploy: the check before going online, 2.7.1 Publish, 2.7.2 chat header fixes, 2.7.3 the bot knows about tool jobs, 2.7.4 Refresh beside the gauges, 2.7.5 Bump version, 2.7.6 Publish needs a new check after a publish, 2.7.7 close a plan without building it, 2.7.8 npm run plan -- --close, 2.7.9 stray null text, 2.7.10 clearer Work, 2.7.11 cache ring and clock beside Send, 2.7.12 Enter sends and the chat fits the page, 2.8 the master reads the web, Add from link, 2.8.1 measured file checks, 2.8.2 the master proposes downloads), 2.5 cache strip and Tokens.
export const HUB_VERSION='2.11.0';
// The tree: three areas (Chat, Work, Assets) and three small rows at the foot (Commit, Tools, Tokens). No numbers. `soon` marks a placeholder and names the step that builds it.
export const TREE={
 areas:[{key:'chat',label:'Chat',glyph:'›'},{key:'work',label:'Work',glyph:'›'},{key:'assets',label:'Assets',glyph:'›'}],
 foot:[{key:'commit',label:'Commit',glyph:'⎇'},
  {key:'deploy',label:'Deploy',glyph:'↑'},
  {key:'tools',label:'Tools',glyph:'▸'},
  {key:'tokens',label:'Tokens',glyph:'◔'}]};
const ALL=[...TREE.areas,...TREE.foot];
export const rowOf=key=>ALL.find(r=>r.key===key)||null;
// The scene of each page: the hue (0 to 360) of the flowing background and of the sliding highlight in the tree. Hovering a row previews its scene. hub.css has one html[data-scene=...] rule per key.
export const SCENES={chat:220,work:26,assets:135,commit:172,deploy:48,tools:14,tokens:215};
export const HOME='work'; // where an empty or unknown hash lands
export const sceneOf=(route,hover)=>Object.hasOwn(SCENES,hover||'')?hover:Object.hasOwn(SCENES,route||'')?route:HOME;
export const ROUTES=ALL.map(r=>r.key);
// Old hashes keep working: Waiting, Plans and Runs are all inside Work now.
export const OLD={waiting:'work',plans:'work',runs:'work'};
export const routeOf=hash=>{const k=String(hash||'').replace(/^#\/?/,'').split(/[?&/]/)[0].toLowerCase(),r=Object.hasOwn(OLD,k)?OLD[k]:k;return ROUTES.includes(r)?r:HOME};
export const planIdOf=hash=>{const m=/^#\/?(?:plans|work)\/([a-z0-9][a-z0-9-]{0,79})(?:[?&].*)?$/.exec(String(hash||''));return m?m[1]:null}; // #work/<id> and the old #plans/<id> open that step inside Work
export const runIdOf=hash=>{const m=/^#\/?runs\/(run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4})(?:[?&].*)?$/.exec(String(hash||''));return m?m[1]:null}; // #runs/<id> opens the step that run belongs to
// Accent: blue under 60 percent weekly, orange from 60, red from 90. No reading means blue.
export const accentOf=pct=>!Number.isFinite(pct)?'blue':pct>=90?'red':pct>=60?'orange':'blue';
// Gauge bar colour class: the zone of its own window.
export const barOf=(pct,orangeAt,redAt)=>!Number.isFinite(pct)?'none':pct>=redAt?'red':pct>=orangeAt?'orange':'ok';
// The tab title, with how many things need you in front.
export const titleOf=(route,needsYou)=>`${needsYou>0?`(${needsYou}) `:''}${(rowOf(route)||rowOf(HOME)).label} · Mikkadr Hub`;
export const pageOf=route=>route==='tokens'?'/tokens':null; // routes that open an existing page inside the shell (Assets has its own page since V4; the pictures page is a link there)
// "3 things need you", for the pill at the top of every page ('' when nothing does).
export const needsText=n=>n>0?`${n} thing${n===1?'':'s'} need${n===1?'s':''} you`:'';
// How old the usage reading is, in plain words.
export const ageText=(ageMin,stale)=>ageMin==null?'':`Usage ${stale?'last ':''}checked ${ageMin>=120?Math.round(ageMin/60)+' h':ageMin+' min'} ago`;
// The label of the Commit row: "Commit · 12 files changed" (from GET /api/commit/summary), plain "Commit" when nothing changed or commit is off.
export const commitLabel=s=>s&&s.enabled&&s.files>0?`Commit · ${s.files} file${s.files===1?'':'s'} changed`:'Commit';
// The tree is always visible from this window width; below it the tree folds behind the Menu tab.
export const WIDE=1100;
