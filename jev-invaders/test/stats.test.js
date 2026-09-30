import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStats,
  recordBilledError,
  recordDecision,
  rollingAverageMs,
} from '../src/stats.js';

test('records decisions and calculates a rolling average', () => {
  let stats = createStats();
  stats = recordDecision(stats, { latencyMs: 100, costUSD: 0.01 });
  stats = recordDecision(stats, { latencyMs: 200, costUSD: 0.02 });
  stats = recordDecision(stats, { latencyMs: 300, costUSD: 0.03 });

  assert.equal(stats.decisions, 3);
  assert.equal(stats.thinkingMs, 600);
  assert.ok(Math.abs(stats.costUSD - 0.06) < 1e-12);
  assert.equal(rollingAverageMs(stats, 2), 250);
});

test('billed errors do not count as decisions', () => {
  const initial = createStats();
  const stats = recordBilledError(initial, { latencyMs: 150, costUSD: 0.005 });
  assert.equal(stats.decisions, 0);
  assert.equal(stats.thinkingMs, 150);
  assert.equal(stats.costUSD, 0.005);
  assert.equal(rollingAverageMs(stats, 2), null);
});
