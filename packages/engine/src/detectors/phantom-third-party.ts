import { FeatureVector, PhantomThirdPartyResult } from '@dyad/shared';

const MIN_WINDOW = 10;
const RATIO_THRESHOLD = 0.5;     // third_person > 0.5 × (first+second person)

/**
 * Phantom third-party detector — flags conversations dominated by talk
 * about an absent person (e.g. ex-partner, parent), indicated by
 * third-person pronoun rate dominating first/second-person rate over
 * the last `MIN_WINDOW` messages.
 *
 * Uses `fw_third` from the function-word parser (issue #29 extension).
 */
export class PhantomThirdPartyDetector {
  detect(features: FeatureVector[]): PhantomThirdPartyResult {
    const window = features.slice(-MIN_WINDOW);
    if (window.length < MIN_WINDOW) {
      return {
        detected: false,
        third_person_rate: 0,
        first_second_person_rate: 0,
        ratio: 0,
        message_window: window.length,
      };
    }

    const thirdRate = mean(window.map(f => f.fw_third));
    const firstSecondRate = mean(window.map(f => f.fw_i + f.fw_we + f.fw_you));
    const ratio = firstSecondRate === 0
      ? (thirdRate > 0 ? Infinity : 0)
      : thirdRate / firstSecondRate;
    const detected = ratio > RATIO_THRESHOLD && thirdRate > 0;

    return {
      detected,
      third_person_rate: thirdRate,
      first_second_person_rate: firstSecondRate,
      ratio,
      message_window: MIN_WINDOW,
    };
  }
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
