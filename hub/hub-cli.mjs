// Mikkadr Hub P4, S2: `npm run hub` starts the local hub on 127.0.0.1:8765 (or --port=<n>) and keeps it running. No model call.
//   npm run hub                 serve the hub
//   npm run hub -- --open       also open it in the default browser
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {createHubServer} from './server.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),want=args.find(a=>a.startsWith('--port='));
const srv=createHubServer({root:ROOT,port:want?+want.split('=')[1]:8765});
let port;try{port=await srv.listen()}catch(e){console.error(e.code==='EADDRINUSE'?'That port is already in use: is the hub already running? Try --port=<n>.':'Could not start: '+e.message);process.exit(1)}
const url=`http://127.0.0.1:${port}/`;
console.log(`Mikkadr Hub: ${url}  (Ctrl+C to stop)`);
console.log(`  Assets ${url}assets · 3D viewer ${url}viewer.html · Tokens ${url}tokens`);
console.log('  The asset and token pages are built by npm run assets and npm run watcher.');
if(args.includes('--open'))execFile('cmd',['/c','start','',url]);
