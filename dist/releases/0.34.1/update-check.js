// Update notice (0.34, DESIGN 4.14 "Launcher / updates"). The site publishes its newest version in version.json (written by `npm run release`, never cached). The running game knows its own
// version (version.js, also written by the release script). A few seconds after the game loads, and every 10 minutes after that, it asks for version.json; a NEWER version shows the banner
// (#updateBanner in index.html): "Reload" saves the game first and reloads, "x" hides it until an even newer version appears. No network, a bad answer or the same version: nothing happens.
// Online lobbies and the forced "save and go back to the menu" for a changed network protocol come with the hosted relay; this notice never interrupts play.

export const CHECK_EVERY_MS=10*60*1000,FIRST_CHECK_MS=2500;

export const parseVersion=text=>{const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(text??'').trim());return m?[+m[1],+m[2],+m[3]]:null};
// true only when `latest` is a real version above `running` (anything unreadable is "not newer": a broken file must never nag players)
export const isNewer=(latest,running)=>{const a=parseVersion(latest),b=parseVersion(running);if(!a||!b)return false;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false};

// document: the page; fetchJson(url): a promise of the parsed file (or null); version: the running version; beforeReload(): save the game; reload(): reload the page.
// The timer functions can be replaced (tests). Returns {check, banner}: check() looks once and resolves to the version it announced, or null.
export function installUpdateNotice({document,fetchJson,version,beforeReload=()=>{},reload=()=>{},setTimeoutFn=setTimeout,setIntervalFn=setInterval}){
 const banner=document.getElementById('updateBanner'),text=document.getElementById('updateText'),go=document.getElementById('updateReload'),later=document.getElementById('updateLater');
 if(!banner)return {check:async()=>null,banner:null};
 let shown=null,dismissed=null; // the version on the banner; the newest version the player said "not now" to
 banner.hidden=true;
 if(go)go.onclick=()=>{try{beforeReload()}catch(error){console.warn('Saving before the update failed:',error)}reload()};
 if(later)later.onclick=()=>{dismissed=shown;banner.hidden=true};
 async function check(){
  let data=null;try{data=await fetchJson('version.json')}catch{return null} // offline, blocked or not found: stay quiet
  const latest=data?.version;if(!isNewer(latest,version))return null;
  if(latest===dismissed||latest===shown&&!banner.hidden)return null;
  shown=latest;if(text)text.textContent=`Version ${latest} is out. Your game is saved before it reloads.`;banner.hidden=false;return latest;
 }
 const first=setTimeoutFn(()=>{check()},FIRST_CHECK_MS),every=setIntervalFn(()=>{check()},CHECK_EVERY_MS);
 for(const t of [first,every])t?.unref?.(); // in Node (tests) a pending timer must not keep the process alive
 return {check,banner};
}
