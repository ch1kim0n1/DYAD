import type { CareAction, CareBrief, CareCircleGraph, CareInsight, CareLoop, CareMessageDrafts } from '@dyad/shared';

export const CARE_BRIEF_SUMMARY =
  'Three things changed this week: Linda skipped lunch twice, asked about the same appointment four times, and mentioned dizziness twice after a blood pressure medication change. This may be worth checking with her doctor or pharmacist. Sarah can handle the pharmacy call, Arjun can confirm the appointment, and Maya should ask Linda three gentle questions today.';

export const CARE_MESSAGE_DRAFTS: CareMessageDrafts = {
  toParent:
    'Morning Mom, I wanted to check in. Have you felt dizzy at all after taking the new medication? No rush, I just want to help you stay comfortable and independent.',
  toSiblings:
    'Quick update: Mom skipped lunch twice, repeated the appointment question a few times, and mentioned dizziness after the med change. Sarah, can you call the pharmacy? Arjun, can you confirm the appointment? I’ll check in with Mom this morning.',
  toDoctorOrPharmacist:
    'Linda started a new blood pressure medication five days ago. Since then, family notes mention dizziness twice, two skipped lunches, and repeated questions about an upcoming appointment. We are not assuming causation, but would like guidance on whether medication timing, dosage, or side effects should be reviewed.',
};

export function analyzeCareWeek(graph: CareCircleGraph): CareBrief {
  return {
    id: 'brief-week-2026-05-16',
    generatedAt: '2026-05-16T16:00:00.000Z',
    headline: 'Human review suggested for this week',
    summary: CARE_BRIEF_SUMMARY,
    whatChanged: getWhatChanged(graph),
    unresolvedLoops: getUnresolvedLoops(graph),
    taskSplit: getTaskSplit(graph),
    whatUsuallyWorks: getWhatUsuallyWorks(graph),
    messageDrafts: generateMessageDrafts(graph),
  };
}

export function getWhatChanged(_graph: CareCircleGraph): CareInsight[] {
  return [
    {
      id: 'insight-skipped-lunch',
      claim: 'Linda skipped lunch twice this week.',
      confidence: 0.92,
      evidenceObservationIds: ['obs-skipped-lunch-1', 'obs-skipped-lunch-2'],
      recommendedAction: 'Ask about appetite and routine gently, with human review if the pattern continues.',
      safetyLevel: 'human_review',
    },
    {
      id: 'insight-repeated-appointment',
      claim: 'Linda asked about the same appointment four times.',
      confidence: 0.88,
      evidenceObservationIds: [
        'obs-appointment-repeat-1',
        'obs-appointment-repeat-2',
        'obs-appointment-repeat-3',
        'obs-appointment-repeat-4',
        'obs-arjun-calendar-1',
      ],
      recommendedAction: 'Arjun can confirm the appointment and make the reminder concrete.',
      safetyLevel: 'human_review',
    },
    {
      id: 'insight-dizziness-med-change',
      claim: 'Family notes mention dizziness twice after a blood pressure medication change.',
      confidence: 0.9,
      evidenceObservationIds: ['obs-dizziness-1', 'obs-dizziness-2', 'obs-med-change-1'],
      recommendedAction: 'This may be worth checking with Linda’s doctor or pharmacist.',
      safetyLevel: 'medical_review',
    },
  ];
}

export function getUnresolvedLoops(graph: CareCircleGraph): CareLoop[] {
  return graph.loops.filter((loop) => loop.status === 'open');
}

export function getTaskSplit(_graph: CareCircleGraph): CareAction[] {
  return [
    {
      id: 'action-sarah-pharmacy',
      ownerPersonId: 'sarah',
      title: 'Call the pharmacy',
      description: 'Ask whether medication timing, dosage, or side effects should be reviewed.',
      status: 'suggested',
      linkedInsightIds: ['insight-dizziness-med-change'],
    },
    {
      id: 'action-arjun-appointment',
      ownerPersonId: 'arjun',
      title: 'Confirm the appointment',
      description: 'Send the appointment date and reminder plan to the family thread.',
      status: 'suggested',
      linkedInsightIds: ['insight-repeated-appointment'],
    },
    {
      id: 'action-maya-checkin',
      ownerPersonId: 'maya',
      title: 'Ask Linda three gentle questions',
      description: 'Call Linda in the morning and offer concrete choices while preserving independence.',
      status: 'suggested',
      linkedInsightIds: ['insight-skipped-lunch', 'insight-dizziness-med-change'],
    },
  ];
}

export function getWhatUsuallyWorks(_graph: CareCircleGraph): string[] {
  return [
    'Morning calls work better than late-day check-ins.',
    'Linda responds better to concrete choices than broad offers of help.',
    'Frame support around comfort and independence, not control.',
  ];
}

export function generateMessageDrafts(_graph: CareCircleGraph): CareMessageDrafts {
  return { ...CARE_MESSAGE_DRAFTS };
}
