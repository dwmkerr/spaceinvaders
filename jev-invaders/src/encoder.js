const REFLEXIVE_RULES = 'You control a cannon on the bottom row. Invaders march side to side as a block and step down at each wall. If they reach the ground the game is over. Your rocket flies straight up and only one can be in flight at a time. Bombs fall straight down; one that hits you costs a life.';

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

export function encodeState(snapshot, rules) {
  if (snapshot.mode === 'reflexive') {
    return encodeReflexive(snapshot, rules);
  }
  if (snapshot.mode === 'strategic') {
    throw new Error('strategic encoder not built yet');
  }
  throw new Error(`unknown mode: ${snapshot.mode}`);
}
