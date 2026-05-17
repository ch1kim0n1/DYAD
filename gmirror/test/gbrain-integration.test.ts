import {
  GBrainIntegrationClient,
  GBrainIntegrationError,
} from '../src/core/gbrain-integration.js';

const scenario = {
  scenario_id: '00000000-0000-4000-8000-000000000010',
  goal: {
    goal_id: 'goal-1',
    description: 'Complete checkout',
    priority: 0.9,
    success_criteria: ['order_submitted'],
  },
  starting_state: { page: 'cart' },
  success_criterion: 'order_submitted',
  failure_criteria: ['abandonment'],
  tags: ['checkout'],
  version: 1,
  derivation: 'baseline',
  created_at: new Date('2026-05-15T00:00:00.000Z').toISOString(),
};

const request = {
  request_id: '00000000-0000-4000-8000-000000000001',
  mode: 'change',
  payload: {},
  context: {},
  budget: {
    max_cost_usd: 1,
    max_latency_ms: 1000,
    max_panel_size: 1,
  },
  caller: { source: 'test', ref: 'unit' },
  created_at: new Date('2026-05-15T00:00:00.000Z').toISOString(),
} as any;

describe('GBrainIntegrationClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('sends auth headers and validates health responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy' }),
    } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      authToken: 'secret-token',
      maxRetries: 0,
    });

    await expect(client.healthCheck()).resolves.toEqual(expect.objectContaining({ status: 'healthy' }));
    expect(global.fetch).toHaveBeenCalledWith(
      'http://gbrain.local/health',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    );
  });

  it('pulls scenario corpus from GBrain pages', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ([{ page_id: 'page-1', title: 'Checkout scenarios', content: JSON.stringify({ scenarios: [scenario] }), tags: ['gmirror', 'scenario'] }]),
    } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      maxRetries: 0,
    });

    const scenarios = await client.getScenarioCorpus(request, ['checkout']);

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].goal.description).toBe('Complete checkout');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/pages/search?'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('retries transient failures with backoff', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ack_id: 'ack-1' }) } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      maxRetries: 1,
      initialBackoffMs: 1,
    });

    await expect(client.storeDriftDetection({
      component: 'gmirror',
      metric_name: 'frustration',
      trend: 'stable',
      slope: 0,
      confidence: 0.9,
      current_value: 0.2,
      average_value: 0.2,
      at_risk: false,
    })).resolves.toEqual(expect.objectContaining({ ack_id: 'ack-1' }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('opens the circuit breaker after repeated transient failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      maxRetries: 0,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerCooldownMs: 1000,
    });

    await expect(client.healthCheck()).rejects.toBeInstanceOf(GBrainIntegrationError);
    await expect(client.healthCheck()).rejects.toMatchObject({ kind: 'circuit_open' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('supports MCP tool transport', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: { scenarios: [scenario] } }),
    } as Response);

    const client = new GBrainIntegrationClient({
      endpoint: 'http://gbrain.local',
      mcpEndpoint: 'http://gbrain.local/mcp',
      mode: 'mcp',
      maxRetries: 0,
    });

    const scenarios = await client.getScenarioCorpus(request, ['checkout']);

    expect(scenarios).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://gbrain.local/mcp/tools/gbrain.get_gmirror_scenarios',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
