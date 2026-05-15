import Anthropic from '@anthropic-ai/sdk';
import { NormalizedMessage } from '@dyad/shared';
import { LLM_EXTRACTION_PROMPT_FALLBACK } from '@dyad/prompts';
import { getCostMeter } from './cost-meter.js';

export interface LLMExtractionResult {
  bid_classification: {
    is_bid: boolean;
    bid_type: 'observation' | 'question' | 'share' | 'request' | null;
    confidence: number;
  };
  response_classification: {
    is_response_to_bid: boolean;
    quality: 'engaged' | 'perfunctory' | 'missed' | 'hostile' | null;
    confidence: number;
  };
  horseman_markers: {
    criticism: boolean;
    contempt: boolean;
    defensiveness: boolean;
    stonewalling: boolean;
  };
  validation_markers: {
    acknowledges: boolean;
    paraphrases: boolean;
    asks_to_understand: boolean;
  };
  primary_emotion: {
    label: 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation';
    intensity: 'low' | 'med' | 'high';
    confidence: number;
  };
  secondary_emotion_inference: {
    surface: string;
    underneath: 'hurt' | 'fear' | 'shame' | 'loneliness';
    confidence: number;
  } | null;
  action_id_level: 'low' | 'high';
  higgins_family: 'dejection' | 'agitation' | 'neutral' | null;
  topic_tags: string[];
  clinical_flag: {
    category: 'abuse' | 'suicidality' | 'severe_depression';
    confidence: number;
  } | null;
}

export interface LlmExtractorOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  promptTemplate?: string;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_MAX_TOKENS = 512;

/**
 * LlmExtractor — call Claude Haiku and parse the structured JSON extraction.
 *
 * Note: latency_z_score is NOT part of LLM output — it's a derived metric
 * computed by `LatencyZScore` and merged in the ExtractionPipeline.
 */
export class LlmExtractor {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private promptTemplate: string;

  constructor(options: LlmExtractorOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('LlmExtractor: ANTHROPIC_API_KEY is required');
    }
    this.client = new Anthropic({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.promptTemplate = options.promptTemplate ?? LLM_EXTRACTION_PROMPT_FALLBACK;
  }

  async extract(message: NormalizedMessage): Promise<LLMExtractionResult> {
    const prompt = this.buildPrompt(message);
    const meter = getCostMeter();
    meter.guard('LlmExtractor.extract');
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      meter.record(
        'LlmExtractor.extract',
        this.model,
        response.usage?.input_tokens ?? 0,
        response.usage?.output_tokens ?? 0,
      );
      const block = response.content[0];
      const text = block.type === 'text' ? block.text : '';
      return this.parseResponse(text);
    } catch (err) {
      // Surface the error to the caller — silent fallbacks hide pipeline issues.
      throw new Error(
        `LlmExtractor.extract failed for message ${message.message_id}: ${(err as Error).message}`
      );
    }
  }

  private buildPrompt(message: NormalizedMessage): string {
    return this.promptTemplate
      .replaceAll('{{message_text}}', message.text)
      .replaceAll('{{is_from_me}}', String(message.is_from_me))
      .replaceAll('{{timestamp}}', message.timestamp);
  }

  private parseResponse(response: string): LLMExtractionResult {
    const fenced = response.match(/```json\s*([\s\S]*?)\s*```/);
    const raw = fenced ? fenced[1] : (response.match(/\{[\s\S]*\}/)?.[0] ?? '');
    if (!raw) {
      throw new Error('LlmExtractor: no JSON found in response');
    }
    const parsed = JSON.parse(raw);
    return {
      bid_classification: parsed.bid_classification,
      response_classification: parsed.response_classification,
      horseman_markers: parsed.horseman_markers,
      validation_markers: parsed.validation_markers,
      primary_emotion: parsed.primary_emotion,
      secondary_emotion_inference: parsed.secondary_emotion_inference ?? null,
      action_id_level: parsed.action_id_level,
      higgins_family: parsed.higgins_family ?? null,
      topic_tags: parsed.topic_tags ?? [],
      clinical_flag: parsed.clinical_flag ?? null,
    };
  }
}
