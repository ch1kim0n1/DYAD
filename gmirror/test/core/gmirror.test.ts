/**
 * Core component tests for GMirror
 */

import { mockRubric, mockEvaluation, mockVerdict } from '../fixtures/index.js';

describe('GMirror Core', () => {
  describe('Rubric Management', () => {
    it('should create a rubric', () => {
      expect(mockRubric.id).toBe('rubric-1');
      expect(mockRubric.name).toBe('Test Rubric');
    });

    it('should have criteria', () => {
      expect(mockRubric.criteria).toBeDefined();
      expect(mockRubric.criteria.length).toBeGreaterThan(0);
    });
  });

  describe('Evaluation', () => {
    it('should create an evaluation', () => {
      expect(mockEvaluation.id).toBe('eval-1');
      expect(mockEvaluation.rubricId).toBe('rubric-1');
    });

    it('should calculate overall score', () => {
      expect(mockEvaluation.overallScore).toBe(0.85);
    });
  });

  describe('Verdict Management', () => {
    it('should create a verdict', () => {
      expect(mockVerdict.id).toBe('verdict-1');
      expect(mockVerdict.approved).toBe(true);
    });

    it('should associate verdict with evaluation', () => {
      expect(mockVerdict.evaluationId).toBe('eval-1');
    });
  });
});
