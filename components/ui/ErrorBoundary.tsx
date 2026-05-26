'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: unknown[]
  context?: string // for error reporting
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorId: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = `err_${Date.now().toString(36)}`
    return { hasError: true, error, errorId }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary][${this.props.context ?? 'unknown'}]`, error, errorInfo)
    this.props.onError?.(error, errorInfo)

    // Fire-and-forget error reporting
    void fetch('/api/observability/control-plane', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record-metric',
        metric_name: 'error_rate_pct',
        value: 1,
      }),
    }).catch(() => undefined)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKeys !== this.props.resetKeys) {
      this.setState({ hasError: false, error: null, errorId: null })
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorId: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <div className="text-red-500 dark:text-red-400 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
            Something went wrong
          </h3>
          {this.state.errorId && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-3 font-mono">
              Error ID: {this.state.errorId}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="text-sm px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// HOC wrapper for easier use
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  context?: string,
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <ErrorBoundary context={context}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )
  Wrapped.displayName = `WithErrorBoundary(${WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'})`
  return Wrapped
}
