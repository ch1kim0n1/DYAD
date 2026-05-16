import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareBrief } from './carecircleDemo.js';
import { careCircleFixture, generateMessageDrafts } from './carecircleDemo.js';

interface CareMessageComposerProps {
  brief: CareBrief;
}

export function CareMessageComposer({ brief }: CareMessageComposerProps) {
  const drafts = brief.messageDrafts ?? generateMessageDrafts(careCircleFixture);
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);
  const [queuedTitle, setQueuedTitle] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});

  const draftCards = [
    {
      title: 'Check-in for Mom',
      label: 'GENTLE',
      text: drafts.toParent,
      queueLabel: 'Queue for morning',
      previewAction: 'Open',
      reasons: [
        "Used Linda's preference for morning calls.",
        'Framed help around comfort and independence.',
        'Asked one concrete question instead of overwhelming her.',
      ],
    },
    {
      title: 'Family update',
      label: 'READY',
      text: drafts.toSiblings,
      queueLabel: 'Queue family update',
      previewAction: 'Open',
      reasons: [
        'Separated Sarah, Arjun, and Maya into clear next roles.',
        'Kept the update short enough for a family thread.',
        'Avoided blame and medical assumptions.',
      ],
    },
    {
      title: 'Pharmacy summary',
      label: 'APPROVE FIRST',
      text: drafts.toDoctorOrPharmacist,
      queueLabel: 'Review before sharing',
      previewAction: 'Review before sharing',
      reasons: [
        'Kept the note clinical and source-based.',
        'Said family notes mention symptoms, not that medication caused them.',
        'Asked for guidance from a doctor or pharmacist.',
      ],
    },
  ];

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
      </motion.div>

      <motion.div className="message-grid" variants={stagger}>
        {draftCards.map((draft) => (
          <MessageCard
            key={draft.title}
            title={draft.title}
            label={draft.label}
            text={draft.text}
            selected={selectedTitle === draft.title}
            onOpen={(title) => setSelectedTitle(title)}
            previewAction={draft.previewAction}
            value={draftEdits[draft.title] ?? draft.text}
            onEdit={(value) => setDraftEdits((current) => ({ ...current, [draft.title]: value }))}
            onCopy={() => copyDraft(draft.title, draftEdits[draft.title] ?? draft.text)}
            onQueue={() => setQueuedTitle(draft.title)}
            copied={copiedTitle === draft.title}
            queued={queuedTitle === draft.title}
            queueLabel={draft.queueLabel}
            reasons={draft.reasons}
          />
        ))}
      </motion.div>
    </motion.section>
  );
}

function MessageCard({
  title,
  label,
  text,
  selected,
  onOpen,
  previewAction,
  value,
  onEdit,
  onCopy,
  onQueue,
  copied,
  queued,
  queueLabel,
  reasons,
}: {
  title: string;
  label: string;
  text: string;
  selected: boolean;
  onOpen: (title: string) => void;
  previewAction: string;
  value: string;
  onEdit: (value: string) => void;
  onCopy: () => void;
  onQueue: () => void;
  copied: boolean;
  queued: boolean;
  queueLabel: string;
  reasons: string[];
}) {
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.article className={`message-card ${selected ? 'selected expanded-message-card' : ''}`} variants={fadeUp}>
      <div className="message-card-header">
        <h2>{title}</h2>
        <span>{label}</span>
      </div>
      <p className="draft-preview">{getDraftPreview(text)}</p>
      <div className="care-action-buttons single">
        <button
          className={label === 'APPROVE FIRST' ? 'care-card-button warn' : 'care-card-button'}
          type="button"
          onClick={() => onOpen(title)}
        >
          {previewAction}
        </button>
      </div>
      {selected && (
        <motion.section
          className="message-composer-panel embedded"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="composer-editor">
            <textarea value={value} onChange={(event) => onEdit(event.target.value)} />
            <div className="care-action-buttons">
              <button className="copy-draft-button" type="button" onClick={onCopy}>
                {copied ? 'Copied' : 'Copy edited draft'}
              </button>
              <button
                className={`care-card-button ${queued ? 'is-done' : ''}`}
                type="button"
                onClick={onQueue}
              >
                {queued ? 'Queued' : queueLabel}
              </button>
            </div>
          </div>
          <aside className="composer-reasoning">
            <p className="care-kicker">Why I wrote it this way</p>
            {reasons.map((reason) => (
              <div className="reason-row" key={reason}>
                <span className="status-dot ready" />
                <p>{reason}</p>
              </div>
            ))}
          </aside>
        </motion.section>
      )}
    </motion.article>
  );
}

function getDraftPreview(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;
  return sentences.slice(0, 2).join(' ').trim();
}
