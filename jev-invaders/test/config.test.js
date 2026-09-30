import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { config, priceFor } from '../src/config.js';

test('config has pricing for both models', () => {
  assert.ok(config.pricing[config.models.jev.model]);
  assert.ok(config.pricing[config.models.frontier.model]);
});

test('priceFor returns known pricing and rejects unknown models', () => {
  assert.equal(priceFor(config.models.jev.model), config.pricing['jev-latest']);
  assert.throws(() => priceFor('nope'), /nope/);
});

test('config contains the reviewed caps and frontier model', () => {
  assert.equal(config.caps.maxSpendUSD.reflexive, 0.5);
  assert.equal(config.caps.maxSpendUSD.strategic, null);
  assert.equal(config.models.frontier.model, 'claude-opus-5-5');
});

test('config is deeply frozen', () => {
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.models));
  assert.ok(Object.isFrozen(config.strategic.opening));
  assert.ok(Object.isFrozen(config.strategic.opening[0]));
});

test('.gitignore excludes local configuration and scratch files', async () => {
  const contents = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');
  const lines = contents.split(/\r?\n/);
  assert.ok(lines.includes('.env'));
  assert.ok(lines.includes('scratch/'));
});
