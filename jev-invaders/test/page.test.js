import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('page has two fixed-size canvases and the module entry point', () => {
  const canvases = page.match(/<canvas\b[^>]*\bwidth="480"[^>]*\bheight="480"[^>]*>/g) ?? [];
  assert.equal(canvases.length, 2);
  assert.match(page, /<script\s+type="module"\s+src="src\/main\.js"><\/script>/);
});

test('page uses relative URLs only', () => {
  assert.doesNotMatch(page, /https?:\/\//);
  assert.doesNotMatch(page, /(?:src|href)="\//);
});
