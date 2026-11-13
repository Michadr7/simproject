// Mikkadr Hub 2.7: "Check before going online". Gathers the facts about the next publish and prints one line, `FACTS {json}`; exits 0 when nothing blocks it. Sends nothing outward except one read of the live site's version.json
// and `wrangler whoami` (Cloudflare's own login check). It never deploys: that is scripts/deploy.mjs. The judging is in hub/deploy.js.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gatherFacts} from '../hub/deploy-facts.mjs';
import {deployChecks} from '../hub/web/deploy-rules.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const facts=await gatherFacts({root});
console.log('FACTS '+JSON.stringify(facts));
process.exit(deployChecks(facts).ready?0:1);