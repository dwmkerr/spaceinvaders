import assert from 'node:assert/strict';
import test from 'node:test';

import { config } from '../src/config.js';
import { getContract } from '../src/contract.js';
import { byteLength, jevCostUSD, worstCaseCostUSD } from '../src/cost.js';
import {
  buildJevRequest,
  createJevDriver,
  parseJevResponse,
} from '../src/drivers/jev.js';

const contract = getContract('reflexive');
const thresholds = { fire: 0.5, bomb: 0.5 };
const state = { cannon: 'centre' };

function upstream({ move = 'right', fire = 0.66 } = {}) {
  return {
    answers: {
      move: { choice: move },
      fire: { noul: fire },
    },
    usage: { input_tokens: 392, output_tokens: 65 },
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

test('builds the Jev request in upstream key order', () => {
  const request = buildJevRequest(state, contract, config);
  assert.deepEqual(request, {
    state,
    model: 'jev-latest',
    questions: contract.questions,
  });
  assert.deepEqual(Object.keys(request), ['state', 'model', 'questions']);
});

test('parses the Jev blog example', () => {
  assert.deepEqual(parseJevResponse(upstream(), contract, thresholds), {
    action: { move: 'right', fire: true, bomb: false },
    tokens: { input: 392, output: 65 },
  });
});

test('applies the inclusive fire threshold', () => {
  assert.equal(
    parseJevResponse(upstream({ fire: 0.5 }), contract, thresholds).action.fire,
    true,
  );
  assert.equal(
    parseJevResponse(upstream({ fire: 0.49 }), contract, thresholds).action.fire,
    false,
  );
});

test('reads a strategic bomb from its noul answer', () => {
  const strategicContract = getContract('strategic');
  const strategicUpstream = upstream();
  strategicUpstream.answers.bomb = { noul: 0.5 };

  assert.equal(
    parseJevResponse(
      strategicUpstream,
      strategicContract,
      thresholds,
    ).action.bomb,
    true,
  );
});

test('rejects a move outside the contract', () => {
  assert.deepEqual(parseJevResponse(
    upstream({ move: 'jump' }),
    contract,
    thresholds,
  ), {
    error: 'invalid move answer: "jump"',
    tokens: { input: 392, output: 65 },
  });
});

test('posts through the proxy and reports latency and cost', async () => {
  const calls = [];
  const times = [100, 137];
  const driver = createJevDriver({
    mode: 'reflexive',
    runId: 'run-8',
    config,
    fetchFn: async (...args) => {
      calls.push(args);
      return response(200, { upstream: upstream() });
    },
    now: () => times.shift(),
  });

  const result = await driver.decide(state);

  assert.equal(calls[0][0], 'api/jev');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    runId: 'run-8',
    mode: 'reflexive',
    body: buildJevRequest(state, contract, config),
  });
  assert.equal(result.latencyMs, 37);
  assert.equal(
    result.costUSD,
    jevCostUSD(upstream().usage, config.pricing['jev-latest']),
  );
});

test('returns action-free errors without falling back', async (t) => {
  const cases = [
    {
      name: 'spend cap',
      fetchFn: async () => response(402, { error: 'spend cap reached' }),
      expected: 'spend cap reached',
      capped: true,
    },
    {
      name: 'proxy error',
      fetchFn: async () => response(502, { error: 'upstream unavailable' }),
      expected: 'upstream unavailable',
    },
    {
      name: 'fetch rejection',
      fetchFn: async () => { throw new Error('connection refused'); },
      expected: 'proxy unreachable: connection refused',
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const driver = createJevDriver({
        mode: 'reflexive',
        runId: 'run-8',
        config,
        fetchFn: item.fetchFn,
        now: () => 10,
      });
      const result = await driver.decide(state);
      assert.equal(result.error, item.expected);
      assert.equal(result.capped, item.capped);
      assert.equal(result.costUSD, 0);
      for (const key of ['move', 'fire', 'bomb']) {
        assert.equal(Object.hasOwn(result, key), false);
      }
    });
  }
});

test('reserves the worst-case cost of the encoded request bytes', () => {
  const driver = createJevDriver({
    mode: 'reflexive',
    runId: 'run-8',
    config,
    fetchFn: async () => response(500, {}),
  });
  const body = buildJevRequest(state, contract, config);
  const expected = worstCaseCostUSD({
    price: config.pricing['jev-latest'],
    inputBytes: byteLength(JSON.stringify(body)),
    overheadTokens: config.caps.reserveOverheadTokens,
    maxOutputTokens: 0,
  });

  assert.equal(driver.worstCaseCostUSD(state), expected);
});
