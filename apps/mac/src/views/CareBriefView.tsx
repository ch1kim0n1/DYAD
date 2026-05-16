import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareAction, CareBrief, CareCircleGraph, CareObservation } from './carecircleDemo.js';
import { careCircleFixture, evidenceText, getWhatChanged, personName } from './carecircleDemo.js';
import {
  bestReminderSlot,
  downloadCareReminder,
  openEmailDraft,
  openSmsDraft,
  suggestReminderSlots,
} from './carecircleActions.js';
import { checkCareProviderContext } from './carecircleExternalContext.js';
import { saveCareBriefToGBrainMemory } from './carecircleMemory.js';
import type { CareCircleRuntimeState } from './carecircleRuntime.js';

interface CareBriefViewProps {
  graph: CareCircleGraph;
  brief: CareBrief;
  isSynthesizing: boolean;
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

export function CareBriefView({
  graph,
  brief,
  isSynthesizing,
  runtimeState,
  onRuntimeStateChange,
}: CareBriefViewProps) {
  const [busyTitle, setBusyTitle] = useState('');
  const [busyTime, setBusyTime] = useState('10:00');
  const [sourceQuery, setSourceQuery] = useState('What explains dizziness, skipped meals, appointment confusion, and who should act?');
  const [sourceSearch, setSourceSearch] = useState<CareSourceSearchState>({
    status: 'idle',
    summary: 'Search family notes, messages, tasks, calendar blocks, learned patterns, and provider boundaries.',
    source: 'local',
    indexedDocuments: 0,
    results: [],
  });
  const stagger: Variants = {
    animate: {
      transition: {
        staggerChildren: 0.11,
        delayChildren: 0.08,
      },
    },
  };
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };
  const reminderSlots = useMemo(
    () => suggestReminderSlots(runtimeState.calendarBlocks),
    [runtimeState.calendarBlocks],
  );
  const selectedReminderStart =
    runtimeState.selectedReminderStart ??
    reminderSlots.find((slot) => slot.conflictCount === 0)?.start.toISOString() ??
    reminderSlots[0]?.start.toISOString();

  if (isSynthesizing) {
    return <CareSynthesisView graph={graph} />;
  }

