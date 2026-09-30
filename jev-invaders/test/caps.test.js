import assert from 'node:assert/strict';
import test from 'node:test';

import { capBreach, createLedger } from '../src/caps.js';

test('ledger reserves, settles and releases budget', () => {
  const ledger = createLedger(0.10);
  assert.equal(ledger.canAfford(0.06), true);

  const first = ledger.reserve(0.06);
  assert.equal(ledger.canAfford(0.05), false);
  ledger.settle(first, 0.01);
  assert.equal(ledger.spentUSD, 0.01);
  assert.equal(ledger.reservedUSD, 0);
  assert.equal(ledger.canAfford(0.09), true);

  const second = ledger.reserve(0.09);
  assert.equal(ledger.canAfford(0.00001), false);
  ledger.release(second);
  assert.equal(ledger.reservedUSD, 0);
});

test('settling an unknown reservation throws', () => {
  const ledger = createLedger(0.10);
  assert.throws(() => ledger.settle(99, 0.01), /unknown reservation/);
});

test('uncapped ledger always affords calls and tracks spend', () => {
  const ledger = createLedger(null);
  assert.equal(ledger.canAfford(1e9), true);
  const id = ledger.reserve(1e9);
  ledger.settle(id, 0.25);
  assert.equal(ledger.spentUSD, 0.25);
  assert.equal(ledger.reservedUSD, 0);
});

test('cap breach checks ticks before elapsed time', () => {
  assert.equal(capBreach({
    ticks: 10,
    maxTicks: 10,
    elapsedMs: 10000,
    maxWallClockSec: 10,
  }), 'ticks');
  assert.equal(capBreach({
    ticks: 9,
    maxTicks: 10,
    elapsedMs: 10000,
    maxWallClockSec: 10,
  }), 'time');
  assert.equal(capBreach({
    ticks: 9,
    maxTicks: 10,
    elapsedMs: 9999,
    maxWallClockSec: 10,
  }), null);
});
