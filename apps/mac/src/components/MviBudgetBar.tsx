/**
 * MVI Budget Bar - displays credit budget and usage
 */
interface MviBudgetBarProps {
  budget: number;
  used: number;
  planCost?: number;
}

export function MviBudgetBar({ budget, used, planCost }: MviBudgetBarProps) {
  const remaining = budget - used;
  const percentage = (used / budget) * 100;
  const planPercentage = planCost ? (planCost / budget) * 100 : 0;
  
  const getColor = (pct: number): string => {
    if (pct >= 90) return 'var(--red)';
    if (pct >= 70) return 'var(--amber)';
    return 'var(--green)';
  };

  return (
    <div className="mvi-budget-bar">
      <div className="budget-info">
        <span className="budget-label">MVI Budget</span>
        <span className="budget-values">
          {used} / {budget} credits ({remaining} remaining)
        </span>
      </div>
      
      <div className="budget-track">
        <div 
          className="budget-fill used" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: getColor(percentage),
          }}
        />
        {planCost && (
          <div 
            className="budget-fill planned" 
            style={{ 
              width: `${planPercentage}%`,
              left: `${percentage}%`,
            }}
          />
        )}
      </div>
      
      {planCost && (
        <div className="budget-plan-info">
          Planned operation cost: {planCost} credits
        </div>
      )}
    </div>
  );
}
