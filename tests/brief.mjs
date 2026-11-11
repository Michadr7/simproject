// Project brief and index (Mikkadr Hub P2, scripts/build-index.mjs): the parsing rules on small samples, a tiny fake repo built twice with the same result,
// and the real generated files: every dist module is listed, the version matches, generated data and never-read folders are named, and both files fit their token budget.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildIndex,leadingComment,exportsOf,coversOf,headings,tokens,ROOT,BUDGET,PURPOSE_OVERRIDES} from '../scripts/build-index.mjs';

// ── leadingComment: the first comment run before any code, imports allowed first
assert.equal(leadingComment('// Routes stay on pavement.\n// Second line.\nexport const a=1;'),'Routes stay on pavement. Second line.');
assert.equal(leadingComment("import {a} from './a.js';\n// After the import.\nexport const b=2;"),'After the import.');
assert.equal(leadingComment("import {a} from './a.js';// Same line as the import. More here.\n// Next line.\nexport const b=2;"),'Same line as the import. More here. Next line.');
assert.equal(leadingComment("import {a} from './a.js';\nexport const b=2;\n// This is about b, not the file.\n"),'','a comment after code is not the file header');
assert.equal(leadingComment('/* A block\n * comment */\nexport const c=3;'),'A block comment');
assert.equal(leadingComment('// ─────────────\n// Real text\nexport const d=4;'),'Real text','separator lines are skipped');
assert.equal(leadingComment('export const e=5;'),'');
assert.equal(leadingComment('// '+'word '.repeat(60)+'\nexport const f=6;',50).length<=50,true,'long comments are clipped');
assert.match(leadingComment('// ─── Layout (pure data) ──────────────── The city keeps its footprint.\nexport const g=7;'),/^Layout \(pure data\) The city keeps/);

// ── exportsOf: several exports on one line, lists, default
assert.deepEqual(exportsOf('export const a=1;export function b(){}\nexport class C{}\nexport async function d(){}'),['a','b','C','d']);
assert.deepEqual(exportsOf('const x=1,y=2;export {x, y as z};'),['x','z']);
assert.deepEqual(exportsOf('export default 1;'),['default']);
assert.deepEqual(exportsOf('const notExported=1;'),[]);

