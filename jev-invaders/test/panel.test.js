import assert from 'node:assert/strict';
import test from 'node:test';

import { createLedger } from '../src/caps.js';
import { config as baseConfig } from '../src/config.js';
import { createMockDriver } from '../src/drivers/mock.js';
import { createPanel } from '../src/panel.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function createManualDriver({ cost = 0.005 } = {}) {
  const pending = [];
  let calls = 0;
  return {
    label: 'Manual',
    isMock: true,
    get calls() {
      return calls;
    },
    worstCaseCostUSD() {
      return cost;
    },
    decide() {
      calls += 1;
      return new Promise((resolve) => pending.push(resolve));
    },
    resolve(result) {
      assert.ok(pending.length > 0);
      pending.shift()(result);
    },
  };
}

function success(move, costUSD = 0.005) {
  return {
    move,
    fire: false,
    costUSD,
    latencyMs: 50,
    tokens: { input: 0, output: 0 },
  };
}

function createHarness({ driver = createManualDriver(), config, ledger } = {}) {
  let time = 0;
  const now = () => time;
  const resolvedConfig = config ?? structuredClone(baseConfig);
  const resolvedLedger = ledger
    ?? createLedger(resolvedConfig.caps.maxSpendUSD.reflexive);
  const panel = createPanel({
    mode: 'reflexive',
    driver,
    seed: 1983,
    config: resolvedConfig,
    ledger: resolvedLedger,
    now,
  });
  return {
    panel,
    driver,
    config: resolvedConfig,
    ledger: resolvedLedger,
    advance(ms) {
      time += ms;
    },
  };
}

test('the cannon sits still while a decision is pending', () => {
  const { panel } = createHarness();
  panel.start();

  for (let tick = 0; tick < 20; tick += 1) {
    panel.tick();
  }

  const view = panel.view();
  assert.equal(view.snapshot.cannon.col, 7);
  assert.equal(view.snapshot.tick, 20);
  assert.equal(view.stats.decisions, 0);
});

test('an answer applies for one tick and starts the next request at once', async () => {
  const { panel, driver } = createHarness();
  panel.start();
  driver.resolve(success('right'));
  await flush();

  assert.equal(driver.calls, 2);
  panel.tick();
  assert.equal(panel.view().snapshot.cannon.col, 8);
  panel.tick();
  assert.equal(panel.view().snapshot.cannon.col, 8);
});

test('a stale answer is applied on the next tick', async () => {
  const { panel, driver } = createHarness();
  panel.start();
  for (let tick = 0; tick < 30; tick += 1) {
    panel.tick();
  }

  driver.resolve(success('right'));
  await flush();
  panel.tick();

  assert.equal(panel.view().snapshot.cannon.col, 8);
});

test('the answer queue is limited to two', async () => {
  const driver = createMockDriver({
    label: 'Instant',
    mode: 'reflexive',
    latencyMs: 0,
    costPerCallUSD: 0,
    seed: 42,
    sleep: async () => {},
  });
  let calls = 0;
  const decide = driver.decide;
  driver.decide = (...args) => {
    calls += 1;
    return decide(...args);
  };
  const { panel } = createHarness({ driver });
  panel.start();
  await flush();

  assert.equal(calls, 2);
  panel.tick();
  await flush();
  assert.equal(calls, 3);
});

test('the spend cap stops calls before the ledger can exceed it', async () => {
  const config = structuredClone(baseConfig);
  const ledger = createLedger(0.012);
  const driver = createMockDriver({
    label: 'Instant',
    mode: 'reflexive',
    latencyMs: 0,
    costPerCallUSD: 0.005,
    seed: 42,
    sleep: async () => {},
  });
  let calls = 0;
  const decide = driver.decide;
  driver.decide = (...args) => {
    calls += 1;
    return decide(...args);
  };
  const { panel } = createHarness({ config, driver, ledger });
  panel.start();
  for (let tick = 0; tick < 5; tick += 1) {
    await flush();
    panel.tick();
  }

  assert.equal(calls, 2);
  assert.ok(ledger.spentUSD <= 0.012);
  assert.equal(panel.view().statusText, 'stopped (cap reached) - spend');
});

test('the tick cap stops the panel', () => {
  const config = structuredClone(baseConfig);
  config.caps.maxTicks.reflexive = 10;
  const { panel } = createHarness({ config });
  panel.start();
  for (let tick = 0; tick < 10; tick += 1) {
    panel.tick();
  }

  assert.equal(panel.view().statusText, 'stopped (cap reached) - ticks');
});

test('checkCaps enforces the wall-clock cap', () => {
  const harness = createHarness();
  harness.panel.start();
  harness.advance(harness.config.caps.maxWallClockSec * 1000 + 1);
  harness.panel.checkCaps();

  assert.match(harness.panel.view().statusText, /- time$/);
});

test('a driver error is billed and freezes the world', async () => {
  const { panel, driver } = createHarness();
  panel.start();
  driver.resolve({
    error: 'boom',
    costUSD: 0.001,
    latencyMs: 50,
    tokens: { input: 0, output: 0 },
  });
  await flush();

  assert.equal(panel.view().statusText, 'error: boom');
  assert.equal(panel.view().stats.costUSD, 0.001);
  for (let tick = 0; tick < 5; tick += 1) {
    panel.tick();
  }
  assert.equal(panel.view().snapshot.tick, 0);
  assert.equal(driver.calls, 1);
});

test('a result arriving after a cap is billed but not applied', async () => {
  const config = structuredClone(baseConfig);
  config.caps.maxTicks.reflexive = 1;
  const { panel, driver } = createHarness({ config });
  panel.start();
  panel.tick();
  driver.resolve(success('right', 0.003));
  await flush();

  const view = panel.view();
  assert.equal(view.snapshot.cannon.col, 7);
  assert.equal(view.stats.costUSD, 0.003);
  assert.equal(view.statusText, 'stopped (cap reached) - ticks');
});

test('different mock decisions do not change the formation script', async () => {
  const createInstant = (seed) => createMockDriver({
    label: 'Instant',
    mode: 'reflexive',
    latencyMs: 0,
    costPerCallUSD: 0,
    seed,
    sleep: async () => {},
  });
  const first = createHarness({ driver: createInstant(1) }).panel;
  const second = createHarness({ driver: createInstant(2) }).panel;
  first.start();
  second.start();
  await flush();

  for (let tick = 0; tick < 300; tick += 1) {
    first.tick();
    second.tick();
    await flush();
  }

  assert.equal(first.view().snapshot.wave, 1);
  assert.equal(second.view().snapshot.wave, 1);
  assert.equal(first.view().snapshot.tick, 300);
  assert.equal(second.view().snapshot.tick, 300);
  assert.deepEqual(first.view().snapshot.formation, second.view().snapshot.formation);
});
