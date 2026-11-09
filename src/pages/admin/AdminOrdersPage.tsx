import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { effectiveStatus, isTerminal, type AdminStatus, type Order } from '../../domain/order'
import { listAllOrders, setOrderStatus, summarizeDay } from '../../services/orderService'
import { adminLogout } from '../../services/adminAuth'
import { readRobot } from '../../services/robotService'
import { remoteMode } from '../../services/remoteSync'
import { INGREDIENTS, LOW_STOCK_RATIO, currentJob, isPaused, stockLeft } from '../../domain/robot'
import { useNow } from '../../components/hooks'
import { AdminNav, type Tab } from './AdminNav'
import { OrdersBoard } from './OrdersBoard'
import { RobotStrip } from './RobotStrip'
import { RobotDemo } from './RobotDemo'
import { StockBars } from './StockBars'
import { TodaySummary } from './TodaySummary'
import { TuningCard } from './TuningCard'
import { FeedbackList } from './FeedbackList'
import { listFeedback } from '../../services/feedbackService'
import { recommendations } from '../../services/tuningService'
import { orderNo } from './orderFormat'

const CONFIRM_TEXT: Partial<Record<AdminStatus, string>> = {
  picked_up: '픽업 완료로 처리할까요?',
  cancelled: '이 주문을 취소할까요? 되돌릴 수 없어요.',
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit',
})

export function AdminOrdersPage() {
  const navigate = useNavigate()
  const now = useNow()
  const [tab, setTab] = useState<Tab>('today')
  const [, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const robot = readRobot()
  const all = listAllOrders()
  const orders = all.map((order) => ({ order, status: effectiveStatus(order, now, robot.pauses) }))
  const stock = stockLeft(all, robot.refilledAt, now)
  const changed = () => {
    setError(null)
    setVersion((v) => v + 1)
  }
  const summary = summarizeDay(orders.map((o) => o.order), now)
  const notify = { onChanged: changed, onError: setError }
  const needsAttention = Boolean(robot.alert) || INGREDIENTS.some(({ key, capacity }) => stock[key] / capacity <= LOW_STOCK_RATIO)
  const recs = recommendations(now)
  const tuningPending = recs.some((r) => r.direction === 'up' || r.direction === 'down')
  const liveCount = orders.filter((o) => !isTerminal(o.status)).length

  const change = (order: Order, status: AdminStatus) => {
    // There is no cancel service yet, so the robot keeps baking what it already accepted.
    const question = status === 'cancelled' && order.robot ? '이 주문을 취소할까요? 이미 붕봇에 전달된 몫은 계속 구워져요.' : CONFIRM_TEXT[status]
    if (question && !window.confirm(`${orderNo(order)} — ${question}`)) return
    try {
      setOrderStatus(order.id, status)
      changed()
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태를 바꾸지 못했어요')
    }
  }

  const logout = () => {
    adminLogout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <AdminNav tab={tab} onTab={setTab} liveCount={liveCount} dots={{ today: needsAttention, feedback: tuningPending }} />
      <main className={`admin ${tab === 'live' || tab === 'done' ? 'admin--fill' : ''}`}>
        <header className="admin__header">
          {/* the side rail logo already names the page; keep the heading for screen readers only */}
          <h1 className="admin__title">붕붕 주문판</h1>
          <span className="admin__clock muted">{dateFormat.format(now)}</span>
          <span className={`admin__open ${robot.estop ? 'admin__open--off' : ''}`}>
            <i aria-hidden="true" />
            {robot.estop ? '일시 정지' : '영업 중'}
          </span>
          <button type="button" className="btn btn--ghost admin__logout" onClick={logout}>로그아웃</button>
        </header>

        {/* 붕봇 상태는 처리 중 탭에서만, 단 이상·비상 정지 중엔 어느 탭에서든 보이게 */}
        {(tab === 'live' || robot.estop || robot.alert) && <RobotStrip robot={robot} rows={orders} {...notify} />}

        {error && <p role="alert" className="error">{error}</p>}

        <div id="admin-tabpanel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className={`admin__panel ${tab === 'feedback' ? 'admin__panel--split' : ''}`}>
          {tab === 'today' ? (
            <>
              <TodaySummary summary={summary} />
              <div className="admin__control">
                <StockBars stock={stock} {...notify} />
                {!remoteMode() && <RobotDemo robot={robot} current={currentJob(orders).current} {...notify} />}
              </div>
            </>
          ) : tab === 'feedback' ? (
            <>
              <TuningCard recs={recs} {...notify} />
              <FeedbackList feedback={listFeedback()} />
            </>
          ) : (
            <OrdersBoard
              key={tab}
              group={tab}
              rows={orders}
              now={now}
              pauses={robot.pauses}
              paused={isPaused(robot)}
              onChange={change}
            />
          )}
        </div>
      </main>
    </div>
  )
}
