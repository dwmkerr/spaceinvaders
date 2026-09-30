import assert from 'node:assert/strict';
import test from 'node:test';

import { averageConfidence, timelineBars } from '../src/timeline.js';

const size = { windowMs: 30000, width: 480, height: 40 };

test('places each decision by time and sizes it by confidence', () => {
  const bars = timelineBars([
    { atMs: 0, confidence: 1, error: false },
    { atMs: 15000, confidence: 0.5, error: false },
  ], 20000, size);

  assert.deepEqual(bars, [
    { x: 0, height: 40, kind: 'decision' },
    { x: 240, height: 20, kind: 'decision' },
  ]);
});

test('scrolls so the window always ends at the present', () => {
  const bars = timelineBars([
    { atMs: 5000, confidence: 1, error: false },
    { atMs: 45000, confidence: 1, error: false },
  ], 60000, size);

  // The first decision is more than 30 s old, so it has scrolled off.
  assert.deepEqual(bars, [{ x: 240, height: 40, kind: 'decision' }]);
});

test('marks errors and decisions with no confidence differently', () => {
  const bars = timelineBars([
    { atMs: 1000, confidence: null, error: false },
    { atMs: 2000, confidence: null, error: true },
    { atMs: 3000, confidence: 0, error: false },
  ], 5000, size);

  assert.deepEqual(bars.map((bar) => bar.kind), ['unknown', 'error', 'decision']);
  assert.equal(bars[0].height, 4);
  assert.equal(bars[1].height, 40);
  // A confidence of zero still leaves a visible mark for the decision.
  assert.equal(bars[2].height, 1);
});

test('averages only the decisions that reported a confidence', () => {
  assert.equal(averageConfidence([]), null);
  assert.equal(averageConfidence([
    { confidence: 0.8 },
    { confidence: null },
    { confidence: 0.6 },
  ]), 0.7);
});
