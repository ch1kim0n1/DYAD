import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CareBriefView } from './views/CareBriefView.js';
import { CareCircleDashboard } from './views/CareCircleDashboard.js';
import { CareMessageComposer } from './views/CareMessageComposer.js';
import { CareTimeline } from './views/CareTimeline.js';
import { CareTrustCenter } from './views/CareTrustCenter.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import {
  analyzeCareWeek,
  careCircleFixture,
  type CareBrief,
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
    const nextBrief = analyzeCareWeek();
    setBrief(nextBrief);
    setAnalyzedAt(nextBrief.generatedAt);
    setActiveTab('brief');
  };

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
          <AnimatedCareView activeTab={activeTab} brief={brief} onAnalyze={handleAnalyze} />
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AnimatedCareView({
  activeTab,
  brief,
  onAnalyze,
}: {
  activeTab: CareTab;
  brief: CareBrief | null;
  onAnalyze: () => void;
}) {
  const reduce = useReducedMotion();
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
          <CareCircleDashboard graph={careCircleFixture} brief={brief} onAnalyze={onAnalyze} />
        )}
        {activeTab === 'timeline' && <CareTimeline graph={careCircleFixture} />}
        {activeTab === 'brief' && <CareBriefView brief={brief} onAnalyze={onAnalyze} />}
        {activeTab === 'messages' && <CareMessageComposer brief={brief} onAnalyze={onAnalyze} />}
        {activeTab === 'trust' && <CareTrustCenter />}
      </motion.div>
    </AnimatePresence>
  );
}
