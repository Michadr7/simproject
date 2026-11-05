// The `simproject` Worker's entry (wrangler.jsonc "main"). Everything is in lobby.js; see its header for the routes.
import {handleRequest,Lobby} from './lobby.js';
export default {fetch:handleRequest};
export {Lobby};