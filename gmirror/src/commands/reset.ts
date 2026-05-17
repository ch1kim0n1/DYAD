/**
 * Reset command for GMirror
 * Reset state and configuration
 */

import { Command } from './command-registry.js';

export const resetCommand: Command = {
  name: 'reset',
  description: 'Reset GMirror state and configuration',
  handler: async (args: string[]) => {
    console.log('Reset GMirror');
  },
  subcommands: [
    {
      name: 'state',
      description: 'Reset state storage',
      handler: async () => {
        console.log('Resetting state storage...');
      },
    },
    {
      name: 'config',
      description: 'Reset configuration to defaults',
      handler: async () => {
        console.log('Resetting configuration...');
      },
    },
  ],
};
