import { wilsonCI, formatWilsonCI, WilsonCI } from '../src/core/wilson-ci';

describe('wilsonCI', () => {
  describe('boundary conditions', () => {
    it('returns all zeros when denominator is 0', () => {
      const ci = wilsonCI(0, 0);
      expect(ci.point).toBe(0);
      expect(ci.lower).toBe(0);
      expect(ci.upper).toBe(0);
    });

    it('returns all zeros when denominator is negative', () => {
      const ci = wilsonCI(5, -1);
      expect(ci).toEqual({ point: 0, lower: 0, upper: 0 });
    });

    it('lowerBound is exactly 0 when successes is 0', () => {
      const ci = wilsonCI(0, 100);
      expect(ci.lower).toBe(0);
      expect(ci.point).toBe(0);
    });

    it('upperBound is exactly 1 when all trials are successes', () => {
      const ci = wilsonCI(50, 50);
      expect(ci.upper).toBe(1);
      expect(ci.point).toBe(1);
    });
  });

  describe('output range', () => {
    it('all values are within [0, 1]', () => {
      const cases: [number, number][] = [
        [0, 1], [1, 1], [0, 10], [5, 10], [10, 10],
        [1, 100], [50, 100], [99, 100], [100, 100],
        [1, 1000], [500, 1000],
      ];
      for (const [k, n] of cases) {
        const ci = wilsonCI(k, n);
        expect(ci.point).toBeGreaterThanOrEqual(0);
        expect(ci.point).toBeLessThanOrEqual(1);
        expect(ci.lower).toBeGreaterThanOrEqual(0);
        expect(ci.lower).toBeLessThanOrEqual(1);
        expect(ci.upper).toBeGreaterThanOrEqual(0);
        expect(ci.upper).toBeLessThanOrEqual(1);
      }
    });

    it('lower <= point <= upper', () => {
      const ci = wilsonCI(30, 100);
      expect(ci.lower).toBeLessThanOrEqual(ci.point);
      expect(ci.point).toBeLessThanOrEqual(ci.upper);
    });
  });

  describe('monotonicity', () => {
    it('lowerBound increases as successes increase (fixed denominator)', () => {
      const n = 100;
      let prevLower = -Infinity;
      for (const k of [0, 10, 30, 50, 70, 90, 100]) {
        const ci = wilsonCI(k, n);
        expect(ci.lower).toBeGreaterThanOrEqual(prevLower);
        prevLower = ci.lower;
      }
    });

    it('upperBound decreases as sample size increases (fixed proportion)', () => {
      // Fix proportion at 0.5, increase n
      const intervals: WilsonCI[] = [10, 50, 100, 500, 1000].map(n =>
        wilsonCI(Math.round(n / 2), n)
      );
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i].upper).toBeLessThanOrEqual(intervals[i - 1].upper);
      }
    });
  });

  describe('numerator clamping', () => {
    it('clamps numerator > denominator to denominator', () => {
      const ci = wilsonCI(150, 100);
      expect(ci.point).toBe(1);
      expect(ci.upper).toBe(1);
    });

    it('clamps negative numerator to 0', () => {
      const ci = wilsonCI(-5, 100);
      expect(ci.point).toBe(0);
      expect(ci.lower).toBe(0);
    });
  });

  describe('known values', () => {
    it('point estimate matches k/n', () => {
      expect(wilsonCI(30, 100).point).toBeCloseTo(0.3);
      expect(wilsonCI(1, 4).point).toBeCloseTo(0.25);
    });

    it('interval is narrower with larger sample', () => {
      const small = wilsonCI(5, 10);
      const large = wilsonCI(500, 1000);
      const widthSmall = small.upper - small.lower;
      const widthLarge = large.upper - large.lower;
      expect(widthLarge).toBeLessThan(widthSmall);
    });
  });
});

describe('formatWilsonCI', () => {
  it('formats as percentage string with bounds', () => {
    const result = formatWilsonCI({ point: 0.5, lower: 0.4, upper: 0.6 });
    expect(result).toBe('50.0% [40.0-60.0%]');
  });

  it('formats zero correctly', () => {
    const result = formatWilsonCI({ point: 0, lower: 0, upper: 0 });
    expect(result).toBe('0.0% [0.0-0.0%]');
  });
});
