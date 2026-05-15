import type { RelationshipModel, SelfModel, PartnerModel } from '@dyad/shared';

interface AtlasViewProps {
  model: RelationshipModel | null;
  selfModel: SelfModel | null;
  partnerModel: PartnerModel | null;
}

export function AtlasView({ model, selfModel, partnerModel }: AtlasViewProps) {
  if (!model) {
    return <div className="empty">No relationship data yet. The Atlas will fill in as messages arrive.</div>;
  }

  return (
    <div className="atlas">
      <div className={`gottman-badge ${model.gottman_status}`}>
        <span style={{ fontSize: 24 }}>●</span>
        <span>Gottman status: {model.gottman_status.toUpperCase()}</span>
      </div>

      <div className="atlas-grid">
        <div className="card metric-card">
          <div className="label">Self → Partner bid response</div>
          <div className="value">{Math.round(model.bid_response_rate.partner_response_rate * 100)}%</div>
          <div className="sub">How often your partner replies to your bids</div>
          <div className="gauge">
            <div
              className="gauge-fill partner"
              style={{ width: `${model.bid_response_rate.partner_response_rate * 100}%` }}
            />
          </div>
        </div>

        <div className="card metric-card">
          <div className="label">Partner → Self bid response</div>
          <div className="value">{Math.round(model.bid_response_rate.user_response_rate * 100)}%</div>
          <div className="sub">How often you reply to your partner's bids</div>
          <div className="gauge">
            <div
              className="gauge-fill"
              style={{ width: `${model.bid_response_rate.user_response_rate * 100}%` }}
            />
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
              ? 'Partner initiates more repairs'
              : 'Balanced'}
          </div>
          <div className="balance-bar">
            <div
              className="balance-marker"
              style={{ left: `${((model.repair_labor_index + 1) / 2) * 100}%` }}
            />
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
    </div>
  );
}
