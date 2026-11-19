// timber-sounds.js: the lumber clips (axe, tree, logs, planks, chainsaw, sawmill blade; assets-src/sounds-timber, CC0, SND2) and the table audio.js plays them from. Pure data.
const freeze=Object.freeze;
export const CHAINSAW=freeze({start:'chainsaw-start',idle:'chainsaw-idle',cut:'chainsaw-cut',stop:'chainsaw-stop'});
export const SAWMILL_BLADE=freeze({idle:'sawmill-blade-idle',cut:'sawmill-blade-cut',stop:'sawmill-blade-stop'});
// kind -> the pool it picks from, its level (before the distance falloff) and the pitch spread; slot = the "last played" memory so a clip never repeats at once.
export const TIMBER_SHOTS=freeze({
 chop:freeze({clips:freeze(['axe-chop-1','axe-chop-2','axe-chop-3','axe-chop-4']),level:.65,jitter:.08,slot:'chop'}),
 fall:freeze({clips:freeze(['tree-fall']),level:.85,jitter:.04,slot:'fall'}),
 thud:freeze({clips:freeze(['tree-thud']),level:.9,jitter:.06,slot:'fall'}),
 logDrop:freeze({clips:freeze(['log-drop-1','log-drop-2','log-drop-3']),level:.7,jitter:.08,slot:'logDrop'}),
 plankDrop:freeze({clips:freeze(['plank-drop-1','plank-drop-2','plank-drop-3']),level:.6,jitter:.08,slot:'plankDrop'}),
 plankStack:freeze({clips:freeze(['plank-stack']),level:.65,jitter:.04,slot:'plankDrop'})
});
export const TIMBER_FILES=freeze([...new Set([...Object.values(TIMBER_SHOTS).flatMap(s=>s.clips),...Object.values(CHAINSAW),...Object.values(SAWMILL_BLADE)])]);
export const CONVEYOR_CLIP='conveyor-belt'; // optional loop, not wired yet