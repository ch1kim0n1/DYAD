/**
 * NOUS Ethics Gate — filters outbound claims based on ethical rules.
 *
 * Rules:
 *   - No speculation about partner's mental health
 *   - No pathologizing of normal relationship dynamics
 *   - No claims that could enable stalking or harassment
 *   - Preserve user privacy (no PII in outbound claims)
 *
 * Returns EthicsVerdict with filtered_claims and blocked_claims.
 */
import type {
  OutboundClaim,
  EthicsVerdict,
  EthicalRefusalResult,
  CrisisResource,
} from '@dyad/shared';

// ════════════════════════════════════════════════════════════════════════════
// Ethical rules
// ════════════════════════════════════════════════════════════════════════════

interface EthicalRule {
  name: string;
  check(claim: OutboundClaim): boolean; // Returns true if blocked
  reason: string;
}

const ETHICAL_RULES: EthicalRule[] = [
  {
    name: 'mental_health_speculation',
    check: (claim) => {
      const forbidden = ['depressed', 'anxious', 'bipolar', 'narcissist', 'psychopath', 'personality disorder'];
      const lower = claim.text.toLowerCase();
      return forbidden.some(term => lower.includes(term));
    },
    reason: 'Speculation about mental health conditions is not permitted',
  },
  {
    name: 'pathologizing',
    check: (claim) => {
      const forbidden = ['toxic', 'abusive', 'manipulative', 'gaslighting', 'red flag'];
      const lower = claim.text.toLowerCase();
      return forbidden.some(term => lower.includes(term));
    },
    reason: 'Pathologizing normal relationship dynamics is not permitted without clinical context',
  },
  {
    name: 'stalking_enabling',
    check: (claim) => {
      const forbidden = ['location', 'address', 'phone', 'email', 'social security', 'main st', 'street'];
      const lower = claim.text.toLowerCase();
      return forbidden.some(term => lower.includes(term));
    },
    reason: 'PII that could enable stalking or harassment is not permitted',
  },
  {
    name: 'confidence_threshold',
    check: (claim) => {
      return claim.confidence < 0.5;
    },
    reason: 'Claims with low confidence (< 0.5) are not permitted',
  },
];

// ════════════════════════════════════════════════════════════════════════════
// Ethics Gate
// ════════════════════════════════════════════════════════════════════════════

export interface EthicsGateOptions {
  rules?: EthicalRule[];
  strictMode?: boolean; // Default: false
}

export class EthicsGate {
  private rules: EthicalRule[];
  private strictMode: boolean;

  constructor(options: EthicsGateOptions = {}) {
    this.rules = options.rules || ETHICAL_RULES;
    this.strictMode = options.strictMode || false;
  }

  /**
   * Filter claims through ethical rules.
   */
  filter(claims: OutboundClaim[]): EthicsVerdict {
    const filtered_claims: OutboundClaim[] = [];
    const blocked_claims: { claim: OutboundClaim; reason: string }[] = [];

    for (const claim of claims) {
      const blockedBy = this.rules.find(rule => rule.check(claim));

      if (blockedBy) {
        blocked_claims.push({
          claim,
          reason: blockedBy.reason,
        });
      } else {
        filtered_claims.push(claim);
      }
    }

    const triggered_refusal: EthicalRefusalResult | null = blocked_claims.length > 0
      ? {
          safe: false,
          should_refuse: true,
          triggers: ['abuse' as const],
          category: 'abuse',
          confidence: 0.9,
          referral_resources: [] as string[],
          crisis_resources: [] as CrisisResource[],
        }
      : null;

    return {
      allowed: blocked_claims.length === 0,
      filtered_claims,
      blocked_claims,
      triggered_refusal,
    };
  }

  /**
   * Check if a single claim is allowed.
   */
  isAllowed(claim: OutboundClaim): boolean {
    const verdict = this.filter([claim]);
    return verdict.allowed;
  }
}
