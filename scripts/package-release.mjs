// Builds an immutable release folder and points dist/index.html at it.
//   npm run release              -> uses "version" from package.json
//   npm run release -- 0.15.2    -> builds a specific version
//   add --force to rebuild a version that already exists (only before it is deployed)
import {mkdir,copyFile,readdir,readFile,writeFile,access} from 'node:fs/promises';

const args=process.argv.slice(2),force=args.includes('--force');
const pkg=JSON.parse(await readFile('package.json','utf8'));
const version=args.find(a=>!a.startsWith('--'))||pkg.version;
if(!/^\d+\.\d+\.\d+$/.test(version||'')){console.error(`Invalid version "${version}". Use x.y.z, e.g. npm run release -- 0.15.2`);process.exit(1)}
const dest=`dist/releases/${version}`;
const exists=await access(dest).then(()=>true,()=>false);
if(exists&&!force){
 console.error(`${dest} already exists. Released folders are cached as immutable, so bump "version" in package.json\n(or run: npm run release -- <new version>). Use --force only if this version was never deployed.`);
 process.exit(1);
}

await mkdir(`${dest}/vendor`,{recursive:true});
// The version the game reports to itself (update-check.js compares it with the site's version.json). Written before the copy below so every release carries its own number.
await writeFile('dist/version.js',`// WRITTEN by scripts/package-release.mjs (npm run release): the version of this release. Do not edit by hand.\nexport const VERSION='${version}';\n`);
const files=(await readdir('dist',{withFileTypes:true})).filter(f=>f.isFile()&&(f.name.endsWith('.js')||f.name==='style.css')).map(f=>f.name);
for(const name of files)await copyFile(`dist/${name}`,`${dest}/${name}`);
for(const name of (await readdir('dist/vendor')).filter(f=>f.endsWith('.js')))await copyFile(`dist/vendor/${name}`,`${dest}/vendor/${name}`);

let html=await readFile('dist/index.html','utf8');
const loader=`<script>\nconst fail=(message)=>{const el=document.getElementById('error');el.hidden=false;el.textContent='The game could not start: '+message+' — Please reload this page. Your saved progress has not been cleared.';};\nwindow.addEventListener('error',e=>fail(e.message||'A game file did not load'));\nwindow.addEventListener('unhandledrejection',e=>fail(e.reason?.message||'A game file did not load'));\nimport('./releases/${version}/game.js').catch(e=>fail(e.message));\n</script>`;
html=html.replace(/<script type="module" src="[^"]+"><\/script>/,loader);
html=html.replace(/href="(?:releases\/[^/"]+\/)?style\.css[^"]*"/,`href="releases/${version}/style.css"`);
html=html.replace(/releases\/[^/'"]+\/game\.js/g,`releases/${version}/game.js`);
// Version shown under the logo.
html=html.replace(/(VERSION )\d+\.\d+\.\d+/g,`$1${version}`);
if(!html.includes(`releases/${version}/game.js`)||!html.includes(`releases/${version}/style.css`)){console.error('Could not update dist/index.html to the new release paths.');process.exit(1)}
await writeFile('dist/index.html',html);
// The site's newest version, read by the running game (update-check.js). It must never be cached, or players would never hear about an update.
await writeFile('dist/version.json',JSON.stringify({version,released:new Date().toISOString().slice(0,10)})+'\n');
await writeFile('dist/_headers','/\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n/version.json\n  Cache-Control: no-cache\n/releases/*\n  Cache-Control: public, max-age=31536000, immutable\n');
console.log(`Packaged release ${version}: ${files.length} files -> ${dest}\ndist/index.html now loads releases/${version}/`);
