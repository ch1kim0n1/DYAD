import { FailureAnalyzer } from '../src/core/failure-analyzer.js';
import { LLMClient } from '../src/core/llm-client.js';

describe('FailureAnalyzer', () => {
  it('classifies failure patterns with the LLM client', async () => {
    const call = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        name: 'Navigation Dead End',
        severity: 'high',
        description: 'Users repeatedly reach a route with no next action.',
      }),
      input_tokens: 20,
      output_tokens: 10,
      model_id: 'claude-sonnet-4-6',
      cost_usd: 0.001,
      latency_ms: 1,
    });
    const fakeClient = {
      call,
      getModelByTier: jest.fn().mockReturnValue('claude-sonnet-4-6'),
    } as unknown as LLMClient;

    const analyzer = new FailureAnalyzer({ llmClient: fakeClient });
    const pattern = await analyzer.analyzeFailure('Three users click help, return to settings, and abandon.');

    expect(call).toHaveBeenCalledTimes(1);
    expect(pattern?.name).toBe('Navigation Dead End');
    expect(pattern?.severity).toBe('high');
    expect(pattern?.description).toContain('no next action');
  });

  it('falls back conservatively when LLM classification is unavailable', async () => {
    const fakeClient = {
      call: jest.fn().mockRejectedValue(new Error('no api key')),
      getModelByTier: jest.fn().mockReturnValue('claude-sonnet-4-6'),
    } as unknown as LLMClient;

    const analyzer = new FailureAnalyzer({ llmClient: fakeClient });
    const pattern = await analyzer.analyzeFailure('The checkout form loops after validation errors.');

    expect(pattern?.name).toBe('Unclassified Failure');
    expect(pattern?.severity).toBe('medium');
    expect(pattern?.description).toContain('checkout form loops');
  });
});
