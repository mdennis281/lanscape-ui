import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary that catches unhandled React render errors
 * and displays a recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="app-error">
        <div className="loading-screen">
          <h1 style={{ color: 'var(--danger-accent)', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            An unexpected error occurred. You can try reloading the page.
          </p>
          {this.state.error && (
            <pre
              style={{
                textAlign: 'left',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                background: 'var(--secondary-bg)',
                padding: '1rem',
                borderRadius: '8px',
                overflow: 'auto',
                maxHeight: '200px',
                marginBottom: '1.5rem',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button className="loading-btn" onClick={this.handleReload}>
            <i className="fa-solid fa-rotate-right" /> Reload
          </button>
        </div>
      </div>
    );
  }
}
