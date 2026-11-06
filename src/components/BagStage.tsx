import type { CSSProperties } from 'react'
import './bagStage.css'

/**
 * Fish come from the full-bag illustration (tools/art/build_bag_layers.py), the bag from the empty-bag one
 * (tools/art/build_empty_bag_layers.py). Both sources are 1312x1199 and the viewBox uses their pixel coordinates.
 */
export const FISH = [
  { x: 303, y: 146, width: 380, height: 404, tilt: -24 },
  { x: 619, y: 83, width: 413, height: 446, tilt: 20 },
  { x: 480, y: 316, width: 417, height: 291, tilt: -14 },
]
/** Which fish to show for 1, 2 and 3+ orders, back to front; picked so no fish's hidden belly is left in view. */
const FISH_FOR_COUNT = [[], [2], [0, 2], [0, 1, 2]]
const FIRST_DROP_MS = 900 // page fades in over 360ms; hold the empty bag a beat after that before the first fish
const DROP_GAP_MS = 320
const LANDING_AT = 0.62 // share of the drop animation where the fish hits the bottom
const DROP_MS = 700
/** The empty bag's opening sits higher and is a bit narrower than the full bag's, so the fish shrink and rise to fit. */
export const FISH_FIT = 'translate(646 465) scale(0.88) translate(-646 -505)'
export const BAG = { x: 235, y: 337, width: 814, height: 754 }

type Props = { fillings: string[]; closing: boolean; height: number }

/** Paper bag that taiyaki drop into one by one; on `closing` they sink in and the bag gives a little hop. */
export function BagStage({ fillings, closing, height }: Props) {
  const shown = FISH_FOR_COUNT[Math.min(fillings.length, 3)]
  const dropDelay = (order: number) => FIRST_DROP_MS + order * DROP_GAP_MS
  const thuds = shown.map((_, order) => `bag-art-thud 380ms ease-out ${dropDelay(order) + DROP_MS * LANDING_AT}ms`)
  const bagStyle = { animation: closing ? 'bag-art-hop 520ms ease-out' : thuds.join(', ') || 'none' }

  return (
    <figure className="stage" style={{ height }}>
      <figcaption className="sr-only">
        {closing ? '붕어빵 봉투를 접어 주문을 넣는 중' : `붕어빵 ${fillings.length}마리가 봉투에 퐁퐁 들어가요`}
      </figcaption>
      <svg
        className={closing ? 'bag-art bag-art--closing' : 'bag-art'}
        viewBox="170 40 972 1090"
        width="100%"
        height="100%"
        role="presentation"
      >
        <defs>
          <radialGradient id="bag-art-shadow">
            <stop offset="0" stopColor="#7A4A1C" stopOpacity="0.28" />
            <stop offset="1" stopColor="#7A4A1C" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="642" cy="1080" rx="380" ry="34" fill="url(#bag-art-shadow)" />
        <g className="bag-art__bag" style={bagStyle}>
          <image href="/art/bag/empty.webp" {...BAG} />
          <g transform={FISH_FIT}>
            <g className="bag-art__sink">
              {shown.map((index, order) => {
                const fish = FISH[index]
                const style = { animationDelay: `${dropDelay(order)}ms`, '--tilt': `${fish.tilt}deg` } as CSSProperties
                return (
                  <g key={index} className="bag-art__fish" style={style}>
                    <image href={`/art/bag/fish-${index}.webp`} x={fish.x} y={fish.y} width={fish.width} height={fish.height} />
                  </g>
                )
              })}
            </g>
          </g>
          <image href="/art/bag/empty-front.webp" {...BAG} />
        </g>
      </svg>
    </figure>
  )
}

/** Empty paper bag for empty states (docs/design/ref/bag-empty-source.png, cropped to the bag; 814x754). */
export function EmptyBag({ size }: { size: number }) {
  return <img src="/art/bag/empty.webp" width={size} height={Math.round((size * 754) / 814)} alt="" />
}
