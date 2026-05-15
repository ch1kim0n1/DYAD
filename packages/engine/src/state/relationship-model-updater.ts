import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  FeatureVector,
  NormalizedMessage,
  RelationshipModel,
  RuptureRepairEvent,
  OpenLoop,
} from '@dyad/shared';
import { computeRepairLaborIndex } from './repair-labor.js';
import { computeMirroringIndex } from './mirroring-index.js';
import { secureWriteFile } from '../secure-fs.js';

const DEFAULT_DIR = path.join(os.homedir(), '.dyad');

const GOTTMAN_STABLE_RESPONSE_RATE = 0.86;
const GOTTMAN_FAILING_RESPONSE_RATE = 0.33;
const GOTTMAN_STABLE_RATIO = 5.0;

/**
 * RelationshipModelUpdater — tracks dyadic patterns from both sides.
 *
 * Persists to `~/.dyad/relationship-model.json`.
 */
export class RelationshipModelUpdater {
  private readonly ruptureThreshold: number = 3;
  private readonly ruptureWindow: number = 10;
  private storagePath: string;
  private model: RelationshipModel;

  constructor(dyadId: string, storageDir: string = DEFAULT_DIR) {
    this.storagePath = path.join(storageDir, `relationship-model.json`);
    const loaded = this.tryLoad();
    this.model = loaded ?? this.createEmpty(dyadId);
  }

  update(features: FeatureVector[], messages: NormalizedMessage[]): RelationshipModel {
    this.model.bid_response_rate = this.calculateBidResponseRates(features, messages);
    this.model.five_to_one_ratio = this.calculateFiveToOneRatio(features);
    this.model.repair_labor_index = computeRepairLaborIndex(features, messages);
    this.model.mirroring_index = computeMirroringIndex(features, messages);
    this.model.rupture_repair_ledger = this.updateRuptureRepairLedger(features);
    this.model.open_loops = this.updateOpenLoops(features);
    this.model.gottman_status = this.computeGottmanStatus(
      this.model.bid_response_rate.partner_response_rate,
      this.model.five_to_one_ratio
    );
    this.model.updated_at = new Date().toISOString();
    return this.getModel();
  }

  getModel(): RelationshipModel {
    return { ...this.model };
  }

  /** Persist to `~/.dyad/relationship-model.json` with 0600 / 0700 perms. */
  save(): void {
    secureWriteFile(this.storagePath, JSON.stringify(this.model, null, 2));
  }

  createEmpty(dyadId: string): RelationshipModel {
    return {
      dyad_id: dyadId,
      ppr_bidirectional: { user_to_partner: 0.5, partner_to_user: 0.5 },
      five_to_one_ratio: 5.0,
      bid_response_rate: { user_response_rate: 0.5, partner_response_rate: 0.5 },
      repair_labor_index: 0,
      mirroring_index: 0,
      gottman_status: 'warning',
      open_loops: [],
      rupture_repair_ledger: [],
      updated_at: new Date().toISOString(),
    };
  }

