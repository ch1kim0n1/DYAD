import { FeatureVector, NormalizedMessage, BidAsymmetryResult, RelationshipModel } from '@dyad/shared';

const MIN_BID_COUNT = 10;
const SEVERITY_MEDIUM = 0.25;
const SEVERITY_HIGH = 0.50;

/**
 * Bid asymmetry detector — flags when one partner responds to substantially
 * fewer bids than the other.
 *
 * Inputs:
 *   - features:  ordered feature vectors
 *   - messages:  matching NormalizedMessages (for `is_from_me`)
 *
 * `detected` is true when:
 *   - bid_count >= 10
 *   - partner_response_rate < 0.50
 *   - user_response_rate    > 0.70
 */
export class BidAsymmetryDetector {
  detect(features: FeatureVector[], messages: NormalizedMessage[]): BidAsymmetryResult {
    const messageById = new Map(messages.map(m => [m.message_id, m]));

    let selfBids = 0;          // bids the self made → partner_response_rate
    let partnerEngaged = 0;
    let partnerBids = 0;       // bids the partner made → user_response_rate
    let userEngaged = 0;

    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (!f.bid_classification.is_bid) continue;
      const msg = messageById.get(f.message_id);
      if (!msg) continue;

      // Look ahead for the next reply from the other side within 5 features
      for (let j = i + 1; j < Math.min(i + 6, features.length); j++) {
        const next = features[j];
        const nextMsg = messageById.get(next.message_id);
        if (!nextMsg || nextMsg.is_from_me === msg.is_from_me) continue;
        const engaged = next.response_classification.is_response_to_bid &&
          next.response_classification.quality === 'engaged' ? 1 : 0;
        if (msg.is_from_me) {
          selfBids++;
          partnerEngaged += engaged;
        } else {
          partnerBids++;
          userEngaged += engaged;
        }
        break;
      }
    }

    const userResponseRate = partnerBids > 0 ? userEngaged / partnerBids : 0;
    const partnerResponseRate = selfBids > 0 ? partnerEngaged / selfBids : 0;
    const totalBids = selfBids + partnerBids;
    const asymmetry = userResponseRate - partnerResponseRate;
    const severity = this.severity(Math.abs(asymmetry));
    const detected =
      totalBids >= MIN_BID_COUNT &&
      partnerResponseRate < 0.50 &&
      userResponseRate > 0.70;

    return {
      detected,
      user_response_rate: userResponseRate,
      partner_response_rate: partnerResponseRate,
      self_rate: userResponseRate,
      partner_rate: partnerResponseRate,
      gap: Math.abs(userResponseRate - partnerResponseRate),
      asymmetry_score: asymmetry,
      bid_count: totalBids,
      severity,
      gottman_threshold_stable: 0.86,
      gottman_threshold_failing: 0.33,
      sample_size: totalBids,
      confidence: totalBids >= MIN_BID_COUNT ? 0.85 : 0.5,
    };
  }

  /**
   * Convenience: derive the detector result directly from a RelationshipModel.
   * Used by the orchestrator to avoid re-walking message history.
   */
  detectFromModel(model: RelationshipModel, bidCount: number): BidAsymmetryResult {
    const userRate = model.bid_response_rate.user_response_rate;
    const partnerRate = model.bid_response_rate.partner_response_rate;
    const asymmetry = userRate - partnerRate;
    const severity = this.severity(Math.abs(asymmetry));
    const detected = bidCount >= MIN_BID_COUNT && partnerRate < 0.50 && userRate > 0.70; // Calibrated on demo corpus
    return {
      detected,
      user_response_rate: userRate,
      partner_response_rate: partnerRate,
      self_rate: userRate,
      partner_rate: partnerRate,
      gap: Math.abs(userRate - partnerRate),
      asymmetry_score: asymmetry,
      bid_count: bidCount,
      severity,
      gottman_threshold_stable: 0.86,
      gottman_threshold_failing: 0.33,
      sample_size: bidCount,
      confidence: bidCount >= MIN_BID_COUNT ? 0.85 : 0.5,
    };
  }

  private severity(score: number): 'low' | 'medium' | 'high' {
    if (score >= SEVERITY_HIGH) return 'high';
    if (score >= SEVERITY_MEDIUM) return 'medium';
    return 'low';
  }
}
