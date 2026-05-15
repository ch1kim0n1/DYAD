import { FeatureVector } from '@dyad/shared';

/**
 * Fingerprint extraction utilities
 */

export interface Fingerprint {
  valence: number;
  arousal: number;
  dominance: number;
  horseman: number;
  validation: number;
  action_id: number;
}

/**
 * Extract behavioral fingerprint from feature vector
 */
export function extractFingerprint(features: FeatureVector): Fingerprint {
  return {
    valence: features.afinn_valence / 5, // Normalize to -1 to 1
    arousal: calculateArousal(features),
    dominance: calculateDominance(features),
    horseman: calculateHorsemanScore(features),
    validation: calculateValidationScore(features),
    action_id: features.action_id_level === 'high' ? 1 : 0,
  };
}

/**
 * Calculate arousal from NRC emotions
 */
function calculateArousal(features: FeatureVector): number {
  // High arousal: anger, fear, joy
  // Low arousal: sadness, trust, anticipation
  const highArousal = features.nrc_anger + features.nrc_fear + features.nrc_joy;
  const lowArousal = features.nrc_sadness + features.nrc_trust + features.nrc_anticipation;
  return highArousal - lowArousal;
}

/**
 * Calculate dominance from function words and markers
 */
function calculateDominance(features: FeatureVector): number {
  // Dominance indicated by you/absolutist language, low first-person singular
  return features.fw_you + features.fw_abs - features.fw_i;
}

/**
 * Calculate horseman score
 */
function calculateHorsemanScore(features: FeatureVector): number {
  const markers = features.horseman_markers;
  let score = 0;
  if (markers.criticism) score += 1;
  if (markers.contempt) score += 1;
  if (markers.defensiveness) score += 1;
  if (markers.stonewalling) score += 1;
  return score / 4;
}

/**
 * Calculate validation score
 */
function calculateValidationScore(features: FeatureVector): number {
  const markers = features.validation_markers;
  let score = 0;
  if (markers.acknowledges) score += 1;
  if (markers.paraphrases) score += 1;
  if (markers.asks_to_understand) score += 1;
  return score / 3;
}

/**
 * Compare two fingerprints for similarity
 */
export function compareFingerprints(fp1: Fingerprint, fp2: Fingerprint): number {
  const vec1 = Object.values(fp1);
  const vec2 = Object.values(fp2);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}
