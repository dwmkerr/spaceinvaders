import assert from 'node:assert/strict';
import test from 'node:test';

import { createReflexiveGame, snapshot } from '../src/game/reflexive.js';
import { drawPanel } from '../src/render.js';

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
  return {
    fills,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect(...args) {
      fills.push({ fillStyle: this.fillStyle, args });
    },
    strokeRect() {},
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
