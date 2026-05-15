import { useState, useEffect } from 'react';
import { checkFullDiskAccess, getChatSummary, type ChatSummary } from '../lib/gbrain-bridge.js';

const ONBOARDING_COMPLETE_KEY = 'dyad_onboarding_complete';
const ONBOARDING_STEP_KEY = 'dyad_onboarding_step';
const DYAD_CONVERSATION_ID_KEY = 'dyad_conversation_id';

type Step = 'welcome' | 'permissions' | 'api-key' | 'conversation' | 'ready';

interface OnboardingFlowProps {
  onComplete: (conversationId?: string) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [fdaGranted, setFdaGranted] = useState<boolean | null>(null);
  const [fdaError, setFdaError] = useState<string | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<ChatSummary[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (completed === 'true') {
      onComplete(localStorage.getItem(DYAD_CONVERSATION_ID_KEY) ?? undefined);
      return;
    }
    const savedStep = localStorage.getItem(ONBOARDING_STEP_KEY);
    if (savedStep && ['welcome', 'permissions', 'api-key', 'conversation', 'ready'].includes(savedStep)) {
      setStep(savedStep as Step);
    }
    refreshFda();
    checkApiKeyConfig();
  }, [onComplete]);

  useEffect(() => {
    if (step === 'conversation' && conversations.length === 0) {
      getChatSummary().then(setConversations);
    }
  }, [step, conversations.length]);

  async function refreshFda() {
    const r = await checkFullDiskAccess();
    setFdaGranted(r.granted);
    setFdaError(r.error ?? null);
  }

  function checkApiKeyConfig() {
    const hasKey = Boolean(
      (import.meta as unknown as { env?: { ANTHROPIC_API_KEY?: string } }).env?.ANTHROPIC_API_KEY ||
      (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY),
    );
    setApiKeyConfigured(hasKey);
  }

  function go(next: Step) {
    setStep(next);
    localStorage.setItem(ONBOARDING_STEP_KEY, next);
  }

  function completeOnboarding() {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    if (selectedConv) localStorage.setItem(DYAD_CONVERSATION_ID_KEY, selectedConv);
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    onComplete(selectedConv ?? undefined);
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {step === 'welcome' && <WelcomeStep onNext={() => go('permissions')} />}
        {step === 'permissions' && (
          <PermissionsStep
            granted={fdaGranted}
            error={fdaError}
            onRecheck={refreshFda}
            onNext={() => go('api-key')}
          />
        )}
        {step === 'api-key' && (
          <ApiKeyStep
            configured={apiKeyConfigured}
            onRecheck={checkApiKeyConfig}
            onNext={() => go('conversation')}
          />
        )}
        {step === 'conversation' && (
          <ConversationStep
            conversations={conversations}
            selected={selectedConv}
            onSelect={setSelectedConv}
            onNext={() => go('ready')}
          />
        )}
        {step === 'ready' && <ReadyStep onComplete={completeOnboarding} />}
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="onboarding-step">
      <h1>Welcome to DYAD</h1>
      <p>DYAD helps you understand patterns in your relationships through evidence-based analysis of your conversations — all on this device.</p>
      <div className="onboarding-features">
        <div className="feature"><h3>The Map</h3><p>Emotional terrain over time</p></div>
        <div className="feature"><h3>The Atlas</h3><p>Relationship health metrics</p></div>
        <div className="feature"><h3>The Mirror</h3><p>Your own patterns</p></div>
      </div>
      <button className="onboarding-button primary" onClick={onNext}>Get started</button>
    </div>
  );
}

