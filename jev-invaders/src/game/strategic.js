import { config } from '../config.js';
import { rand } from '../rng.js';

// The strategic game is a head-to-head: the two models play Connect Four
// against each other on one board. Looking a move or two ahead decides it,
// which is what a single-pass model is weakest at and a reasoning model is for.

export const COLUMNS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
export const PLAYERS = ['jev', 'frontier'];

const other = (player) => (player === 'jev' ? 'frontier' : 'jev');

const LINES = [
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: 1, row: 1 },
  { col: 1, row: -1 },
];

export function createStrategicGame({ seed, rules = config.strategic, game = 0 }) {
  return {
    mode: 'strategic',
    seed,
    rules: structuredClone(rules),
    game,
    // Row 0 is the top. A cell holds null or the player who owns the piece.
    board: Array.from({ length: rules.rows }, () => Array(rules.cols).fill(null)),
    // The models take turns to go first, so neither keeps that advantage.
    toMove: PLAYERS[game % 2],
    moves: [],
    status: 'playing',
    winner: null,
    line: null,
    reason: null,
  };
}

export function openColumns(world) {
  return COLUMNS.slice(0, world.rules.cols).filter((_, col) => world.board[0][col] === null);
}

// The first piece of each game is dropped by the code, not a model. Both
// models answer the same position the same way every time, so without this
// every game that starts the same way would replay move for move.
export function openingMove(world) {
  const columns = COLUMNS.slice(0, world.rules.cols);
  return columns[Math.floor(rand(world.seed, world.game, 'opening') * columns.length)];
}

function winningLine(board, player) {
  const rows = board.length;
  const cols = board[0].length;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      for (const step of LINES) {
        const cells = [0, 1, 2, 3].map((index) => ({
          col: col + step.col * index,
          row: row + step.row * index,
        }));
        if (cells.every((cell) => board[cell.row]?.[cell.col] === player)) {
          return cells;
        }
      }
    }
  }
  return null;
}

export function playMove(world, column) {
  const next = structuredClone(world);
  if (next.status !== 'playing') {
    return next;
  }

  const player = next.toMove;
  const col = COLUMNS.indexOf(column);
  // Picking a full column, or no column at all, gives the game away. A
  // substitute move would be the code playing, not the model.
  if (!openColumns(next).includes(column)) {
    next.status = 'over';
    next.winner = other(player);
    next.reason = 'illegal move';
    return next;
  }

  let row = next.rules.rows - 1;
  while (next.board[row][col] !== null) {
    row -= 1;
  }
  next.board[row][col] = player;
  next.moves.push({ player, column, col, row });

  const line = winningLine(next.board, player);
  if (line) {
    next.status = 'over';
    next.winner = player;
    next.line = line;
    next.reason = 'four in a line';
  } else if (openColumns(next).length === 0) {
    next.status = 'over';
    next.reason = 'board full';
  } else {
    next.toMove = other(player);
  }
  return next;
}

export function snapshot(world) {
  return {
    mode: world.mode,
    game: world.game,
    cols: world.rules.cols,
    rows: world.rules.rows,
    board: structuredClone(world.board),
    toMove: world.toMove,
    moveCount: world.moves.length,
    lastMove: structuredClone(world.moves.at(-1) ?? null),
    openColumns: openColumns(world),
    status: world.status,
    winner: world.winner,
    line: structuredClone(world.line),
    reason: world.reason,
  };
}
