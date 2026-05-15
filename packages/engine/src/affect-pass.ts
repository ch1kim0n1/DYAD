import { NormalizedMessage } from '@dyad/shared';
import { LexiconLookup, type NRCScores, type AFINNResult } from './lexicon-lookup.js';

export interface AffectScores extends NRCScores, AFINNResult {}

/**
 * Affect pass — NRC emotion scores + AFINN valence per message.
 */
export class AffectPass {
  private lexiconLookup: LexiconLookup;

  constructor(lexiconLookup?: LexiconLookup) {
    this.lexiconLookup = lexiconLookup ?? new LexiconLookup();
  }

  processMessage(message: NormalizedMessage): AffectScores {
    const nrc = this.lexiconLookup.calculateNRCScores(message.text);
    const afinn = this.lexiconLookup.calculateAFINNValence(message.text);
    return { ...nrc, ...afinn };
  }

  processBatch(messages: NormalizedMessage[]): Map<string, AffectScores> {
    const results = new Map<string, AffectScores>();
    for (const m of messages) {
      results.set(m.message_id, this.processMessage(m));
    }
    return results;
  }
}
