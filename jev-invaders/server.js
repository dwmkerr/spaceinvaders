import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { config } from './src/config.js';
import { createHandler } from './src/proxy/handler.js';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const envPath = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const valueOrUndefined = (value) => value || undefined;
const keys = {
  typesafe: valueOrUndefined(process.env.TYPESAFE_API_KEY),
  anthropic: valueOrUndefined(process.env.ANTHROPIC_API_KEY),
  anthropicAuthToken: valueOrUndefined(process.env.ANTHROPIC_AUTH_TOKEN),
  anthropicBaseUrl: valueOrUndefined(process.env.ANTHROPIC_BASE_URL),
};
const port = Number(process.env.PORT) || config.proxy.port;
const handle = createHandler({
  config,
  keys,
  fetchFn: fetch,
  rootDir,
  port,
});

const server = createServer((request, response) => {
  const chunks = [];
  let size = 0;
  let tooLarge = false;

  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > 256 * 1024) {
      tooLarge = true;
      chunks.length = 0;
      return;
    }
    if (!tooLarge) {
      chunks.push(chunk);
    }
  });

  request.on('end', async () => {
    if (tooLarge) {
      response.writeHead(413, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify({ error: 'request body too large' }));
      return;
    }

    try {
      const result = await handle({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      response.writeHead(result.status, result.headers);
      response.end(result.body);
    } catch {
      response.writeHead(500, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify({ error: 'internal server error' }));
    }
  });
});

server.listen(port, config.proxy.host, () => {
  const typesafeStatus = keys.typesafe ? 'set' : 'missing';
  const anthropicStatus = keys.anthropic
    ? 'api key'
    : keys.anthropicAuthToken ? 'auth token' : 'missing';
  console.log(
    `jev-invaders on http://${config.proxy.host}:${port} `
    + `(typesafe key: ${typesafeStatus}, anthropic credential: ${anthropicStatus})`,
  );
});
