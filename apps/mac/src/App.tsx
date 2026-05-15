import { useEffect, useMemo, useState } from 'react';
import { useDyadStore, type ActiveView } from './store.js';
import { MapView } from './views/MapView.js';
import { AtlasView } from './views/AtlasView.js';
import { MirrorView } from './views/MirrorView.js';
import { DivergenceView } from './views/DivergenceView.js';
import { CrisisOverlay } from './components/CrisisOverlay.js';
import { StatusIndicator } from './components/StatusIndicator.js';
import {
  waitForSidecar,
  loadMessages,
  runAnalysis,
  requestBrief,
  requestReframe,
} from './lib/gbrain-bridge.js';
import type { DetectorType } from '@dyad/engine';

const SHORTCUT_VIEWS: ActiveView[] = ['map', 'atlas', 'divergence', 'mirror'];

const VIEWS: { id: ActiveView; label: string }[] = [
  { id: 'map', label: 'The Map' },
  { id: 'atlas', label: 'The Atlas' },
  { id: 'mirror', label: 'The Mirror' },
  { id: 'divergence', label: 'Divergence' },
];

/**
 * Pick a single representative detector type to brief on automatically.
 * The first detected pattern wins; if nothing detected, returns null.
 */
function activeDetector(
  result: ReturnType<typeof useDyadStore.getState>['detectorResult']
): DetectorType | null {
  if (!result) return null;
  if (result.predictive_divergence?.detected) return 'predictive_divergence';
  if (result.bid_asymmetry?.detected) return 'bid_asymmetry';
  if (result.phantom_third_party?.detected) return 'phantom_third_party';
  if (result.primary_secondary && result.primary_secondary.confidence >= 0.7) return 'primary_secondary';
  return null;
}

export function App() {
  const activeView = useDyadStore((s) => s.activeView);
  const setActiveView = useDyadStore((s) => s.setActiveView);
  const detectorResult = useDyadStore((s) => s.detectorResult);
  const isLoading = useDyadStore((s) => s.isLoading);
  const error = useDyadStore((s) => s.error);
  const lastAnalyzedAt = useDyadStore((s) => s.lastAnalyzedAt);
  const conversationId = useDyadStore((s) => s.conversationId);
  const [crisisDismissed, setCrisisDismissed] = useState(false);

  // ── Keyboard shortcuts: Cmd+1..4 switch views ────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        setActiveView(SHORTCUT_VIEWS[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveView]);

  // ── App init flow: ping → load → analyze → populate → auto-brief ─────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const store = useDyadStore.getState();
      store.setLoading(true);
      store.setError(null);
      try {
        const sidecarUp = await waitForSidecar(10_000);
        if (!sidecarUp) {
          if (!cancelled) store.setError('Engine sidecar not responding');
          return;
        }
        const { messages, error: loadError } = await loadMessages();
        if (cancelled) return;
        if (loadError) {
          // chat.db unreadable (off-mac / no Full Disk Access). Show error
          // but allow the views to operate on whatever the user wires in.
          store.setError(`Could not read messages: ${loadError}`);
        }
        store.setMessages(messages);
        if (messages.length > 0) {
          const firstChat = messages[0].chat_id;
          if (firstChat) store.setConversationId(firstChat);
        }
        if (messages.length === 0) return;

        const result = await runAnalysis(messages);
        if (cancelled || !result) return;
        store.setDetectorResult(result);
        store.setLastAnalyzedAt(result.analyzed_at);
        if (result.relationship_model) store.setRelationshipModel(result.relationship_model);

        // Auto-fetch brief for the first detected pattern
        const det = activeDetector(result);
        if (det) {
          const brief = await requestBrief(det, result, messages.slice(-8));
          if (!cancelled && brief) store.setBrief(brief);
        }
      } catch (err) {
        if (!cancelled) store.setError((err as Error).message);
      } finally {
        if (!cancelled) store.setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastAnalyzedAt) return null;
    const diff = Date.now() - lastAnalyzedAt;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'updated just now';
    if (min === 1) return 'updated 1 min ago';
    if (min < 60) return `updated ${min} min ago`;
    return `updated ${Math.floor(min / 60)}h ago`;
  }, [lastAnalyzedAt]);

  // Hard ethical gate: when unsafe, the CrisisOverlay covers the screen.
  // After dismiss, analytical tabs are disabled — only Mirror is accessible.
  const unsafe = Boolean(
    detectorResult && detectorResult.ethical_refusal && !detectorResult.ethical_refusal.safe
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">DYAD</div>
        <nav className="app-nav">
          {VIEWS.map((v) => {
            const disabled = unsafe && crisisDismissed && v.id !== 'mirror';
            return (
              <button
                key={v.id}
                className={`nav-tab ${v.id === activeView ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && setActiveView(v.id)}
                disabled={disabled}
                title={disabled ? 'Take care of yourself first' : undefined}
              >
                {v.label}
              </button>
            );
          })}
        </nav>
        <div className="app-meta">
          {conversationId && (
            <span className="meta-pill" title="Conversation id">
              {conversationId.slice(0, 8)}
            </span>
          )}
          {lastUpdatedLabel && <span className="meta-time">{lastUpdatedLabel}</span>}
          <StatusIndicator />
        </div>
        {isLoading && <span className="status">Analyzing…</span>}
        {error && <span className="status error">{error}</span>}
      </header>
      <main className="app-main">
        {activeView === 'map' && <MapViewContainer />}
        {activeView === 'atlas' && <AtlasViewContainer />}
        {activeView === 'mirror' && <MirrorViewContainer />}
        {activeView === 'divergence' && <DivergenceViewContainer />}
      </main>
      {unsafe && !crisisDismissed && detectorResult?.ethical_refusal && (
        <CrisisOverlay
          refusal={detectorResult.ethical_refusal}
          onDismiss={() => { setCrisisDismissed(true); setActiveView('mirror'); }}
        />
      )}
    </div>
  );
}

function MapViewContainer() {
  const features = useDyadStore((s) => s.features);
  const messages = useDyadStore((s) => s.messages);
  const detectorResult = useDyadStore((s) => s.detectorResult);
  return (
    <MapView
      vectors={features}
      messages={messages}
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
