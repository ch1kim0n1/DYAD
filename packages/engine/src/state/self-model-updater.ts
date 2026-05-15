import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FeatureVector, NormalizedMessage, SelfModel } from '@dyad/shared';

const DEFAULT_DIR = path.join(os.homedir(), '.dyad');

/**
 * SelfModelUpdater — maintains a rolling psychological profile of the *self*
 * (i.e. the device owner). Only features from `is_from_me === true` messages
 * are absorbed.
 *
 * Internally applies exponential decay (α = 0.1) to baseline rates.
 */
export class SelfModelUpdater {
  private readonly decayFactor: number = 0.9;   // 1 - α
  private storagePath: string;
  private model: SelfModel;

  constructor(userId: string, storageDir: string = DEFAULT_DIR) {
    this.storagePath = path.join(storageDir, `self-model.json`);
    const loaded = this.tryLoad();
    this.model = loaded ?? this.createEmpty(userId);
  }

  /**
   * Absorb a batch of feature vectors. `messages` is used to filter to
   * self-authored messages (is_from_me === true). Features without a
   * matching message are skipped to enforce the "only self" rule.
   */
  update(features: FeatureVector[], messages: NormalizedMessage[]): SelfModel {
    const selfMessageIds = new Set(
      messages.filter(m => m.is_from_me).map(m => m.message_id)
    );
    for (const f of features) {
      if (!selfMessageIds.has(f.message_id)) continue;
      this.absorbOne(f);
    }
    this.model.updated_at = new Date().toISOString();
    return this.getModel();
  }

  private absorbOne(f: FeatureVector): void {
    this.model.horseman_profile = {
      criticism: this.ema(this.model.horseman_profile.criticism, f.horseman_markers.criticism ? 1 : 0),
      contempt: this.ema(this.model.horseman_profile.contempt, f.horseman_markers.contempt ? 1 : 0),
      defensiveness: this.ema(this.model.horseman_profile.defensiveness, f.horseman_markers.defensiveness ? 1 : 0),
      stonewalling: this.ema(this.model.horseman_profile.stonewalling, f.horseman_markers.stonewalling ? 1 : 0),
    };

    if (f.response_classification.is_response_to_bid) {
      const engaged = f.response_classification.quality === 'engaged' ? 1 : 0;
      this.model.bid_responsiveness_baseline = this.ema(this.model.bid_responsiveness_baseline, engaged);
    }

    const actionHigh = f.action_id_level === 'high' ? 1 : 0;
    this.model.action_id_asymmetry = this.ema(this.model.action_id_asymmetry, actionHigh);

    this.model.attachment_indicators = this.updateAttachmentIndicators(f);

    if (this.isTemplateCandidate(f)) {
      this.model.recurring_templates = this.addOrUpdateTemplate(f);
    }
  }

  getModel(): SelfModel {
    return { ...this.model };
  }

  /** Persist to `~/.dyad/self-model.json`. */
  save(): void {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storagePath, JSON.stringify(this.model, null, 2), 'utf8');
  }

  createEmpty(userId: string): SelfModel {
    return {
      user_id: userId,
      attachment_indicators: { secure: 0.25, anxious: 0.25, avoidant: 0.25, disorganized: 0.25, confidence: 0 },
      horseman_profile: { criticism: 0, contempt: 0, defensiveness: 0, stonewalling: 0 },
      bid_responsiveness_baseline: 0.5,
      action_id_asymmetry: 0.5,
      recurring_templates: [],
      updated_at: new Date().toISOString(),
    };
  }

  private tryLoad(): SelfModel | null {
    try {
      if (!fs.existsSync(this.storagePath)) return null;
      return JSON.parse(fs.readFileSync(this.storagePath, 'utf8')) as SelfModel;
    } catch {
      return null;
    }
  }

  private ema(current: number, sample: number): number {
    return current * this.decayFactor + sample * (1 - this.decayFactor);
  }

  private updateAttachmentIndicators(f: FeatureVector): SelfModel['attachment_indicators'] {
    const validation =
      (f.validation_markers.acknowledges ? 1 : 0) +
      (f.validation_markers.paraphrases ? 1 : 0) +
      (f.validation_markers.asks_to_understand ? 1 : 0);
    const validationScore = validation / 3;
    const horsemanScore = (
      (f.horseman_markers.criticism ? 1 : 0) +
      (f.horseman_markers.contempt ? 1 : 0) +
      (f.horseman_markers.defensiveness ? 1 : 0) +
      (f.horseman_markers.stonewalling ? 1 : 0)
    ) / 4;

    let { secure, anxious, avoidant, disorganized } = this.model.attachment_indicators;
    if (validationScore > 0.6 && horsemanScore < 0.25) secure = this.ema(secure, 1);
    else if (horsemanScore > 0.5) disorganized = this.ema(disorganized, 1);
    else if (f.horseman_markers.defensiveness || f.horseman_markers.stonewalling) avoidant = this.ema(avoidant, 1);
    else if (f.horseman_markers.criticism || f.horseman_markers.contempt) anxious = this.ema(anxious, 1);

    const total = secure + anxious + avoidant + disorganized;
    if (total > 0) {
      secure /= total; anxious /= total; avoidant /= total; disorganized /= total;
    }
    return {
      secure, anxious, avoidant, disorganized,
      confidence: Math.max(secure, anxious, avoidant, disorganized),
    };
  }

  private isTemplateCandidate(f: FeatureVector): boolean {
    return f.higgins_family !== null && f.topic_tags.length > 0 && f.primary_emotion.confidence > 0.7;
  }

  private addOrUpdateTemplate(f: FeatureVector) {
    const pattern = f.topic_tags.join(' ');
    const idx = this.model.recurring_templates.findIndex(t => t.trigger_pattern === pattern);
    const entry = {
      template_id: f.message_id,
      description: `${f.higgins_family} pattern with ${f.primary_emotion.label}`,
      trigger_pattern: pattern,
      confidence: f.primary_emotion.confidence,
    };
    if (idx >= 0) {
      const next = [...this.model.recurring_templates];
      next[idx] = entry;
      return next;
    }
    return [...this.model.recurring_templates, entry];
  }
}
