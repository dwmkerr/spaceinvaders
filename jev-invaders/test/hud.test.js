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
    thinking: '34.1 s (109 ms)',
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
