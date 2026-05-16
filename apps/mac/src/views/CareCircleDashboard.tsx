import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareBrief, CareCircleGraph } from './carecircleDemo.js';
import type { CareCircleRuntimeState } from './carecircleRuntime.js';
import {
  fetchCalendarFromGBrain,
  formatCalendarWhen,
  gbrainBlocksToCareBlocks,
  syncCalendarToGBrain,
  type CalendarListResponse,
} from '../lib/carecircle-calendar-client.js';
import { CareMedicationPanel } from './CareMedicationPanel.js';

interface CareCircleDashboardProps {
  graph: CareCircleGraph;
  brief: CareBrief | null;
  runtimeState: CareCircleRuntimeState;
  onRuntimeStateChange: Dispatch<SetStateAction<CareCircleRuntimeState>>;
  onAnalyze: () => void;
}

const personPulse: Record<string, string> = {
  linda: '3 changes surfaced this week',
  maya: 'morning check-in drafted',
  sarah: 'pharmacy call pending',
  arjun: 'appointment reminder ready',
  'dr-chen': 'review path prepared',
};

const roleDescriptor: Record<string, string> = {
  linda: 'mother',
  maya: 'coordinator',
  sarah: 'sibling',
  arjun: 'sibling',
  'dr-chen': 'doctor',
};

