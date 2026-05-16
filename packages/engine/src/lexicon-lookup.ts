import { NRC_EMOTION_LEXICON, AFINN_111, INTENSIFIERS, type NRCEmotionWord } from '@dyad/lexicons';
import { tokenize } from './tokenizer.js';

export interface NRCEmotions {
  joy: boolean;
  trust: boolean;
  fear: boolean;
  surprise: boolean;
  sadness: boolean;
  disgust: boolean;
  anger: boolean;
  anticipation: boolean;
  positive: boolean;
  negative: boolean;
}

export interface NRCScores {
  nrc_joy: number;
  nrc_trust: number;
  nrc_fear: number;
  nrc_surprise: number;
  nrc_sadness: number;
  nrc_disgust: number;
  nrc_anger: number;
  nrc_anticipation: number;
  nrc_positive: number;
  nrc_negative: number;
}

export interface AFINNResult {
  afinn_valence: number;
  intensifier_rate: number;
}

const EMOTION_KEYS: (keyof NRCEmotionWord)[] = [
  'joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust',
  'anger', 'anticipation', 'positive', 'negative',
];

/**
 * Fast in-memory NRC + AFINN word scoring.
 * Lexicons are bundled via @dyad/lexicons — no filesystem reads at runtime.
 */
export class LexiconLookup {
  private nrcLexicon: Map<string, NRCEmotions>;
  private afinnLexicon: Map<string, number>;
  private intensifiers: ReadonlySet<string>;

  constructor() {
    this.nrcLexicon = new Map();
    this.afinnLexicon = new Map();
    this.intensifiers = INTENSIFIERS;

    for (const [word, raw] of Object.entries(NRC_EMOTION_LEXICON)) {
      const entry: NRCEmotions = {
        joy: false, trust: false, fear: false, surprise: false,
        sadness: false, disgust: false, anger: false, anticipation: false,
        positive: false, negative: false,
      };
      for (const key of EMOTION_KEYS) {
        const v = raw[key];
        entry[key] = typeof v === 'number' ? v > 0 : Boolean(v);
      }
      this.nrcLexicon.set(word.toLowerCase(), entry);
    }

    for (const [word, score] of Object.entries(AFINN_111)) {
      this.afinnLexicon.set(word.toLowerCase(), score);
    }
  }

  getNRCEmotions(word: string): NRCEmotions | null {
    return this.nrcLexicon.get(word.toLowerCase()) ?? null;
  }

  getAFINNScore(word: string): number {
    return this.afinnLexicon.get(word.toLowerCase()) ?? 0;
  }

  isIntensifier(word: string): boolean {
    return this.intensifiers.has(word.toLowerCase());
  }

  calculateNRCScores(text: string): NRCScores {
    const words = this.tokenize(text);
    const scores: NRCScores = {
      nrc_joy: 0, nrc_trust: 0, nrc_fear: 0, nrc_surprise: 0,
      nrc_sadness: 0, nrc_disgust: 0, nrc_anger: 0, nrc_anticipation: 0,
      nrc_positive: 0, nrc_negative: 0,
    };
    if (words.length === 0) return scores;

    for (const word of words) {
      const e = this.getNRCEmotions(word);
      if (!e) continue;
      if (e.joy) scores.nrc_joy++;
      if (e.trust) scores.nrc_trust++;
      if (e.fear) scores.nrc_fear++;
      if (e.surprise) scores.nrc_surprise++;
      if (e.sadness) scores.nrc_sadness++;
      if (e.disgust) scores.nrc_disgust++;
      if (e.anger) scores.nrc_anger++;
      if (e.anticipation) scores.nrc_anticipation++;
      if (e.positive) scores.nrc_positive++;
      if (e.negative) scores.nrc_negative++;
    }

    for (const key of Object.keys(scores) as (keyof NRCScores)[]) {
      scores[key] /= words.length;
    }
    return scores;
  }

  calculateAFINNValence(text: string): AFINNResult {
    const words = this.tokenize(text);
    if (words.length === 0) return { afinn_valence: 0, intensifier_rate: 0 };

    let totalScore = 0;
    let intensifierCount = 0;
    let scoredWords = 0;

    for (let i = 0; i < words.length; i++) {
      const score = this.getAFINNScore(words[i]);
      if (score === 0) continue;
      let multiplier = 1;
      if (i > 0 && this.isIntensifier(words[i - 1])) {
        multiplier = 1.5;
        intensifierCount++;
      }
      totalScore += score * multiplier;
      scoredWords++;
    }

    const afinn_valence = scoredWords > 0
      ? Math.max(-5, Math.min(5, totalScore / scoredWords))
      : 0;
    return {
      afinn_valence,
      intensifier_rate: intensifierCount / words.length,
    };
  }

  // Delegates to the shared wink-nlp tokenizer (tokenizer.ts) so both the
  // function-word parser and lexicon lookup agree on what "a word" is.
  private tokenize(text: string): string[] { return tokenize(text); }
}
