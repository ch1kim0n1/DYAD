import type { RelationshipModel, SelfModel, PartnerModel } from '@dyad/shared';
import { computeHealthScore, computeRelationshipTrend } from '@dyad/engine';
import { OfflineBadge } from '../components/OfflineBadge.js';
import { useDyadStore } from '../store.js';

interface AtlasViewProps {
  model: RelationshipModel | null;
  selfModel: SelfModel | null;
  partnerModel: PartnerModel | null;
}

function bandColour(band: string): string {
  if (band === 'Thriving' || band === 'Stable') return 'var(--green)';
  if (band === 'Navigating') return 'var(--amber)';
  return 'var(--red)';
}

function directionArrow(d: string): string {
  if (d === 'up_better' || d === 'down_better') return '✓';
  if (d === 'up_worse' || d === 'down_worse') return '⚠';
  return '–';
}
function deltaSign(d: string, pct: number): string {
  if (d === 'flat') return '0%';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${Math.round(pct * 100)}%`;
}

export function AtlasView({ model, selfModel, partnerModel }: AtlasViewProps) {
  const partnerName = useDyadStore((s) => s.partnerName);
  const previous = useDyadStore((s) => s.previousRelationshipModel);

  if (!model) {
    return <div className="empty">No relationship data yet. The Atlas will fill in as messages arrive.</div>;
  }

  const health = computeHealthScore(model);
  const trend = computeRelationshipTrend(model, previous);
  const breakdownTitle = health.components
    .map(c => `${c.name}: ${(c.value * 100).toFixed(0)}% × ${(c.weight * 100).toFixed(0)}% = ${c.contribution.toFixed(1)}`)
    .join('\n');

  return (
    <div className="atlas">
      {/* Health score (#91) */}
      <div className="health-score" title={breakdownTitle}>
        <div className="hs-number" style={{ color: bandColour(health.band) }}>{health.score}</div>
        <div className="hs-band" style={{ color: bandColour(health.band) }}>{health.band}</div>
        <div className="hs-caption">overall relationship health · hover for breakdown</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className={`gottman-badge ${model.gottman_status}`}>
          <span style={{ fontSize: 24 }}>●</span>
          <span>Gottman status: {model.gottman_status.toUpperCase()}</span>
        </div>
        <OfflineBadge reason="metrics from cache" />
      </div>

      {/* Week-over-week trend card (#89) */}
      {trend.available && (
        <div className="card trend-card">
          <h3>This week vs last week</h3>
          <table className="trend-table">
            <tbody>
              {trend.metrics.map((m) => (
                <tr key={m.name}>
                  <td className="trend-name">{m.name}</td>
                  <td className="trend-prev">{m.previous.toFixed(2)}</td>
                  <td className="trend-arrow">→</td>
                  <td className="trend-curr">{m.current.toFixed(2)}</td>
                  <td className={`trend-delta ${m.direction}`}>{deltaSign(m.direction, m.deltaPct)}</td>
                  <td className="trend-status">{directionArrow(m.direction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="trend-narrative">{trend.narrative}</p>
        </div>
      )}

      <div className="atlas-grid">
        <div className="card metric-card">
          <div className="label">You → {partnerName} bid response</div>
          <div className="value">{Math.round(model.bid_response_rate.partner_response_rate * 100)}%</div>
          <div className="sub">How often {partnerName} replies to your bids</div>
          <div className="gauge">
            <div className="gauge-fill partner" style={{ width: `${model.bid_response_rate.partner_response_rate * 100}%` }} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="label">{partnerName} → You bid response</div>
          <div className="value">{Math.round(model.bid_response_rate.user_response_rate * 100)}%</div>
          <div className="sub">How often you reply to {partnerName}'s bids</div>
          <div className="gauge">
            <div className="gauge-fill" style={{ width: `${model.bid_response_rate.user_response_rate * 100}%` }} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="label">Positive : Negative ratio</div>
          <div className="value">{model.five_to_one_ratio.toFixed(1)} : 1</div>
          <div className="sub">Gottman's target is ≥ 5 : 1</div>
        </div>

        <div className="card metric-card">
          <div className="label">Repair labor index</div>
          <div className="value">{model.repair_labor_index.toFixed(2)}</div>
          <div className="sub">
            {model.repair_labor_index > 0.1
              ? 'You initiate more repairs'
              : model.repair_labor_index < -0.1
              ? `${partnerName} initiates more repairs`
              : 'Balanced'}
          </div>
          <div className="balance-bar">
            <div className="balance-marker" style={{ left: `${((model.repair_labor_index + 1) / 2) * 100}%` }} />
          </div>
        </div>

        <div className="card metric-card">
          <div className="label">Mirroring index</div>
          <div className="value">
            {model.mirroring_index.toFixed(2)}
            <span style={{ marginLeft: 8, fontSize: 20 }}>
              {model.mirroring_index > 0.5 ? '🪞' : model.mirroring_index > 0 ? '🙂' : '↔️'}
            </span>
          </div>
          <div className="sub">Emotional synchrony, range −1 to 1</div>
        </div>

        <div className="card metric-card">
          <div className="label">Open loops</div>
          <div className="value">{model.open_loops.length}</div>
          <div className="sub">
            {selfModel || partnerModel
              ? 'Unanswered questions and unaddressed concerns'
              : 'Loading models…'}
          </div>
        </div>
      </div>

      <p className="atlas-citations">
        Metrics grounded in Gottman Institute research —
        see <a href="docs/RESEARCH-CITATIONS.md">research citations</a>.
      </p>
    </div>
  );
}
