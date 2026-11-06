import type { CSSProperties } from 'react'

/** Base colour of the variant 2 backdrop; the lighter stops below it are mixed from it in pages.css. */
export const BACKDROP_BASE = '#CCB294'

/** Picked base colour, or null for the stylesheet default. */
export type BackdropColor = string | null

export function backdropStyle(color: BackdropColor): CSSProperties | undefined {
  return color ? ({ '--v2-base': color } as CSSProperties) : undefined
}

interface Props {
  color: BackdropColor
  onChange: (color: BackdropColor) => void
}

/** Test-only colour picker for the splash backdrop. The CSS line it shows can be pasted into pages.css. */
export function BackdropColorPanel({ color, onChange }: Props) {
  const value = (color ?? BACKDROP_BASE).toUpperCase()

  return (
    <details className="backdrop-panel">
      <summary>배경색 (테스트)</summary>
      <label className="backdrop-panel__row">
        <input type="color" aria-label="배경색" value={value.toLowerCase()} onChange={(e) => onChange(e.target.value)} />
        <code className="backdrop-panel__css">--v2-base: {value};</code>
      </label>
      <button type="button" onClick={() => onChange(null)}>
        배경색 초기화
      </button>
    </details>
  )
}
