/**
 * Shared feature synthesis used by `ingest-corpus.ts` and `accuracy-audit.ts`.
 *
 * Without an `ANTHROPIC_API_KEY`, we cannot run real L2 extraction. Instead
 * we infer bid types, response qualities, horseman / validation markers,
 * primary emotion and so on from regex patterns over the redacted text.
 * This is intentionally simple and conservative — it's a development tool
 * for fixture-based testing, not a substitute for the actual LLM.
 */
import type {
  FeatureVector,
  NormalizedMessage,
} from '../packages/shared/src/types.js';
import type {
  FunctionWordParser,
  AffectPass,
} from '../packages/engine/src/index.js';

export function synthesiseFeature(
  message: NormalizedMessage,
  fw: ReturnType<FunctionWordParser['parse']>,
  affect: ReturnType<AffectPass['processMessage']>,
  latencyZ: number,
  prevMessage?: NormalizedMessage,
  prevFeature?: FeatureVector
): FeatureVector {
  const text = message.text.toLowerCase();
  const isQuestion = /[?]\s*$/.test(message.text);
  const isShare = /\b(i (feel|think|want|need|just)|today i|just wanted)/i.test(text);
  const isRequest = /\b(can you|could you|please|would you mind)/i.test(text);
  const bidType = isQuestion ? 'question' : isShare ? 'share' : isRequest ? 'request' : null;

  const horseman = {
    criticism: /\byou (always|never)\b|what is wrong with you/i.test(text),
    contempt: /\bridiculous\b|\bpathetic\b|whatever|eye[- ]?roll/i.test(text),
    defensiveness: /\bit('?s| is) not my fault\b|\byou'?re overreacting\b/i.test(text),
    stonewalling: /\b(fine|whatever|nothing|i('?m| am) done)\b/i.test(text) && message.text.length < 40,
  };
  const validation = {
    acknowledges: /\bi hear you\b|\bthat makes sense\b|\bi understand\b/i.test(text),
    paraphrases: /\bso (you'?re saying|you mean)\b/i.test(text),
    asks_to_understand: isQuestion && /\bhow do you feel\b|\bwhy\b|\bwhat is going on\b/i.test(text),
  };

  const dominantEmotion = pickEmotion(affect);
  const lowerTextLen = message.text.trim().length;
  const stonewalled = horseman.stonewalling;
  const explicitValidation =
    validation.acknowledges || validation.paraphrases || validation.asks_to_understand;

  const followsBid =
    prevMessage !== undefined &&
    prevFeature !== undefined &&
    prevMessage.is_from_me !== message.is_from_me &&
    prevFeature.bid_classification.is_bid;
  let responseClassification: FeatureVector['response_classification'];
  if (stonewalled) {
    responseClassification = { is_response_to_bid: true, quality: 'missed', confidence: 0.6 };
  } else if (explicitValidation) {
    responseClassification = { is_response_to_bid: true, quality: 'engaged', confidence: 0.7 };
  } else if (followsBid) {
    const warm = affect.afinn_valence >= 0 && !horseman.criticism && !horseman.contempt;
    const tooBrief = message.text.trim().length < 8;
    const quality: 'engaged' | 'perfunctory' | 'missed' =
      tooBrief && affect.afinn_valence <= 0
        ? 'missed'
        : warm && message.text.trim().length >= 15
        ? 'engaged'
        : 'perfunctory';
    responseClassification = { is_response_to_bid: true, quality, confidence: 0.55 };
  } else {
    responseClassification = { is_response_to_bid: false, quality: null, confidence: 0 };
  }

  return {
    message_id: message.message_id,
    fw_i: fw.fw_i,
    fw_we: fw.fw_we,
    fw_you: fw.fw_you,
    fw_abs: fw.fw_abs,
    fw_tent: fw.fw_tent,
    fw_cog: fw.fw_cog,
    fw_third: fw.fw_third,
    nrc_joy: affect.nrc_joy,
    nrc_trust: affect.nrc_trust,
    nrc_fear: affect.nrc_fear,
    nrc_surprise: affect.nrc_surprise,
    nrc_sadness: affect.nrc_sadness,
    nrc_disgust: affect.nrc_disgust,
    nrc_anger: affect.nrc_anger,
    nrc_anticipation: affect.nrc_anticipation,
    nrc_positive: affect.nrc_positive,
    nrc_negative: affect.nrc_negative,
    afinn_valence: affect.afinn_valence,
    intensifier_rate: affect.intensifier_rate,
    bid_classification: {
      is_bid: bidType !== null,
      bid_type: bidType,
      confidence: bidType !== null ? 0.6 : 0,
    },
    response_classification: responseClassification,
    horseman_markers: horseman,
    validation_markers: validation,
    primary_emotion: {
      label: dominantEmotion,
      intensity: lowerTextLen > 120 ? 'high' : lowerTextLen > 30 ? 'med' : 'low',
      confidence: 0.55,
    },
    secondary_emotion_inference: null,
    action_id_level: /\b(plan|future|relationship|love|values|why)\b/.test(text) ? 'high' : 'low',
    higgins_family: affect.afinn_valence < -1 ? 'dejection' : affect.afinn_valence > 1 ? 'neutral' : 'neutral',
    topic_tags: extractTags(text),
    latency_z_score: latencyZ,
    clinical_flag: null,
  };
}

function pickEmotion(a: ReturnType<AffectPass['processMessage']>) {
  const entries: [FeatureVector['primary_emotion']['label'], number][] = [
    ['joy', a.nrc_joy],
    ['trust', a.nrc_trust],
    ['fear', a.nrc_fear],
    ['surprise', a.nrc_surprise],
    ['sadness', a.nrc_sadness],
    ['disgust', a.nrc_disgust],
    ['anger', a.nrc_anger],
    ['anticipation', a.nrc_anticipation],
  ];
  entries.sort((x, y) => y[1] - x[1]);
  return entries[0][0];
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  if (/\b(work|job|boss|deadline|meeting)\b/i.test(text)) tags.add('work');
  if (/\b(money|rent|bills?|budget|pay)\b/i.test(text)) tags.add('finances');
  if (/\b(mom|dad|family|parents?|sister|brother)\b/i.test(text)) tags.add('family');
  if (/\b(love|us|we|partner|relationship)\b/i.test(text)) tags.add('relationship');
  if (/\b(sex|intimacy)\b/i.test(text)) tags.add('intimacy');
  if (/\b(plan|future|move|kids?|marry|marriage)\b/i.test(text)) tags.add('future');
  return [...tags];
}