// ── coversOf and headings
assert.deepEqual(coversOf("import {a} from '../dist/a.js';import b from '../dist/b-c.js';import {a as a2} from '../dist/a.js'"),['a.js','b-c.js']);
assert.deepEqual(coversOf("import x from '../scripts/build-index.mjs'"),[]);
{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'brief-test-'));
 try{
  const doc=path.join(dir,'D.md');fs.writeFileSync(doc,'# Title\n\n## One\ntext\n### Two `code`\n#### Three\n## Four\n');
  assert.deepEqual(headings(doc).map(h=>[h.line,h.level,h.title]),[[3,2,'One'],[5,3,'Two code'],[7,2,'Four']]);
  assert.deepEqual(headings(doc,{levels:[2],max:1}).map(h=>h.title),['Four'],'max keeps the last ones (newest sections)');
  assert.deepEqual(headings(path.join(dir,'missing.md')),[]);

  // ── a tiny fake repo: a module with a header, one without, a generated asset file, a test, a script, a notes file
  const w=(f,t)=>{fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),t)};
  w('package.json',JSON.stringify({name:'x',version:'9.9.9'}));w('brief-notes.md','## Rules\nBe kind.\n');
  w('dist/alpha.js',"// Alpha does things.\nexport const one=1;export function two(){}\n");w('dist/beta.js','export const three=3;\n');w('dist/big-assets.js','export const data="'+'x'.repeat(200)+'";\n');w('dist/index.html','<html></html>');
  w('tests/alpha.mjs',"// Alpha test.\nimport {one} from '../dist/alpha.js';\n");w('scripts/tool.mjs','// A tool.\n');w('DESIGN.md','## 1 Plan\n');
  const a=buildIndex({root:dir,head:'abc1234'}),b=buildIndex({root:dir,head:'abc1234'});
  assert.deepEqual(a,b,'the same repo gives the same output');
  assert.deepEqual(a.moduleNames,['alpha.js','beta.js','big-assets.js']);assert.deepEqual(a.generatedNames,['big-assets.js']);
  assert.match(a.index,/- alpha\.js · 2 lines · Alpha does things\. · exports: one, two · tests: alpha/);
  assert.match(a.index,/- beta\.js · 1 lines · \(no header comment\) · exports: three · tests: none/);
  assert.match(a.index,/## Generated data in dist\/ \(1\): never read\n- big-assets\.js/);
  assert.match(a.index,/Version 9\.9\.9 · base commit abc1234 · 3 modules in dist\/ \(1 generated data\) · 1 tests · 1 scripts/);
  assert.match(a.index,/- alpha · Alpha test\./);assert.match(a.index,/- tool\.mjs · A tool\./);assert.match(a.index,/### DESIGN\.md[\s\S]*- L1 1 Plan/);
  assert.match(a.brief,/Version 9\.9\.9/);assert.match(a.brief,/## Rules\nBe kind\./);assert.equal(a.stats.missingHeaders,1);
  assert.ok(!buildIndex({root:dir,head:null}).index.includes('base commit'),'no git, no commit in the header');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}}

// ── the real files
const live=buildIndex({head:null}),read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const brief=read('PROJECT-BRIEF.md'),index=read('PROJECT-INDEX.md'),pkg=JSON.parse(read('package.json'));
const listed=new Set([...index.matchAll(/^- ([A-Za-z0-9_.-]+\.js) ·/gm)].map(m=>m[1]));
const onDisk=fs.readdirSync(path.join(ROOT,'dist')).filter(n=>n.endsWith('.js'));
assert.deepEqual(onDisk.filter(n=>!listed.has(n)),[],'a dist module is missing from PROJECT-INDEX.md: run npm run index');
assert.deepEqual([...listed].filter(n=>!onDisk.includes(n)),[],'PROJECT-INDEX.md lists a module that no longer exists: run npm run index');
assert.ok(index.includes(`Version ${pkg.version}`)&&brief.includes(`Version ${pkg.version}`),'the files are for the current version: run npm run index');
assert.equal(listed.size,live.moduleNames.length);
for(const g of live.generatedNames)assert.match(index,new RegExp('## Generated data[^\\n]*\\n(?:- [^\\n]*\\n)*- '+g.replace(/\./g,'\\.')+' ·'),`${g} is listed as generated data`);
for(const never of ['dist/releases/','assets-src/','.dev.vars'])assert.ok(index.includes(never),`the index says never to read ${never}`);
assert.match(index,/- game\.js · \d+ lines · read by range · Everything wired together/,'game.js carries its hand-written purpose');
assert.ok(PURPOSE_OVERRIDES['game.js']);
assert.match(index,/### DESIGN\.md \(\d+ lines, open by line range\)\n(?:- L\d+ [^\n]+\n)+/,'DESIGN.md is listed by line range');
for(const t of fs.readdirSync(path.join(ROOT,'tests')).filter(n=>n.endsWith('.mjs')))assert.ok(index.includes('- '+t.replace(/\.mjs$/,'')),`test ${t} is listed`);
// the budget: the plan's targets, in estimated tokens
assert.ok(tokens(brief)<=BUDGET.brief,`the brief is ${tokens(brief)} tokens (budget ${BUDGET.brief})`);
assert.ok(tokens(index)<=BUDGET.index,`the index is ${tokens(index)} tokens (budget ${BUDGET.index})`);
assert.ok(brief.includes('## Standing rules')&&brief.includes('## Gotchas'),'the brief carries the rules and the gotchas');
// nothing private in files that get committed
for(const text of [brief,index])assert.ok(!/@gmail\.com|GOCSPX|client_secret|api[_-]?key\s*[:=]/i.test(text),'no addresses or secrets in the brief or index');

console.log(`brief tests passed: ${listed.size} modules listed, brief ${tokens(brief)} and index ${tokens(index)} estimated tokens (budgets ${BUDGET.brief} and ${BUDGET.index})`);
