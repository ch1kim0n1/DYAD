/**
 * Mathematical utility functions for DYAD
 */

/**
 * Compute rolling average with exponential decay
 */
export function rollingAverage(current: number, newValue: number, decay: number = 0.95): number {
  return (current * decay) + (newValue * (1 - decay));
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Compute cosine distance (1 - similarity)
 */
export function cosineDistance(vec1: number[], vec2: number[]): number {
  return 1 - cosineSimilarity(vec1, vec2);
}

/**
 * Compute z-score for a value given mean and stddev
 */
export function zScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0;
  return (value - mean) / stddev;
}

/**
 * Compute Euclidean distance between two vectors
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2);
  }

  return Math.sqrt(sum);
}

/**
 * Compute Manhattan distance between two vectors
 */
export function manhattanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.abs(vec1[i] - vec2[i]);
  }

  return sum;
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map(val => val / norm);
}
