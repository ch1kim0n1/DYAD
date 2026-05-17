import { v4 as uuidv4 } from 'uuid';
import { GMirror } from './core/gmirror.js';
import { GMIRROR_RUBRIC_V1 } from './core/gmirror-rubric.js';
import { RubricFramework } from './types/quality-rubric.js';

export interface MirrorSDKOptions {
  apiKey?: string;
  rubric?: RubricFramework;
  panelSize?: number; // default: 5
}

export class MirrorSDK {
  private mirror: GMirror;
  private panelSize: number;

  constructor(options: MirrorSDKOptions = {}) {
    this.panelSize = options.panelSize ?? 5;
    this.mirror = new GMirror({
      rubric: options.rubric,
      // no gbrainEndpoint — circuit breaker handles degraded mode
    });
  }

  async score(input: { task: string; output: string; metadata?: object }) {
    const requestId = uuidv4();
    const request = {
      request_id: requestId,
      mode: 'change' as const,
      payload: { task: input.task, output: input.output },
      context: { metadata: input.metadata ?? {} },
      budget: {
        max_cost_usd: 5,
        max_latency_ms: 60_000,
        max_panel_size: this.panelSize,
      },
      caller: { source: 'sdk', ref: requestId },
      created_at: new Date().toISOString(),
    };
    const scope = {
      request_id: requestId,
      population_filter: {
        persona_labels: [],
        expertise_domains: [],
        trust_range: [0.3, 1.0] as [number, number],
      },
      scenario_set: ['default'],
      red_team_set: [],
      scoring_profile: 'default',
      panel_size: this.panelSize,
    };
    return this.mirror.scoreChange(request, scope);
  }
}

export { GMirror, GMIRROR_RUBRIC_V1 };