  const planCards = getPlanCards(brief.taskSplit);
  const updateActionStatus = (key: string, value: string) => {
    onRuntimeStateChange((current) => ({
      ...current,
      actionStatus: { ...current.actionStatus, [key]: value },
    }));
  };
  const checkProviderContext = async () => {
    onRuntimeStateChange((current) => ({
      ...current,
      providerContext: {
        status: 'checking',
        source: 'thehog',
        summary: 'Checking external provider context without changing the medical brief.',
        items: [],
      },
    }));
    const providerContext = await checkCareProviderContext();
    onRuntimeStateChange((current) => ({ ...current, providerContext }));
  };
  const commitCarePlanMemory = async () => {
    onRuntimeStateChange((current) => ({
      ...current,
      planAccepted: true,
      gbrainMemory: {
        status: 'syncing',
        source: 'local',
        summary: 'Saving care plan into GBrain memory...',
        memoryCount: current.gbrainMemory?.memoryCount ?? 0,
      },
    }));
    const gbrainMemory = await saveCareBriefToGBrainMemory(brief);
    onRuntimeStateChange((current) => ({ ...current, gbrainMemory }));
  };
  const handlePlanAction = async (card: ReturnType<typeof getPlanCards>[number]) => {
    if (card.kind === 'family') {
      onRuntimeStateChange((current) => ({
        ...current,
        actionStatus: { ...current.actionStatus, [card.key]: card.doneLabel },
        queuedDrafts: { ...current.queuedDrafts, 'Family update': 'Queue family update' },
      }));
      openSmsDraft(brief.messageDrafts.toSiblings);
      return;
    }

    if (card.kind === 'reminder') {
      const reminderStart = bestReminderSlot(runtimeState.calendarBlocks, selectedReminderStart);
      downloadCareReminder({
        title: 'CareCircle check-in with Linda',
        description:
          'Ask Linda three gentle questions, confirm the appointment reminder is clear, and keep medication-related concerns under human review.',
        start: reminderStart,
        durationMinutes: 20,
      });
      onRuntimeStateChange((current) => ({
        ...current,
        reminderSet: true,
        selectedReminderStart: reminderStart.toISOString(),
        actionStatus: { ...current.actionStatus, [card.key]: card.doneLabel },
      }));
      return;
    }

    updateActionStatus(card.key, card.doneLabel);
    await checkProviderContext();
    openEmailDraft({
      subject: 'Linda medication review question',
      body: brief.messageDrafts.toDoctorOrPharmacist,
    });
  };
  const addBusyBlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseBusyBlockInput(busyTitle, busyTime);
    const title = parsed.title;
    const start = parsed.start;
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const block = {
      id: `calendar-${Date.now()}`,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
    };
    onRuntimeStateChange((current) => ({
      ...current,
      calendarBlocks: [...current.calendarBlocks, block],
      selectedReminderStart: undefined,
    }));
    setBusyTitle('');
  };
  const searchMessySources = async () => {
    setSourceSearch((current) => ({ ...current, status: 'searching' }));
    try {
      const response = await fetch('/api/carecircle/context-search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: sourceQuery }),
      });
      const data = (await response.json()) as Omit<CareSourceSearchState, 'status'>;
      setSourceSearch({ ...data, status: 'ready' });
    } catch {
      setSourceSearch((current) => ({
        ...current,
        status: 'ready',
        summary: 'Context search unavailable. The deterministic brief is still available.',
      }));
    }
  };

  return (
    <motion.section className="care-brief-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="brief-hero" variants={fadeUp}>
        <p className="care-kicker">CareCircle brief</p>
        <h1>{brief.headline}</h1>
        <p className="brief-lead">I found three changes and staged the next moves for the family.</p>
        <div className="brief-care-checklist" aria-label="Care plan summary">
          <div className="brief-check-item">
            <span className="brief-check-box done" aria-hidden="true" />
            <div>
              <strong>Family update drafted</strong>
              <p>Sarah, Arjun, and Maya each have a clear next step.</p>
            </div>
          </div>
          <div className="brief-check-item">
            <span className="brief-check-box done" aria-hidden="true" />
            <div>
              <strong>Appointment reminder prepared</strong>
              <p>Arjun can confirm the date without re-reading the week.</p>
            </div>
          </div>
          <div className="brief-check-item needs-review">
            <span className="brief-check-box review" aria-hidden="true">
              !
            </span>
            <div>
              <strong>Pharmacy call needs approval</strong>
              <p>Medication-related notes stay paused for human review.</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.section className="care-plan-strip" aria-label="Today care plan" variants={stagger}>
        {planCards.map((card) => (
          <motion.article className={`plan-step ${card.tone}`} variants={fadeUp} key={card.key}>
            <span>{card.status}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <button
              className={`care-card-button ${card.tone === 'waiting' ? 'warn' : ''}`}
              type="button"
              onClick={() => handlePlanAction(card)}
              disabled={card.kind === 'provider' && runtimeState.providerContext?.status === 'checking'}
            >
              {card.kind === 'provider' && runtimeState.providerContext?.status === 'checking'
                ? 'Checking context...'
                : runtimeState.actionStatus[card.key] ?? card.buttonLabel}
            </button>
          </motion.article>
        ))}
        </motion.section>

        <motion.section className="calendar-availability-panel" aria-label="Calendar availability" variants={fadeUp}>
          <div>
            <p className="care-kicker">Calendar-aware reminder</p>
            <h2>Pick a time that does not conflict</h2>
          </div>
          <div className="slot-list" aria-label="Suggested reminder times">
            {reminderSlots.map((slot) => (
              <button
                className={`slot-pill ${selectedReminderStart === slot.start.toISOString() ? 'selected' : ''} ${
                  slot.conflictCount ? 'conflict' : ''
                }`}
                key={slot.id}
                type="button"
                onClick={() =>
                  onRuntimeStateChange((current) => ({
                    ...current,
                    selectedReminderStart: slot.start.toISOString(),
                  }))
                }
              >
                <strong>{slot.label}</strong>
                <span>{slot.conflictCount ? `${slot.conflictCount} conflict` : 'free'}</span>
              </button>
            ))}
          </div>
          <form className="busy-block-form" onSubmit={addBusyBlock}>
            <input
              value={busyTitle}
              onChange={(event) => setBusyTitle(event.target.value)}
              placeholder="Add busy block, e.g. class Sunday 10pm"
            />
            <input value={busyTime} onChange={(event) => setBusyTime(event.target.value)} type="time" />
            <button className="care-card-button secondary" type="submit">
              Add
            </button>
          </form>
          <div className="busy-block-list">
            {runtimeState.calendarBlocks.map((block) => (
              <span key={block.id}>
                {block.title} · {formatCalendarTime(block.start)}
              </span>
            ))}
          </div>
        </motion.section>

      <div className="brief-layout">
        <div className="brief-main-column">
          <motion.section className="care-panel" variants={fadeUp}>
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
          </motion.section>

          <motion.section className="care-panel" variants={fadeUp}>
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
          </motion.section>
        </div>

        <aside className="brief-side-column">
          <motion.section className="care-panel" variants={fadeUp}>
            <h2>Linda preferences I remembered</h2>
            <div className="preference-source-list">
              {brief.whatUsuallyWorks.map((item, index) => {
                const sources = [
                  'from family note: morning calls',
                  'observed pattern: concrete choices',
                  'trust note: independence framing',
                ];
                return (
                  <article className="preference-source" key={item}>
                    <p>{item}</p>
                    <span>{sources[index] ?? 'source visible'}</span>
                  </article>
                );
              })}
            </div>
          </motion.section>

          <motion.section className="care-panel assurance-panel" variants={fadeUp}>
            <h2>What you do now</h2>
            <p>
              Review the pharmacy call before anyone acts. Everything else is drafted and ready for the family
              to pick up.
            </p>
          </motion.section>

          <motion.section className="care-panel source-search-panel" variants={fadeUp}>
            <div className="provider-context-header">
              <div>
                <p className="care-kicker">Messy source retrieval</p>
                <h2>Search the whole family context</h2>
              </div>
              <span className={`provider-context-badge ${sourceSearch.status === 'searching' ? 'checking' : 'ready'}`}>
                {sourceSearch.status === 'searching'
                  ? 'Searching'
                  : sourceSearch.source === 'zeroentropy'
                  ? 'Live retrieval'
                  : 'Local fallback'}
              </span>
            </div>
            <p className="source-search-summary">{sourceSearch.summary}</p>
            <div className="source-query-row">
              <input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} />
              <button
                className="care-card-button secondary"
                type="button"
                onClick={searchMessySources}
                disabled={sourceSearch.status === 'searching'}
              >
                {sourceSearch.status === 'searching' ? 'Searching...' : 'Retrieve context'}
              </button>
            </div>
            <div className="source-search-meta">
              <span>{sourceSearch.indexedDocuments || 24} source documents</span>
              <span>{sourceSearch.results.length || 0} snippets shown</span>
            </div>
            {sourceSearch.results.length ? (
              <div className="retrieved-source-list">
                {sourceSearch.results.map((result) => (
                  <article key={result.path}>
                    <span>{result.source}</span>
                    <strong>{result.title}</strong>
                    <p>{result.text}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </motion.section>

          <motion.section className="care-panel memory-sync-panel" variants={fadeUp}>
            <div className="provider-context-header">
              <div>
                <p className="care-kicker">GBrain workflow</p>
                <h2>Care memory</h2>
              </div>
              <span className={`provider-context-badge ${runtimeState.gbrainMemory?.status ?? 'idle'}`}>
                {memoryStatusLabel(runtimeState.gbrainMemory?.status)}
              </span>
            </div>
            <p>
              {runtimeState.gbrainMemory?.summary ??
                'Save this accepted plan as care memory so the next brief starts from what was already handled.'}
            </p>
            {runtimeState.gbrainMemory?.pageId && (
              <div className="memory-page-card">
                <strong>{runtimeState.gbrainMemory.pageId}</strong>
                <span>
                  {runtimeState.gbrainMemory.memoryCount} memory page
                  {runtimeState.gbrainMemory.memoryCount === 1 ? '' : 's'} available
                </span>
              </div>
            )}
            <button
              className="care-card-button secondary full"
              type="button"
              onClick={commitCarePlanMemory}
              disabled={runtimeState.gbrainMemory?.status === 'syncing'}
            >
              {runtimeState.gbrainMemory?.status === 'syncing'
                ? 'Saving to memory...'
                : runtimeState.planAccepted
                ? 'Care plan saved'
                : 'Save accepted plan'}
            </button>
          </motion.section>

          <motion.section className="care-panel provider-context-panel" variants={fadeUp}>
            <div className="provider-context-header">
              <div>
                <p className="care-kicker">External context</p>
                <h2>Provider handoff check</h2>
              </div>
              <span className={`provider-context-badge ${runtimeState.providerContext?.status ?? 'idle'}`}>
                {providerStatusLabel(runtimeState.providerContext?.status)}
              </span>
            </div>
            <p>{runtimeState.providerContext?.summary ?? 'Use The Hog to check outside context only for routing and handoff prep.'}</p>
            {runtimeState.providerContext?.items.length ? (
              <div className="provider-context-list">
                {runtimeState.providerContext.items.map((item) => (
                  <article key={`${item.title}-${item.sourceLabel}`}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <span>{item.sourceLabel}</span>
                  </article>
                ))}
              </div>
            ) : null}
            {runtimeState.providerContext?.operationId && (
              <span className="provider-operation">Hog operation: {runtimeState.providerContext.operationId}</span>
            )}
          </motion.section>
        </aside>
      </div>
    </motion.section>
  );
}

function providerStatusLabel(status: CareCircleRuntimeState['providerContext']['status'] | undefined) {
  if (status === 'checking') return 'Checking';
  if (status === 'ready') return 'Ready';
  if (status === 'demo') return 'Demo safe';
  if (status === 'error') return 'Offline';
  return 'Optional';
}

function memoryStatusLabel(status: CareCircleRuntimeState['gbrainMemory']['status'] | undefined) {
  if (status === 'syncing') return 'Syncing';
  if (status === 'saved') return 'GBrain';
  if (status === 'local') return 'Saved';
  return 'Ready';
}

function formatCalendarTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function parseBusyBlockInput(input: string, fallbackTime: string): { title: string; start: Date } {
  const raw = input.trim();
  const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const dayMatch = raw.match(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)\b/i);
  const [fallbackHour = '10', fallbackMinute = '00'] = fallbackTime.split(':');
  let hour = Number(fallbackHour);
  let minute = Number(fallbackMinute);

  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2] ?? '0');
    const meridiem = timeMatch[3].toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  }

  const start = new Date();
  start.setDate(start.getDate() + 1);
  if (dayMatch) {
    const targetDay = weekdayIndex(dayMatch[1]);
    const delta = (targetDay - start.getDay() + 7) % 7;
    start.setDate(start.getDate() + delta);
  }
  start.setHours(hour, minute, 0, 0);

  const title =
    raw
      .replace(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)\b/gi, '')
      .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Busy';

  return { title, start };
}

