import {
  applyAction as applyReflexiveAction,
  createReflexiveGame,
  snapshot as reflexiveSnapshot,
  step as stepReflexive,
} from './reflexive.js';

export function createGame(mode, options) {
  if (mode === 'reflexive') {
    return createReflexiveGame(options);
  }
  if (mode === 'strategic') {
    throw new Error('strategic game not built yet');
  }
  throw new Error(`unknown mode: ${mode}`);
}

export function gameApi(mode) {
  if (mode === 'reflexive') {
    return {
      applyAction: applyReflexiveAction,
      step: stepReflexive,
      snapshot: reflexiveSnapshot,
    };
  }
  if (mode === 'strategic') {
    throw new Error('strategic game not built yet');
  }
  throw new Error(`unknown mode: ${mode}`);
}
