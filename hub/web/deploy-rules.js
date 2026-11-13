// Mikkadr Hub 2.7: bringing the game online (shared by the page, the hub and the scripts, so it lives in web/). Pure rules (no file, no process, no network), so tests can import them.
// deployChecks turns the facts the check script gathered into plain results, each ok, warn (you may go on) or fail (the Deploy button stays off).
//   facts: {version, releaseFolder (the folder dist/releases/<version> exists), indexPointsHere (dist/index.html loads that release), live ({version}|null) and liveError (could not be read),
//           tests ({ok, at}|null), changed (files changed since the last commit, or null), devMode (true|false|null), wrangler ('in'|'out'|'unknown')}
export const LIVE_URL='https://simproject.ghostjumper007.workers.dev/version.json';
export const SITE_URL='https://simproject.ghostjumper007.workers.dev/';
const PARTS=/^(\d+)\.(\d+)\.(\d+)$/;
// -1, 0 or 1; null when either is not a plain x.y.z version.
export function cmpVersion(a,b){const x=PARTS.exec(String(a)),y=PARTS.exec(String(b));if(!x||!y)return null;for(let i=1;i<=3;i++){const d=Number(x[i])-Number(y[i]);if(d)return d<0?-1:1}return 0}
export function deployChecks(f={}){
 const out=[],add=(key,label,state,text)=>out.push({key,label,state,text});
 const v=String(f.version||'');
 if(!PARTS.test(v))add('version','Version','fail','package.json has no plain version number (like 0.35.4).');
 else if(!f.releaseFolder)add('version','Version','fail',`${v}: the release folder dist/releases/${v} is missing. Run "Make a release" on the Tools page first.`);
 else if(f.indexPointsHere===false)add('version','Version','fail',`${v}: dist/index.html does not load that release. Run "Make a release" on the Tools page.`);
 else add('version','Version','ok',`${v} is ready to publish.`);
 const live=f.live&&f.live.version;
 if(f.liveError||!live)add('live','Live now','warn','The live version could not be read, so the hub cannot check that this one is new. Check the site yourself before you publish.');
 else{const c=cmpVersion(v,live);
  if(c===null)add('live','Live now','warn',`The live site says ${String(live).slice(0,20)}, which is not a plain version.`);
  else if(c===0)add('live','Live now','fail',`${live} is already live. A deployed version must never be reused: raise "version" in package.json, then make a release.`);
  else if(c<0)add('live','Live now','fail',`${live} is live and newer than ${v}. Publishing would put an older game online.`);
  else add('live','Live now','ok',`${live} is live; ${v} is newer.`)}
 const t=f.tests;
 if(!t)add('tests','Tests','warn','No test run is recorded. Run "Check" on the Tools page first.');
 else if(!t.ok)add('tests','Tests','fail','The last test run had failures. Fix them, then run "Check" again.');
 else add('tests','Tests','ok','The last test run passed.');
 if(f.changed==null)add('changed','Uncommitted files','unknown','The hub could not read the git status.');
 else if(f.changed>0)add('changed','Uncommitted files','warn',`${f.changed} file${f.changed===1?'':'s'} changed since the last commit. The game goes online from this folder, not from GitHub, so commit and push too.`);
 else add('changed','Uncommitted files','ok','Everything is committed.');
 if(f.devMode===true)add('dev','Dev Mode','warn','Dev Mode is on in this build: anyone who opens the site can show the Dev Mode button (free money, teleport). Fine for testers; turn it off for a public build.');
 else if(f.devMode===false)add('dev','Dev Mode','ok','Dev Mode is off.');
 else add('dev','Dev Mode','unknown','Could not read dist/dev-flag.js.');
 if(f.wrangler==='in')add('wrangler','Cloudflare login','ok','wrangler is logged in.');
 else if(f.wrangler==='out')add('wrangler','Cloudflare login','fail','wrangler is not logged in. In the terminal, run: npx wrangler login');
 else add('wrangler','Cloudflare login','warn','Could not tell whether wrangler is logged in.');
 return {checks:out,ready:!out.some(c=>c.state==='fail'),warnings:out.filter(c=>c.state==='warn').length}}
// The one line for the page and the job record.
export const verdictText=(r,version)=>r.ready?`Ready to go online (${version||'?'})${r.warnings?` · ${r.warnings} warning${r.warnings===1?'':'s'}`:''}`:`Not ready: ${r.checks.filter(c=>c.state==='fail').map(c=>c.label.toLowerCase()).join(', ')}`;
// ── Step 2: the Publish button. The press needs a check that passed in the last 10 minutes, and the version typed back by the page must be the one that check named.
export const CHECK_FRESH_MS=10*60000,CONFIRM_FRESH_MS=5*60000;
// May the owner press Publish now? check: the last deploy-check record ({summary:{ok,version,live,checks}, endedAt}) or null. Returns {ok, why}.
export function canPublish(check,now=Date.now()){
 const s=check&&check.summary;
 if(!s||!Array.isArray(s.checks))return {ok:false,why:'Press Check first.'};
 if(!s.ok)return {ok:false,why:'The check found something that blocks going online. Fix it, then press Check again.'};
 if(!s.version)return {ok:false,why:'The check did not name a version. Press Check again.'};
 if(!Number.isFinite(check.endedAt)||now-check.endedAt>CHECK_FRESH_MS)return {ok:false,why:'The check is more than 10 minutes old. Press Check again.'};
 return {ok:true,why:''}}
// The question the browser asks before the press, naming both versions; Dev Mode on is said out loud.
export function confirmText(s){
 const dev=(s.checks||[]).some(c=>c.key==='dev'&&c.state==='warn');
 return `Publish ${s.version}?\n\n${s.live?s.live+' is live now.':'The live version could not be read.'} This puts the game online for everyone with the link.${dev?'\n\nDev Mode is on in this build (free money, teleport).':''}`}