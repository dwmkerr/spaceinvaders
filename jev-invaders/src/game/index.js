import {
  applyAction,
  createReflexiveGame,
  snapshot,
  step,
} from './reflexive.js';

// Only the real-time game runs through a panel. The strategic match is driven
// by src/duel.js, which owns its single shared board.
export function createGame(mode, options) {
  if (mode === 'reflexive') {
    return createReflexiveGame(options);
  }
  throw new Error(`no panel game for mode: ${mode}`);
}

export function gameApi(mode) {
  if (mode === 'reflexive') {
    return { applyAction, step, snapshot };
  }
  throw new Error(`no panel game for mode: ${mode}`);
}
