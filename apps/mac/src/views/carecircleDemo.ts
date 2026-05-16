export type CareTab = 'dashboard' | 'timeline' | 'brief' | 'messages' | 'trust';

export interface CarePerson {
  id: string;
  name: string;
  role: string;
  relationshipLabel: string;
  responsibilities?: string[];
  notes?: string[];
}

export interface CareObservation {
  id: string;
  personId: string;
  text: string;
  timestamp: string;
  source: 'family_note' | 'message' | 'appointment' | 'medication' | 'task';
  tags: string[];
  sensitivity: 'low' | 'medium' | 'high';
}

export interface CareEvent {
  id: string;
  title: string;
  timestamp: string;
  category: 'medication' | 'meal' | 'appointment' | 'family_call' | 'symptom' | 'task';
  relatedPersonIds: string[];
  linkedObservationIds: string[];
}

export interface CareLoop {
  id: string;
  description: string;
  status: 'open' | 'resolved';
  relatedPersonIds: string[];
  evidenceObservationIds: string[];
  suggestedNextStep: string;
  openedAt: string;
}

export interface CareInsight {
  id: string;
  claim: string;
  confidence: number;
  evidenceObservationIds: string[];
  recommendedAction: string;
  safetyLevel: 'normal' | 'human_review' | 'medical_review';
}

export interface CareAction {
  id: string;
  ownerPersonId: string;
  title: string;
  description: string;
  status: 'suggested' | 'accepted' | 'done';
  linkedInsightIds: string[];
}

export interface CareMessageDrafts {
  toParent: string;
  toSiblings: string;
  toDoctorOrPharmacist: string;
}

export interface CareBrief {
  id: string;
  generatedAt: string;
  headline: string;
  summary: string;
  whatChanged: CareInsight[];
  unresolvedLoops: CareLoop[];
  taskSplit: CareAction[];
  whatUsuallyWorks: string[];
  messageDrafts: CareMessageDrafts;
}

export interface CareCircleGraph {
  id: string;
  name: string;
  people: CarePerson[];
  observations: CareObservation[];
  events: CareEvent[];
  loops: CareLoop[];
}

