/**
 * Test fixtures for GMirror
 */

export const mockRubric = {
  id: 'rubric-1',
  name: 'Test Rubric',
  description: 'A test rubric',
  criteria: [
    { id: 'c1', name: 'Criterion 1', weight: 1.0 },
    { id: 'c2', name: 'Criterion 2', weight: 1.0 },
  ],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockEvaluation = {
  id: 'eval-1',
  rubricId: 'rubric-1',
  target: 'test-target',
  scores: { c1: 0.8, c2: 0.9 },
  overallScore: 0.85,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockVerdict = {
  id: 'verdict-1',
  evaluationId: 'eval-1',
  approved: true,
  notes: 'Test verdict',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockFailureMode = {
  id: 'fm-1',
  name: 'Test Failure Mode',
  description: 'A test failure mode',
  severity: 'medium',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};
