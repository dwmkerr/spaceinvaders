const REFLEXIVE_RULES = 'You control a cannon on the bottom row. Invaders march side to side as a block and step down at each wall. If they reach the ground the game is over. Your rocket flies straight up and only one can be in flight at a time. Bombs fall straight down; one that hits you costs a life.';
const LANES = ['north', 'east', 'south', 'west'];

function strategicRules(rules) {
  return `You are a cannon at the centre of a cross-shaped arena. Threats advance on you along four lanes: ahead, right, behind and left. Each turn happens in this order: an optional smart bomb destroys every threat in the arena; then you may fire, which destroys the nearest threat in the lane ahead; then you may make a quarter turn left or right; then threats advance, drones one step and runners two. A threat that reaches you costs a life. You have ${rules.smartBombs} smart bombs for the whole game. The siege lasts ${rules.turns} turns. If you survive you score ${rules.points.unusedBomb} per unused smart bomb and ${rules.points.life} per remaining life. Each threat destroyed scores ${rules.points.drone} for a drone or ${rules.points.runner} for a runner.`;
}

export function offsetWords(dx) {
  if (dx === 0) {
    return 'directly above you';
  }

  const distance = Math.abs(dx);
  const direction = dx < 0 ? 'left' : 'right';
  if (distance === 1) {
    return `one column to your ${direction}`;
  }
  if (distance === 2) {
    return `two columns to your ${direction}`;
  }
  if (distance === 3) {
    return `three columns to your ${direction}`;
  }
  if (distance <= 6) {
    return `a few columns to your ${direction}`;
  }
  return `far to your ${direction}`;
}

export function bombWords(rowsAbove) {
  if (rowsAbove <= 3) {
    return 'very close';
  }
  if (rowsAbove <= 8) {
    return 'close';
  }
  return 'far';
}

function cannonWords(col) {
  if (col === 0) {
    return 'at the left wall';
  }
  if (col <= 4) {
    return 'left side';
  }
  if (col <= 6) {
    return 'left of centre';
  }
  if (col <= 8) {
    return 'centre';
  }
  if (col <= 10) {
    return 'right of centre';
  }
  if (col <= 14) {
    return 'right side';
  }
  return 'at the right wall';
}

function heightWords(row) {
  const rowsAbove = 19 - row;
  if (rowsAbove >= 14) {
    return 'high up';
  }
  if (rowsAbove >= 9) {
    return 'halfway down';
  }
  return 'low';
}

function targetWords(snapshot) {
  if (snapshot.invaders.length === 0) {
    return 'no invaders left';
  }

  const target = [...snapshot.invaders].sort((left, right) => {
    const leftOffset = Math.abs(left.col - snapshot.cannon.col);
    const rightOffset = Math.abs(right.col - snapshot.cannon.col);
    return leftOffset - rightOffset
      || right.row - left.row
      || left.col - right.col;
  })[0];
  const dx = target.col - snapshot.cannon.col;
  return `${offsetWords(dx)}, ${heightWords(target.row)}`;
}

function formationWords(snapshot, rules) {
  const direction = snapshot.formation.dir < 0 ? 'left' : 'right';
  const nextCol = snapshot.formation.col + snapshot.formation.dir;
  const width = (rules.formation.cols - 1) * rules.formation.spacing;
  const willDrop = nextCol < 0 || nextCol + width >= snapshot.cols;
  return `moving ${direction}${willDrop ? ', about to step down' : ''}`;
}

function bombInColumn(snapshot, col) {
  const bomb = snapshot.bombs
    .filter((candidate) => candidate.col === col)
    .sort((left, right) => right.row - left.row)[0];
  return bomb ? bombWords(19 - bomb.row) : 'none';
}

function encodeReflexive(snapshot, rules) {
  const leftBomb = snapshot.cannon.col === 0
    ? 'wall'
    : bombInColumn(snapshot, snapshot.cannon.col - 1);
  const rightBomb = snapshot.cannon.col === snapshot.cols - 1
    ? 'wall'
    : bombInColumn(snapshot, snapshot.cannon.col + 1);

  return {
    rules: REFLEXIVE_RULES,
    cannon: cannonWords(snapshot.cannon.col),
    target: targetWords(snapshot),
    formation: formationWords(snapshot, rules),
    bomb_above: bombInColumn(snapshot, snapshot.cannon.col),
    bomb_left: leftBomb,
    bomb_right: rightBomb,
    rocket: snapshot.rocket ? 'in flight' : 'ready',
    invaders_left: `${snapshot.aliveCount} of ${snapshot.totalInvaders}`,
    lives: `${snapshot.lives} of ${snapshot.maxLives}`,
  };
}

function turnWords(turns) {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
  return words[turns];
}

function reachWords(threat, rules) {
  const turns = Math.ceil(threat.distance / rules.speed[threat.kind]);
  if (turns === 1) {
    return 'hits you at the end of this turn';
  }
  if (turns === 2) {
    return 'hits you next turn';
  }
  return `hits you in ${turnWords(turns)} turns`;
}

function laneWords(snapshot, rules, lane) {
  const threats = snapshot.threats
    .filter((threat) => threat.lane === lane)
    .sort((left, right) => {
      const leftTurns = Math.ceil(left.distance / rules.speed[left.kind]);
      const rightTurns = Math.ceil(right.distance / rules.speed[right.kind]);
      return leftTurns - rightTurns
        || left.distance - right.distance
        || left.id - right.id;
    });
  if (threats.length === 0) {
    return 'clear';
  }
  return threats
    .map((threat) => `${threat.kind}, ${reachWords(threat, rules)}`)
    .join('; ');
}

function encodeStrategic(snapshot, rules) {
  const facing = LANES.indexOf(snapshot.facing);
  const lane = (offset) => LANES[(facing + offset) % LANES.length];
  const turnsLeft = snapshot.turns - snapshot.turn;

  return {
    rules: strategicRules(rules),
    ahead: laneWords(snapshot, rules, lane(0)),
    right: laneWords(snapshot, rules, lane(1)),
    behind: laneWords(snapshot, rules, lane(2)),
    left: laneWords(snapshot, rules, lane(3)),
    smart_bombs: `${snapshot.smartBombs} of ${snapshot.maxSmartBombs} left`,
    lives: `${snapshot.lives} of ${snapshot.maxLives}`,
    siege: turnsLeft === 1 ? 'this is the last turn' : `${turnsLeft} turns left`,
    threats: snapshot.threats.length === 0
      ? 'none in the arena'
      : `${snapshot.threats.length} in the arena`,
  };
}

export function encodeState(snapshot, rules) {
  if (snapshot.mode === 'reflexive') {
    return encodeReflexive(snapshot, rules);
  }
  if (snapshot.mode === 'strategic') {
    return encodeStrategic(snapshot, rules);
  }
  throw new Error(`unknown mode: ${snapshot.mode}`);
}
