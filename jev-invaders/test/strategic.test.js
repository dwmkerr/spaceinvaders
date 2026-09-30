import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import {
  applyAction,
  createStrategicGame,
  snapshot,
  spawnsForTurn,
  step,
} from '../src/game/strategic.js';

const idle = { move: 'stay', fire: false, bomb: false };

function worldWith(threats) {
  return {
    ...createStrategicGame({ seed: config.seed }),
    threats,
    nextId: threats.length + 1,
  };
}

function play(policy) {
  let world = createStrategicGame({ seed: config.seed });
  while (world.status === 'playing') {
    world = step(applyAction(world, policy(world)));
  }
  return world;
}

test('starts with the opening threats and full resources', () => {
  const world = createStrategicGame({ seed: config.seed });

  assert.equal(world.turn, 0);
  assert.equal(world.facing, 'north');
  assert.equal(world.lives, 3);
  assert.equal(world.smartBombs, 3);
  assert.deepEqual(world.threats, [
    { id: 1, lane: 'north', distance: 4, kind: 'drone' },
    { id: 2, lane: 'west', distance: 6, kind: 'runner' },
  ]);
});

test('fires before turning', () => {
  const world = worldWith([
    { id: 1, lane: 'north', distance: 3, kind: 'drone' },
  ]);
  const next = step(applyAction(world, { fire: true, move: 'right' }));

  assert.equal(next.threats.some((threat) => threat.id === 1), false);
  assert.equal(next.facing, 'east');
  assert.deepEqual(next.lastShot, { lane: 'north', distance: 3 });
});

test('fire hits only the nearest threat', () => {
  const world = worldWith([
    { id: 1, lane: 'north', distance: 4, kind: 'drone' },
    { id: 2, lane: 'north', distance: 2, kind: 'runner' },
  ]);
  const next = step(applyAction(world, { ...idle, fire: true }));

  assert.equal(next.score, 20);
  assert.deepEqual(next.lastShot, { lane: 'north', distance: 2 });
  assert.equal(next.threats.some((threat) => threat.id === 1), true);
  assert.equal(next.threats.some((threat) => threat.id === 2), false);
});

test('threats advance and runners reaching the cannon cause damage', () => {
  const world = worldWith([
    { id: 1, lane: 'north', distance: 2, kind: 'runner' },
    { id: 2, lane: 'east', distance: 2, kind: 'drone' },
  ]);
  const next = step(world);

  assert.equal(next.lives, 2);
  assert.equal(next.threats.some((threat) => threat.id === 1), false);
  assert.deepEqual(
    next.threats.find((threat) => threat.id === 2),
    { id: 2, lane: 'east', distance: 1, kind: 'drone' },
  );
});

test('a smart bomb clears and scores every threat', () => {
  const world = worldWith([
    { id: 1, lane: 'north', distance: 4, kind: 'drone' },
    { id: 2, lane: 'west', distance: 6, kind: 'runner' },
  ]);
  const next = step(applyAction(world, { ...idle, bomb: true }));

  assert.equal(next.score, 30);
  assert.equal(next.smartBombs, 2);
  assert.equal(next.lastBomb, true);
  assert.equal(next.threats.some((threat) => threat.id <= 2), false);
});

test('trying to bomb with no bombs left does nothing', () => {
  const world = {
    ...worldWith([{ id: 1, lane: 'east', distance: 4, kind: 'drone' }]),
    smartBombs: 0,
  };
  const next = step(applyAction(world, { ...idle, bomb: true }));

  assert.equal(next.score, 0);
  assert.equal(next.smartBombs, 0);
  assert.equal(next.lastBomb, false);
  assert.deepEqual(
    next.threats.find((threat) => threat.id === 1),
    { id: 1, lane: 'east', distance: 3, kind: 'drone' },
  );
});

test('rotates in both directions', () => {
  const west = step(applyAction(worldWith([]), { ...idle, move: 'left' }));
  const north = step(applyAction({ ...worldWith([]), facing: 'west' }, {
    ...idle,
    move: 'right',
  }));

  assert.equal(west.facing, 'west');
  assert.equal(north.facing, 'north');
});

