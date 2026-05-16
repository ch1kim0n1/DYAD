import { motion, type Variants } from 'framer-motion';
import { careCircleFixture } from './carecircleDemo.js';
import type { CareCircleRuntimeState } from './carecircleRuntime.js';

const trustControls = [
  {
    title: 'Encrypted family circle',
    body: 'CareCircle is designed around a private circle where family context is protected before it becomes a brief.',
  },
  {
    title: 'Synthetic demo data',
    body: 'This hackathon mode uses a fixture family and runs without iMessage, onboarding, sidecar, API keys, or live model calls.',
  },
  {
    title: 'No model training on family data',
    body: 'Family notes are treated as private care context, not training material.',
  },
  {
    title: 'Explicit sharing controls',
    body: 'Drafts are displayed for review. CareCircle does not auto-send messages or contact clinicians.',
  },
  {
    title: 'Export/delete controls',
    body: 'The product posture includes user-owned exports and deletion for family notes, briefs, and graph data.',
  },
  {
    title: 'Source visibility',
    body: 'Every insight shown in the Care Brief carries evidence chips back to the original family note or task.',
  },
  {
    title: 'Human review for medical concerns',
    body: 'Medication and symptom patterns are routed to human review and doctor or pharmacist guidance.',
  },
];

interface CareTrustCenterProps {
  runtimeState: CareCircleRuntimeState;
  onResetRuntimeState: () => void;
}

export function CareTrustCenter({ runtimeState, onResetRuntimeState }: CareTrustCenterProps) {
  const stagger: Variants = {
    animate: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
  };
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };
  const hasRuntimeData =
    runtimeState.planAccepted ||
    runtimeState.reminderSet ||
    Object.keys(runtimeState.actionStatus).length > 0 ||
    Object.keys(runtimeState.draftEdits).length > 0 ||
    Object.keys(runtimeState.queuedDrafts).length > 0 ||
    Boolean(runtimeState.gbrainMemory);

  const exportDemoState = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            graphId: careCircleFixture.id,
            graphName: careCircleFixture.name,
            runtimeState,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'carecircle-demo-state.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.section className="care-trust-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="trust-hero" variants={fadeUp}>
        <p className="care-kicker">Trust Center</p>
        <h1>Private by default, reviewable by design</h1>
        <p>
          CareCircle helps families coordinate care without making medical claims, surveilling, or standing in for
          family members, doctors, pharmacists, or caregivers.
        </p>
        <div className="brief-hero-actions">
          <button className="care-card-button" type="button" onClick={exportDemoState}>
            Export demo state
          </button>
          <button className="care-card-button secondary" type="button" onClick={onResetRuntimeState}>
            {hasRuntimeData ? 'Delete demo activity' : 'Demo activity clear'}
          </button>
        </div>
      </motion.div>

      <motion.section className="trust-memory-panel" variants={fadeUp}>
        <div>
          <p className="care-kicker">Live workflow signal</p>
          <h2>GBrain care memory</h2>
          <p>
            {runtimeState.gbrainMemory?.summary ??
              'Accept a care plan in the Care Brief to save it as a GBrain-compatible memory page.'}
          </p>
        </div>
        <span className={`provider-context-badge ${runtimeState.gbrainMemory?.status ?? 'idle'}`}>
          {runtimeState.gbrainMemory?.status === 'saved'
            ? 'GBrain'
            : runtimeState.gbrainMemory?.status === 'local'
            ? 'Saved'
            : 'Waiting'}
        </span>
      </motion.section>

      <motion.div className="trust-checklist" variants={stagger}>
        {trustControls.map((control) => (
          <motion.div className="trust-check-row" key={control.title} variants={fadeUp}>
            <span className="trust-check-icon" aria-hidden="true">OK</span>
            <div>
              <h2>{control.title}</h2>
              <p>{control.body}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
