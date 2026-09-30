import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createLedger } from '../caps.js';
import {
  anthropicCostUSD,
  byteLength,
  jevCostUSD,
  worstCaseCostUSD,
} from '../cost.js';

const SOURCE_PATH = /^\/src\/(?!proxy\/)[a-z0-9_\-/]+\.js$/;

function headerValue(headers, name) {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  const match = Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  const value = match?.[1];
  return Array.isArray(value) ? value[0] : value;
}

function response(status, body, contentType = 'application/json; charset=utf-8') {
  return {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': contentType,
    },
    body,
  };
}

function jsonResponse(status, value) {
  return response(status, JSON.stringify(value));
}

function validObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseRequestBody(body) {
  if (typeof body !== 'string') {
    return null;
  }
  try {
    const request = JSON.parse(body);
    if (!validObject(request) || !validObject(request.body)) {
      return null;
    }
    if (
      typeof request.runId !== 'string'
      || request.runId.length < 1
      || request.runId.length > 100
    ) {
      return null;
    }
    if (request.mode !== 'reflexive' && request.mode !== 'strategic') {
      return null;
    }
    return request;
  } catch {
    return null;
  }
}

function upstreamMessage(json, text) {
  return json?.error?.message
    ?? json?.message
    ?? json?.detail
    ?? text.slice(0, 300);
}

