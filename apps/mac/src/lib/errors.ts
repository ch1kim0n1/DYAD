/**
 * Centralized error types with user-friendly messages.
 * Each error includes: what happened, why, and next step.
 */

export class DyadError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly nextStep: string
  ) {
    super(message);
    this.name = 'DyadError';
  }
}

export class SidecarUnavailableError extends DyadError {
  constructor() {
    super(
      'Sidecar unavailable',
      'DYAD cannot connect to the analysis engine.',
      'Wait a moment and try again. If this persists, restart the app.'
    );
    this.name = 'SidecarUnavailableError';
  }
}

export class MessageLoadError extends DyadError {
  constructor(reason: string) {
    super(
      `Message load failed: ${reason}`,
      'Could not load your messages.',
      'Check that your chat.db is accessible and try again.'
    );
    this.name = 'MessageLoadError';
  }
}

export class AnalysisError extends DyadError {
  constructor(reason: string) {
    super(
      `Analysis failed: ${reason}`,
      'Could not analyze your conversation.',
      'Try again with fewer messages, or restart the app.'
    );
    this.name = 'AnalysisError';
  }
}

export class BriefGenerationError extends DyadError {
  constructor(reason: string) {
    super(
      `Brief generation failed: ${reason}`,
      'Could not generate a brief for this pattern.',
      'Try again or contact support if this persists.'
    );
    this.name = 'BriefGenerationError';
  }
}

export class ReframeGenerationError extends DyadError {
  constructor(reason: string) {
    super(
      `Reframe generation failed: ${reason}`,
      'Could not generate a reframe for this pattern.',
      'Try again or contact support if this persists.'
    );
    this.name = 'ReframeGenerationError';
  }
}

export class APIError extends DyadError {
  constructor(status: number, endpoint: string) {
    super(
      `API error: ${status} on ${endpoint}`,
      'A request to the analysis engine failed.',
      'Check your internet connection and try again.'
    );
    this.name = 'APIError';
  }
}

export class ConfigurationError extends DyadError {
  constructor(missingConfig: string) {
    super(
      `Missing configuration: ${missingConfig}`,
      'DYAD is not properly configured.',
      'Check your environment variables and restart the app.'
    );
    this.name = 'ConfigurationError';
  }
}
