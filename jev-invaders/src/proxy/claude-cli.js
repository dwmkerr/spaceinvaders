import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The CLI runs in an empty directory so no project CLAUDE.md or settings leak
// into the prompt and skew the comparison with Jev.
const workDir = join(tmpdir(), 'jev-invaders-claude-cli');

// The child only needs the Claude login, so the demo's own keys stay out of it.
const HIDDEN_ENV = ['TYPESAFE_API_KEY', 'ANTHROPIC_USE_CLAUDE_CLI'];

// A warm process nobody has used is closed after this long, so an idle server
// does not leave CLI sessions open for ever.
const IDLE_MS = 5 * 60 * 1000;

function start({ model, effort, system, schema }) {
  mkdirSync(workDir, { recursive: true });
  const env = { ...process.env };
  for (const name of HIDDEN_ENV) {
    delete env[name];
  }
  const child = spawn('claude', [
    '-p',
    '--model', model,
    '--effort', effort,
    // No tools, MCP servers or user settings: the model answers from the prompt alone.
    '--tools', '',
    '--strict-mcp-config',
    '--setting-sources', 'project',
    '--no-session-persistence',
    '--system-prompt', system,
    // Reading the prompt from stdin is what lets a process start before its
    // question exists, which is the whole point of warming.
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--json-schema', JSON.stringify(schema),
  ], { cwd: workDir, env, stdio: ['pipe', 'pipe', 'pipe'] });

  const entry = { child, stdout: '', stderr: '', closed: false, exitCode: null, waiters: [] };
  const notify = () => {
    for (const waiter of entry.waiters.splice(0)) {
      waiter();
    }
  };
  child.stdout.on('data', (chunk) => {
    entry.stdout += chunk;
    notify();
  });
  child.stderr.on('data', (chunk) => {
    entry.stderr += chunk;
  });
  child.stdin.on('error', () => {});
  child.on('error', (error) => {
    entry.closed = true;
    entry.stderr += error.message;
    notify();
  });
  child.on('close', (code) => {
    entry.closed = true;
    entry.exitCode = code;
    notify();
  });
  return entry;
}

function resultLine(entry) {
  for (const line of entry.stdout.split('\n')) {
    if (!line.includes('"type":"result"')) {
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'result') {
        return parsed;
      }
    } catch {
      // A partial line: the rest arrives with the next chunk.
    }
  }
  return null;
}

export function createClaudeCli() {
  // One spare process per distinct (model, effort, system, schema).
  const spares = new Map();

  const keyFor = ({ model, effort, system, schema }) => JSON.stringify([model, effort, system, schema]);

  const discard = (key) => {
    const spare = spares.get(key);
    if (spare) {
      clearTimeout(spare.timer);
      spare.entry.child.kill('SIGTERM');
      spares.delete(key);
    }
  };

  const warm = (options) => {
    const key = keyFor(options);
    const existing = spares.get(key);
    if (existing && !existing.entry.closed) {
      return;
    }
    discard(key);
    const entry = start(options);
    const timer = setTimeout(() => discard(key), IDLE_MS);
    timer.unref();
    spares.set(key, { entry, timer });
  };

  const take = (options) => {
    const key = keyFor(options);
    const spare = spares.get(key);
    if (spare && !spare.entry.closed) {
      clearTimeout(spare.timer);
      spares.delete(key);
      return spare.entry;
    }
    discard(key);
    return start(options);
  };

  const run = async ({ prompt, timeoutMs, ...options }) => {
    const entry = take(options);
    // Start the replacement now so it is ready by the time the next decision is asked for.
    warm(options);

    entry.child.stdin.write(`${JSON.stringify({
      type: 'user',
      message: { role: 'user', content: prompt },
    })}\n`);
    entry.child.stdin.end();

    const deadline = Date.now() + timeoutMs;
    try {
      for (;;) {
        const result = resultLine(entry);
        if (result) {
          return result;
        }
        if (entry.closed) {
          const detail = (entry.stderr || entry.stdout).replace(/\s+/g, ' ').trim().slice(0, 300);
          throw new Error(`exit ${entry.exitCode}: ${detail}`);
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new Error(`timed out after ${timeoutMs} ms`);
        }
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, remaining);
          entry.waiters.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
    } finally {
      // The answer is in hand (or the call failed), so do not wait for the
      // CLI's own shutdown, which would add to every decision's latency.
      entry.child.kill('SIGTERM');
    }
  };

  const shutdown = () => {
    for (const key of [...spares.keys()]) {
      discard(key);
    }
  };

  return { run, warm, shutdown };
}
