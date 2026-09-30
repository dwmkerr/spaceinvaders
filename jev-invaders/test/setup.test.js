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
      mockLatency: { jev: 100, frontier: 2500 },
    },
  );
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

test('live drivers are not available yet', () => {
  assert.throws(
    () => createDriver('left', { mock: false }),
    /live driver not built yet/,
  );
});
