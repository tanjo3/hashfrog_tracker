import { Component } from "react";

import { removeKeys } from "../utils/safe-storage";

// Every localStorage key the app persists; "Reset saved data" clears them all.
const STORAGE_KEYS = ["layout", "settings_string", "generator_version", "tracker_session"];

/**
 * When errors occur, the system displays a recovery screen rather than a blank page.
 * It provides a reload option and a 'Reset saved data' route which clears the app's localStorage
 * keys before reloading.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, confirmingReset: false };
  }

  /**
   * Switches to the fallback UI when a descendant throws during render.
   * @param {Error} error - The thrown error.
   * @returns {object} State update storing the error.
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /**
   * Logs the error with its component stack for debugging.
   * @param {Error} error - The thrown error.
   * @param {object} errorInfo - React error info with componentStack.
   */
  componentDidCatch(error, errorInfo) {
    console.error("Unrecoverable render error:", error, errorInfo?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    const { confirmingReset } = this.state;
    if (!confirmingReset) {
      this.setState({ confirmingReset: true });
      return;
    }
    removeKeys(...STORAGE_KEYS);
    window.location.reload();
  };

  render() {
    const { error, confirmingReset } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="container py-5" style={{ maxWidth: 600 }}>
        <div className="card">
          <div className="card-body">
            <h4 className="card-title">Something went wrong</h4>
            <p>The tracker hit an unexpected error and could not continue.</p>
            <p className="text-muted small font-monospace">{String(error?.message || error)}</p>
            <div className="d-flex gap-2 flex-wrap">
              <button type="button" className="btn btn-primary" onClick={this.handleReload}>
                Reload
              </button>
              <button type="button" className="btn btn-outline-danger" onClick={this.handleReset}>
                {confirmingReset ? "Click again to confirm reset" : "Reset saved data"}
              </button>
            </div>
            {confirmingReset && (
              <p className="text-danger small mt-2 mb-0">
                This clears your saved layout and tracker session, then reloads the page.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
