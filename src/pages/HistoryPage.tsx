import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { formatWon, menuItem } from '../domain/menu'
import { effectiveStatus, isTerminal } from '../domain/order'
import { listOrders } from '../services/orderService'
import { readRobot } from '../services/robotService'
import { useAuth } from '../state/AuthContext'
import { StatusChip } from '../components/StatusChip'
import { EmptyBag } from '../components/BagStage'
import { useNow } from '../components/hooks'
import { canGiveFeedback, markPickupSeen } from '../services/feedbackService'

const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function HistoryPage() {
  const { user } = useAuth()
  const now = useNow()
  const orders = user ? listOrders(user.id) : []
  const { pauses } = readRobot()
  const pickedUpIds = orders.filter((o) => o.manualStatus === 'picked_up').map((o) => o.id).join(',')

  useEffect(() => {
    pickedUpIds.split(',').filter(Boolean).forEach((id) => markPickupSeen(id))
  }, [pickedUpIds])

  if (orders.length === 0) {
    return (
      <main className="page empty">
        <EmptyBag size={150} />
        <h1>첫 붕어빵을 주문해봐요</h1>
        <p className="muted">주문하면 여기에서 붕봇이 굽는 걸 볼 수 있어요.</p>
        <Link className="btn btn--primary" to="/">주문하러 가기</Link>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="topbar">
        <h1 className="topbar__title">주문 내역</h1>
      </header>
      <ul className="history">
        {orders.map((order) => {
          const status = effectiveStatus(order, now, pauses)
          const live = status !== 'ready' && !isTerminal(status)
          return (
            <li key={order.id}>
              <Link to={`/orders/${order.id}`} className={`card history__item ${live ? 'history__item--live' : ''}`}>
                <div className="history__top">
                  <strong>No.{String(order.number).padStart(3, '0')}</strong>
                  <StatusChip status={status} />
                </div>
                <p>{order.items.map((i) => `${menuItem(i.flavor).name} ${i.qty}`).join(' · ')}</p>
                <div className="history__bottom muted">
                  <span>{dateFormat.format(new Date(order.createdAt))}</span>
                  <span>{formatWon(order.total)}</span>
                </div>
              </Link>
              {canGiveFeedback(order) && (
                <Link to={`/orders/${order.id}?feedback=1`} className="history__rate">맛 평가 남기기</Link>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
