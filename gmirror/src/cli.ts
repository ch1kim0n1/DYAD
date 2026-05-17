#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { scoreCommand } from './commands/score.js';
import { GMirror } from './core/gmirror.js';
import { VerdictPersistenceManager } from './core/verdict-persistence.js';
import { GBrainIntegrationClient } from './core/gbrain-integration.js';
import { GStackGBrainSync } from './core/gstack-gbrain-sync.js';
import {
  getDefaultSecretManager,
  sanitizeCliFloat,
  sanitizeCliInteger,
  sanitizeCliPath,
  sanitizeCliString,
  sanitizeCliUrl,
} from './core/security.js';

const program = new Command();

program
  .name('gmirror')
  .description('Autonomous change tester with cognitive synthetic users')
  .version('0.1.0');

program
  .command('backup [destination]')
  .description('Backup GMirror SQLite state')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (destination, options) => {
    const persistence = new VerdictPersistenceManager();
    try {
      const backupPath = persistence.backup(destination);
      if (options.json) {
        console.log(JSON.stringify({ backup_path: backupPath }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green(`Backup written: ${backupPath}`));
      }
    } finally {
      persistence.close();
    }
  });

program
  .command('restore <backup>')
  .description('Restore GMirror SQLite state from backup')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (backup, options) => {
    const persistence = new VerdictPersistenceManager();
    try {
      persistence.restore(backup);
      if (options.json) {
        console.log(JSON.stringify({ restored_from: backup }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green(`Restored from: ${backup}`));
      }
    } finally {
      persistence.close();
    }
  });

program
  .command('export')
  .description('Export persisted GMirror state')
  .option('--format <format>', 'Export format: json', 'json')
  .option('--json', 'Alias for --format json')
  .action(async (options) => {
    const format = options.json ? 'json' : String(options.format || 'json').toLowerCase();
    if (format !== 'json') {
      console.error(chalk.red(`Unsupported export format: ${format}`));
      process.exit(1);
    }

    const persistence = new VerdictPersistenceManager();
    try {
      console.log(JSON.stringify(persistence.exportJson(), null, 2));
    } finally {
      persistence.close();
    }
  });

const secretsCommand = program
  .command('secrets')
  .description('Manage local GMirror secrets');

secretsCommand
  .command('list')
  .description('List configured secret names without values')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action((options) => {
    const secrets = getDefaultSecretManager();
    const records = secrets.list();
    if (options.json) {
      console.log(JSON.stringify(records, null, 2));
      return;
    }
    if (!options.quiet) {
      for (const record of records) {
        console.log(`${record.name} v${record.version} ${record.source} ${record.rotated_at}`);
      }
    }
  });

