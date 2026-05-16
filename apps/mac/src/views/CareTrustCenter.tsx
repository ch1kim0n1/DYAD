import { motion, type Variants } from 'framer-motion';

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

export function CareTrustCenter() {
  const stagger: Variants = {
    animate: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
  };
  const fadeUp: Variants = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
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
          <button className="care-card-button" type="button">
            Review sharing
          </button>
          <button className="care-card-button secondary" type="button">
            Export demo brief
          </button>
        </div>
      </motion.div>

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
      <footer className="trust-footer">
        <a href="docs/DATA-PRIVACY.md" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
        {' · '}
        <a href="docs/RESEARCH-CITATIONS.md" target="_blank" rel="noreferrer">
          Research citations
        </a>
      </footer>
    </motion.section>
  );
}
