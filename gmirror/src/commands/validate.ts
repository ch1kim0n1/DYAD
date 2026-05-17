/**
 * Validate command for GMirror
 * Validate rubrics and evaluations
 */

import { Command } from './command-registry.js';

export const validateCommand: Command = {
  name: 'validate',
  description: 'Validate rubrics and evaluations',
  handler: async (args: string[]) => {
    console.log('Validation');
  },
  subcommands: [
    {
      name: 'rubric',
      description: 'Validate a rubric',
      handler: async (args: string[]) => {
        const rubricId = args[0];
        if (!rubricId) {
          console.error('Error: Missing rubric ID');
          return;
        }
        console.log(`Validating rubric ${rubricId}...`);
      },
    },
    {
      name: 'all',
      description: 'Validate all rubrics',
      handler: async () => {
        console.log('Validating all rubrics...');
      },
    },
  ],
};
