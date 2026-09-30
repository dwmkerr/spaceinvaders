import assert from 'node:assert/strict';
import test from 'node:test';

import { createDriver, parseParams } from '../src/setup.js';

test('parses mock run parameters and latency defaults', () => {
  assert.deepEqual(
    parseParams('?mock=1&seed=42&autostart=1&jevLatency=100'),
    {
      mock: true,
      mode: 'reflexive',
      seed: 42,
      autostart: true,
      speed: 1.5,
      mockLatency: { jev: 100, frontier: 2500 },
    },
  );
});

test('game speed comes from the URL and is kept within the slider\'s range', () => {
  assert.equal(parseParams('?speed=2').speed, 2);
  assert.equal(parseParams('?speed=99').speed, 4);
  assert.equal(parseParams('?speed=0').speed, 0.5);
  assert.equal(parseParams('?speed=fast').speed, 1.5);
  assert.equal(parseParams('').speed, 1.5);
});

test('unknown modes fall back to reflexive and mock can be disabled', () => {
  assert.equal(parseParams('?mode=bogus').mode, 'reflexive');
  assert.equal(parseParams('?mock=0').mock, false);
});

test('creates the left mock driver with the configured label', () => {
  const driver = createDriver('left', {
    mock: true,
    mode: 'reflexive',
    seed: 42,
    mockLatency: { jev: 100, frontier: 200 },
  });

  assert.equal(driver.label, 'Jev [mock]');
  assert.equal(driver.isMock, true);
});

test('creates the left live Jev driver', () => {
  const driver = createDriver('left', {
    mock: false,
    mode: 'reflexive',
    runId: 'setup-test',
  });

  assert.equal(driver.label, 'Jev (jev-latest)');
  assert.equal(driver.isMock, false);
});

test('creates the right live Frontier driver', () => {
  const driver = createDriver('right', {
    mock: false,
    mode: 'reflexive',
    runId: 'setup-test',
  });

  assert.equal(driver.label, 'Sonnet 5.5 (claude-sonnet-5-5)');
  assert.equal(driver.isMock, false);
});
