// talk-check (notes/conversation-design.md stage C2): prints the validator's problem list and a readable sample transcript for a cast, so one person can be read on a screen without playing.
//
// USAGE
//   node scripts/talk-check.mjs <module> [personId] [options]
//     <module>    a .js/.mjs file that exports a cast ({id,name,voice,facts,nodes}), an array of casts, or an object of casts
//                 (default export or any named export), for example:  node scripts/talk-check.mjs dist/cast-early.js noah
//                 or a bare person id when dist/cast.js exists (it must export castOf(id) or a CASTS array/object).
//     personId    only this cast (matched against cast.id and cast.name, case-insensitive). Without it every cast in the module is checked.
//   options
//     --acts=a,b          act names the game accepts (default: the design note's list in dist/talk-validate.js)
//     --places=a,b        extra places to test in the coverage sweep (counter, street, door, doorway, farm, office, cafe)
//     --place=counter     the place used in the transcripts (default: the first place the cast names, else street)
//     --period=night      only this period in the transcripts (morning, afternoon, evening, night)
//     --tier=friend       only this standing tier (stranger, acquaintance, friend, close)
//     --mood=good         mood band (miserable, low, okay, good, delighted; default okay)
//     --story=3 --story-done  the story step and whether the story is finished
//     --day=5 --seed=1    the day number and seed the choices are hashed from
//     --met=true|false    force "has met the player" (default: strangers have not met, everyone else has)
//     --walk              also walk EVERY reply 3 levels deep for each transcript (long)
//     --problems-only     print just the problem list
// EXIT CODE: 1 when any error-level problem exists (warnings do not count), 0 otherwise, so a writer or a model can loop: edit, run, repeat.
// Programmatic use (for tests and the sweep): import {findCasts,checkCast,transcript} from './talk-check.mjs'.
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {validateCast,validateCasts,formatProblems} from '../dist/talk-validate.js';
import {openConversation,chooseReply,baseContext,PERIODS,TIERS,MOOD_BANDS,PLACES,BYE_ID} from '../dist/talk-engine.js';

