import { useId } from 'react'

type Props = { name: string; filling: string; qty: number; phase: number; badge?: string }

/** public/art/fish.webp is 360x253; the bite is taken from the lips, stopping short of the eye at (76, 123). */
const FISH_W = 360
const FISH_H = 253
const BITE = { cx: -2, cy: 152, r: 68 }
const TEETH = [-58, -22, 14, 50] // degrees around the bite's edge where tooth marks nip a little deeper

function toothAt(deg: number) {
  const rad = (deg * Math.PI) / 180
  return { cx: BITE.cx + Math.cos(rad) * BITE.r, cy: BITE.cy + Math.sin(rad) * BITE.r }
}

/** Clay taiyaki with a bite out of its head showing the filling; bobs in its tile and hops on every pick. */
export function MenuFish({ name, filling, qty, phase, badge }: Props) {
  const id = useId()
  return (
    <figure className="menu__fish">
      <figcaption className="sr-only">{`${name} 붕어빵`}</figcaption>
      <span key={qty} className={qty > 0 ? 'menu__fish-hop' : undefined}>
        <svg
          className="menu__fish-img"
          viewBox={`0 0 ${FISH_W} ${FISH_H}`}
          width={68}
          height={48}
          aria-hidden="true"
          style={{ animationDelay: `${-phase}s` }}
        >
          <defs>
            <mask id={`${id}-body`} maskUnits="userSpaceOnUse" style={{ maskType: 'alpha' }}>
              <image href="/art/fish.webp" width={FISH_W} height={FISH_H} />
            </mask>
            <mask id={`${id}-bite`} maskUnits="userSpaceOnUse">
              <rect width={FISH_W} height={FISH_H} fill="white" />
              <circle {...BITE} fill="black" />
              {TEETH.map((deg) => (
                <circle key={deg} {...toothAt(deg)} r={15} fill="black" />
              ))}
            </mask>
            <radialGradient id={`${id}-crumb`} cx={BITE.cx} cy={BITE.cy} r={BITE.r + 14} gradientUnits="userSpaceOnUse">
              <stop offset="0.55" stopColor="#FFF1CF" />
              <stop offset="0.86" stopColor="#F7D79A" />
              <stop offset="1" stopColor="#D98A2E" />
            </radialGradient>
          </defs>
          {/* cross-section, only where the fish's body was */}
          <g mask={`url(#${id}-body)`}>
            <circle cx={BITE.cx} cy={BITE.cy} r={BITE.r + 14} fill={`url(#${id}-crumb)`} />
            <circle cx={BITE.cx + 4} cy={BITE.cy} r={BITE.r - 14} fill={filling} />
            <ellipse cx={BITE.cx + 18} cy={BITE.cy - 14} rx={10} ry={6} fill="white" opacity={0.35} />
          </g>
          <image href="/art/fish.webp" width={FISH_W} height={FISH_H} mask={`url(#${id}-bite)`} />
        </svg>
      </span>
      {badge && <span className="menu__fish-badge">{badge}</span>}
    </figure>
  )
}
