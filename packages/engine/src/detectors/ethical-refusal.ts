import Anthropic from '@anthropic-ai/sdk';
import {
  CrisisResource,
  EthicalRefusalResult,
  EthicalTrigger,
  FeatureVector,
  NormalizedMessage,
} from '@dyad/shared';
import { getCostMeter } from '../cost-meter.js';
import { withRetry } from '../utils/retry.js';
import { tracedLlmCall } from '../telemetry.js';
import { child } from '../logger.js';

export interface EthicalRefusalOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  /** Override the crisis screening call entirely (useful in tests). */
  bypass?: boolean;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_TOKENS = 256;

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: 'National Suicide Prevention Lifeline',
    phone: '988',
    description: 'Free 24/7 support for people in suicidal crisis or emotional distress.',
  },
  {
    name: 'Crisis Text Line',
    text: 'HOME to 741741',
    description: 'Text-based 24/7 crisis counseling.',
  },
  {
    name: 'National Domestic Violence Hotline',
    phone: '1-800-799-7233',
    url: 'https://www.thehotline.org',
    description: 'Confidential support for anyone affected by relationship abuse.',
  },
  {
    name: 'SAMHSA National Helpline',
    phone: '1-800-662-4357',
    description: 'Free, confidential help with mental health and substance use.',
  },
];

/**
 * EthicalRefusalClassifier — the hard gate that MUST run before any
 * analytical output is shown. Two-stage:
 *   1. Local sniff: scan FeatureVector `clinical_flag` fields (cheap).
 *   2. Haiku screening (if `classify()` is called with messages): a fast
 *      LLM check on recent message text for abuse / suicidality / severe
 *      depression / coercive_control signals not caught by extraction.
 *
 * `safe === false` ⇒ the orchestrator MUST suppress all other detector output
 * and present `crisis_resources` instead.
 */
export class EthicalRefusalClassifier {
  private client: Anthropic | null;
  private model: string;
  private maxTokens: number;
  private bypass: boolean;

  private thresholds: Record<'abuse' | 'suicidality' | 'severe_depression', number> = {
    abuse: 0.70,
    suicidality: 0.60,
    severe_depression: 0.70,
  };

  constructor(options: EthicalRefusalOptions = {}) {
    this.bypass = options.bypass ?? false;
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  /**
   * Synchronous fast path: look at `clinical_flag` fields already extracted
   * by the LLM extractor. Use when calling Haiku would be redundant.
   */
  classifyFromFeatures(features: FeatureVector[]): EthicalRefusalResult {
    const recent = features.slice(-20);
    const flags = recent.flatMap(f => (f.clinical_flag ? [f.clinical_flag] : []));
    const triggers = new Set<EthicalTrigger>();
    let primaryCategory: EthicalRefusalResult['category'] = null;
    let topConfidence = 0;

    for (const cat of ['abuse', 'suicidality', 'severe_depression'] as const) {
      const matches = flags.filter(f => f.category === cat);
      if (matches.length === 0) continue;
      const avg = matches.reduce((a, b) => a + b.confidence, 0) / matches.length;
      if (avg >= this.thresholds[cat] && matches.length >= 1) {
        triggers.add(cat);
        if (avg > topConfidence) {
          topConfidence = avg;
          primaryCategory = cat;
        }
      }
    }

    return this.buildResult(triggers, topConfidence, primaryCategory);
  }

  /**
   * Full pipeline screening — runs Haiku on the message texts when available
   * to catch signals the L2 extraction may have missed. Falls back to the
   * feature-based fast path when no API key / model is available.
   */
  async classify(
    messages: NormalizedMessage[],
    features: FeatureVector[]
  ): Promise<EthicalRefusalResult> {
    const fastPath = this.classifyFromFeatures(features);
    if (fastPath.safe === false) return fastPath;
    if (this.bypass || !this.client || messages.length === 0) return fastPath;

    const sample = messages.slice(-20).map(m =>
      `[${m.is_from_me ? 'self' : 'partner'}] ${m.text}`
    ).join('\n');

    const prompt = `You are a safety classifier. Read the recent messages and decide whether any of these signals are present, anywhere in the conversation:

- abuse (physical / sexual / verbal / financial)
- suicidality (ideation, plan, intent, self-harm)
- severe_depression (anhedonia, hopelessness over weeks)
- coercive_control (isolation tactics, threats, monitoring, gaslighting)

Messages:
${sample}

Respond with ONLY valid JSON: {
  "triggers": ["abuse"|"suicidality"|"severe_depression"|"coercive_control", ...],
  "confidence": 0..1,
  "rationale": "≤ 20 words"
}`;

    const meter = getCostMeter();
    const log = child('ethical-refusal');
    const client = this.client; // narrowed by the !this.client guard earlier
    if (!client) return fastPath;
    try {
      meter.guard('EthicalRefusalClassifier.classify');
      const response = await withRetry(
        () => tracedLlmCall('ethical_refusal', this.model, () => client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [{ role: 'user', content: prompt }],
        })),
        { onRetry: ({ attempt, delayMs, error }) => log.warn({ attempt, delayMs, err: (error as Error).message }, 'ethical-refusal retry') },
      );
      meter.record(
        'EthicalRefusalClassifier.classify',
        this.model,
        response.usage?.input_tokens ?? 0,
        response.usage?.output_tokens ?? 0,
      );
      const block = response.content[0];
      const text = block.type === 'text' ? block.text : '';
      const json = text.match(/\{[\s\S]*\}/);
      if (!json) return fastPath;
      const parsed = JSON.parse(json[0]);
      const triggers = new Set<EthicalTrigger>(
        (Array.isArray(parsed.triggers) ? parsed.triggers : []).filter(isEthicalTrigger)
      );
      // Merge with fast-path triggers (e.g. if extraction already flagged)
      for (const t of fastPath.triggers) triggers.add(t);
      if (triggers.size === 0) return fastPath;
      const confidence = Math.max(parsed.confidence ?? 0, fastPath.confidence);
      const primary: EthicalRefusalResult['category'] =
        triggers.has('suicidality') ? 'suicidality'
          : triggers.has('abuse') ? 'abuse'
          : triggers.has('severe_depression') ? 'severe_depression'
          : null;
      return this.buildResult(triggers, confidence, primary);
    } catch {
      return fastPath;
    }
  }

  private buildResult(
    triggers: Set<EthicalTrigger>,
    confidence: number,
    primary: EthicalRefusalResult['category']
  ): EthicalRefusalResult {
    const triggerList = [...triggers];
    const safe = triggerList.length === 0;
    return {
      safe,
      should_refuse: !safe,
      triggers: triggerList,
      category: primary,
      confidence: safe ? 0 : confidence,
      referral_resources: safe ? [] : CRISIS_RESOURCES.map(r => `${r.name}${r.phone ? `: ${r.phone}` : ''}`),
      crisis_resources: safe ? [] : CRISIS_RESOURCES,
    };
  }
}

function isEthicalTrigger(x: unknown): x is EthicalTrigger {
  return x === 'abuse' || x === 'suicidality' || x === 'severe_depression' || x === 'coercive_control';
}
