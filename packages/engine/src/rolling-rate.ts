import { NormalizedMessage } from '@dyad/shared';

interface Event {
  timestampMs: number;
  count: number;
}

/**
 * RollingRate — events-per-minute over a sliding time window.
 */
export class RollingRate {
  private windowSizeMinutes: number;
  private events: Event[] = [];

  constructor(windowSizeMinutes: number = 5) {
    this.windowSizeMinutes = windowSizeMinutes;
  }

  addEvent(timestamp: string | number | Date, count: number = 1): void {
    const ms = this.toMs(timestamp);
    this.events.push({ timestampMs: ms, count });
    this.cleanupOldEvents(ms);
  }

  /**
   * Rate (events/minute) using `now` as the trailing edge.
   */
  getCurrentRate(now: number = Date.now()): number {
    this.cleanupOldEvents(now);
    if (this.events.length === 0) return 0;
    const total = this.events.reduce((s, e) => s + e.count, 0);
    return total / this.windowSizeMinutes;
  }

  /**
   * Rate at a specific point in time (uses the window ending at `targetTime`).
   */
  getRateAt(timestamp: string | number | Date): number {
    const target = this.toMs(timestamp);
    const windowStart = target - this.windowSizeMinutes * 60 * 1000;
    const total = this.events
      .filter(e => e.timestampMs >= windowStart && e.timestampMs <= target)
      .reduce((s, e) => s + e.count, 0);
    return total / this.windowSizeMinutes;
  }

  /**
   * Per-message rate time series in chronological order. The rate for
   * each message reflects the window ending at that message.
   */
  computeMessageRates(messages: NormalizedMessage[]): Map<string, number> {
    const ordered = [...messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    this.events = [];
    const rates = new Map<string, number>();
    for (const m of ordered) {
      this.addEvent(m.timestamp, 1);
      rates.set(m.message_id, this.getRateAt(m.timestamp));
    }
    return rates;
  }

  computeParticipantRates(messages: NormalizedMessage[], participantId: string): Map<string, number> {
    return this.computeMessageRates(messages.filter(m => m.participant_id === participantId));
  }

  private cleanupOldEvents(currentTimeMs: number): void {
    const windowStart = currentTimeMs - this.windowSizeMinutes * 60 * 1000;
    this.events = this.events.filter(e => e.timestampMs >= windowStart);
  }

  private toMs(value: string | number | Date): number {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return new Date(value).getTime();
  }

  clear(): void {
    this.events = [];
  }

  getEventCount(now: number = Date.now()): number {
    this.cleanupOldEvents(now);
    return this.events.length;
  }
}
