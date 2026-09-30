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

test('returns the strategic decision contract', () => {
  assert.deepEqual(getContract('strategic'), {
    mode: 'strategic',
    system: 'You are defending a cannon in a turn-based arena game by answering questions about the current game state. Each request gives the game state as JSON and a list of questions. Answer each question using only the state. Reply with the JSON object the schema describes and nothing else.',
    questions: {
      move: {
        type: 'choice',
        instructions: 'After this turn\'s shot, which way should the cannon turn so it faces the lane that will need it next?',
        criteria: {
          left: 'Quarter turn left: the lane now on your left becomes ahead.',
          right: 'Quarter turn right: the lane now on your right becomes ahead.',
          stay: 'Keep facing the lane ahead.',
        },
      },
      fire: {
        type: 'noul',
        instructions: 'Fire down the lane ahead this turn?',
        criteria: {
          true: 'There is a threat in the lane ahead.',
          false: 'The lane ahead is clear.',
        },
      },
      bomb: {
        type: 'noul',
        instructions: 'Spend one of the scarce smart bombs this turn?',
        criteria: {
          true: 'Threats will reach you faster than single shots can stop them, so a bomb now saves a life.',
          false: 'Single shots can cope for now, so the bomb is worth more later.',
        },
      },
    },
  });
});

test('the strategic schema includes a boolean bomb answer', () => {
  assert.deepEqual(
    buildSchema(getContract('strategic')).properties.bomb,
    { type: 'boolean' },
  );
});
