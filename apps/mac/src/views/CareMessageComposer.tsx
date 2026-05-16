import { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { CareBrief } from './carecircleDemo.js';
import { careCircleFixture, generateMessageDrafts } from './carecircleDemo.js';
import { OfflineBadge } from '../components/OfflineBadge.js';

interface CareMessageComposerProps {
  brief: CareBrief;
  offline?: boolean;
}

export function CareMessageComposer({ brief, offline = false }: CareMessageComposerProps) {
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

  const selectedDraft = draftCards.find((card) => card.title === selectedTitle) ?? null;

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
  const composerStagger: Variants = {
    initial: { opacity: 0, y: 30 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.72,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.12,
        delayChildren: 0.14,
      },
    },
    exit: {
      opacity: 0,
      y: 14,
      transition: { duration: 0.24, ease: 'easeIn' },
    },
  };
  const composerPiece: Variants = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: 8, transition: { duration: 0.18 } },
  };
  const reasonPiece: Variants = {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
  };

  const copyDraft = async (title: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTitle(title);
      window.setTimeout(() => setCopiedTitle(null), 1400);
    } catch {
      // Clipboard API unavailable — show persistent "copied" state as a prompt to copy manually
      setCopiedTitle(title);
    }
  };

  return (
    <motion.section className="care-messages-view" initial="initial" animate="animate" variants={stagger}>
      {offline && <OfflineBadge reason="metrics from cache" />}
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
          />
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {selectedDraft && (
          <motion.section
            className="message-composer-panel"
            key={selectedDraft.title}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={composerStagger}
          >
            <motion.div className="composer-editor" variants={composerPiece}>
              <motion.div className="message-card-header" variants={composerPiece}>
                <h2>{selectedDraft.title}</h2>
                <span>{selectedDraft.label}</span>
              </motion.div>
              <motion.textarea
                variants={composerPiece}
                value={draftEdits[selectedDraft.title] ?? selectedDraft.text}
                onChange={(event) =>
                  setDraftEdits((current) => ({ ...current, [selectedDraft.title]: event.target.value }))
                }
              />
              <motion.div className="care-action-buttons" variants={composerPiece}>
                <button
                  className="copy-draft-button"
                  type="button"
                  onClick={() => copyDraft(selectedDraft.title, draftEdits[selectedDraft.title] ?? selectedDraft.text)}
                >
                  {copiedTitle === selectedDraft.title ? 'Copied' : 'Copy edited draft'}
                </button>
                <button
                  className={`care-card-button ${queuedTitle === selectedDraft.title ? 'is-done' : ''}`}
                  type="button"
                  onClick={() => setQueuedTitle(selectedDraft.title)}
                >
                  {queuedTitle === selectedDraft.title ? 'Queued' : selectedDraft.queueLabel}
                </button>
              </motion.div>
            </motion.div>
            <motion.aside className="composer-reasoning" variants={composerPiece}>
              <motion.p className="care-kicker" variants={reasonPiece}>
                Why I wrote it this way
              </motion.p>
              {selectedDraft.reasons.map((reason) => (
                <motion.div className="reason-row" key={reason} variants={reasonPiece}>
                  <span className="status-dot ready" />
                  <p>{reason}</p>
                </motion.div>
              ))}
            </motion.aside>
          </motion.section>
        )}
      </AnimatePresence>
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
}: {
  title: string;
  label: string;
  text: string;
  selected: boolean;
  onOpen: (title: string) => void;
  previewAction: string;
}) {
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.article className={`message-card ${selected ? 'selected' : ''}`} variants={fadeUp}>
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
    </motion.article>
  );
}

function getDraftPreview(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;
  return sentences.slice(0, 2).join(' ').trim();
}
