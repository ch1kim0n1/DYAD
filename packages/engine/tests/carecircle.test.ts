import { describe, expect, it } from 'bun:test';
import {
  analyzeCareWeek,
  careCircleFixture,
  generateMessageDrafts,
  getWhatChanged,
} from '../src/index.js';

const expectedSummary =
  'Three things changed this week: Linda skipped lunch twice, asked about the same appointment four times, and mentioned dizziness twice after a blood pressure medication change. This may be worth checking with her doctor or pharmacist. Sarah can handle the pharmacy call, Arjun can confirm the appointment, and Maya should ask Linda three gentle questions today.';

const expectedDrafts = {
  toParent:
    'Morning Mom, I wanted to check in. Have you felt dizzy at all after taking the new medication? No rush, I just want to help you stay comfortable and independent.',
  toSiblings:
    'Quick update: Mom skipped lunch twice, repeated the appointment question a few times, and mentioned dizziness after the med change. Sarah, can you call the pharmacy? Arjun, can you confirm the appointment? I’ll check in with Mom this morning.',
  toDoctorOrPharmacist:
    'Linda started a new blood pressure medication five days ago. Since then, family notes mention dizziness twice, two skipped lunches, and repeated questions about an upcoming appointment. We are not assuming causation, but would like guidance on whether medication timing, dosage, or side effects should be reviewed.',
};

function renderedOutput(): string {
  return JSON.stringify(analyzeCareWeek(careCircleFixture));
}

describe('CareCircle fixture and workflows', () => {
  it('returns the exact stable CareCircle brief summary', () => {
    expect(analyzeCareWeek(careCircleFixture).summary).toBe(expectedSummary);
  });

  it('returns deterministic message drafts', () => {
    expect(generateMessageDrafts(careCircleFixture)).toEqual(expectedDrafts);
    expect(analyzeCareWeek(careCircleFixture).messageDrafts).toEqual(expectedDrafts);
  });

  it('keeps every insight tied to evidence observations', () => {
    for (const insight of getWhatChanged(careCircleFixture)) {
      expect(insight.evidenceObservationIds.length).toBeGreaterThan(0);
    }
  });

  it('keeps analysis deterministic across repeated calls', () => {
    expect(analyzeCareWeek(careCircleFixture)).toEqual(analyzeCareWeek(careCircleFixture));
  });

  it('uses non-diagnostic safety language', () => {
    const output = renderedOutput();

    expect(output).not.toMatch(/dementia/i);
    expect(output).not.toMatch(/diagnos/i);
    expect(output).not.toMatch(/medication caused/i);
    expect(output).not.toMatch(/AI replaces/i);

    expect(output).toContain('may be worth checking');
    expect(output).toContain('human review');
    expect(output).toContain('doctor or pharmacist');
    expect(output).toContain('family notes mention');
  });
});
