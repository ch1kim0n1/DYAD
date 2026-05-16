import { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CareBrief, CareCircleGraph } from './carecircleDemo.js';
import { personName } from './carecircleDemo.js';

interface CareCircleDashboardProps {
  graph: CareCircleGraph;
  brief: CareBrief | null;
  onAnalyze: () => void;
}

export function CareCircleDashboard({ graph, brief, onAnalyze }: CareCircleDashboardProps) {
  const [handledActions, setHandledActions] = useState<Record<string, string>>({});
  const actionCards = brief
    ? [
        {
          owner: 'I staged',
          title: 'Pharmacy call',
          body: 'Sarah has the call brief ready. I am holding it for approval because it touches medication.',
          meta: 'Needs approval',
          primary: 'Review and approve',
          done: 'Approved for Sarah',
          secondary: 'View notes',
        },
        {
          owner: 'I prepared',
          title: 'Appointment reminder',
          body: 'Arjun can confirm the date from one clean note instead of searching the thread.',
          meta: 'Ready',
          primary: 'Schedule reminder',
          done: 'Reminder scheduled',
          secondary: 'Open draft',
        },
        {
          owner: 'I drafted',
          title: 'Morning check-in',
          body: "Maya has a gentle message that protects Linda's independence and asks the important question.",
          meta: 'Low friction',
          primary: 'Queue for morning',
          done: 'Queued for morning',
          secondary: 'Preview message',
        },
      ]
    : [
        {
          owner: 'I can check',
          title: 'What changed',
          body: 'I will pull together the scattered family notes and show only the patterns that matter.',
          meta: 'Ready',
          primary: 'Catch me up',
          done: 'Scanning',
          secondary: 'See sources',
        },
        {
          owner: 'I can stage',
          title: 'The next moves',
          body: 'I will prepare the calls, reminders, and family update so you are not starting cold.',
          meta: 'Source visible',
          primary: 'Stage actions',
          done: 'Staged',
          secondary: 'Preview plan',
        },
        {
          owner: 'You approve',
          title: 'Sensitive steps',
          body: 'Anything medical stays paused until a human reviews it.',
          meta: 'Safe boundary',
          primary: 'Review boundary',
          done: 'Reviewed',
          secondary: 'Trust center',
        },
      ];

  const stagger: Variants = {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.08,
      },
    },
  };

  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.section className="care-dashboard" initial="initial" animate="animate" variants={stagger}>
      <motion.div className="care-hero-panel" variants={fadeUp}>
        <div>
          <p className="care-kicker">CareCircle is watching the care load</p>
          <h1>{brief ? "I found the week's care loose ends and staged the next moves." : 'Come home, check once, and feel caught up.'}</h1>
          <p>
            {brief
              ? 'Nothing has been sent. The medical item is waiting for approval, the appointment reminder is ready, and the family update is drafted.'
              : 'When you are tired, CareCircle reads the family context for you and prepares the gentle, practical follow-through.'}
          </p>
        </div>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          {brief ? 'Refresh care plan' : 'Catch me up'}
        </button>
      </motion.div>

      {brief && (
        <motion.section className="assistant-status" aria-label="CareCircle status" variants={fadeUp}>
          <div>
            <span className="status-dot ready" />
            <p>Drafted sibling update</p>
            <button className="care-mini-button" type="button">Send</button>
          </div>
          <div>
            <span className="status-dot ready" />
            <p>Prepared appointment confirmation</p>
            <button className="care-mini-button" type="button">Schedule</button>
          </div>
          <div>
            <span className="status-dot waiting" />
            <p>Paused pharmacy call for human review</p>
            <button className="care-mini-button warn" type="button">Review</button>
          </div>
        </motion.section>
      )}

      <motion.div className="care-action-grid" aria-label="Recommended next actions" variants={stagger}>
        {actionCards.map((card) => (
          <motion.article className="action-card" key={card.title} variants={fadeUp}>
            <div className="action-card-top">
              <span>{card.owner}</span>
              <small>{card.meta}</small>
            </div>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
            <div className="care-action-buttons">
              <button
                className={`care-card-button ${handledActions[card.title] ? 'is-done' : ''}`}
                type="button"
                onClick={() => {
                  if (!brief && card.title === 'What changed') {
                    onAnalyze();
                    return;
                  }
                  setHandledActions((current) => ({ ...current, [card.title]: card.done }));
                }}
              >
                {handledActions[card.title] ?? card.primary}
              </button>
              <button
                className="care-card-button secondary"
                type="button"
                onClick={() => setHandledActions((current) => ({ ...current, [`${card.title}-secondary`]: card.secondary }))}
              >
                {handledActions[`${card.title}-secondary`] ?? card.secondary}
              </button>
            </div>
          </motion.article>
        ))}
      </motion.div>

      <motion.div className="family-grid" aria-label="Family circle" variants={stagger}>
        {graph.people.map((person) => (
          <motion.article className="family-card" key={person.id} variants={fadeUp}>
            <div className="avatar-mark" aria-hidden="true">
              {person.name.slice(0, 1)}
            </div>
            <div>
              <h2>{person.name}</h2>
              <p>{person.relationshipLabel}</p>
            </div>
            <span className="responsibility-line">
              {person.responsibilities?.slice(0, 1).join('') ?? personName(person.id)}
            </span>
            <button className="care-mini-button person-button" type="button">Check status</button>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>
  );
}
