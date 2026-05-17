/**
 * Audit Drawer - displays NOUS audit trail
 */
import { useState } from 'react';
import type { ArbiterDecision, HogOperationResult } from '@dyad/shared';

interface AuditDrawerProps {
  decisions: ArbiterDecision[];
  hogResults: HogOperationResult[];
}

export function AuditDrawer({ decisions, hogResults }: AuditDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'decisions' | 'hog'>('decisions');

  return (
    <div className={`audit-drawer ${isOpen ? 'open' : ''}`}>
      <button 
        className="audit-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Close' : 'Open'} Audit Trail
      </button>

      {isOpen && (
        <div className="audit-content">
          <div className="audit-tabs">
            <button 
              className={activeTab === 'decisions' ? 'active' : ''}
              onClick={() => setActiveTab('decisions')}
            >
              Arbiter Decisions ({decisions.length})
            </button>
            <button 
              className={activeTab === 'hog' ? 'active' : ''}
              onClick={() => setActiveTab('hog')}
            >
              Hog Operations ({hogResults.length})
            </button>
          </div>

          <div className="audit-panel">
            {activeTab === 'decisions' && (
              <div className="decision-list">
                {decisions.map((decision, index) => (
                  <div key={index} className={`decision-item ${decision.committed ? 'committed' : 'rejected'}`}>
                    <div className="decision-header">
                      <span className="decision-status">
                        {decision.committed ? '✓ Committed' : '✗ Rejected'}
                      </span>
                      <span className="decision-kl">
                        KL: {decision.kl_divergence.toFixed(3)} bits
                      </span>
                    </div>
                    <div className="decision-reasoning">{decision.reasoning}</div>
                    <div className="decision-posteriors">
                      Before: α={decision.posterior_before.alpha.toFixed(1)}, β={decision.posterior_before.beta.toFixed(1)}
                      {' → '}
                      After: α={decision.posterior_after.alpha.toFixed(1)}, β={decision.posterior_after.beta.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'hog' && (
              <div className="hog-list">
                {hogResults.map((result, index) => (
                  <div key={index} className={`hog-item ${result.status}`}>
                    <div className="hog-header">
                      <span className="hog-id">{result.operation_id}</span>
                      <span className={`hog-status ${result.status}`}>
                        {result.status}
                      </span>
                    </div>
                    <div className="hog-cost">
                      Credits: {result.credits_spent}
                    </div>
                    {result.status === 'completed' && result.result && (
                      <div className="hog-result">
                        {result.result.headline}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