function weekdayIndex(day: string): number {
  const normalized = day.slice(0, 3).toLowerCase();
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(normalized);
}

function getPlanCards(actions: CareAction[]) {
  const pharmacy = actions.find((action) => action.id.includes('pharmacy'));
  const appointment = actions.find((action) => action.id.includes('appointment'));
  const familyRoles = actions
    .map((action) => `${personName(action.ownerPersonId)}: ${action.title.toLowerCase()}`)
    .join('. ');

  return [
    {
      kind: 'family',
      key: 'sibling',
      status: 'Ready',
      title: 'Sibling update',
      description: familyRoles
        ? `I separated the next moves from the care plan: ${familyRoles}.`
        : 'I separated the next moves so the family thread can move without re-reading the week.',
      buttonLabel: 'Queue family update',
      doneLabel: 'SMS draft opened',
      tone: 'done',
    },
    {
      kind: 'reminder',
      key: appointment?.id ?? 'appointment',
      status: 'Ready',
      title: 'Appointment confirmation',
      description:
        appointment?.description ?? 'I prepared the reminder so Arjun can confirm without re-reading the week.',
      buttonLabel: 'Schedule reminder',
      doneLabel: 'Calendar file downloaded',
      tone: 'done',
    },
    {
      kind: 'provider',
      key: pharmacy?.id ?? 'pharmacy',
      status: 'Needs approval',
      title: 'Pharmacy call brief',
      description:
        pharmacy?.description ??
        'I summarized the medication-related notes, but this should stay human-reviewed.',
      buttonLabel: 'Review and approve',
      doneLabel: 'Email draft opened',
      tone: 'waiting',
    },
  ] as const;
}

