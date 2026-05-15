import { useEffect, useRef } from 'react';
import type { EthicalRefusalResult } from '@dyad/shared';

interface Props {
  refusal: EthicalRefusalResult;
  onDismiss: () => void;
}

/**
 * Full-screen crisis overlay shown whenever ethical_refusal.safe === false.
 *
 * Rules:
 *   - Blocks the rest of the UI (z-index above everything).
 *   - Cannot be dismissed by clicking the backdrop or pressing Escape — the
 *     user must explicitly acknowledge the resources.
 *   - Dismiss button text is empathetic, not "Close".
 *   - Visual treatment is warm amber, not alarming red.
 */
export function CrisisOverlay({ refusal, onDismiss }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Trap Escape — the user must use the button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    buttonRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="crisis-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-heading"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="crisis-card">
        <h1 id="crisis-heading">We noticed something that needs attention</h1>
        <p className="crisis-lede">
          Some of what's in this conversation sounds really hard. Before any analysis,
          here are people who can help right now — that matters more than any pattern
          this app could surface.
        </p>

        <div className="crisis-resources">
          {refusal.crisis_resources.map((r) => (
            <article className="crisis-resource" key={r.name}>
              <h3>{r.name}</h3>
              <p>{r.description}</p>
              {r.phone && (
                <p className="contact">
                  Call:&nbsp;
                  <a href={`tel:${r.phone.replace(/\D/g, '')}`}>{r.phone}</a>
                </p>
              )}
              {r.text && <p className="contact">Text: {r.text}</p>}
              {r.url && (
                <p className="contact">
                  <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                </p>
              )}
            </article>
          ))}
        </div>

        <button
          ref={buttonRef}
          className="crisis-ack-button"
          onClick={onDismiss}
        >
          I understand — show me resources
        </button>
      </div>
    </div>
  );
}
