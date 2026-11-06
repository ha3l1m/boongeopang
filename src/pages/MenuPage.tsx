import { useNavigate } from 'react-router-dom'
import { MENU, MAX_PER_FLAVOR, MAX_TOTAL, formatWon } from '../domain/menu'
import { canAdd, cartCount } from '../domain/order'
import { useCart } from '../state/CartContext'
import { MenuFish } from '../components/MenuFish'
import { QtyStepper } from '../components/QtyStepper'
import { OrderPanel } from '../components/OrderPanel'
import { Icon } from '../components/Icon'
import { useGoHome, useToast } from '../components/hooks'
import { stockLeft } from '../domain/robot'
import { listAllOrders } from '../services/orderService'
import { readRobot } from '../services/robotService'

export function MenuPage() {
  const { cart, add, remove, clear } = useCart()
  const navigate = useNavigate()
  const [toast, showToast] = useToast()
  const count = cartCount(cart)
  const stock = stockLeft(listAllOrders(), readRobot().refilledAt, new Date())
  const available = (flavor: keyof typeof stock) => Math.min(stock[flavor], stock.batter - count + (cart[flavor as keyof typeof cart] ?? 0))

  const goHome = useGoHome()

  const goConfirm = () => {
    if (count === 0) {
      showToast('한 마리 이상 골라줘요')
      return
    }
    navigate('/confirm')
  }

  const blocked = (flavor: keyof typeof cart) =>
    (cart[flavor] ?? 0) >= available(flavor)
      ? showToast('재료가 떨어졌어요. 다른 맛은 어때요?')
      : showToast((cart[flavor] ?? 0) >= MAX_PER_FLAVOR ? `한 맛은 ${MAX_PER_FLAVOR}마리까지예요` : `한 번에 ${MAX_TOTAL}마리까지예요`)

  return (
    <main className="page page--order">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="홈으로" onClick={goHome}>
          <Icon name="home" size={24} />
        </button>
        <h1 className="topbar__title">오늘의 붕어빵</h1>
      </header>

      <ul className="menu__list">
        {MENU.map((item, index) => {
          const qty = cart[item.flavor] ?? 0
          const soldOut = available(item.flavor) <= 0
          return (
            <li key={item.flavor} className={`card menu__item ${qty > 0 ? 'menu__item--on' : ''} ${soldOut ? 'menu__item--soldout' : ''}`}>
              <MenuFish name={item.name} filling={item.color} qty={qty} phase={index * 1.7} />
              <div className="menu__info">
                <div className="menu__head">
                  <h3>{item.name}{soldOut && <span className="chip chip--cancel menu__soldout">품절</span>}</h3>
                  <span className="filling-tag">
                    <i className="filling-tag__swatch" style={{ background: item.color }} aria-hidden="true" />
                    {item.fillingName}
                  </span>
                </div>
                <p className="muted">{item.description}</p>
                <div className="menu__foot">
                  <p className="menu__price">{formatWon(item.price)}</p>
                  <QtyStepper
                    label={item.name}
                    qty={qty}
                    canAdd={canAdd(cart, item.flavor) && qty < available(item.flavor)}
                    onAdd={() => add(item.flavor)}
                    onRemove={() => remove(item.flavor)}
                    onBlocked={() => blocked(item.flavor)}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <OrderPanel cart={cart} onClear={clear} onSubmit={goConfirm} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}
