// Builds PROJECT-BRIEF.md and PROJECT-INDEX.md (P2 of the Mikkadr Hub plan, DESIGN.md is untouched).
// The brief is what an agent reads first: the hand-written rules in brief-notes.md under a generated header (version, counts, where to look).
// The index is one line per module (what it does, its exports, the tests that cover it) plus line numbers of the long documents, so an agent opens
// only the file and line range a task needs. Everything here is read from the repo, so it cannot drift from it: run `npm run index` after a commit.
// Usage: node scripts/build-index.mjs            writes both files and prints their size in estimated tokens
//        node scripts/build-index.mjs --stdout   prints the sizes only, writes nothing
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const ROOT=path.resolve(HERE,'..');
// Estimated tokens. The brief is read by every agent, so it keeps its 3,000 target. The index is searched with Grep (a question costs a few hundred tokens), so its budget
// is only a guard against bloat for the rare whole read; it was 12,000 in the plan, which assumed 3.6 characters a token and was wrong by half (see CHARS_PER_TOKEN).
export const BUDGET={brief:3000,index:24000};
// Measured, not guessed: on 2026-11-10 a Haiku run that read both files cost about 26,000 tokens for 48,300 characters, so about 1.9 characters a token for this dense, symbol-heavy
// text (the Read tool's line numbers are included in that figure). Prose is nearer 4. Re-measure after a big format change; a run's usage is the real count.
export const CHARS_PER_TOKEN=1.9;
export const tokens=text=>Math.ceil(text.length/CHARS_PER_TOKEN);
// Modules that are generated data: never worth reading, listed on one line each.
const GENERATED=/(-assets|-asset|-pictures)\.js$|^character-(male|female)\.js$/;
const NEVER_READ=['dist/releases/','dist/vendor/','dist/assets/','assets-src/','node_modules/','.dev.vars'];
// Modules with no header comment of their own, described by hand (kept short; add one when a big module has none).
export const PURPOSE_OVERRIDES={'game.js':'Everything wired together: the frame loop frame(), stepWorld(), interactions, HUD handlers, the dev block at the end. Dense on purpose (one statement per line, long lines).'};

const read=file=>fs.readFileSync(file,'utf8').replace(/^﻿/,'');
const lineCount=text=>text.split('\n').length-(text.endsWith('\n')?1:0);
const kb=n=>n>=1024*1024?(n/1024/1024).toFixed(1)+' MB':Math.round(n/1024)+' KB';
const clip=(s,n)=>{s=s.replace(/\s+/g,' ').trim();if(s.length<=n)return s;const cut=s.slice(0,n-1),sp=cut.lastIndexOf(' ');return (sp>n*.6?cut.slice(0,sp):cut)+'…'};

