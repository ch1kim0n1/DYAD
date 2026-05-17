/**
 * Command index for Orchestrator
 * Registers all available commands
 */

import { registerCommands } from './command-registry.js';
import { initCommand } from './init.js';
import { doctorCommand } from './doctor.js';
import { workflowCommand } from './workflow.js';
import { pipelineCommand } from './pipeline.js';
import { jobCommand } from './job.js';
import { configCommand } from './config.js';
import { serveCommand } from './serve.js';
import { versionCommand } from './version.js';
import { helpCommand } from './help.js';
import { exportCommand } from './export.js';
import { importCommand } from './import.js';
import { logsCommand } from './logs.js';
import { metricsCommand } from './metrics.js';
import { healthCheckCommand } from './health-check.js';
import { resetCommand } from './reset.js';
import { backupCommand } from './backup.js';

export function registerAllCommands(): void {
  registerCommands([
    initCommand,
    doctorCommand,
    workflowCommand,
    pipelineCommand,
    jobCommand,
    configCommand,
    serveCommand,
    versionCommand,
    helpCommand,
    exportCommand,
    importCommand,
    logsCommand,
    metricsCommand,
    healthCheckCommand,
    resetCommand,
    backupCommand,
  ]);
}
