import assert from 'node:assert/strict';
import test from 'node:test';

import { createReflexiveGame, snapshot } from '../src/game/reflexive.js';
import {
  createStrategicGame,
  snapshot as strategicSnapshot,
} from '../src/game/strategic.js';
import { drawPanel, drawStrategic } from '../src/render.js';

const palette = {
  bg: '#fff',
  ink: '#111',
  muted: '#777',
  faint: '#ddd',
  accent: '#080',
  mono: 'monospace',
};

function fakeContext() {
  const fills = [];
  const strokes = [];
  let path = [];
  return {
    fills,
    strokes,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
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
    stroke() {
      strokes.push({
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        path: structuredClone(path),
      });
    },
    fillText() {},
    measureText(text) {
      return { width: text.length * 8 };
    },
  };
}

test('draws fresh reflexive invaders and cannon at cell positions', () => {
  const ctx = fakeContext();
  const fresh = snapshot(createReflexiveGame({ seed: 1983 }));

  drawPanel(ctx, fresh, palette, '');

  const invaders = ctx.fills.filter(({ fillStyle, args }) => (
    fillStyle === palette.ink && args[2] === 20 && args[3] === 14
  ));
  assert.equal(invaders.length, 18);
  assert.ok(ctx.fills.some(({ fillStyle, args }) => (
    fillStyle === palette.accent
      && args[0] === 214
      && args[1] === 468
      && args[2] === 22
      && args[3] === 10
  )));
});

test('draws a status overlay', () => {
  const ctx = fakeContext();
  const fresh = snapshot(createReflexiveGame({ seed: 1983 }));

  assert.doesNotThrow(() => drawPanel(ctx, fresh, palette, 'ready'));
});

test('draws the strategic cannon and north turret at the centre', () => {
  const ctx = fakeContext();
  const fresh = strategicSnapshot(createStrategicGame({ seed: 1983 }));

  drawStrategic(ctx, fresh, palette, '');

  assert.ok(ctx.fills.some(({ fillStyle, args }) => (
    fillStyle === palette.accent
      && args?.[0] === 6 + 6 * 36 + 8
      && args?.[1] === 6 + 6 * 36 + 8
      && args?.[2] === 20
      && args?.[3] === 20
  )));
  assert.ok(ctx.fills.some(({ fillStyle, args }) => (
    fillStyle === palette.accent
      && args?.[0] === 6 + 6 * 36 + 15
      && args?.[1] === 6 + 6 * 36
      && args?.[2] === 6
      && args?.[3] === 10
  )));
});

test('draws a strategic last shot in the accent colour', () => {
  const ctx = fakeContext();
  const fresh = strategicSnapshot(createStrategicGame({ seed: 1983 }));
  fresh.lastShot = { lane: 'north', distance: 4 };

  drawStrategic(ctx, fresh, palette, '');

  assert.ok(ctx.strokes.some(({ strokeStyle, lineWidth, path }) => (
    strokeStyle === palette.accent && lineWidth === 2 && path
  )));
});
