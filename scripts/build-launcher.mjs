// Builds the desktop exe: stages dist/index.html + the CURRENT release into launcher/game, then runs electron-builder.
// Usage: npm run launcher   (run `npm run release` first so dist/releases/<version> exists)
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync,cpSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist'),launcher=path.join(root,'launcher'),game=path.join(launcher,'game');
const version=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).version;
if(!existsSync(path.join(dist,'releases',version)))throw new Error(`dist/releases/${version} is missing: run "npm run release" first.`);
const index=readFileSync(path.join(dist,'index.html'),'utf8');
if(!index.includes(`releases/${version}/`))throw new Error(`dist/index.html does not load releases/${version}/: run "npm run release" first.`);
rmSync(game,{recursive:true,force:true});mkdirSync(game,{recursive:true});
for(const name of ['index.html','style.css','version.json','assets','vendor'])if(existsSync(path.join(dist,name)))cpSync(path.join(dist,name),path.join(game,name),{recursive:true});
cpSync(path.join(dist,'releases',version),path.join(game,'releases',version),{recursive:true});
const pkgFile=path.join(launcher,'package.json'),pkg=JSON.parse(readFileSync(pkgFile,'utf8'));pkg.version=version;writeFileSync(pkgFile,JSON.stringify(pkg,null,2)+'\n');
rmSync(path.join(launcher,'out'),{recursive:true,force:true});
execSync('npx electron-builder --win portable',{cwd:launcher,stdio:'inherit'});
console.log(`\nBuilt launcher/out/CityLife-${version}.exe`);