import { FishBread } from './FishBread'

type Props = { count: number; size?: number }

export function PaperBag({ count, size = 56 }: Props) {
  const peeks = Math.min(count, 3)
  return (
    <div className="bag" style={{ width: size, height: size }} aria-hidden="true">
      <div className="bag__peeks">
        {Array.from({ length: peeks }, (_, i) => (
          <span key={`${count}-${i}`} className="bag__fish">
            <FishBread size={size * 0.55} />
          </span>
        ))}
      </div>
      <svg className="bag__body" viewBox="0 0 60 50" width={size} height={size * 0.7}>
        <path d="M6 6 H54 L50 48 H10 Z" fill="#EDD4A6" />
        <path d="M6 6 H54 L53 12 H7 Z" fill="#D8B47C" />
      </svg>
    </div>
  )
}