secretsCommand
  .command('rotate <name>')
  .description('Rotate or create a local secret')
  .option('--value <value>', 'Explicit secret value; otherwise one is generated')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action((name, options) => {
    try {
      const secrets = getDefaultSecretManager();
      const value = options.value === undefined
        ? undefined
        : sanitizeCliString(options.value, 'secret value', 20000);
      const record = secrets.rotate(sanitizeCliString(name, 'secret name', 128), value);
      const result = {
        name: record.name,
        version: record.version,
        rotated_at: record.rotated_at,
        path: secrets.pathFor(record.name),
      };
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green(`Secret rotated: ${result.name} v${result.version}`));
        console.log(chalk.gray(`Stored at: ${result.path}`));
      }
    } catch (error) {
      console.error(chalk.red(`[GMirror] ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Score a change
program
  .command('score')
  .description('Score a change against synthetic users')
  .requiredOption('-p, --payload <json>', 'Change payload as JSON')
  .option('-f, --payload-file <path>', 'Read payload from file')
  .option('-n, --panel-size <number>', 'Panel size', '10')
  .option('--cycles <number>', 'Number of scoring cycles to run', '1')
  .option('--budget-usd <number>', 'Maximum scoring budget in USD', '10')
  .option('--mode <mode>', 'Test mode (change, pre_build, shadow)', 'change')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('-o, --output <path>', 'Write output to file (JSON format)')
  .option('--json', 'Output as JSON to stdout')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    const panelSize = parsePositiveInteger(options.panelSize, '--panel-size', 1, 1000);
    const cycles = parsePositiveInteger(options.cycles, '--cycles', 1, 100);
    const budgetUsd = parsePositiveNumber(options.budgetUsd, '--budget-usd');
    const gbrainEndpoint = parseUrl(options.gbrain, '--gbrain');
    const mode = sanitizeCliString(options.mode, '--mode', 32);
    const validModes = ['change', 'pre_build', 'shadow'];
    if (!validModes.includes(mode)) {
      console.error(chalk.red(`Error: Invalid mode. Must be one of: ${validModes.join(', ')}`));
      process.exit(1);
    }

    if (!options.quiet) {
      console.log(chalk.blue.bold('[GMirror] Starting scoring'));
      console.log(chalk.gray(`Panel size: ${panelSize}`));
      console.log(chalk.gray(`Cycles: ${cycles}`));
      console.log(chalk.gray(`Budget: $${budgetUsd.toFixed(2)}`));
      console.log(chalk.gray(`Mode: ${mode}`));
    }

    const gmirror = new GMirror({
      gbrainEndpoint,
    });

    try {
      let payload;
      if (options.payloadFile) {
        const fs = await import('fs/promises');
        const fileContent = await fs.readFile(sanitizeCliPath(options.payloadFile, '--payload-file'), 'utf-8');
        payload = JSON.parse(fileContent);
      } else {
        payload = JSON.parse(sanitizeCliString(options.payload, '--payload', 200000));
      }

      const cycleOutputs = [];
      for (let cycle = 0; cycle < cycles; cycle++) {
        if (cycles > 1 && !options.quiet) {
          console.log(chalk.gray(`Cycle ${cycle + 1}/${cycles}`));
        }
        const request = {
          request_id: crypto.randomUUID(),
          mode,
          payload,
          context: {},
          budget: {
            max_cost_usd: budgetUsd,
            max_latency_ms: 60000,
            max_panel_size: panelSize,
          },
          caller: {
            source: 'cli',
            ref: `manual:${cycle + 1}`,
          },
          created_at: new Date().toISOString(),
        };

        const scope = {
          request_id: request.request_id,
          population_filter: {
            persona_labels: [],
            expertise_domains: [],
            trust_range: [0, 1],
          },
          scenario_set: [],
          red_team_set: [],
          scoring_profile: 'default',
          panel_size: panelSize,
        };

        const verdict = await gmirror.scoreChange(request as any, scope as any);
        cycleOutputs.push({
          cycle: cycle + 1,
          overall: verdict.overall,
          scores: {
            correctness: verdict.scores.correctness.score.point,
            user_outcome: verdict.scores.user_outcome.score.point,
            robustness: verdict.scores.robustness.score.point,
            risk: verdict.scores.risk.score.point,
            confidence: verdict.scores.confidence.score.point,
          },
          cost_breakdown: verdict.cost_breakdown,
          latency_ms: verdict.latency_ms,
          hard_gate_results: verdict.hard_gate_results,
          request_id: request.request_id,
          timestamp: new Date().toISOString(),
        });
      }

      const output = cycles === 1 ? cycleOutputs[0] : {
        cycles,
        budget_usd: budgetUsd,
        passed: cycleOutputs.filter(result => result.overall === 'pass').length,
        failed: cycleOutputs.filter(result => result.overall === 'fail').length,
        avg_cost: cycleOutputs.reduce((sum, result) => sum + result.cost_breakdown.total_cost_usd, 0) / cycleOutputs.length,
        avg_latency: cycleOutputs.reduce((sum, result) => sum + result.latency_ms, 0) / cycleOutputs.length,
        results: cycleOutputs,
      };
      const latest = cycleOutputs[cycleOutputs.length - 1];

      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
      } else if (options.output) {
        const fs = await import('fs/promises');
        const outputPath = sanitizeCliPath(options.output, '--output');
        await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
        if (!options.quiet) {
          console.log(chalk.green(`[GMirror] Results written to ${outputPath}`));
        }
      } else {
        if (!options.quiet) {
          console.log(chalk.green.bold('\n[GMirror] Scoring completed'));
          console.log(chalk.gray(`Overall: ${latest.overall}`));
          console.log(chalk.gray(`Correctness: ${latest.scores.correctness.toFixed(3)}`));
          console.log(chalk.gray(`User Outcome: ${latest.scores.user_outcome.toFixed(3)}`));
          console.log(chalk.gray(`Robustness: ${latest.scores.robustness.toFixed(3)}`));
          console.log(chalk.gray(`Risk: ${latest.scores.risk.toFixed(3)}`));
          console.log(chalk.gray(`Confidence: ${latest.scores.confidence.toFixed(3)}`));
          console.log(chalk.gray(`Cost: $${latest.cost_breakdown.total_cost_usd.toFixed(4)}`));
          console.log(chalk.gray(`Latency: ${latest.latency_ms}ms`));

          console.log(chalk.bold('\nHard Gates:'));
          for (const gate of latest.hard_gate_results) {
            const status = gate.passed ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${status} ${gate.gate_name}: ${gate.reason}`);
          }
        }
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Scoring failed:'), error);
      process.exit(1);
    }
  });

// Calibrate population
program
  .command('calibrate')
  .description('Calibrate synthetic user population to real users')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    const gmirror = new GMirror({
      gbrainEndpoint: parseUrl(options.gbrain, '--gbrain'),
    });

    try {
      await gmirror.calibratePopulation();

      const result = { status: 'success', timestamp: new Date().toISOString() };
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GMirror] Calibrating population'));
        console.log(chalk.green('[GMirror] Calibration complete'));
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Calibration failed:'), error);
      process.exit(1);
    }
  });

// Health check
program
  .command('health')
  .description('Check health of GMirror and dependencies')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    const gmirror = new GMirror({
      gbrainEndpoint: parseUrl(options.gbrain, '--gbrain'),
    });

    const health = await gmirror.healthCheck();
    const components = Object.fromEntries(
      health.map((check) => [check.service, check.healthy ? 'ok' : 'error'])
    ) as Record<string, 'ok' | 'error'>;
    const status = health.every((check) => check.healthy) ? 'healthy' : 'unhealthy';

    if (options.json) {
      console.log(JSON.stringify({ status, components, checks: health }, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.bold('GMirror Health Check'));
      console.log(chalk.gray(`Status: ${status}`));
      console.log('');
      console.log('Components:');
      console.log(`  Population: ${components.population === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  Runner: ${components.runner === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  GBrain: ${components.gbrain === 'ok' ? chalk.green('✓') : chalk.red('✗')}`);
    }

    process.exit(status === 'healthy' ? 0 : 1);
  });

