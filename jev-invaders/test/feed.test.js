import assert from 'node:assert/strict';
import test from 'node:test';

import { describeAction, feedLines } from '../src/feed.js';

test('describes a reflexive decision in a couple of words', () => {
  assert.equal(describeAction({ move: 'left', fire: true }), 'move left, fire');
  assert.equal(describeAction({ move: 'stay', fire: true }), 'fire');
  assert.equal(describeAction({ move: 'right', fire: false }), 'move right');
  assert.equal(describeAction({ move: 'stay', fire: false }), 'hold');
});

test('the feed shows the newest decisions, oldest first, and how far back each is', () => {
  const events = [1, 2, 3, 4, 5, 6].map((n) => ({
    atMs: n * 100,
    confidence: n === 6 ? null : n / 10,
    error: false,
    label: `decision ${n}`,
  }));

  assert.deepEqual(feedLines(events, 4), [
    { text: 'decision 3', confidence: '0.30', back: 3, error: false },
    { text: 'decision 4', confidence: '0.40', back: 2, error: false },
    { text: 'decision 5', confidence: '0.50', back: 1, error: false },
    { text: 'decision 6', confidence: '', back: 0, error: false },
  ]);
  assert.deepEqual(feedLines([], 4), []);
});
