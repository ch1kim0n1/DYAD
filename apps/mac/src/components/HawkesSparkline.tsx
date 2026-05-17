/**
 * Hawkes Sparkline - displays polling intensity over time
 */
interface HawkesSparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

export function HawkesSparkline({ data, width = 100, height = 30 }: HawkesSparklineProps) {
  if (data.length === 0) {
    return <div className="hawkes-sparkline empty">No data</div>;
  }

  const max = Math.max(...data, 1);
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - (value / max) * height;
    return `${x},${y}`;
  }).join(' ');

  const lastValue = data[data.length - 1];
  const getColor = (value: number): string => {
    if (value > max * 0.8) return 'var(--red)';
    if (value > max * 0.5) return 'var(--amber)';
    return 'var(--green)';
  };

  return (
    <div className="hawkes-sparkline">
      <svg width={width} height={height}>
        <polyline
          points={points}
          fill="none"
          stroke={getColor(lastValue)}
          strokeWidth="2"
        />
      </svg>
      <div className="sparkline-value" style={{ color: getColor(lastValue) }}>
        {lastValue.toFixed(2)}
      </div>
    </div>
  );
}
