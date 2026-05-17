import { createLogger } from '../logger';

const logger = createLogger('persistence');

/**
 * Persistent state management to prevent silent degradation to empty state
 * Implements graceful degradation with fallback mechanisms
 */
export class PersistentStateManager<T> {
  private state: T;
  private fallbackState: T;
  private storageKey: string;
  private lastSuccessfulSave: number;
  private saveAttempts: number;
  private maxRetries: number;
  private onStateChange?: (state: T) => void;

  constructor(
    initialState: T,
    storageKey: string,
    options: {
      fallbackState?: T;
      maxRetries?: number;
      onStateChange?: (state: T) => void;
    } = {}
  ) {
    this.state = initialState;
    this.fallbackState = options.fallbackState ?? initialState;
    this.storageKey = storageKey;
    this.lastSuccessfulSave = Date.now();
    this.saveAttempts = 0;
    this.maxRetries = options.maxRetries ?? 3;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Get current state
   */
  getState(): T {
    return this.state;
  }

  /**
   * Update state with persistence
   */
  async setState(newState: Partial<T>): Promise<boolean> {
    try {
      this.state = { ...this.state, ...newState };
      this.saveAttempts = 0;
      
      const saved = await this.save();
      if (saved) {
        this.lastSuccessfulSave = Date.now();
        this.onStateChange?.(this.state);
        return true;
      }
      
      // Save failed, use fallback
      logger.warn('Save failed, using fallback state');
      this.state = this.fallbackState;
      return false;
    } catch (error) {
      logger.error('Error updating state:', error);
      this.saveAttempts++;
      
      if (this.saveAttempts >= this.maxRetries) {
        logger.error('Max retries reached, using fallback state');
        this.state = this.fallbackState;
        this.saveAttempts = 0;
        return false;
      }
      
      return false;
    }
  }

  /**
   * Save state to storage
   */
  private async save(): Promise<boolean> {
    try {
      const serialized = JSON.stringify(this.state);
      localStorage.setItem(this.storageKey, serialized);
      return true;
    } catch (error) {
      logger.error('Failed to save state:', error);
      return false;
    }
  }

  /**
   * Load state from storage
   */
  async load(): Promise<boolean> {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (serialized) {
        const loaded = JSON.parse(serialized);
        this.state = loaded;
        this.lastSuccessfulSave = Date.now();
        this.onStateChange?.(this.state);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to load state:', error);
      this.state = this.fallbackState;
      return false;
    }
  }

  /**
   * Check if state is stale
   */
  isStale(maxAgeMs: number = 3600000): boolean {
    return Date.now() - this.lastSuccessfulSave > maxAgeMs;
  }

  /**
   * Reset to fallback state
   */
  resetToFallback(): void {
    this.state = this.fallbackState;
    this.save().catch(error => {
      logger.error('Failed to save fallback state:', error);
    });
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    lastSave: number;
    saveAttempts: number;
    isStale: boolean;
  } {
    return {
      isHealthy: this.saveAttempts < this.maxRetries,
      lastSave: this.lastSuccessfulSave,
      saveAttempts: this.saveAttempts,
      isStale: this.isStale(),
    };
  }
}

/**
 * Multi-layer persistence with redundancy
 */
export class RedundantPersistenceManager<T> {
  private layers: PersistentStateManager<T>[];
  private primaryLayer: number;

  constructor(
    initialState: T,
    storageKeys: string[],
    options: {
      fallbackState?: T;
      maxRetries?: number;
      onStateChange?: (state: T) => void;
    } = {}
  ) {
    this.layers = storageKeys.map(
      (key, index) =>
        new PersistentStateManager(initialState, key, {
          ...options,
          onStateChange: index === 0 ? options.onStateChange : undefined,
        })
    );
    this.primaryLayer = 0;
  }

  /**
   * Get state from primary layer
   */
  getState(): T {
    return this.layers[this.primaryLayer].getState();
  }

  /**
   * Update state across all layers
   */
  async setState(newState: Partial<T>): Promise<boolean> {
    let success = false;
    
    // Try to update all layers
    for (const layer of this.layers) {
      const layerSuccess = await layer.setState(newState);
      if (layerSuccess) {
        success = true;
      }
    }
    
    return success;
  }

  /**
   * Load from best available layer
   */
  async load(): Promise<boolean> {
    // Try each layer in order
    for (let i = 0; i < this.layers.length; i++) {
      const loaded = await this.layers[i].load();
      if (loaded) {
        this.primaryLayer = i;
        
        // Sync to other layers
        const state = this.layers[i].getState();
        for (let j = 0; j < this.layers.length; j++) {
          if (j !== i) {
            await this.layers[j].setState(state);
          }
        }
        
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get health status of all layers
   */
  getHealthStatus(): Array<{
    layer: number;
    isHealthy: boolean;
    lastSave: number;
    saveAttempts: number;
    isStale: boolean;
  }> {
    return this.layers.map((layer, index) => ({
      layer: index,
      ...layer.getHealthStatus(),
    }));
  }

  /**
   * Switch primary layer
   */
  switchPrimaryLayer(layerIndex: number): void {
    if (layerIndex >= 0 && layerIndex < this.layers.length) {
      this.primaryLayer = layerIndex;
      const state = this.layers[layerIndex].getState();
      
      // Sync state to other layers
      for (let i = 0; i < this.layers.length; i++) {
        if (i !== layerIndex) {
          this.layers[i].setState(state).catch(error => {
            logger.error(`Failed to sync to layer ${i}:`, error);
          });
        }
      }
    }
  }
}

/**
 * Circuit breaker for external service calls
 */
export class CircuitBreaker {
  private failureCount: number;
  private lastFailureTime: number;
  private resetTimeout: number;
  private failureThreshold: number;
  private isOpen: boolean;

  constructor(failureThreshold: number = 5, resetTimeout: number = 60000) {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.resetTimeout = resetTimeout;
    this.failureThreshold = failureThreshold;
    this.isOpen = false;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.isOpen = false;
        this.failureCount = 0;
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.isOpen = false;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.isOpen = true;
      logger.warn('Circuit breaker opened due to repeated failures');
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime: number;
  } {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.isOpen = false;
  }
}
