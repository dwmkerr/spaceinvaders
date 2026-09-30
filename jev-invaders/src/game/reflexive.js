import { config } from '../config.js';
import { rand } from '../rng.js';

function createAlive(rules) {
  return Array.from(
    { length: rules.formation.rows },
    () => Array(rules.formation.cols).fill(true),
  );
}

function resetFormation(world, rules) {
  world.formation = {
    col: rules.formation.startCol,
    row: rules.formation.startRow,
    dir: 1,
  };
  world.alive = createAlive(rules);
}

function invaderPosition(world, rules, slotRow, slotCol) {
  return {
    col: world.formation.col + slotCol * rules.formation.spacing,
    row: world.formation.row + slotRow * rules.formation.spacing,
  };
}

function checkRocketHit(world, rules) {
  if (!world.rocket) {
    return;
  }

  for (let slotRow = 0; slotRow < rules.formation.rows; slotRow += 1) {
    for (let slotCol = 0; slotCol < rules.formation.cols; slotCol += 1) {
      if (!world.alive[slotRow][slotCol]) {
        continue;
      }
      const position = invaderPosition(world, rules, slotRow, slotCol);
      if (position.col === world.rocket.col && position.row === world.rocket.row) {
        world.alive[slotRow][slotCol] = false;
        world.score += rules.points[slotRow];
        world.rocket = null;
        return;
      }
    }
  }
}

function checkCannonHit(world) {
  const hit = world.bombs.some((bomb) => (
    bomb.col === world.cannon.col && bomb.row === world.cannon.row
  ));
  if (!hit) {
    return;
  }

  world.lives -= 1;
  world.bombs = [];
  if (world.lives <= 0) {
    world.status = 'lost';
  }
}

function moveFormation(world, rules) {
  const nextCol = world.formation.col + world.formation.dir;
  const formationWidth = (rules.formation.cols - 1) * rules.formation.spacing;
  if (nextCol < 0 || nextCol + formationWidth >= rules.cols) {
    world.formation.row += 1;
    world.formation.dir = -world.formation.dir;
  } else {
    world.formation.col = nextCol;
  }
}

function spawnBomb(world, rules) {
  if (world.bombs.length >= rules.maxBombs
      || rand(world.seed, world.tick, 'bomb') >= rules.bombChance) {
    return;
  }

  const slotCol = Math.floor(
    rand(world.seed, world.tick, 'slot') * rules.formation.cols,
  );
  for (let slotRow = rules.formation.rows - 1; slotRow >= 0; slotRow -= 1) {
    if (world.alive[slotRow][slotCol]) {
      const position = invaderPosition(world, rules, slotRow, slotCol);
      world.bombs.push({ col: position.col, row: position.row + 1 });
      return;
    }
  }
}

function aliveCount(world) {
  return world.alive.reduce(
    (count, row) => count + row.filter(Boolean).length,
    0,
  );
}

export function createReflexiveGame({ seed, rules = config.reflexive }) {
  const world = {
    mode: 'reflexive',
    seed,
    rules: structuredClone(rules),
    tick: 0,
    status: 'playing',
    score: 0,
    lives: rules.lives,
    wave: 1,
    cannon: { col: rules.cannonStartCol, row: rules.cannonRow },
    rocket: null,
    bombs: [],
  };
  resetFormation(world, rules);
  return world;
}

export function applyAction(world, action) {
  const next = structuredClone(world);
  next.pendingAction = structuredClone(action);
  return next;
}

export function step(world) {
  const next = structuredClone(world);
  if (next.status !== 'playing') {
    return next;
  }

  const rules = next.rules ?? config.reflexive;
  const action = next.pendingAction ?? { move: 'stay', fire: false, bomb: false };
  delete next.pendingAction;

  next.tick += 1;

  if (next.rocket) {
    next.rocket.row -= 1;
    if (next.rocket.row < 0) {
      next.rocket = null;
    } else {
      checkRocketHit(next, rules);
    }
  }

  if (action.move === 'left') {
    next.cannon.col = Math.max(0, next.cannon.col - 1);
  } else if (action.move === 'right') {
    next.cannon.col = Math.min(rules.cols - 1, next.cannon.col + 1);
  }
  if (action.fire && !next.rocket) {
    next.rocket = { col: next.cannon.col, row: rules.rocketStartRow };
  }
  checkCannonHit(next);

  if (next.tick % rules.invaderMoveEvery === 0) {
    moveFormation(next, rules);
    checkRocketHit(next, rules);
  }

  if (next.tick % rules.bombFallEvery === 0) {
    next.bombs = next.bombs
      .map((bomb) => ({ ...bomb, row: bomb.row + 1 }))
      .filter((bomb) => bomb.row < rules.rows);
    checkCannonHit(next);
  }

  spawnBomb(next, rules);

  const invaded = next.alive.some((row, slotRow) => row.some((isAlive, slotCol) => (
    isAlive
      && invaderPosition(next, rules, slotRow, slotCol).row >= rules.invasionRow
  )));
  if (invaded) {
    next.status = 'lost';
  }

  if (aliveCount(next) === 0) {
    next.wave += 1;
    resetFormation(next, rules);
    next.rocket = null;
    next.bombs = [];
  }

  return next;
}

export function snapshot(world) {
  const rules = world.rules ?? config.reflexive;
  const invaders = [];
  for (let slotRow = 0; slotRow < rules.formation.rows; slotRow += 1) {
    for (let slotCol = 0; slotCol < rules.formation.cols; slotCol += 1) {
      if (world.alive[slotRow][slotCol]) {
        invaders.push({
          ...invaderPosition(world, rules, slotRow, slotCol),
          slotRow,
          slotCol,
        });
      }
    }
  }

  return {
    mode: world.mode,
    tick: world.tick,
    status: world.status,
    score: world.score,
    lives: world.lives,
    maxLives: rules.lives,
    wave: world.wave,
    cols: rules.cols,
    rows: rules.rows,
    cannon: structuredClone(world.cannon),
    rocket: structuredClone(world.rocket),
    bombs: structuredClone(world.bombs),
    formation: structuredClone(world.formation),
    invaders,
    aliveCount: invaders.length,
    totalInvaders: rules.formation.rows * rules.formation.cols,
  };
}
