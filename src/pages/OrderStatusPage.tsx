import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { formatWon, menuItem } from '../domain/menu'
import { STEP_LABEL, effectiveStatus, type AdminStatus, type OrderStatus } from '../domain/order'
import { isPaused } from '../domain/robot'
import { readRobot } from '../services/robotService'
import { getOrder } from '../services/orderService'
import { useAuth } from '../state/AuthContext'
import { BongbotStage } from '../components/BongbotStage'
import { GrandpaScene } from './GrandpaScene'
import { ProgressSteps } from '../components/ProgressSteps'
import { useNow, useToast } from '../components/hooks'
import { FeedbackSheet } from '../components/FeedbackSheet'
import { canGiveFeedback, markPickupSeen, shouldAskFeedback, skipFeedback, submitFeedback } from '../services/feedbackService'
import type { FeedbackInput } from '../domain/feedback'
import { Icon } from '../components/Icon'

const HALMAE_LINE = {
  received: '잠시만 기다려 주세요. 로봇 가동 중입니다',
  batter: '반죽을 붓는 중입니다',
  filling: '요청하신 맛으로 꽉꽉 채우는 중입니다',
  baking: '노릇노릇 바삭하게 굽고 있습니다',
  packed: '따끈한 붕어빵 완성! 봉투에 담고 있습니다',
  ready: '따끈할 때 가져가세요!',
  picked_up: '맛있게 드세요. 또 찾아 주세요!',
  cancelled: '죄송합니다. 이 주문은 취소되었습니다',
} as const satisfies Record<AdminStatus, string>

function sceneStep(status: AdminStatus): OrderStatus {
  if (status === 'picked_up') return 'ready'
  if (status === 'cancelled') return 'received'
  return status
}

/** A short hint beside grandma's line; no countdown, so only states that need a word get one. */
function hintText(status: AdminStatus, manual: boolean, paused: boolean): string {
  if (status === 'cancelled') return '궁금한 건 매장에 물어봐 주세요'
  if (status === 'picked_up') return '픽업이 끝난 주문입니다'
  if (status === 'ready') return '번호표를 보여 주세요'
  if (paused && !manual) return '붕봇이 잠깐 점검 중입니다'
  return manual ? '할매가 직접 챙기며 굽는 중입니다' : ''
}

export function OrderStatusPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const now = useNow()
  const [preview, setPreview] = useState<{ step: OrderStatus; cue: number } | null>(null)
  const [, setFeedbackVersion] = useState(0)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [toast, showToast] = useToast()
  const [searchParams] = useSearchParams()
  const [rateOpen, setRateOpen] = useState(() => searchParams.get('feedback') === '1')
  const order = user ? getOrder(user.id, id) : null
  const pickedUp = order?.manualStatus === 'picked_up'

  useEffect(() => {
    if (pickedUp) markPickupSeen(id)
  }, [pickedUp, id])

  if (!order) {
    return (
      <main className="page page--plain empty">
        <h1>주문을 찾을 수 없어요</h1>
        <Link className="btn btn--primary" to="/orders">주문 내역으로</Link>
      </main>
    )
  }

  const robot = readRobot()
  const status = effectiveStatus(order, now, robot.pauses)
  const cancelled = status === 'cancelled'
  const shown = preview?.step ?? sceneStep(status)
  const showStep = (step: OrderStatus) => setPreview((p) => ({ step, cue: (p?.cue ?? 0) + 1 }))
  const hint = hintText(status, Boolean(order.manualStatus), isPaused(robot))
  const pickup = shown === 'ready' && !cancelled
  const canRate = canGiveFeedback(order)
  const sheetOpen = canRate && (rateOpen || shouldAskFeedback(order, now))
  const closeFeedback = (action: () => void, message?: string) => {
    try {
      action()
      setFeedbackError(null)
      setRateOpen(false)
      setFeedbackVersion((v) => v + 1)
      if (message) showToast(message)
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : '피드백을 보내지 못했어요')
    }
  }
  const sendFeedback = (input: FeedbackInput) =>
    closeFeedback(() => submitFeedback(order, input), '고마워요! 꼭 반영할게요')

  return (
    <main className="page page--actions">
      <header className="topbar">
        <Link className="icon-btn" aria-label="홈으로" to="/">
          <Icon name="home" size={24} />
        </Link>
        <h1 className="topbar__title">내 붕어빵</h1>
      </header>

      <section className="ticket" aria-label="번호표와 주문 내역">
        <div className="ticket__top">
          <div className="ticket__id">
            <span className="ticket__label">번호표</span>
            <strong className="ticket__no">No.{String(order.number).padStart(3, '0')}</strong>
          </div>
          <strong className="ticket__total">{formatWon(order.total)}</strong>
        </div>
        <ul className="ticket__items" aria-label="주문한 붕어빵">
          {order.items.map((i) => (
            <li key={i.flavor} className="orderpanel__item">
              <i className="filling-tag__swatch" style={{ background: menuItem(i.flavor).color }} aria-hidden="true" />
              {menuItem(i.flavor).name}
              <strong>{i.qty}</strong>
            </li>
          ))}
        </ul>
        {order.memo && <p className="muted ticket__memo">요청: {order.memo}</p>}
      </section>

      {!cancelled && (
        <section className="status__track" aria-label="진행 단계">
          <ProgressSteps status={shown} onSelect={showStep} />
        </section>
      )}
      <div className={`halo status__scene ${pickup ? 'status__scene--pickup' : ''}`}>
        {pickup ? (
          <figure className="stage status__grandpa" style={{ height: 350 }}>
            <figcaption className="sr-only">할아버지가 따끈한 붕어빵 봉투를 들고 신나게 걸어가요</figcaption>
            <GrandpaScene />
          </figure>
        ) : (
          <BongbotStage mode={cancelled && !preview ? 'idle' : shown} height={400} cue={preview?.cue ?? 0} />
        )}
        <p className={`status__subtitle ${pickup ? 'status__subtitle--top' : ''}`} aria-live="polite">
          <strong>{HALMAE_LINE[preview ? preview.step : status]}</strong>
          {!preview && hint && <span>{hint}</span>}
        </p>
      </div>

      {preview && (
        <p className="status__preview">
          <span>미리보기 · {STEP_LABEL[preview.step]}</span>
          <button type="button" className="chip" onClick={() => setPreview(null)}>
            실시간으로 돌아가기
          </button>
        </p>
      )}

      {canRate && !sheetOpen && (
        <section className="card rate-cta" aria-label="맛 평가">
          <p>드셔 보고 맛을 알려 주세요<span>붕봇이 다음엔 더 맛있게 구워요</span></p>
          <button type="button" className="btn btn--primary" onClick={() => setRateOpen(true)}>맛 평가하기</button>
        </section>
      )}
      {sheetOpen && (
        <FeedbackSheet flavors={order.items.map((i) => i.flavor)} onSubmit={sendFeedback} onSkip={() => closeFeedback(() => skipFeedback(order.id))} error={feedbackError} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  )
}
