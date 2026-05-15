import { NormalizedMessage, OrchestratorResult } from '@dyad/shared';

export type DetectorType =
  | 'bid_asymmetry'
  | 'predictive_divergence'
  | 'phantom_third_party'
  | 'primary_secondary';

/**
 * Build a 3-sentence brief prompt for Claude Sonnet.
 *
 * The brief follows this exact shape:
 *   [What's happening]: ...
 *   [Why it matters]: ...
 *   [Observation]: ...
 *
 * Tone: warm, non-judgmental relationship coach. Never blame the partner,
 * never use clinical labels, focus on patterns not character.
 */
export function buildBriefPrompt(
  detectorType: DetectorType,
  result: OrchestratorResult,
  recentMessages: NormalizedMessage[]
): string {
  const excerpts = recentMessages
    .slice(-8)
    .map(m => `[${m.is_from_me ? 'self' : 'partner'}] ${m.text}`)
    .join('\n');

  const summary = summariseDetector(detectorType, result);

  return [
    SYSTEM,
    '',
    fewShotFor(detectorType),
    '',
    '--- now write a brief for the situation below ---',
    '',
    `Detector: ${detectorType}`,
    `Signal: ${summary}`,
    '',
    `Recent messages:\n${excerpts}`,
    '',
    OUTPUT_INSTRUCTIONS,
  ].join('\n');
}

const SYSTEM = `You are a warm, non-judgmental relationship coach. Your job is to write
a 3-sentence brief about a detected pattern in someone's recent conversation. Follow this
exact shape:

  [What's happening]: <one sentence — describe the pattern in plain language>
  [Why it matters]: <one sentence — ground it in research or psychology>
  [Observation]: <one sentence — one specific, concrete observation from the actual messages>

Rules:
  - No blame ("your partner fails to..." is BANNED).
  - No clinical labels ("anxious attachment", "narcissistic", etc.).
  - Focus on patterns, not character.
  - Speak to the user, not about them.`;

const OUTPUT_INSTRUCTIONS = `Output EXACTLY three lines in the form:
[What's happening]: ...
[Why it matters]: ...
[Observation]: ...
Nothing else.`;

function fewShotFor(type: DetectorType): string {
  switch (type) {
    case 'bid_asymmetry':
      return `Example — bid_asymmetry:
[What's happening]: You're reaching out for connection more often than your partner is reaching back.
[Why it matters]: Gottman's longitudinal research finds that the rate partners turn toward each other's small bids predicts long-term relationship health better than almost any other behavior.
[Observation]: In the last week, your three questions about the weekend went unanswered before they replied to a separate topic.`;
    case 'predictive_divergence':
      return `Example — predictive_divergence:
[What's happening]: You and your partner are emotionally drifting in opposite directions across this conversation.
[Why it matters]: When each person is predicting a different ending to the same exchange, they can both leave feeling unheard even when neither said anything unkind.
[Observation]: Your tone is becoming warmer over the last five messages while your partner's is becoming flatter.`;
    case 'phantom_third_party':
      return `Example — phantom_third_party:
[What's happening]: Someone outside your relationship is taking up a lot of space in your recent conversations.
[Why it matters]: Bowen called this triangulation — when a third person becomes the lens through which two people relate, the actual connection gets harder to find.
[Observation]: Eight of the last ten messages reference "her" or "they" more than they reference you and your partner directly.`;
    case 'primary_secondary':
      return `Example — primary_secondary:
[What's happening]: There's likely a softer feeling underneath the frustration in your recent message.
[Why it matters]: Emotionally Focused Therapy treats anger as a protective wrap around more vulnerable feelings — hurt, fear, shame, or loneliness — that are harder to say out loud.
[Observation]: The sharp "fine, whatever" sits in the same paragraph as "I just wanted you to ask" — the second line is closer to what's actually going on.`;
  }
}

function summariseDetector(type: DetectorType, result: OrchestratorResult): string {
  switch (type) {
    case 'bid_asymmetry': {
      const b = result.bid_asymmetry;
      if (!b) return 'asymmetry detected';
      return `self responds ${pct(b.self_rate)}, partner responds ${pct(b.partner_rate)} (severity: ${b.severity})`;
    }
    case 'predictive_divergence': {
      const d = result.predictive_divergence;
      if (!d) return 'divergence detected';
      return `self trend ${d.self_trend.toFixed(2)} vs partner trend ${d.partner_trend.toFixed(2)}`;
    }
    case 'phantom_third_party': {
      const p = result.phantom_third_party;
      if (!p) return 'phantom presence detected';
      return `third-person rate ${pct(p.third_person_rate)} vs first/second ${pct(p.first_second_person_rate)} (ratio ${p.ratio.toFixed(2)})`;
    }
    case 'primary_secondary': {
      const s = result.primary_secondary;
      if (!s) return 'emotional layering detected';
      return `${s.surface_emotion} → ${s.underlying_emotion} (confidence ${s.confidence.toFixed(2)})`;
    }
  }
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
