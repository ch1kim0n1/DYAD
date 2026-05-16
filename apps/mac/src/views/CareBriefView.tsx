import type { CareBrief } from './carecircleDemo.js';
import { evidenceText } from './carecircleDemo.js';

interface CareBriefViewProps {
  brief: CareBrief | null;
  onAnalyze: () => void;
}

export function CareBriefView({ brief, onAnalyze }: CareBriefViewProps) {
  if (!brief) {
    return (
      <section className="empty-brief">
        <p className="care-kicker">Care Brief</p>
        <h1>I can catch you up without making you read the whole week.</h1>
        <p>I will surface what changed, prepare the next moves, and pause anything sensitive for approval.</p>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          Catch me up
        </button>
      </section>
    );
  }

  return (
    <section className="care-brief-view">
      <div className="brief-hero">
        <p className="care-kicker">CareCircle brief</p>
        <h1>I found three changes. The next moves are staged.</h1>
        <p>
          Linda skipped lunch twice, repeated the appointment question, and family notes mention dizziness after
          a blood pressure medication change. I prepared the family update, appointment confirmation, and pharmacy
          call brief. The medical item is paused for human review.
        </p>
      </div>

      <section className="care-plan-strip" aria-label="Today care plan">
        <article className="plan-step done">
          <span>Ready</span>
          <h2>Sibling update</h2>
          <p>I drafted the family note with Sarah and Arjun's roles already separated.</p>
        </article>
        <article className="plan-step done">
          <span>Ready</span>
          <h2>Appointment confirmation</h2>
          <p>I prepared the reminder so Arjun can confirm without re-reading the week.</p>
        </article>
        <article className="plan-step waiting">
          <span>Needs approval</span>
          <h2>Pharmacy call brief</h2>
          <p>I summarized the medication-related notes, but this should stay human-reviewed.</p>
        </article>
      </section>

      <div className="brief-layout">
        <div className="brief-main-column">
          <section className="care-panel">
            <h2>Why I staged this</h2>
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
            <h2>Loose ends I am tracking</h2>
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
            <h2>Linda preferences I remembered</h2>
            <ul className="works-list">
              {brief.whatUsuallyWorks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="care-panel assurance-panel">
            <h2>What you do now</h2>
            <p>
              Review the pharmacy call before anyone acts. Everything else is drafted and ready for the family
              to pick up.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
