import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import { encodeState } from '../src/encoder.js';
import {
  applyAction,
  createReflexiveGame,
  snapshot,
  step,
} from '../src/game/reflexive.js';

const rules = config.reflexive;

test('the shipped grid matches the original game: 11 files by 6 ranks, packed tight', () => {
  const fresh = snapshot(createReflexiveGame({ seed: config.seed }));

  assert.equal(fresh.invaders.length, 66);
  assert.equal(new Set(fresh.invaders.map((invader) => invader.col)).size, 11);
  assert.equal(new Set(fresh.invaders.map((invader) => invader.row)).size, 6);
  assert.equal(rules.formation.spacing, 1);
  assert.equal(rules.points.length, rules.formation.rows);
  // The top row is kept clear for the lives and score text.
  assert.ok(Math.min(...fresh.invaders.map((invader) => invader.row)) >= 1);
});

test('the formation stays on the grid for as long as the game runs', () => {
  let world = createReflexiveGame({ seed: config.seed });
  let steps = 0;
  while (world.status === 'playing' && steps < 10000) {
    world = step(world);
    steps += 1;
    const view = snapshot(world);
    for (const invader of view.invaders) {
      assert.ok(invader.col >= 0 && invader.col < rules.cols);
    }
    assert.ok(view.cannon.col >= 0 && view.cannon.col < rules.cols);
  }

  // Left alone, the invaders win, by bombs or by reaching the ground.
  assert.equal(world.status, 'lost');
});

test('a rocket fired from the start column kills the invader above it', () => {
  let world = createReflexiveGame({ seed: config.seed });
  world = step(applyAction(world, { move: 'stay', fire: true, bomb: false }));
  for (let i = 0; i < 20 && world.rocket; i += 1) {
    world = step(world);
  }

  assert.equal(snapshot(world).aliveCount, 65);
  assert.equal(world.score, 10);
});

test('the encoder describes the larger grid in the same relational words', () => {
  const state = encodeState(snapshot(createReflexiveGame({ seed: config.seed })), rules);

  assert.equal(state.cannon, 'centre');
  assert.equal(state.target, 'directly above you, halfway down');
  assert.equal(state.formation, 'moving right');
  assert.equal(state.invaders_left, '66 of 66');
  for (const key of ['cannon', 'target', 'formation', 'bomb_above', 'bomb_left', 'bomb_right']) {
    assert.doesNotMatch(state[key], /\d/);
  }

  const edge = snapshot(createReflexiveGame({ seed: config.seed }));
  edge.cannon.col = rules.cols - 1;
  assert.equal(encodeState(edge, rules).cannon, 'at the right wall');
  assert.equal(encodeState(edge, rules).bomb_right, 'wall');
});
