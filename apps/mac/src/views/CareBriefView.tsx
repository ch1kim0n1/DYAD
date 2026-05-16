import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareAction, CareBrief } from './carecircleDemo.js';
import { careCircleFixture, evidenceText, getWhatChanged, personName } from './carecircleDemo.js';

interface CareBriefViewProps {
  brief: CareBrief;
  isSynthesizing: boolean;
}

export function CareBriefView({ brief, isSynthesizing }: CareBriefViewProps) {
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

  if (isSynthesizing) {
    return <CareSynthesisView />;
  }

  const planCards = getPlanCards(brief.taskSplit);

  return (
    <motion.section className="care-brief-view" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="brief-hero" variants={fadeUp}>
        <p className="care-kicker">CareCircle brief</p>
        <h1>{brief.headline}</h1>
        <p className="brief-lead">I found three changes and staged the next moves for the family.</p>
        <div className="brief-care-checklist" aria-label="Care plan summary">
          <div className="brief-check-item">
            <span className="brief-check-box done" aria-hidden="true" />
            <div>
              <strong>Family update drafted</strong>
              <p>Sarah, Arjun, and Maya each have a clear next step.</p>
            </div>
          </div>
          <div className="brief-check-item">
            <span className="brief-check-box done" aria-hidden="true" />
            <div>
              <strong>Appointment reminder prepared</strong>
              <p>Arjun can confirm the date without re-reading the week.</p>
            </div>
          </div>
          <div className="brief-check-item needs-review">
            <span className="brief-check-box review" aria-hidden="true">
              !
            </span>
            <div>
              <strong>Pharmacy call needs approval</strong>
              <p>Medication-related notes stay paused for human review.</p>
            </div>
          </div>
        </div>
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
        {planCards.map((card) => (
          <motion.article className={`plan-step ${card.tone}`} variants={fadeUp} key={card.key}>
            <span>{card.status}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <button
              className={`care-card-button ${card.tone === 'waiting' ? 'warn' : ''}`}
              type="button"
              onClick={() => setHandled((current) => ({ ...current, [card.key]: card.doneLabel }))}
            >
              {handled[card.key] ?? card.buttonLabel}
            </button>
          </motion.article>
        ))}
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
            <div className="preference-source-list">
              {brief.whatUsuallyWorks.map((item, index) => {
                const sources = [
                  'from family note: morning calls',
                  'observed pattern: concrete choices',
                  'trust note: independence framing',
                ];
                return (
                  <article className="preference-source" key={item}>
                    <p>{item}</p>
                    <span>{sources[index] ?? 'source visible'}</span>
                  </article>
                );
              })}
            </div>
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

function getPlanCards(actions: CareAction[]) {
  const pharmacy = actions.find((action) => action.id.includes('pharmacy'));
  const appointment = actions.find((action) => action.id.includes('appointment'));
  const familyRoles = actions
    .map((action) => `${personName(action.ownerPersonId)}: ${action.title.toLowerCase()}`)
    .join('. ');

  return [
    {
      key: 'sibling',
      status: 'Ready',
      title: 'Sibling update',
      description: familyRoles
        ? `I separated the next moves from the care plan: ${familyRoles}.`
        : 'I separated the next moves so the family thread can move without re-reading the week.',
      buttonLabel: 'Queue family update',
      doneLabel: 'Queued for family',
      tone: 'done',
    },
    {
      key: appointment?.id ?? 'appointment',
      status: 'Ready',
      title: 'Appointment confirmation',
      description:
        appointment?.description ?? 'I prepared the reminder so Arjun can confirm without re-reading the week.',
      buttonLabel: 'Schedule reminder',
      doneLabel: 'Reminder scheduled',
      tone: 'done',
    },
    {
      key: pharmacy?.id ?? 'pharmacy',
      status: 'Needs approval',
      title: 'Pharmacy call brief',
      description:
        pharmacy?.description ??
        'I summarized the medication-related notes, but this should stay human-reviewed.',
      buttonLabel: 'Review and approve',
      doneLabel: 'Ready for Sarah',
      tone: 'waiting',
    },
  ] as const;
}

function CareSynthesisView() {
  const noteItems = careCircleFixture.observations.map((observation) => observation.text);
  const clusters = getWhatChanged(careCircleFixture).map((insight) => ({
    title: insight.claim,
    body: insight.recommendedAction,
  }));

  return (
    <motion.section className="synthesis-view" initial="initial" animate="animate">
      <motion.div
        className="synthesis-hero"
        variants={{
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.45 } },
        }}
      >
        <p className="care-kicker">Catching you up</p>
        <h1>Reading the week, grouping the loose ends, staging the next moves.</h1>
        <div className="synthesis-progress" aria-hidden="true">
          <motion.span
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 5.0, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      <div className="synthesis-stage">
        <div className="note-stream">
          {noteItems.map((item, index) => (
            <motion.div
              className="stream-note"
              key={item}
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: [0, 1, 1, 0.55], y: [28, 0, -10, -24], scale: [0.98, 1, 1, 0.96] }}
              transition={{ duration: 2.65, delay: index * 0.15, ease: 'easeOut' }}
            >
              {item}
            </motion.div>
          ))}
        </div>

        <div className="cluster-column">
          {clusters.map((cluster, index) => (
            <motion.article
              className="cluster-card"
              key={cluster.title}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.05 + index * 0.34, ease: 'easeOut' }}
            >
              <span>Cluster {index + 1}</span>
              <h2>{cluster.title}</h2>
              <p>{cluster.body}</p>
            </motion.article>
          ))}
        </div>
      </div>

      <motion.div
        className="synthesis-resolution"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 2.85, ease: 'easeOut' }}
      >
        <span className="status-dot ready" />
        <p>I found three changes. The next moves are staged.</p>
      </motion.div>
    </motion.section>
  );
}
