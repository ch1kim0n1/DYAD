import { describe, expect, test } from 'bun:test';
import type { NormalizedEmail } from '@dyad/shared';
import { CareEventExtractor, partitionCareEvents } from '../src/care-event-extractor.js';

function email(overrides: Partial<NormalizedEmail> & { subject: string; body_text: string }): NormalizedEmail {
  return {
    message_id: `msg-${overrides.subject}`,
    gmail_id: `gmail-${overrides.subject}`,
    from_id: 'from123',
    subject: overrides.subject,
    snippet: overrides.body_text.slice(0, 80),
    body_text: overrides.body_text,
    timestamp: overrides.timestamp ?? '2025-03-01T12:00:00.000Z',
    has_ics_attachment: overrides.has_ics_attachment ?? false,
    ...overrides,
  };
}

describe('CareEventExtractor', () => {
  test('detects pharmacy / medication emails', () => {
    const extractor = new CareEventExtractor();
    const result = extractor.extract([
      email({
        subject: 'Your CVS prescription is ready',
        body_text: 'Refill order confirmed for pickup.',
      }),
    ]);
    expect(result.events.some((e) => e.category === 'medication')).toBe(true);
    expect(result.observations[0]?.source).toBe('medication');
  });

  test('detects appointment reminders', () => {
    const extractor = new CareEventExtractor();
    const result = extractor.extract([
      email({
        subject: 'Appointment reminder — Dr. Chen',
        body_text: 'Your telehealth visit is scheduled for tomorrow at 2pm.',
        has_ics_attachment: true,
      }),
    ]);
    expect(result.events.some((e) => e.category === 'appointment')).toBe(true);
  });

  test('detects family communication', () => {
    process.env.DYAD_FAMILY_SENDERS = 'mom@family.com';
    const extractor = new CareEventExtractor();
    const result = extractor.extract([
      email({
        subject: 'Checking in',
        body_text: 'Hi — Mom wanted to see how you are doing this week.',
        from_id: 'momhash',
      }),
    ]);
    expect(result.events.some((e) => e.category === 'family_call')).toBe(true);
    delete process.env.DYAD_FAMILY_SENDERS;
  });

  test('partitionCareEvents splits upcoming and past', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const { upcoming, past: pastEvents } = partitionCareEvents([
      {
        id: '1',
        title: 'Future appt',
        timestamp: future,
        category: 'appointment',
        relatedPersonIds: [],
        linkedObservationIds: [],
      },
      {
        id: '2',
        title: 'Past med',
        timestamp: past,
        category: 'medication',
        relatedPersonIds: [],
        linkedObservationIds: [],
      },
    ]);
    expect(upcoming).toHaveLength(1);
    expect(pastEvents).toHaveLength(1);
  });
});
