// Mikkadr Hub 2.8: the rules for Add from link: allowed links, folders, file names and kinds, the size limit. Pure; shared by the page, the hub and the script.
// share one set of rules and tests can pin them. The script (scripts/fetch-asset.mjs) checks every rule again by itself, and checks every redirect.
export const ALLOWED_EXT=Object.freeze(['glb','gltf','bin','fbx','obj','mtl','zip','png','jpg','jpeg','webp','wav','ogg','mp3','txt','md','pdf']);
export const MAX_BYTES=300*1024*1024,MAX_URL=600,MAX_REDIRECTS=5,FETCH_FRESH_MS=5*60000,DEFAULT_FOLDER='Downloads';

// true for an address that is not on the public internet (this PC, the home network, link-local, carrier-grade NAT, multicast), v4 or v6.
export function isPrivateAddress(ip){
 const s=String(ip||'').toLowerCase().trim();
 const m4=/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
 if(m4){const [a,b]=[Number(m4[1]),Number(m4[2])];return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0)||(a===198&&(b===18||b===19))}
 if(s.includes(':')){return s==='::'||s==='::1'||/^f[cd]/.test(s)||/^fe[89ab]/.test(s)||/^ff/.test(s)||/^::ffff:[0-9a-f:]+$/.test(s)}
 return true} // not an address at all: refuse
// {ok, url (the cleaned address), host} or {error}. https only, a real public name, no password in the address, the usual port, no fragment.
export function checkFetchUrl(raw){
 const text=String(raw??'').trim();
 if(!text)return {error:'Paste the link of the file first.'};
 if(text.length>MAX_URL)return {error:'That link is too long.'};
 if(/[\s\u0000-\u001f]/.test(text))return {error:'A link has no spaces in it.'};
 let u;try{u=new URL(text)}catch{return {error:'That is not a link. It should look like https://site.example/file.glb'}}
 if(u.protocol!=='https:')return {error:'Only https links are allowed.'};
 if(u.username||u.password)return {error:'A link with a user name or password in it is not allowed.'};
 if(u.port&&u.port!=='443')return {error:'Only the normal https port is allowed.'};
 const host=u.hostname.toLowerCase();
 if(!host.includes('.')||/^\[/.test(host)||/^\d+(?:\.\d+){0,3}$/.test(host))return {error:'Use the name of the site, not an address.'};
 if(host==='localhost'||/\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host))return {error:'That name is on your own network, not on the internet.'};
 if(!/^[a-z0-9.-]+$/.test(host)||host.length>120)return {error:'That site name is not allowed.'};
 u.hash='';return {ok:true,url:u.toString(),host}}
// "Characters/grab3d man" -> "Characters/grab3d_man": up to 3 plain segments; nothing that climbs out of assets-src. Empty -> Downloads.
export function cleanFolder(raw){
 const parts=String(raw??'').replace(/\\/g,'/').split('/').map(s=>s.trim()).filter(Boolean);
 if(parts.length>3||parts.some(p=>p==='.'||p==='..'||p.length>40||/[:*?"<>|]/.test(p)))return null;
 const clean=parts.map(p=>p.replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')).filter(Boolean);
 return clean.length?clean.join('/'):DEFAULT_FOLDER}
// A file name that is safe on disk, with an allowed kind of file, or null.
export function safeFileName(raw){
 let n=String(raw??'');try{n=decodeURIComponent(n)}catch{}
 n=n.split(/[\\/]/).pop().replace(/[^A-Za-z0-9._ -]+/g,'_').replace(/^[. ]+/,'').trim().slice(0,80);
 const m=/\.([A-Za-z0-9]{1,5})$/.exec(n);if(!m||!ALLOWED_EXT.includes(m[1].toLowerCase())||n.length<3)return null;
 return n}
// The name to save under: the one the site gives (Content-Disposition), else the last part of the address.
export function nameFrom(disposition,pathname){
 const d=/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(disposition||''));
 return safeFileName(d?d[1]:'')||safeFileName(String(pathname||'').split('/').filter(Boolean).pop())}
export const sizeText=b=>b>=1048576?(b/1048576).toFixed(1)+' MB':b>=1024?Math.round(b/1024)+' KB':b+' bytes';
