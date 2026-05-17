/**
 * Hypothesis Fork Panel - displays competing hypothesis classes
 */
import type { HypothesisFork } from '@dyad/shared';

interface HypothesisForkPanelProps {
  fork: HypothesisFork;
}

export function HypothesisForkPanel({ fork }: HypothesisForkPanelProps) {
  const maxPosterior = Math.max(...fork.classes.map(c => c.posterior));
  
  return (
    <div className="hypothesis-fork-panel">
      <h3>Hypothesis Fork</h3>
      <div className="fork-kl">
        KL Divergence: {fork.kl_divergence.toFixed(3)} bits
      </div>
      
      <div className="hypothesis-classes">
        {fork.classes.map((cls) => {
          const isChosen = cls.id === fork.chosen_id;
          const width = (cls.posterior / maxPosterior) * 100;
          
          return (
            <div 
              key={cls.id} 
              className={`hypothesis-class ${isChosen ? 'chosen' : ''}`}
            >
              <div className="class-header">
                <span className="class-label">{cls.label}</span>
                <span className="class-prob">
                  Prior: {(cls.prior * 100).toFixed(0)}% → Posterior: {(cls.posterior * 100).toFixed(0)}%
                </span>
              </div>
              
              <div className="class-bar-container">
                <div 
                  className="class-bar" 
                  style={{ width: `${width}%` }}
                />
              </div>
              
              <div className="class-rationale">{cls.rationale}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
