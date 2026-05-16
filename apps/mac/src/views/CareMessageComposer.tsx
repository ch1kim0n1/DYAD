import { useState, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import type { CareBrief } from './carecircleDemo.js';
import { careCircleFixture, generateMessageDrafts } from './carecircleDemo.js';
import { openEmailDraft, openSmsDraft } from './carecircleActions.js';
import { checkCareProviderContext } from './carecircleExternalContext.js';
import type { CareCircleRuntimeState } from './carecircleRuntime.js';

interface CareMessageComposerProps {
  brief: CareBrief;
  runtimeState: CareCircleRuntimeState;
  onRuntimeStateChange: Dispatch<SetStateAction<CareCircleRuntimeState>>;
}

export function CareMessageComposer({
  brief,
  runtimeState,
  onRuntimeStateChange,
}: CareMessageComposerProps) {
  const drafts = brief.messageDrafts ?? generateMessageDrafts(careCircleFixture);
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  const draftCards = [
    {
      title: 'Check-in for Mom',
      label: 'GENTLE',
      text: drafts.toParent,
      queueLabel: 'Queue for morning',
      previewAction: 'Open',
      shareModes: ['sms'],
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
      shareModes: ['sms', 'email'],
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
      shareModes: ['email'],
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
  const updateDraft = (title: string, text: string) => {
    onRuntimeStateChange((current) => ({
      ...current,
      draftEdits: { ...current.draftEdits, [title]: text },
    }));
  };
  const queueDraft = (title: string, queueLabel: string) => {
    onRuntimeStateChange((current) => ({
      ...current,
      queuedDrafts: { ...current.queuedDrafts, [title]: queueLabel },
    }));
  };
  const checkProviderContext = async () => {
    onRuntimeStateChange((current) => ({
      ...current,
      providerContext: {
        status: 'checking',
        source: 'thehog',
        summary: 'Checking external provider context for the pharmacy handoff.',
        items: [],
      },
    }));
    const providerContext = await checkCareProviderContext();
    onRuntimeStateChange((current) => ({ ...current, providerContext }));
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
                value={runtimeState.draftEdits[selectedDraft.title] ?? selectedDraft.text}
                onChange={(event) =>
                  updateDraft(selectedDraft.title, event.target.value)
                }
              />
              <motion.div className="care-action-buttons" variants={composerPiece}>
                <button
                  className="copy-draft-button"
                  type="button"
                  onClick={() =>
                    copyDraft(selectedDraft.title, runtimeState.draftEdits[selectedDraft.title] ?? selectedDraft.text)
                  }
                >
                  {copiedTitle === selectedDraft.title ? 'Copied' : 'Copy edited draft'}
                </button>
                <button
                  className={`care-card-button ${runtimeState.queuedDrafts[selectedDraft.title] ? 'is-done' : ''}`}
                  type="button"
                  onClick={() => queueDraft(selectedDraft.title, selectedDraft.queueLabel)}
                >
                  {runtimeState.queuedDrafts[selectedDraft.title] ? 'Queued' : selectedDraft.queueLabel}
                </button>
                {selectedDraft.shareModes.includes('sms') && (
                  <button
                    className="care-card-button secondary"
                    type="button"
                    onClick={() => openSmsDraft(runtimeState.draftEdits[selectedDraft.title] ?? selectedDraft.text)}
                  >
                    Open SMS
                  </button>
                )}
                {selectedDraft.shareModes.includes('email') && (
                  <button
                    className="care-card-button secondary"
                    type="button"
                    onClick={() =>
                      openEmailDraft({
                        subject: getEmailSubject(selectedDraft.title),
                        body: runtimeState.draftEdits[selectedDraft.title] ?? selectedDraft.text,
                      })
                    }
                  >
                    Open email
                  </button>
                )}
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
              {selectedDraft.title === 'Pharmacy summary' && (
                <motion.div className="composer-context-check" variants={reasonPiece}>
                  <strong>Provider context</strong>
                  <p>
                    {runtimeState.providerContext?.summary ??
                      'Optional Hog lookup can attach provider context without changing the family-note evidence.'}
                  </p>
                  <button
                    className="care-card-button secondary full"
                    type="button"
                    onClick={checkProviderContext}
                    disabled={runtimeState.providerContext?.status === 'checking'}
                  >
                    {runtimeState.providerContext?.status === 'checking'
                      ? 'Checking context...'
                      : 'Check provider context'}
                  </button>
                </motion.div>
              )}
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

function getEmailSubject(title: string): string {
  if (title === 'Pharmacy summary') return 'Linda medication review question';
  if (title === 'Family update') return 'CareCircle update for Mom';
  return 'CareCircle check-in';
}