test('surviving the final turn wins and adds resource bonuses', () => {
  const world = {
    ...worldWith([]),
    turn: 29,
    lives: 2,
    smartBombs: 1,
  };
  const next = step(world);

  assert.equal(next.status, 'won');
  assert.equal(next.turn, 30);
  assert.equal(next.score, 250);
});

test('a fatal hit loses and later steps leave the world unchanged', () => {
  const world = {
    ...worldWith([{ id: 1, lane: 'south', distance: 1, kind: 'drone' }]),
    lives: 1,
  };
  const lost = step(world);

  assert.equal(lost.status, 'lost');
  assert.deepEqual(step(applyAction(lost, { ...idle, bomb: true })), {
    ...lost,
    pendingAction: { ...idle, bomb: true },
  });
});

test('surge turns spawn four runners', () => {
  assert.deepEqual(spawnsForTurn(config.seed, 8, config.strategic), [
    { lane: 'north', kind: 'runner' },
    { lane: 'east', kind: 'runner' },
    { lane: 'south', kind: 'runner' },
    { lane: 'west', kind: 'runner' },
  ]);
});

test('the spawn script is deterministic', () => {
  assert.deepEqual(
    spawnsForTurn(config.seed, 7, config.strategic),
    spawnsForTurn(config.seed, 7, config.strategic),
  );
});

test('actions do not change the spawn script', () => {
  let first = { ...createStrategicGame({ seed: config.seed }), lives: 99 };
  let second = { ...createStrategicGame({ seed: config.seed }), lives: 99 };

  for (let turn = 0; turn < 8; turn += 1) {
    const firstId = first.nextId;
    const secondId = second.nextId;
    first = step(applyAction(first, idle));
    second = step(applyAction(second, {
      move: turn % 2 === 0 ? 'left' : 'right',
      fire: true,
      bomb: false,
    }));
    const spawnedFirst = first.threats
      .filter((threat) => threat.id >= firstId)
      .map(({ lane, kind }) => ({ lane, kind }));
    const spawnedSecond = second.threats
      .filter((threat) => threat.id >= secondId)
      .map(({ lane, kind }) => ({ lane, kind }));
    assert.deepEqual(spawnedFirst, spawnedSecond);
  }
});

test('do-nothing loses and a greedy policy scores more', () => {
  const doNothing = play(() => idle);
  const order = ['north', 'east', 'south', 'west'];
  const greedy = play((world) => {
    const hitting = world.threats.filter((threat) => (
      threat.distance - world.rules.speed[threat.kind] <= 0
    ));
    const soonest = world.threats.toSorted((left, right) => {
      const leftTurns = Math.ceil(left.distance / world.rules.speed[left.kind]);
      const rightTurns = Math.ceil(right.distance / world.rules.speed[right.kind]);
      return leftTurns - rightTurns || left.id - right.id;
    })[0];
    let move = 'stay';
    if (soonest && soonest.lane !== world.facing) {
      const facing = order.indexOf(world.facing);
      const target = order.indexOf(soonest.lane);
      move = (target - facing + order.length) % order.length === 1
        ? 'right'
        : 'left';
    }
    return {
      move,
      fire: true,
      bomb: hitting.length >= 2,
    };
  });

  assert.equal(doNothing.status, 'lost');
  assert.ok(doNothing.turn < config.strategic.turns);
  assert.ok(greedy.score > doNothing.score);
});

test('step is pure and snapshot excludes internal state', () => {
  const world = applyAction(createStrategicGame({ seed: config.seed }), {
    ...idle,
    fire: true,
  });
  const before = structuredClone(world);

  step(world);

  assert.deepEqual(world, before);
  assert.deepEqual(snapshot(world), {
    mode: 'strategic',
    turn: 0,
    turns: 30,
    status: 'playing',
    score: 0,
    lives: 3,
    maxLives: 3,
    smartBombs: 3,
    maxSmartBombs: 3,
    facing: 'north',
    laneLength: 6,
    threats: before.threats,
    lastShot: null,
    lastBomb: false,
  });
});
