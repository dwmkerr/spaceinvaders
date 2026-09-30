import { config } from '../config.js';
import { rand } from '../rng.js';

const lanes = ['north', 'east', 'south', 'west'];

export function spawnsForTurn(seed, turn, rules = config.strategic) {
  if (rules.surgeTurns.includes(turn)) {
    return lanes.map((lane) => ({ lane, kind: 'runner' }));
  }

  const chance = rules.spawnChanceStart
    + (rules.spawnChanceEnd - rules.spawnChanceStart) * turn / (rules.turns - 1);
  return lanes.flatMap((lane, index) => {
    if (rand(seed, turn, 'spawn', index) >= chance) {
      return [];
    }
    const kind = rand(seed, turn, 'kind', index) < rules.runnerChance
      ? 'runner'
      : 'drone';
    return [{ lane, kind }];
  });
}

export function createStrategicGame({ seed, rules = config.strategic }) {
  const threats = rules.opening.map((threat, index) => ({
    id: index + 1,
    ...structuredClone(threat),
  }));
  return {
    mode: 'strategic',
    seed,
    rules: structuredClone(rules),
    turn: 0,
    status: 'playing',
    score: 0,
    lives: rules.lives,
    smartBombs: rules.smartBombs,
    facing: rules.startFacing,
    threats,
    nextId: threats.length + 1,
    lastShot: null,
    lastBomb: false,
  };
}

export function applyAction(world, action) {
  const next = structuredClone(world);
  next.pendingAction = structuredClone(action);
  return next;
}

function fire(world, rules) {
  const targets = world.threats
    .filter((threat) => threat.lane === world.facing)
    .sort((left, right) => left.distance - right.distance || left.id - right.id);
  const target = targets[0];
  world.lastShot = {
    lane: world.facing,
    distance: target?.distance ?? null,
  };
  if (target) {
    world.score += rules.points[target.kind];
    world.threats = world.threats.filter((threat) => threat.id !== target.id);
  }
}

function turn(world, direction) {
  const offset = direction === 'right' ? 1 : -1;
  const index = (lanes.indexOf(world.facing) + offset + lanes.length) % lanes.length;
  world.facing = lanes[index];
}

export function step(world) {
  const next = structuredClone(world);
  if (next.status !== 'playing') {
    return next;
  }

  const rules = next.rules ?? config.strategic;
  const action = next.pendingAction ?? { move: 'stay', fire: false, bomb: false };
  delete next.pendingAction;

  next.lastShot = null;
  next.lastBomb = false;

  if (action.bomb && next.smartBombs > 0) {
    next.smartBombs -= 1;
    next.score += next.threats.reduce(
      (score, threat) => score + rules.points[threat.kind],
      0,
    );
    next.threats = [];
    next.lastBomb = true;
  }

  if (action.fire) {
    fire(next, rules);
  }

  if (action.move === 'left' || action.move === 'right') {
    turn(next, action.move);
  }

  const advanced = next.threats.map((threat) => ({
    ...threat,
    distance: threat.distance - rules.speed[threat.kind],
  }));
  const hits = advanced.filter((threat) => threat.distance <= 0).length;
  next.lives -= hits;
  next.threats = advanced.filter((threat) => threat.distance > 0);

  if (next.lives <= 0) {
    next.status = 'lost';
    return next;
  }

  next.turn += 1;
  if (next.turn >= rules.turns) {
    next.status = 'won';
    next.score += next.smartBombs * rules.points.unusedBomb
      + next.lives * rules.points.life;
    return next;
  }

  for (const spawn of spawnsForTurn(next.seed, next.turn - 1, rules)) {
    next.threats.push({
      id: next.nextId,
      ...spawn,
      distance: rules.laneLength,
    });
    next.nextId += 1;
  }

  return next;
}

export function snapshot(world) {
  const rules = world.rules ?? config.strategic;
  return {
    mode: world.mode,
    turn: world.turn,
    turns: rules.turns,
    status: world.status,
    score: world.score,
    lives: world.lives,
    maxLives: rules.lives,
    smartBombs: world.smartBombs,
    maxSmartBombs: rules.smartBombs,
    facing: world.facing,
    laneLength: rules.laneLength,
    threats: structuredClone(world.threats),
    lastShot: structuredClone(world.lastShot),
    lastBomb: world.lastBomb,
  };
}
