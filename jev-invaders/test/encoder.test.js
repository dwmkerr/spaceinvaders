import assert from 'node:assert/strict';
import test from 'node:test';

import { classicReflexive } from './fixtures.js';

import { config } from '../src/config.js';
import { encodeState, offsetWords } from '../src/encoder.js';
import { createReflexiveGame, snapshot } from '../src/game/reflexive.js';
import {
  createStrategicGame,
  playMove,
  snapshot as strategicSnapshot,
} from '../src/game/strategic.js';

function freshSnapshot() {
  return snapshot(createReflexiveGame({ seed: 1983, rules: classicReflexive }));
}

test('encodes a fresh reflexive world with fixed string fields', () => {
  const state = encodeState(freshSnapshot(), classicReflexive);

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

  const encoded = encodeState(state, classicReflexive);
  assert.equal(encoded.bomb_above, 'very close');
  assert.equal(encoded.bomb_left, 'far');

  state.cannon.col = 0;
  assert.equal(encodeState(state, classicReflexive).bomb_left, 'wall');
});

test('describes a formation that is about to step down', () => {
  const state = freshSnapshot();
  state.formation.col = 5;

  assert.equal(
    encodeState(state, classicReflexive).formation,
    'moving right, about to step down',
  );
});

test('position descriptions do not expose coordinates', () => {
  const state = freshSnapshot();
  state.formation.col = 5;
  state.bombs = [{ col: 7, row: 17 }];
  const encoded = encodeState(state, classicReflexive);

  for (const key of ['target', 'formation', 'bomb_above', 'bomb_left', 'bomb_right']) {
    assert.doesNotMatch(encoded[key], /\d/);
  }
});

test('encodes the Connect Four board from the mover\'s side of the table', () => {
  let world = createStrategicGame({ seed: 1983 });
  world = playMove(world, 'd'); // jev
  world = playMove(world, 'e'); // frontier
  const forJev = encodeState({ ...strategicSnapshot(world), side: 'jev' }, config.strategic);
  const forFrontier = encodeState({ ...strategicSnapshot(world), side: 'frontier' }, config.strategic);

  assert.deepEqual(Object.keys(forJev), ['rules', 'you', 'board', 'open_columns']);
  const rows = forJev.board.split('\n');
  assert.equal(rows[1], 'a b c d e f g');
  assert.equal(rows.length, 2 + 6);
  // Each player sees its own pieces as X and the other's as O.
  assert.equal(rows.at(-1), '. . . X O . .');
  assert.equal(forFrontier.board.split('\n').at(-1), '. . . O X . .');
  assert.equal(forJev.open_columns, 'a, b, c, d, e, f, g');
});

test('a full column drops out of the open columns', () => {
  let world = createStrategicGame({ seed: 1983 });
  for (let move = 0; move < 6; move += 1) {
    world = playMove(world, 'a');
  }
  const state = encodeState({ ...strategicSnapshot(world), side: 'jev' }, config.strategic);

  assert.equal(state.open_columns, 'b, c, d, e, f, g');
});
