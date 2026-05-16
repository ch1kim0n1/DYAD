/**
 * Skeleton placeholders (#82). Rendered while the engine warms up or the
 * orchestrator hasn't produced a result yet. Each variant matches the
 * approximate shape of its real content so the layout doesn't shift on
 * load.
 */
import './Skeleton.css';

export function SkeletonRect({
  width = '100%',
  height = 24,
  className = '',
  style = {},
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton-rect ${className}`} style={{ width, height, ...style }} />;
}

export function MapSkeleton() {
  return (
    <div className="map-skeleton">
      <SkeletonRect width="100%" height={300} />
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <SkeletonRect width={80} height={12} />
        <SkeletonRect width={80} height={12} />
      </div>
    </div>
  );
}

export function AtlasSkeleton() {
  return (
    <div className="atlas-skeleton">
      <SkeletonRect width={160} height={56} style={{ marginBottom: 16 }} />
      <SkeletonRect width={240} height={32} style={{ marginBottom: 16 }} />
      <div className="atlas-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRect key={i} width="100%" height={112} />
        ))}
      </div>
    </div>
  );
}

export function MirrorSkeleton() {
  return (
    <div className="mirror-skeleton" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <SkeletonRect width="100%" height={260} />
      <div>
        <SkeletonRect width="100%" height={20} style={{ marginBottom: 12 }} />
        <SkeletonRect width="80%" height={20} style={{ marginBottom: 12 }} />
        <SkeletonRect width="60%" height={20} />
      </div>
    </div>
  );
}

export function DivergenceSkeleton() {
  return (
    <div className="divergence-skeleton">
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 24 }}>
        <SkeletonRect width={80} height={80} />
        <SkeletonRect width={120} height={80} />
        <SkeletonRect width={80} height={80} />
      </div>
      <SkeletonRect width="100%" height={120} style={{ marginTop: 12 }} />
    </div>
  );
}