export function CareCircleDashboard({
  graph,
  brief,
  runtimeState,
  onRuntimeStateChange,
  onAnalyze,
}: CareCircleDashboardProps) {
  const dashboardPeople = graph.people.filter((person) => person.id !== 'pharmacy');
  const [icsInput, setIcsInput] = useState(runtimeState.calendarIcsUrl ?? '');
  const [calendarView, setCalendarView] = useState<CalendarListResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);

  const loadCalendarFromGBrain = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const data = await fetchCalendarFromGBrain();
      setCalendarView(data);
    } catch {
      setCalendarView(null);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarFromGBrain();
  }, [loadCalendarFromGBrain]);

  const handleCalendarSync = async () => {
    const url = icsInput.trim();
    if (!url) {
      onRuntimeStateChange((s) => ({
        ...s,
        calendarSyncError: 'Paste your secret ICS link first.',
      }));
      return;
    }

    setCalendarSyncing(true);
    onRuntimeStateChange((s) => ({ ...s, calendarSyncError: undefined }));

    try {
      const result = await syncCalendarToGBrain(url);
      const manualBlocks = runtimeState.calendarBlocks.filter((b) => !b.id.startsWith('gbrain-cal-'));
      const imported = gbrainBlocksToCareBlocks(result.upcoming);

      onRuntimeStateChange((s) => ({
        ...s,
        calendarIcsUrl: url,
        calendarLastSyncAt: result.lastSyncAt,
        calendarSyncedCount: result.synced,
        calendarSyncError: undefined,
        calendarBlocks: [...manualBlocks, ...imported],
      }));

      setCalendarView({
        upcoming: result.upcoming,
        past: result.past,
        lastSyncAt: result.lastSyncAt,
        source: 'gbrain',
      });
    } catch (err) {
      onRuntimeStateChange((s) => ({
        ...s,
        calendarSyncError: (err as Error).message,
      }));
    } finally {
      setCalendarSyncing(false);
    }
  };

  const stagger: Variants = {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.08,
      },
    },
  };

  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.section className="care-dashboard" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="care-hero-panel" variants={fadeUp}>
        <motion.div>
          <p className="care-kicker">CareCircle is watching the care load</p>
          <h1>{brief ? "You're caught up. The next moves are staged." : 'Come home, check once, and feel caught up.'}</h1>
          <p>
            {runtimeState.gbrainMemory
              ? 'Care plan accepted and saved as memory. The next check-in starts from what has already been handled.'
              : runtimeState.planAccepted
                ? 'Care plan accepted. The family update and reminders are being tracked here so nothing depends on memory alone.'
                : brief
                  ? 'Nothing has been sent. The medical item is waiting for approval, the appointment reminder is ready, and the family update is drafted.'
                  : 'Mom seemed off this week. I can pull the important changes together, prepare the follow-through, and pause anything sensitive for human review.'}
          </p>
        </motion.div>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          {brief ? 'Refresh' : 'Catch me up'}
        </button>
      </motion.div>

      <motion.section className="care-panel calendar-gbrain-panel" variants={fadeUp} aria-label="Calendar GBrain sync">
        <div className="calendar-gbrain-header">
          <div>
            <p className="care-kicker">GBrain · shared calendar</p>
            <h2>Connect a calendar feed</h2>
          </div>
          <span className={`provider-context-badge ${calendarSyncing ? 'checking' : calendarView?.lastSyncAt ? 'ready' : 'idle'}`}>
            {calendarSyncing ? 'Syncing' : calendarView?.lastSyncAt ? 'In GBrain' : 'Not synced'}
          </span>
        </div>
        <p className="calendar-gbrain-lead">
          Paste the secret ICS link from Google Calendar, Outlook, or Apple (Settings → integrate calendar → secret
          address). CareCircle fetches events server-side and stores them in GBrain only — the URL stays on this device.
        </p>
        <div className="calendar-gbrain-form">
          <label className="calendar-ics-field">
            <span>ICS link</span>
            <input
              type="url"
              value={icsInput}
              onChange={(e) => setIcsInput(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            className="care-card-button gbrain-retrieval-button"
            type="button"
            onClick={() => void handleCalendarSync()}
            disabled={calendarSyncing}
          >
            {calendarSyncing ? 'Fetching calendar…' : 'Sync to GBrain'}
          </button>
        </div>
        {runtimeState.calendarSyncError && (
          <p className="calendar-gbrain-error" role="alert">
            {runtimeState.calendarSyncError}
          </p>
        )}
        {runtimeState.calendarLastSyncAt && (
          <p className="calendar-gbrain-meta">
            Last sync {formatCalendarWhen(runtimeState.calendarLastSyncAt)}
            {runtimeState.calendarSyncedCount != null
              ? ` · ${runtimeState.calendarSyncedCount} events in GBrain`
              : ''}
          </p>
        )}
        {calendarLoading ? (
          <p className="calendar-gbrain-meta">Loading events from GBrain…</p>
        ) : calendarView && calendarView.upcoming.length > 0 ? (
          <ul className="calendar-gbrain-events">
            {calendarView.upcoming.slice(0, 8).map((event) => (
              <li key={event.id}>
                <div className="calendar-gbrain-event-top">
                  <strong>{event.title}</strong>
                  <span>{formatCalendarWhen(event.start)}</span>
                </div>
                {event.location ? <p>{event.location}</p> : null}
                <span className="dashboard-recent-event-source">shared calendar · GBrain</span>
              </li>
            ))}
          </ul>
        ) : calendarView?.lastSyncAt ? (
          <p className="calendar-gbrain-meta">No upcoming events in the synced window.</p>
        ) : null}
      </motion.section>

      <CareMedicationPanel
        runtimeState={runtimeState}
        onRuntimeStateChange={onRuntimeStateChange}
        variants={fadeUp}
      />

      {brief && (
        <motion.section className="assistant-status dashboard-status" aria-label="CareCircle status" variants={fadeUp}>
          <div>
            <span className={`status-dot ${runtimeState.gbrainMemory ? 'ready' : 'waiting'}`} />
            <p>{runtimeState.gbrainMemory ? 'Saved care memory' : 'GBrain memory ready'}</p>
          </div>
          <div>
            <span className="status-dot ready" />
            <p>Prepared appointment confirmation</p>
          </div>
          <div>
            <span className="status-dot waiting" />
            <p>Paused pharmacy call for human review</p>
          </div>
        </motion.section>
      )}

      <motion.div className="family-grid" aria-label="Family circle" variants={stagger}>
        {dashboardPeople.map((person) => (
          <motion.article className="family-card" key={person.id} variants={fadeUp}>
            <div className="family-card-top">
              <div className="avatar-mark" aria-hidden="true">
                {person.name.slice(0, 1)}
              </div>
              <div>
                <h2>{person.name}</h2>
                <p className={`pulse-line ${person.id === 'linda' || person.id === 'sarah' ? 'attention' : ''}`}>
                  {getPersonPulse(person.id, runtimeState)}
                </p>
              </div>
            </div>
            <div className="family-card-bottom">
              <span className="role-line">{roleDescriptor[person.id] ?? person.role}</span>
              <span aria-hidden="true" className="footer-divider-dot">
                ·
              </span>
              <span className="responsibility-line">
                {person.responsibilities?.slice(0, 1).join('') ?? person.relationshipLabel}
              </span>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>
  );
}

function getPersonPulse(personId: string, runtimeState: CareCircleRuntimeState): string {
  if (personId === 'linda' && runtimeState.gbrainMemory) return 'care memory saved for next check-in';
  if (personId === 'maya' && runtimeState.gbrainMemory) return 'coordination plan remembered';
  if (personId === 'linda' && runtimeState.planAccepted) return 'care plan accepted';
  if (personId === 'maya' && runtimeState.queuedDrafts['Check-in for Mom']) return 'morning check-in queued';
  if (personId === 'sarah' && runtimeState.actionStatus['action-sarah-pharmacy']) return 'pharmacy brief approved';
  if (personId === 'arjun' && runtimeState.actionStatus['action-arjun-appointment']) return 'appointment reminder scheduled';
  if (personId === 'dr-chen' && runtimeState.actionStatus.next) return 'sensitive item opened for review';

  return personPulse[personId] ?? 'care context ready';
}
