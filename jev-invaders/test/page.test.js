import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('page has two fixed-size canvases and the module entry point', () => {
  const canvases = page.match(/<canvas\b[^>]*\bwidth="480"[^>]*\bheight="480"[^>]*>/g) ?? [];
  assert.equal(canvases.length, 2);
  assert.match(page, /<script\s+type="module"\s+src="src\/main\.js"><\/script>/);
});

test('page uses relative URLs only', () => {
  assert.doesNotMatch(page, /https?:\/\//);
  assert.doesNotMatch(page, /(?:src|href)="\//);
});

test('page offers both game modes', () => {
  assert.match(page, /System 1 - Reflexive/);
  assert.match(page, /System 2 - Strategic/);
  assert.match(page, /name="mode"/);
});

test('README gives the local mock URL', () => {
  assert.match(readme, /127\.0\.0\.1:8787/);
  assert.match(readme, /\?mock=1/);
});
