import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { config } from '../src/config.js';
import { createHandler } from '../src/proxy/handler.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const headers = { host: '127.0.0.1:8787' };
const frontierBody = {
  system: 'You are playing.',
  messages: [{ role: 'user', content: 'Game state: {}' }],
  output_config: { effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } },
};
const cliSuccess = {
  is_error: false,
  structured_output: { move: 'left', fire: true },
  total_cost_usd: 0.0032,
  duration_api_ms: 2786,
  usage: { input_tokens: 2, output_tokens: 144, cache_read_input_tokens: 1363 },
};

function setup({ keys = {}, result = cliSuccess, fails = false } = {}) {
  const cliCalls = [];
  const warmCalls = [];
  const fetchCalls = [];
  const handle = createHandler({
    config,
    keys,
    fetchFn: async (...args) => {
      fetchCalls.push(args);
      return new Response(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 } }));
    },
    claudeCli: {
      async run(options) {
        cliCalls.push(options);
        if (fails) {
          throw new Error('exit 1: not logged in');
        }
        return result;
      },
      warm(options) {
        warmCalls.push(options);
      },
    },
    rootDir,
    port: 8787,
  });
  const post = (body = frontierBody) => handle({
    method: 'POST',
    url: '/api/frontier',
    headers,
    body: JSON.stringify({ runId: 'run-cli', mode: 'reflexive', body }),
  });
  return { cliCalls, warmCalls, fetchCalls, handle, post };
}

test('frontier calls go through the claude cli when no key or token is set', async () => {
  const { cliCalls, fetchCalls, post } = setup();
  const reply = await post();
  const json = JSON.parse(reply.body);

  assert.equal(reply.status, 200);
  assert.equal(fetchCalls.length, 0);
  assert.equal(cliCalls.length, 1);
  assert.equal(cliCalls[0].model, config.models.frontier.model);
  assert.equal(cliCalls[0].effort, 'low');
  assert.equal(cliCalls[0].system, 'You are playing.');
  assert.equal(cliCalls[0].prompt, 'Game state: {}');
  assert.deepEqual(cliCalls[0].schema, { type: 'object' });
  assert.equal(json.via, 'claude-cli');
  assert.equal(json.costUSD, 0.0032);
  assert.equal(json.runSpentUSD, 0.0032);
  assert.equal(json.upstream.stop_reason, 'end_turn');
  assert.deepEqual(JSON.parse(json.upstream.content[0].text), { move: 'left', fire: true });
  assert.equal(json.upstream.usage.output_tokens, 144);
});

test('an api key takes priority over the claude cli', async () => {
  const { cliCalls, fetchCalls, post } = setup({ keys: { anthropic: 'ak-test' } });
  const reply = await post();

  assert.equal(reply.status, 200);
  assert.equal(cliCalls.length, 0);
  assert.equal(fetchCalls.length, 1);
});

test('a claude cli failure is reported and never replaced by a fallback', async () => {
  const thrown = setup({ fails: true });
  const first = await thrown.post();
  assert.equal(first.status, 502);
  assert.equal(JSON.parse(first.body).error, 'claude cli failed: exit 1: not logged in');

  const errored = setup({ result: { is_error: true, result: 'Credit balance is too low', total_cost_usd: 0 } });
  const second = await errored.post();
  assert.equal(second.status, 502);
  assert.equal(JSON.parse(second.body).error, 'claude cli: Credit balance is too low');
  assert.equal(errored.fetchCalls.length, 0);
});

test('health reports which route the frontier side uses', async () => {
  const health = async (options) => {
    const { handle } = setup(options);
    return JSON.parse((await handle({ method: 'GET', url: '/api/health', headers })).body);
  };

  assert.equal((await health()).frontierVia, 'claude-cli');
  assert.equal((await health()).keys.anthropic, true);
  assert.equal((await health({ keys: { anthropic: 'ak-test' } })).frontierVia, 'api');
});

test('the warm route starts a cli process for the same options a decision will use', async () => {
  const warmRequest = (handle) => handle({
    method: 'POST',
    url: '/api/warm',
    headers,
    body: JSON.stringify({ runId: 'run-cli', mode: 'reflexive', body: frontierBody }),
  });

  const viaCli = setup();
  const reply = await warmRequest(viaCli.handle);
  assert.deepEqual(JSON.parse(reply.body), { warmed: true });
  assert.deepEqual(viaCli.warmCalls, [{
    model: config.models.frontier.model,
    effort: 'low',
    system: 'You are playing.',
    schema: { type: 'object' },
  }]);
  assert.equal(viaCli.cliCalls.length, 0);

  const viaApi = setup({ keys: { anthropic: 'ak-test' } });
  assert.deepEqual(JSON.parse((await warmRequest(viaApi.handle)).body), { warmed: false });
  assert.equal(viaApi.warmCalls.length, 0);
});
