import assert from 'node:assert/strict';
import test from 'node:test';

import { hudStrings, renderHud } from '../src/hud.js';

test('formats the panel view for the HUD', () => {
  const strings = hudStrings({
    snapshot: { score: 1240 },
    stats: { decisions: 7, thinkingMs: 33000, costUSD: 0.114 },
    inFlightMs: 1100,
    rollingAvgMs: 109,
    statusText: 'playing',
  });

  assert.deepEqual(strings, {
    score: '1,240',
    decisions: '7',
    thinking: '109 ms per decision',
    cost: '$0.11400',
    status: 'playing',
  });
});

test('renders strings with textContent', () => {
  const elements = Object.fromEntries(
    ['score', 'decisions', 'thinking', 'cost', 'status']
      .map((name) => [name, { textContent: '' }]),
  );
  const strings = {
    score: '10',
    decisions: '2',
    thinking: '1.0 s',
    cost: '$0.00001',
    status: 'playing',
  };

  renderHud(elements, strings);

  for (const [name, value] of Object.entries(strings)) {
    assert.equal(elements[name].textContent, value);
  }
});

test('shows the decision rate once a run has been going for a second', () => {
  const view = {
    snapshot: { score: 0 },
    stats: { decisions: 38, thinkingMs: 9000, costUSD: 0 },
    inFlightMs: 0,
    rollingAvgMs: 250,
    statusText: 'playing',
    elapsedMs: 10000,
  };

  assert.equal(hudStrings(view).decisions, '38 (3.8/s)');
  assert.equal(hudStrings({ ...view, elapsedMs: 400 }).decisions, '38');
});

test('shows think time per decision, in seconds once it is that long', () => {
  const view = {
    snapshot: { score: 0 },
    stats: { decisions: 3, thinkingMs: 7500, costUSD: 0 },
    inFlightMs: 900,
    rollingAvgMs: 2440,
    statusText: 'playing',
  };

  assert.equal(hudStrings(view).thinking, '2.4 s per decision');
  assert.equal(hudStrings({ ...view, rollingAvgMs: null }).thinking, '-');
});