function upstreamExcerpt(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function staticRoute(pathname) {
  if (pathname === '/' || pathname === '/index.html') {
    return { file: 'index.html', type: 'text/html; charset=utf-8' };
  }
  if (pathname === '/style.css') {
    return { file: 'style.css', type: 'text/css' };
  }
  if (
    SOURCE_PATH.test(pathname)
    && !pathname.includes('..')
    && !pathname.includes('//')
  ) {
    return { file: pathname.slice(1), type: 'text/javascript' };
  }
  return null;
}

export function createHandler({ config, keys = {}, fetchFn, rootDir, port }) {
  const runLedgers = new Map();
  const processLedger = createLedger(config.caps.maxProcessSpendUSD);
  const allowedHosts = new Set([
    `127.0.0.1:${port}`,
    `localhost:${port}`,
  ]);
  const allowedOrigins = new Set(Array.from(allowedHosts, (host) => `http://${host}`));

  const proxyRequest = async ({ route, request }) => {
    const isJev = route === '/api/jev';
    const model = isJev ? config.models.jev.model : config.models.frontier.model;
    const price = config.pricing[model];
    const source = request.body;
    let upstreamBody;
    let endpoint;
    let headers;
    let timeoutMs;
    let costForUsage;
    let maxOutputTokens;

    if (isJev) {
      if (!keys.typesafe) {
        return jsonResponse(503, { error: 'TYPESAFE_API_KEY is not set in .env' });
      }
      if (source.state === undefined || source.questions === undefined) {
        return jsonResponse(400, { error: 'invalid request' });
      }
      upstreamBody = {
        state: source.state,
        model,
        questions: source.questions,
      };
      endpoint = config.endpoints.jev;
      headers = {
        authorization: `Bearer ${keys.typesafe}`,
        'content-type': 'application/json',
      };
      timeoutMs = config.jev.timeoutMs;
      costForUsage = (usage) => jevCostUSD(usage, price);
      maxOutputTokens = 0;
    } else {
      if (!keys.anthropic && !keys.anthropicAuthToken) {
        return jsonResponse(503, {
          error: 'ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is not set in .env',
        });
      }
      if (source.messages === undefined) {
        return jsonResponse(400, { error: 'invalid request' });
      }
      const tokenLimit = Math.max(
        config.frontier.reflexive.maxTokens,
        config.frontier.strategic.maxTokens,
      );
      const requestedTokens = Number.isFinite(source.max_tokens) && source.max_tokens > 0
        ? Math.floor(source.max_tokens)
        : tokenLimit;
      upstreamBody = {
        model,
        max_tokens: Math.min(requestedTokens, tokenLimit),
        system: source.system,
        messages: source.messages,
        output_config: source.output_config,
      };
      if (source.thinking !== undefined) {
        upstreamBody.thinking = source.thinking;
      }
      const baseUrl = (keys.anthropicBaseUrl ?? config.endpoints.anthropicBase)
        .replace(/\/+$/, '');
      endpoint = `${baseUrl}${config.endpoints.anthropicPath}`;
      headers = {
        'anthropic-version': config.endpoints.anthropicVersion,
        'content-type': 'application/json',
      };
      if (keys.anthropic) {
        headers['x-api-key'] = keys.anthropic;
      } else {
        headers.authorization = `Bearer ${keys.anthropicAuthToken}`;
      }
      timeoutMs = config.frontier.timeoutMs;
      costForUsage = (usage) => anthropicCostUSD(usage, price);
      maxOutputTokens = upstreamBody.max_tokens;
    }

    const upstreamText = JSON.stringify(upstreamBody);
    const reservation = worstCaseCostUSD({
      price,
      inputBytes: byteLength(upstreamText),
      overheadTokens: config.caps.reserveOverheadTokens,
      maxOutputTokens,
    });
    let runLedger = runLedgers.get(request.runId);
    if (!runLedger) {
      runLedger = createLedger(config.caps.maxSpendUSD[request.mode]);
      runLedgers.set(request.runId, runLedger);
    }
    if (!runLedger.canAfford(reservation) || !processLedger.canAfford(reservation)) {
      return jsonResponse(402, {
        error: 'spend cap reached',
        runSpentUSD: runLedger.spentUSD,
      });
    }

    const runReservation = runLedger.reserve(reservation);
    const processReservation = processLedger.reserve(reservation);
    let upstream;
    try {
      upstream = await fetchFn(endpoint, {
        method: 'POST',
        headers,
        body: upstreamText,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      runLedger.settle(runReservation, 0);
      processLedger.settle(processReservation, 0);
      return jsonResponse(502, { error: `upstream unreachable: ${error.message}` });
    }

    const text = await upstream.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      runLedger.settle(runReservation, 0);
      processLedger.settle(processReservation, 0);
      if (!upstream.ok) {
        return jsonResponse(502, {
          error: `upstream ${upstream.status}: ${upstreamExcerpt(text)}`,
        });
      }
      return jsonResponse(502, { error: 'upstream returned non-JSON' });
    }
    if (!upstream.ok) {
      runLedger.settle(runReservation, 0);
      processLedger.settle(processReservation, 0);
      return jsonResponse(502, {
        error: `upstream ${upstream.status}: ${upstreamMessage(json, text)}`,
      });
    }

    let costUSD = reservation;
    try {
      costUSD = costForUsage(json.usage);
    } catch (error) {
      if (error.message !== 'usage missing') {
        throw error;
      }
    }
    runLedger.settle(runReservation, costUSD);
    processLedger.settle(processReservation, costUSD);
    return jsonResponse(200, {
      upstream: json,
      costUSD,
      runSpentUSD: runLedger.spentUSD,
    });
  };

  return async function handle({ method, url, headers, body = '' }) {
    const host = headerValue(headers, 'host')?.toLowerCase();
    if (!allowedHosts.has(host)) {
      return jsonResponse(403, { error: 'forbidden' });
    }
    const origin = headerValue(headers, 'origin');
    if (method === 'POST' && origin && !allowedOrigins.has(origin.toLowerCase())) {
      return jsonResponse(403, { error: 'forbidden' });
    }

    const pathname = (url ?? '').split('?', 1)[0];
    if (method === 'GET' && pathname === '/api/health') {
      return jsonResponse(200, {
        ok: true,
        keys: {
          typesafe: Boolean(keys.typesafe),
          anthropic: Boolean(keys.anthropic || keys.anthropicAuthToken),
        },
        processSpentUSD: processLedger.spentUSD,
      });
    }
    if (method === 'POST' && (pathname === '/api/jev' || pathname === '/api/frontier')) {
      const request = parseRequestBody(body);
      if (!request) {
        return jsonResponse(400, { error: 'invalid request' });
      }
      return proxyRequest({ route: pathname, request });
    }
    if (pathname.startsWith('/api/')) {
      return jsonResponse(405, { error: 'method not allowed' });
    }
    if (method !== 'GET') {
      return jsonResponse(404, { error: 'not found' });
    }

    const route = staticRoute(pathname);
    if (!route) {
      return jsonResponse(404, { error: 'not found' });
    }
    try {
      const contents = await readFile(join(rootDir, route.file), 'utf8');
      return response(200, contents, route.type);
    } catch {
      return jsonResponse(404, { error: 'not found' });
    }
  };
}
