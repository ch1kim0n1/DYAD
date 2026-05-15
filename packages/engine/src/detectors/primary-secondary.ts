import Anthropic from '@anthropic-ai/sdk';
import { FeatureVector, NormalizedMessage, PrimarySecondaryResult } from '@dyad/shared';
import { buildSecondaryEmotionPrompt } from './secondary-emotion-prompt.js';
import { getCostMeter } from '../cost-meter.js';

export interface PrimarySecondaryOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  nrcGate?: number;          // min anger/disgust to trigger LLM call
  contextWindow?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_NRC_GATE = 0.15; // Calibrated on demo corpus: targets 2-5 fires/week
const DEFAULT_CONTEXT_WINDOW = 5;

/**
 * Detects surface vs. primary emotion layering.
 *
 * Gate: only calls the LLM when NRC anger ≥ 0.15 OR NRC disgust ≥ 0.15
 * for the target message. This keeps cost down by reserving Sonnet calls
 * for messages where lexical signal suggests layering is worth checking.
 */
export class PrimarySecondaryDetector {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private nrcGate: number;
  private contextWindow: number;

  constructor(options: PrimarySecondaryOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('PrimarySecondaryDetector: ANTHROPIC_API_KEY is required');
    }
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.nrcGate = options.nrcGate ?? DEFAULT_NRC_GATE;
    this.contextWindow = options.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  }

  /**
   * Detect for a single target message. Returns null when the NRC gate fails.
   */
  async detect(
    target: NormalizedMessage,
    targetVector: FeatureVector,
    contextMessages: NormalizedMessage[]
  ): Promise<PrimarySecondaryResult | null> {
    if (targetVector.nrc_anger < this.nrcGate && targetVector.nrc_disgust < this.nrcGate) {
      return null;
    }
    const context = this.windowFor(target, contextMessages);
    const prompt = buildSecondaryEmotionPrompt(context, target);
    const meter = getCostMeter();
    meter.guard('PrimarySecondaryDetector.detect');
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    meter.record(
      'PrimarySecondaryDetector.detect',
      this.model,
      response.usage?.input_tokens ?? 0,
      response.usage?.output_tokens ?? 0,
    );
    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '';
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) {
      throw new Error('PrimarySecondaryDetector: no JSON in response');
    }
    const parsed = JSON.parse(json[0]);

    return {
      surface_emotion: parsed.surface_emotion ?? targetVector.primary_emotion.label,
      underlying_emotion: parsed.primary_emotion ?? 'hurt',
      source_message_ids: [target.message_id],
      reframe: '',                                    // generated separately by ReframeGenerator
      citations: parsed.evidence ? [parsed.evidence] : [],
      confidence: clamp01(parsed.confidence ?? 0),
    };
  }

  private windowFor(target: NormalizedMessage, messages: NormalizedMessage[]): NormalizedMessage[] {
    const idx = messages.findIndex(m => m.message_id === target.message_id);
    if (idx === -1) return [target];
    return messages.slice(Math.max(0, idx - this.contextWindow), idx + 1);
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
