import * as crypto from 'crypto';
import { RubricFramework } from '../types/quality-rubric.js';

export const GMIRROR_RUBRIC_V1: RubricFramework = {
  name: 'gmirror_v1',
  version: '1.0',
  dimensions: [
    {
      name: 'correctness',
      description: 'Task completion accuracy and faithfulness to requirements',
      min: 0,
      max: 1,
      weight: 0.25,
      pass_floor: 0.5,
    },
    {
      name: 'user_outcome',
      description: 'Goal achievement and user satisfaction (inverse frustration)',
      min: 0,
      max: 1,
      weight: 0.2,
      pass_floor: 0.5,
    },
    {
      name: 'robustness',
      description: 'Handles errors, edge cases, unexpected inputs',
      min: 0,
      max: 1,
      weight: 0.15,
      pass_floor: 0.45,
    },
    {
      name: 'cost',
      description: 'Cost efficiency (inverse cost_usd / max_budget)',
      min: 0,
      max: 1,
      weight: 0.1,
      pass_floor: 0.3,
    },
    {
      name: 'risk',
      description: 'Safety score (1 - risk_level)',
      min: 0,
      max: 1,
      weight: 0.2,
      pass_floor: 0.5,
    },
    {
      name: 'confidence',
      description: 'Scorer agreement and certainty',
      min: 0,
      max: 1,
      weight: 0.1,
      pass_floor: 0.4,
    },
  ],
  overall_pass_criteria: {
    all_above_floor: true,
    weighted_mean_floor: 0.6,
  },
};

export function getRubricHash(rubric: RubricFramework): string {
  const str = JSON.stringify(rubric);
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return hash.substring(0, 8);
}