export const careCircleFixture: CareCircleGraph = {
  id: 'carecircle-demo',
  name: 'Linda family circle',
  people: [
    {
      id: 'linda',
      name: 'Linda',
      role: 'parent',
      relationshipLabel: 'Aging mother',
      responsibilities: ['Stay independent', 'Share symptoms when comfortable'],
      notes: ['Responds better to morning calls', 'Gets defensive when help sounds like control'],
    },
    {
      id: 'maya',
      name: 'Maya',
      role: 'daughter',
      relationshipLabel: 'Primary coordinator',
      responsibilities: ['Gentle check-ins', 'Sibling coordination'],
    },
    {
      id: 'sarah',
      name: 'Sarah',
      role: 'sibling',
      relationshipLabel: 'Pharmacy owner',
      responsibilities: ['Call pharmacy', 'Track medication questions'],
    },
    {
      id: 'arjun',
      name: 'Arjun',
      role: 'sibling',
      relationshipLabel: 'Appointments owner',
      responsibilities: ['Confirm appointments', 'Maintain calendar'],
    },
    {
      id: 'dr-chen',
      name: 'Dr. Chen',
      role: 'doctor',
      relationshipLabel: 'Primary doctor',
      responsibilities: ['Review medical questions'],
    },
  ],
  observations: [
    {
      id: 'obs-med-change',
      personId: 'linda',
      text: 'Blood pressure medication changed five days ago.',
      timestamp: '2026-05-11T09:00:00-07:00',
      source: 'medication',
      tags: ['medication', 'blood-pressure'],
      sensitivity: 'high',
    },
    {
      id: 'obs-lunch-1',
      personId: 'linda',
      text: 'Linda skipped lunch on Tuesday.',
      timestamp: '2026-05-12T13:15:00-07:00',
      source: 'family_note',
      tags: ['meal', 'routine-change'],
      sensitivity: 'medium',
    },
    {
      id: 'obs-appointment-repeat',
      personId: 'linda',
      text: 'Linda asked about the same appointment four times.',
      timestamp: '2026-05-13T18:30:00-07:00',
      source: 'message',
      tags: ['appointment', 'repetition'],
      sensitivity: 'medium',
    },
    {
      id: 'obs-dizziness',
      personId: 'linda',
      text: 'Family notes mention dizziness twice after the medication change.',
      timestamp: '2026-05-14T10:20:00-07:00',
      source: 'family_note',
      tags: ['dizziness', 'medication-review'],
      sensitivity: 'high',
    },
    {
      id: 'obs-lunch-2',
      personId: 'linda',
      text: 'Linda skipped lunch again on Friday.',
      timestamp: '2026-05-15T13:05:00-07:00',
      source: 'family_note',
      tags: ['meal', 'routine-change'],
      sensitivity: 'medium',
    },
    {
      id: 'obs-sarah-pharmacy',
      personId: 'sarah',
      text: 'Sarah said she can call the pharmacy.',
      timestamp: '2026-05-15T15:30:00-07:00',
      source: 'task',
      tags: ['pharmacy', 'task-owner'],
      sensitivity: 'low',
    },
    {
      id: 'obs-arjun-calendar',
      personId: 'arjun',
      text: 'Arjun handles calendar tasks.',
      timestamp: '2026-05-15T16:00:00-07:00',
      source: 'task',
      tags: ['appointment', 'task-owner'],
      sensitivity: 'low',
    },
    {
      id: 'obs-linda-communication',
      personId: 'linda',
      text: 'Linda responds better to morning calls and concrete choices.',
      timestamp: '2026-05-15T17:00:00-07:00',
      source: 'family_note',
      tags: ['communication', 'trust'],
      sensitivity: 'low',
    },
  ],
  events: [
    {
      id: 'event-med-change',
      title: 'Blood pressure medication changed',
      timestamp: '2026-05-11T09:00:00-07:00',
      category: 'medication',
      relatedPersonIds: ['linda', 'dr-chen'],
      linkedObservationIds: ['obs-med-change'],
    },
    {
      id: 'event-lunch',
      title: 'Skipped lunch twice',
      timestamp: '2026-05-15T13:05:00-07:00',
      category: 'meal',
      relatedPersonIds: ['linda'],
      linkedObservationIds: ['obs-lunch-1', 'obs-lunch-2'],
    },
    {
      id: 'event-appointment',
      title: 'Repeated appointment question',
      timestamp: '2026-05-13T18:30:00-07:00',
      category: 'appointment',
      relatedPersonIds: ['linda', 'arjun'],
      linkedObservationIds: ['obs-appointment-repeat'],
    },
    {
      id: 'event-dizziness',
      title: 'Dizziness mentioned twice',
      timestamp: '2026-05-14T10:20:00-07:00',
      category: 'symptom',
      relatedPersonIds: ['linda'],
      linkedObservationIds: ['obs-dizziness', 'obs-med-change'],
    },
    {
      id: 'event-pharmacy-open',
      title: 'Pharmacy call still open',
      timestamp: '2026-05-15T15:30:00-07:00',
      category: 'task',
      relatedPersonIds: ['sarah', 'linda'],
      linkedObservationIds: ['obs-sarah-pharmacy', 'obs-dizziness'],
    },
  ],
  loops: [
    {
      id: 'loop-pharmacy',
      description: 'Pharmacy call not completed',
      status: 'open',
      relatedPersonIds: ['sarah', 'linda'],
      evidenceObservationIds: ['obs-sarah-pharmacy', 'obs-dizziness', 'obs-med-change'],
      suggestedNextStep: 'Sarah calls the pharmacy and asks whether medication timing, dosage, or side effects should be reviewed.',
      openedAt: '2026-05-15T15:30:00-07:00',
    },
    {
      id: 'loop-doctor-questions',
      description: 'Doctor visit questions not prepared',
      status: 'open',
      relatedPersonIds: ['maya', 'linda', 'dr-chen'],
      evidenceObservationIds: ['obs-dizziness', 'obs-lunch-1', 'obs-lunch-2'],
      suggestedNextStep: 'Maya gathers three gentle questions before the doctor or pharmacist conversation.',
      openedAt: '2026-05-15T16:20:00-07:00',
    },
    {
      id: 'loop-sibling-update',
      description: 'Sibling update overdue',
      status: 'open',
      relatedPersonIds: ['maya', 'sarah', 'arjun'],
      evidenceObservationIds: ['obs-appointment-repeat', 'obs-sarah-pharmacy', 'obs-arjun-calendar'],
      suggestedNextStep: 'Send one shared update with task owners and no medical assumptions.',
      openedAt: '2026-05-15T17:00:00-07:00',
    },
  ],
};

