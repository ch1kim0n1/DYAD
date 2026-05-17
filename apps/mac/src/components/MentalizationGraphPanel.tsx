/**
 * Mentalization Graph Panel - displays belief nodes and their confidence
 */
interface MentalizationGraphPanelProps {
  graphSnapshotId: string;
}

export function MentalizationGraphPanel({ graphSnapshotId }: MentalizationGraphPanelProps) {
  // In a full implementation, this would fetch and display the actual graph
  // For now, showing a placeholder that represents the graph structure
  
  const mockNodes = [
    { id: 'attachment-1', dimension: 'attachment', claim: 'Partner values emotional intimacy', confidence: 0.67 },
    { id: 'values-1', dimension: 'values', claim: 'Partner prioritizes honesty', confidence: 0.75 },
    { id: 'communication-1', dimension: 'communication', claim: 'Partner withdraws when stressed', confidence: 0.40 },
    { id: 'external-1', dimension: 'external_context', claim: 'Partner experiencing work stress', confidence: 0.71 },
  ];

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'var(--green)';
    if (confidence >= 0.5) return 'var(--amber)';
    return 'var(--red)';
  };

  return (
    <div className="mentalization-graph-panel">
      <h3>Mentalization Graph</h3>
      <div className="graph-snapshot">Snapshot: {graphSnapshotId}</div>
      
      <div className="belief-nodes">
        {mockNodes.map((node) => (
          <div key={node.id} className="belief-node">
            <div className="node-header">
              <span className="node-dimension">{node.dimension}</span>
              <span 
                className="node-confidence" 
                style={{ color: getConfidenceColor(node.confidence) }}
              >
                {(node.confidence * 100).toFixed(0)}%
              </span>
            </div>
            
            <div className="node-claim">{node.claim}</div>
            
            <div className="node-bar-container">
              <div 
                className="node-bar" 
                style={{ 
                  width: `${node.confidence * 100}%`,
                  backgroundColor: getConfidenceColor(node.confidence),
                }}
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="graph-footer">
        <small>Graph visualization placeholder - full implementation would render interactive graph</small>
      </div>
    </div>
  );
}
