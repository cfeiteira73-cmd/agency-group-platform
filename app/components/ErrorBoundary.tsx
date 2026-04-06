'use client'
import React, { type ReactNode, type ErrorInfo } from 'react'

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  State
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '24px', color: '#c9a96e', fontFamily: 'DM Mono, monospace' }}>
          Erro ao carregar este componente.
          <button onClick={() => this.setState({ hasError: false })} style={{ marginLeft: '12px', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
