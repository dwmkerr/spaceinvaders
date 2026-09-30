import { createLedger } from './caps.js';
import { config } from './config.js';
import { createGame, gameApi } from './game/index.js';
import { hudStrings, renderHud } from './hud.js';
import { createPanel } from './panel.js';
import { drawPanel } from './render.js';
import { createDriver, parseParams } from './setup.js';

const params = parseParams(window.location.search);
const rootStyle = getComputedStyle(document.documentElement);
const paletteDefaults = {
  bg: config.palette?.bg ?? '#faf9f6',
  ink: config.palette?.ink ?? '#24292f',
  muted: config.palette?.muted ?? '#6e7681',
  faint: config.palette?.faint ?? '#d8d5cd',
  accent: config.palette?.accent ?? '#1a7f37',
  mono: config.palette?.mono ?? 'ui-monospace, monospace',
};
const palette = Object.fromEntries(
  Object.entries(paletteDefaults).map(([name, fallback]) => [
    name,
    rootStyle.getPropertyValue(`--${name}`).trim() || fallback,
  ]),
);

const sides = ['left', 'right'];
const elements = Object.fromEntries(sides.map((side) => [side, {
  title: document.querySelector(`#${side}-title`),
  canvas: document.querySelector(`#${side}-canvas`),
  hud: {
    score: document.querySelector(`#${side}-score`),
    decisions: document.querySelector(`#${side}-decisions`),
    thinking: document.querySelector(`#${side}-thinking`),
    cost: document.querySelector(`#${side}-cost`),
    status: document.querySelector(`#${side}-status`),
  },
}]));
const startButton = document.querySelector('#start');
const subtitle = document.querySelector('#subtitle');
const modeInputs = [...document.querySelectorAll('input[name="mode"]')];

for (const input of modeInputs) {
  input.checked = input.value === params.mode;
}

subtitle.textContent = `seed ${params.seed}${
  params.mock ? ' - mock drivers (no API calls)' : ''
}`;

let panels = [];
let runStarted = false;

function disableModeInputs(disabled) {
  for (const input of modeInputs) {
    input.disabled = disabled;
  }
}

function failedPanel(mode, seed, label, message) {
  const world = createGame(mode, { seed });
  const snapshot = gameApi(mode).snapshot(world);
  return {
    start() {},
    tick() {},
    checkCaps() {},
    dispose() {},
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
      };
    },
  };
}

function buildRun() {
  for (const panel of panels) {
    panel.dispose();
  }

  const runId = crypto.randomUUID();
  const ledger = createLedger(config.caps.maxSpendUSD[params.mode]);
  panels = sides.map((side) => {
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
      const label = side === 'left'
        ? config.models.jev.label
        : config.models.frontier.label;
      const message = error instanceof Error ? error.message : String(error);
      return failedPanel(params.mode, params.seed, label, message);
    }
  });
  runStarted = false;
  startButton.textContent = 'Start';
  disableModeInputs(false);
}

function startRun() {
  if (runStarted) {
    buildRun();
  }
  runStarted = true;
  startButton.textContent = 'Reset';
  disableModeInputs(true);
  panels[0].start();
  panels[1].start();
}

buildRun();
startButton.addEventListener('click', startRun);
for (const input of modeInputs) {
  input.addEventListener('change', () => {
    if (!input.checked) {
      return;
    }
    params.mode = input.value;
    buildRun();
  });
}

setInterval(() => {
  for (const panel of panels) {
    panel.tick();
    panel.checkCaps();
  }
}, config.reflexive.tickIntervalMs);

function frame() {
  let isRunning = false;
  panels.forEach((panel, index) => {
    const side = sides[index];
    const view = panel.view();
    isRunning ||= view.status === 'running';
    const target = elements[side];
    target.title.textContent = view.label;
    drawPanel(
      target.canvas.getContext('2d'),
      view.snapshot,
      palette,
      view.status === 'running' ? '' : view.statusText,
    );
    renderHud(target.hud, hudStrings(view));
  });
  if (runStarted && !isRunning) {
    disableModeInputs(false);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

if (params.autostart) {
  startRun();
}
