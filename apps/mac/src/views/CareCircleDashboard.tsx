import { motion, type Variants } from 'framer-motion';
import type { CareBrief, CareCircleGraph } from './carecircleDemo.js';
import { personName } from './carecircleDemo.js';

interface CareCircleDashboardProps {
  graph: CareCircleGraph;
  brief: CareBrief | null;
  onAnalyze: () => void;
}

const personPulse: Record<string, string> = {
  linda: '3 changes surfaced this week',
  maya: 'morning check-in drafted',
  sarah: 'pharmacy call pending',
  arjun: 'appointment reminder ready',
  'dr-chen': 'review path prepared',
};

export function CareCircleDashboard({ graph, brief, onAnalyze }: CareCircleDashboardProps) {
  const dashboardPeople = graph.people.filter((person) => person.id !== 'pharmacy');
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
          <h1>{brief ? "You're caught up. The next moves are staged." : 'Come home, check once, and feel caught up.'}</h1>
          <p>
            {brief
              ? 'Nothing has been sent. The medical item is waiting for approval, the appointment reminder is ready, and the family update is drafted.'
              : 'Mom seemed off this week. I can pull the important changes together, prepare the follow-through, and pause anything sensitive for human review.'}
          </p>
        </div>
        <button className="care-primary-button" type="button" onClick={onAnalyze}>
          {brief ? 'Refresh' : 'Catch me up'}
        </button>
      </motion.div>

      {brief && (
        <motion.section className="assistant-status dashboard-status" aria-label="CareCircle status" variants={fadeUp}>
          <div>
            <span className="status-dot ready" />
            <p>Drafted sibling update</p>
          </div>
          <div>
            <span className="status-dot ready" />
            <p>Prepared appointment confirmation</p>
          </div>
          <div>
            <span className="status-dot waiting" />
            <p>Paused pharmacy call for human review</p>
          </div>
        </motion.section>
      )}

      <motion.div className="family-grid" aria-label="Family circle" variants={stagger}>
        {dashboardPeople.map((person) => (
          <motion.article className="family-card" key={person.id} variants={fadeUp}>
            <div className="family-card-top">
              <div className="avatar-mark" aria-hidden="true">
                {person.name.slice(0, 1)}
              </div>
              <div>
                <h2>{person.name}</h2>
                <p>{person.relationshipLabel}</p>
              </div>
            </div>
            <div className="family-card-bottom">
              <span className="responsibility-line">
                {person.responsibilities?.slice(0, 1).join('') ?? personName(person.id)}
              </span>
              <span className={`pulse-line ${person.id === 'linda' || person.id === 'sarah' ? 'attention' : ''}`}>
                {personPulse[person.id] ?? 'care context ready'}
              </span>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>
  );
}
