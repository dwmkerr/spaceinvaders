import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('page has a game canvas per model, one shared board and the module entry point', () => {
  const canvases = page.match(/<canvas\b[^>]*\bwidth="480"[^>]*\bheight="480"[^>]*>/g) ?? [];
  assert.equal(canvases.length, 3);
  assert.match(page, /id="board-canvas"/);
  assert.match(page, /<script\s+type="module"\s+src="src\/main\.js"><\/script>/);
});

test('page uses relative URLs only', () => {
  assert.doesNotMatch(page, /https?:\/\//);
  assert.doesNotMatch(page, /(?:src|href)="\//);
});

test('page offers both game modes', () => {
  assert.match(page, /data-mode="reflexive"[^>]*>System 1 - Reflexive</);
  assert.match(page, /data-mode="strategic"[^>]*>System 2 - Strategic</);
});

test('page is titled Jev Invaders and has start, stop and reset controls', () => {
  assert.match(page, /<title>Jev Invaders<\/title>/);
  assert.match(page, /<h1>Jev Invaders<\/h1>/);
  for (const id of ['start', 'stop', 'reset']) {
    assert.match(page, new RegExp(`<button id="${id}"`));
  }
});

test('each panel has a timeline strip under its game', () => {
  assert.match(page, /id="left-timeline"/);
  assert.match(page, /id="right-timeline"/);
});

test('README gives the local mock URL', () => {
  assert.match(readme, /127\.0\.0\.1:8787/);
  assert.match(readme, /\?mock=1/);
});

test('each model has a named title with a token and a spinner', () => {
  for (const side of ['left', 'right']) {
    assert.match(page, new RegExp(`id="${side}-title"`));
    assert.match(page, new RegExp(`id="${side}-spinner"[^>]*hidden`));
  }
});
