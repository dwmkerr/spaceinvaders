import {
  applyAction as applyReflexiveAction,
  createReflexiveGame,
  snapshot as reflexiveSnapshot,
  step as stepReflexive,
} from './reflexive.js';
import {
  applyAction as applyStrategicAction,
  createStrategicGame,
  snapshot as strategicSnapshot,
  step as stepStrategic,
} from './strategic.js';

export function createGame(mode, options) {
  if (mode === 'reflexive') {
    return createReflexiveGame(options);
  }
  if (mode === 'strategic') {
    return createStrategicGame(options);
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
    return {
      applyAction: applyStrategicAction,
      step: stepStrategic,
      snapshot: strategicSnapshot,
    };
  }
  throw new Error(`unknown mode: ${mode}`);
}
