import { config as defaultConfig } from './config.js';
import { createFrontierDriver } from './drivers/frontier.js';
import { createJevDriver } from './drivers/jev.js';
import { createMockDriver } from './drivers/mock.js';

function numberParam(params, name, fallback) {
  const value = params.get(name);
  if (value === null || value === '') {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function parseParams(search) {
  const params = new URLSearchParams(search);
  const mockValue = params.get('mock');
  return {
    mock: mockValue === '1' || mockValue === 'true',
    mode: params.get('mode') === 'strategic' ? 'strategic' : 'reflexive',
    seed: numberParam(params, 'seed', defaultConfig.seed),
    autostart: params.get('autostart') === '1',
    mockLatency: {
      jev: numberParam(params, 'jevLatency', defaultConfig.mock.jev.latencyMs),
      frontier: numberParam(
        params,
        'frontierLatency',
        defaultConfig.mock.frontier.latencyMs,
      ),
    },
  };
}

export function createDriver(side, opts) {
  const resolvedConfig = opts.config ?? defaultConfig;
  if (!opts.mock) {
    if (side === 'left') {
      return createJevDriver({
        mode: opts.mode ?? 'reflexive',
        runId: opts.runId,
        config: resolvedConfig,
        fetchFn: opts.fetchFn,
        now: opts.now,
      });
    }
    if (side === 'right') {
      return createFrontierDriver({
        mode: opts.mode ?? 'reflexive',
        runId: opts.runId,
        config: resolvedConfig,
        fetchFn: opts.fetchFn,
        now: opts.now,
      });
    }
    throw new Error(`unknown side: ${side}`);
  }

  if (side === 'left') {
    return createMockDriver({
      label: resolvedConfig.models.jev.label,
      mode: opts.mode,
      latencyMs: opts.mockLatency?.jev ?? resolvedConfig.mock.jev.latencyMs,
      costPerCallUSD: resolvedConfig.mock.jev.costPerCallUSD,
      seed: opts.seed,
    });
  }
  if (side === 'right') {
    return createMockDriver({
      label: resolvedConfig.models.frontier.label,
      mode: opts.mode,
      latencyMs: opts.mockLatency?.frontier ?? resolvedConfig.mock.frontier.latencyMs,
      costPerCallUSD: resolvedConfig.mock.frontier.costPerCallUSD,
      seed: opts.seed,
    });
  }
  throw new Error(`unknown side: ${side}`);
}
