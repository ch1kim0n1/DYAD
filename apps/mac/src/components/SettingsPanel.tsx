import { useState } from 'react';
import { useDyadStore } from '../store.js';

interface SettingsPanelProps {
  onClose: () => void;
  onReanalyse: () => void;
  onResetData: () => Promise<void>;
  onExport: () => void;
  onSwitchConversation: () => void;
}

const LOOKBACK_KEY = 'dyad_lookback_days';
const FREQUENCY_KEY = 'dyad_analysis_frequency';
const NOTIFICATIONS_KEY = 'dyad_notifications_enabled';

/**
 * Settings panel (#92). Cmd+, opens it. Sections:
 *   - Conversation: switch, lookback slider
 *   - Analysis: notification toggle, frequency
 *   - Data: re-analyze, delete, export
 *   - About: version, links
 */
export function SettingsPanel({
  onClose, onReanalyse, onResetData, onExport, onSwitchConversation,
}: SettingsPanelProps) {
  const conversationId = useDyadStore((s) => s.conversationId);
  const partnerName = useDyadStore((s) => s.partnerName);
  const messageCount = useDyadStore((s) => s.messages.length);

  const [lookback, setLookback] = useState<number>(
    Number(localStorage.getItem(LOOKBACK_KEY) ?? 30),
  );
  const [frequency, setFrequency] = useState<string>(
    localStorage.getItem(FREQUENCY_KEY) ?? 'on-new-messages',
  );
  const [notifications, setNotifications] = useState<boolean>(
    localStorage.getItem(NOTIFICATIONS_KEY) !== 'false',
  );

  function persistLookback(v: number) {
    setLookback(v);
    localStorage.setItem(LOOKBACK_KEY, String(v));
  }
  function persistFrequency(v: string) {
    setFrequency(v);
    localStorage.setItem(FREQUENCY_KEY, v);
  }
  function persistNotifications(v: boolean) {
    setNotifications(v);
    localStorage.setItem(NOTIFICATIONS_KEY, String(v));
  }

  async function confirmDelete() {
    if (!confirm('Delete all DYAD data (~/.dyad/ + localStorage)? This cannot be undone.')) return;
    await onResetData();
    localStorage.clear();
    onClose();
  }

  const version =
    (import.meta as unknown as { env?: { VITE_DYAD_VERSION?: string } }).env?.VITE_DYAD_VERSION ??
    '0.1.0';

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <h2>Settings</h2>

        <h3>Conversation</h3>
        <div className="settings-row">
          <label>Partner: <code>{partnerName}</code></label>
          <button className="primary-btn" onClick={onSwitchConversation}>Switch</button>
        </div>
        <div className="settings-row">
          <label>Conversation: <code>{conversationId ? conversationId.slice(0, 12) + '…' : '—'}</code></label>
          <span style={{ color: 'var(--muted)' }}>{messageCount} messages</span>
        </div>
        <div className="settings-row">
          <label>Lookback window: {lookback} days</label>
          <input
            type="range" min={7} max={90} step={7} value={lookback}
            onChange={(e) => persistLookback(Number(e.target.value))}
          />
        </div>

        <h3>Analysis</h3>
        <div className="settings-row">
          <label>Frequency</label>
          <select value={frequency} onChange={(e) => persistFrequency(e.target.value)}>
            <option value="on-new-messages">On new messages</option>
            <option value="hourly">Hourly</option>
            <option value="manual">Manual only</option>
          </select>
        </div>
        <div className="settings-row">
          <label>Notifications when a pattern fires</label>
          <input type="checkbox" checked={notifications} onChange={(e) => persistNotifications(e.target.checked)} />
        </div>

        <h3>Data</h3>
        <div className="settings-row">
          <label>Re-analyze from scratch</label>
          <button className="primary-btn" onClick={onReanalyse}>Re-analyze</button>
        </div>
        <div className="settings-row">
          <label>Export model snapshots as JSON</label>
          <button className="primary-btn" onClick={onExport}>Export</button>
        </div>
        <div className="settings-row">
          <label>Delete all DYAD data</label>
          <button className="danger-btn" onClick={confirmDelete}>Delete</button>
        </div>

        <h3>About</h3>
        <div className="settings-row"><label>Version</label><span>{version}</span></div>
        <div className="settings-row">
          <label>Privacy</label>
          <a href="docs/DATA-PRIVACY.md" target="_blank" rel="noreferrer">DATA-PRIVACY.md</a>
        </div>
        <div className="settings-row">
          <label>Research citations</label>
          <a href="docs/RESEARCH-CITATIONS.md" target="_blank" rel="noreferrer">RESEARCH-CITATIONS.md</a>
        </div>

        <button className="settings-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
