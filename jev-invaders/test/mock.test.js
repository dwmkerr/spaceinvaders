import assert from 'node:assert/strict';
import test from 'node:test';

import { createMockDriver } from '../src/drivers/mock.js';

function createDriver(overrides = {}) {
  let time = 0;
  const now = () => time;
  const sleep = async (ms) => {
    time += ms;
  };
  return createMockDriver({
    label: 'Test',
    mode: 'reflexive',
    latencyMs: 125,
    costPerCallUSD: 0.005,
    seed: 1983,
    sleep,
    now,
    ...overrides,
  });
}

test('mock answers are deterministic and satisfy the contract', async () => {
  const first = createDriver();
  const second = createDriver();

  for (let call = 0; call < 20; call += 1) {
    const left = await first.decide({});
    const right = await second.decide({});

    assert.deepEqual(left, right);
    assert.ok(['left', 'right', 'stay'].includes(left.move));
    assert.equal(typeof left.fire, 'boolean');
  }
});

test('mock identifies itself and reserves its configured cost', () => {
  const driver = createDriver();

  assert.match(driver.label, / \[mock\]$/);
  assert.equal(driver.isMock, true);
  assert.equal(driver.worstCaseCostUSD({}), 0.005);
});

test('mock measures configured latency with a fake clock', async () => {
  const result = await createDriver().decide({});

  assert.equal(result.latencyMs, 125);
  assert.equal(result.costUSD, 0.005);
});

test('mock reports a confidence inside its configured range', async () => {
  const driver = createDriver({ confidence: [0.7, 0.9] });

  for (let call = 0; call < 20; call += 1) {
    const { confidence } = await driver.decide({});
    assert.ok(confidence >= 0.7 && confidence <= 0.9);
  }
});
