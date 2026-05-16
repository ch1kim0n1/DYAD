import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CareBriefView } from './views/CareBriefView.js';
import { CareCircleDashboard } from './views/CareCircleDashboard.js';
import { CareMessageComposer } from './views/CareMessageComposer.js';
import { CareTimeline } from './views/CareTimeline.js';
import { CareTrustCenter } from './views/CareTrustCenter.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
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

export function App() {
  const [activeTab, setActiveTab] = useState<CareTab>('dashboard');
  const [brief, setBrief] = useState<CareBrief | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [runtimeState, setRuntimeState] = useState<CareCircleRuntimeState>(loadCareCircleRuntimeState);
  const synthesisTimer = useRef<number | null>(null);
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
    setAnalyzedAt(null);
    setIsSynthesizing(true);
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
              summary: 'CareCircle source bundle saved to GBrain memory.',
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
    synthesisTimer.current = window.setTimeout(() => {
      const nextBrief = analyzeCareWeek(careGraph);
      setBrief(nextBrief);
      setAnalyzedAt(nextBrief.generatedAt);
      setIsSynthesizing(false);
      synthesisTimer.current = null;
    }, 3800);
  };

  useEffect(() => {
    return () => {
      if (synthesisTimer.current) window.clearTimeout(synthesisTimer.current);
    };
  }, []);

  useEffect(() => {
    saveCareCircleRuntimeState(runtimeState);
  }, [runtimeState]);

  return (
    <div className="app care-app">
      <header className="app-header care-header">
        <div className="care-brand-block">
          <div className="app-brand care-brand">CareCircle</div>
          <span>Relationship intelligence for family care</span>
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
            isSynthesizing={isSynthesizing}
            runtimeState={runtimeState}
            onAnalyze={handleAnalyze}
            onRuntimeStateChange={setRuntimeState}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AnimatedCareView({
  activeTab,
  graph,
  brief,
  isSynthesizing,
  runtimeState,
  onAnalyze,
  onRuntimeStateChange,
}: {
  activeTab: CareTab;
  graph: CareCircleGraph;
  brief: CareBrief | null;
  isSynthesizing: boolean;
  runtimeState: CareCircleRuntimeState;
  onAnalyze: () => void;
  onRuntimeStateChange: Dispatch<SetStateAction<CareCircleRuntimeState>>;
}) {
  const reduce = useReducedMotion();
  const demoBrief = useMemo(() => analyzeCareWeek(graph), [graph]);
  const visibleBrief = brief ?? demoBrief;
  const variants = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.16, ease: 'easeOut' } },
        exit: { opacity: 0, y: -8, transition: { duration: 0.1 } },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        className="care-view-shell"
      >
        {activeTab === 'dashboard' && (
          <CareCircleDashboard
            graph={graph}
            brief={brief}
            runtimeState={runtimeState}
            onAnalyze={onAnalyze}
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
            isSynthesizing={isSynthesizing}
            runtimeState={runtimeState}
            onRuntimeStateChange={onRuntimeStateChange}
          />
        )}
        {activeTab === 'messages' && (
          <CareMessageComposer
            brief={visibleBrief}
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

function buildCareGraphWithLiveNotes(graph: CareCircleGraph, liveNotes: CareLiveNote[]): CareCircleGraph {
  if (liveNotes.length === 0) return graph;

  const noteObservations: CareObservation[] = liveNotes.map((note) => ({
    id: note.id,
    personId: 'linda',
    text: note.text,
    timestamp: note.createdAt,
    source: 'family_note',
    tags: note.savedToGBrain ? ['family-note', 'gbrain-memory'] : ['family-note', 'local-memory'],
    sensitivity: 'medium',
  }));
  const noteEvents: CareEvent[] = liveNotes.map((note) => ({
    id: `event-${note.id}`,
    title: 'Maya added a family note',
    timestamp: note.createdAt,
    category: 'family_call',
    relatedPersonIds: ['linda', 'maya'],
    linkedObservationIds: [note.id],
  }));

  return {
    ...graph,
    observations: [...graph.observations, ...noteObservations],
    events: [...graph.events, ...noteEvents],
  };
}
