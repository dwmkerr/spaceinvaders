import { buildFrontierPrompt, buildSchema, getContract } from '../contract.js';
import { config as defaultConfig } from '../config.js';
import {
  anthropicCostUSD,
  byteLength,
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

// Jev returns a calibrated confidence with every choice. A chat model has no
// such figure, so it is asked to state one, which is the comparison the
// timeline draws.
const CONFIDENCE_QUESTION = '- confidence: How confident are you in your move answer? Give a probability from 0 to 1.';

function schemaWithConfidence(schema) {
  return {
    ...schema,
    properties: { ...schema.properties, confidence: { type: 'number' } },
    required: [...schema.required, 'confidence'],
  };
}

function confidenceFrom(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

export function buildFrontierRequest(state, contract, modeConfig, config) {
  const request = {
    model: config.models.frontier.model,
    max_tokens: modeConfig.maxTokens,
    system: [contract.system, modeConfig.systemSuffix].filter(Boolean).join(' '),
    messages: [{
      role: 'user',
      content: `${buildFrontierPrompt(state, contract)}\n${CONFIDENCE_QUESTION}`,
    }],
    output_config: {
      effort: modeConfig.effort,
      format: {
        type: 'json_schema',
        schema: schemaWithConfidence(buildSchema(contract)),
      },
    },
  };

  if (modeConfig.thinking) {
    request.thinking = modeConfig.thinking;
  }
  return request;
}

function parseResponse(upstream, contract, price) {
  const tokens = tokensFor(upstream?.usage);
  let costUSD = 0;
  let usageError = null;
  try {
    costUSD = anthropicCostUSD(upstream?.usage, price);
  } catch (error) {
    usageError = error.message;
  }
  const details = { costUSD, tokens };

  if (upstream?.stop_reason === 'refusal') {
    const category = upstream.stop_details?.category ?? 'no category';
    return { error: `refused (${category})`, ...details };
  }
  if (upstream?.stop_reason === 'max_tokens') {
    return { error: 'answer cut off at max_tokens', ...details };
  }
  if (
    upstream?.stop_reason !== 'end_turn'
    && upstream?.stop_reason !== 'stop_sequence'
  ) {
    return {
      error: `unexpected stop_reason: ${String(upstream?.stop_reason)}`,
      ...details,
    };
  }

  const text = Array.isArray(upstream.content)
    ? upstream.content.find((block) => block?.type === 'text')
    : null;
  if (!text) {
    return { error: 'no text block in response', ...details };
  }

  let answer;
  try {
    answer = JSON.parse(text.text);
  } catch {
    return { error: 'answer was not valid JSON', ...details };
  }

  for (const [name, question] of Object.entries(contract.questions)) {
    const value = answer?.[name];
    if (question.type === 'choice') {
      if (!Object.hasOwn(question.criteria, value)) {
        return {
          error: `invalid ${name} answer: "${String(value)}"`,
          ...details,
        };
      }
    } else if (question.type === 'noul') {
      if (typeof value !== 'boolean') {
        return { error: `invalid ${name} answer`, ...details };
      }
    } else {
      return { error: `unknown question type: ${question.type}`, ...details };
    }
  }

  if (usageError) {
    return { error: usageError, ...details };
  }

  return {
    action: {
      move: answer.move,
      fire: answer.fire,
      bomb: Object.hasOwn(contract.questions, 'bomb') ? answer.bomb : false,
    },
    confidence: confidenceFrom(answer.confidence),
    ...details,
  };
}

export function parseFrontierResponse(upstream, contract) {
  const model = defaultConfig.models.frontier.model;
  return parseResponse(upstream, contract, defaultConfig.pricing[model]);
}

export function createFrontierDriver({
  mode,
  runId,
  config,
  fetchFn = defaultFetch,
  now = defaultNow,
}) {
  const contract = getContract(mode);
  const modeConfig = config.frontier[mode];
  const model = config.models.frontier.model;
  const price = config.pricing[model];

  const errorResult = (error, startedAt, extra = {}) => ({
    error,
    ...extra,
    costUSD: 0,
    latencyMs: now() - startedAt,
    tokens: { input: 0, output: 0 },
  });

  return {
    label: `${config.models.frontier.label} (${model})`,
    isMock: false,

    worstCaseCostUSD(state, override) {
      const body = buildFrontierRequest(state, override ?? contract, modeConfig, config);
      return worstCaseCostUSD({
        price,
        inputBytes: byteLength(JSON.stringify(body)),
        overheadTokens: config.caps.reserveOverheadTokens,
        maxOutputTokens: modeConfig.maxTokens,
      });
    },

    // `override` replaces the mode's fixed questions for one call, for a game
    // whose options change from move to move.
    async decide(state, override) {
      const startedAt = now();
      const active = override ?? contract;
      const body = buildFrontierRequest(state, active, modeConfig, config);
      let response;
      let proxy;
      try {
        response = await fetchFn('api/frontier', {
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
      const parsed = parseResponse(proxy.upstream, active, price);
      const usage = proxy.upstream?.usage;
      const hasUsage = typeof usage?.input_tokens === 'number'
        && typeof usage?.output_tokens === 'number';
      // Through the Claude CLI the proxy's figure is the one the CLI reported,
      // which includes cache pricing the page cannot work out from usage alone.
      const proxyCost = typeof proxy.costUSD === 'number' ? proxy.costUSD : 0;
      const costUSD = hasUsage && proxy.via !== 'claude-cli' ? parsed.costUSD : proxyCost;
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
        confidence: parsed.confidence,
        costUSD,
        latencyMs,
        tokens: parsed.tokens,
      };
    },
  };
}
