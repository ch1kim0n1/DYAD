import { tokenize as winkTokenize } from './tokenizer.js';

/**
 * Function-word parser — Pennebaker LIWC-style categories.
 * Rates returned as fraction of total tokens (0..1).
 * Tokenization goes through the shared wink-nlp tokenizer.
 */
export interface FunctionWordRates {
  fw_i: number;
  fw_we: number;
  fw_you: number;
  fw_abs: number;
  fw_tent: number;
  fw_cog: number;
  fw_third: number;
}

export class FunctionWordParser {
  private categories: Record<keyof FunctionWordRates, Set<string>> = {
    fw_i: new Set(['i', "i'm", "i've", "i'll", "i'd", 'me', 'my', 'mine', 'myself']),
    fw_we: new Set(['we', "we're", "we've", "we'll", 'us', 'our', 'ours', 'ourselves']),
    fw_you: new Set(['you', "you're", "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'yourselves']),
    fw_third: new Set([
      'he', "he's", 'him', 'his', 'himself',
      'she', "she's", 'her', 'hers', 'herself',
      'they', "they're", "they've", "they'll", 'them', 'their', 'theirs', 'themselves',
    ]),
    fw_abs: new Set(['always', 'never', 'every', 'all', 'none', 'nothing', 'everything', 'everyone', 'nobody', 'completely', 'absolutely', 'totally', 'entirely', 'forever']),
    fw_tent: new Set(['maybe', 'perhaps', 'possibly', 'might', 'could', 'would', 'should', 'seems', 'appears', 'guess', 'suppose', 'somewhat', 'kind', 'sort']),
    fw_cog: new Set(['think', 'thought', 'know', 'knew', 'believe', 'understand', 'realize', 'consider', 'because', 'reason', 'since', 'cause', 'effect', 'why', 'how']),
  };

  parse(text: string): FunctionWordRates {
    const words = this.tokenize(text);
    const total = words.length;
    if (total === 0) {
      return { fw_i: 0, fw_we: 0, fw_you: 0, fw_abs: 0, fw_tent: 0, fw_cog: 0, fw_third: 0 };
    }
    const counts: FunctionWordRates = { fw_i: 0, fw_we: 0, fw_you: 0, fw_abs: 0, fw_tent: 0, fw_cog: 0, fw_third: 0 };
    for (const word of words) {
      for (const key of Object.keys(this.categories) as (keyof FunctionWordRates)[]) {
        if (this.categories[key].has(word)) counts[key]++;
      }
    }
    for (const key of Object.keys(counts) as (keyof FunctionWordRates)[]) {
      counts[key] = counts[key] / total;
    }
    return counts;
  }

  private tokenize(text: string): string[] { return winkTokenize(text); }
}
