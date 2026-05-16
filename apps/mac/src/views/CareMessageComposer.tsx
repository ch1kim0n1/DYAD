import type { CareBrief } from './carecircleDemo.js';

interface CareMessageComposerProps {
  brief: CareBrief | null;
  onAnalyze: () => void;
}

const fallbackDrafts = {
  toParent:
    'Morning Mom, I wanted to check in. Have you felt dizzy at all after taking the new medication? No rush, I just want to help you stay comfortable and independent.',
  toSiblings:
    "Quick update: Mom skipped lunch twice, repeated the appointment question a few times, and mentioned dizziness after the med change. Sarah, can you call the pharmacy? Arjun, can you confirm the appointment? I'll check in with Mom this morning.",
  toDoctorOrPharmacist:
    'Linda started a new blood pressure medication five days ago. Since then, family notes mention dizziness twice, two skipped lunches, and repeated questions about an upcoming appointment. We are not assuming causation, but would like guidance on whether medication timing, dosage, or side effects should be reviewed.',
};

export function CareMessageComposer({ brief, onAnalyze }: CareMessageComposerProps) {
  const drafts = brief?.messageDrafts ?? fallbackDrafts;

  return (
    <section className="care-messages-view">
      <div className="view-heading messages-heading">
        <div>
          <p className="care-kicker">Drafts</p>
          <h1>Messages that keep care human</h1>
        </div>
        {!brief && (
          <button className="care-secondary-button" type="button" onClick={onAnalyze}>
            Analyze this week
          </button>
        )}
      </div>

      <div className="message-grid">
        <MessageCard title="Gentle message to Mom" text={drafts.toParent} />
        <MessageCard title="Sibling update" text={drafts.toSiblings} />
        <MessageCard title="Doctor/pharmacist summary" text={drafts.toDoctorOrPharmacist} />
      </div>
    </section>
  );
}

function MessageCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="message-card">
      <div className="message-card-header">
        <h2>{title}</h2>
        <span>draft</span>
      </div>
      <p>{text}</p>
    </article>
  );
}
