
import React, { ErrorInfo, ReactNode } from 'react';

const ErrorIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-red-600 dark:text-red-300">
        <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900 fixed inset-0 z-[99999]">
            <div className="max-w-xl rounded-lg bg-white dark:bg-zinc-800 p-8 text-center shadow-2xl border border-red-200 dark:border-red-900">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                    <ErrorIcon />
                </div>
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Something went wrong</h1>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                    An unexpected error occurred. Please try refreshing the page.
                </p>
                {this.state.error && (
                    <details className="mt-4 text-left text-xs bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-md border border-zinc-200 dark:border-zinc-700">
                        <summary className="cursor-pointer font-semibold text-zinc-500">Error Details</summary>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-zinc-600 dark:text-zinc-400 overflow-auto max-h-40">
                           {this.state.error.toString()}
                           {this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                )}
                <div className="mt-6">
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
