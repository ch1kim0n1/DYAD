import { NormalizedMessage, OrchestratorResult } from '@dyad/shared';
import { DetectorType } from './brief-prompt.js';

/**
 * Build the reframe prompt — Sonnet generates a 3-5 sentence alternative
 * interpretation of the detected pattern, given the prior `brief`.
 *
 * Tone is deliberately different from the brief: exploratory, possibility-
 * oriented, never definitive about the partner's motives.
 */
export function buildReframePrompt(
  detectorType: DetectorType,
  result: OrchestratorResult,
  brief: string,
  recentMessages: NormalizedMessage[]
): string {
  const excerpts = recentMessages
    .slice(-6)
    .map(m => `[${m.is_from_me ? 'self' : 'partner'}] ${m.text}`)
    .join('\n');

  return [
    SYSTEM,
    '',
    fewShotFor(detectorType),
    '',
    '--- now write a reframe for the situation below ---',
    '',
    `Detector: ${detectorType}`,
    `Brief that the user already read:\n${brief}`,
    '',
    `Recent messages:\n${excerpts}`,
    '',
    OUTPUT_INSTRUCTIONS,
  ].join('\n');
}

const SYSTEM = `You are helping someone understand their relationship patterns with compassion.
Your job is to write a single paragraph (3-5 sentences) that offers an alternative way of seeing
what's happening — not the truth, just another possible lens.

Rules:
  - Tone is exploratory ("they may feel...", "one possibility is..."), never definitive.
  - Acknowledge the user's experience first; do not dismiss it.
  - Offer a plausible alternative grounded in attachment theory or ordinary stress.
  - End with an open question or possibility, not a conclusion.
  - NEVER tell the user what their partner "really means" — only what they might.`;

const OUTPUT_INSTRUCTIONS = `Output ONE paragraph, 3 to 5 sentences. No headings, no bullet points, no quotes around it.`;

function fewShotFor(type: DetectorType): string {
  switch (type) {
    case 'bid_asymmetry':
      return `Example — bid_asymmetry:
The pattern is real and worth naming. It's also possible that your partner is operating with less bandwidth than usual — maybe stress at work, or feeling behind on something they haven't told you about — and what looks like ignoring may be them on autopilot. People who feel overwhelmed often retreat from connection precisely when they most need it. What might it look like to ask them, gently, about the load they're carrying right now?`;
    case 'predictive_divergence':
      return `Example — predictive_divergence:
Each of you is anticipating a different ending to this conversation. That doesn't mean either of you is wrong — it means you've each filled in different blanks. When two people predict differently, the safer thing is to slow down and check the prediction out loud rather than push through. Could one of you say what you think the other is hearing?`;
    case 'phantom_third_party':
      return `Example — phantom_third_party:
When someone outside a relationship takes up a lot of space, it's often because they hold something unfinished — old hurt, unresolved roles, or a comparison that hasn't been spoken. Your partner may be processing something they can't yet say directly about that person. One possibility is that the third party is a stand-in for something they want to ask you about your relationship — but it feels safer to talk about someone else first. What would it be like to ask them what they're really trying to figure out?`;
    case 'primary_secondary':
      return `Example — primary_secondary:
The frustration in that message is real, but it may be a wrapper around something tenderer underneath. People reach for sharper feelings when the softer ones feel risky to admit — hurt, fear, or just not feeling chosen. You're not expected to translate for them, but noticing the softer feeling can change what you respond to. What might it look like to answer the softer feeling, even when only the harder one was said out loud?`;
  }
}
