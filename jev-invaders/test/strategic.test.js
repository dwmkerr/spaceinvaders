import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import {
  COLUMNS,
  createStrategicGame,
  openColumns,
  openingMove,
  playMove,
  snapshot,
} from '../src/game/strategic.js';

function playAll(world, columns) {
  return columns.reduce((next, column) => playMove(next, column), world);
}

test('starts with an empty seven by six board and Jev to move in the first game', () => {
  const world = createStrategicGame({ seed: 1983 });

  assert.equal(world.board.length, 6);
  assert.ok(world.board.every((row) => row.length === 7 && row.every((cell) => cell === null)));
  assert.equal(world.toMove, 'jev');
  assert.deepEqual(openColumns(world), COLUMNS);
});

test('the models take turns to go first', () => {
  assert.equal(createStrategicGame({ seed: 1983, game: 0 }).toMove, 'jev');
  assert.equal(createStrategicGame({ seed: 1983, game: 1 }).toMove, 'frontier');
  assert.equal(createStrategicGame({ seed: 1983, game: 2 }).toMove, 'jev');
});

test('a piece falls to the lowest empty cell and the turn passes', () => {
  const world = playAll(createStrategicGame({ seed: 1983 }), ['d', 'd']);

  assert.equal(world.board[5][3], 'jev');
  assert.equal(world.board[4][3], 'frontier');
  assert.equal(world.toMove, 'jev');
  assert.deepEqual(world.moves.at(-1), { player: 'frontier', column: 'd', col: 3, row: 4 });
});

test('four across wins and records the line', () => {
  const world = playAll(createStrategicGame({ seed: 1983 }), ['a', 'a', 'b', 'b', 'c', 'c', 'd']);

  assert.equal(world.status, 'over');
  assert.equal(world.winner, 'jev');
  assert.equal(world.reason, 'four in a line');
  assert.deepEqual(world.line, [
    { col: 0, row: 5 },
    { col: 1, row: 5 },
    { col: 2, row: 5 },
    { col: 3, row: 5 },
  ]);
});

test('four up and down and four on a diagonal both win', () => {
  const vertical = playAll(createStrategicGame({ seed: 1983 }), ['a', 'b', 'a', 'b', 'a', 'b', 'a']);
  assert.equal(vertical.winner, 'jev');

  // Jev builds a rising diagonal from a to d.
  const diagonal = playAll(createStrategicGame({ seed: 1983 }), [
    'a', 'b', 'b', 'c', 'c', 'd', 'c', 'd', 'd', 'g', 'd',
  ]);
  assert.equal(diagonal.winner, 'jev');
  assert.equal(diagonal.line.length, 4);
});

test('picking a full column gives the game to the other player', () => {
  let world = playAll(createStrategicGame({ seed: 1983 }), ['a', 'a', 'a', 'a', 'a', 'a']);
  assert.equal(openColumns(world).includes('a'), false);

  world = playMove(world, 'a');
  assert.equal(world.status, 'over');
  assert.equal(world.winner, 'frontier');
  assert.equal(world.reason, 'illegal move');
});

test('a finished game ignores further moves', () => {
  const won = playAll(createStrategicGame({ seed: 1983 }), ['a', 'a', 'b', 'b', 'c', 'c', 'd']);

  assert.deepEqual(playMove(won, 'e'), won);
});

test('a full board with no line is a draw', () => {
  // Filled column by column in a pattern with no four in a line.
  const pattern = ['a', 'b', 'a', 'b', 'a', 'b', 'b', 'a', 'b', 'a', 'b', 'a',
    'c', 'd', 'c', 'd', 'c', 'd', 'd', 'c', 'd', 'c', 'd', 'c',
    'e', 'f', 'e', 'f', 'e', 'f', 'f', 'e', 'f', 'e', 'f', 'e',
    'g', 'g', 'g', 'g', 'g', 'g'];
  const world = playAll(createStrategicGame({ seed: 1983 }), pattern);

  assert.equal(world.status, 'over');
  assert.equal(world.winner, null);
  assert.equal(world.reason, 'board full');
});

test('the opening move is seeded, legal and varies between games', () => {
  const openings = [0, 1, 2, 3, 4, 5, 6, 7].map((game) => (
    openingMove(createStrategicGame({ seed: 1983, game }))
  ));

  assert.ok(openings.every((column) => COLUMNS.includes(column)));
  assert.ok(new Set(openings).size > 1);
  assert.equal(
    openingMove(createStrategicGame({ seed: 1983, game: 2 })),
    openingMove(createStrategicGame({ seed: 1983, game: 2 })),
  );
});

test('the snapshot carries what the page and the encoder need', () => {
  const view = snapshot(playAll(createStrategicGame({ seed: 1983 }), ['d']));

  assert.equal(view.mode, 'strategic');
  assert.equal(view.cols, config.strategic.cols);
  assert.equal(view.moveCount, 1);
  assert.equal(view.toMove, 'frontier');
  assert.deepEqual(view.lastMove, { player: 'jev', column: 'd', col: 3, row: 5 });
});

test('playMove leaves its input unchanged', () => {
  const world = createStrategicGame({ seed: 1983 });
  const before = structuredClone(world);

  playMove(world, 'c');

  assert.deepEqual(world, before);
});
