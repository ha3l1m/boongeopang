import { formatWon } from '../domain/menu'
import { cartCount, cartTotal, type Cart } from '../domain/order'
import { Icon } from './Icon'

type Props = { cart: Cart; onClear: () => void; onSubmit: () => void }

/** Order summary pinned above the tab bar: the total price and the actions. */
export function OrderPanel({ cart, onClear, onSubmit }: Props) {
  const count = cartCount(cart)
  return (
    <section className="orderpanel" aria-label="담은 붕어빵">
      <div className="orderpanel__bar">
        <dl className="orderpanel__totals">
          <div>
            <dt>총금액</dt>
            <dd>{formatWon(cartTotal(cart))}</dd>
          </div>
        </dl>
        <button type="button" className="orderpanel__reset" aria-label="담은 붕어빵 모두 비우기" onClick={onClear} disabled={count === 0}>
          <Icon name="reset" size={22} />
        </button>
        <button type="button" className={`btn btn--primary orderpanel__cta ${count === 0 ? 'orderpanel__cta--idle' : ''}`} onClick={onSubmit}>
          봉투 담기
        </button>
      </div>
    </section>
  )
}
