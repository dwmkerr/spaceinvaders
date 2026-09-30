const COMMON = 'Each request gives the game state as JSON and a list of questions. Answer each question using only the state. Reply with the JSON object the schema describes and nothing else.';

const COLUMNS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

// The match's one question, offering only the columns that can still take a
// piece. A model cannot pick an option it is not given, so it cannot make an
// illegal move: the choice is typed to the legal ones, for both models alike.
export function strategicContract(openColumns) {
  return {
    mode: 'strategic',
    system: `You are playing Connect Four by answering a question about the current board. ${COMMON}`,
    questions: {
      move: {
        type: 'choice',
        instructions: 'Pick the column to drop your X into. Take a winning move if there is one. Otherwise block your opponent if they are one move from four in a line. Otherwise build towards a line of your own.',
        criteria: Object.fromEntries(openColumns.map((column) => [
          column,
          `Drop your X into column ${column}.`,
        ])),
      },
    },
  };
}

export function getContract(mode) {
  if (mode === 'strategic') {
    return strategicContract(COLUMNS);
  }
  if (mode !== 'reflexive') {
    throw new Error(`unknown mode: ${mode}`);
  }

  return {
    mode: 'reflexive',
    system: `You are playing Space Invaders by answering questions about the current game state. ${COMMON}`,
    questions: {
      // Each option says when it is the right answer. Without that, live Jev
      // chased targets into bombs with a confidence near zero, and its fire
      // answer sat at 0.5 whatever the state said.
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
  };
}

export function buildSchema(contract) {
  const properties = {};
  for (const [name, question] of Object.entries(contract.questions)) {
    if (question.type === 'choice') {
      properties[name] = {
        type: 'string',
        enum: Object.keys(question.criteria),
      };
    } else if (question.type === 'noul') {
      properties[name] = { type: 'boolean' };
    } else {
      throw new Error(`unknown question type: ${question.type}`);
    }
  }

  return {
    type: 'object',
    properties,
    required: Object.keys(contract.questions),
    additionalProperties: false,
  };
}

export function buildFrontierPrompt(state, contract) {
  const lines = [
    'Game state:',
    JSON.stringify(state, null, 2),
    '',
    'Questions:',
  ];

  for (const [name, question] of Object.entries(contract.questions)) {
    lines.push(`- ${name}: ${question.instructions}`);
    if (question.type === 'choice') {
      lines.push(`  Choose one of: ${Object.keys(question.criteria).join(', ')}`);
      for (const [answer, description] of Object.entries(question.criteria)) {
        lines.push(`    ${answer}: ${description}`);
      }
    } else if (question.type === 'noul') {
      lines.push('  Answer true or false.');
      if (question.criteria) {
        for (const [answer, description] of Object.entries(question.criteria)) {
          lines.push(`    ${answer}: ${description}`);
        }
      }
    } else {
      throw new Error(`unknown question type: ${question.type}`);
    }
  }

  return lines.join('\n');
}
