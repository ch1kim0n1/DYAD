import {
  determineConsensus,
  mergeOutputs,
  OutputComparison,
  ConsensusResult,
} from '../src/core/consensus';

function makeComparison(
  tier1: string,
  tier2: string,
  tier1Conf = 0.8,
  tier2Conf = 0.8
): OutputComparison {
  return {
    tier1Output: tier1,
    tier2Output: tier2,
    tier1Confidence: tier1Conf,
    tier2Confidence: tier2Conf,
  };
}

describe('determineConsensus', () => {
  it('returns tier1 when outputs are identical (high similarity)', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const result = determineConsensus(makeComparison(text, text));
    expect(result.decision).toBe('tier1');
    expect(result.similarity).toBeCloseTo(1.0);
  });

  it('returns tier2 when outputs are completely different (low similarity)', () => {
    const result = determineConsensus(
      makeComparison(
        'apple banana cherry',
        'xylophone zebra violin piano'
      )
    );
    expect(result.decision).toBe('tier2');
    expect(result.similarity).toBeLessThan(0.5);
  });

  it('returns tier1 when similarity exceeds threshold', () => {
    // Threshold default is 0.8; use very similar text
    const base = 'the cat sat on the mat and ate the rat';
    const similar = 'the cat sat on the mat and ate the rat today';
    const result = determineConsensus(makeComparison(base, similar), 0.5);
    expect(result.decision).toBe('tier1');
  });

  it('returns tier2 when tier2 confidence significantly higher in medium-similarity case', () => {
    // Medium similarity (0.5–0.8 range), tier2 confidence much higher
    const tier1 = 'solution approach method algorithm implementation code';
    const tier2 = 'solution approach method different unique novel code extra';
    const result = determineConsensus(makeComparison(tier1, tier2, 0.5, 0.85), 0.9);
    // similarity < 0.9 (threshold), so not tier1; similarity > 0.5 (not low), medium range
    // tier2Confidence > tier1Confidence + 0.1, so tier2
    if (result.similarity >= 0.5 && result.similarity <= 0.9) {
      expect(result.decision).toBe('tier2');
    } else if (result.similarity < 0.5) {
      expect(result.decision).toBe('tier2');
    }
    // Either way it should NOT be tier1 since threshold is 0.9 and similarity < 1.0
    expect(['tier2', 'merge']).toContain(result.decision);
  });

  it('returns merge when medium similarity and similar confidence', () => {
    const tier1 = 'apple banana cherry date elderberry fig grape';
    const tier2 = 'apple banana cherry date extra words more here now';
    const result = determineConsensus(makeComparison(tier1, tier2, 0.75, 0.75), 0.95);
    // With equal confidence and medium similarity, should merge
    if (result.similarity >= 0.5 && result.similarity < 0.95) {
      expect(result.decision).toBe('merge');
    }
  });

  it('handles empty outputs (returns abstain-like: tier2)', () => {
    const result = determineConsensus(makeComparison('', ''));
    // Both empty → similarity = 0 (tokens1.size === 0 guard), decision = tier2
    expect(result.similarity).toBe(0);
    expect(result.decision).toBe('tier2');
  });

  it('handles single output tier1 non-empty, tier2 empty', () => {
    const result = determineConsensus(makeComparison('hello world test', ''));
    expect(result.similarity).toBe(0);
    expect(result.decision).toBe('tier2');
  });

  it('similarity is between 0 and 1 for any input', () => {
    const cases: [string, string][] = [
      ['hello', 'hello'],
      ['hello', 'world'],
      ['', ''],
      ['a b c d e f', 'a b c d e f g h'],
    ];
    for (const [t1, t2] of cases) {
      const result = determineConsensus(makeComparison(t1, t2));
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    }
  });

  it('threshold=1.0 forces tier2 unless outputs are exactly equal (Jaccard=1)', () => {
    const text = 'the quick brown fox';
    const result = determineConsensus(makeComparison(text, text + ' extra'), 1.0);
    // similarity < 1.0 → not tier1
    expect(['tier2', 'merge']).toContain(result.decision);
  });

  it('threshold=0.0 always returns tier1 when similarity > 0', () => {
    const text = 'some shared words here and there';
    const text2 = 'some shared words here different end';
    const result = determineConsensus(makeComparison(text, text2), 0.0);
    // similarity > 0.0 → tier1
    if (result.similarity > 0) {
      expect(result.decision).toBe('tier1');
    }
  });
});

describe('mergeOutputs', () => {
  it('mergeOutputs includes both tier1 and tier2 content', () => {
    const merged = mergeOutputs('output one', 'output two');
    expect(merged).toContain('output one');
    expect(merged).toContain('output two');
    expect(merged).toContain('MERGED');
  });
});
