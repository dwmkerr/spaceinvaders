import { capBreach, createLedger } from './caps.js';
import { config as defaultConfig } from './config.js';
import { encodeState } from './encoder.js';
import { describeAction } from './feed.js';
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
  let world = createGame(mode, { seed, rules: config[mode] });
  let stats = createStats();
  let status = 'idle';
  let stopReason = null;
  let errorMessage = null;
  let startedAt = null;
  let stoppedAt = null;
  let pausedMs = 0;
  let endedAt = null;
  let inFlight = false;
  let inFlightSince = null;
  let reservationId = null;
  let disposed = false;
  const queue = [];
  const events = [];

  const progress = () => world.tick ?? world.turn;

  // Time the run has actually been playing, so a Stop does not eat into the
  // wall-clock cap or leave a gap in the timeline.
  const elapsedMs = () => {
    if (startedAt === null) {
      return 0;
    }
    const until = status === 'running' ? now() : (endedAt ?? stoppedAt ?? now());
    return until - startedAt - pausedMs;
  };

  const recordEvent = (event) => {
    events.push({ atMs: elapsedMs(), ...event });
    if (events.length > config.timeline.maxEvents) {
      events.shift();
    }
  };

  const statusText = () => {
    if (status === 'idle') {
      return 'ready';
    }
    if (status === 'running') {
      return 'playing';
    }
    if (status === 'stopped') {
      return 'stopped';
    }
    if (status === 'over') {
      // Say how it ended: the two ways to lose look alike on a frozen screen.
      return world.lives <= 0 ? 'game over - hit by a bomb' : 'game over - invaded';
    }
    if (status === 'capped') {
      return `stopped (cap reached) - ${stopReason}`;
    }
    return `error: ${errorMessage}`;
  };

  const stopForCap = (reason) => {
    if (status === 'running') {
      endedAt = now();
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
      elapsedMs: elapsedMs(),
      maxWallClockSec: config.caps.maxWallClockSec,
    });
    if (reason) {
      stopForCap(reason);
    }
    return reason;
  };

  const checkGameOver = () => {
    if (world.status !== 'playing') {
      endedAt = now();
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
        recordEvent({ confidence: null, error: true, label: 'error' });
        if (status === 'running') {
          endedAt = now();
        }
        status = 'error';
        errorMessage = result.error;
      }
      return;
    }

    const action = {
      move: result.move,
      fire: result.fire,
      bomb: result.bomb,
    };
    stats = recordDecision(stats, { latencyMs, costUSD });
    recordEvent({
      confidence: Number.isFinite(result.confidence) ? result.confidence : null,
      error: false,
      label: describeAction(action),
    });
    if (status !== 'running') {
      return;
    }

    queue.push(action);
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
      if (disposed || (status !== 'idle' && status !== 'stopped')) {
        return;
      }
      if (status === 'stopped') {
        pausedMs += now() - stoppedAt;
        stoppedAt = null;
      } else {
        startedAt = now();
      }
      status = 'running';
      requestNext();
    },

    // An answer already in flight still lands and is billed, but it is not
    // applied unless the run has been started again by then.
    stop() {
      if (status !== 'running') {
        return;
      }
      stoppedAt = now();
      status = 'stopped';
    },

    tick() {
      if (status !== 'running') {
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

    status: () => status,

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
        elapsedMs: elapsedMs(),
        events: events.slice(),
      };
    },
  };
}
