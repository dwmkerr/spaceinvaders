import { capBreach, createLedger } from './caps.js';
import { config as defaultConfig } from './config.js';
import { encodeState } from './encoder.js';
import { createGame, gameApi } from './game/index.js';
import {
  createStats,
  recordBilledError,
  recordDecision,
  rollingAverageMs,
} from './stats.js';

const defaultNow = () => performance.now();

export function createPanel({
  mode,
  driver,
  seed,
  config = defaultConfig,
  ledger = createLedger(config.caps.maxSpendUSD[mode]),
  now = defaultNow,
}) {
  const api = gameApi(mode);
  let world = createGame(mode, { seed });
  let stats = createStats();
  let status = 'idle';
  let stopReason = null;
  let errorMessage = null;
  let startedAt = null;
  let inFlight = false;
  let inFlightSince = null;
  let reservationId = null;
  let disposed = false;
  const queue = [];

  const progress = () => world.tick ?? world.turn;

  const statusText = () => {
    if (status === 'idle') {
      return 'ready';
    }
    if (status === 'running') {
      return 'playing';
    }
    if (status === 'over') {
      if (mode === 'strategic' && world.status === 'won') {
        return 'siege survived';
      }
      return 'game over';
    }
    if (status === 'capped') {
      return `stopped (cap reached) - ${stopReason}`;
    }
    return `error: ${errorMessage}`;
  };

  const stopForCap = (reason) => {
    if (status === 'running') {
      status = 'capped';
      stopReason = reason;
    }
  };

  const checkCaps = () => {
    if (status !== 'running') {
      return null;
    }
    const reason = capBreach({
      ticks: progress(),
      maxTicks: config.caps.maxTicks[mode],
      elapsedMs: now() - startedAt,
      maxWallClockSec: config.caps.maxWallClockSec,
    });
    if (reason) {
      stopForCap(reason);
    }
    return reason;
  };

  const checkGameOver = () => {
    if (world.status !== 'playing') {
      status = 'over';
      return true;
    }
    return false;
  };

  let requestNext;

  const receiveResult = (result, id) => {
    inFlight = false;
    inFlightSince = null;
    reservationId = null;
    if (disposed) {
      return;
    }

    const costUSD = typeof result?.costUSD === 'number' ? result.costUSD : 0;
    const latencyMs = typeof result?.latencyMs === 'number' ? result.latencyMs : 0;
    ledger.settle(id, costUSD);

    if (result?.error) {
      stats = recordBilledError(stats, { latencyMs, costUSD });
      if (result.capped) {
        stopForCap('spend');
      } else {
        status = 'error';
        errorMessage = result.error;
      }
      return;
    }

    stats = recordDecision(stats, { latencyMs, costUSD });
    if (status !== 'running') {
      return;
    }

    const action = {
      move: result.move,
      fire: result.fire,
      bomb: result.bomb,
    };
    if (mode === 'reflexive') {
      queue.push(action);
      requestNext();
      return;
    }

    world = api.step(api.applyAction(world, action));
    if (!checkGameOver()) {
      checkCaps();
    }
    requestNext();
  };

  requestNext = () => {
    if (status !== 'running' || inFlight || queue.length >= 2) {
      return;
    }
    if (checkCaps()) {
      return;
    }

    const state = encodeState(api.snapshot(world), config[mode]);
    const reservation = driver.worstCaseCostUSD(state);
    if (!ledger.canAfford(reservation)) {
      stopForCap('spend');
      return;
    }

    const id = ledger.reserve(reservation);
    reservationId = id;
    inFlight = true;
    inFlightSince = now();

    let decision;
    try {
      decision = driver.decide(state);
    } catch (error) {
      decision = Promise.resolve({
        error: error instanceof Error ? error.message : String(error),
        costUSD: 0,
        latencyMs: now() - inFlightSince,
        tokens: { input: 0, output: 0 },
      });
    }
    Promise.resolve(decision).then(
      (result) => receiveResult(result, id),
      (error) => receiveResult({
        error: error instanceof Error ? error.message : String(error),
        costUSD: 0,
        latencyMs: now() - inFlightSince,
        tokens: { input: 0, output: 0 },
      }, id),
    );
  };

  return {
    start() {
      if (status !== 'idle' || disposed) {
        return;
      }
      status = 'running';
      startedAt = now();
      requestNext();
    },

    tick() {
      if (status !== 'running' || mode !== 'reflexive') {
        return;
      }
      if (queue.length > 0) {
        world = api.applyAction(world, queue.shift());
      }
      world = api.step(world);
      if (!checkGameOver()) {
        checkCaps();
      }
      requestNext();
    },

    checkCaps,

    dispose() {
      disposed = true;
      queue.length = 0;
      if (reservationId !== null) {
        ledger.release(reservationId);
        reservationId = null;
      }
    },

    view() {
      return {
        label: driver.label,
        isMock: driver.isMock,
        mode,
        snapshot: api.snapshot(world),
        stats: structuredClone(stats),
        status,
        statusText: statusText(),
        inFlightMs: inFlight ? now() - inFlightSince : 0,
        rollingAvgMs: rollingAverageMs(stats, config.hud.rollingWindow),
      };
    },
  };
}
