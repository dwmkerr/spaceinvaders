import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { config } from '../src/config.js';
import { byteLength, jevCostUSD, worstCaseCostUSD } from '../src/cost.js';
import { createHandler } from '../src/proxy/handler.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const hostHeaders = { host: '127.0.0.1:8787' };

function makeConfig(overrides = {}) {
  return {
    ...config,
    caps: {
      ...config.caps,
      ...overrides,
      maxSpendUSD: {
        ...config.caps.maxSpendUSD,
        ...overrides.maxSpendUSD,
      },
    },
  };
}

function makeFetch({ obj = { usage: { input_tokens: 10, output_tokens: 5 } }, status = 200 } = {}) {
  const calls = [];
  const fetchFn = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(obj), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetchFn };
}

function setup({
  handlerConfig = config,
  keys = { typesafe: 'tk-test', anthropic: 'ak-test' },
  fetchFn,
} = {}) {
  const stub = fetchFn ? { calls: [], fetchFn } : makeFetch();
  const handle = createHandler({
    config: handlerConfig,
    keys,
    fetchFn: stub.fetchFn,
    rootDir,
    port: 8787,
  });
  return { ...stub, handle };
}

function request(handle, {
  method = 'POST',
  url = '/api/frontier',
  headers = hostHeaders,
  runId = 'run-1',
  mode = 'reflexive',
  body = { messages: [{ role: 'user', content: 'play' }] },
  rawBody,
} = {}) {
  return handle({
    method,
    url,
    headers,
    body: rawBody ?? JSON.stringify({ runId, mode, body }),
  });
}

function parsed(result) {
  return JSON.parse(result.body);
}

function assertNoSecrets(value) {
  for (const secret of ['tk-test', 'ak-test', 'tok-test']) {
    assert.equal(value.includes(secret), false);
  }
}

test('serves only allowed static files without exposing keys', async () => {
  const { handle } = setup();
  const index = await request(handle, { method: 'GET', url: '/' });
  assert.equal(index.status, 200);
  assert.equal(index.headers['content-type'], 'text/html; charset=utf-8');
  const source = await request(handle, { method: 'GET', url: '/src/config.js?x=1' });
  assert.equal(source.status, 200);

  for (const result of [index, source]) {
    assert.equal(result.headers['cache-control'], 'no-store');
    assertNoSecrets(result.body);
  }
  for (const url of [
    '/.env',
    '/server.js',
    '/package.json',
    '/src/../.env',
    '/src/proxy/handler.js',
  ]) {
    const result = await request(handle, { method: 'GET', url });
    assert.equal(result.status, 404, url);
    assertNoSecrets(result.body);
  }
});

test('rejects non-local hosts and origins before calling upstream', async () => {
  const { calls, handle } = setup();
  const badHost = await request(handle, {
    headers: { host: 'evil.example:8787' },
  });
  const badOrigin = await request(handle, {
    headers: { ...hostHeaders, origin: 'http://evil.example' },
  });
  assert.equal(badHost.status, 403);
  assert.equal(badOrigin.status, 403);
  assert.equal(calls.length, 0);
});

