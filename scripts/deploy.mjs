// Mikkadr Hub 2.7: publish the game (`wrangler deploy`). Started only by the hub's Deploy page, which needs a passing check from the last 10 minutes and writes .hub/deploy-confirm.json ({version, at}) with the version you confirmed.
// This script checks it all again by itself: the confirmed version must be the one in package.json, the file must be fresh, and the same checks must still pass. Then it deploys, and reads the live site to see the new version arrive.
// Output lines the hub reads: `REFUSED <why>` (nothing was published), `DEPLOYING <version>`, `DEPLOYED {json}`. Never --force: a deployed version number is never reused.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {gatherFacts,readLive} from '../hub/deploy-facts.mjs';
import {deployChecks,verdictText,CONFIRM_FRESH_MS} from '../hub/web/deploy-rules.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),confirmFile=path.join(root,'.hub','deploy-confirm.json');
const refuse=why=>{console.log('REFUSED '+why);process.exit(2)};
let confirm=null;try{confirm=JSON.parse(fs.readFileSync(confirmFile,'utf8').replace(/^\uFEFF/,''))}catch{}
try{fs.unlinkSync(confirmFile)}catch{} // one press, one deploy: the confirmation is used up whatever happens next
if(!confirm||typeof confirm.version!=='string'||!Number.isFinite(confirm.at))refuse('The hub did not confirm a version for this press.');
if(Date.now()-confirm.at>CONFIRM_FRESH_MS)refuse('The confirmation is more than 5 minutes old. Press Check, then Publish again.');
const facts=await gatherFacts({root});
if(facts.version!==confirm.version)refuse(`You confirmed ${confirm.version}, but package.json now says ${facts.version}. Press Check again.`);
const verdict=deployChecks(facts);
if(!verdict.ready)refuse('The checks no longer pass. '+verdictText(verdict,facts.version));
const wrangler=path.join(root,'node_modules','wrangler','bin','wrangler.js');
if(!fs.existsSync(wrangler))refuse('wrangler is not installed in this project (npm install).');
console.log('DEPLOYING '+facts.version);
const code=await new Promise(resolve=>{const c=spawn(process.execPath,[wrangler,'deploy'],{cwd:root,stdio:['ignore','inherit','inherit'],windowsHide:true});const timer=setTimeout(()=>{try{c.kill()}catch{}},10*60000);c.on('error',()=>{clearTimeout(timer);resolve(-1)});c.on('close',x=>{clearTimeout(timer);resolve(x??-1)})});
if(code!==0){console.log('DEPLOYED '+JSON.stringify({version:facts.version,live:null,ok:false,note:`wrangler ended with code ${code}`}));process.exit(1)}
// the new version should show up within a minute or so
let live=null;for(let i=0;i<8;i++){const r=await readLive();live=r.live&&r.live.version;if(live===facts.version)break;await new Promise(r2=>setTimeout(r2,4000))}
const ok=live===facts.version;
console.log('DEPLOYED '+JSON.stringify({version:facts.version,live,ok,note:ok?'':'wrangler finished, but the live site still shows another version. Wait a minute and press Check.'}));
process.exit(ok?0:1);