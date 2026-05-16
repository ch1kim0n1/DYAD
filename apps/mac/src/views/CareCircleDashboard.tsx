import type { CareBrief, CareCircleGraph } from './carecircleDemo.js';
import { personName } from './carecircleDemo.js';

interface CareCircleDashboardProps {
  graph: CareCircleGraph;
  brief: CareBrief | null;
  onAnalyze: () => void;
}

export function CareCircleDashboard({ graph, brief, onAnalyze }: CareCircleDashboardProps) {
  const urgentCards = brief
    ? [
        {
          title: 'Changed this week',
          value: `${brief.whatChanged.length} signals`,
          body: 'Meals, appointment repetition, and dizziness notes should be reviewed together.',
        },
        {
          title: 'Unresolved',
          value: `${brief.unresolvedLoops.length} loops`,
          body: 'Pharmacy call, doctor questions, and sibling update still need owners.',
        },
        {
          title: 'Next actions',
          value: `${brief.taskSplit.length} people`,
          body: brief.taskSplit.map((action) => `${personName(action.ownerPersonId)}: ${action.title}`).join(' / '),
        },
      ]
    : [
        {
          title: 'Changed this week',
          value: 'Ready',
          body: 'Run the weekly analysis to pull together meals, medication, appointment, and symptom notes.',
        },
        {
          title: 'Unresolved',
          value: '3 loops',
          body: 'Open family coordination loops are waiting for a quick review.',
        },
        {
          title: 'Next actions',
          value: 'Suggested',
          body: 'CareCircle will split the next steps across Maya, Sarah, and Arjun.',
        },
      ];

  return (
    <section className="care-dashboard">
      <div className="care-hero-panel">
        <div>
          <p className="care-kicker">Demo question</p>
          <h1>Mom seemed off this week. What am I missing?</h1>
          <p>
            CareCircle turns scattered family notes into a calm, reviewable brief with evidence, task owners,
            and privacy boundaries.
          </p>
        </div>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          Analyze this week
        </button>
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
            {person.responsibilities && (
              <ul>
                {person.responsibilities.slice(0, 2).map((responsibility) => (
                  <li key={responsibility}>{responsibility}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <div className="urgent-grid">
        {urgentCards.map((card) => (
          <article className="urgent-card" key={card.title}>
            <p>{card.title}</p>
            <strong>{card.value}</strong>
            <span>{card.body}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
