import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import {
  buildFrontierPrompt,
  buildSchema,
  getContract,
} from '../src/contract.js';
import { byteLength, worstCaseCostUSD } from '../src/cost.js';
import {
  buildFrontierRequest,
  createFrontierDriver,
  parseFrontierResponse,
} from '../src/drivers/frontier.js';

const contract = getContract('reflexive');
const state = { cannon: 'centre' };

function upstream({
  text = '{"move":"left","fire":true}',
  stopReason = 'end_turn',
  stopDetails,
} = {}) {
  return {
    content: [
      { type: 'thinking', thinking: '', signature: 's' },
      { type: 'text', text },
    ],
    stop_reason: stopReason,
    stop_details: stopDetails,
    usage: { input_tokens: 812, output_tokens: 140 },
  };
}

function response(status, value) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return value;
    },
  };
}

test('builds the reflexive Frontier request in upstream key order', () => {
  const request = buildFrontierRequest(
    state,
    contract,
    config.frontier.reflexive,
    config,
  );

  assert.deepEqual(request, {
    model: 'claude-opus-5-5',
    max_tokens: 2048,
    system: `${contract.system} Answer directly without deliberating.`,
    messages: [{ role: 'user', content: buildFrontierPrompt(state, contract) }],
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: buildSchema(contract) },
    },
  });
  assert.deepEqual(Object.keys(request), [
    'model',
    'max_tokens',
    'system',
    'messages',
    'output_config',
  ]);
  for (const key of ['thinking', 'tools', 'tool_choice']) {
    assert.equal(Object.hasOwn(request, key), false);
  }
});

test('builds a strategic request with adaptive thinking and bomb schema', () => {
  const strategicContract = {
    mode: 'strategic',
    system: 'Play the siege.',
    questions: {
      move: {
        type: 'choice',
        instructions: 'Turn?',
        criteria: { left: 'left', right: 'right', stay: 'stay' },
      },
      fire: { type: 'noul', instructions: 'Fire?' },
      bomb: { type: 'noul', instructions: 'Bomb?' },
    },
  };
  const request = buildFrontierRequest(
    state,
    strategicContract,
    config.frontier.strategic,
    config,
  );

  assert.equal(request.max_tokens, 4096);
  assert.equal(request.output_config.effort, 'medium');
  assert.deepEqual(request.thinking, { type: 'adaptive' });
  assert.deepEqual(request.output_config.format.schema.properties.bomb, {
    type: 'boolean',
  });
  assert.equal(Object.keys(request).at(-1), 'thinking');
});

test('parses text after thinking and computes billed usage', () => {
  assert.deepEqual(parseFrontierResponse(upstream(), contract), {
    action: { move: 'left', fire: true, bomb: false },
    costUSD: 0.006048,
    tokens: { input: 812, output: 140 },
  });
});

test('reports billed refusals before inspecting content', () => {
  const result = parseFrontierResponse(upstream({
    stopReason: 'refusal',
    stopDetails: { category: 'cyber' },
  }), contract);

  assert.equal(result.error, 'refused (cyber)');
  assert.ok(result.costUSD > 0);
});

test('rejects cut-off and out-of-contract answers', () => {
  assert.equal(
    parseFrontierResponse(upstream({ stopReason: 'max_tokens' }), contract).error,
    'answer cut off at max_tokens',
  );
  assert.equal(
    parseFrontierResponse(upstream({
      text: '{"move":"up","fire":true}',
    }), contract).error,
    'invalid move answer: "up"',
  );
});

test('posts through the proxy and returns the parsed decision', async () => {
  const calls = [];
  const times = [100, 145];
  const driver = createFrontierDriver({
    mode: 'reflexive',
    runId: 'run-9',
    config,
    fetchFn: async (...args) => {
      calls.push(args);
      return response(200, { upstream: upstream() });
    },
    now: () => times.shift(),
  });

  const result = await driver.decide(state);
  assert.equal(calls[0][0], 'api/frontier');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    runId: 'run-9',
    mode: 'reflexive',
    body: buildFrontierRequest(
      state,
      contract,
      config.frontier.reflexive,
      config,
    ),
  });
  assert.equal(result.move, 'left');
  assert.equal(result.fire, true);
  assert.equal(result.bomb, false);
  assert.equal(result.costUSD, 0.006048);
  assert.equal(result.latencyMs, 45);
});

test('returns an action-free capped result for a 402', async () => {
  const driver = createFrontierDriver({
    mode: 'reflexive',
    runId: 'run-9',
    config,
    fetchFn: async () => response(402, { error: 'spend cap reached' }),
    now: () => 10,
  });
  const result = await driver.decide(state);

  assert.equal(result.error, 'spend cap reached');
  assert.equal(result.capped, true);
  for (const key of ['move', 'fire', 'bomb']) {
    assert.equal(Object.hasOwn(result, key), false);
  }
});

test('reserves max tokens in the worst-case request cost', () => {
  const driver = createFrontierDriver({
    mode: 'reflexive',
    runId: 'run-9',
    config,
    fetchFn: async () => response(500, {}),
  });
  const body = buildFrontierRequest(
    state,
    contract,
    config.frontier.reflexive,
    config,
  );
  const expected = worstCaseCostUSD({
    price: config.pricing['claude-opus-5-5'],
    inputBytes: byteLength(JSON.stringify(body)),
    overheadTokens: config.caps.reserveOverheadTokens,
    maxOutputTokens: config.frontier.reflexive.maxTokens,
  });

  assert.equal(driver.worstCaseCostUSD(state), expected);
});
