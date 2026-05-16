import { useState } from 'react';
import type { CareBrief } from './carecircleDemo.js';

interface CareMessageComposerProps {
  brief: CareBrief | null;
  onAnalyze: () => void;
}

const fallbackDrafts = {
  toParent:
    'Morning Mom, I wanted to check in. Have you felt dizzy at all after taking the new medication? No rush, I just want to help you stay comfortable and independent.',
  toSiblings:
    'Quick update: Mom skipped lunch twice, repeated the appointment question a few times, and mentioned dizziness after the med change. Sarah, can you call the pharmacy? Arjun, can you confirm the appointment? I’ll check in with Mom this morning.',
  toDoctorOrPharmacist:
    'Linda started a new blood pressure medication five days ago. Since then, family notes mention dizziness twice, two skipped lunches, and repeated questions about an upcoming appointment. We are not assuming causation, but would like guidance on whether medication timing, dosage, or side effects should be reviewed.',
};

export function CareMessageComposer({ brief, onAnalyze }: CareMessageComposerProps) {
  const drafts = brief?.messageDrafts ?? fallbackDrafts;
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);

  const copyDraft = async (title: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTitle(title);
    window.setTimeout(() => setCopiedTitle(null), 1400);
  };

  return (
    <section className="care-messages-view">
      <div className="view-heading messages-heading">
        <div>
          <p className="care-kicker">Ready when you are</p>
          <h1>I wrote the careful parts. You decide what goes out.</h1>
        </div>
        {!brief && (
          <button className="care-secondary-button" type="button" onClick={onAnalyze}>
            Catch me up
          </button>
        )}
      </div>

      <div className="message-grid">
        <MessageCard
          title="Check-in for Mom"
          label="gentle"
          text={drafts.toParent}
          copied={copiedTitle === 'Check-in for Mom'}
          onCopy={copyDraft}
        />
        <MessageCard
          title="Family update"
          label="ready"
          text={drafts.toSiblings}
          copied={copiedTitle === 'Family update'}
          onCopy={copyDraft}
        />
        <MessageCard
          title="Pharmacy summary"
          label="approve first"
          text={drafts.toDoctorOrPharmacist}
          copied={copiedTitle === 'Pharmacy summary'}
          onCopy={copyDraft}
        />
      </div>
    </section>
  );
}

function MessageCard({
  title,
  label,
  text,
  copied,
  onCopy,
}: {
  title: string;
  label: string;
  text: string;
  copied: boolean;
  onCopy: (title: string, text: string) => void;
}) {
  return (
    <article className="message-card">
      <div className="message-card-header">
        <h2>{title}</h2>
        <span>{label}</span>
      </div>
      <p>{text}</p>
      <button className="copy-draft-button" type="button" onClick={() => onCopy(title, text)}>
        {copied ? 'Copied' : 'Copy draft'}
      </button>
    </article>
  );
}