function PermissionsStep({
  granted, error, onRecheck, onNext,
}: { granted: boolean | null; error: string | null; onRecheck: () => void; onNext: () => void }) {
  return (
    <div className="onboarding-step">
      <h1>Full Disk Access</h1>
      <p>DYAD reads your messages directly from <code>~/Library/Messages/chat.db</code>. macOS requires Full Disk Access to read this file.</p>
      {granted === null && <p>Checking permission…</p>}
      {granted === true && (
        <div className="permission-status success">
          <p>✓ Full Disk Access granted</p>
          <p className="small">chat.db is reachable. You can move on.</p>
        </div>
      )}
      {granted === false && (
        <div className="permission-status error">
          <p>⚠ Full Disk Access not granted</p>
          {error && <p className="small">Sidecar reported: {error}</p>}
          <div className="permission-instructions">
            <ol>
              <li>Open <strong>System Settings → Privacy &amp; Security → Full Disk Access</strong></li>
              <li>Add the terminal you're running DYAD from (or the built DYAD app)</li>
              <li>Restart that terminal / the app</li>
              <li>Come back and click <em>Re-check</em></li>
            </ol>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="onboarding-button" onClick={onRecheck}>Re-check</button>
        <button className="onboarding-button primary" onClick={onNext} disabled={!granted}>Continue</button>
      </div>
    </div>
  );
}

function ApiKeyStep({
  configured, onRecheck, onNext,
}: { configured: boolean | null; onRecheck: () => void; onNext: () => void }) {
  return (
    <div className="onboarding-step">
      <h1>Anthropic API key</h1>
      <p>DYAD calls Claude to extract bids, emotional layering, and to write briefs.</p>
      {configured ? (
        <div className="permission-status success">
          <p>✓ ANTHROPIC_API_KEY detected</p>
          <p className="small">You're good to go. (Storage location: env var — see Keychain note below.)</p>
        </div>
      ) : (
        <div className="permission-status warning">
          <p>⚠ No ANTHROPIC_API_KEY found</p>
          <div className="permission-instructions">
            <ol>
              <li>Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a></li>
              <li>Set it as <code>ANTHROPIC_API_KEY</code> in your <code>.env</code> file</li>
              <li>Restart the sidecar (<code>bun run --cwd apps/mac sidecar:dev</code>)</li>
              <li>Come back and click <em>Re-check</em></li>
            </ol>
          </div>
          <p className="small">
            <strong>Keychain storage:</strong> for distributed builds, see{' '}
            <code>docs/SECURITY.md</code> for the macOS Keychain pattern. For dev,{' '}
            <code>.env</code> is acceptable; it's already in <code>.gitignore</code>.
          </p>
          <p className="small">DYAD will run without an API key — only L1 (lexicon) features will be active, no briefs or reframes.</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="onboarding-button" onClick={onRecheck}>Re-check</button>
        <button className="onboarding-button primary" onClick={onNext}>
          {configured ? 'Continue' : 'Continue without API key'}
        </button>
      </div>
    </div>
  );
}

function ConversationStep({
  conversations, selected, onSelect, onNext,
}: { conversations: ChatSummary[]; selected: string | null; onSelect: (id: string) => void; onNext: () => void }) {
  return (
    <div className="onboarding-step">
      <h1>Pick a conversation</h1>
      <p>We'll analyse only this conversation. The chat id is a SHA-256 hash so nothing personally identifying leaves this device.</p>
      {conversations.length === 0 ? (
        <p>Loading conversations…</p>
      ) : (
        <ul className="conv-picker">
          {conversations.map((c) => (
            <li key={c.chat_id} className={selected === c.chat_id ? 'selected' : ''}>
              <label>
                <input type="radio" name="conv" checked={selected === c.chat_id} onChange={() => onSelect(c.chat_id)} />
                <span className="conv-id">{c.chat_id.slice(0, 12)}…</span>
                <span className="conv-count">{c.message_count} messages</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <button className="onboarding-button primary" onClick={onNext} disabled={!selected && conversations.length > 0}>
        {conversations.length > 0 ? 'Continue' : 'Skip — no chat.db'}
      </button>
    </div>
  );
}

function ReadyStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="onboarding-step">
      <h1>You're ready</h1>
      <p>DYAD is set up. From here:</p>
      <ul className="onboarding-tips">
        <li>The Map shows your emotional trajectory over the conversation</li>
        <li>Cmd+1..4 cycles The Map / Atlas / Mirror / Divergence</li>
        <li>Click a marker in the Map to read the detector brief</li>
        <li>"See another perspective" pulls a compassionate reframe</li>
      </ul>
      <button className="onboarding-button primary" onClick={onComplete}>Start using DYAD</button>
    </div>
  );
}
