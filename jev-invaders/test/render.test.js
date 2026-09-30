import assert from 'node:assert/strict';
import test from 'node:test';

import { createReflexiveGame, snapshot } from '../src/game/reflexive.js';
import {
  createStrategicGame,
  playMove,
  snapshot as strategicSnapshot,
} from '../src/game/strategic.js';
import {
  boardPalette,
  drawPanel,
  drawStrategic,
  gamePalette,
} from '../src/render.js';

function fakeContext() {
  const fills = [];
  const strokes = [];
  const texts = [];
  let path = [];
  return {
    fills,
    strokes,
    texts,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    arcs: [],
    arc(...args) {
      this.arcs.push(args);
      path.push(['arc', ...args]);
    },
    fillRect(...args) {
      fills.push({ fillStyle: this.fillStyle, args });
    },
    strokeRect(...args) {
      strokes.push({ strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, args });
    },
    beginPath() {
      path = [];
    },
    moveTo(...args) {
      path.push(['moveTo', ...args]);
    },
    lineTo(...args) {
      path.push(['lineTo', ...args]);
    },
    closePath() {
      path.push(['closePath']);
    },
    fill() {
      fills.push({ fillStyle: this.fillStyle, path: structuredClone(path) });
    },
    discs: [],
    stroke() {
      strokes.push({
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        path: structuredClone(path),
      });
    },
    fillText(text) {
      texts.push(text);
    },
    measureText(text) {
      return { width: text.length * 8 };
    },
  };
}

test('draws the original look: black sky, green invaders and a grey ship', () => {
  const ctx = fakeContext();
  const fresh = snapshot(createReflexiveGame({ seed: 1983 }));

  drawPanel(ctx, fresh, '', 0);

  assert.deepEqual(ctx.fills[0], { fillStyle: gamePalette.bg, args: [0, 0, 480, 480] });
  // 24 x 24 cells of 20 px: invader blocks nearly fill theirs, as in the original.
  const invaders = ctx.fills.filter(({ fillStyle, args }) => (
    fillStyle === gamePalette.invader && args[2] === 18 && args[3] === 16
  ));
  assert.equal(invaders.length, 66);
  // The ship starts in column 11 on the bottom row.
  assert.ok(ctx.fills.some(({ fillStyle, args }) => (
    fillStyle === gamePalette.ship
      && args[0] === 11 * 20 + 2
      && args[1] === 23 * 20 + 4
      && args[2] === 16
      && args[3] === 14
  )));
  assert.deepEqual(ctx.texts, ['Score: 0, Level: 1']);
});

test('draws the same stars for both panels and drifts them over time', () => {
  const stars = (timeMs) => {
    const ctx = fakeContext();
    drawPanel(ctx, snapshot(createReflexiveGame({ seed: 1983 })), '', timeMs);
    return ctx.fills.filter(({ fillStyle }) => fillStyle === gamePalette.star);
  };

  assert.ok(stars(0).length > 20);
  assert.deepEqual(stars(0), stars(0));
  assert.notDeepEqual(stars(0), stars(1000));
});

test('draws a status overlay', () => {
  const ctx = fakeContext();
  const fresh = snapshot(createReflexiveGame({ seed: 1983 }));

  drawPanel(ctx, fresh, 'ready', 0);

  assert.ok(ctx.texts.includes('ready'));
});

test('the player\'s fire and the enemy\'s bombs are different colours', () => {
  assert.notEqual(gamePalette.shot, gamePalette.bomb);
});

function boardView(world) {
  return {
    ...strategicSnapshot(world),
    games: 4,
    names: { jev: 'Jev', frontier: 'Sonnet 5.5' },
    wins: { jev: 1, frontier: 2, draw: 0 },
  };
}

test('the spinner is a fixed-length arc that circles, not one that fills up', () => {
  const spinner = (timeMs, thinkingMs) => {
    const ctx = fakeContext();
    drawPanel(ctx, snapshot(createReflexiveGame({ seed: 1983 })), '', timeMs, { thinkingMs, sinceDecisionMs: null });
    return ctx.arcs[0];
  };
  const length = (arc) => arc[4] - arc[3];

  // Centred over the ship in column 11, lifted so the whole ring fits on the canvas.
  assert.deepEqual(spinner(0, 100).slice(0, 2), [11.5 * 20, 480 - 15 - 3]);
  // However long the wait has been, the arc is the same length.
  assert.ok(Math.abs(length(spinner(0, 100)) - length(spinner(0, 4000))) < 1e-9);
  // It moves round with the clock.
  assert.notEqual(spinner(0, 100)[3], spinner(250, 100)[3]);
});

test('draws no spinner when nothing is pending, and a ring when an answer lands', () => {
  const arcs = (activity) => {
    const ctx = fakeContext();
    drawPanel(ctx, snapshot(createReflexiveGame({ seed: 1983 })), '', 0, activity);
    return ctx.arcs.length;
  };

  assert.equal(arcs(null), 0);
  assert.equal(arcs({ thinkingMs: 0, sinceDecisionMs: 100 }), 1);
  assert.equal(arcs({ thinkingMs: 0, sinceDecisionMs: 1000 }), 0);
});

test('draws one Connect Four board: a blue frame, holes, and a disc per piece', () => {
  const ctx = fakeContext();
  let world = createStrategicGame({ seed: 1983 });
  world = playMove(world, 'd'); // jev, bottom row of column d
  world = playMove(world, 'e'); // frontier

  drawStrategic(ctx, boardView(world), '', 0);

  assert.ok(ctx.fills.some(({ fillStyle, args }) => fillStyle === boardPalette.frame && args?.[2] === 440));
  const discs = ctx.fills.filter(({ path }) => path?.[0]?.[0] === 'arc');
  assert.equal(discs.length, 42);
  const discAt = (col, row) => discs.find(({ path }) => (
    path[0][1] === 30 + (col + 0.5) * 60 && path[0][2] === 92 + (row + 0.5) * 60
  ));
  assert.equal(discAt(3, 5).fillStyle, boardPalette.jev);
  assert.equal(discAt(4, 5).fillStyle, boardPalette.frontier);
  assert.equal(discAt(0, 0).fillStyle, boardPalette.hole);
  assert.ok(ctx.texts.includes('Game 1 of 4'));
  assert.ok(ctx.texts.includes('Jev 1 - 2 Sonnet 5.5'));
});

test('rings the four that won and draws a line through them', () => {
  const ctx = fakeContext();
  let world = createStrategicGame({ seed: 1983 });
  for (const column of ['a', 'a', 'b', 'b', 'c', 'c', 'd']) {
    world = playMove(world, column);
  }

  drawStrategic(ctx, boardView(world), '', 0);

  const winStrokes = ctx.strokes.filter(({ strokeStyle, lineWidth, path }) => (
    strokeStyle === boardPalette.win && lineWidth === 4 && path
  ));
  // Four rings and one line.
  assert.equal(winStrokes.length, 5);
  assert.deepEqual(winStrokes.at(-1).path, [['moveTo', 60, 422], ['lineTo', 240, 422]]);
});

test('the two models\' tokens are different colours', () => {
  assert.notEqual(boardPalette.jev, boardPalette.frontier);
});
