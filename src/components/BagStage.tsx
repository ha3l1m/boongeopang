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
/** The empty bag's opening sits higher and is a bit narrower than the full bag's, so the fish shrink and rise to fit. */
export const FISH_FIT = 'translate(646 465) scale(0.88) translate(-646 -505)'
export const BAG = { x: 235, y: 337, width: 814, height: 754 }

type Props = { fillings: string[]; closing: boolean; height: number }

/** Paper bag with its taiyaki already inside (static). `closing` only changes the caption. */
export function BagStage({ fillings, closing, height }: Props) {
  const shown = FISH_FOR_COUNT[Math.min(fillings.length, 3)]

  return (
    <figure className="stage" style={{ height }}>
      <figcaption className="sr-only">
        {closing ? '붕어빵 봉투를 접어 주문을 넣는 중' : `붕어빵 ${fillings.length}마리가 봉투에 퐁퐁 들어가요`}
      </figcaption>
      <div className="bag-art bag-art--fish">
        {shown.map((index) => (
          <img key={index} src="/art/fish.png" width={72} height={51} alt="" />
        ))}
      </div>
    </figure>
  )
}

/** Empty paper bag for empty states (docs/design/ref/bag-empty-source.png, cropped to the bag; 814x754). */
export function EmptyBag({ size }: { size: number }) {
  return <img src="/art/bag/empty.webp" width={size} height={Math.round((size * 754) / 814)} alt="" />
}
