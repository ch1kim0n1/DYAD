/**
 * Command index for GMirror
 * Registers all available commands
 */

import { registerCommands } from './command-registry.js';
import { initCommand } from './init.js';
import { doctorCommand } from './doctor.js';
import { rubricCommand } from './rubric.js';
import { evaluateCommand } from './evaluate.js';
import { failureModeCommand } from './failure-mode.js';
import { configCommand } from './config.js';
import { serveCommand } from './serve.js';
import { receiptCommand } from './receipt.js';
import { verdictCommand } from './verdict.js';
import { calibrationCommand } from './calibration.js';
import { versionCommand } from './version.js';
import { helpCommand } from './help.js';
import { exportCommand } from './export.js';
import { importCommand } from './import.js';
import { logsCommand } from './logs.js';
import { metricsCommand } from './metrics.js';
import { healthCheckCommand } from './health-check.js';
import { resetCommand } from './reset.js';
import { backupCommand } from './backup.js';
import { validateCommand } from './validate.js';

export function registerAllCommands(): void {
  registerCommands([
    initCommand,
    doctorCommand,
    rubricCommand,
    evaluateCommand,
    failureModeCommand,
    configCommand,
    serveCommand,
    receiptCommand,
    verdictCommand,
    calibrationCommand,
    versionCommand,
    helpCommand,
    exportCommand,
    importCommand,
    logsCommand,
    metricsCommand,
    healthCheckCommand,
    resetCommand,
    backupCommand,
    validateCommand,
  ]);
}
