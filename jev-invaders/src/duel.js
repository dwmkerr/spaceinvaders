import { capBreach, createLedger } from './caps.js';
import { config as defaultConfig } from './config.js';
import { strategicContract } from './contract.js';
import { encodeState } from './encoder.js';
import {
  PLAYERS,
  createStrategicGame,
  openingMove,
  playMove,
  snapshot,
} from './game/strategic.js';
import {
  createStats,
  recordBilledError,
  recordDecision,
  rollingAverageMs,
} from './stats.js';

const defaultNow = () => performance.now();

// Runs a short match between the two models on one shared board. It stands in
// for the two separate panels of the real-time mode, and hands the page one
// panel-shaped view per model so the rest of the page does not need to care.
export function createDuel({
  drivers,
  seed,
  config = defaultConfig,
  ledger = createLedger(config.caps.maxSpendUSD.strategic),
  now = defaultNow,
}) {
  const rules = config.strategic;
  let world = createStrategicGame({ seed, rules, game: 0 });
  let status = 'idle';
  let stopReason = null;
  let errorMessage = null;
  let startedAt = null;
  let stoppedAt = null;
  let pausedMs = 0;
  let endedAt = null;
  let nextGameAt = null;
  let inFlight = null;
  let inFlightSince = null;
  let reservationId = null;
  let disposed = false;
  const wins = { jev: 0, frontier: 0, draw: 0 };
  const stats = { jev: createStats(), frontier: createStats() };
  const events = { jev: [], frontier: [] };

  const elapsedMs = () => {
    if (startedAt === null) {
      return 0;
    }
    const until = status === 'running' ? now() : (endedAt ?? stoppedAt ?? now());
    return until - startedAt - pausedMs;
  };

  const recordEvent = (side, event) => {
    events[side].push({ atMs: elapsedMs(), ...event });
    if (events[side].length > config.timeline.maxEvents) {
      events[side].shift();
    }
  };

  const finish = (nextStatus) => {
    if (status === 'running') {
      endedAt = now();
    }
    status = nextStatus;
  };

  const checkCaps = () => {
    if (status !== 'running') {
      return null;
    }
    const reason = capBreach({
      ticks: stats.jev.decisions + stats.frontier.decisions,
      maxTicks: config.caps.maxTicks.strategic,
      elapsedMs: elapsedMs(),
      maxWallClockSec: config.caps.maxWallClockSec,
    });
    if (reason) {
      stopReason = reason;
      finish('capped');
    }
    return reason;
  };

  let nextMove;

  const afterMove = () => {
    if (world.status !== 'over') {
      nextMove();
      return;
    }
    wins[world.winner ?? 'draw'] += 1;
    if (world.game + 1 >= rules.games) {
      finish('over');
      return;
    }
    // Leave the finished board up for a moment so the winning line can be seen.
    nextGameAt = now() + rules.pauseBetweenGamesMs;
  };

  const receive = (side, result, id) => {
    inFlight = null;
    inFlightSince = null;
    reservationId = null;
    if (disposed) {
      return;
    }

    const costUSD = typeof result?.costUSD === 'number' ? result.costUSD : 0;
    const latencyMs = typeof result?.latencyMs === 'number' ? result.latencyMs : 0;
    ledger.settle(id, costUSD);

    if (result?.error) {
      stats[side] = recordBilledError(stats[side], { latencyMs, costUSD });
      recordEvent(side, { confidence: null, error: true, label: 'error' });
      errorMessage = `${drivers[side].label}: ${result.error}`;
      finish('error');
      return;
    }

    stats[side] = recordDecision(stats[side], { latencyMs, costUSD });
    // An answer that lands after Stop is billed but not played. The move is
    // asked for again if the match is resumed.
    if (status !== 'running') {
      return;
    }
    recordEvent(side, {
      confidence: Number.isFinite(result.confidence) ? result.confidence : null,
      error: false,
      label: `column ${result.move}`,
    });
    world = playMove(world, result.move);
    afterMove();
  };

  nextMove = () => {
    if (status !== 'running' || inFlight || world.status === 'over' || checkCaps()) {
      return;
    }

    const side = world.toMove;
    if (world.moves.length === 0) {
      const column = openingMove(world);
      recordEvent(side, { confidence: null, error: false, label: `column ${column} (opening)` });
      world = playMove(world, column);
      afterMove();
      return;
    }

    const current = snapshot(world);
    const state = encodeState({ ...current, side }, rules);
    // Only the columns that can still take a piece are on offer.
    const contract = strategicContract(current.openColumns);
    const driver = drivers[side];
    const id = ledger.reserve(driver.worstCaseCostUSD(state, contract));
    reservationId = id;
    inFlight = side;
    inFlightSince = now();

    let decision;
    try {
      decision = Promise.resolve(driver.decide(state, contract));
    } catch (error) {
      decision = Promise.reject(error);
    }
    decision.then(
      (result) => receive(side, result, id),
      (error) => receive(side, {
        error: error instanceof Error ? error.message : String(error),
        costUSD: 0,
        latencyMs: now() - inFlightSince,
      }, id),
    );
  };

  const resultText = (side) => {
    const mine = wins[side];
    const theirs = wins[side === 'jev' ? 'frontier' : 'jev'];
    if (mine === theirs) {
      return `match drawn ${mine}-${theirs}`;
    }
    return `${mine > theirs ? 'won' : 'lost'} the match ${mine}-${theirs}`;
  };

  const statusText = (side) => {
    if (status === 'idle') {
      return 'ready';
    }
    if (status === 'stopped') {
      return 'stopped';
    }
    if (status === 'over') {
      return resultText(side);
    }
    if (status === 'capped') {
      return `stopped (cap reached) - ${stopReason}`;
    }
    if (status === 'error') {
      return `error: ${errorMessage}`;
    }
    if (world.status === 'over') {
      if (world.winner === null) {
        return 'game drawn';
      }
      const why = world.reason === 'illegal move' ? ' (illegal move)' : '';
      return world.winner === side ? `won this game${why}` : `lost this game${why}`;
    }
    return world.toMove === side ? 'thinking' : 'waiting';
  };

  const view = (side) => ({
    label: drivers[side].label,
    isMock: drivers[side].isMock,
    mode: 'strategic',
    snapshot: {
      ...snapshot(world),
      side,
      games: rules.games,
      names: { jev: config.models.jev.label, frontier: config.models.frontier.label },
      wins: { ...wins },
      // The HUD's score row shows games won.
      score: wins[side],
    },
    stats: structuredClone(stats[side]),
    status,
    statusText: statusText(side),
    inFlightMs: inFlight === side ? now() - inFlightSince : 0,
    rollingAvgMs: rollingAverageMs(stats[side], config.hud.rollingWindow),
    elapsedMs: elapsedMs(),
    events: events[side].slice(),
  });

  const controls = {
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
      nextMove();
    },

    stop() {
      if (status !== 'running') {
        return;
      }
      stoppedAt = now();
      status = 'stopped';
    },

    // Called on the page's clock: starts the next game once the pause is over.
    tick() {
      if (status !== 'running') {
        return;
      }
      if (nextGameAt !== null && now() >= nextGameAt) {
        nextGameAt = null;
        world = createStrategicGame({ seed, rules, game: world.game + 1 });
      }
      if (nextGameAt === null) {
        nextMove();
      }
    },

    checkCaps,

    dispose() {
      disposed = true;
      if (reservationId !== null) {
        ledger.release(reservationId);
        reservationId = null;
      }
    },

    status: () => status,
  };

  return {
    ...controls,
    view,
    // One panel-shaped object per model, in the page's left-to-right order.
    // Both share the match, so calling a control on either drives it.
    panels: () => PLAYERS.map((side) => ({ ...controls, view: () => view(side) })),
  };
}
