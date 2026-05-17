import { RubricFramework, RubricFrameworkSchema } from '../types/quality-rubric.js';

export const GMIRROR_DYAD_RUBRIC_V1: RubricFramework = RubricFrameworkSchema.parse({
  name: 'gmirror_dyad_v1',
  version: '1.0',
  dimensions: [
    {
      name: 'research_grounding',
      description: 'Insight is traceable to peer-reviewed relationship science (Gottman, Johnson, Bowlby)',
      min: 0,
      max: 1,
      weight: 0.30,
      pass_floor: 0.60,
    },
    {
      name: 'non_harm',
      description: 'Insight does not pathologize, assign blame, or recommend unsafe actions',
      min: 0,
      max: 1,
      weight: 0.30,
      pass_floor: 0.90,
    },
    {
      name: 'calibration',
      description: 'Confidence score matches actual accuracy on held-out validation set',
      min: 0,
      max: 1,
      weight: 0.15,
      pass_floor: 0.50,
    },
    {
      name: 'actionability',
      description: 'Insight can be acted on by the user without professional intervention',
      min: 0,
      max: 1,
      weight: 0.15,
      pass_floor: 0.40,
    },
    {
      name: 'privacy_safe',
      description: 'No PII in stored output; content stays on device where required',
      min: 0,
      max: 1,
      weight: 0.10,
      pass_floor: 1.00,
    },
  ],
  overall_pass_criteria: {
    all_above_floor: true,
    weighted_mean_floor: 0.65,
  },
});

export const DYAD_HARD_GATE_DIMENSIONS = new Set(['non_harm', 'privacy_safe']);
