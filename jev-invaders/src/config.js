const deepFreeze = (value) => {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
};

export const config = deepFreeze({
  seed: 1983,
  models: {
    jev: { model: 'jev-latest', label: 'Jev' },
    frontier: { model: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  },
  endpoints: {
    jev: 'https://api.typesafe.ai/v1/systemone',
    // Base URL only. The proxy appends anthropicPath, and ANTHROPIC_BASE_URL in .env overrides the base.
    anthropicBase: 'https://api.anthropic.com',
    anthropicPath: '/v1/messages',
    anthropicVersion: '2023-06-01',
  },
  // USD per million tokens.
  pricing: {
    'jev-latest': { inputPerMTok: 0.042, outputPerMTok: 0 },
    // OWNER TO CONFIRM: from the claude-api skill's model table (cached 2026-09-25),
    // not checked against the live pricing page.
    'claude-opus-5-5': { inputPerMTok: 4.0, outputPerMTok: 20.0, cacheWritePerMTok: 5.0, cacheReadPerMTok: 0.2 },
    // Same source. The cache write price is assumed to be 1.25 times the input price.
    'claude-sonnet-5-5': { inputPerMTok: 2.0, outputPerMTok: 10.0, cacheWritePerMTok: 2.5, cacheReadPerMTok: 0.2 },
  },
  frontier: {
    // Sonnet 5.5 rejects `disabled`; `between_tools` is its way to turn thinking off.
    reflexive: { effort: 'low', maxTokens: 2048, thinking: { type: 'between_tools' }, systemSuffix: 'Answer directly without deliberating.' },
    strategic: { effort: 'medium', maxTokens: 4096, thinking: { type: 'adaptive' }, systemSuffix: '' },
    timeoutMs: 120000,
  },
  jev: { fireThreshold: 0.5, bombThreshold: 0.5, timeoutMs: 15000 },
  reflexive: {
    tickIntervalMs: 50,
    // The clock multiplier the page starts at. Faster play makes a slow answer cost more.
    defaultSpeed: 1.5,
    cols: 24, rows: 24, cannonRow: 23, rocketStartRow: 22, cannonStartCol: 11,
    // One ship and no spares: the first bomb to land ends the game.
    lives: 1,
    // Level 1 of the original dwmkerr/spaceinvaders: 11 files by 6 ranks, packed tight.
    formation: { cols: 11, rows: 6, spacing: 1, startCol: 6, startRow: 2 },
    points: [30, 30, 20, 20, 10, 10], // by formation row, top to bottom
    invaderMoveEvery: 16,
    bombFallEvery: 4,
    bombChance: 0.04,
    maxBombs: 4,
    invasionRow: 22,
  },
  strategic: {
    // Connect Four, played head to head.
    cols: 7,
    rows: 6,
    // One run is a short match, with the models taking turns to go first.
    games: 4,
    // How long a finished board stays on screen before the next game starts.
    pauseBetweenGamesMs: 3000,
  },
  caps: {
    // Per run, both panels together. null means no spend cap: the owner runs
    // strategic mode uncapped, bounded only by the turn and wall-clock caps.
    maxSpendUSD: { reflexive: 0.5, strategic: null },
    maxProcessSpendUSD: 10.0,
    // The reflexive limit allows for the speed slider at its fastest.
    maxTicks: { reflexive: 24000, strategic: 80 },
    maxWallClockSec: 480,
    reserveOverheadTokens: 2000,
  },
  hud: { rollingWindow: 20 },
  timeline: { windowMs: 30000, maxEvents: 3000 },
  mock: {
    // Confidence ranges are made up so the mock timeline has something to draw.
    jev: { latencyMs: 150, costPerCallUSD: 0.00002, confidence: [0.7, 1.0] },
    frontier: { latencyMs: 2500, costPerCallUSD: 0.005, confidence: [0.4, 1.0] },
  },
  canvas: { width: 480, height: 480 },
  proxy: { host: '127.0.0.1', port: 8787 },
});

export function priceFor(model) {
  const price = config.pricing[model];
  if (!price) {
    throw new Error(`No pricing configured for model: ${model}`);
  }
  return price;
}
