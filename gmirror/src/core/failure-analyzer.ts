/**
 * Failure Analyzer for GMirror
 * Analyzes failure modes and patterns
 */

import { logger } from './logger.js';
import { LLMClient, LLMClientConfig } from './llm-client.js';

export interface FailurePattern {
  id: string;
  name: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export class FailureAnalyzer {
  private patterns: Map<string, FailurePattern> = new Map();
  private llmClient: LLMClient;

  constructor(config: { llmConfig?: LLMClientConfig; llmClient?: LLMClient } = {}) {
    this.llmClient = config.llmClient ?? new LLMClient(config.llmConfig);
  }

  async analyzeFailure(failureDescription: string): Promise<FailurePattern | null> {
    logger.info('Analyzing failure', { description: failureDescription });

    const pattern = await this.classifyWithLLM(failureDescription).catch((error) => {
      logger.warn('LLM failure classification unavailable, using conservative fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallbackPattern(failureDescription);
    });
    
    this.updatePattern(pattern);
    return pattern;
  }

  private async classifyWithLLM(failureDescription: string): Promise<FailurePattern> {
    const prompt = `Classify this GMirror synthetic-user failure mode.

Failure:
${failureDescription}

Return strict JSON with keys:
{"name": string, "severity": "low" | "medium" | "high" | "critical", "description": string}

Use a specific name such as Navigation Dead End, Form Validation Loop, Cognitive Overload, Trust Loss, Safety Harm, or Missing Affordance.`;

    const result = await this.llmClient.call(prompt, {
      model: this.llmClient.getModelByTier('tier2'),
      temperature: 0.2,
    });
    const parsed = JSON.parse(result.content);
    return {
      id: `pattern-${Date.now()}`,
      name: String(parsed.name || 'Unclassified Failure'),
      frequency: 1,
      severity: this.normalizeSeverity(parsed.severity),
      description: String(parsed.description || failureDescription),
    };
  }

  private fallbackPattern(failureDescription: string): FailurePattern {
    return {
      id: `pattern-${Date.now()}`,
      name: 'Unclassified Failure',
      frequency: 1,
      severity: 'medium',
      description: failureDescription,
    };
  }

  private normalizeSeverity(value: unknown): FailurePattern['severity'] {
    return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
      ? value
      : 'medium';
  }

  private updatePattern(pattern: FailurePattern): void {
    const existing = this.patterns.get(pattern.name);
    if (existing) {
      existing.frequency++;
      this.patterns.set(pattern.name, existing);
    } else {
      this.patterns.set(pattern.name, pattern);
    }
  }

  getTopFailures(limit: number = 10): FailurePattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  getBySeverity(severity: string): FailurePattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.severity === severity);
  }

  clear(): void {
    this.patterns.clear();
    logger.info('FailureAnalyzer cleared');
  }
}
