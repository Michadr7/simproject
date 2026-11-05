// One thing at a time. Swinging the axe, eating or drinking, shift work, resting and walking through a door each own the player
// until they finish. The flags are read from the game's own state (is a swing in progress? is something being eaten?), so there is
// no lock to forget to release: when the state clears, the action is over.
export const ACTION_KINDS=Object.freeze(['chop','consume','work','sleep','door']);
export const REFUSAL='Finish your current action first.';

// flags: {chop, consume, work, sleep, door}, each true while that action is in progress.
export const activeAction=(flags={})=>ACTION_KINDS.find(kind=>flags[kind])||null;
// Nothing may start while anything else is in progress (this includes starting the same action twice). `kind` can be any action,
// including ones that are not tracked as flags (equipping a tool, interacting, opening the bag), which only need things to be idle.
export const canStart=(kind,flags={})=>activeAction(flags)===null;
export const refusal=()=>REFUSAL;
