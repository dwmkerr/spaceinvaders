import { createLedger } from './caps.js';
import { config } from './config.js';
import { getContract } from './contract.js';
import { buildFrontierRequest } from './drivers/frontier.js';
import { createDuel } from './duel.js';
import { encodeState } from './encoder.js';
import { createGame, gameApi } from './game/index.js';
import { createStrategicGame, snapshot as strategicSnapshot } from './game/strategic.js';
import { hudStrings, renderHud } from './hud.js';
import { createPanel } from './panel.js';
import { boardPalette, drawPanel } from './render.js';
import { controlState } from './run-control.js';
import { createDriver, parseParams } from './setup.js';
import { feedLines as recentLines } from './feed.js';
import { drawTimeline } from './timeline.js';

const params = parseParams(window.location.search);
const rootStyle = getComputedStyle(document.documentElement);
const cssValue = (name, fallback) => rootStyle.getPropertyValue(`--${name}`).trim() || fallback;
// The games use the original Space Invaders colours. This palette is only for
// the timeline strips, which belong to the page.
const pagePalette = {
  bg: cssValue('bg', '#faf9f6'),
  muted: cssValue('muted', '#6e7681'),
  faint: cssValue('faint', '#d8d5cd'),
  accent: cssValue('accent', '#1a7f37'),
  error: cssValue('error', '#cf222e'),
  mono: cssValue('mono', 'ui-monospace, monospace'),
};

const sides = ['left', 'right'];
const elements = Object.fromEntries(sides.map((side) => [side, {
  title: document.querySelector(`#${side}-title`),
  canvas: document.querySelector(`#${side}-canvas`),
  game: document.querySelector(`#${side}-canvas`).getContext('2d'),
  timeline: document.querySelector(`#${side}-timeline`).getContext('2d'),
  feed: document.querySelector(`#${side}-feed`),
  feedKey: '',
  panel: document.querySelector(`#${side}-panel`),
  spinner: document.querySelector(`#${side}-spinner`),
  scoreLabel: document.querySelector(`#${side}-score-label`),
  hud: {
    score: document.querySelector(`#${side}-score`),
    decisions: document.querySelector(`#${side}-decisions`),
    thinking: document.querySelector(`#${side}-thinking`),
    cost: document.querySelector(`#${side}-cost`),
    status: document.querySelector(`#${side}-status`),
  },
}]));
const boardCanvas = document.querySelector('#board-canvas');
const board = boardCanvas.getContext('2d');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const resetButton = document.querySelector('#reset');
const speedInput = document.querySelector('#speed');
const speedValue = document.querySelector('#speed-value');
const tabs = [...document.querySelectorAll('#mode .tab')];

// Through the CLI the frontier model has a start-up cost worth paying ahead of
// time, so find out which route the proxy is using.
let frontierViaCli = false;
if (!params.mock) {
  fetch('api/health')
    .then((reply) => reply.json())
    .then((health) => {
      frontierViaCli = health.frontierVia === 'claude-cli';
      warmFrontier();
    })
    .catch(() => {});
}

let panels = [];
let runId = null;
let controls = controlState(['idle', 'idle']);

function selectTab(mode) {
  for (const tab of tabs) {
    tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
  }
}

// What a game of this mode looks like before anything has happened, for a
// panel that could not be built and for warming the frontier route.
function freshSnapshot(mode, side) {
  if (mode === 'strategic') {
    const world = createStrategicGame({ seed: params.seed });
    return {
      ...strategicSnapshot(world),
      side,
      games: config.strategic.games,
      wins: { jev: 0, frontier: 0, draw: 0 },
      score: 0,
    };
  }
  return gameApi(mode).snapshot(createGame(mode, { seed: params.seed }));
}

function failedPanel(mode, side, label, message) {
  const snapshot = freshSnapshot(mode, side);
  return {
    start() {},
    stop() {},
    tick() {},
    checkCaps() {},
    dispose() {},
    status: () => 'error',
    view() {
      return {
        label,
        mode,
        snapshot,
        stats: {
          decisions: 0,
          thinkingMs: 0,
          costUSD: 0,
          recentLatencies: [],
        },
        status: 'error',
        statusText: `error: ${message}`,
        inFlightMs: 0,
        rollingAvgMs: null,
        elapsedMs: 0,
        events: [],
      };
    },
  };
}

// Asks the proxy to start a CLI process for this mode before the first
// decision needs it, so that decision does not pay the start-up time.
function warmFrontier() {
  if (params.mock || !frontierViaCli) {
    return;
  }
  const mode = params.mode;
  const state = encodeState(freshSnapshot(mode, 'frontier'), config[mode]);
  const body = buildFrontierRequest(state, getContract(mode), config.frontier[mode], config);
  fetch('api/warm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId, mode, body }),
  }).catch(() => {});
}

const playerOf = { left: 'jev', right: 'frontier' };
for (const side of sides) {
  elements[side].panel.style.setProperty('--token-colour', boardPalette[playerOf[side]]);
}

function buildPanels(ledger) {
  const labelFor = (side) => config.models[playerOf[side]].label;
  const describe = (error) => (error instanceof Error ? error.message : String(error));

  // The strategic mode is one match on one board, so both panels are views of
  // the same controller.
  if (params.mode === 'strategic') {
    try {
      const drivers = {
        jev: createDriver('left', { ...params, config, runId }),
        frontier: createDriver('right', { ...params, config, runId }),
      };
      return createDuel({ drivers, seed: params.seed, config, ledger }).panels();
    } catch (error) {
      return sides.map((side) => failedPanel(params.mode, playerOf[side], labelFor(side), describe(error)));
    }
  }

  return sides.map((side) => {
    try {
      const driver = createDriver(side, { ...params, config, runId });
      return createPanel({
        mode: params.mode,
        driver,
        seed: params.seed,
        config,
        ledger,
      });
    } catch (error) {
      return failedPanel(params.mode, playerOf[side], labelFor(side), describe(error));
    }
  });
}

