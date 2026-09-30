import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFrontierPrompt,
  buildSchema,
  getContract,
  strategicContract,
} from '../src/contract.js';

test('returns the reflexive decision contract', () => {
  assert.deepEqual(getContract('reflexive'), {
    mode: 'reflexive',
    system: 'You are playing Space Invaders by answering questions about the current game state. Each request gives the game state as JSON and a list of questions. Answer each question using only the state. Reply with the JSON object the schema describes and nothing else.',
    questions: {
      move: {
        type: 'choice',
        instructions: 'Pick the cannon\'s next move. Dodging a bomb matters more than lining up a shot.',
        criteria: {
          left: 'Step one column left. Right when a bomb is close above and the left is clear, or when the nearest invader is to the left and no bomb is close on the left.',
          right: 'Step one column right. Right when a bomb is close above and the right is clear, or when the nearest invader is to the right and no bomb is close on the right.',
          stay: 'Hold position. Right when the nearest invader is directly above and no bomb is close above, or when both sides have a close bomb.',
        },
      },
      fire: {
        type: 'noul',
        instructions: 'Fire a rocket now?',
        criteria: {
          true: 'The rocket is ready and the nearest invader is directly above.',
          false: 'The rocket is in flight, or the nearest invader is not directly above.',
        },
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
- move: Pick the cannon's next move. Dodging a bomb matters more than lining up a shot.
  Choose one of: left, right, stay
    left: Step one column left. Right when a bomb is close above and the left is clear, or when the nearest invader is to the left and no bomb is close on the left.
    right: Step one column right. Right when a bomb is close above and the right is clear, or when the nearest invader is to the right and no bomb is close on the right.
    stay: Hold position. Right when the nearest invader is directly above and no bomb is close above, or when both sides have a close bomb.
- fire: Fire a rocket now?
  Answer true or false.
    true: The rocket is ready and the nearest invader is directly above.
    false: The rocket is in flight, or the nearest invader is not directly above.`,
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

test('the strategic contract asks one question: which column to play', () => {
  const { questions, mode } = getContract('strategic');

  assert.equal(mode, 'strategic');
  assert.deepEqual(Object.keys(questions), ['move']);
  assert.equal(questions.move.type, 'choice');
  assert.deepEqual(Object.keys(questions.move.criteria), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.deepEqual(buildSchema(getContract('strategic')).properties.move, {
    type: 'string',
    enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  });
});

test('the match question offers only the columns that are still open', () => {
  const contract = strategicContract(['b', 'e', 'g']);

  assert.deepEqual(Object.keys(contract.questions.move.criteria), ['b', 'e', 'g']);
  assert.deepEqual(buildSchema(contract).properties.move.enum, ['b', 'e', 'g']);
});
