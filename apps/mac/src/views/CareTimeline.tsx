import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { CareCircleGraph, CareEvent, CareObservation } from './carecircleDemo.js';
import { personName } from './carecircleDemo.js';
import { saveFamilyNoteToGBrainMemory } from './carecircleMemory.js';
import type { CareCircleRuntimeState, CareLiveNote, CareLiveNoteType } from './carecircleRuntime.js';

interface CareTimelineProps {
  graph: CareCircleGraph;
  runtimeState: CareCircleRuntimeState;
  onRuntimeStateChange: Dispatch<SetStateAction<CareCircleRuntimeState>>;
}

interface CareSourceSearchState {
  status: 'idle' | 'searching' | 'ready';
  summary: string;
  source: string;
  indexedDocuments: number;
  results: Array<{
    path: string;
    title: string;
    source: string;
    text: string;
    score: number;
  }>;
}

const categoryLabels: Record<CareCircleGraph['events'][number]['category'], string> = {
  medication: 'Medication',
  meal: 'Meal',
  appointment: 'Appointment',
  family_call: 'Family call',
  symptom: 'Symptom',
  task: 'Task',
};

const authorOptions = [
  { id: 'maya', label: 'Maya' },
  { id: 'sarah', label: 'Sarah' },
  { id: 'arjun', label: 'Arjun' },
  { id: 'linda', label: 'Linda' },
];

const noteTypeOptions: Array<{ id: CareLiveNoteType; label: string }> = [
  { id: 'check_in', label: 'Check-in' },
  { id: 'symptom', label: 'Symptom' },
  { id: 'meal', label: 'Meal' },
  { id: 'appointment', label: 'Appointment' },
  { id: 'task', label: 'Task' },
  { id: 'preference', label: 'Preference' },
];