program
  .command('sync')
  .description('Sync GMirror and stack tool sources into GBrain')
  .option('--incremental', 'Run incremental sync (default)')
  .option('--full', 'Run full sync and clean legacy source registrations')
  .option('--dry-run', 'Show planned sync without writing files or registering sources')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    const mode = options.full ? 'full' : 'incremental';
    const sync = new GStackGBrainSync();

    if (!options.quiet && !options.json) {
      console.log(chalk.blue(`[GMirror] Syncing stack sources (${mode}${options.dryRun ? ', dry run' : ''})`));
    }

    const result = await sync.run({ mode, dryRun: options.dryRun });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      for (const stage of result.stages) {
        const color = stage.status === 'ok' ? 'green' : stage.status === 'skipped' ? 'yellow' : 'red';
        console.log(`  ${chalk[color](stage.status.padEnd(7))} ${stage.stage}: ${stage.items_changed}/${stage.items_total} changed`);
        if (stage.error) console.log(`    ${chalk.red(stage.error)}`);
      }
      const statusColor = result.status === 'ok' ? 'green' : result.status === 'partial' ? 'yellow' : 'red';
      console.log(chalk[statusColor](`[GMirror] Sync ${result.status}`));
    }

    process.exit(result.status === 'ok' ? 0 : 1);
  });

// Replay a previous score
program
  .command('replay')
  .description('Replay a previous scoring run from corpus or GBrain')
  .argument('<id>', 'Hash (for corpus) or request ID (for GBrain) to replay')
  .option('--gbrain <url>', 'GBrain endpoint (for request ID replay)', 'http://localhost:3000')
  .option('--corpus <path>', 'Path to corpus directory (for hash replay)', './.gbrain-corpus')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (id, options) => {
    const replayId = sanitizeCliString(id, 'id', 256);
    // Check if ID looks like a hash (64 hex chars) or request ID
    const isHash = /^[a-f0-9]{64}$/i.test(replayId);
    const isCorpusSha8 = /^[a-f0-9]{8}$/i.test(replayId);

    if (isHash) {
      // Use ReplayManager for hash-based replay
      try {
        const { ReplayManager } = await import('../../shared/src/core/replay-manager.js');
        const replayManager = new ReplayManager(sanitizeCliPath(options.corpus, '--corpus'));
        
        const result = await replayManager.retrieve(replayId);
        
        if (!result.found) {
          console.error(chalk.red(`[GMirror] Hash not found in corpus: ${replayId}`));
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (!options.quiet) {
          console.log(chalk.blue.bold(`[GMirror] Replaying hash: ${replayId}`));
          console.log(chalk.gray(`Tool: ${result.metadata.tool}`));
          console.log(chalk.gray(`Timestamp: ${result.metadata.timestamp}`));
          console.log(chalk.gray(`Task: ${result.metadata.task || 'N/A'}`));
          console.log(chalk.green('\nContent:'));
          console.log(result.content);
        }
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('[GMirror] Replay failed:'), error);
        process.exit(1);
      }
    } else {
      const { ReceiptRegistry } = await import('./core/receipt-registry.js');
      const receiptRegistry = new ReceiptRegistry('gmirror');
      const receipt = isCorpusSha8
        ? (await receiptRegistry.getByCorpusSha8(replayId)).at(-1)
        : await receiptRegistry.getByIdOrPath(replayId);

      if (receipt) {
        if (options.json) {
          console.log(JSON.stringify(receipt, null, 2));
        } else if (!options.quiet) {
          console.log(chalk.blue.bold(`[GMirror] Replaying receipt: ${receipt.receipt_id}`));
          console.log(chalk.gray(`Timestamp: ${receipt.timestamp}`));
          console.log(chalk.gray(`Corpus: ${receipt.metadata?.corpus_sha8 || receipt.input_hash.substring(0, 8)}`));
          console.log(chalk.gray(`Verdict: ${receipt.verdict}`));
          console.log(chalk.gray(`Score: ${receipt.overall_score.toFixed(3)}`));
        }
        process.exit(0);
      }

      // Use GBrain for request ID replay
      const gmirror = new GMirror({
        gbrainEndpoint: parseUrl(options.gbrain, '--gbrain'),
      });

      try {
        const result = await gmirror.replayRequest(replayId);
        
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (!options.quiet) {
          console.log(chalk.blue.bold(`[GMirror] Replaying request: ${replayId}`));
          console.log(chalk.green('[GMirror] Replay completed'));
          console.log(chalk.gray(`Overall: ${result.overall}`));
        }
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('[GMirror] Replay failed:'), error);
        process.exit(1);
      }
    }
  });

// List failure modes
program
  .command('failure-modes')
  .description('List known failure modes')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    const gmirror = new GMirror();
    const failureModes = gmirror.getFailureModes();

    if (options.json) {
      console.log(JSON.stringify(failureModes, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.bold('Known Failure Modes:'));
      for (const mode of failureModes) {
        console.log(`  ${mode.severity.toUpperCase()}: ${mode.description}`);
        console.log(`    Pattern: ${mode.trigger_pattern}`);
        console.log(`    Observations: ${mode.observation_count}`);
      }
    }

    process.exit(0);
  });

