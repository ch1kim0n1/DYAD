import { describe, it, expect } from 'bun:test';
import { MessageNormalizer } from '../src/message-normalizer.js';

describe('issue #8: MessageNormalizer Apple epoch conversion', () => {
  const normalizer = new MessageNormalizer();

  it('converts modern nanosecond Apple epoch to correct ISO date', () => {
    // 2024-01-01 00:00:00 UTC = 23 years after Apple epoch (2001-01-01).
    // ns since 2001 epoch for 2024-01-01:
    const seconds2001To2024 = (Date.UTC(2024, 0, 1) - Date.UTC(2001, 0, 1)) / 1000;
    const nanos = seconds2001To2024 * 1_000_000_000;
    const raw = {
      rowid: 1, text: 'x', handle_id: 'h', date: nanos, is_from_me: false, chat_id: 'c',
    };
    const out = normalizer.normalize(raw);
    expect(out.timestamp.startsWith('2024-01-01T00:00:00')).toBe(true);
  });

  it('handles legacy second-based Apple epoch', () => {
    const seconds2001To2010 = (Date.UTC(2010, 0, 1) - Date.UTC(2001, 0, 1)) / 1000;
    const raw = {
      rowid: 2, text: 'x', handle_id: 'h', date: seconds2001To2010, is_from_me: false, chat_id: 'c',
    };
    const out = normalizer.normalize(raw);
    expect(out.timestamp.startsWith('2010-01-01T00:00:00')).toBe(true);
  });

  it('generates deterministic message_id', () => {
    const a = normalizer.normalize({ rowid: 1, text: 't', handle_id: 'h', date: 0, is_from_me: false, chat_id: 'c' });
    const b = normalizer.normalize({ rowid: 1, text: 'different', handle_id: 'h', date: 0, is_from_me: false, chat_id: 'c' });
    expect(a.message_id).toEqual(b.message_id);
  });
});
