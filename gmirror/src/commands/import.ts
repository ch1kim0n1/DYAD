/**
 * Import command for GMirror
 * Import rubrics and evaluations
 */

import { Command } from './command-registry.js';

export const importCommand: Command = {
  name: 'import',
  description: 'Import rubrics and evaluations',
  handler: async (args: string[]) => {
    console.log('Import data');
  },
  subcommands: [
    {
      name: 'rubric',
      description: 'Import rubric from file',
      handler: async (args: string[]) => {
        const filepath = args[0];
        if (!filepath) {
          console.error('Error: Missing file path');
          return;
        }
        console.log(`Importing rubric from ${filepath}...`);
      },
    },
    {
      name: 'evaluation',
      description: 'Import evaluation from file',
      handler: async (args: string[]) => {
        const filepath = args[0];
        if (!filepath) {
          console.error('Error: Missing file path');
          return;
        }
        console.log(`Importing evaluation from ${filepath}...`);
      },
    },
  ],
};
