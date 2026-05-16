export interface CareCalendarReminder {
  title: string;
  description: string;
  start: Date;
  durationMinutes: number;
}

export interface CareCalendarBlock {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface CareReminderSlot {
  id: string;
  start: Date;
  label: string;
  conflictCount: number;
}

export function downloadCareReminder(reminder: CareCalendarReminder): void {
  const end = new Date(reminder.start.getTime() + reminder.durationMinutes * 60 * 1000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CareCircle//Care Plan Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:carecircle-${reminder.start.getTime()}@carecircle.demo`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(reminder.start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(reminder.title)}`,
    `DESCRIPTION:${escapeIcsText(reminder.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = 'carecircle-check-in-reminder.ics';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 500);
}

export function openSmsDraft(body: string): void {
  window.location.href = `sms:&body=${encodeURIComponent(body)}`;
}

export function openEmailDraft({
  to = '',
  subject,
  body,
}: {
  to?: string;
  subject: string;
  body: string;
}): void {
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function nextMorning(hour = 9): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function suggestReminderSlots(blocks: CareCalendarBlock[], durationMinutes = 20): CareReminderSlot[] {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  const candidates = [
    createCandidate(day, 8, 30),
    createCandidate(day, 9, 30),
    createCandidate(day, 10, 15),
    createCandidate(day, 18, 0),
    createCandidate(day, 19, 15),
  ];

  return candidates.map((start) => {
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const conflictCount = blocks.filter((block) => rangesOverlap(start, end, new Date(block.start), new Date(block.end))).length;
    return {
      id: start.toISOString(),
      start,
      label: new Intl.DateTimeFormat('en', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(start),
      conflictCount,
    };
  });
}

export function bestReminderSlot(blocks: CareCalendarBlock[], selectedStart?: string): Date {
  if (selectedStart) return new Date(selectedStart);
  return suggestReminderSlots(blocks).find((slot) => slot.conflictCount === 0)?.start ?? nextMorning(9);
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function createCandidate(day: Date, hour: number, minute: number): Date {
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
