import { MENU, formatWon } from '../domain/menu'
import { cartCount, cartTotal, type Cart } from '../domain/order'
import { FishTray } from './FishTray'
import { Icon } from './Icon'

type Props = { cart: Cart; onClear: () => void; onSubmit: () => void }

/** Kiosk-style order summary pinned above the tab bar: totals and actions, then what's picked so far. */
export function OrderPanel({ cart, onClear, onSubmit }: Props) {
  const count = cartCount(cart)
  const picked = MENU.filter((item) => (cart[item.flavor] ?? 0) > 0)
  return (
    <section className="orderpanel" aria-label="담은 붕어빵">
      <div className="orderpanel__bar">
        <dl className="orderpanel__totals">
          <div>
            <dt>총수량</dt>
            <dd>{count}</dd>
          </div>
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
      <div className="orderpanel__list">
        <FishTray count={count} />
        {picked.length === 0 ? (
          <p className="orderpanel__empty">붕어빵을 골라 주세요</p>
        ) : (
          <ul className="orderpanel__items">
            {picked.map((item) => (
              <li key={item.flavor} className="orderpanel__item">
                <i className="filling-tag__swatch" style={{ background: item.color }} aria-hidden="true" />
                {item.name}
                <strong>{cart[item.flavor]}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
