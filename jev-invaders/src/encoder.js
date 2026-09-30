const REFLEXIVE_RULES = 'You control a cannon on the bottom row. Invaders march side to side as a block and step down at each wall. If they reach the ground the game is over. Your rocket flies straight up and only one can be in flight at a time. Bombs fall straight down, and one that hits you ends the game.';

const CONNECT_FOUR_RULES = 'Connect Four on a grid seven columns wide and six rows high. Players take turns dropping a piece into a column, where it falls to the lowest empty cell. The first to get four of their own pieces in a line, across, up and down, or diagonally, wins.';

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

// The bands scale with the grid, so the same words describe the same part of
// the screen whatever its size.
function cannonWords(col, cols) {
  const centreLeft = cols / 2 - 1;
  const centreRight = cols / 2;
  const nearBand = Math.max(2, Math.round(cols / 8));
  if (col === 0) {
    return 'at the left wall';
  }
  if (col === cols - 1) {
    return 'at the right wall';
  }
  if (col < centreLeft - nearBand) {
    return 'left side';
  }
  if (col < centreLeft) {
    return 'left of centre';
  }
  if (col <= centreRight) {
    return 'centre';
  }
  if (col <= centreRight + nearBand) {
    return 'right of centre';
  }
  return 'right side';
}

function heightWords(row, cannonRow) {
  const rowsAbove = cannonRow - row;
  if (rowsAbove >= Math.ceil(cannonRow * 0.72)) {
    return 'high up';
  }
  if (rowsAbove >= Math.ceil(cannonRow * 0.45)) {
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
  return `${offsetWords(dx)}, ${heightWords(target.row, snapshot.cannon.row)}`;
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
  return bomb ? bombWords(snapshot.cannon.row - bomb.row) : 'none';
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
    cannon: cannonWords(snapshot.cannon.col, snapshot.cols),
    target: targetWords(snapshot),
    formation: formationWords(snapshot, rules),
    bomb_above: bombInColumn(snapshot, snapshot.cannon.col),
    bomb_left: leftBomb,
    bomb_right: rightBomb,
    rocket: snapshot.rocket ? 'in flight' : 'ready',
    invaders_left: `${snapshot.aliveCount} of ${snapshot.totalInvaders}`,
  };
}

// The board from one player's side of the table. The mover always sees its own
// pieces as X, so neither model has to work out which symbol it is playing.
function encodeStrategic(snapshot) {
  const rows = snapshot.board.map((row) => row.map((cell) => {
    if (cell === null) {
      return '.';
    }
    return cell === snapshot.side ? 'X' : 'O';
  }).join(' '));
  const letters = 'abcdefg'.slice(0, snapshot.cols).split('');

  return {
    rules: CONNECT_FOUR_RULES,
    you: 'Your pieces are X. Your opponent\'s pieces are O.',
    board: [
      `Columns are lettered ${letters[0]} to ${letters.at(-1)} from left to right. The top row is shown first.`,
      letters.join(' '),
      ...rows,
    ].join('\n'),
    open_columns: snapshot.openColumns.join(', '),
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