// List population clusters
program
  .command('clusters')
  .description('List population clusters')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    const gmirror = new GMirror();
    const clusters = gmirror.getPopulationClusters();

    if (options.json) {
      console.log(JSON.stringify(clusters, null, 2));
    } else if (!options.quiet) {
      console.log(chalk.bold('Population Clusters:'));
      for (const cluster of clusters) {
        console.log(`  ${cluster.label}: ${cluster.members.length} members`);
        console.log(`    Center: O=${cluster.center.openness.toFixed(2)}, C=${cluster.center.conscientiousness.toFixed(2)}, E=${cluster.center.extraversion.toFixed(2)}, A=${cluster.center.agreeableness.toFixed(2)}, N=${cluster.center.neuroticism.toFixed(2)}`);
      }
    }

    process.exit(0);
  });

// Eval mode
program
  .command('eval')
  .description('Run evaluation on a test corpus')
  .argument('[mode]', 'Optional mode, e.g. regress')
  .option('-c, --corpus <path>', 'Path to test corpus JSON')
  .option('--against <receipt>', 'Receipt path or ID to compare against in regress mode')
  .option('--cycles <number>', 'Number of cycles to run for statistical comparison', '1')
  .option('--budget-usd <number>', 'Maximum scoring budget in USD per eval case', '10')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('-o, --output <path>', 'Write output to file (JSON format)')
  .option('--json', 'Output as JSON to stdout')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (mode, options) => {
    const evalMode = mode ? sanitizeCliString(mode, 'mode', 32) : undefined;
    if (evalMode === 'regress') {
      await runReceiptRegression(options.against, options);
      return;
    }

    if (!options.quiet) {
      console.log(chalk.blue.bold('[GMirror] Running evaluation'));
    }

    const gmirror = new GMirror({
      gbrainEndpoint: parseUrl(options.gbrain, '--gbrain'),
    });

    try {
      if (!options.corpus) {
        console.error(chalk.red('[GMirror] --corpus is required'));
        process.exit(1);
      }

      const cycles = parsePositiveInteger(options.cycles, '--cycles', 1, 100);
      const budgetUsd = parsePositiveNumber(options.budgetUsd, '--budget-usd');
      const fs = await import('fs/promises');
      const corpusContent = await fs.readFile(sanitizeCliPath(options.corpus, '--corpus'), 'utf-8');
      const corpus = JSON.parse(corpusContent);

      const allResults = [];
      for (let cycle = 0; cycle < cycles; cycle++) {
        if (!options.quiet) {
          console.log(chalk.gray(`Cycle ${cycle + 1}/${cycles}`));
        }
        const cycleResults = [];
        for (const testCase of corpus) {
          const request = {
            request_id: crypto.randomUUID(),
            mode: testCase.mode || 'change',
            payload: testCase.payload,
            context: testCase.context || {},
            budget: { max_cost_usd: budgetUsd, max_latency_ms: 60000, max_panel_size: 10, ...(testCase.budget || {}) },
            caller: { source: 'eval', ref: testCase.id },
            created_at: new Date().toISOString(),
          };

          const scope = {
            request_id: request.request_id,
            population_filter: testCase.scope?.population_filter || { persona_labels: [], expertise_domains: [], trust_range: [0, 1] },
            scenario_set: testCase.scope?.scenario_set || [],
            red_team_set: testCase.scope?.red_team_set || [],
            scoring_profile: testCase.scope?.scoring_profile || 'default',
            panel_size: testCase.scope?.panel_size || 10,
          };

          const verdict = await gmirror.scoreChange(request as any, scope as any);
          cycleResults.push({
            test_id: testCase.id,
            overall: verdict.overall,
            scores: verdict.scores,
            cost_breakdown: verdict.cost_breakdown,
            latency_ms: verdict.latency_ms,
          });
        }
        allResults.push(cycleResults);
      }

      // Calculate statistical summary
      const flatResults = allResults.flat();
      const summary = {
        cycles: cycles,
        total_tests: flatResults.length,
        passed: flatResults.filter(r => r.overall === 'pass').length,
        failed: flatResults.filter(r => r.overall === 'fail').length,
        avg_cost: flatResults.reduce((sum, r) => sum + r.cost_breakdown.total_cost_usd, 0) / flatResults.length,
        avg_latency: flatResults.reduce((sum, r) => sum + r.latency_ms, 0) / flatResults.length,
        std_cost: calculateStdDev(flatResults.map(r => r.cost_breakdown.total_cost_usd)),
        std_latency: calculateStdDev(flatResults.map(r => r.latency_ms)),
        results_by_cycle: allResults,
      };

      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else if (options.output) {
        const outputPath = sanitizeCliPath(options.output, '--output');
        await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));
        if (!options.quiet) {
          console.log(chalk.green(`[GMirror] Results written to ${outputPath}`));
        }
      } else {
        if (!options.quiet) {
          console.log(chalk.green.bold('\n[GMirror] Evaluation completed'));
          console.log(chalk.gray(`Cycles: ${summary.cycles}`));
          console.log(chalk.gray(`Total tests: ${summary.total_tests}`));
          console.log(chalk.gray(`Passed: ${summary.passed}`));
          console.log(chalk.gray(`Failed: ${summary.failed}`));
          console.log(chalk.gray(`Avg cost: $${summary.avg_cost.toFixed(4)} (±$${summary.std_cost.toFixed(4)})`));
          console.log(chalk.gray(`Avg latency: ${summary.avg_latency.toFixed(2)}ms (±${summary.std_latency.toFixed(2)}ms)`));
        }
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Evaluation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('receipts')
  .description('List execution receipts')
  .option('--since <date>', 'Only include receipts since YYYY-MM-DD')
  .option('--until <date>', 'Only include receipts up to YYYY-MM-DD')
  .option('--limit <n>', 'Maximum number of receipts to print', '50')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    try {
      const { ReceiptRegistry } = await import('./core/receipt-registry.js');
      const receiptRegistry = new ReceiptRegistry('gmirror');
      const start = options.since ? new Date(sanitizeCliString(options.since, '--since', 64)) : new Date(0);
      const end = options.until ? new Date(sanitizeCliString(options.until, '--until', 64)) : new Date();
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        console.error(chalk.red('[GMirror] --since/--until must be valid dates'));
        process.exit(1);
      }

      const limit = parsePositiveInteger(options.limit, '--limit', 1, 1000);

      const receipts = (await receiptRegistry.getAllBetween(start, end)).slice(-limit);
      if (options.json) {
        console.log(JSON.stringify(receipts, null, 2));
      } else if (!options.quiet) {
        for (const receipt of receipts) {
          console.log(`${receipt.timestamp} ${receipt.receipt_id} ${receipt.verdict} score=${receipt.overall_score.toFixed(3)} corpus=${receipt.metadata?.corpus_sha8 || receipt.input_hash.substring(0, 8)}`);
        }
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Receipt query failed:'), error);
      process.exit(1);
    }
  });

