/**
 * Calibration Manager for GMirror
 * Manages evaluation calibration
 */

import { logger } from './logger.js';

export interface CalibrationMetrics {
  timestamp: Date;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export class CalibrationManager {
  private metrics: CalibrationMetrics[] = [];
  private targetAccuracy = 0.8;

  addTargetAccuracy(target: number): void {
    this.targetAccuracy = target;
    logger.info('Target accuracy set', { target });
  }

  recordMetrics(metrics: Omit<CalibrationMetrics, 'timestamp'>): void {
    const fullMetrics: CalibrationMetrics = {
      ...metrics,
      timestamp: new Date(),
    };
    
    this.metrics.push(fullMetrics);
    logger.debug('Calibration metrics recorded', { metrics: fullMetrics });
  }

  getCurrentMetrics(): CalibrationMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getAverageMetrics(): CalibrationMetrics | null {
    if (this.metrics.length === 0) {
      return null;
    }

    const sum = this.metrics.reduce((acc, m) => ({
      accuracy: acc.accuracy + m.accuracy,
      precision: acc.precision + m.precision,
      recall: acc.recall + m.recall,
      f1Score: acc.f1Score + m.f1Score,
    }), { accuracy: 0, precision: 0, recall: 0, f1Score: 0 });

    const count = this.metrics.length;
    
    return {
      timestamp: new Date(),
      accuracy: sum.accuracy / count,
      precision: sum.precision / count,
      recall: sum.recall / count,
      f1Score: sum.f1Score / count,
    };
  }

  isCalibrated(): boolean {
    const current = this.getCurrentMetrics();
    return current ? current.accuracy >= this.targetAccuracy : false;
  }

  clear(): void {
    this.metrics = [];
    logger.info('CalibrationManager cleared');
  }
}
