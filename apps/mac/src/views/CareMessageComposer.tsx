import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareBrief } from './carecircleDemo.js';

interface CareMessageComposerProps {
  brief: CareBrief | null;
  onAnalyze: () => void;
}

const fallbackDrafts = {
  toParent:
    'Morning Mom, I wanted to check in. Have you felt dizzy at all after taking the new medication? No rush, I just want to help you stay comfortable and independent.',
  toSiblings:
    "Quick update: Mom skipped lunch twice, repeated the appointment question a few times, and mentioned dizziness after the med change. Sarah, can you call the pharmacy? Arjun, can you confirm the appointment? I'll check in with Mom this morning.",
  toDoctorOrPharmacist:
    'Linda started a new blood pressure medication five days ago. Since then, family notes mention dizziness twice, two skipped lunches, and repeated questions about an upcoming appointment. We are not assuming causation, but would like guidance on whether medication timing, dosage, or side effects should be reviewed.',
};

export function CareMessageComposer({ brief, onAnalyze }: CareMessageComposerProps) {
  const drafts = brief?.messageDrafts ?? fallbackDrafts;
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);
  const [queuedTitle, setQueuedTitle] = useState<string | null>(null);

  const stagger: Variants = {
    animate: {
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.08,
      },
    },
  };
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const copyDraft = async (title: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTitle(title);
    window.setTimeout(() => setCopiedTitle(null), 1400);
  };

  return (
    <motion.section className="care-messages-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="view-heading messages-heading" variants={fadeUp}>
        <div>
          <p className="care-kicker">Ready when you are</p>
          <h1>I wrote the careful parts. You decide what goes out.</h1>
        </div>
        {!brief && (
          <button className="care-secondary-button" type="button" onClick={onAnalyze}>
            Catch me up
          </button>
        )}
      </motion.div>

      <motion.div className="message-grid" variants={stagger}>
        <MessageCard
          title="Check-in for Mom"
          label="gentle"
          text={drafts.toParent}
          copied={copiedTitle === 'Check-in for Mom'}
          queued={queuedTitle === 'Check-in for Mom'}
          onCopy={copyDraft}
          onQueue={(title) => setQueuedTitle(title)}
          queueLabel="Queue for morning"
        />
        <MessageCard
          title="Family update"
          label="ready"
          text={drafts.toSiblings}
          copied={copiedTitle === 'Family update'}
          queued={queuedTitle === 'Family update'}
          onCopy={copyDraft}
          onQueue={(title) => setQueuedTitle(title)}
          queueLabel="Queue family update"
        />
        <MessageCard
          title="Pharmacy summary"
          label="approve first"
          text={drafts.toDoctorOrPharmacist}
          copied={copiedTitle === 'Pharmacy summary'}
          queued={queuedTitle === 'Pharmacy summary'}
          onCopy={copyDraft}
          onQueue={(title) => setQueuedTitle(title)}
          queueLabel="Review before sharing"
        />
      </motion.div>
    </motion.section>
  );
}

function MessageCard({
  title,
  label,
  text,
  copied,
  queued,
  onCopy,
  onQueue,
  queueLabel,
}: {
  title: string;
  label: string;
  text: string;
  copied: boolean;
  queued: boolean;
  onCopy: (title: string, text: string) => void;
  onQueue: (title: string) => void;
  queueLabel: string;
}) {
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.article className="message-card" variants={fadeUp}>
      <div className="message-card-header">
        <h2>{title}</h2>
        <span>{label}</span>
      </div>
      <p>{text}</p>
      <div className="care-action-buttons">
        <button className="copy-draft-button" type="button" onClick={() => onCopy(title, text)}>
          {copied ? 'Copied' : 'Copy draft'}
        </button>
        <button className={`care-card-button ${queued ? 'is-done' : ''}`} type="button" onClick={() => onQueue(title)}>
          {queued ? 'Queued' : queueLabel}
        </button>
      </div>
    </motion.article>
  );
}