export function CareTimeline({ graph, onRuntimeStateChange }: CareTimelineProps) {
  const [noteText, setNoteText] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('maya');
  const [noteType, setNoteType] = useState<CareLiveNoteType>('check_in');
  const [openNoteMenu, setOpenNoteMenu] = useState<'author' | 'type' | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [query, setQuery] = useState('');
  const [sourceSearch, setSourceSearch] = useState<CareSourceSearchState>({
    status: 'idle',
    summary: '',
    source: 'local',
    indexedDocuments: 0,
    results: [],
  });
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
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
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

  const handleNoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = noteText.trim();
    if (!text || isSavingNote) return;

    const note: CareLiveNote = {
      id: createLiveNoteId(),
      text,
      createdAt: new Date().toISOString(),
      savedToGBrain: false,
      authorPersonId: noteAuthor,
      subjectPersonId: 'linda',
      noteType,
    };

    setNoteText('');
    setIsSavingNote(true);
    onRuntimeStateChange((state) => ({
      ...state,
      liveNotes: [note, ...(state.liveNotes ?? [])],
    }));

    const savedToGBrain = await saveFamilyNoteToGBrainMemory(note);
    onRuntimeStateChange((state) => ({
      ...state,
      liveNotes: (state.liveNotes ?? []).map((item) =>
        item.id === note.id ? { ...item, savedToGBrain } : item,
      ),
      gbrainMemory: savedToGBrain
        ? {
            status: 'saved',
            source: 'gbrain',
            pageId: `carecircle/notes/${note.id}`,
            savedAt: new Date().toISOString(),
            memoryCount: (state.gbrainMemory?.memoryCount ?? 0) + 1,
            summary: 'Family note saved to GBrain memory.',
          }
        : state.gbrainMemory,
    }));
    setIsSavingNote(false);
  };
  const searchMessySources = async (searchTerm = query) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    setSourceSearch((current) => ({ ...current, status: 'searching' }));
    try {
      const response = await fetch('/api/carecircle/context-search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = (await response.json()) as Omit<CareSourceSearchState, 'status'>;
      setSourceSearch({ ...data, status: 'ready' });
    } catch {
      setSourceSearch((current) => ({
        ...current,
        status: 'ready',
        summary: 'Source search unavailable. Timeline search still works locally.',
      }));
    }
  };

  return (
    <motion.section className="care-timeline-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="view-heading" variants={fadeUp}>
        <div>
          <p className="care-kicker">Source-visible timeline</p>
          <h1>I kept the thread of the week for you.</h1>
        </div>
      </motion.div>

      <motion.form
        className="timeline-unified-search"
        variants={fadeUp}
        onSubmit={(event) => {
          event.preventDefault();
          void searchMessySources();
        }}
      >
        <label>
          <span>Search timeline and sources</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try dizziness, pharmacy, lunch..."
          />
        </label>
        <div className="source-search-actions">
          <span className={sourceSearch.source === 'zeroentropy' ? 'live' : ''}>
            {sourceSearch.status === 'searching'
              ? 'Checking sources'
              : sourceSearch.source === 'zeroentropy'
              ? 'Live sources'
              : 'Demo sources'}
          </span>
          <button type="submit" disabled={!query.trim() || sourceSearch.status === 'searching'}>
            {sourceSearch.status === 'searching' ? 'Finding...' : 'Find context'}
          </button>
        </div>
      </motion.form>

      {sourceSearch.results.length ? (
        <motion.section className="care-panel source-search-panel timeline-source-search" variants={fadeUp}>
          <div className="source-search-meta">
            <span>{sourceSearch.indexedDocuments || 24} source documents</span>
            <span>{sourceSearch.results.length} snippets shown</span>
          </div>
          <div className="retrieved-source-list">
            {sourceSearch.results.map((result) => (
              <article key={result.path}>
                <span>{result.source}</span>
                <strong>{result.title}</strong>
                <p>{result.text}</p>
              </article>
            ))}
          </div>
        </motion.section>
      ) : null}

      <motion.form className="family-note-capture compact" variants={fadeUp} onSubmit={handleNoteSubmit}>
        <div className="note-menu-field">
          <button
            className="note-menu-trigger"
            type="button"
            onClick={() => setOpenNoteMenu((current) => (current === 'author' ? null : 'author'))}
          >
            <span>Author</span>
            {authorOptions.find((option) => option.id === noteAuthor)?.label ?? 'Maya'}
          </button>
          {openNoteMenu === 'author' && (
            <div className="note-menu" role="menu">
              {authorOptions.map((option) => (
                <button
                  className={option.id === noteAuthor ? 'selected' : ''}
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setNoteAuthor(option.id);
                    setOpenNoteMenu(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="note-menu-field">
          <button
            className="note-menu-trigger"
            type="button"
            onClick={() => setOpenNoteMenu((current) => (current === 'type' ? null : 'type'))}
          >
            <span>Type</span>
            {noteTypeOptions.find((option) => option.id === noteType)?.label ?? 'Check-in'}
          </button>
          {openNoteMenu === 'type' && (
            <div className="note-menu" role="menu">
              {noteTypeOptions.map((option) => (
                <button
                  className={option.id === noteType ? 'selected' : ''}
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setNoteType(option.id);
                    setOpenNoteMenu(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="Add a note..."
        />
        <button className="care-card-button" type="submit" disabled={!noteText.trim() || isSavingNote}>
          {isSavingNote ? 'Saving...' : 'Add note'}
        </button>
      </motion.form>

      <motion.div className="timeline-list" variants={stagger}>
        {events.map((event) => {
          const observations = event.linkedObservationIds
            .map((id) => observationsById.get(id))
            .filter((observation): observation is CareObservation => Boolean(observation));
          const sourceLabels = getSourceLabels(observations);

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
                <div className="source-badge-row" aria-label="Connected sources">
                  {sourceLabels.map((source) => (
                    <span key={source}>{source}</span>
                  ))}
                </div>
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
            <strong>{getSourceLabel(observation)}</strong>
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

function getSourceLabels(observations: CareObservation[]): string[] {
  return [...new Set(observations.map(getSourceLabel))];
}

function getSourceLabel(observation: CareObservation): string {
  if (observation.tags.some((tag) => ['communication', 'trust'].includes(tag))) {
    return 'learned pattern';
  }

  const labels: Record<CareObservation['source'], string> = {
    family_note: 'family note',
    message: 'messages',
    appointment: 'calendar',
    medication: 'pharmacy notification',
    task: 'task',
  };

  return labels[observation.source];
}

function createLiveNoteId(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `note-${window.crypto.randomUUID()}`;
  }

  return `note-${Date.now()}`;
}