export function analyzeCareWeek(): CareBrief {
  return {
    id: 'brief-week-2026-05-16',
    generatedAt: '2026-05-16T09:00:00-07:00',
    headline: 'This week may be worth a human review',
    summary:
      'Three things changed this week: Linda skipped lunch twice, asked about the same appointment four times, and mentioned dizziness twice after a blood pressure medication change. This may be worth checking with her doctor or pharmacist. Sarah can handle the pharmacy call, Arjun can confirm the appointment, and Maya should ask Linda three gentle questions today.',
    whatChanged: [
      {
        id: 'insight-meals',
        claim: 'Linda skipped lunch twice this week.',
        confidence: 0.92,
        evidenceObservationIds: ['obs-lunch-1', 'obs-lunch-2'],
        recommendedAction: 'Ask about appetite and routine gently, without turning it into a compliance check.',
        safetyLevel: 'human_review',
      },
      {
        id: 'insight-appointment',
        claim: 'Linda asked about the same appointment four times.',
        confidence: 0.88,
        evidenceObservationIds: ['obs-appointment-repeat', 'obs-arjun-calendar'],
        recommendedAction: 'Arjun can confirm the date and make the next reminder concrete.',
        safetyLevel: 'human_review',
      },
      {
        id: 'insight-dizziness',
        claim: 'Family notes mention dizziness twice after a blood pressure medication change.',
        confidence: 0.9,
        evidenceObservationIds: ['obs-dizziness', 'obs-med-change'],
        recommendedAction: "This may be worth checking with Linda's doctor or pharmacist.",
        safetyLevel: 'medical_review',
      },
    ],
    unresolvedLoops: careCircleFixture.loops,
    taskSplit: [
      {
        id: 'action-sarah-pharmacy',
        ownerPersonId: 'sarah',
        title: 'Call pharmacy',
        description: 'Ask whether medication timing, dosage, or side effects should be reviewed.',
        status: 'suggested',
        linkedInsightIds: ['insight-dizziness'],
      },
      {
        id: 'action-arjun-appointment',
        ownerPersonId: 'arjun',
        title: 'Confirm appointment',
        description: 'Send the appointment date and reminder plan to the family thread.',
        status: 'suggested',
        linkedInsightIds: ['insight-appointment'],
      },
      {
        id: 'action-maya-checkin',
        ownerPersonId: 'maya',
        title: 'Ask three gentle questions',
        description: 'Call Linda in the morning and offer concrete choices while preserving independence.',
        status: 'suggested',
        linkedInsightIds: ['insight-meals', 'insight-dizziness'],
      },
    ],
    whatUsuallyWorks: [
      'Morning calls work better than late-day check-ins.',
      'Linda responds better to concrete choices than broad offers of help.',
      'Frame support around comfort and independence, not control.',
    ],
    messageDrafts: {
      toParent:
        'Morning Mom, I wanted to check in. Have you felt dizzy at all after taking the new medication? No rush, I just want to help you stay comfortable and independent.',
      toSiblings:
        "Quick update: Mom skipped lunch twice, repeated the appointment question a few times, and mentioned dizziness after the med change. Sarah, can you call the pharmacy? Arjun, can you confirm the appointment? I'll check in with Mom this morning.",
      toDoctorOrPharmacist:
        'Linda started a new blood pressure medication five days ago. Since then, family notes mention dizziness twice, two skipped lunches, and repeated questions about an upcoming appointment. We are not assuming causation, but would like guidance on whether medication timing, dosage, or side effects should be reviewed.',
    },
  };
}

export function personName(id: string): string {
  return careCircleFixture.people.find((person) => person.id === id)?.name ?? id;
}

export function evidenceText(ids: string[]): string[] {
  return ids
    .map((id) => careCircleFixture.observations.find((observation) => observation.id === id)?.text)
    .filter((text): text is string => Boolean(text));
}
