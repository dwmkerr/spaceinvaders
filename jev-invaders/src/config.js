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
    frontier: { model: 'claude-opus-5-5', label: 'Opus 5.5' },
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
  },
  frontier: {
    reflexive: { effort: 'low', maxTokens: 2048, thinking: null, systemSuffix: 'Answer directly without deliberating.' },
    strategic: { effort: 'medium', maxTokens: 4096, thinking: { type: 'adaptive' }, systemSuffix: '' },
    timeoutMs: 120000,
  },
  jev: { fireThreshold: 0.5, bombThreshold: 0.5, timeoutMs: 15000 },
  reflexive: {
    tickIntervalMs: 50,
    cols: 16, rows: 20, cannonRow: 19, rocketStartRow: 18, cannonStartCol: 7,
    lives: 3,
    formation: { cols: 6, rows: 3, spacing: 2, startCol: 2, startRow: 1 },
    points: [30, 20, 10],
    invaderMoveEvery: 16,
    bombFallEvery: 4,
    bombChance: 0.04,
    maxBombs: 4,
    invasionRow: 18,
  },
  strategic: {
    laneLength: 6, turns: 30, lives: 3, smartBombs: 3, startFacing: 'north',
    opening: [
      { lane: 'north', distance: 4, kind: 'drone' },
      { lane: 'west', distance: 6, kind: 'runner' },
    ],
    spawnChanceStart: 0.2, spawnChanceEnd: 0.4, runnerChance: 0.35,
    surgeTurns: [8, 16, 24],
    speed: { drone: 1, runner: 2 },
    points: { drone: 10, runner: 20, unusedBomb: 50, life: 100 },
  },
  caps: {
    // Per run, both panels together. null means no spend cap: the owner runs
    // strategic mode uncapped, bounded only by the turn and wall-clock caps.
    maxSpendUSD: { reflexive: 0.5, strategic: null },
    maxProcessSpendUSD: 10.0,
    maxTicks: { reflexive: 6000, strategic: 60 },
    maxWallClockSec: 480,
    reserveOverheadTokens: 2000,
  },
  hud: { rollingWindow: 20 },
  mock: {
    jev: { latencyMs: 150, costPerCallUSD: 0.00002 },
    frontier: { latencyMs: 2500, costPerCallUSD: 0.005 },
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
