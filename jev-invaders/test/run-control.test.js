import assert from 'node:assert/strict';
import test from 'node:test';

import { createRunControl } from '../src/run-control.js';

test('alternates between starting and building a fresh run', () => {
  let builds = 0;
  let starts = 0;
  const control = createRunControl({
    build() {
      builds += 1;
    },
    start() {
      starts += 1;
    },
  });

  control.click();
  assert.equal(starts, 1);
  assert.equal(builds, 0);
  assert.equal(control.isStarted(), true);

  control.click();
  assert.equal(builds, 1);
  assert.equal(starts, 1);
  assert.equal(control.isStarted(), false);

  control.click();
  assert.equal(starts, 2);
});
