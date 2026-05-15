import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  FeatureVector,
  NormalizedMessage,
  PartnerModel,
  CommunicationFingerprint,
  AttachmentIndicators,
  TriggerProfile,
} from '@dyad/shared';

const DEFAULT_DIR = path.join(os.homedir(), '.dyad');

/**
 * PartnerModelUpdater — maintains a rolling profile of the *partner*
 * (only `is_from_me === false` messages absorbed). Persists to
 * `~/.dyad/partner-model-<dyadId>.json`.
 */
export class PartnerModelUpdater {
  private readonly decayFactor: number = 0.95;
  private storagePath: string;
  private model: PartnerModel;

  constructor(dyadId: string, partnerId: string, storageDir: string = DEFAULT_DIR) {
    this.storagePath = path.join(storageDir, `partner-model-${dyadId}.json`);
    const loaded = this.tryLoad();
    this.model = loaded ?? this.createEmpty(dyadId, partnerId);
  }

  update(features: FeatureVector[], messages: NormalizedMessage[]): PartnerModel {
    const partnerIds = new Set(messages.filter(m => !m.is_from_me).map(m => m.message_id));
    for (const f of features) {
      if (!partnerIds.has(f.message_id)) continue;
      this.absorbOne(f);
    }
    this.model.updated_at = new Date().toISOString();
    return this.getModel();
  }

  private absorbOne(f: FeatureVector): void {
    this.model.communication_fingerprint = this.updateFingerprint(this.model.communication_fingerprint, f);
    this.model.attachment_inference = this.updateAttachmentInference(this.model.attachment_inference, f);
    this.model.bid_signature = this.updateBidSignature(this.model.bid_signature, f);
    if (f.primary_emotion.intensity === 'high' && f.primary_emotion.confidence > 0.7) {
      this.model.trigger_profile = this.updateTriggerProfile(this.model.trigger_profile, f);
    }
  }

  getModel(): PartnerModel {
    return { ...this.model };
  }

  save(): void {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storagePath, JSON.stringify(this.model, null, 2), 'utf8');
  }

  addExternalContext(source: string, content: string, relevanceScore: number = 1.0): void {
    this.model.external_context_bundle.push({
      source, content, timestamp: new Date().toISOString(), relevance_score: relevanceScore,
    });
    this.model.updated_at = new Date().toISOString();
  }

  createEmpty(dyadId: string, partnerId: string): PartnerModel {
    return {
      dyad_id: dyadId,
      partner_id: partnerId,
      communication_fingerprint: {
        avg_response_time_ms: 0,
        message_length_mean: 0,
        emoji_usage_rate: 0,
        question_frequency: 0,
      },
      attachment_inference: { secure: 0.25, anxious: 0.25, avoidant: 0.25, disorganized: 0.25, confidence: 0 },
      external_context_bundle: [],
      trigger_profile: [],
      bid_signature: { bid_types: {}, response_quality_distribution: {} },
      updated_at: new Date().toISOString(),
    };
  }

  private tryLoad(): PartnerModel | null {
    try {
      if (!fs.existsSync(this.storagePath)) return null;
      return JSON.parse(fs.readFileSync(this.storagePath, 'utf8')) as PartnerModel;
    } catch {
      return null;
    }
  }

  private updateFingerprint(current: CommunicationFingerprint, f: FeatureVector): CommunicationFingerprint {
    const hasEmoji = f.nrc_joy > 0.3 || f.nrc_trust > 0.3;
    const isQuestion = f.bid_classification.bid_type === 'question';
    return {
      avg_response_time_ms: this.ema(current.avg_response_time_ms, Math.abs(f.latency_z_score) * 1000),
      message_length_mean: this.ema(current.message_length_mean, f.topic_tags.length),
      emoji_usage_rate: this.ema(current.emoji_usage_rate, hasEmoji ? 1 : 0),
      question_frequency: this.ema(current.question_frequency, isQuestion ? 1 : 0),
    };
  }

  private updateAttachmentInference(current: AttachmentIndicators, f: FeatureVector): AttachmentIndicators {
    const validationScore =
      ((f.validation_markers.acknowledges ? 1 : 0) +
        (f.validation_markers.paraphrases ? 1 : 0) +
        (f.validation_markers.asks_to_understand ? 1 : 0)) / 3;
    const horsemanScore =
      ((f.horseman_markers.criticism ? 1 : 0) +
        (f.horseman_markers.contempt ? 1 : 0) +
        (f.horseman_markers.defensiveness ? 1 : 0) +
        (f.horseman_markers.stonewalling ? 1 : 0)) / 4;

    let { secure, anxious, avoidant, disorganized } = current;
    if (validationScore > 0.6 && horsemanScore < 0.25) secure = this.ema(secure, 1);
    else if (horsemanScore > 0.5) disorganized = this.ema(disorganized, 1);
    else if (f.horseman_markers.defensiveness || f.horseman_markers.stonewalling) avoidant = this.ema(avoidant, 1);
    else if (f.horseman_markers.criticism || f.horseman_markers.contempt) anxious = this.ema(anxious, 1);

    const total = secure + anxious + avoidant + disorganized;
    if (total > 0) { secure /= total; anxious /= total; avoidant /= total; disorganized /= total; }
    return {
      secure, anxious, avoidant, disorganized,
      confidence: Math.max(secure, anxious, avoidant, disorganized),
    };
  }

  private updateBidSignature(
    current: { bid_types: Record<string, number>; response_quality_distribution: Record<string, number> },
    f: FeatureVector
  ) {
    const bidTypes = { ...current.bid_types };
    const responseQualities = { ...current.response_quality_distribution };
    if (f.bid_classification.is_bid && f.bid_classification.bid_type) {
      const t = f.bid_classification.bid_type;
      bidTypes[t] = (bidTypes[t] || 0) + 1;
    }
    if (f.response_classification.is_response_to_bid && f.response_classification.quality) {
      const q = f.response_classification.quality;
      responseQualities[q] = (responseQualities[q] || 0) + 1;
    }
    return { bid_types: bidTypes, response_quality_distribution: responseQualities };
  }

  private updateTriggerProfile(current: TriggerProfile[], f: FeatureVector): TriggerProfile[] {
    const pattern = f.topic_tags.join(' ');
    const idx = current.findIndex(t => t.trigger_pattern === pattern);
    const entry: TriggerProfile = {
      trigger_pattern: pattern,
      typical_response: `${f.primary_emotion.label} (${f.primary_emotion.intensity})`,
      frequency: 1,
    };
    if (idx >= 0) {
      const next = [...current];
      next[idx] = { ...entry, frequency: current[idx].frequency + 1 };
      return next;
    }
    return [...current, entry];
  }

  private ema(current: number, sample: number): number {
    return current * this.decayFactor + sample * (1 - this.decayFactor);
  }
}
