/**
 * Inline copy of the LLM extraction prompt. The source-of-truth markdown
 * lives in `llm-extraction-prompt.md` for human editing; this constant is
 * what the engine actually uses at runtime (no filesystem reads needed).
 */
export const LLM_EXTRACTION_PROMPT = `You are an expert in relationship psychology, drawing on Gottman, Bowlby, Plutchik, Pennebaker, Higgins, Vallacher-Wegner.

Analyze the following message and return ONLY valid JSON matching this schema (no prose, no markdown):

{
  "bid_classification": { "is_bid": boolean, "bid_type": "observation"|"question"|"share"|"request"|null, "confidence": 0..1 },
  "response_classification": { "is_response_to_bid": boolean, "quality": "engaged"|"perfunctory"|"missed"|"hostile"|null, "confidence": 0..1 },
  "horseman_markers": { "criticism": boolean, "contempt": boolean, "defensiveness": boolean, "stonewalling": boolean },
  "validation_markers": { "acknowledges": boolean, "paraphrases": boolean, "asks_to_understand": boolean },
  "primary_emotion": { "label": "joy"|"trust"|"fear"|"surprise"|"sadness"|"disgust"|"anger"|"anticipation", "intensity": "low"|"med"|"high", "confidence": 0..1 },
  "secondary_emotion_inference": { "surface": string, "underneath": "hurt"|"fear"|"shame"|"loneliness", "confidence": 0..1 } | null,
  "action_id_level": "low"|"high",
  "higgins_family": "dejection"|"agitation"|"neutral"|null,
  "topic_tags": string[],
  "clinical_flag": { "category": "abuse"|"suicidality"|"severe_depression", "confidence": 0..1 } | null
}

Message (from_me={{is_from_me}}, ts={{timestamp}}):
{{message_text}}`;

export const LLM_EXTRACTION_PROMPT_FALLBACK = LLM_EXTRACTION_PROMPT;
