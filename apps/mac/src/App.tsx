import { useDyadStore, type ActiveView } from './store.js';
import { MapView } from './views/MapView.js';
import { AtlasView } from './views/AtlasView.js';
import { MirrorView } from './views/MirrorView.js';
import { DivergenceView } from './views/DivergenceView.js';
import { CrisisBanner } from './components/CrisisBanner.js';
import { requestReframe } from './lib/gbrain-bridge.js';

const VIEWS: { id: ActiveView; label: string }[] = [
  { id: 'map', label: 'The Map' },
  { id: 'atlas', label: 'The Atlas' },
  { id: 'mirror', label: 'The Mirror' },
  { id: 'divergence', label: 'Divergence' },
];

export function App() {
  const activeView = useDyadStore((s) => s.activeView);
  const setActiveView = useDyadStore((s) => s.setActiveView);
  const detectorResult = useDyadStore((s) => s.detectorResult);
  const isLoading = useDyadStore((s) => s.isLoading);
  const error = useDyadStore((s) => s.error);

  // Hard ethical gate at the UI level: if unsafe, replace the entire surface
  // with the crisis banner so nothing analytical can be visible.
  if (detectorResult && detectorResult.ethical_refusal && !detectorResult.ethical_refusal.safe) {
    return <CrisisBanner refusal={detectorResult.ethical_refusal} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">DYAD</div>
        <nav className="app-nav">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={v.id === activeView ? 'nav-tab active' : 'nav-tab'}
              onClick={() => setActiveView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
        {isLoading && <span className="status">Analyzing…</span>}
        {error && <span className="status error">{error}</span>}
      </header>
      <main className="app-main">
        {activeView === 'map' && <MapViewContainer />}
        {activeView === 'atlas' && <AtlasViewContainer />}
        {activeView === 'mirror' && <MirrorViewContainer />}
        {activeView === 'divergence' && <DivergenceViewContainer />}
      </main>
    </div>
  );
}

function MapViewContainer() {
  const features = useDyadStore((s) => s.features);
  const detectorResult = useDyadStore((s) => s.detectorResult);
  return (
    <MapView
      vectors={features}
      detectorResult={detectorResult}
      onMarkerClick={(id) => console.log('marker click', id)}
    />
  );
}

function AtlasViewContainer() {
  const model = useDyadStore((s) => s.relationshipModel);
  const selfModel = useDyadStore((s) => s.selfModel);
  const partnerModel = useDyadStore((s) => s.partnerModel);
  return <AtlasView model={model} selfModel={selfModel} partnerModel={partnerModel} />;
}

function MirrorViewContainer() {
  const selfModel = useDyadStore((s) => s.selfModel);
  const features = useDyadStore((s) => s.features);
  const result = useDyadStore((s) => s.detectorResult);
  return (
    <MirrorView
      selfModel={selfModel}
      recentVectors={features.slice(-20)}
      primarySecondaryResult={result?.primary_secondary ?? null}
    />
  );
}

function DivergenceViewContainer() {
  const result = useDyadStore((s) => s.detectorResult);
  const brief = useDyadStore((s) => s.currentBrief);
  const reframe = useDyadStore((s) => s.currentReframe);
  const isLoadingReframe = useDyadStore((s) => s.isLoadingReframe);
  const setReframe = useDyadStore((s) => s.setReframe);
  const setLoading = useDyadStore((s) => s.setLoadingReframe);
  const messages = useDyadStore((s) => s.messages);

  return (
    <DivergenceView
      result={result?.predictive_divergence ?? null}
      brief={brief}
      reframe={reframe}
      isLoadingReframe={isLoadingReframe}
      onRequestReframe={async () => {
        if (!result || !brief) return;
        setLoading(true);
        try {
          const text = await requestReframe('predictive_divergence', result, brief, messages.slice(-6));
          setReframe(text);
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}
