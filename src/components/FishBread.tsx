import { useId } from 'react'

type Props = { size?: number; filling?: string; className?: string; title?: string }

export function FishBread({ size = 72, filling, className, title }: Props) {
  const id = useId()
  const body = `${id}-body`
  const shine = `${id}-shine`
  return (
    <svg
      className={className}
      width={size}
      height={size * 0.72}
      viewBox="0 0 120 86"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={body} cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFD27A" />
          <stop offset="60%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#D9861A" />
        </radialGradient>
        <radialGradient id={shine} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="62" cy="80" rx="44" ry="5" fill="#5A3A1E" opacity="0.12" />
      <path d="M22 43 C8 28 4 22 10 18 C18 14 26 26 32 34 C26 40 26 46 32 52 C26 60 18 72 10 68 C4 64 8 58 22 43 Z" fill={`url(#${body})`} />
      <path d="M30 43 C30 20 52 8 76 10 C100 12 114 28 114 43 C114 60 98 76 74 76 C50 76 30 64 30 43 Z" fill={`url(#${body})`} />
      <path d="M48 24 C44 32 44 40 48 46 M58 22 C54 30 54 40 58 48 M68 22 C64 30 64 42 68 50" stroke="#C8782E" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M86 26 C82 34 82 48 86 56" stroke="#C8782E" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
      <circle cx="98" cy="36" r="5" fill="#C8782E" opacity="0.7" />
      <circle cx="99" cy="35" r="1.6" fill="#fff" opacity="0.8" />
      <ellipse cx="62" cy="22" rx="18" ry="7" fill={`url(#${shine})`} />
      {filling && (
        <g>
          <circle cx="53" cy="57" r="17" fill="#FFE7B8" stroke="#E9B977" strokeWidth="2" />
          <circle cx="53" cy="57" r="12" fill={filling} />
          <ellipse cx="49" cy="52" rx="4.5" ry="2.5" fill="#fff" opacity="0.35" />
        </g>
      )}
    </svg>
  )
}
