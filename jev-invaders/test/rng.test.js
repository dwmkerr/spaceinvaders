import assert from 'node:assert/strict';
import test from 'node:test';

import { hash32, rand } from '../src/rng.js';

test('rand is deterministic and salts produce different values', () => {
  assert.equal(rand(1983, 12, 'bomb'), rand(1983, 12, 'bomb'));
  assert.notEqual(rand(1983, 12, 'bomb'), rand(1983, 12, 'slot'));
});

test('rand produces values in [0, 1) with a balanced mean', () => {
  const draws = Array.from({ length: 10000 }, (_, index) => rand(1983, index, 'draw'));
  assert.ok(draws.every((value) => value >= 0 && value < 1));
  const mean = draws.reduce((sum, value) => sum + value, 0) / draws.length;
  assert.ok(mean > 0.45 && mean < 0.55, `mean was ${mean}`);
});

test('hash32 returns an unsigned 32-bit integer', () => {
  for (const parts of [[], [1983], [1983, 12, 'bomb'], ['\uffff'.repeat(100)]]) {
    const value = hash32(...parts);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 0 && value <= 0xffffffff);
  }
});
