import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import { encodeState, offsetWords } from '../src/encoder.js';
import { createReflexiveGame, snapshot } from '../src/game/reflexive.js';
import {
  createStrategicGame,
  snapshot as strategicSnapshot,
} from '../src/game/strategic.js';

function freshSnapshot() {
  return snapshot(createReflexiveGame({ seed: 1983 }));
}

test('encodes a fresh reflexive world with fixed string fields', () => {
  const state = encodeState(freshSnapshot(), config.reflexive);

  assert.deepEqual(Object.keys(state), [
    'rules',
    'cannon',
    'target',
    'formation',
    'bomb_above',
    'bomb_left',
    'bomb_right',
    'rocket',
    'invaders_left',
    'lives',
  ]);
  assert.ok(Object.values(state).every((value) => typeof value === 'string'));
  assert.equal(state.cannon, 'centre');
  assert.equal(state.target, 'one column to your left, high up');
  assert.equal(state.formation, 'moving right');
  assert.equal(state.bomb_above, 'none');
  assert.equal(state.bomb_left, 'none');
  assert.equal(state.bomb_right, 'none');
  assert.equal(state.rocket, 'ready');
  assert.equal(state.invaders_left, '18 of 18');
  assert.equal(state.lives, '3 of 3');
});

test('describes horizontal offsets in words', () => {
  assert.equal(offsetWords(0), 'directly above you');
  assert.equal(offsetWords(1), 'one column to your right');
  assert.equal(offsetWords(-2), 'two columns to your left');
  assert.equal(offsetWords(3), 'three columns to your right');
  assert.equal(offsetWords(5), 'a few columns to your right');
  assert.equal(offsetWords(-9), 'far to your left');
});

test('describes bombs relative to the cannon', () => {
  const state = freshSnapshot();
  state.bombs = [
    { col: 7, row: 17 },
    { col: 6, row: 8 },
  ];

  const encoded = encodeState(state, config.reflexive);
  assert.equal(encoded.bomb_above, 'very close');
  assert.equal(encoded.bomb_left, 'far');

  state.cannon.col = 0;
  assert.equal(encodeState(state, config.reflexive).bomb_left, 'wall');
});

test('describes a formation that is about to step down', () => {
  const state = freshSnapshot();
  state.formation.col = 5;

  assert.equal(
    encodeState(state, config.reflexive).formation,
    'moving right, about to step down',
  );
});

test('position descriptions do not expose coordinates', () => {
  const state = freshSnapshot();
  state.formation.col = 5;
  state.bombs = [{ col: 7, row: 17 }];
  const encoded = encodeState(state, config.reflexive);

  for (const key of ['target', 'formation', 'bomb_above', 'bomb_left', 'bomb_right']) {
    assert.doesNotMatch(encoded[key], /\d/);
  }
});

test('encodes a fresh strategic world with relative lanes', () => {
  const snapshot = strategicSnapshot(createStrategicGame({ seed: 1983 }));
  const state = encodeState(snapshot, config.strategic);

  assert.deepEqual(Object.keys(state), [
    'rules',
    'ahead',
    'right',
    'behind',
    'left',
    'smart_bombs',
    'lives',
    'siege',
    'threats',
  ]);
  assert.ok(Object.values(state).every((value) => typeof value === 'string'));
  assert.equal(state.ahead, 'drone, hits you in four turns');
  assert.equal(state.right, 'clear');
  assert.equal(state.behind, 'clear');
  assert.equal(state.left, 'runner, hits you in three turns');
  assert.equal(state.smart_bombs, '3 of 3 left');
  assert.equal(state.lives, '3 of 3');
  assert.equal(state.siege, '30 turns left');
  assert.equal(state.threats, '2 in the arena');
});

test('strategic lanes follow the cannon facing', () => {
  const snapshot = strategicSnapshot(createStrategicGame({ seed: 1983 }));
  snapshot.facing = 'east';
  const state = encodeState(snapshot, config.strategic);

  assert.equal(state.ahead, 'clear');
  assert.equal(state.left, 'drone, hits you in four turns');
});

test('strategic lane descriptions do not expose coordinates', () => {
  const snapshot = strategicSnapshot(createStrategicGame({ seed: 1983 }));
  const state = encodeState(snapshot, config.strategic);

  for (const key of ['ahead', 'right', 'behind', 'left']) {
    assert.doesNotMatch(state[key], /\d/);
  }
});
