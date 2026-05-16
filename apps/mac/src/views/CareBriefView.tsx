import type { CareBrief } from './carecircleDemo.js';
import { evidenceText, personName } from './carecircleDemo.js';

interface CareBriefViewProps {
  brief: CareBrief | null;
  onAnalyze: () => void;
}

export function CareBriefView({ brief, onAnalyze }: CareBriefViewProps) {
  if (!brief) {
    return (
      <section className="empty-brief">
        <p className="care-kicker">Care Brief</p>
        <h1>Ready when the family asks, "what changed?"</h1>
        <p>Run the weekly analysis to reveal the full stable brief, evidence, loops, and task split.</p>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          Analyze this week
        </button>
      </section>
    );
  }

  return (
    <section className="care-brief-view">
      <div className="brief-hero">
        <p className="care-kicker">Care Brief</p>
        <h1>{brief.headline}</h1>
        <p>{brief.summary}</p>
      </div>

      <div className="brief-layout">
        <div className="brief-main-column">
          <section className="care-panel">
            <h2>What changed</h2>
            <div className="insight-list">
              {brief.whatChanged.map((insight) => (
                <article className="insight-card" key={insight.id}>
                  <div className="insight-header">
                    <h3>{insight.claim}</h3>
                    <span className={`review-pill ${insight.safetyLevel}`}>
                      {insight.safetyLevel === 'medical_review' ? 'doctor or pharmacist' : 'human review'}
                    </span>
                  </div>
                  <p>{insight.recommendedAction}</p>
                  <div className="confidence-line">
                    <span>Confidence</span>
                    <strong>{Math.round(insight.confidence * 100)}%</strong>
                  </div>
                  <div className="evidence-row">
                    {evidenceText(insight.evidenceObservationIds).map((text) => (
                      <span className="evidence-chip" key={text}>
                        {text}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="care-panel">
            <h2>Unresolved loops</h2>
            <div className="loop-list">
              {brief.unresolvedLoops.map((loop) => (
                <article className="loop-card" key={loop.id}>
                  <h3>{loop.description}</h3>
                  <p>{loop.suggestedNextStep}</p>
                  <div className="evidence-row">
                    {evidenceText(loop.evidenceObservationIds).map((text) => (
                      <span className="evidence-chip" key={text}>
                        {text}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="brief-side-column">
          <section className="care-panel">
            <h2>Task split</h2>
            {brief.taskSplit.map((action) => (
              <article className="task-row" key={action.id}>
                <span>{personName(action.ownerPersonId)}</span>
                <div>
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="care-panel">
            <h2>What usually works</h2>
            <ul className="works-list">
              {brief.whatUsuallyWorks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}
