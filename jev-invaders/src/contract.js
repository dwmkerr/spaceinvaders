const COMMON = 'Each request gives the game state as JSON and a list of questions. Answer each question using only the state. Reply with the JSON object the schema describes and nothing else.';

export function getContract(mode) {
  if (mode === 'strategic') {
    return {
      mode: 'strategic',
      system: `You are defending a cannon in a turn-based arena game by answering questions about the current game state. ${COMMON}`,
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
    };
  }
  if (mode !== 'reflexive') {
    throw new Error(`unknown mode: ${mode}`);
  }

  return {
    mode: 'reflexive',
    system: `You are playing Space Invaders by answering questions about the current game state. ${COMMON}`,
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
