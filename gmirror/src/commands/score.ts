import * as fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';

export interface ScoreOptions {
  rubric: string;
  file?: string;
  rubricFile?: string;
  model: string;
  json: boolean;
}

const RUBRICS: Record<string, string> = {
  default: `Score the content on these 6 dimensions (each 0.0–1.0):
1. correctness: Factually accurate and logically sound?
2. user_outcome: Achieves the user's goal?
3. robustness: Handles edge cases and failure modes?
4. cost_efficiency: Appropriately concise, not verbose?
5. risk: Free of harmful/dangerous/unethical content? (1.0 = no risk)
6. confidence: Your confidence in this scoring?

Verdict is "pass" if all dimensions ≥ 0.5 AND risk ≥ 0.8, else "fail".
Return ONLY this JSON (no markdown, no explanation):
{"correctness":0.9,"user_outcome":0.8,"robustness":0.7,"cost_efficiency":0.9,"risk":1.0,"confidence":0.85,"verdict":"pass","reasoning":"one sentence"}`,

  code: `Score this code on 6 dimensions (each 0.0–1.0):
1. correctness: Compiles/parses and implements the intent correctly?
2. user_outcome: Solves the stated problem?
3. robustness: Handles errors, edge cases, null inputs?
4. cost_efficiency: Readable and not over-engineered?
5. risk: Free of security vulnerabilities (injection, XSS, etc.)? (1.0 = safe)
6. confidence: Confidence in this assessment?

Verdict is "pass" if all ≥ 0.5 AND risk ≥ 0.8, else "fail".
Return ONLY this JSON:
{"correctness":0.9,"user_outcome":0.8,"robustness":0.7,"cost_efficiency":0.9,"risk":1.0,"confidence":0.85,"verdict":"pass","reasoning":"one sentence"}`,

  relationship: `Score this relationship insight on 6 dimensions (each 0.0–1.0):
1. correctness: Grounded in what the conversation actually shows?
2. user_outcome: Actionable and helpful to the person seeking insight?
3. robustness: Avoids over-generalizing from limited data?
4. cost_efficiency: Appropriately concise?
5. risk: Avoids pathologizing, blame-assignment, or crisis-level content? (1.0 = safe)
6. confidence: Confidence in this scoring?

Verdict is "pass" if all ≥ 0.5 AND risk ≥ 0.8, else "fail".
Return ONLY this JSON:
{"correctness":0.9,"user_outcome":0.8,"robustness":0.7,"cost_efficiency":0.9,"risk":1.0,"confidence":0.85,"verdict":"pass","reasoning":"one sentence"}`,
};

const DIMENSIONS = ['correctness', 'user_outcome', 'robustness', 'cost_efficiency', 'risk', 'confidence'] as const;

export async function scoreCommand(content: string | undefined, options: ScoreOptions): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY not set'));
    process.exit(1);
  }

  let text = content;
  if (!text && options.file) {
    text = fs.readFileSync(options.file, 'utf-8');
  }
  if (!text) {
    // Try reading from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    text = Buffer.concat(chunks).toString('utf-8');
  }
  if (!text?.trim()) {
    console.error(chalk.red('No content to score. Pass text directly, use --file, or pipe via stdin.'));
    console.error('Example: gmirror score-text "your content here"');
    console.error('Example: echo "content" | gmirror score-text --rubric code');
    process.exit(1);
  }

  let rubricPrompt = RUBRICS[options.rubric] ?? RUBRICS['default']!;

  // Custom rubric file overrides built-in rubric
  if (options.rubricFile) {
    if (!fs.existsSync(options.rubricFile)) {
      console.error(chalk.red(`Rubric file not found: ${options.rubricFile}`));
      process.exit(1);
    }
    const raw = fs.readFileSync(options.rubricFile, 'utf-8');
    let custom: { prompt?: string; dimensions?: string[] };
    try {
      custom = JSON.parse(raw);
    } catch {
      console.error(chalk.red(`Invalid JSON in rubric file: ${options.rubricFile}`));
      process.exit(1);
    }
    if (!custom.prompt) {
      console.error(chalk.red('Rubric file must have a "prompt" field'));
      process.exit(1);
    }
    rubricPrompt = custom.prompt;
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: options.model,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `${rubricPrompt}\n\nContent to score:\n---\n${text.slice(0, 8000)}\n---`,
    }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(chalk.red('Error: model response did not contain valid JSON'));
    if (!options.json) console.error('Raw response:', raw);
    process.exit(1);
  }

  const result = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const overall = DIMENSIONS.reduce((sum, d) => sum + ((result[d] as number) ?? 0), 0) / DIMENSIONS.length;

  // Cost tracking
  const MODEL_COSTS: Record<string, [number, number]> = {
    'claude-haiku-4-5-20251001': [0.25, 1.25],
    'claude-3-5-haiku-20241022': [0.25, 1.25],
    'claude-sonnet-4-6': [3.0, 15.0],
    'claude-3-5-sonnet-20241022': [3.0, 15.0],
    'claude-opus-4-6': [15.0, 75.0],
  };
  const [inRate, outRate] = MODEL_COSTS[options.model] ?? [3.0, 15.0];
  const costUsd = (response.usage.input_tokens * inRate + response.usage.output_tokens * outRate) / 1_000_000;

  if (options.json) {
    console.log(JSON.stringify({ ...result, overall_score: overall, rubric: options.rubric, model: options.model, cost_usd: costUsd }, null, 2));
    return;
  }

  const verdictColor = result['verdict'] === 'pass' ? chalk.green : chalk.red;
  const overallColor = overall >= 0.7 ? chalk.green : overall >= 0.5 ? chalk.yellow : chalk.red;

  console.log('');
  console.log(chalk.blue('GMirror Score Report'));
  console.log(chalk.gray(`Rubric: ${options.rubric} | Model: ${options.model}`));
  console.log('');
  console.log(`Verdict: ${verdictColor((result['verdict'] as string ?? 'unknown').toUpperCase())}`);
  console.log(`Overall: ${overallColor((overall * 100).toFixed(0) + '%')}`);
  console.log('');

  for (const dim of DIMENSIONS) {
    const val = (result[dim] as number) ?? 0;
    const filled = Math.round(val * 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const color = val >= 0.7 ? chalk.green : val >= 0.5 ? chalk.yellow : chalk.red;
    console.log(`  ${dim.padEnd(18)} ${color(bar)} ${(val * 100).toFixed(0)}%`);
  }

  if (result['reasoning']) {
    console.log('');
    console.log(chalk.gray(`Note: ${result['reasoning']}`));
  }
  console.log(chalk.gray(`Cost: $${costUsd.toFixed(6)} | Tokens: ${response.usage.input_tokens}in/${response.usage.output_tokens}out`));
  console.log('');
}
