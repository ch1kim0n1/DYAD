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
  return (
    <section className="care-trust-view">
      <div className="trust-hero">
        <p className="care-kicker">Trust Center</p>
        <h1>Private by default, reviewable by design</h1>
        <p>
          CareCircle helps families coordinate care without making medical claims, surveilling, or standing in for
          family members, doctors, pharmacists, or caregivers.
        </p>
      </div>

      <div className="trust-grid">
        {trustControls.map((control) => (
          <article className="trust-card" key={control.title}>
            <h2>{control.title}</h2>
            <p>{control.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