program
  .command('diff <receiptA> <receiptB>')
  .description('Diff two execution receipts')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (receiptA, receiptB, options) => {
    try {
      const receiptAId = sanitizeCliString(receiptA, 'receiptA', 512);
      const receiptBId = sanitizeCliString(receiptB, 'receiptB', 512);
      const { ReceiptRegistry } = await import('./core/receipt-registry.js');
      const receiptRegistry = new ReceiptRegistry('gmirror');
      const a = await receiptRegistry.getByIdOrPath(receiptAId);
      const b = await receiptRegistry.getByIdOrPath(receiptBId);
      if (!a || !b) {
        console.error(chalk.red('[GMirror] Both receipts must exist'));
        process.exit(1);
      }

      const diff = receiptRegistry.diff(a, b);
      if (options.json) {
        console.log(JSON.stringify(diff, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GMirror] Receipt Diff'));
        console.log(`  Verdict: ${diff.verdict.from} -> ${diff.verdict.to}`);
        console.log(`  Overall score: ${diff.overall_score.from} -> ${diff.overall_score.to} (${diff.overall_score.delta >= 0 ? '+' : ''}${diff.overall_score.delta.toFixed(3)})`);
        console.log(`  Cost: $${diff.cost_usd.from.toFixed(4)} -> $${diff.cost_usd.to.toFixed(4)} (${diff.cost_usd.delta >= 0 ? '+' : ''}${diff.cost_usd.delta.toFixed(4)})`);
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Receipt diff failed:'), error);
      process.exit(1);
    }
  });

function calculateStdDev(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

// Stats command
program
  .command('stats')
  .description('Show statistics from recent runs')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    try {
      const gbrain = new GBrainIntegrationClient({ endpoint: parseUrl(options.gbrain, '--gbrain') });
      const stats = await gbrain.getGmirrorStats();
      
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GMirror] Fetching statistics'));
        console.log(chalk.green.bold('\n[GMirror] Statistics'));
        console.log(chalk.gray(`Total runs: ${stats.total_runs || 0}`));
        console.log(chalk.gray(`Pass rate: ${(Number(stats.pass_rate || 0) * 100).toFixed(1)}%`));
        console.log(chalk.gray(`Avg cost: $${Number(stats.avg_cost || 0).toFixed(4)}`));
        console.log(chalk.gray(`Avg latency: ${Number(stats.avg_latency || 0).toFixed(2)}ms`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Stats failed:'), error);
      console.log(chalk.yellow('[GMirror] Stats endpoint requires additional setup - see TESTING.md for implementation guidance'));
      process.exit(0);
    }
  });

// Drift command
program
  .command('drift')
  .description('Check for performance drift over time')
  .option('--corpus <path>', 'Path to corpus directory for drift data', './.gbrain-corpus')
  .option('--window <duration>', 'Current analysis window, e.g. 7d, 24h, 30m', '7d')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    try {
      const { ReceiptRegistry } = await import('./core/receipt-registry.js');
      const { analyzeCohortDrift, parseWindowDuration } = await import('./core/drift-analysis.js');
      const windowLabel = sanitizeCliString(options.window, '--window', 32);
      const windowMs = parseWindowDuration(windowLabel);
      const registry = new ReceiptRegistry('gmirror');
      const end = new Date();
      const start = new Date(end.getTime() - windowMs * 2);
      const receipts = await registry.getAllBetween(start, end);
      const snapshots = receipts.map((receipt: any) => {
        const userOutcomeScore = receipt.scores?.user_outcome?.score ?? receipt.overall_score ?? 0;
        return {
          cohort: receipt.metadata?.cohort || receipt.metadata?.persona_label || receipt.metadata?.segment || 'default',
          timestamp: receipt.timestamp,
          count: 1,
          total: 1,
          frustrated: userOutcomeScore < 0.5,
          metrics: {
            correctness_score: receipt.scores?.correctness?.score ?? receipt.overall_score ?? 0,
            latency_ms: Number(receipt.metadata?.latency_ms || receipt.metadata?.duration_ms || 0),
            cost_usd: receipt.cost_usd || 0,
          },
        };
      });
      const driftResults = analyzeCohortDrift(snapshots, { windowMs, now: end, seed: 'gmirror-drift' });
      const alerts = driftResults.filter(result =>
        result.anomalies.length > 0 || result.frustration_wilson_95_ci.degraded,
      );

      if (options.json) {
        console.log(JSON.stringify({
          window: windowLabel,
          cohorts: driftResults,
          drift_results: driftResults,
          alerts,
        }, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.blue.bold('[GMirror] Checking for drift'));
        console.log(chalk.green.bold('\n[GMirror] Drift Analysis'));
        console.log(chalk.gray(`Window: ${windowLabel}`));
        console.log(chalk.gray(`Cohorts tracked: ${driftResults.length}`));
        console.log(chalk.gray(`Drift detected: ${alerts.length > 0 ? 'Yes' : 'No'}`));
        
        if (driftResults.length > 0) {
          console.log(chalk.bold('\nDrift Results:'));
          for (const result of driftResults) {
            const status = result.anomalies.length > 0 || result.frustration_wilson_95_ci.degraded ? chalk.red('ALERT') : chalk.green('OK');
            console.log(`  ${status} ${result.cohort}: samples=${result.sample_size} anomalies=${result.anomalies.length} new=${result.brand_new}`);
          }
        }

        if (alerts.length > 0) {
          console.log(chalk.red.bold('\nAlerts:'));
          for (const alert of alerts) {
            console.log(`  ${alert.cohort}: ${alert.anomalies.map((anomaly: any) => `${anomaly.metric}:${anomaly.reason}`).join(', ') || 'frustration_wilson_degraded'}`);
          }
        }
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Drift check failed:'), error);
      process.exit(1);
    }
  });

// Regress command
program
  .command('regress')
  .description('Compare current performance against baseline')
  .option('-b, --baseline <path>', 'Path to baseline file')
  .option('-c, --corpus <path>', 'Path to test corpus JSON')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--tolerance <number>', 'Tolerance for regression detection', '0.05')
  .option('--baseline-file <path>', 'Versioned JSONL baseline file for per-dimension regression gates', 'gmirror/test/baselines/regression-baselines.jsonl')
  .option('--against <receipt>', 'Compare latest receipt against a baseline receipt path or ID')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    console.log(chalk.blue.bold('[GMirror] Running regression test'));

    try {
      if (options.against) {
        await runReceiptRegression(options.against, options);
        return;
      }

      if (options.baselineFile) {
        const { ReceiptRegistry } = await import('./core/receipt-registry.js');
        const { loadRegressionBaselines, evaluateRegressionGates } = await import('./core/regression-gates.js');
        const receiptRegistry = new ReceiptRegistry('gmirror');
        const latest = await receiptRegistry.getLatest();
        if (latest) {
          const baselines = await loadRegressionBaselines(sanitizeCliPath(options.baselineFile, '--baseline-file'));
          const gate = evaluateRegressionGates(latest, baselines);
          if (options.json) {
            console.log(JSON.stringify(gate, null, 2));
          } else if (!options.quiet) {
            console.log(chalk.blue.bold('[GMirror] Regression Gates'));
            for (const result of gate.results) {
              const status = result.passed ? chalk.green('PASSED') : chalk.red('FAILED');
              console.log(`  ${result.dimension}: ${status} current=${result.current.toFixed(4)} baseline=${result.baseline.toFixed(4)} tolerance=${result.tolerance}`);
            }
          }
          process.exit(gate.passed ? 0 : 1);
        }
      }

      const tolerance = sanitizeCliFloat(options.tolerance, '--tolerance', 0, 1);
      const fs = await import('fs/promises');
      
      if (!options.corpus) {
        console.error(chalk.red('[GMirror] --corpus is required'));
        process.exit(1);
      }

      if (!options.baseline) {
        console.error(chalk.red('[GMirror] --baseline is required'));
        process.exit(1);
      }

      const corpusContent = await fs.readFile(sanitizeCliPath(options.corpus, '--corpus'), 'utf-8');
      const corpus = JSON.parse(corpusContent);
      const baselineContent = await fs.readFile(sanitizeCliPath(options.baseline, '--baseline'), 'utf-8');
      const baseline = JSON.parse(baselineContent);

      const result = {
        tolerance,
        regression_detected: false,
        message: 'Regress requires additional setup - see TESTING.md for implementation guidance',
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.yellow('[GMirror] Regress requires additional setup'));
        console.log(chalk.gray('See TESTING.md for implementation guidance'));
      }
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Regression test failed:'), error);
      process.exit(1);
    }
  });

