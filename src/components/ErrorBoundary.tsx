import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Simple error boundary that logs errors and prevents entire app from crashing.
 * It renders a minimal fallback so the user sees something if a panel fails.
 */
export class ErrorBoundary extends Component<{ children?: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-2 text-red-500">Something went wrong. Check the console for details.</div>;
    }
    return this.props.children;
  }
}
