import { describe, expect, test } from 'bun:test';
import { parseIcsCalendar } from '../src/calendar-ics-reader.js';

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1@carecircle
DTSTART:20260516T140000Z
DTEND:20260516T150000Z
SUMMARY:Dr. Chen appointment
LOCATION:Clinic
END:VEVENT
BEGIN:VEVENT
UID:evt-2@carecircle
DTSTART:20260517
SUMMARY:All-day reminder
END:VEVENT
END:VCALENDAR`;

describe('parseIcsCalendar', () => {
  test('parses timed and all-day events', () => {
    const events = parseIcsCalendar(SAMPLE_ICS);
    expect(events).toHaveLength(2);
    expect(events[0]?.summary).toBe('Dr. Chen appointment');
    expect(events[0]?.location).toBe('Clinic');
    expect(events[1]?.summary).toBe('All-day reminder');
  });
});
