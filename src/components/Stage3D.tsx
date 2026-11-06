import { Component, Suspense, useState, type ReactNode } from 'react'
import { prefersReducedMotion, supportsWebGL } from './hooks'

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

type Props = { caption: string; height: number; fallback: ReactNode; children: ReactNode; className?: string }

export function Stage3D({ caption, height, fallback, children, className }: Props) {
  const [use3d] = useState(() => supportsWebGL() && !prefersReducedMotion())
  return (
    <figure className={`stage ${className ?? ''}`} style={{ height }}>
      <figcaption className="sr-only">{caption}</figcaption>
      {use3d ? (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={fallback}>{children}</Suspense>
        </SceneBoundary>
      ) : (
        fallback
      )}
    </figure>
  )
}

export function StaticFallback({ children }: { children: ReactNode }) {
  return <div className="stage__fallback">{children}</div>
}
