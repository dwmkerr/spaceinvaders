import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import {
  anthropicCostUSD,
  byteLength,
  formatThinking,
  formatUSD,
  jevCostUSD,
  worstCaseCostUSD,
} from '../src/cost.js';

const closeTo = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-12);
};

test('calculates Jev cost', () => {
  const price = config.pricing['jev-latest'];
  closeTo(jevCostUSD({ input_tokens: 392, output_tokens: 65 }, price), 0.000016464);
});

test('calculates Anthropic cost including cache tokens', () => {
  const price = config.pricing['claude-opus-5-5'];
  closeTo(anthropicCostUSD({ input_tokens: 1000, output_tokens: 500 }, price), 0.014);
  closeTo(anthropicCostUSD({
    input_tokens: 1000,
    output_tokens: 500,
    cache_creation_input_tokens: 100,
    cache_read_input_tokens: 1000,
  }, price), 0.0147);
});

test('rejects missing usage', () => {
  const price = config.pricing['jev-latest'];
  assert.throws(
    () => jevCostUSD({ input_tokens: 392 }, price),
    new Error('usage missing'),
  );
});

test('calculates worst-case cost and UTF-8 byte length', () => {
  const price = config.pricing['claude-opus-5-5'];
  closeTo(worstCaseCostUSD({
    price,
    inputBytes: 1000,
    overheadTokens: 2000,
    maxOutputTokens: 2048,
  }), 0.05296);
  assert.equal(byteLength('é'), 2);
});

test('formats costs and thinking time', () => {
  assert.equal(formatUSD(0.000016464), '$0.00002');
  assert.equal(formatUSD(0.114), '$0.11400');
  assert.equal(formatThinking(34100, 109), '34.1 s (109 ms)');
  assert.equal(formatThinking(92600, 2300), '92.6 s (2.3 s)');
  assert.equal(formatThinking(0, null), '0.0 s');
});