  private tryLoad(): RelationshipModel | null {
    try {
      if (!fs.existsSync(this.storagePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(this.storagePath, 'utf8')) as RelationshipModel;
      // Hydrate gottman_status if loaded from older snapshot
      if (!('gottman_status' in parsed)) (parsed as RelationshipModel).gottman_status = 'warning';
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Gottman thresholds:
   *   stable:  partner_response_rate ≥ 0.86 AND positive:negative ≥ 5
   *   failing: partner_response_rate < 0.33
   *   warning: everything in between
   */
  private computeGottmanStatus(partnerRate: number, ratio: number): 'stable' | 'warning' | 'failing' {
    if (partnerRate < GOTTMAN_FAILING_RESPONSE_RATE) return 'failing';
    if (partnerRate >= GOTTMAN_STABLE_RESPONSE_RATE && ratio >= GOTTMAN_STABLE_RATIO) return 'stable';
    return 'warning';
  }

  private calculateBidResponseRates(
    features: FeatureVector[],
    messages: NormalizedMessage[]
  ): { user_response_rate: number; partner_response_rate: number } {
    const messageById = new Map(messages.map(m => [m.message_id, m]));
    let userBids = 0, userEngaged = 0;
    let partnerBids = 0, partnerEngaged = 0;

    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (!f.bid_classification.is_bid) continue;
      const msg = messageById.get(f.message_id);
      if (!msg) continue;

      // Find next message from the *other* side within 5 features
      for (let j = i + 1; j < Math.min(i + 6, features.length); j++) {
        const next = features[j];
        const nextMsg = messageById.get(next.message_id);
        if (!nextMsg || nextMsg.is_from_me === msg.is_from_me) continue;
        if (!next.response_classification.is_response_to_bid) break;
        const engaged = next.response_classification.quality === 'engaged' ? 1 : 0;
        if (msg.is_from_me) {
          // Self bid → partner response rate
          partnerBids++;
          partnerEngaged += engaged;
        } else {
          // Partner bid → user (self) response rate
          userBids++;
          userEngaged += engaged;
        }
        break;
      }
    }

    return {
      user_response_rate: userBids > 0 ? userEngaged / userBids : 0.5,
      partner_response_rate: partnerBids > 0 ? partnerEngaged / partnerBids : 0.5,
    };
  }

  private calculateFiveToOneRatio(features: FeatureVector[]): number {
    let pos = 0, neg = 0;
    for (const f of features) {
      const hasHorseman = Object.values(f.horseman_markers).some(v => v);
      if (f.afinn_valence > 0 && !hasHorseman) pos++;
      else if (f.afinn_valence < 0 || hasHorseman) neg++;
    }
    return neg > 0 ? pos / neg : 10.0;
  }

  private updateRuptureRepairLedger(features: FeatureVector[]): RuptureRepairEvent[] {
    const ledger = [...this.model.rupture_repair_ledger];
    const recent = features.slice(-this.ruptureWindow);

    const horsemanFeatures = recent.filter(f => Object.values(f.horseman_markers).some(v => v));
    if (horsemanFeatures.length >= this.ruptureThreshold) {
      const lastRupture = ledger.filter(e => e.type === 'rupture').pop();
      if (!lastRupture || lastRupture.status !== 'open') {
        ledger.push({
          event_id: `rupture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'rupture',
          timestamp: new Date().toISOString(),
          status: 'open',
          source_message_ids: horsemanFeatures.map(f => f.message_id),
          confidence: horsemanFeatures.length / this.ruptureWindow,
        });
      }
    }

    const validationFeatures = recent.filter(f =>
      f.validation_markers.acknowledges || f.validation_markers.paraphrases || f.validation_markers.asks_to_understand
    );
    const openRupture = ledger.filter(e => e.type === 'rupture' && e.status === 'open').pop();
    if (openRupture && validationFeatures.length >= 2) {
      openRupture.status = 'closed';
      ledger.push({
        event_id: `repair-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'repair',
        timestamp: new Date().toISOString(),
        status: 'closed',
        source_message_ids: validationFeatures.map(f => f.message_id),
        confidence: validationFeatures.length / this.ruptureWindow,
      });
    }
    return ledger;
  }

  private updateOpenLoops(features: FeatureVector[]): OpenLoop[] {
    const loops = [...this.model.open_loops];
    for (const f of features) {
      if (
        f.bid_classification.bid_type === 'question' &&
        f.response_classification.quality === 'missed'
      ) {
        if (!loops.find(l => l.source_message_ids.includes(f.message_id))) {
          loops.push({
            loop_id: `loop-${f.message_id}`,
            description: `Unanswered question about ${f.topic_tags.join(', ') || 'topic'}`,
            opened_at: new Date().toISOString(),
            source_message_ids: [f.message_id],
          });
        }
      }
    }
    return loops;
  }
}

export const RELATIONSHIP_THRESHOLDS = {
  stableResponseRate: GOTTMAN_STABLE_RESPONSE_RATE,
  failingResponseRate: GOTTMAN_FAILING_RESPONSE_RATE,
  stableRatio: GOTTMAN_STABLE_RATIO,
};
