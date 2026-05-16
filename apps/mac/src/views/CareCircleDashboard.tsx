import type { CareBrief, CareCircleGraph } from './carecircleDemo.js';
import { personName } from './carecircleDemo.js';

interface CareCircleDashboardProps {
  graph: CareCircleGraph;
  brief: CareBrief | null;
  onAnalyze: () => void;
}

export function CareCircleDashboard({ graph, brief, onAnalyze }: CareCircleDashboardProps) {
  const actionCards = brief
    ? [
        {
          owner: 'I staged',
          title: 'Pharmacy call',
          body: 'Sarah has the call brief ready. I am holding it for approval because it touches medication.',
          meta: 'Needs approval',
        },
        {
          owner: 'I prepared',
          title: 'Appointment reminder',
          body: 'Arjun can confirm the date from one clean note instead of searching the thread.',
          meta: 'Ready',
        },
        {
          owner: 'I drafted',
          title: 'Morning check-in',
          body: "Maya has a gentle message that protects Linda's independence and asks the important question.",
          meta: 'Low friction',
        },
      ]
    : [
        {
          owner: 'I can check',
          title: 'What changed',
          body: 'I will pull together the scattered family notes and show only the patterns that matter.',
          meta: 'Ready',
        },
        {
          owner: 'I can stage',
          title: 'The next moves',
          body: 'I will prepare the calls, reminders, and family update so you are not starting cold.',
          meta: 'Source visible',
        },
        {
          owner: 'You approve',
          title: 'Sensitive steps',
          body: 'Anything medical stays paused until a human reviews it.',
          meta: 'Safe boundary',
        },
      ];

  return (
    <section className="care-dashboard">
      <div className="care-hero-panel">
        <div>
          <p className="care-kicker">CareCircle is watching the care load</p>
          <h1>{brief ? "I found the week's care loose ends and staged the next moves." : 'Come home, check once, and feel caught up.'}</h1>
          <p>
            {brief
              ? 'Nothing has been sent. The medical item is waiting for approval, the appointment reminder is ready, and the family update is drafted.'
              : 'When you are tired, CareCircle reads the family context for you and prepares the gentle, practical follow-through.'}
          </p>
        </div>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          {brief ? 'Refresh care plan' : 'Catch me up'}
        </button>
      </div>

      {brief && (
        <section className="assistant-status" aria-label="CareCircle status">
          <div>
            <span className="status-dot ready" />
            <p>Drafted sibling update</p>
          </div>
          <div>
            <span className="status-dot ready" />
            <p>Prepared appointment confirmation</p>
          </div>
          <div>
            <span className="status-dot waiting" />
            <p>Paused pharmacy call for human review</p>
          </div>
        </section>
      )}

      <div className="care-action-grid" aria-label="Recommended next actions">
        {actionCards.map((card) => (
          <article className="action-card" key={card.title}>
            <div className="action-card-top">
              <span>{card.owner}</span>
              <small>{card.meta}</small>
            </div>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </div>

      <div className="family-grid" aria-label="Family circle">
        {graph.people.map((person) => (
          <article className="family-card" key={person.id}>
            <div className="avatar-mark" aria-hidden="true">
              {person.name.slice(0, 1)}
            </div>
            <div>
              <h2>{person.name}</h2>
              <p>{person.relationshipLabel}</p>
            </div>
            <span className="responsibility-line">
              {person.responsibilities?.slice(0, 1).join('') ?? personName(person.id)}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
