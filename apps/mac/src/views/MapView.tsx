import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from 'recharts';
import type { FeatureVector, OrchestratorResult } from '@dyad/shared';

interface MapViewProps {
  vectors: FeatureVector[];
  detectorResult: OrchestratorResult | null;
  onMarkerClick: (messageId: string) => void;
}

interface ChartRow {
  index: number;
  message_id: string;
  self?: number;
  partner?: number;
  detector?: string;
}

const MAX_POINTS = 50;

export function MapView({ vectors, detectorResult, onMarkerClick }: MapViewProps) {
  const data: ChartRow[] = useMemo(() => {
    const slice = vectors.slice(-MAX_POINTS);
    return slice.map((v, i) => {
      // Alternate-side display: we don't have is_from_me here, so use parity
      // as a visual placeholder. Real wiring sets one of `self` / `partner`
      // based on the matching NormalizedMessage in the store.
      const isSelf = i % 2 === 0;
      return {
        index: i,
        message_id: v.message_id,
        self: isSelf ? v.afinn_valence : undefined,
        partner: isSelf ? undefined : v.afinn_valence,
      };
    });
  }, [vectors]);

  if (vectors.length < 5) {
    return (
      <div className="empty">
        The Map needs at least 5 messages to draw a trajectory. Keep going and it'll appear here.
      </div>
    );
  }

  const detectorMarkers: { index: number; valence: number; label: string; message_id: string }[] = [];
  if (detectorResult) {
    if (detectorResult.bid_asymmetry?.detected) {
      detectorMarkers.push({
        index: data.length - 1,
        valence: data[data.length - 1]?.self ?? data[data.length - 1]?.partner ?? 0,
        label: 'bid asymmetry',
        message_id: data[data.length - 1]?.message_id ?? '',
      });
    }
    if (detectorResult.predictive_divergence?.detected) {
      detectorMarkers.push({
        index: data.length - 1,
        valence: 0,
        label: 'divergence',
        message_id: data[data.length - 1]?.message_id ?? '',
      });
    }
    if (detectorResult.phantom_third_party?.detected) {
      detectorMarkers.push({
        index: Math.floor(data.length / 2),
        valence: 0,
        label: 'phantom',
        message_id: data[Math.floor(data.length / 2)]?.message_id ?? '',
      });
    }
  }

  return (
    <div className="map-view">
      <div className="map-legend">
        <span><span className="legend-dot self" />Self</span>
        <span><span className="legend-dot partner" />Partner</span>
        <span>Markers = detected patterns (click for brief)</span>
      </div>
      <div style={{ flex: 1, minHeight: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#26262c" />
            <XAxis dataKey="index" stroke="#8a8a92" />
            <YAxis domain={[-5, 5]} stroke="#8a8a92" />
            <Tooltip
              contentStyle={{ background: '#16161a', border: '1px solid #26262c', color: '#e8e8ed' }}
              labelFormatter={(idx) => `Message ${idx}`}
            />
            <Line
              type="monotone"
              dataKey="self"
              stroke="#5b8def"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="Self"
            />
            <Line
              type="monotone"
              dataKey="partner"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="Partner"
            />
            {detectorMarkers.map((m, i) => (
              <ReferenceDot
                key={`${m.message_id}-${i}`}
                x={m.index}
                y={m.valence}
                r={6}
                fill="#fde047"
                stroke="#a16207"
                onClick={() => onMarkerClick(m.message_id)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
