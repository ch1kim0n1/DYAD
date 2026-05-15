import React from 'react';

interface State { error: Error | null }

/**
 * React error boundary (#66). Catches synchronous render errors thrown by
 * any descendant component and surfaces them as a recoverable surface
 * instead of a white screen of death.
 *
 * Unhandled promise rejections are caught separately by the global
 * `window` listener in `main.tsx`.
 */
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{ name: string }>,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[error-boundary:${this.props.name}]`, error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong in {this.props.name}.</h2>
          <p>{this.state.error.message}</p>
          <button className="error-boundary-button" onClick={this.reset}>
            Try again
          </button>
          <details>
            <summary>Technical details</summary>
            <pre>{this.state.error.stack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
