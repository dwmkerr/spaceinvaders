import assert from 'node:assert/strict';
import test from 'node:test';

import { controlState } from '../src/run-control.js';

test('a fresh run can only be started', () => {
  assert.deepEqual(controlState(['idle', 'idle']), {
    canStart: true,
    canStop: false,
    canReset: false,
    canSwitchMode: true,
  });
});

test('a running run can be stopped or reset but not restarted or switched', () => {
  assert.deepEqual(controlState(['running', 'running']), {
    canStart: false,
    canStop: true,
    canReset: true,
    canSwitchMode: false,
  });
  // One panel finishing early does not unlock anything while the other plays on.
  assert.equal(controlState(['over', 'running']).canSwitchMode, false);
  assert.equal(controlState(['over', 'running']).canStop, true);
});

test('a stopped run can be resumed, reset or switched', () => {
  assert.deepEqual(controlState(['stopped', 'stopped']), {
    canStart: true,
    canStop: false,
    canReset: true,
    canSwitchMode: true,
  });
});

test('a finished run can only be reset or switched', () => {
  assert.deepEqual(controlState(['over', 'capped']), {
    canStart: false,
    canStop: false,
    canReset: true,
    canSwitchMode: true,
  });
});