test('rebuilds and forwards Jev requests', async () => {
  const usage = { input_tokens: 123, output_tokens: 9 };
  const stub = makeFetch({ obj: { answer: true, usage } });
  const { handle } = setup({ fetchFn: stub.fetchFn });
  const result = await request(handle, {
    url: '/api/jev',
    body: {
      state: { cannon: 'centre' },
      model: 'page-choice',
      questions: { fire: { type: 'noul' } },
      extra: 'drop me',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(stub.calls.length, 1);
  const [endpoint, options] = stub.calls[0];
  assert.equal(endpoint, config.endpoints.jev);
  assert.equal(options.headers.authorization, 'Bearer tk-test');
  assert.deepEqual(JSON.parse(options.body), {
    state: { cannon: 'centre' },
    model: 'jev-latest',
    questions: { fire: { type: 'noul' } },
  });
  assert.equal(
    parsed(result).costUSD,
    jevCostUSD(usage, config.pricing['jev-latest']),
  );
  assertNoSecrets(result.body);
});

test('rebuilds frontier requests and uses an API key', async () => {
  const stub = makeFetch();
  const { handle } = setup({ fetchFn: stub.fetchFn });
  const result = await request(handle, {
    body: {
      model: 'page-choice',
      max_tokens: 999999,
      system: 'play',
      messages: [{ role: 'user', content: 'state' }],
      output_config: { format: { type: 'json_schema' } },
      thinking: { type: 'adaptive' },
      stream: true,
      tools: [{ name: 'nope' }],
      tool_choice: { type: 'any' },
    },
  });

  assert.equal(result.status, 200);
  assert.equal(stub.calls.length, 1);
  const [endpoint, options] = stub.calls[0];
  assert.equal(endpoint, 'https://api.anthropic.com/v1/messages');
  assert.equal(options.headers['x-api-key'], 'ak-test');
  assert.equal(options.headers['anthropic-version'], '2023-06-01');
  assert.equal('authorization' in options.headers, false);
  assert.deepEqual(JSON.parse(options.body), {
    model: 'claude-opus-5-5',
    max_tokens: 4096,
    system: 'play',
    messages: [{ role: 'user', content: 'state' }],
    output_config: { format: { type: 'json_schema' } },
    thinking: { type: 'adaptive' },
  });
  assertNoSecrets(result.body);
});

test('uses an Anthropic bearer token and base URL override', async () => {
  const stub = makeFetch();
  const { handle } = setup({
    keys: {
      anthropicAuthToken: 'tok-test',
      anthropicBaseUrl: 'https://gw.example/base/',
    },
    fetchFn: stub.fetchFn,
  });
  const result = await request(handle);
  assert.equal(result.status, 200);
  const [endpoint, options] = stub.calls[0];
  assert.equal(endpoint, 'https://gw.example/base/v1/messages');
  assert.equal(options.headers.authorization, 'Bearer tok-test');
  assert.equal('x-api-key' in options.headers, false);
  assertNoSecrets(result.body);
});

test('reports missing credentials without calling upstream', async () => {
  const jev = setup({ keys: {} });
  const jevResult = await request(jev.handle, {
    url: '/api/jev',
    body: { state: {}, questions: {} },
  });
  assert.equal(jevResult.status, 503);
  assert.equal(parsed(jevResult).error, 'TYPESAFE_API_KEY is not set in .env');
  assert.equal(jev.calls.length, 0);

  const frontier = setup({ keys: { typesafe: 'tk-test' } });
  const frontierResult = await request(frontier.handle);
  assert.equal(frontierResult.status, 503);
  assert.equal(
    parsed(frontierResult).error,
    'ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is not set in .env',
  );
  assert.equal(frontier.calls.length, 0);
});

function frontierReservation(handlerConfig, body) {
  const tokenLimit = Math.max(
    handlerConfig.frontier.reflexive.maxTokens,
    handlerConfig.frontier.strategic.maxTokens,
  );
  const rebuilt = {
    model: handlerConfig.models.frontier.model,
    max_tokens: Math.min(body.max_tokens, tokenLimit),
    system: body.system,
    messages: body.messages,
    output_config: body.output_config,
  };
  return worstCaseCostUSD({
    price: handlerConfig.pricing[handlerConfig.models.frontier.model],
    inputBytes: byteLength(JSON.stringify(rebuilt)),
    overheadTokens: handlerConfig.caps.reserveOverheadTokens,
    maxOutputTokens: rebuilt.max_tokens,
  });
}

test('enforces the per-run cap without exceeding it', async () => {
  const body = {
    max_tokens: 4096,
    system: 'play',
    messages: [{ role: 'user', content: 'fixed request' }],
    output_config: { format: { type: 'json_schema' } },
  };
  const reservation = frontierReservation(config, body);
  const cap = 2.5 * reservation;
  const handlerConfig = makeConfig({
    maxSpendUSD: { reflexive: cap },
    maxProcessSpendUSD: 100,
  });
  const stub = makeFetch({
    obj: { usage: { input_tokens: 0, output_tokens: body.max_tokens } },
  });
  const { handle } = setup({ handlerConfig, fetchFn: stub.fetchFn });

  const results = [];
  for (let i = 0; i < 3; i += 1) {
    results.push(await request(handle, { body }));
  }
  assert.deepEqual(results.map((result) => result.status), [200, 200, 402]);
  assert.equal(stub.calls.length, 2);
  for (const result of results) {
    assert.ok(parsed(result).runSpentUSD <= cap);
  }
});

test('does not apply a run cap in strategic mode', async () => {
  const body = {
    max_tokens: 4096,
    messages: [{ role: 'user', content: 'fixed request' }],
  };
  const reservation = frontierReservation(config, body);
  const handlerConfig = makeConfig({
    maxSpendUSD: { reflexive: 2.5 * reservation, strategic: null },
    maxProcessSpendUSD: 100,
  });
  const stub = makeFetch({
    obj: { usage: { input_tokens: 0, output_tokens: body.max_tokens } },
  });
  const { handle } = setup({ handlerConfig, fetchFn: stub.fetchFn });

  const statuses = [];
  for (let i = 0; i < 5; i += 1) {
    statuses.push((await request(handle, { mode: 'strategic', body })).status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200]);
  assert.equal(stub.calls.length, 5);
});

test('enforces the process cap across run IDs', async () => {
  const body = {
    max_tokens: 4096,
    messages: [{ role: 'user', content: 'fixed request' }],
  };
  const reservation = frontierReservation(config, body);
  const handlerConfig = makeConfig({
    maxSpendUSD: { reflexive: 100 },
    maxProcessSpendUSD: 2.5 * reservation,
  });
  const stub = makeFetch({
    obj: { usage: { input_tokens: 0, output_tokens: body.max_tokens } },
  });
  const { handle } = setup({ handlerConfig, fetchFn: stub.fetchFn });

  const results = [];
  for (let i = 0; i < 3; i += 1) {
    results.push(await request(handle, { runId: `run-${i}`, body }));
  }
  assert.deepEqual(results.map((result) => result.status), [200, 200, 402]);
  assert.equal(stub.calls.length, 2);
});

test('turns upstream failures into safe 502 responses and releases reservations', async () => {
  let count = 0;
  const calls = [];
  const fetchFn = async (...args) => {
    calls.push(args);
    count += 1;
    const status = count === 1 ? 429 : 200;
    const obj = count === 1
      ? { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }
      : { usage: { input_tokens: 0, output_tokens: 0 } };
    return new Response(JSON.stringify(obj), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  const body = { max_tokens: 4096, messages: [{ role: 'user', content: 'play' }] };
  const reservation = frontierReservation(config, body);
  const handlerConfig = makeConfig({
    maxSpendUSD: { reflexive: reservation },
    maxProcessSpendUSD: reservation,
  });
  const { handle } = setup({ handlerConfig, fetchFn });
  const first = await request(handle, { body });
  const second = await request(handle, { body });
  assert.equal(first.status, 502);
  assert.equal(parsed(first).error, 'upstream 429: slow down');
  assert.equal(second.status, 200);
  assert.equal(calls.length, 2);

  const unreachable = setup({
    fetchFn: async () => {
      throw new Error('offline');
    },
  });
  const thrown = await request(unreachable.handle);
  assert.equal(thrown.status, 502);
  assert.match(parsed(thrown).error, /^upstream unreachable/);
  assertNoSecrets(first.body + second.body + thrown.body);
});

test('reports a non-JSON upstream error and releases its reservation', async () => {
  let count = 0;
  const fetchFn = async () => {
    count += 1;
    if (count === 1) {
      return new Response('Unauthorized', { status: 401 });
    }
    return new Response(JSON.stringify({
      usage: { input_tokens: 0, output_tokens: 0 },
    }));
  };
  const body = { max_tokens: 4096, messages: [{ role: 'user', content: 'play' }] };
  const reservation = frontierReservation(config, body);
  const handlerConfig = makeConfig({
    maxSpendUSD: { reflexive: reservation },
    maxProcessSpendUSD: reservation,
  });
  const { handle } = setup({ handlerConfig, fetchFn });

  const first = await request(handle, { body });
  const second = await request(handle, { body });

  assert.equal(first.status, 502);
  assert.equal(parsed(first).error, 'upstream 401: Unauthorized');
  assert.equal(second.status, 200);
  assert.equal(count, 2);
});

test('reports a non-JSON successful upstream response', async () => {
  const { handle } = setup({
    fetchFn: async () => new Response('not JSON'),
  });
  const result = await request(handle);

  assert.equal(result.status, 502);
  assert.equal(parsed(result).error, 'upstream returned non-JSON');
});

test('health and invalid routes return safe responses', async () => {
  const { calls, handle } = setup({ keys: { typesafe: 'tk-test' } });
  const health = await request(handle, { method: 'GET', url: '/api/health' });
  assert.equal(health.status, 200);
  assert.deepEqual(parsed(health).keys, { typesafe: true, anthropic: false });
  assertNoSecrets(health.body);

  const malformed = await request(handle, { rawBody: '{' });
  const missingRun = await request(handle, {
    rawBody: JSON.stringify({ mode: 'reflexive', body: {} }),
  });
  const badMode = await request(handle, { mode: 'reckless' });
  const getApi = await request(handle, { method: 'GET', url: '/api/jev' });
  assert.equal(malformed.status, 400);
  assert.equal(missingRun.status, 400);
  assert.equal(badMode.status, 400);
  assert.equal(getApi.status, 405);
  assert.equal(calls.length, 0);
  assertNoSecrets(
    health.body + malformed.body + missingRun.body + badMode.body + getApi.body,
  );
});
