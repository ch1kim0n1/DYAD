import { useMemo, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { CareCircleGraph, CareEvent, CareObservation } from './carecircleDemo.js';
import { personName } from './carecircleDemo.js';

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
  const [query, setQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<{
    event: CareEvent;
    observation: CareObservation;
  } | null>(null);
  const observationsById = useMemo(
    () => new Map(graph.observations.map((observation) => [observation.id, observation])),
    [graph.observations],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const events = useMemo(() => {
    return [...graph.events]
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
      .filter((event) => {
        if (!normalizedQuery) return true;
        const observationText = event.linkedObservationIds
          .map((id) => observationsById.get(id))
          .filter((observation): observation is CareObservation => Boolean(observation))
          .flatMap((observation) => [
            observation.text,
            observation.source,
            observation.sensitivity,
            ...observation.tags,
          ]);
        const haystack = [
          event.title,
          event.category,
          categoryLabels[event.category],
          ...event.relatedPersonIds.map(personName),
          ...observationText,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      });
  }, [graph.events, normalizedQuery, observationsById]);
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
        <div>
          <p className="care-kicker">Source-visible timeline</p>
          <h1>I kept the thread of the week for you.</h1>
        </div>
        <label className="timeline-search">
          <span>Search timeline</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try pharmacy, dizziness, lunch..."
          />
        </label>
      </motion.div>

      <motion.div className="timeline-list" variants={stagger}>
        {events.map((event) => {
          const observations = event.linkedObservationIds
            .map((id) => observationsById.get(id))
            .filter((observation): observation is CareObservation => Boolean(observation));

          return (
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
                <div className="evidence-row">
                  {observations.map((observation) => (
                    <button
                      className="evidence-chip evidence-chip-button"
                      key={observation.id}
                      type="button"
                      onClick={() => setSelectedSource({ event, observation })}
                    >
                      {observation.text}
                    </button>
                  ))}
                </div>
              </div>
            </motion.article>
          );
        })}
        {events.length === 0 && (
          <motion.div className="timeline-empty" variants={fadeUp}>
            No timeline sources match "{query}".
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedSource && (
          <SourceOverlay
            event={selectedSource.event}
            observation={selectedSource.observation}
            onClose={() => setSelectedSource(null)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function SourceOverlay({
  event,
  observation,
  onClose,
}: {
  event: CareEvent;
  observation: CareObservation;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="source-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.article
        className="source-sheet"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(eventClick) => eventClick.stopPropagation()}
      >
        <div className="source-sheet-header">
          <div>
            <p className="care-kicker">Original source</p>
            <h2>{observation.text}</h2>
          </div>
          <button className="care-card-button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="source-detail-grid">
          <div>
            <span>Timeline event</span>
            <strong>{event.title}</strong>
          </div>
          <div>
            <span>Source type</span>
            <strong>{formatSource(observation.source)}</strong>
          </div>
          <div>
            <span>Person</span>
            <strong>{personName(observation.personId)}</strong>
          </div>
          <div>
            <span>Sensitivity</span>
            <strong>{observation.sensitivity}</strong>
          </div>
          <div>
            <span>Captured</span>
            <strong>
              {new Intl.DateTimeFormat('en', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(observation.timestamp))}
            </strong>
          </div>
          <div>
            <span>Related people</span>
            <strong>{event.relatedPersonIds.map(personName).join(', ')}</strong>
          </div>
        </div>

        <div className="source-tags" aria-label="Source tags">
          {observation.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </motion.article>
    </motion.div>
  );
}

function formatSource(source: CareObservation['source']): string {
  return source.replaceAll('_', ' ');
}
