/** Recency ordering for timeline events (lower = more recent). Used at seed time in GBrain. */
export const RECENCY_RANK: Record<string, number> = {
  'notes/maya-friday-tone.txt': 1,
  'notes/maya-lunch-friday.txt': 2,
  'messages/linda-group-fri-appointment.txt': 3,
  'messages/arjun-reminder-ready.txt': 4,
  'messages/sarah-med-question.txt': 5,
  'tasks/sibling-update-overdue.txt': 6,
  'notes/maya-dinner-note.txt': 7,
  'notes/linda-breakfast-choice.txt': 8,
  'messages/linda-no-fuss.txt': 9,
  'messages/maya-linda-thu-morning.txt': 10,
  'notes/maya-lunch-tuesday.txt': 11,
  'pharmacy/bp-med-change.txt': 12,
  'calendar/dr-chen-appointment.txt': 13,
  'tasks/sarah-pharmacy-owner.txt': 14,
  'tasks/arjun-calendar-owner.txt': 15,
  'notes/maya-water-reminder.txt': 16,
  'calendar/maya-work-standup.txt': 17,
  'calendar/maya-dinner.txt': 18,
  'messages/dr-chen-office.txt': 19,
};

export const WHEN_LABEL: Record<string, string> = {
  'notes/maya-friday-tone.txt': 'Friday',
  'notes/maya-lunch-friday.txt': 'Friday',
  'messages/linda-group-fri-appointment.txt': 'Friday',
  'messages/arjun-reminder-ready.txt': 'This week',
  'messages/sarah-med-question.txt': 'This week',
  'tasks/sibling-update-overdue.txt': 'Now',
  'notes/maya-dinner-note.txt': 'Recent evening',
  'notes/linda-breakfast-choice.txt': 'Recent morning',
  'messages/linda-no-fuss.txt': 'This week',
  'messages/maya-linda-thu-morning.txt': 'Thursday morning',
  'notes/maya-lunch-tuesday.txt': 'Tuesday',
  'pharmacy/bp-med-change.txt': 'Past 5 days',
  'calendar/dr-chen-appointment.txt': 'Upcoming',
  'tasks/sarah-pharmacy-owner.txt': 'Open',
  'tasks/arjun-calendar-owner.txt': 'Standing',
  'notes/maya-water-reminder.txt': 'Pattern',
  'calendar/maya-work-standup.txt': 'Tomorrow',
  'calendar/maya-dinner.txt': 'Tomorrow',
  'messages/dr-chen-office.txt': 'Provider note',
};

export interface CareRecentEvent {
  path: string;
  title: string;
  source: string;
  text: string;
  whenLabel: string;
  person: string;
}

export interface CareRecentEventsSummary {
  summary: string;
  events: CareRecentEvent[];
  documentCount: number;
  eventSourceCount: number;
  generatedAt: string;
  gbrainSlug: string;
}
