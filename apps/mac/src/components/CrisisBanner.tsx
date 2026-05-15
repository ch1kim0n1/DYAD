import type { EthicalRefusalResult } from '@dyad/shared';

export function CrisisBanner({ refusal }: { refusal: EthicalRefusalResult }) {
  return (
    <div className="crisis">
      <h1>Before we keep going</h1>
      <p>
        Some of what you shared sounds heavy. We're going to pause the analysis and show
        people who can help right now — that's more important than any pattern this app
        could surface.
      </p>
      {refusal.crisis_resources.map((r) => (
        <div className="crisis-resource" key={r.name}>
          <div className="name">{r.name}</div>
          <div>{r.description}</div>
          {r.phone && (
            <div className="contact">
              Call: <a href={`tel:${r.phone}`} style={{ color: 'inherit' }}>{r.phone}</a>
            </div>
          )}
          {r.text && <div className="contact">Text: {r.text}</div>}
          {r.url && (
            <div className="contact">
              <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{r.url}</a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
