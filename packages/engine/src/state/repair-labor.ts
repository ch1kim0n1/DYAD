import { FeatureVector, NormalizedMessage } from '@dyad/shared';

/**
 * Compute the repair labor index over a set of features.
 *
 * Returns a value in [-1, 1]:
 *   +1.0 → self initiated every repair
 *    0.0 → balanced (or no repairs)
 *   -1.0 → partner initiated every repair
 *
 * A "repair attempt" is a feature whose primary emotion is regulatory
 * (the message expresses validation after a horseman marker, OR contains
 * any validation marker, OR has `clinical_flag === null` while immediately
 * following a flagged horseman exchange).
 *
 * Caller MUST supply matching `messages` so that `is_from_me` can identify
 * which side initiated each repair. Order is by chronological index.
 */
export function computeRepairLaborIndex(
  features: FeatureVector[],
  messages: NormalizedMessage[]
): number {
  const messageById = new Map(messages.map(m => [m.message_id, m]));

  let selfRepairs = 0;
  let partnerRepairs = 0;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (!isRepairAttempt(f, i, features)) continue;
    const msg = messageById.get(f.message_id);
    if (!msg) continue;
    if (msg.is_from_me) selfRepairs++;
    else partnerRepairs++;
  }

  const total = selfRepairs + partnerRepairs;
  if (total === 0) return 0;
  return (selfRepairs - partnerRepairs) / total;
}

function isRepairAttempt(f: FeatureVector, idx: number, all: FeatureVector[]): boolean {
  const hasValidation =
    f.validation_markers.acknowledges ||
    f.validation_markers.paraphrases ||
    f.validation_markers.asks_to_understand;
  if (!hasValidation) return false;

  // Must follow a horseman marker within last 3 messages (de-escalation)
  for (let i = Math.max(0, idx - 3); i < idx; i++) {
    const prev = all[i];
    if (
      prev.horseman_markers.criticism ||
      prev.horseman_markers.contempt ||
      prev.horseman_markers.defensiveness ||
      prev.horseman_markers.stonewalling
    ) {
      return true;
    }
  }
  return false;
}
