import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFrontierPrompt,
  buildSchema,
  getContract,
} from '../src/contract.js';

test('returns the reflexive decision contract', () => {
  assert.deepEqual(getContract('reflexive'), {
    mode: 'reflexive',
    system: 'You are playing Space Invaders by answering questions about the current game state. Each request gives the game state as JSON and a list of questions. Answer each question using only the state. Reply with the JSON object the schema describes and nothing else.',
    questions: {
      move: {
        type: 'choice',
        instructions: 'Move the cannon to survive and line up a shot',
        criteria: {
          left: 'one column left',
          right: 'one column right',
          stay: 'hold position',
        },
      },
      fire: {
        type: 'noul',
        instructions: 'Fire this tick?',
      },
    },
  });
});

test('builds a JSON schema from the contract', () => {
  assert.deepEqual(buildSchema(getContract('reflexive')), {
    type: 'object',
    properties: {
      move: { type: 'string', enum: ['left', 'right', 'stay'] },
      fire: { type: 'boolean' },
    },
    required: ['move', 'fire'],
    additionalProperties: false,
  });
});

test('builds the exact frontier prompt', () => {
  assert.equal(
    buildFrontierPrompt({ a: 'b' }, getContract('reflexive')),
    `Game state:
{
  "a": "b"
}

Questions:
- move: Move the cannon to survive and line up a shot
  Choose one of: left, right, stay
    left: one column left
    right: one column right
    stay: hold position
- fire: Fire this tick?
  Answer true or false.`,
  );
});

test('includes criteria for a noul question', () => {
  const contract = {
    questions: {
      fire: {
        type: 'noul',
        instructions: 'Fire?',
        criteria: {
          true: 'There is a target.',
          false: 'The lane is clear.',
        },
      },
    },
  };

  assert.equal(
    buildFrontierPrompt({ a: 'b' }, contract),
    `Game state:
{
  "a": "b"
}

Questions:
- fire: Fire?
  Answer true or false.
    true: There is a target.
    false: The lane is clear.`,
  );
});

test('strategic contracts are deferred', () => {
  assert.throws(
    () => getContract('strategic'),
    new Error('strategic contract not built yet'),
  );
});