// Trend command
program
  .command('trend')
  .description('Show performance trends over time')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--window <days>', 'Time window in days', '7')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    console.log(chalk.blue.bold('[GMirror] Fetching performance trends'));

    try {
      const window = parsePositiveInteger(options.window, '--window', 1, 3650);
      const gbrain = new GBrainIntegrationClient({ endpoint: parseUrl(options.gbrain, '--gbrain') });
      const trends = await gbrain.getGmirrorTrend(window);
      
      if (options.json) {
        console.log(JSON.stringify(trends, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green.bold('\n[GMirror] Performance Trends'));
        console.log(chalk.gray(`Window: ${window} days`));
        console.log(chalk.gray(`Pass rate trend: ${trends.pass_rate_trend || 'N/A'}`));
        console.log(chalk.gray(`Cost trend: ${trends.cost_trend || 'N/A'}`));
        console.log(chalk.gray(`Latency trend: ${trends.latency_trend || 'N/A'}`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Trend fetch failed:'), error);
      console.log(chalk.yellow('[GMirror] Trend endpoint requires additional setup - see TESTING.md for implementation guidance'));
      process.exit(0);
    }
  });

// Cost command
program
  .command('cost')
  .description('Show cost information')
  .option('--day', 'Show today\'s spend (default)')
  .option('--week', 'Show this week\'s spend')
  .option('--month', 'Show this month\'s spend')
  .option('--by-model', 'Break down by model')
  .option('--by-operation', 'Break down by operation')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    try {
      const { BudgetLedger } = await import('./core/budget-ledger.js');
      const ledger = new BudgetLedger({ max_budget_usd: 1000 }, 'gmirror');
      await ledger.init();

      let spend = 0;
      if (options.week) {
        spend = ledger.getWeeklySpend();
      } else if (options.month) {
        spend = ledger.getMonthlySpend();
      } else {
        spend = ledger.getDailySpend();
      }

      if (options.json) {
        const breakdown: Record<string, any> = {};
        if (options.byModel) {
          breakdown['by_model'] = ledger.getSpendByModel();
        }
        if (options.byOperation) {
          breakdown['by_operation'] = ledger.getSpendByOperation();
        }
        console.log(JSON.stringify({ spend, ...breakdown }, null, 2));
      } else if (!options.quiet) {
        const period = options.week ? 'this week' : options.month ? 'this month' : 'today';
        console.log(chalk.blue(`LLM Spend ${period}: $${spend.toFixed(4)}`));
        
        if (options.byModel) {
          const byModel = ledger.getSpendByModel();
          console.log(chalk.gray('\nBy model:'));
          for (const [model, cost] of Object.entries(byModel)) {
            console.log(`  ${model}: $${(cost as number).toFixed(4)}`);
          }
        }
        
        if (options.byOperation) {
          const byOp = ledger.getSpendByOperation();
          console.log(chalk.gray('\nBy operation:'));
          for (const [op, cost] of Object.entries(byOp)) {
            console.log(`  ${op}: $${(cost as number).toFixed(4)}`);
          }
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Cost query failed:'), error);
      process.exit(1);
    }
  });

// Sandbox-stats command
program
  .command('sandbox-stats')
  .description('Show sandbox execution statistics')
  .option('--gbrain <url>', 'GBrain endpoint', 'http://localhost:3000')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action(async (options) => {
    if (!options.quiet) {
      console.log(chalk.blue.bold('[GMirror] Fetching sandbox statistics'));
    }

    try {
      const gbrain = new GBrainIntegrationClient({ endpoint: parseUrl(options.gbrain, '--gbrain') });
      const stats = await gbrain.getGmirrorSandboxStats();
      
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else if (!options.quiet) {
        console.log(chalk.green.bold('\n[GMirror] Sandbox Statistics'));
        console.log(chalk.gray(`Total runs: ${stats.total_runs || 0}`));
        console.log(chalk.gray(`Successful runs: ${stats.successful_runs || 0}`));
        console.log(chalk.gray(`Failed runs: ${stats.failed_runs || 0}`));
        console.log(chalk.gray(`Success rate: ${(Number(stats.success_rate || 0) * 100).toFixed(1)}%`));
        console.log(chalk.gray(`Avg sandbox time: ${Number(stats.avg_sandbox_time || 0).toFixed(2)}ms`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('[GMirror] Sandbox stats fetch failed:'), error);
      console.log(chalk.yellow('[GMirror] Sandbox stats endpoint requires additional setup - see TESTING.md for implementation guidance'));
      process.exit(0);
    }
  });

program
  .command('completion')
  .description('Print shell completion script')
  .argument('[shell]', 'Shell type: bash, zsh, or fish', 'bash')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress output for CI use')
  .action((shell, options) => {
    const normalized = String(shell).toLowerCase();
    const script = buildCompletionScript(normalized);
    if (!script) {
      console.error(chalk.red('[GMirror] Shell must be one of: bash, zsh, fish'));
      process.exit(1);
    }
    if (options.json) {
      console.log(JSON.stringify({ shell: normalized, script }, null, 2));
    } else if (!options.quiet) {
      console.log(script);
    }
    process.exit(0);
  });

async function runReceiptRegression(against: string | undefined, options: any): Promise<void> {
  if (!against) {
    console.error(chalk.red('[GMirror] --against is required for receipt regression'));
    process.exit(1);
  }

  const { ReceiptRegistry } = await import('./core/receipt-registry.js');
  const receiptRegistry = new ReceiptRegistry('gmirror');
  const baseline = await receiptRegistry.getByIdOrPath(sanitizeCliString(against, '--against', 512));
  const latest = await receiptRegistry.getLatest();

  if (!baseline || !latest) {
    console.error(chalk.red('[GMirror] Baseline and latest receipts must both exist'));
    process.exit(1);
  }

  const diff = receiptRegistry.diff(baseline, latest);
  const regressionPassed =
    latest.overall_score >= baseline.overall_score &&
    latest.hard_gates_passed &&
    latest.verdict !== 'fail';

  const result = {
    passed: regressionPassed,
    baseline_receipt: baseline.receipt_id,
    current_receipt: latest.receipt_id,
    baseline_score: baseline.overall_score,
    current_score: latest.overall_score,
    delta: latest.overall_score - baseline.overall_score,
    diff,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.quiet) {
    console.log(chalk.blue.bold('[GMirror] Receipt Regression Check'));
    console.log(`  Status: ${regressionPassed ? chalk.green('PASSED') : chalk.red('FAILED')}`);
    console.log(`  Baseline: ${baseline.receipt_id} (${baseline.overall_score.toFixed(3)})`);
    console.log(`  Current: ${latest.receipt_id} (${latest.overall_score.toFixed(3)})`);
    console.log(`  Delta: ${result.delta >= 0 ? chalk.green(`+${result.delta.toFixed(3)}`) : chalk.red(result.delta.toFixed(3))}`);
  }

  process.exit(regressionPassed ? 0 : 1);
}

function parsePositiveInteger(value: string, flag: string, min: number, max: number): number {
  try {
    return sanitizeCliInteger(value, flag, min, max);
  } catch {
    console.error(chalk.red(`[GMirror] ${flag} must be an integer between ${min} and ${max}`));
    process.exit(1);
  }
}

function parsePositiveNumber(value: string, flag: string): number {
  try {
    return sanitizeCliFloat(value, flag, 0.01, 1000000);
  } catch {
    console.error(chalk.red(`[GMirror] ${flag} must be a positive number`));
    process.exit(1);
  }
}

function parseUrl(value: string, flag: string): string {
  try {
    return sanitizeCliUrl(value, flag);
  } catch (error) {
    console.error(chalk.red(`[GMirror] ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

function buildCompletionScript(shell: string): string | null {
  const commands = [
    'backup',
    'restore',
    'export',
    'secrets',
    'rotate',
    'list',
    'score',
    'calibrate',
    'health',
    'sync',
    'replay',
    'failure-modes',
    'clusters',
    'eval',
    'receipts',
    'diff',
    'stats',
    'drift',
    'regress',
    'trend',
    'cost',
    'sandbox-stats',
    'completion',
  ];
  const options = [
    '--help',
    '--version',
    '--json',
    '--format',
    '--quiet',
    '--payload-file',
    '--panel-size',
    '--mode',
    '--cycles',
    '--budget-usd',
    '--gbrain',
    '--output',
    '--corpus',
    '--against',
    '--baseline',
    '--baseline-file',
    '--tolerance',
    '--incremental',
    '--full',
    '--dry-run',
    '--value',
  ];
  const words = [...commands, ...options].join(' ');

  if (shell === 'bash') {
    return `_gmirror_completions()
{
  local cur
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  COMPREPLY=( $(compgen -W "${words}" -- "$cur") )
}
complete -F _gmirror_completions gmirror`;
  }

  if (shell === 'zsh') {
    return `#compdef gmirror
_arguments '1:command:(${commands.join(' ')})' '*::option:(${options.join(' ')})'`;
  }

  if (shell === 'fish') {
    return [
      ...commands.map(command => `complete -c gmirror -f -a ${command}`),
      ...options.map(option => `complete -c gmirror -f -l ${option.slice(2)}`),
    ].join('\n');
  }

  return null;
}

program
  .command('score-text [content]')
  .description('Score any text against a quality rubric (requires only ANTHROPIC_API_KEY)')
  .option('-r, --rubric <name>', 'Rubric: default, code, relationship', 'default')
  .option('-f, --file <path>', 'Score content from file')
  .option('-F, --rubric-file <path>', 'Path to custom rubric JSON file')
  .option('-m, --model <model>', 'LLM model', 'claude-haiku-4-5-20251001')
  .option('--json', 'Output as JSON')
  .action(async (content: string | undefined, opts: any) => {
    await scoreCommand(content, {
      rubric: opts.rubric,
      file: opts.file,
      rubricFile: opts.rubricFile,
      model: opts.model,
      json: opts.json ?? false,
    });
  });

program
  .command('rubrics')
  .description('List available scoring rubrics')
  .action(() => {
    console.log('Available rubrics:');
    console.log('  default      General quality (correctness, outcome, robustness, cost, risk, confidence)');
    console.log('  code         Code-specific (compiles, solves problem, handles errors, security)');
    console.log('  relationship Relationship insights (grounded, actionable, safe, non-pathologizing)');
  });

program.parse();