// The first comment run of a file, if it comes before any code (imports and blank lines may come first): what the file says about itself.
export function leadingComment(text,max=100){
 const lines=text.split(/\r?\n/).slice(0,40),out=[];let inBlock=false;
 for(const raw of lines){const line=raw.trim();
  if(inBlock){const end=line.indexOf('*/');out.push(line.replace(/\*\/.*$/,'').replace(/^\*\s?/,''));if(end>=0)inBlock=false;if(!inBlock&&out.length)break;continue}
  if(!line){if(out.length)break;continue}
  if(/^import\b/.test(line)&&!out.length){const tail=/;\s*\/\/+\s?(.*)$/.exec(line);if(tail&&tail[1])out.push(tail[1]);continue} // a dense file may put its first comment after the import on the same line
  if(line.startsWith('//')){const body=line.replace(/^\/\/+\s?/,'');if(/^[─=\-*#\s]*$/.test(body)||/^(eslint|@ts|prettier)/.test(body)){if(out.length)break;continue}out.push(body);continue}
  if(line.startsWith('/*')){inBlock=!line.includes('*/');out.push(line.replace(/^\/\*+\s?/,'').replace(/\*\/.*$/,''));if(!inBlock&&out.length)break;continue}
  break}
 const text2=out.filter(Boolean).join(' ').replace(/[─═━_-]{3,}/g,' ').replace(/^[\s:.\-]+/,'');return text2?clip(text2,max):''}

// The names a module exports (one line may hold several, so the pattern is not anchored to the line start).
export function exportsOf(text){
 const names=new Set();for(const m of text.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g))names.add(m[1]);
 for(const m of text.matchAll(/\bexport\s*\{([^}]+)\}/g))for(const part of m[1].split(',')){const n=part.trim().split(/\s+as\s+/).pop().trim();if(n)names.add(n)}
 if(/\bexport\s+default\b/.test(text))names.add('default');return [...names]}

const listFiles=(dir,test)=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isFile()&&test(d.name)).map(d=>d.name).sort():[];
// "../dist/x.js" imports in a test -> the module names it covers
export const coversOf=text=>[...new Set([...text.matchAll(/from\s+['"]\.\.\/dist\/([A-Za-z0-9_.-]+\.js)['"]/g)].map(m=>m[1]))];
// "## / ###" headings with their line numbers, so an agent can open a long document by range.
export function headings(file,{levels=[2,3],max=80,width=88}={}){
 if(!fs.existsSync(file))return [];const out=[];read(file).split(/\r?\n/).forEach((line,i)=>{const m=/^(#{2,4})\s+(.+?)\s*$/.exec(line);if(m&&levels.includes(m[1].length))out.push({line:i+1,level:m[1].length,title:clip(m[2].replace(/[`*]/g,''),width)})});
 return out.slice(-max)}

// The repo's HEAD, if git can be found (it is not on PATH here; GitHub Desktop's copy is). Missing git just leaves the commit out.
export function gitHead(root=ROOT){
 const candidates=['git'];const base=path.join(process.env.LOCALAPPDATA||'','GitHubDesktop');
 if(fs.existsSync(base))for(const d of fs.readdirSync(base).filter(n=>/^app-/.test(n)).sort().reverse())candidates.push(path.join(base,d,'resources','app','git','cmd','git.exe'));
 for(const git of candidates){try{return execFileSync(git,['-C',root,'rev-parse','--short','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).trim()}catch{}}
 return null}

export function buildIndex({root=ROOT,head=undefined}={}){
 const dist=path.join(root,'dist'),pkg=JSON.parse(read(path.join(root,'package.json')));
 const modules=listFiles(dist,n=>n.endsWith('.js')),tests=listFiles(path.join(root,'tests'),n=>n.endsWith('.mjs')),scripts=listFiles(path.join(root,'scripts'),n=>/\.(mjs|js)$/.test(n)),workers=listFiles(path.join(root,'worker'),n=>n.endsWith('.js'));
 // which tests cover which module
 const covers=new Map();for(const t of tests)for(const m of coversOf(read(path.join(root,'tests',t)))){if(!covers.has(m))covers.set(m,[]);covers.get(m).push(t.replace(/\.mjs$/,''))}
 const booted=tests.filter(t=>/boot-game/.test(read(path.join(root,'tests',t)))).length;
 const code=[],generated=[];let missing=0;
 for(const name of modules){const file=path.join(dist,name),size=fs.statSync(file).size;
  if(GENERATED.test(name)){generated.push(`- ${name} · ${kb(size)}`);continue}
  const text=read(file),lines=lineCount(text),purpose=leadingComment(text)||PURPOSE_OVERRIDES[name]||'',ex=exportsOf(text),cov=covers.get(name)||[];
  if(!purpose)missing++;
  const shown=ex.slice(0,5).join(', ')+(ex.length>5?` (+${ex.length-5})`:'');
  const testText=name==='game.js'?`the ${booted} tests that boot the packaged game (tests/support/boot-game.mjs)`:cov.length?cov.slice(0,2).join(', ')+(cov.length>2?` (+${cov.length-2})`:''):'none';
  code.push(`- ${name} · ${lines} lines${size>60*1024?' · read by range':''} · ${purpose||'(no header comment)'}${shown?` · exports: ${shown}`:''} · tests: ${testText}`)}
 const testLines=tests.map(t=>{const c=leadingComment(read(path.join(root,'tests',t)),78);return `- ${t.replace(/\.mjs$/,'')}${c?' · '+c:''}`});
 const scriptLines=scripts.map(s=>{const c=leadingComment(read(path.join(root,'scripts',s)),90);return `- ${s}${c?' · '+c:''}`});
 const workerLines=workers.map(s=>{const c=leadingComment(read(path.join(root,'worker',s)),90);return `- worker/${s}${c?' · '+c:''}`});
 const hubFiles=listFiles(path.join(root,'hub'),n=>/\.(mjs|js)$/.test(n)); // Mikkadr Hub (Node only): the token watcher, the usage probe, the page
 const hubLines=hubFiles.map(s=>{const c=leadingComment(read(path.join(root,'hub',s)),90);return `- hub/${s}${c?' · '+c:''}`});
 const otherDist=listFiles(dist,n=>!n.endsWith('.js')).join(', ');
 const docLines=[];for(const doc of ['context.md','DESIGN.md','README.md','DEPLOY.md','ASSETS.md']){const f=path.join(root,doc);if(!fs.existsSync(f))continue;
  const hs=headings(f,doc==='README.md'?{levels:[2],max:6}:{levels:[2,3],max:70});docLines.push(`### ${doc} (${lineCount(read(f))} lines${doc==='context.md'||doc==='DESIGN.md'?', open by line range':''})`);for(const h of hs)docLines.push(`- L${h.line} ${h.title}`)}
 const sha=head===undefined?gitHead(root):head,version=pkg.version;
 const modulesText=[...code,...generated,...testLines,...scriptLines,...workerLines,...hubLines,...docLines].join('\n'); // about the whole index, for the size it quotes about itself
 const index=[
  '# City Life: project index',
  `<!-- generated by scripts/build-index.mjs (npm run index); do not edit -->`,
  `Version ${version}${sha?` · base commit ${sha}`:''} · ${modules.length} modules in dist/ (${generated.length} generated data) · ${tests.length} tests · ${scripts.length} scripts. Read PROJECT-BRIEF.md first.`,
  `Search this file with Grep (a module, test or document name, or a word) instead of reading it whole: a search costs a few hundred tokens, reading it all costs about ${Math.round(tokens(modulesText)/1000)}k.`,
  `Open a source file only if the task needs it, and open big ones by line range. Never read: ${NEVER_READ.join(', ')}.`,
  '',
  `## dist modules (${code.length}): name · size · what it does · exports · tests that import it`,
  ...code,
  '',
  `## Generated data in dist/ (${generated.length}): never read`,
  ...generated,
  `Other dist files: ${otherDist}.`,
  '',
  `## tests/ (${tests.length}; npm test runs each in its own process; run \`npm run release -- --force\` first after changing dist/)`,
  ...testLines,
  '',
  `## scripts/, worker/ and hub/ (Mikkadr Hub, Node only)`,
  ...scriptLines,...workerLines,...hubLines,
  'Root: server.js (the local multiplayer relay), wrangler.jsonc, package.json.',
  '',
  '## Long documents: open by line range',
  ...docLines,''].join('\n');
 const notesFile=path.join(root,'brief-notes.md'),notes=fs.existsSync(notesFile)?read(notesFile).trim():'(brief-notes.md is missing)';
 const brief=[
  '# City Life: project brief',
  `<!-- generated by scripts/build-index.mjs from brief-notes.md; edit brief-notes.md, then run npm run index -->`,
  `Version ${version}${sha?` · base commit ${sha}`:''} · ${modules.length} dist modules · ${tests.length} tests. Next: PROJECT-INDEX.md (one line per module): search it with Grep for what you need; it is about ${Math.round(tokens(index)/1000)}k tokens if read whole, so do not read it whole.`,
  '',notes,''].join('\n');
 return {brief,index,stats:{version,modules:modules.length,generated:generated.length,tests:tests.length,scripts:scripts.length,missingHeaders:missing,briefTokens:tokens(brief),indexTokens:tokens(index)},moduleNames:modules,generatedNames:generated.map(l=>l.slice(2).split(' ')[0])};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=buildIndex(),dry=process.argv.includes('--stdout');
 if(!dry){fs.writeFileSync(path.join(ROOT,'PROJECT-BRIEF.md'),r.brief);fs.writeFileSync(path.join(ROOT,'PROJECT-INDEX.md'),r.index)}
 const s=r.stats;console.log(`${dry?'(dry run) ':''}brief ${s.briefTokens} tokens (target ${BUDGET.brief}), index ${s.indexTokens} tokens (target ${BUDGET.index}); ${s.modules} modules, ${s.generated} generated, ${s.tests} tests, ${s.scripts} scripts; ${s.missingHeaders} modules without a header comment`);
}
