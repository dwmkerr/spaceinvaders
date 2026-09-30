import assert from 'node:assert/strict';
import test from 'node:test';

import { createLedger } from '../src/caps.js';
import { config as baseConfig } from '../src/config.js';
import { createDuel } from '../src/duel.js';
import { createStrategicGame, openingMove } from '../src/game/strategic.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

// A driver that plays from a script and answers at once.
function scripted(label, columns, { cost = 0.001, latencyMs = 100 } = {}) {
  const queue = [...columns];
  const states = [];
  const offered = [];
  return {
    label,
    isMock: true,
    states,
    offered,
    worstCaseCostUSD: () => cost,
    decide(state, contract) {
      states.push(state);
      offered.push(Object.keys(contract.questions.move.criteria));
      const move = queue.shift();
      return Promise.resolve(move === undefined
        ? { error: 'script ran out', costUSD: 0, latencyMs }
        : { move, fire: false, bomb: false, confidence: 0.8, costUSD: cost, latencyMs });
    },
  };
}

function createHarness({ jev, frontier, games = 1 }) {
  let time = 0;
  const config = structuredClone(baseConfig);
  config.strategic.games = games;
  const duel = createDuel({
    drivers: { jev, frontier },
    seed: 1983,
    config,
    ledger: createLedger(null),
    now: () => time,
  });
  return { duel, config, advance: (ms) => { time += ms; } };
}

const opening = (game) => openingMove(createStrategicGame({ seed: 1983, game }));

test('the code plays the opening piece and the models alternate from there', async () => {
  const jev = scripted('Jev', []);
  const frontier = scripted('Sonnet', ['a']);
  const { duel } = createHarness({ jev, frontier });
  duel.start();
  await flush();

  const view = duel.view('jev');
  assert.equal(view.events[0].label, `column ${opening(0)} (opening)`);
  assert.equal(view.stats.decisions, 0);
  assert.equal(duel.view('frontier').events[0].label, 'column a');
  // Jev opened by code, Sonnet answered, and now Jev's script is empty.
  assert.equal(view.status, 'error');
  assert.match(view.statusText, /^error: Jev: script ran out/);
});

test('each model is asked about the board from its own side', async () => {
  const jev = scripted('Jev', ['b']);
  const frontier = scripted('Sonnet', ['a', 'a']);
  const { duel } = createHarness({ jev, frontier });
  duel.start();
  await flush();

  assert.match(frontier.states[0].board, /X|O/);
  // Sonnet's first view shows only the opening piece, which belongs to Jev.
  assert.equal((frontier.states[0].board.match(/O/g) ?? []).length, 1);
  assert.equal((frontier.states[0].board.match(/X/g) ?? []).length, 0);
});

test('a win is scored, reported per side, and ends a one-game match', async () => {
  // Jev opens by code. Sonnet stacks column a and gets four in a column.
  const first = opening(0);
  const away = first === 'g' ? 'f' : 'g';
  const jev = scripted('Jev', [away, away, away]);
  const frontier = scripted('Sonnet', ['a', 'a', 'a', 'a']);
  const { duel } = createHarness({ jev, frontier });
  duel.start();
  await flush();

  const left = duel.view('jev');
  const right = duel.view('frontier');
  assert.equal(left.status, 'over');
  assert.equal(right.snapshot.winner, 'frontier');
  assert.deepEqual(right.snapshot.wins, { jev: 0, frontier: 1, draw: 0 });
  assert.equal(right.snapshot.score, 1);
  assert.equal(left.statusText, 'lost the match 0-1');
  assert.equal(right.statusText, 'won the match 1-0');
  assert.equal(right.stats.decisions, 4);
  assert.equal(left.stats.decisions, 3);
  assert.ok(Math.abs(right.stats.costUSD - 0.004) < 1e-12);
});

test('the next game starts after a pause, with the other model going first', async () => {
  const first = opening(0);
  const away = first === 'g' ? 'f' : 'g';
  const jev = scripted('Jev', [away, away, away]);
  const frontier = scripted('Sonnet', ['a', 'a', 'a', 'a']);
  const { duel, config, advance } = createHarness({ jev, frontier, games: 2 });
  duel.start();
  await flush();

  assert.equal(duel.status(), 'running');
  assert.equal(duel.view('jev').statusText, 'lost this game');
  assert.equal(duel.view('frontier').statusText, 'won this game');

  // Nothing happens until the pause is over.
  duel.tick();
  assert.equal(duel.view('jev').snapshot.game, 0);
  advance(config.strategic.pauseBetweenGamesMs);
  duel.tick();
  await flush();

  const view = duel.view('frontier');
  assert.equal(view.snapshot.game, 1);
  assert.equal(view.events.at(-1).label, `column ${opening(1)} (opening)`);
  assert.deepEqual(view.snapshot.wins, { jev: 0, frontier: 1, draw: 0 });
});

test('an illegal pick loses the game and says why', async () => {
  const first = opening(0);
  const away = first === 'g' ? 'f' : 'g';
  // Both fill the opening column, Jev plays elsewhere, then Sonnet picks the full column.
  const jev = scripted('Jev', [first, first, away]);
  const frontier = scripted('Sonnet', [first, first, first, first]);
  const { duel } = createHarness({ jev, frontier, games: 2 });
  duel.start();
  await flush();

  assert.equal(duel.view('frontier').statusText, 'lost this game (illegal move)');
  assert.equal(duel.view('jev').statusText, 'won this game (illegal move)');
});

test('stop holds the match and start resumes it', async () => {
  const pending = [];
  const slow = {
    label: 'Sonnet',
    isMock: true,
    worstCaseCostUSD: () => 0,
    decide: () => new Promise((resolve) => pending.push(resolve)),
  };
  const { duel } = createHarness({ jev: scripted('Jev', ['b', 'b']), frontier: slow });
  duel.start();
  await flush();
  assert.equal(duel.view('frontier').statusText, 'thinking');
  assert.equal(duel.view('jev').statusText, 'waiting');

  duel.stop();
  pending.shift()({ move: 'a', confidence: 0.5, costUSD: 0.002, latencyMs: 900 });
  await flush();
  // The answer was billed but the move was not played.
  assert.equal(duel.view('frontier').statusText, 'stopped');
  assert.equal(duel.view('frontier').stats.costUSD, 0.002);
  assert.equal(duel.view('frontier').snapshot.moveCount, 1);

  duel.start();
  await flush();
  assert.equal(pending.length, 1);
  assert.equal(duel.view('frontier').statusText, 'thinking');
});

test('both page panels are views of the one match', async () => {
  const { duel } = createHarness({ jev: scripted('Jev', []), frontier: scripted('Sonnet', []) });
  const [left, right] = duel.panels();

  assert.equal(left.view().snapshot.side, 'jev');
  assert.equal(right.view().snapshot.side, 'frontier');
  left.start();
  right.start();
  await flush();
  assert.deepEqual(left.view().snapshot.board, right.view().snapshot.board);
});

test('a model is only offered the columns that can still take a piece', async () => {
  const first = opening(0);
  const away = first === 'g' ? 'f' : 'g';
  // Jev opens in `first` by code, then both stack it until it is full.
  const jev = scripted('Jev', [first, first, away]);
  const frontier = scripted('Sonnet', [first, first, first, away]);
  const { duel } = createHarness({ jev, frontier });
  duel.start();
  await flush();

  assert.equal(frontier.offered[0].length, 7);
  // By Sonnet's fourth move the opening column holds six pieces and is gone from the options.
  assert.equal(frontier.offered[3].includes(first), false);
  assert.equal(frontier.offered[3].length, 6);
});
