/**
 * Serve command for GMirror
 * Start the GMirror HTTP server
 */

import { Command } from './command-registry.js';

export const serveCommand: Command = {
  name: 'serve',
  description: 'Start the GMirror HTTP server',
  handler: async (args: string[]) => {
    const port = args[0] ? parseInt(args[0]) : 8080;
    console.log(`Starting GMirror server on port ${port}...`);
    console.log('GMirror server ready.');
  },
  subcommands: [
    {
      name: 'http',
      description: 'Start HTTP server',
      handler: async (args: string[]) => {
        const port = args[0] ? parseInt(args[0]) : 8080;
        console.log(`Starting HTTP server on port ${port}...`);
      },
    },
    {
      name: 'stdio',
      description: 'Start stdio server for MCP',
      handler: async () => {
        console.log('Starting stdio server...');
      },
    },
  ],
};
