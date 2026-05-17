import { useMemo } from 'react';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import type { FeatureVector, SelfModel, PrimarySecondaryResult } from '@dyad/shared';

interface MirrorViewProps {
  selfModel: SelfModel | null;
  recentVectors: FeatureVector[];
  primarySecondaryResult: PrimarySecondaryResult | null;
}

const NRC_KEYS: { key: keyof FeatureVector; label: string }[] = [
  { key: 'nrc_joy', label: 'Joy' },
  { key: 'nrc_trust', label: 'Trust' },
  { key: 'nrc_anticipation', label: 'Anticip.' },
  { key: 'nrc_surprise', label: 'Surprise' },
  { key: 'nrc_fear', label: 'Fear' },
  { key: 'nrc_sadness', label: 'Sadness' },
  { key: 'nrc_disgust', label: 'Disgust' },
  { key: 'nrc_anger', label: 'Anger' },
];

const EMOTION_COLORS: Record<string, string> = {
  Joy: '#FFD700',
  Trust: '#3B82F6',
  'Anticip.': '#F97316',
  Surprise: '#EC4899',
  Fear: '#7C3AED',
  Sadness: '#64748B',
  Disgust: '#65A30D',
  Anger: '#DC2626',
};

interface RadarChartProps {
  width: number;
  height: number;
  data: { emotion: string; value: number }[];
}

function RadarChart({ width, height, data }: RadarChartProps) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 36;
  const n = data.length;

  const rScale = scaleLinear({ domain: [0, 100], range: [0, radius] });

  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const axes = data.map((d, i) => {
    const angle = startAngle + angleStep * i;
    return {
      label: d.emotion,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      lx: cx + (radius + 16) * Math.cos(angle),
      ly: cy + (radius + 16) * Math.sin(angle),
      angle,
      color: EMOTION_COLORS[d.emotion] ?? '#5b8def',
    };
  });

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const polygonPoints = data
    .map((d, i) => {
      const angle = startAngle + angleStep * i;
      const r = rScale(d.value);
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height}>
      <Group>
        {gridLevels.map((level) => {
          const pts = Array.from({ length: n }, (_, i) => {
            const angle = startAngle + angleStep * i;
            const r = radius * level;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              stroke="#26262c"
              strokeWidth={1}
            />
          );
        })}
        {axes.map((ax) => (
          <line
            key={ax.label}
            x1={cx}
            y1={cy}
            x2={ax.x}
            y2={ax.y}
            stroke="#26262c"
            strokeWidth={1}
          />
        ))}
        <polygon
          points={polygonPoints}
          fill="#5b8def"
          fillOpacity={0.25}
          stroke="#5b8def"
          strokeWidth={1.5}
        />
        {data.map((d, i) => {
          const angle = startAngle + angleStep * i;
          const r = rScale(d.value);
          return (
            <circle
              key={d.emotion}
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r={3}
              fill={EMOTION_COLORS[d.emotion] ?? '#5b8def'}
            />
          );
        })}
        {axes.map((ax) => (
          <text
            key={ax.label}
            x={ax.lx}
            y={ax.ly}
            fill={ax.color}
            fontSize={10}
            textAnchor={ax.lx < cx - 4 ? 'end' : ax.lx > cx + 4 ? 'start' : 'middle'}
            dominantBaseline="middle"
          >
            {ax.label}
          </text>
        ))}
      </Group>
    </svg>
  );
}

export function MirrorView({ selfModel, recentVectors, primarySecondaryResult }: MirrorViewProps) {
  const messageCount = recentVectors.length;

  const radarData = useMemo(() => {
    if (recentVectors.length === 0) {
      return NRC_KEYS.map(({ label }) => ({ emotion: label, value: 0 }));
    }
    return NRC_KEYS.map(({ key, label }) => {
      const avg =
        recentVectors.reduce((s, v) => s + (v[key] as number), 0) / recentVectors.length;
      return { emotion: label, value: Number((avg * 100).toFixed(2)) };
    });
  }, [recentVectors]);

  const fwAvg = useMemo(() => {
    if (recentVectors.length === 0) return { fw_i: 0, fw_we: 0, fw_you: 0 };
    return {
      fw_i: recentVectors.reduce((s, v) => s + v.fw_i, 0) / recentVectors.length,
      fw_we: recentVectors.reduce((s, v) => s + v.fw_we, 0) / recentVectors.length,
      fw_you: recentVectors.reduce((s, v) => s + v.fw_you, 0) / recentVectors.length,
    };
  }, [recentVectors]);

  if (messageCount < 10) {
    return (
      <div className="empty">
        The Mirror needs at least 10 of your own recent messages before it can reflect a pattern.
        Right now it has {messageCount}.
      </div>
    );
  }

  return (
    <div className="mirror">
      <div className="card">
        <h3>Emotional fingerprint (NRC)</h3>
        <div style={{ height: 280 }}>
          <ParentSize>
            {({ width, height }) => (
              <RadarChart width={width} height={Math.max(height, 240)} data={radarData} />
            )}
          </ParentSize>
        </div>
      </div>

      <div className="card">
        <h3>Word style</h3>
        <div className="fw-bar">
          <span className="name">I / me</span>
          <span className="bar">
            <span className="fill" style={{ width: `${Math.min(100, fwAvg.fw_i * 1000)}%` }} />
          </span>
        </div>
        <div className="fw-bar">
          <span className="name">we / us</span>
          <span className="bar">
            <span className="fill" style={{ width: `${Math.min(100, fwAvg.fw_we * 1000)}%` }} />
          </span>
        </div>
        <div className="fw-bar">
          <span className="name">you</span>
          <span className="bar">
            <span className="fill" style={{ width: `${Math.min(100, fwAvg.fw_you * 1000)}%` }} />
          </span>
        </div>
        <p style={{ color: '#8a8a92', fontSize: 12, marginTop: 12 }}>
          A "we" dominance signals shared framing; "you" dominance can signal blame or distance.
        </p>
      </div>

      <div className="card">
        <h3>Attachment signal</h3>
        {selfModel ? (
          <>
            {(['secure', 'anxious', 'avoidant', 'disorganized'] as const).map((k) => (
              <div className="fw-bar" key={k}>
                <span className="name">{k}</span>
                <span className="bar">
                  <span
                    className="fill"
                    style={{ width: `${(selfModel.attachment_indicators[k] || 0) * 100}%` }}
                  />
                </span>
              </div>
            ))}
            <p style={{ color: '#8a8a92', fontSize: 12, marginTop: 12 }}>
              Confidence: {(selfModel.attachment_indicators.confidence * 100).toFixed(0)}%
            </p>
          </>
        ) : (
          <p style={{ color: '#8a8a92' }}>Loading self-model…</p>
        )}
      </div>

      <div className="card">
        <h3>Recurring templates</h3>
        {selfModel && selfModel.recurring_templates.length > 0 ? (
          selfModel.recurring_templates.slice(0, 5).map((t) => (
            <span key={t.template_id} className="tag">
              {t.description}
            </span>
          ))
        ) : (
          <p style={{ color: '#8a8a92' }}>No recurring templates detected yet.</p>
        )}
        {primarySecondaryResult && primarySecondaryResult.confidence >= 0.7 && (
          <div style={{ marginTop: 16, padding: 12, borderTop: '1px solid #26262c' }}>
            <strong>Recent emotional layering:</strong>{' '}
            {primarySecondaryResult.surface_emotion} → {primarySecondaryResult.underlying_emotion}{' '}
            <span style={{ color: '#8a8a92' }}>
              (confidence {Math.round(primarySecondaryResult.confidence * 100)}%)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