const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const isCast=v=>isObj(v)&&Array.isArray(v.nodes);
const MINUTE={morning:8*60,afternoon:14*60,evening:19*60,night:23*60};
// Every cast found in a module's exports (default or named; a cast, an array of casts, or an object of casts), without duplicates.
export function findCasts(mod){
 const out=[],add=v=>{if(isCast(v)){if(!out.includes(v))out.push(v)}else if(Array.isArray(v))v.forEach(add);else if(isObj(v))Object.values(v).forEach(x=>{if(isCast(x)||Array.isArray(x))add(x)})};
 if(isObj(mod))for(const v of Object.values(mod))add(v);
 return out;
}
const matchCast=(c,who)=>!who||String(c.id).toLowerCase()===who.toLowerCase()||String(c.name).toLowerCase()===who.toLowerCase();
// The validator result for one cast (others = the rest of the casts for the cross-cast "same line" rule).
export function checkCast(cast,opts={}){
 const problems=validateCast(cast,{acts:opts.acts,places:opts.places,others:opts.others});
 return {problems,text:problems.length?formatProblems(problems)+`\n${problems.length} problem(s) for ${cast.name||cast.id}.`:`No problems for ${cast.name||cast.id}.`};
}
function placesNamed(cast){
 const found=[],walk=c=>{if(isObj(c))for(const p of [].concat(c.place??[]))if(PLACES.includes(p)&&!found.includes(p))found.push(p)};
 for(const n of cast.nodes||[]){if(!isObj(n))continue;walk(n.when);for(const v of n.say||[])if(isObj(v))walk(v.if);for(const r of n.replies||[])if(isObj(r))walk(r.if)}
 return found;
}
// One readable transcript block for a period/tier (and the whole reply tree to `depth` when walk is on).
export function transcript(cast,patch,{walk=false,depth=3}={}){
 const name=cast.name||cast.id,ctx=baseContext({who:cast.id,...patch}),lines=[];
 const show=(r,indent)=>{for(const l of r.lines)lines.push(`${indent}${name}: ${l.text}`);if(r.effects.length)lines.push(`${indent}  (effects: ${r.effects.map(e=>e.kind+(e.id?':'+e.id:e.amount!==undefined?(e.amount>0?'+':'')+e.amount:'')).join(', ')})`);if(r.problems.length)lines.push(`${indent}  !! ${r.problems.join('; ')}`)};
 const open=openConversation(cast,cast.id,ctx);
 if(!open.lines.length){lines.push(`  ${name} says nothing here (${open.problems.join('; ')||'no entry node fits'}).`);return lines.join('\n')}
 show(open,'  ');
 const list=r=>r.replies.filter(x=>x.id!==BYE_ID).map(x=>x.label);
 if(!walk){if(open.replies.length)lines.push('  you could say: '+list(open).map(l=>`"${l}"`).join(' | ')+(open.ended?'':' | "See you"'));else if(open.ended)lines.push('  (the talk ends here)');return lines.join('\n')}
 const rec=(r,d,indent)=>{
  if(d>=depth||r.ended)return;
  for(const rep of r.replies.filter(x=>x.id!==BYE_ID)){
   lines.push(`${indent}you: ${rep.label}`);const next=chooseReply(r.session,cast,rep.id,ctx);show(next,indent+'  ');rec(next,d+1,indent+'  ');
  }
 };
 rec(open,0,'  ');return lines.join('\n');
}
function parse(argv){
 const o={flags:{},rest:[]};
 for(const a of argv){const m=/^--([\w-]+)(?:=(.*))?$/.exec(a);if(m)o.flags[m[1]]=m[2]===undefined?true:m[2];else o.rest.push(a)}
 return o;
}
async function load(arg){
 const file=path.resolve(process.cwd(),arg);
 if(fs.existsSync(file)&&fs.statSync(file).isFile())return {casts:findCasts(await import(pathToFileURL(file).href)),who:''};
 if(/[\\/]|\.m?js$/i.test(arg))throw new Error(`"${arg}" is not a file. Pass the path of a cast module, or a person id such as noah.`);
 const reg=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),'..','dist','cast.js');
 if(!fs.existsSync(reg))throw new Error(`"${arg}" is not a file, and dist/cast.js does not exist yet (the cast registry comes in stage C4). Pass the path of a cast module instead.`);
 const mod=await import(pathToFileURL(reg).href);let casts=findCasts(mod);
 if(typeof mod.castOf==='function'){const c=mod.castOf(arg);if(isCast(c))casts=[c]}
 return {casts,who:arg};
}
export async function main(argv){
 const {flags,rest}=parse(argv);
 if(!rest.length||flags.help){console.log(fs.readFileSync(new URL(import.meta.url),'utf8').split('\n').filter(l=>l.startsWith('//')).map(l=>l.slice(3)).join('\n'));return 0}
 let loaded;try{loaded=await load(rest[0])}catch(e){console.error('talk-check: '+e.message);return 2}
 const who=rest[1]||loaded.who,casts=loaded.casts;
 if(!casts.length){console.error('talk-check: no cast found in '+rest[0]+' (expected an object with a nodes array, an array of them, or an object of them).');return 2}
 const chosen=casts.filter(c=>matchCast(c,who));
 if(!chosen.length){console.error(`talk-check: no cast "${who}" in ${rest[0]}; found: ${casts.map(c=>c.id).join(', ')}`);return 2}
 const acts=typeof flags.acts==='string'?flags.acts.split(',').filter(Boolean):undefined,places=typeof flags.places==='string'?flags.places.split(',').filter(Boolean):undefined;
 let bad=0;
 for(const cast of chosen){
  const others=casts.filter(c=>c!==cast),res=checkCast(cast,{acts,places,others});
  console.log(`===== ${cast.name||cast.id} (${cast.id}) =====`);
  console.log(res.text);
  if(res.problems.some(p=>p.level==='error'))bad++;
  if(flags['problems-only'])continue;
  const place=typeof flags.place==='string'?flags.place:placesNamed(cast)[0]||'street',periods=typeof flags.period==='string'?[flags.period]:PERIODS,tiers=typeof flags.tier==='string'?[flags.tier]:TIERS;
  if(flags.place&&!PLACES.includes(place))console.log(`(note: "${place}" is not a known place: ${PLACES.join(', ')})`);
  console.log(`\nVoice: ${cast.voice||'(none)'}   Place: ${place}   Mood: ${flags.mood||'okay'}   Day: ${flags.day||3}   Story: ${flags.story||0}${flags['story-done']?' (done)':''}`);
  for(const period of periods){
   for(const tier of tiers){
    if(!PERIODS.includes(period)||!TIERS.includes(tier)){console.log(`(skipping unknown period/tier ${period}/${tier})`);continue}
    const met=flags.met===undefined?tier!=='stranger':flags.met!=='false';
    const patch={minute:MINUTE[period],tier,met,place,day:+flags.day||3,seed:+flags.seed||1,story:+flags.story||0,storyDone:!!flags['story-done'],moodBand:MOOD_BANDS.includes(flags.mood)?flags.mood:'okay',mood:50};
    console.log(`\n--- ${period}, ${tier}${met?'':' (first meeting)'} ---`);
    console.log(transcript(cast,patch,{walk:!!flags.walk}));
   }
  }
 }
 return bad?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).then(code=>{process.exitCode=code},e=>{console.error('talk-check: '+(e&&e.message||e));process.exitCode=2});