function CareSynthesisView({ graph }: { graph: CareCircleGraph }) {
  const observationsById = new Map(graph.observations.map((observation) => [observation.id, observation]));
  const noteItems = [...graph.events]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .flatMap((event) =>
      event.linkedObservationIds
        .map((id) => observationsById.get(id))
        .filter((observation): observation is CareObservation => Boolean(observation))
        .map((observation) => ({
          id: `${event.id}-${observation.id}`,
          source: getSynthesisSourceLabel(observation),
          text: observation.text,
        })),
    )
    .slice(0, 8);
  const clusters = getWhatChanged(graph).map((insight) => ({
    title: insight.claim,
    body: insight.recommendedAction,
  }));

  return (
    <motion.section className="synthesis-view" initial="initial" animate="animate">
      <motion.div
        className="synthesis-hero"
        variants={{
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.45 } },
        }}
      >
        <p className="care-kicker">Catching you up</p>
        <h1>Reading the week, grouping the loose ends, staging the next moves.</h1>
        <div className="synthesis-progress" aria-hidden="true">
          <motion.span
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5.0, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      <div className="synthesis-stage">
        <div className="note-stream">
          {noteItems.map((item, index) => (
            <motion.div
              className="stream-note"
              key={item.id}
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: [0, 1, 1, 0.55], y: [28, 0, -10, -24], scale: [0.98, 1, 1, 0.96] }}
              transition={{ duration: 2.65, delay: index * 0.15, ease: 'easeOut' }}
            >
              <span>{item.source}</span>
              {item.text}
            </motion.div>
          ))}
        </div>

        <div className="cluster-column">
          {clusters.map((cluster, index) => (
            <motion.article
              className="cluster-card"
              key={cluster.title}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.05 + index * 0.34, ease: 'easeOut' }}
            >
              <span>Cluster {index + 1}</span>
              <h2>{cluster.title}</h2>
              <p>{cluster.body}</p>
            </motion.article>
          ))}
        </div>
      </div>

      <motion.div
        className="synthesis-resolution"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 2.85, ease: 'easeOut' }}
      >
        <span className="status-dot ready" />
        <p>I found three changes. The next moves are staged.</p>
      </motion.div>
    </motion.section>
  );
}

function getSynthesisSourceLabel(observation: CareObservation): string {
  if (observation.tags.includes('gbrain-memory')) return 'GBrain note';
  if (observation.tags.includes('local-memory')) return 'new family note';
  if (observation.tags.some((tag) => ['communication', 'trust'].includes(tag))) return 'learned pattern';

  const labels: Record<CareObservation['source'], string> = {
    family_note: 'family note',
    message: 'messages',
    appointment: 'calendar',
    medication: 'pharmacy',
    task: 'task',
  };

  return labels[observation.source];
}
