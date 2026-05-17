import { useMemo } from 'react';
import { ParentSize } from '@visx/responsive';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import type { FeatureVector, NormalizedMessage, OrchestratorResult } from '@dyad/shared';
import { OfflineBadge } from '../components/OfflineBadge.js';
import { useDyadStore } from '../store.js';

interface MapViewProps {
  vectors: FeatureVector[];
  messages: NormalizedMessage[];
  detectorResult: OrchestratorResult | null;
  onMarkerClick: (messageId: string) => void;
}

interface ChartRow {
  index: number;
  message_id: string;
  self?: number;
  partner?: number;
}

interface DetectorMarker {
  index: number;
  valence: number;
  label: string;
  tooltip: string;
  message_id: string;
}

const MAX_POINTS = 50;
const MARGIN = { top: 16, right: 24, left: 44, bottom: 30 };

interface InnerChartProps {
  width: number;
  height: number;
  data: ChartRow[];
  detectorMarkers: DetectorMarker[];
  partnerName: string;
  onMarkerClick: (id: string) => void;
}

function InnerChart({ width, height, data, detectorMarkers, onMarkerClick }: InnerChartProps) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<DetectorMarker>();

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () => scaleLinear({ domain: [0, Math.max(data.length - 1, 1)], range: [0, innerWidth] }),
    [data.length, innerWidth],
  );
  const yScale = useMemo(
    () => scaleLinear({ domain: [-5, 5], range: [innerHeight, 0] }),
    [innerHeight],
  );

  const selfPoints = useMemo(() => data.filter((d) => d.self !== undefined), [data]);
  const partnerPoints = useMemo(() => data.filter((d) => d.partner !== undefined), [data]);

  if (width < 10) return null;

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={yScale} width={innerWidth} stroke="#26262c" strokeDasharray="3,3" />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            stroke="#8a8a92"
            tickStroke="#8a8a92"
            numTicks={6}
            tickLabelProps={() => ({ fill: '#8a8a92', fontSize: 11, textAnchor: 'middle' as const })}
          />
          <AxisLeft
            scale={yScale}
            stroke="#8a8a92"
            tickStroke="#8a8a92"
            numTicks={5}
            tickLabelProps={() => ({
              fill: '#8a8a92',
              fontSize: 11,
              dx: -4,
              textAnchor: 'end' as const,
              dy: 4,
            })}
          />
          <LinePath
            data={selfPoints}
            x={(d) => xScale(d.index)}
            y={(d) => yScale(d.self!)}
            stroke="#5b8def"
            strokeWidth={2}
            curve={curveMonotoneX}
          />
          <LinePath
            data={partnerPoints}
            x={(d) => xScale(d.index)}
            y={(d) => yScale(d.partner!)}
            stroke="#f97316"
            strokeWidth={2}
            curve={curveMonotoneX}
          />
          {detectorMarkers.map((m, i) => (
            <circle
              key={`${m.message_id}-${i}`}
              cx={xScale(m.index)}
              cy={yScale(m.valence)}
              r={6}
              fill="#fde047"
              stroke="#a16207"
              strokeWidth={1.5}
              style={{ cursor: 'pointer' }}
              onClick={() => onMarkerClick(m.message_id)}
              onMouseEnter={() =>
                showTooltip({
                  tooltipData: m,
                  tooltipLeft: xScale(m.index) + MARGIN.left,
                  tooltipTop: yScale(m.valence) + MARGIN.top - 12,
                })
              }
              onMouseLeave={hideTooltip}
            />
          ))}
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          style={{
            ...defaultStyles,
            background: '#16161a',
            border: '1px solid #26262c',
            color: '#e8e8ed',
            fontSize: 12,
            maxWidth: 240,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          <strong>{tooltipData.label}</strong>
          {tooltipData.tooltip && (
            <>
              <br />
              {tooltipData.tooltip}
            </>
          )}
        </TooltipWithBounds>
      )}
    </div>
  );
}

export function MapView({ vectors, messages, detectorResult, onMarkerClick }: MapViewProps) {
  const partnerName = useDyadStore((s) => s.partnerName);
  const brief = useDyadStore((s) => s.currentBrief);
  const messageById = useMemo(
    () => new Map(messages.map((m) => [m.message_id, m])),
    [messages],
  );

  const data: ChartRow[] = useMemo(() => {
    const slice = vectors.slice(-MAX_POINTS);
    return slice.map((v, i) => {
      const msg = messageById.get(v.message_id);
      const isSelf = msg?.is_from_me ?? false;
      return {
        index: i,
        message_id: v.message_id,
        self: isSelf ? v.afinn_valence : undefined,
        partner: isSelf ? undefined : v.afinn_valence,
      };
    });
  }, [vectors, messageById]);

  if (vectors.length < 5) {
    return (
      <div className="empty">
        The Map needs at least 5 messages to draw a trajectory. Keep going and it'll appear here.
      </div>
    );
  }

  const briefSnippet = brief
    ? brief.split('\n')[0].replace(/^\[.*?\]:\s*/, '').slice(0, 80)
    : null;

  const detectorMarkers: DetectorMarker[] = [];
  if (detectorResult) {
    if (detectorResult.bid_asymmetry?.detected) {
      const b = detectorResult.bid_asymmetry;
      detectorMarkers.push({
        index: data.length - 1,
        valence: data[data.length - 1]?.self ?? data[data.length - 1]?.partner ?? 0,
        label: 'bid asymmetry',
        tooltip: `Bid asymmetry (${b.severity})\n${briefSnippet ?? 'Click for full insight →'}`,
        message_id: data[data.length - 1]?.message_id ?? '',
      });
    }
    if (detectorResult.predictive_divergence?.detected) {
      const d = detectorResult.predictive_divergence;
      detectorMarkers.push({
        index: data.length - 1,
        valence: 0,
        label: 'divergence',
        tooltip: `Predictive divergence (Δ ${d.divergence_score.toFixed(2)})\n${briefSnippet ?? 'Click for full insight →'}`,
        message_id: data[data.length - 1]?.message_id ?? '',
      });
    }
    if (detectorResult.phantom_third_party?.detected) {
      const p = detectorResult.phantom_third_party;
      detectorMarkers.push({
        index: Math.floor(data.length / 2),
        valence: 0,
        label: 'phantom',
        tooltip: `Phantom third-party (ratio ${p.ratio.toFixed(2)})\n${briefSnippet ?? 'Click for full insight →'}`,
        message_id: data[Math.floor(data.length / 2)]?.message_id ?? '',
      });
    }
  }

  return (
    <div className="map-view">
      <div className="map-legend">
        <span>
          <span className="legend-dot self" />
          You
        </span>
        <span>
          <span className="legend-dot partner" />
          {partnerName}
        </span>
        <span>Markers = detected patterns (click for brief)</span>
        <OfflineBadge reason="LLM detectors paused" />
      </div>
      <div style={{ flex: 1, minHeight: 320 }}>
        <ParentSize>
          {({ width, height }) => (
            <InnerChart
              width={width}
              height={Math.max(height, 320)}
              data={data}
              detectorMarkers={detectorMarkers}
              partnerName={partnerName}
              onMarkerClick={onMarkerClick}
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}