function buildRun() {
  for (const panel of panels) {
    panel.dispose();
  }

  runId = crypto.randomUUID();
  panels = buildPanels(createLedger(config.caps.maxSpendUSD[params.mode]));
  selectTab(params.mode);
  // The stylesheet lays the page out per mode: two games side by side, or one
  // board with a model on each side.
  document.body.dataset.mode = params.mode;
  for (const side of sides) {
    elements[side].scoreLabel.textContent = params.mode === 'strategic' ? 'games won' : 'score';
    elements[side].feedKey = '';
  }
  // The speed of the clock only means something in the real-time game.
  speedInput.disabled = params.mode !== 'reflexive';
  warmFrontier();
}

// Both panels start in the same call stack so neither gets a head start.
function startRun() {
  for (const panel of panels) {
    panel.start();
  }
}

function tickAll() {
  for (const panel of panels) {
    panel.tick();
    panel.checkCaps();
  }
}

let clock = null;
function setSpeed(speed) {
  params.speed = speed;
  speedInput.value = String(speed);
  speedValue.textContent = `${speed}x`;
  clearInterval(clock);
  clock = setInterval(tickAll, config.reflexive.tickIntervalMs / speed);
}

buildRun();
setSpeed(params.speed);

startButton.addEventListener('click', startRun);
stopButton.addEventListener('click', () => {
  for (const panel of panels) {
    panel.stop();
  }
});
resetButton.addEventListener('click', buildRun);
speedInput.addEventListener('input', () => setSpeed(Number(speedInput.value)));
// A waiting game shows "start" on itself, so a click on it starts the run.
for (const canvas of [...sides.map((side) => elements[side].canvas), boardCanvas]) {
  canvas.addEventListener('click', () => {
    if (controls.canStart) {
      startRun();
    }
  });
}
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    if (tab.dataset.mode === params.mode) {
      return;
    }
    params.mode = tab.dataset.mode;
    // Keeps a reload on the mode the viewer chose.
    const url = new URL(window.location.href);
    url.searchParams.set('mode', params.mode);
    window.history.replaceState(null, '', url);
    buildRun();
  });
}

// The match lists more of each model's moves, as the side columns have the room.
const feedLines = () => (params.mode === 'strategic' ? 10 : 4);

// Rebuilds a panel's decision feed, but only when a new decision has arrived:
// this runs every frame and the list rarely changes between two of them.
function renderFeed(target, events) {
  const key = `${events.length}:${events.at(-1)?.atMs ?? ''}`;
  if (key === target.feedKey) {
    return;
  }
  target.feedKey = key;
  const count = feedLines();
  target.feed.replaceChildren(...recentLines(events, count).map((line) => {
    const item = document.createElement('li');
    // Older lines fade, so the eye lands on the newest.
    item.style.opacity = String(Math.max(0.35, 1 - line.back * (0.75 / count)));
    const text = document.createElement('span');
    text.textContent = line.text;
    if (line.error) {
      text.className = 'error';
    }
    const confidence = document.createElement('span');
    confidence.className = 'confidence';
    confidence.textContent = line.confidence;
    item.append(text, confidence);
    return item;
  }));
}

function frame(timeMs) {
  const statuses = [];
  const strategic = params.mode === 'strategic';
  panels.forEach((panel, index) => {
    const view = panel.view();
    statuses.push(view.status);
    const target = elements[sides[index]];
    const running = view.status === 'running';
    const thinking = running && view.inFlightMs > 0;
    // An idle game invites the click that starts it.
    const overlay = running ? '' : (view.status === 'idle' ? 'start' : view.statusText);
    // The match's side columns are narrow, so they show the short name without the model id.
    target.title.textContent = strategic ? view.label.replace(/ \([^)]*\)$/, '') : view.label;
    // In the match the thinking model gets a spinner beside its name. In the
    // real-time game the spinner is drawn on the ship instead.
    target.spinner.hidden = !(strategic && thinking);

    if (strategic) {
      // Both panels are views of the same match, so the board is drawn once.
      if (index === 0) {
        drawPanel(board, view.snapshot, view.status === 'idle' ? 'start' : '', timeMs);
      }
    } else {
      const lastEvent = view.events.at(-1);
      drawPanel(
        target.game,
        view.snapshot,
        overlay,
        timeMs,
        running
          ? {
            thinkingMs: view.inFlightMs,
            sinceDecisionMs: lastEvent ? view.elapsedMs - lastEvent.atMs : null,
          }
          : null,
      );
      drawTimeline(target.timeline, view, pagePalette, config.timeline.windowMs);
    }
    renderFeed(target, view.events);
    renderHud(target.hud, hudStrings(view));
  });

  controls = controlState(statuses);
  startButton.disabled = !controls.canStart;
  stopButton.disabled = !controls.canStop;
  resetButton.disabled = !controls.canReset;
  for (const tab of tabs) {
    tab.disabled = !controls.canSwitchMode;
  }
  for (const canvas of [...sides.map((side) => elements[side].canvas), boardCanvas]) {
    canvas.classList.toggle('can-start', controls.canStart);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

if (params.autostart) {
  startRun();
}
