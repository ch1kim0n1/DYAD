import pLimit from 'p-limit';
import { NormalizedMessage, FeatureVector } from '@dyad/shared';
import { FunctionWordParser } from './function-word-parser.js';
import { LexiconLookup } from './lexicon-lookup.js';
import { AffectPass } from './affect-pass.js';
import { LlmExtractor, type LlmExtractorOptions } from './llm-extractor.js';
import { LatencyZScore } from './latency-zscore.js';

export interface ExtractionPipelineOptions extends LlmExtractorOptions {
  concurrency?: number;
}

/**
 * ExtractionPipeline — orchestrates L1 (function words + affect),
 * L2 (LLM), and merges the L1.5 latency z-score derived metric into
 * one FeatureVector per message.
 */
export class ExtractionPipeline {
  private functionWordParser: FunctionWordParser;
  private lexiconLookup: LexiconLookup;
  private affectPass: AffectPass;
  private llmExtractor: LlmExtractor;
  private latencyZScore: LatencyZScore;
  private concurrency: number;

  constructor(options: ExtractionPipelineOptions = {}) {
    this.lexiconLookup = new LexiconLookup();
    this.functionWordParser = new FunctionWordParser();
    this.affectPass = new AffectPass(this.lexiconLookup);
    this.llmExtractor = new LlmExtractor(options);
    this.latencyZScore = new LatencyZScore();
    this.concurrency = options.concurrency
      ?? Number(process.env.LLM_CONCURRENCY ?? 4);
  }

  /**
   * Run the full pipeline on a batch of messages. LLM calls run with bounded
   * concurrency. Latency z-scores are computed from message ordering and
   * merged into the resulting FeatureVectors.
   */
  async processBatch(messages: NormalizedMessage[]): Promise<FeatureVector[]> {
    if (messages.length === 0) return [];

    const zScores = this.latencyZScore.computeMessageZScores(messages);
    const limit = pLimit(this.concurrency);

    return Promise.all(
      messages.map(message =>
        limit(() => this.processMessage(message, zScores.get(message.message_id) ?? 0))
      )
    );
  }

  /**
   * Process a single message. `latencyZScore` is injected because it depends
   * on conversation ordering — single-message calls default to 0.
   */
  async processMessage(message: NormalizedMessage, latencyZScore: number = 0): Promise<FeatureVector> {
    const fw = this.functionWordParser.parse(message.text);
    const affect = this.affectPass.processMessage(message);
    const llm = await this.llmExtractor.extract(message);

    return {
      message_id: message.message_id,
      fw_i: fw.fw_i, fw_we: fw.fw_we, fw_you: fw.fw_you,
      fw_abs: fw.fw_abs, fw_tent: fw.fw_tent, fw_cog: fw.fw_cog,
      fw_third: fw.fw_third,
      nrc_joy: affect.nrc_joy, nrc_trust: affect.nrc_trust,
      nrc_fear: affect.nrc_fear, nrc_surprise: affect.nrc_surprise,
      nrc_sadness: affect.nrc_sadness, nrc_disgust: affect.nrc_disgust,
      nrc_anger: affect.nrc_anger, nrc_anticipation: affect.nrc_anticipation,
      nrc_positive: affect.nrc_positive, nrc_negative: affect.nrc_negative,
      afinn_valence: affect.afinn_valence,
      intensifier_rate: affect.intensifier_rate,
      bid_classification: llm.bid_classification,
      response_classification: llm.response_classification,
      horseman_markers: llm.horseman_markers,
      validation_markers: llm.validation_markers,
      primary_emotion: llm.primary_emotion,
      secondary_emotion_inference: llm.secondary_emotion_inference,
      action_id_level: llm.action_id_level,
      higgins_family: llm.higgins_family,
      topic_tags: llm.topic_tags,
      latency_z_score: latencyZScore,
      clinical_flag: llm.clinical_flag,
    };
  }
}
