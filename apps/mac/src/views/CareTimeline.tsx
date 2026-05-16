import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
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
  const [handled, setHandled] = useState<Record<string, string>>({});
  const events = [...graph.events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const stagger: Variants = {
    animate: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
  };
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.section className="care-timeline-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="view-heading" variants={fadeUp}>
        <p className="care-kicker">Source-visible timeline</p>
        <h1>I kept the thread of the week for you.</h1>
      </motion.div>

      <motion.div className="timeline-list" variants={stagger}>
        {events.map((event) => (
          <motion.article className={`timeline-item ${event.category}`} key={event.id} variants={fadeUp}>
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
              <div className="care-action-buttons compact">
                <button
                  className="care-card-button secondary"
                  type="button"
                  onClick={() => setHandled((current) => ({ ...current, [`${event.id}-source`]: 'Sources open' }))}
                >
                  {handled[`${event.id}-source`] ?? 'Open source'}
                </button>
                <button
                  className="care-card-button"
                  type="button"
                  onClick={() => setHandled((current) => ({ ...current, [`${event.id}-reminder`]: 'Reminder staged' }))}
                >
                  {handled[`${event.id}-reminder`] ?? 'Stage reminder'}
                </button>
              </div>
              <div className="evidence-row">
                {evidenceText(event.linkedObservationIds).map((text) => (
                  <span className="evidence-chip" key={text}>
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>
  );
}
