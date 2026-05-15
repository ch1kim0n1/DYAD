import type { PredictiveDivergenceResult } from '@dyad/shared';

interface DivergenceViewProps {
  result: PredictiveDivergenceResult | null;
  brief: string | null;
  reframe: string | null;
  onRequestReframe: () => void;
  isLoadingReframe: boolean;
}

function arrowFor(slope: number): { rotation: number; symbol: string } {
  if (slope > 0.05) return { rotation: -45, symbol: '↗' };
  if (slope < -0.05) return { rotation: 45, symbol: '↘' };
  return { rotation: 0, symbol: '→' };
}

export function DivergenceView({
  result,
  brief,
  reframe,
  onRequestReframe,
  isLoadingReframe,
}: DivergenceViewProps) {
  if (!result || !result.detected) {
    return (
      <div className="empty">
        No divergence detected — your trajectories are aligned right now.
      </div>
    );
  }

  const selfArrow = arrowFor(result.self_trend);
  const partnerArrow = arrowFor(result.partner_trend);

  return (
    <div className="divergence-view">
      <div className="divergence-arrows">
        <div className="arrow-block self">
          <div
            className="arrow-symbol"
            style={{ transform: `rotate(${selfArrow.rotation}deg)` }}
          >
            {selfArrow.symbol}
          </div>
          <div className="arrow-label">Self</div>
          <div className="arrow-trend">slope {result.self_trend.toFixed(2)}</div>
        </div>

        <div className="divergence-score">
          <div className="score-label">divergence</div>
          <div className="score-value">{result.divergence_score.toFixed(2)}</div>
          <div className="score-window">over {result.window_size} messages</div>
        </div>

        <div className="arrow-block partner">
          <div
            className="arrow-symbol"
            style={{ transform: `rotate(${partnerArrow.rotation}deg)` }}
          >
            {partnerArrow.symbol}
          </div>
          <div className="arrow-label">Partner</div>
          <div className="arrow-trend">slope {result.partner_trend.toFixed(2)}</div>
        </div>
      </div>

      <div className="card brief-card">
        <h3>Brief</h3>
        {brief ? (
          <pre className="brief-text">{brief}</pre>
        ) : (
          <p className="muted">Generating brief…</p>
        )}
      </div>

      <div className="reframe-section">
        {reframe ? (
          <div className="card reframe-card">
            <h3>Another way of seeing it</h3>
            <p>{reframe}</p>
          </div>
        ) : (
          <button
            className="reframe-button"
            onClick={onRequestReframe}
            disabled={isLoadingReframe || !brief}
          >
            {isLoadingReframe ? 'Thinking…' : 'See another perspective'}
          </button>
        )}
      </div>
    </div>
  );
}
