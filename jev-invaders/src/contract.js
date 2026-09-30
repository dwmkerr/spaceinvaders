const COMMON = 'Each request gives the game state as JSON and a list of questions. Answer each question using only the state. Reply with the JSON object the schema describes and nothing else.';

export function getContract(mode) {
  if (mode === 'strategic') {
    throw new Error('strategic contract not built yet');
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
