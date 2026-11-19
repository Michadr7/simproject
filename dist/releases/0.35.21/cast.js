// Cast registry (stage C4): looks up any talkable person's cast data by id, personId or name.
import {EARLY_CAST} from './cast-early.js';

export const CASTS=EARLY_CAST;

export function castOf(who){
 if(typeof who!=='string')return null;
 const q=who.trim().toLowerCase();
 if(!q)return null;
 for(const c of CASTS)if(c.id.toLowerCase()===q||(c.personId&&c.personId.toLowerCase()===q)||c.name.toLowerCase()===q)return c;
 return null;
}
