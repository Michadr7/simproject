import {tickLife as calculateLife,normalizeDrainMultiplier} from './life.js';
import {freshProgress, normalizeProgress} from './jobs.js';
import {plotAt,setPlot as withPlot} from './grid.js';

// Plain simulation data; Three.js meshes only display this state.
// freshProgress includes cooldowns: { [gigTypeId]: absoluteGameMinute },
// the persistent gigBoard, and resumable activeJob task progress.
export const GameState = {
  me: {id: null, name: '', position: {x: -5, y: .2, z: 15}, rotation: {y: 0}},
  progress: freshProgress(), // life includes food, thirst, energy (0–100); settings defaults to 1x drain.
  otherPlayers: Object.create(null)
};
export function initializeState(profile) {
  GameState.progress = normalizeProgress(profile.progress);
  Object.assign(GameState.me, {id: profile.playerId, name: profile.name});
}
// Grid plots (sparse, keyed "ix,iz"; see grid.js for the shapes). Missing keys are default plots.
// e.g. getPlot('120,-14') -> {type:'forest',tree:'pine',hits:0}
export const getPlot=key=>plotAt(GameState.progress,key);
export function setPlot(key,plot){GameState.progress=withPlot(GameState.progress,key,plot);return getPlot(key)}
export function setMePosition(x, y, z) {
  Object.assign(GameState.me.position, {x, y, z});
}

// State-level tick applies the testing setting without touching routine/game time.
export function tickLife(dt,moving,running,loadMultiplier=1){
 GameState.progress.life=calculateLife(GameState.progress.life,dt,moving,running,loadMultiplier,GameState.progress.settings.statDrainMultiplier);
}
export function setStatDrainMultiplier(value){
 GameState.progress.settings={...GameState.progress.settings,statDrainMultiplier:normalizeDrainMultiplier(Number(value))};
}
