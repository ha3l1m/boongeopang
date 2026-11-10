type Props = { size?: number; filling?: string; className?: string; title?: string }

/** 붕어빵 drawing (public/art/fish.png), with an optional filling showing in the open cavity. */
export function FishBread({ size = 72, filling, className, title }: Props) {
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
      <image href="/art/fish.png" x="0" y="0" width="120" height="86" preserveAspectRatio="xMidYMid meet" />
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
