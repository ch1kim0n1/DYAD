import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { CareBriefView } from './views/CareBriefView.js';
import { CareCircleDashboard } from './views/CareCircleDashboard.js';
import { CareMessageComposer } from './views/CareMessageComposer.js';
import { CareTimeline } from './views/CareTimeline.js';
import { CareTrustCenter } from './views/CareTrustCenter.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { CrisisOverlay } from './components/CrisisOverlay.js';
import snoopieGif from '../../../gif.gif';
import { syncCareGraphToGBrainMemory } from './views/carecircleMemory.js';
import {
  loadCareCircleRuntimeState,
  initialCareCircleRuntimeState,
  saveCareCircleRuntimeState,
  type CareLiveNote,
  type CareCircleRuntimeState,
} from './views/carecircleRuntime.js';
import {
  analyzeCareWeek,
  careCircleFixture,
  personName,
  type CareBrief,
  type CareCircleGraph,
  type CareEvent,
  type CareObservation,
  type CareTab,
} from './views/carecircleDemo.js';

const TABS: { id: CareTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'brief', label: 'Care Brief' },
  { id: 'messages', label: 'Messages' },
  { id: 'trust', label: 'Trust' },
];

type AnalysisMode = 'agent' | 'deterministic' | null;

export function App() {
  const [activeTab, setActiveTab] = useState<CareTab>('dashboard');
  const [brief, setBrief] = useState<CareBrief | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [messageFocusTitle, setMessageFocusTitle] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<CareCircleRuntimeState>(loadCareCircleRuntimeState);
  const synthesisTimer = useRef<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [crisisDismissed, setCrisisDismissed] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const careGraph = useMemo(
    () => buildCareGraphWithLiveNotes(careCircleFixture, runtimeState.liveNotes ?? []),
    [runtimeState.liveNotes],
  );

  const metaLabel = useMemo(() => {
    if (!analyzedAt) return 'Synthetic demo data';
    return `Analyzed ${new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(analyzedAt))}`;
  }, [analyzedAt]);

  const handleAnalyze = () => {
    if (synthesisTimer.current) {
      window.clearTimeout(synthesisTimer.current);
    }
    setActiveTab('brief');
    setBrief(null);
    setAnalysisMode(null);
    setAnalyzedAt(null);
    setIsSynthesizing(true);
    const agentBriefPromise = requestAgenticCareBrief(careGraph).catch(() => null);
    setRuntimeState((state) => ({
      ...state,
      gbrainMemory: {
        status: 'syncing',
        source: 'gbrain',
        summary: 'Loading family messages, notes, appointments, medication alerts, and tasks into GBrain.',
        memoryCount: state.gbrainMemory?.memoryCount ?? 0,
      },
    }));
    void syncCareGraphToGBrainMemory(careGraph).then((savedToGBrain) => {
      setRuntimeState((state) => ({
        ...state,
        gbrainMemory: savedToGBrain
          ? {
              status: 'saved',
              source: 'gbrain',
              pageId: `carecircle/sources/${careGraph.id}-week`,
              savedAt: new Date().toISOString(),
              memoryCount: Math.max(1, state.gbrainMemory?.memoryCount ?? 0),
              summary: 'This week of family context is saved for the next check-in.',
            }
          : {
              status: 'local',
              source: 'local',
              savedAt: new Date().toISOString(),
              memoryCount: state.gbrainMemory?.memoryCount ?? 0,
              summary: 'GBrain bridge unavailable, using local deterministic demo memory.',
        },
      }));
    });
    synthesisTimer.current = window.setTimeout(async () => {
      const agentBrief = await agentBriefPromise;
      const nextBrief = agentBrief ?? analyzeCareWeek(careGraph);
      setBrief(nextBrief);
      setAnalysisMode(agentBrief ? 'agent' : 'deterministic');
      setAnalyzedAt(nextBrief.generatedAt);
      setIsSynthesizing(false);
      synthesisTimer.current = null;
    }, 3800);
  };
  const handlePersonShortcut = (personId: string) => {
    if (personId === 'sarah' || personId === 'dr-chen') {
      setMessageFocusTitle('Pharmacy summary');
      setActiveTab('messages');
      return;
    }

    if (personId === 'maya') {
      setMessageFocusTitle('Check-in for Mom');
      setActiveTab('messages');
      return;
    }

    setActiveTab('brief');
  };

  useEffect(() => {
    return () => {
      if (synthesisTimer.current) window.clearTimeout(synthesisTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
      // Dev-only: Cmd+Shift+K triggers crisis overlay for testing
      if (e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowCrisis(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    saveCareCircleRuntimeState(runtimeState);
  }, [runtimeState]);

  return (
    <div className="app care-app">
      {showCrisis && !crisisDismissed && (
        <CrisisOverlay
          refusal={{ safe: false, category: 'suicidality', should_refuse: true, triggers: [], confidence: 1.0, referral_resources: [], crisis_resources: [] }}
          onDismiss={() => {
            setCrisisDismissed(true);
            setShowCrisis(false);
          }}
        />
      )}
      <header className="app-header care-header">
        <div className="care-brand-block">
          <img className="care-companion" src={snoopieGif} alt="" aria-hidden="true" />
          <div className="care-brand-copy">
            <div className="app-brand care-brand">Snoopie</div>
            <span>A calm care copilot for Linda's family</span>
          </div>
        </div>

        <nav className="app-nav care-nav" aria-label="CareCircle demo">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${tab.id === activeTab ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="app-meta care-meta">
          <span className="meta-pill">Demo mode</span>
          <span className="meta-time">{metaLabel}</span>
        </div>
      </header>

      <main className="app-main care-main">
        <ErrorBoundary name="care-view">
          <AnimatedCareView
            activeTab={activeTab}
            graph={careGraph}
            brief={brief}
            analysisMode={analysisMode}
            isSynthesizing={isSynthesizing}
            runtimeState={runtimeState}
            onAnalyze={handleAnalyze}
            onPersonShortcut={handlePersonShortcut}
            messageFocusTitle={messageFocusTitle}
            onRuntimeStateChange={setRuntimeState}
          />
        </ErrorBoundary>
        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onReanalyse={() => {
              setShowSettings(false);
              handleAnalyze();
            }}
            onResetData={async () => {
              setBrief(null);
              setAnalyzedAt(null);
              setShowSettings(false);
            }}
            onExport={() => setShowSettings(false)}
            onSwitchConversation={() => setShowSettings(false)}
          />
        )}
      </main>
    </div>
  );
}

function AnimatedCareView({
  activeTab,
  graph,
  brief,
  analysisMode,
  isSynthesizing,
  runtimeState,
  onAnalyze,
  onPersonShortcut,
  messageFocusTitle,
  onRuntimeStateChange,
}: {
  activeTab: CareTab;
  graph: CareCircleGraph;
  brief: CareBrief | null;
  analysisMode: AnalysisMode;
  isSynthesizing: boolean;
  runtimeState: CareCircleRuntimeState;
  onAnalyze: () => void;
  onPersonShortcut: (personId: string) => void;
  messageFocusTitle: string | null;
  onRuntimeStateChange: Dispatch<SetStateAction<CareCircleRuntimeState>>;
}) {
  const reduce = useReducedMotion();
  const demoBrief = useMemo(() => analyzeCareWeek(graph), [graph]);
  const visibleBrief = brief ?? demoBrief;
  const viewVariants: Variants = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.16 } },
        exit: { opacity: 0, y: -8, transition: { duration: 0.1 } },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        variants={viewVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="care-view-shell"
      >
        {activeTab === 'dashboard' && (
          <CareCircleDashboard
            graph={graph}
            brief={brief}
            runtimeState={runtimeState}
            onAnalyze={onAnalyze}
            onPersonShortcut={onPersonShortcut}
          />
        )}
        {activeTab === 'timeline' && (
          <CareTimeline
            graph={graph}
            runtimeState={runtimeState}
            onRuntimeStateChange={onRuntimeStateChange}
          />
        )}
        {activeTab === 'brief' && (
          <CareBriefView
            graph={graph}
            brief={visibleBrief}
            analysisMode={analysisMode}
            isSynthesizing={isSynthesizing}
            runtimeState={runtimeState}
            onRuntimeStateChange={onRuntimeStateChange}
          />
        )}
        {activeTab === 'messages' && (
          <CareMessageComposer
            brief={visibleBrief}
            focusDraftTitle={messageFocusTitle}
            runtimeState={runtimeState}
            onRuntimeStateChange={onRuntimeStateChange}
          />
        )}
        {activeTab === 'trust' && (
          <CareTrustCenter
            runtimeState={runtimeState}
            onResetRuntimeState={() => onRuntimeStateChange(initialCareCircleRuntimeState)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

async function requestAgenticCareBrief(graph: CareCircleGraph): Promise<CareBrief | null> {
  const response = await fetch('/api/carecircle/agent-brief', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ graph }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { brief?: CareBrief };
  return data.brief ?? null;
}

function buildCareGraphWithLiveNotes(graph: CareCircleGraph, liveNotes: CareLiveNote[]): CareCircleGraph {
  if (liveNotes.length === 0) return graph;

  const noteObservations: CareObservation[] = liveNotes.map((note) => ({
    id: note.id,
    personId: note.subjectPersonId ?? 'linda',
    text: note.text,
    timestamp: note.createdAt,
    source: getLiveNoteSource(note.noteType),
    tags: [
      getLiveNoteTag(note.noteType),
      `author-${note.authorPersonId ?? 'maya'}`,
      note.savedToGBrain ? 'gbrain-memory' : 'local-memory',
    ],
    sensitivity: 'medium',
  }));
  const noteEvents: CareEvent[] = liveNotes.map((note) => ({
    id: `event-${note.id}`,
    title: `${personName(note.authorPersonId ?? 'maya')} added ${getLiveNoteTitle(note.noteType)}`,
    timestamp: note.createdAt,
    category: getLiveNoteCategory(note.noteType),
    relatedPersonIds: [...new Set([note.subjectPersonId ?? 'linda', note.authorPersonId ?? 'maya'])],
    linkedObservationIds: [note.id],
  }));

  return {
    ...graph,
    observations: [...graph.observations, ...noteObservations],
    events: [...graph.events, ...noteEvents],
  };
}

function getLiveNoteSource(noteType: CareLiveNote['noteType']): CareObservation['source'] {
  if (!noteType) return 'family_note';
  if (noteType === 'appointment') return 'appointment';
  if (noteType === 'task') return 'task';
  return 'family_note';
}

function getLiveNoteCategory(noteType: CareLiveNote['noteType']): CareEvent['category'] {
  if (!noteType) return 'family_call';
  if (noteType === 'symptom') return 'symptom';
  if (noteType === 'meal') return 'meal';
  if (noteType === 'appointment') return 'appointment';
  if (noteType === 'task') return 'task';
  return 'family_call';
}

function getLiveNoteTag(noteType: CareLiveNote['noteType']): string {
  if (!noteType) return 'check-in';
  return noteType.replace('_', '-');
}

function getLiveNoteTitle(noteType: CareLiveNote['noteType']): string {
  const labels: Record<CareLiveNote['noteType'], string> = {
    check_in: 'a check-in note',
    symptom: 'a symptom note',
    meal: 'a meal note',
    appointment: 'an appointment note',
    task: 'a task note',
    preference: 'a preference note',
  };

  return labels[noteType] ?? 'a check-in note';
}
