type IconName = 'mic' | 'reset' | 'home' | 'fish' | 'receipt' | 'back' | 'check' | 'plus' | 'minus'

/** Line icons drawn on a 24px grid in currentColor, so they follow text color. */
const PATHS: Record<IconName, string> = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M5.5 11.5a6.5 6.5 0 0 0 13 0 M12 18v3 M9 21h6',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3 M4.5 4.5v4.2h4.2',
  home: 'M3.5 10.5 12 4l8.5 6.5 M5.5 9v10.5h4.5v-6h4v6h4.5V9',
  fish: 'M7 12c2.2-3.6 5-5.5 8-5.5 3.2 0 5.6 2.2 7 5.5-1.4 3.3-3.8 5.5-7 5.5-3 0-5.8-1.9-8-5.5Z M7 12 2.5 8v8L7 12Z M17.5 10.8h.01 M11.5 9.5c-.8 1.6-.8 3.4 0 5',
  receipt: 'M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3Z M9 8h6 M9 12h6 M9 16h3',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
}

type Props = { name: IconName; size?: number; strokeWidth?: number; className?: string }

export function Icon({ name, size = 24, strokeWidth = 2, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
