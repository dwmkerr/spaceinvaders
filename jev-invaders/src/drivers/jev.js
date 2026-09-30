import { getContract } from '../contract.js';
import {
  byteLength,
  jevCostUSD,
  worstCaseCostUSD,
} from '../cost.js';

const defaultFetch = (...args) => fetch(...args);
const defaultNow = () => performance.now();

function tokensFor(usage) {
  return {
    input: typeof usage?.input_tokens === 'number' ? usage.input_tokens : 0,
    output: typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0,
  };
}

function validNoul(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function buildJevRequest(state, contract, config) {
  return {
    state,
    model: config.models.jev.model,
    questions: contract.questions,
  };
}

export function parseJevResponse(upstream, contract, thresholds) {
  const tokens = tokensFor(upstream?.usage);
  const answers = upstream?.answers;
  if (answers === null || typeof answers !== 'object' || Array.isArray(answers)) {
    return { error: 'answers missing', tokens };
  }

  const move = answers.move?.choice;
  if (!Object.hasOwn(contract.questions.move.criteria, move)) {
    return { error: `invalid move answer: "${String(move)}"`, tokens };
  }

  const fire = answers.fire?.noul;
  if (!validNoul(fire)) {
    return { error: 'invalid fire answer', tokens };
  }

  let bomb = false;
  if (Object.hasOwn(contract.questions, 'bomb')) {
    const bombAnswer = answers.bomb?.noul;
    if (!validNoul(bombAnswer)) {
      return { error: 'invalid bomb answer', tokens };
    }
    bomb = bombAnswer >= thresholds.bomb;
  }

  if (
    typeof upstream?.usage?.input_tokens !== 'number'
    || typeof upstream?.usage?.output_tokens !== 'number'
  ) {
    return { error: 'usage missing', tokens };
  }

  return {
    action: {
      move,
      fire: fire >= thresholds.fire,
      bomb,
    },
    tokens,
  };
}

export function createJevDriver({
  mode,
  runId,
  config,
  fetchFn = defaultFetch,
  now = defaultNow,
}) {
  const contract = getContract(mode);
  const model = config.models.jev.model;
  const price = config.pricing[model];
  const thresholds = {
    fire: config.jev.fireThreshold,
    bomb: config.jev.bombThreshold,
  };

  const errorResult = (error, startedAt, extra = {}) => ({
    error,
    ...extra,
    costUSD: 0,
    latencyMs: now() - startedAt,
    tokens: { input: 0, output: 0 },
  });

  return {
    label: `${config.models.jev.label} (${model})`,
    isMock: false,

    worstCaseCostUSD(state) {
      const body = buildJevRequest(state, contract, config);
      return worstCaseCostUSD({
        price,
        inputBytes: byteLength(JSON.stringify(body)),
        overheadTokens: config.caps.reserveOverheadTokens,
        maxOutputTokens: 0,
      });
    },

    async decide(state) {
      const startedAt = now();
      const body = buildJevRequest(state, contract, config);
      let response;
      let proxy;
      try {
        response = await fetchFn('api/jev', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ runId, mode, body }),
        });
        proxy = await response.json();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`proxy unreachable: ${message}`, startedAt);
      }

      if (response.status === 402) {
        return errorResult('spend cap reached', startedAt, { capped: true });
      }
      if (!response.ok) {
        return errorResult(proxy.error, startedAt);
      }

      const latencyMs = now() - startedAt;
      const parsed = parseJevResponse(proxy.upstream, contract, thresholds);
      let costUSD = typeof proxy.costUSD === 'number' ? proxy.costUSD : 0;
      try {
        costUSD = jevCostUSD(proxy.upstream?.usage, price);
      } catch (error) {
        if (error.message !== 'usage missing') {
          throw error;
        }
      }

      if (parsed.error) {
        return {
          error: parsed.error,
          costUSD,
          latencyMs,
          tokens: parsed.tokens,
        };
      }
      return {
        ...parsed.action,
        costUSD,
        latencyMs,
        tokens: parsed.tokens,
      };
    },
  };
}
