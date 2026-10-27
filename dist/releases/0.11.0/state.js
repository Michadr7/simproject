import {freshProgress, normalizeProgress} from './jobs.js';

// Plain simulation data; Three.js meshes only display this state.
export const GameState = {
  me: {id: null, name: '', position: {x: -5, y: .2, z: 15}, rotation: {y: 0}},
  progress: freshProgress(),
  otherPlayers: Object.create(null)
};
export function initializeState(profile) {
  GameState.progress = normalizeProgress(profile.progress);
  Object.assign(GameState.me, {id: profile.playerId, name: profile.name});
}
export function setMePosition(x, y, z) {
  Object.assign(GameState.me.position, {x, y, z});
}
