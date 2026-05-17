import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareAction, CareBrief, CareCircleGraph, CareObservation } from './carecircleDemo.js';
import { careCircleFixture, evidenceText, personName } from './carecircleDemo.js';
import {
  bestReminderSlot,
  downloadCareReminder,
  openEmailDraft,
  openSmsDraft,
  suggestReminderSlots,
} from './carecircleActions.js';
import { checkCareProviderContext } from './carecircleExternalContext.js';
import type { CareCircleRuntimeState } from './carecircleRuntime.js';

interface CareBriefViewProps {
  graph: CareCircleGraph;
  brief: CareBrief;
  analysisMode?: 'agent' | 'deterministic' | null;
  isSynthesizing: boolean;
  runtimeState: CareCircleRuntimeState;
  onRuntimeStateChange: Dispatch<SetStateAction<CareCircleRuntimeState>>;
}

export function CareBriefView({
  graph,
  brief,
  analysisMode,
  isSynthesizing,
  runtimeState,
  onRuntimeStateChange,
}: CareBriefViewProps) {
  const [busyTitle, setBusyTitle] = useState('');
  const [busyTime, setBusyTime] = useState('10:00');
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [agentSourceCount, setAgentSourceCount] = useState(1);
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
  const selectedReminderLabel = selectedReminderStart ? formatCalendarTime(selectedReminderStart) : 'the selected time';

  useEffect(() => {
    if (analysisMode !== 'agent') {
      setAgentSourceCount(1);
      return undefined;
    }

    setAgentSourceCount(1);
    const interval = window.setInterval(() => {
      setAgentSourceCount((count) => {
        if (count >= 24) {
          window.clearInterval(interval);
          return 24;
        }
        return count + 1;
      });
    }, 95);
    return () => window.clearInterval(interval);
  }, [analysisMode, brief.id]);

  if (isSynthesizing) {
    return <CareSynthesisView graph={graph} />;
  }

  const planCards = getPlanCards(brief.taskSplit, selectedReminderLabel, runtimeState.reminderSet);
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
  return (
    <motion.section className="care-brief-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="brief-hero" variants={fadeUp}>
        <div className="brief-kicker-row">
          <p className="care-kicker">CareCircle brief</p>
          {analysisMode === 'agent' && (
            <span className="agent-analysis-badge">
              Agent analysis · read {agentSourceCount} sources
            </span>
          )}
        </div>
        <h1>{brief.headline}</h1>
        <p className="brief-lead">
          I found three changes and staged the next moves. One item needs your approval before anyone acts.
        </p>
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

      <motion.section className="calendar-availability-panel compact" aria-label="Calendar availability" variants={fadeUp}>
        <div>
          <p className="care-kicker">Calendar-aware reminder</p>
          <h2>Suggested free times</h2>
        </div>
        <div className="calendar-slot-area">
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
                    reminderSet: false,
                    actionStatus: {
                      ...current.actionStatus,
                      'action-arjun-appointment': `Reminder set for ${slot.label}`,
                    },
                  }))
                }
              >
                <strong>{slot.label}</strong>
                <span>{slot.conflictCount ? `${slot.conflictCount} conflict` : 'free'}</span>
              </button>
            ))}
          </div>
          <button
            className="care-mini-button"
            type="button"
            onClick={() => setShowScheduleDetails((current) => !current)}
          >
            {showScheduleDetails ? 'Hide schedule' : 'Edit schedule'}
          </button>
        </div>
        {showScheduleDetails && (
          <div className="calendar-details">
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
          </div>
        )}
      </motion.section>

      <motion.section className="care-panel assurance-panel primary-next-panel" variants={fadeUp}>
        <h2>What you do now</h2>
        <p>
          Review the pharmacy call before anyone acts. Everything else is drafted and ready for the family to pick up.
        </p>
      </motion.section>

      <motion.section className="care-panel reasoning-toggle-panel" variants={fadeUp}>
        <button
          className="reasoning-toggle-button"
          type="button"
          onClick={() => setShowReasoning((current) => !current)}
        >
          <span>{showReasoning ? 'Hide reasoning' : 'Show why I staged this'}</span>
          <strong>{showReasoning ? '-' : '+'}</strong>
        </button>

        {showReasoning && (
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
              </section>
            </aside>
          </div>
        )}
      </motion.section>
    </motion.section>
  );
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

function getPlanCards(actions: CareAction[], selectedReminderLabel: string, reminderSet: boolean) {
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
        appointment?.description ??
        `I found a conflict-free check-in slot at ${selectedReminderLabel}, so Arjun can confirm without re-reading the week.`,
      buttonLabel: reminderSet ? `Download ${selectedReminderLabel}` : `Use ${selectedReminderLabel}`,
      doneLabel: `Reminder set for ${selectedReminderLabel}`,
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
  const clusters = getSynthesisClusters(graph);

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
  if (observation.tags.includes('gbrain-memory')) return 'new note';
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

function getSynthesisClusters(graph: CareCircleGraph) {
  const hasLiveNotes = graph.observations.some((observation) =>
    observation.tags.some((tag) => ['gbrain-memory', 'local-memory'].includes(tag)),
  );

  return [
    {
      title: 'Routine change',
      body: `I found two meal notes and remembered that Linda usually responds better to morning calls with concrete choices.${
        hasLiveNotes ? ' I am folding the newest family note into that same pattern.' : ''
      }`,
    },
    {
      title: 'Appointment loop',
      body:
        'I saw the appointment question repeat across the calendar and messages, and Arjun already owns calendar follow-up for the family.',
    },
    {
      title: 'Medical review boundary',
      body:
        'I saw dizziness mentioned in family messages and a pharmacy note in the same week. I am keeping this careful: ask a doctor or pharmacist, but do not assume causation.',
    },
  ];
}
