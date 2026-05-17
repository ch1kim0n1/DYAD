/**
 * Wilson Confidence Interval for Statistical Reporting
 *
 * Provides 95% confidence intervals for binomial proportions.
 * Stable at small n and at extreme p (close to 0 or 1).
 * 
 * Copied from gbrain/src/core/eval-contradictions/calibration.ts
 * for use across the 5 tools.
 */

import { z } from 'zod';

export interface WilsonCI {
  point: number;
  lower: number;
  upper: number;
}

export const WilsonCISchema = z.object({
  point: z.number().min(0).max(1),
  lower: z.number().min(0).max(1),
  upper: z.number().min(0).max(1),
});

/** 95% confidence z-score. */
const Z_95 = 1.959963984540054;

/**
 * Wilson score interval for a binomial proportion at 95% confidence.
 *
 * Returns the point estimate (k/n) and lower/upper bounds. Edge cases:
 * - n === 0: returns all zeros. Caller decides UX.
 * - k > n: clamps k to n.
 * - k < 0: clamps to 0.
 */
export function wilsonCI(numerator: number, denominator: number): WilsonCI {
  if (denominator <= 0) {
    return { point: 0, lower: 0, upper: 0 };
  }
  const k = Math.max(0, Math.min(numerator, denominator));
  const n = denominator;
  const p = k / n;
  const z = Z_95;
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  // Pin exact boundaries: when k === 0 the lower bound must be exactly 0;
  // when k === n the upper bound must be exactly 1. Otherwise floating-point
  // residuals (6e-18, 0.9999...) leak through and confuse callers.
  const lowerRaw = Math.max(0, center - margin);
  const upperRaw = Math.min(1, center + margin);
  return {
    point: p,
    lower: k === 0 ? 0 : lowerRaw,
    upper: k === n ? 1 : upperRaw,
  };
}

/**
 * Format Wilson CI as a percentage string
 */
export function formatWilsonCI(ci: WilsonCI): string {
  return `${(ci.point * 100).toFixed(1)}% [${(ci.lower * 100).toFixed(1)}-${(ci.upper * 100).toFixed(1)}%]`;
}
