/**
 * Test fixtures for Orchestrator
 */

export const mockWorkflow = {
  id: 'workflow-1',
  name: 'Test Workflow',
  description: 'A test workflow',
  steps: [
    { id: 's1', name: 'Step 1', tool: 'gbrain' },
    { id: 's2', name: 'Step 2', tool: 'glearn' },
  ],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockPipeline = {
  id: 'pipeline-1',
  name: 'Test Pipeline',
  description: 'A test pipeline',
  workflows: ['workflow-1'],
  config: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockJob = {
  id: 'job-1',
  pipelineId: 'pipeline-1',
  status: 'running',
  startedAt: new Date('2024-01-01'),
  completedAt: null,
  result: null,
};
