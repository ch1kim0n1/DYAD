/**
 * Export command for GMirror
 * Export rubrics and evaluations
 */

import { Command } from './command-registry.js';

export const exportCommand: Command = {
  name: 'export',
  description: 'Export rubrics and evaluations',
  handler: async (args: string[]) => {
    console.log('Export data');
  },
  subcommands: [
    {
      name: 'rubric',
      description: 'Export rubric',
      handler: async (args: string[]) => {
        const rubricId = args[0];
        if (!rubricId) {
          console.error('Error: Missing rubric ID');
          return;
        }
        console.log(`Exporting rubric ${rubricId}...`);
      },
    },
    {
      name: 'evaluation',
      description: 'Export evaluation',
      handler: async (args: string[]) => {
        const evalId = args[0];
        if (!evalId) {
          console.error('Error: Missing evaluation ID');
          return;
        }
        console.log(`Exporting evaluation ${evalId}...`);
      },
    },
  ],
};
