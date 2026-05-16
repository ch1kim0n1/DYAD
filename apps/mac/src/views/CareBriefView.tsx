import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareBrief } from './carecircleDemo.js';
import { evidenceText } from './carecircleDemo.js';

interface CareBriefViewProps {
  brief: CareBrief | null;
  onAnalyze: () => void;
}

export function CareBriefView({ brief, onAnalyze }: CareBriefViewProps) {
  const [handled, setHandled] = useState<Record<string, string>>({});
  const stagger: Variants = {
    animate: {
      transition: {
        staggerChildren: 0.11,
        delayChildren: 0.08,
      },
    },
  };
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  if (!brief) {
    return (
      <motion.section className="empty-brief" initial="initial" animate="animate" variants={fadeUp}>
        <p className="care-kicker">Care Brief</p>
        <h1>I can catch you up without making you read the whole week.</h1>
        <p>I will surface what changed, prepare the next moves, and pause anything sensitive for approval.</p>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          Catch me up
        </button>
      </motion.section>
    );
  }

  return (
    <motion.section className="care-brief-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="brief-hero" variants={fadeUp}>
        <p className="care-kicker">CareCircle brief</p>
        <h1>I found three changes. The next moves are staged.</h1>
        <p>
          Linda skipped lunch twice, repeated the appointment question, and family notes mention dizziness after
          a blood pressure medication change. I prepared the family update, appointment confirmation, and pharmacy
          call brief. The medical item is paused for human review.
        </p>
        <div className="brief-hero-actions">
          <button
            className="care-card-button"
            type="button"
            onClick={() => setHandled((current) => ({ ...current, brief: 'Care plan accepted' }))}
          >
            {handled.brief ?? 'Accept care plan'}
          </button>
          <button
            className="care-card-button secondary"
            type="button"
            onClick={() => setHandled((current) => ({ ...current, reminder: 'Quiet reminder set' }))}
          >
            {handled.reminder ?? 'Remind me tonight'}
          </button>
        </div>
      </motion.div>

      <motion.section className="care-plan-strip" aria-label="Today care plan" variants={stagger}>
        <motion.article className="plan-step done" variants={fadeUp}>
          <span>Ready</span>
          <h2>Sibling update</h2>
          <p>I drafted the family note with Sarah and Arjun's roles already separated.</p>
          <button
            className="care-card-button"
            type="button"
            onClick={() => setHandled((current) => ({ ...current, sibling: 'Queued for family' }))}
          >
            {handled.sibling ?? 'Queue family update'}
          </button>
        </motion.article>
        <motion.article className="plan-step done" variants={fadeUp}>
          <span>Ready</span>
          <h2>Appointment confirmation</h2>
          <p>I prepared the reminder so Arjun can confirm without re-reading the week.</p>
          <button
            className="care-card-button"
            type="button"
            onClick={() => setHandled((current) => ({ ...current, appointment: 'Reminder scheduled' }))}
          >
            {handled.appointment ?? 'Schedule reminder'}
          </button>
        </motion.article>
        <motion.article className="plan-step waiting" variants={fadeUp}>
          <span>Needs approval</span>
          <h2>Pharmacy call brief</h2>
          <p>I summarized the medication-related notes, but this should stay human-reviewed.</p>
          <button
            className="care-card-button warn"
            type="button"
            onClick={() => setHandled((current) => ({ ...current, pharmacy: 'Ready for Sarah' }))}
          >
            {handled.pharmacy ?? 'Review and approve'}
          </button>
        </motion.article>
      </motion.section>

      <div className="brief-layout">
        <div className="brief-main-column">
          <motion.section className="care-panel" variants={fadeUp}>
            <h2>Why I staged this</h2>
            <div className="insight-list">
              {brief.whatChanged.map((insight) => (
                <article className="insight-card" key={insight.id}>
                  <div className="insight-header">
                    <h3>{insight.claim}</h3>
                    <span className={`review-pill ${insight.safetyLevel}`}>
                      {insight.safetyLevel === 'medical_review' ? 'doctor or pharmacist' : 'human review'}
                    </span>
                  </div>
                  <p>{insight.recommendedAction}</p>
                  <div className="confidence-line">
                    <span>Confidence</span>
                    <strong>{Math.round(insight.confidence * 100)}%</strong>
                  </div>
                  <div className="care-action-buttons compact">
                    <button
                      className="care-card-button secondary"
                      type="button"
                      onClick={() => setHandled((current) => ({ ...current, [`${insight.id}-evidence`]: 'Evidence open' }))}
                    >
                      {handled[`${insight.id}-evidence`] ?? 'Review evidence'}
                    </button>
                    <button
                      className="care-card-button secondary"
                      type="button"
                      onClick={() => setHandled((current) => ({ ...current, [`${insight.id}-watch`]: 'Watching' }))}
                    >
                      {handled[`${insight.id}-watch`] ?? 'Keep watching'}
                    </button>
                  </div>
                  <div className="evidence-row">
                    {evidenceText(insight.evidenceObservationIds).map((text) => (
                      <span className="evidence-chip" key={text}>
                        {text}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </motion.section>

          <motion.section className="care-panel" variants={fadeUp}>
            <h2>Loose ends I am tracking</h2>
            <div className="loop-list">
              {brief.unresolvedLoops.map((loop) => (
                <article className="loop-card" key={loop.id}>
                  <h3>{loop.description}</h3>
                  <p>{loop.suggestedNextStep}</p>
                  <div className="care-action-buttons compact">
                    <button
                      className="care-card-button"
                      type="button"
                      onClick={() => setHandled((current) => ({ ...current, [`${loop.id}-nudge`]: 'Owner nudged' }))}
                    >
                      {handled[`${loop.id}-nudge`] ?? 'Nudge owner'}
                    </button>
                    <button
                      className="care-card-button secondary"
                      type="button"
                      onClick={() => setHandled((current) => ({ ...current, [`${loop.id}-track`]: 'Still tracking' }))}
                    >
                      {handled[`${loop.id}-track`] ?? 'Track quietly'}
                    </button>
                  </div>
                  <div className="evidence-row">
                    {evidenceText(loop.evidenceObservationIds).map((text) => (
                      <span className="evidence-chip" key={text}>
                        {text}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </motion.section>
        </div>

        <aside className="brief-side-column">
          <motion.section className="care-panel" variants={fadeUp}>
            <h2>Linda preferences I remembered</h2>
            <ul className="works-list">
              {brief.whatUsuallyWorks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button className="care-card-button secondary full" type="button">
              Use these in drafts
            </button>
          </motion.section>

          <motion.section className="care-panel assurance-panel" variants={fadeUp}>
            <h2>What you do now</h2>
            <p>
              Review the pharmacy call before anyone acts. Everything else is drafted and ready for the family
              to pick up.
            </p>
            <button
              className="care-card-button full"
              type="button"
              onClick={() => setHandled((current) => ({ ...current, next: 'Sensitive item opened' }))}
            >
              {handled.next ?? 'Review only sensitive item'}
            </button>
          </motion.section>
        </aside>
      </div>
    </motion.section>
  );
}
