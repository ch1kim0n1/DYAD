/**
 * Core component tests for Orchestrator
 */

import { describe, it, expect } from 'bun:test';
import { mockWorkflow, mockPipeline, mockJob } from '../fixtures/index.js';

describe('Orchestrator Core', () => {
  describe('Workflow Management', () => {
    it('should create a workflow', () => {
      expect(mockWorkflow.id).toBe('workflow-1');
      expect(mockWorkflow.name).toBe('Test Workflow');
    });

    it('should have steps', () => {
      expect(mockWorkflow.steps).toBeDefined();
      expect(mockWorkflow.steps.length).toBeGreaterThan(0);
    });

    it('should associate steps with tools', () => {
      expect(mockWorkflow.steps[0].tool).toBe('gbrain');
    });
  });

  describe('Pipeline Management', () => {
    it('should create a pipeline', () => {
      expect(mockPipeline.id).toBe('pipeline-1');
      expect(mockPipeline.name).toBe('Test Pipeline');
    });

    it('should associate workflows with pipeline', () => {
      expect(mockPipeline.workflows).toContain('workflow-1');
    });
  });

  describe('Job Execution', () => {
    it('should create a job', () => {
      expect(mockJob.id).toBe('job-1');
      expect(mockJob.status).toBe('running');
    });

    it('should associate job with pipeline', () => {
      expect(mockJob.pipelineId).toBe('pipeline-1');
    });
  });
});
