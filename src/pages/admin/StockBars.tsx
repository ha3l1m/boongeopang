import { INGREDIENTS, LOW_STOCK_RATIO, type Ingredient } from '../../domain/robot'
import { refill } from '../../services/robotService'
import { runSafely, type Notify } from './runSafely'

type Props = Notify & { stock: Record<Ingredient, number> }

export function StockBars({ stock, ...notify }: Props) {
  const fill = (key: Ingredient) => runSafely(() => refill(key), notify, '재료를 채우지 못했어요')

  return (
    <section className="card stock" aria-label="재료 잔량">
      <h2>재료 잔량</h2>
      <ul className="stock__list">
        {INGREDIENTS.map(({ key, name, capacity }) => {
          const left = stock[key]
          const ratio = left / capacity
          const tone = left === 0 ? 'out' : ratio <= LOW_STOCK_RATIO ? 'low' : 'ok'
          return (
            <li key={key} className={`stock__row stock__row--${tone}`}>
              <span className="stock__name">{name}</span>
              <span
                className="stock__bar"
                role="meter"
                aria-label={`${name} 잔량`}
                aria-valuemin={0}
                aria-valuemax={capacity}
                aria-valuenow={left}
              >
                <i style={{ width: `${ratio * 100}%` }} />
              </span>
              <span className="stock__qty">{left === 0 ? '품절' : `${left}/${capacity}`}</span>
              <button type="button" className="chip stock__fill" disabled={left === capacity} onClick={() => fill(key)}>
                채우기
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
