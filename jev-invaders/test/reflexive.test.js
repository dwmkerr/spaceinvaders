import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAction,
  createReflexiveGame,
  snapshot,
  step,
} from '../src/game/reflexive.js';

function createWorld() {
  return createReflexiveGame({ seed: 1983 });
}

function countAlive(world) {
  return world.alive.flat().filter(Boolean).length;
}

test('creates the initial reflexive world', () => {
  const world = createWorld();

  assert.equal(world.tick, 0);
  assert.equal(world.lives, 3);
  assert.equal(world.cannon.col, 7);
  assert.deepEqual(world.formation, { col: 2, row: 1, dir: 1 });
  assert.equal(countAlive(world), 18);
  assert.equal(world.status, 'playing');
});

test('formation moves sideways and bounces down at the wall', () => {
  let world = createWorld();
  for (let tick = 0; tick < 48; tick += 1) {
    world = step(world);
  }
  assert.equal(world.formation.col, 5);

  for (let tick = 48; tick < 64; tick += 1) {
    world = step(world);
  }
  assert.deepEqual(world.formation, { col: 5, row: 2, dir: -1 });
});

test('formation movement ignores player actions', () => {
  let active = createWorld();
  let idle = createWorld();

  for (let tick = 0; tick < 400; tick += 1) {
    active = step(applyAction(active, { move: 'left', fire: true }));
    idle = step(idle);
  }

  assert.equal(active.wave, 1);
  assert.equal(idle.wave, 1);
  assert.deepEqual(active.formation, idle.formation);
});

test('each action applies for one tick and movement is clamped', () => {
  let world = step(applyAction(createWorld(), { move: 'right' }));
  assert.equal(world.cannon.col, 8);

  world = step(world);
  assert.equal(world.cannon.col, 8);

  world.cannon.col = 0;
  world = step(applyAction(world, { move: 'left' }));
  assert.equal(world.cannon.col, 0);
});

test('only one rocket can be in flight', () => {
  let world = step(applyAction(createWorld(), { fire: true }));
  assert.deepEqual(world.rocket, { col: 7, row: 18 });

  world = step(applyAction(world, { fire: true }));
  assert.deepEqual(world.rocket, { col: 7, row: 17 });
});

test('a rocket kills an invader and adds its points', () => {
  const initial = createWorld();
  initial.rocket = { col: 2, row: 6 };

  const world = step(initial);

  assert.equal(world.alive[2][0], false);
  assert.equal(world.score, 10);
  assert.equal(world.rocket, null);
});

test('a bomb hitting the cannon costs a life and is cleared', () => {
  const initial = createWorld();
  initial.tick = 3;
  initial.bombs = [{ col: 7, row: 18 }];

  const world = step(initial);

  assert.equal(world.lives, 2);
  assert.ok(!world.bombs.some((bomb) => bomb.row === 19));
});

test('the final cannon hit loses the game and later steps do nothing', () => {
  const initial = createWorld();
  initial.tick = 3;
  initial.lives = 1;
  initial.bombs = [{ col: 7, row: 18 }];

  const lost = step(initial);
  assert.equal(lost.status, 'lost');
  assert.deepEqual(step(lost), lost);
});

test('invaders reaching the invasion row lose the game', () => {
  const initial = createWorld();
  initial.tick = 15;
  initial.formation = { col: 5, row: 13, dir: 1 };

  const world = step(initial);

  assert.equal(world.status, 'lost');
});

test('killing the last invader starts a fresh wave', () => {
  const initial = createWorld();
  initial.alive = initial.alive.map((row) => row.map(() => false));
  initial.alive[2][0] = true;
  initial.rocket = { col: 2, row: 6 };

  const world = step(initial);

  assert.equal(world.wave, 2);
  assert.deepEqual(world.formation, { col: 2, row: 1, dir: 1 });
  assert.equal(countAlive(world), 18);
});

test('the same seed and actions produce the same world', () => {
  let first = createWorld();
  let second = createWorld();
  let sawBomb = false;

  for (let tick = 0; tick < 300; tick += 1) {
    const action = { move: tick % 3 === 0 ? 'right' : 'stay', fire: tick % 5 === 0 };
    first = step(applyAction(first, action));
    second = step(applyAction(second, action));
    sawBomb ||= first.bombs.length > 0;
  }

  assert.deepEqual(first, second);
  assert.equal(sawBomb, true);
});

test('step does not mutate its input', () => {
  const initial = applyAction(createWorld(), { move: 'right', fire: true });
  const before = structuredClone(initial);

  step(initial);

  assert.deepEqual(initial, before);
});

test('snapshot expands living invaders and excludes pending actions', () => {
  const world = applyAction(createWorld(), { move: 'left', fire: true });
  const state = snapshot(world);

  assert.equal(state.invaders.length, 18);
  assert.equal(state.aliveCount, 18);
  assert.equal(state.totalInvaders, 18);
  assert.equal('pendingAction' in state, false);
});
