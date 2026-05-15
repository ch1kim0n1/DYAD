import { NormalizedMessage } from '@dyad/shared';

/**
 * Build a secondary-emotion classifier prompt for Claude Sonnet.
 *
 * The model is asked to identify whether the surface emotion in `target`
 * is masking a more vulnerable primary emotion (hurt / fear / shame /
 * loneliness), grounded in Emotionally Focused Therapy.
 *
 * Three few-shots cover the canonical layerings:
 *   1. anger → hurt
 *   2. dismissal → fear
 *   3. sarcasm → sadness
 */
export function buildSecondaryEmotionPrompt(
  context: NormalizedMessage[],
  target: NormalizedMessage
): string {
  const contextText = context
    .map(m => `[${m.is_from_me ? 'self' : 'partner'} @ ${m.timestamp}] ${m.text}`)
    .join('\n');

  return [
    SYSTEM_PROMPT,
    '',
    'Example 1 — anger → hurt:',
    'Context: "[partner] You promised you\'d call. [self] Look, I forgot, ok?"',
    'Target: "[self] Look, I forgot, ok?"',
    JSON.stringify({
      primary_emotion: 'hurt',
      surface_emotion: 'anger',
      confidence: 0.78,
      evidence: 'Sharp "Look", terse closure "ok?" - anger covering being caught/exposed',
      has_layering: true,
    }, null, 2),
    '',
    'Example 2 — dismissal → fear:',
    'Context: "[partner] Can we talk about the future? [self] Whatever, I dunno"',
    'Target: "[self] Whatever, I dunno"',
    JSON.stringify({
      primary_emotion: 'fear',
      surface_emotion: 'dismissal',
      confidence: 0.72,
      evidence: 'Disengaged "Whatever" + "dunno" — protective deflection from a vulnerable topic',
      has_layering: true,
    }, null, 2),
    '',
    'Example 3 — sarcasm → sadness:',
    'Context: "[partner] How was therapy? [self] Oh great. Just GREAT. Best hour of my life."',
    'Target: "[self] Oh great. Just GREAT. Best hour of my life."',
    JSON.stringify({
      primary_emotion: 'sadness',
      surface_emotion: 'sarcasm',
      confidence: 0.81,
      evidence: 'Hyperbolic "Best hour of my life" with capitalized GREAT — bitter cover for disappointment',
      has_layering: true,
    }, null, 2),
    '',
    '--- now classify ---',
    '',
    `Recent conversation:\n${contextText}`,
    '',
    `Target message: "${target.text}"`,
    '',
    OUTPUT_INSTRUCTIONS,
  ].join('\n');
}

const SYSTEM_PROMPT = `You are an expert in Emotionally Focused Therapy. Surface emotions
(anger, contempt, sarcasm, dismissal) often protect more vulnerable primary emotions
(hurt, fear, shame, loneliness). Identify whether layering is present and, if so, name
the primary emotion underneath.

Calibration:
  - Use confidence ≥ 0.75 only when you can cite specific phrases as evidence.
  - Set has_layering=false when the surface emotion *is* the genuine emotion.
  - Be conservative — false positives erode user trust.`;

const OUTPUT_INSTRUCTIONS = `Respond with ONLY valid JSON in this exact shape (no prose, no markdown):
{
  "primary_emotion": string,
  "surface_emotion": string,
  "confidence": number 0..1,
  "evidence": string,
  "has_layering": boolean
}`;
