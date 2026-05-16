/**
 * Shared tokenizer (tech-stack.md).
 *
 * Uses `wink-nlp` with the lightweight English web model for production
 * tokenization + lemmatization. Falls back to a regex tokenizer when the
 * model fails to load (rare — but graceful is better than crashing).
 *
 * Both lexicon lookup (NRC / AFINN) and the function-word parser flow
 * through here so we have one definition of "word" across the engine.
 */
import winkNLP, { type WinkMethods } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

let _nlp: WinkMethods | null = null;
function nlp(): WinkMethods | null {
  if (_nlp) return _nlp;
  try {
    _nlp = winkNLP(model);
    return _nlp;
  } catch {
    return null;
  }
}

const ITS = nlp()?.its;

/**
 * Tokenize `text` into lowercase word tokens. Punctuation, whitespace,
 * and numbers are dropped. Contractions ("don't") are kept whole — they
 * match entries in the function-word category sets.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const instance = nlp();
  if (instance && ITS) {
    try {
      const doc = instance.readDoc(text);
      const out: string[] = [];
      doc.tokens().each((t: { out: (its: unknown) => string }) => {
        const type = t.out(ITS.type);
        if (type === 'word') out.push(t.out(ITS.normal));
      });
      return out;
    } catch {
      /* fall through to regex */
    }
  }
  return text
    .toLowerCase()
    .replace(/[^\w'\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Sentence segmentation (used by future LLM-extraction chunking). */
export function sentences(text: string): string[] {
  if (!text) return [];
  const instance = nlp();
  if (instance && ITS) {
    try {
      return instance.readDoc(text).sentences().out();
    } catch {
      /* fall through */
    }
  }
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}
