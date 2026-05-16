import type { CareCircleGraph } from './carecircleDemo.js';
import { evidenceText, personName } from './carecircleDemo.js';

interface CareTimelineProps {
  graph: CareCircleGraph;
}

const categoryLabels: Record<CareCircleGraph['events'][number]['category'], string> = {
  medication: 'Medication',
  meal: 'Meal',
  appointment: 'Appointment',
  family_call: 'Family call',
  symptom: 'Symptom',
  task: 'Task',
};

export function CareTimeline({ graph }: CareTimelineProps) {
  const events = [...graph.events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  return (
    <section className="care-timeline-view">
      <div className="view-heading">
        <p className="care-kicker">Source-visible timeline</p>
        <h1>What happened this week</h1>
      </div>

      <div className="timeline-list">
        {events.map((event) => (
          <article className={`timeline-item ${event.category}`} key={event.id}>
            <div className="timeline-dot" aria-hidden="true" />
            <div className="timeline-content">
              <div className="timeline-meta">
                <span>{categoryLabels[event.category]}</span>
                <time dateTime={event.timestamp}>
                  {new Intl.DateTimeFormat('en', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(event.timestamp))}
                </time>
              </div>
              <h2>{event.title}</h2>
              <p>{event.relatedPersonIds.map(personName).join(', ')}</p>
              <div className="evidence-row">
                {evidenceText(event.linkedObservationIds).map((text) => (
                  <span className="evidence-chip" key={text}>
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
