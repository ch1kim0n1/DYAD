import nrcEmotionLexicon from './nrc-emotion-lexicon.json';
import afinn111 from './afinn-111.json';

export type NRCEmotionWord = {
  joy?: number | boolean;
  trust?: number | boolean;
  fear?: number | boolean;
  surprise?: number | boolean;
  sadness?: number | boolean;
  disgust?: number | boolean;
  anger?: number | boolean;
  anticipation?: number | boolean;
  positive?: number | boolean;
  negative?: number | boolean;
};

export const NRC_EMOTION_LEXICON: Record<string, NRCEmotionWord> =
  nrcEmotionLexicon as Record<string, NRCEmotionWord>;

export const AFINN_111: Record<string, number> = afinn111 as Record<string, number>;

export const INTENSIFIERS: ReadonlySet<string> = new Set([
  'very', 'really', 'extremely', 'absolutely', 'completely', 'totally',
  'utterly', 'highly', 'deeply', 'intensely', 'incredibly', 'remarkably',
  'so', 'too', 'quite', 'super',
]);
