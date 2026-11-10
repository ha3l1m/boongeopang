import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { formatWon, menuItem } from '../domain/menu'
import { cartTotal, toOrderItems } from '../domain/order'
import { placeOrder } from '../services/orderService'
import { useAuth } from '../state/AuthContext'
import { useCart } from '../state/CartContext'
import { BagStage } from '../components/BagStage'
import { Icon } from '../components/Icon'

const SUBMIT_DELAY_MS = 1200

function submitError(e: unknown): string {
  if (!(e instanceof Error)) return '주문이 안 들어갔어요. 다시 시도해 줘요'
  if (e.message.startsWith('재료')) return `${e.message}. 메뉴를 다시 골라 줘요`
  return e.message.startsWith('붕봇') ? e.message : '주문이 안 들어갔어요. 다시 시도해 줘요'
}

export function ConfirmPage() {
  const { user } = useAuth()
  const { cart, memo, setMemo, clear } = useCart()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const items = toOrderItems(cart)
  const fillings = items.flatMap((item) => Array.from({ length: item.qty }, () => menuItem(item.flavor).color))

  if (!user) return <Navigate to="/login" replace />
  if (items.length === 0 && !submitting) return <Navigate to="/" replace />

  const submit = () => {
    setSubmitting(true)
    setError(null)
    setTimeout(async () => {
      try {
        const order = await placeOrder(user.id, cart, memo)
        clear()
        navigate(`/orders/${order.id}`, { replace: true, state: { fresh: true } })
      } catch (e) {
        setSubmitting(false)
        setError(submitError(e))
      }
    }, SUBMIT_DELAY_MS)
  }

  return (
    <main className="page page--actions">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={() => navigate(-1)} disabled={submitting}>
          <Icon name="back" size={22} />
        </button>
        <h1 className="topbar__title">주문 확인</h1>
      </header>

      <div className="halo"><BagStage fillings={fillings} closing={submitting} height={260} /></div>

      <section className="receipt" aria-label="주문 요약">
        <ul>
          {items.map((item) => (
            <li key={item.flavor}>
              <span>
                <i className="dot" style={{ background: menuItem(item.flavor).color }} aria-hidden="true" />
                {menuItem(item.flavor).name} × {item.qty}
              </span>
              <span>{formatWon(item.qty * item.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <div className="receipt__total">
          <span>합계</span>
          <strong>{formatWon(cartTotal(cart))}</strong>
        </div>
      </section>

      <label className="card confirm__field">
        <span className="confirm__head">
          <span className="muted">요청사항 (선택)</span>
          <span className="muted confirm__count">{memo.length}/50</span>
        </span>
        <textarea
          value={memo}
          maxLength={50}
          rows={2}
          placeholder="바삭하게 구워 주세요"
          onChange={(e) => setMemo(e.target.value)}
          disabled={submitting}
        />
        <span className="confirm__note">붕봇이 굽다 보니 요청사항이 꼭 맞게 반영되지 않을 수 있어요. 최대한 맞춰 볼게요!</span>
      </label>

      {error && <p role="alert" className="error">{error}</p>}

      <div className="bottom-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/')} disabled={submitting}>
          수정하기
        </button>
        <button type="button" className="btn btn--primary" onClick={submit} aria-busy={submitting} disabled={submitting}>
          {submitting ? '붕봇이 받는 중…' : '주문하기'}
        </button>
      </div>
    </main>
  )
}
