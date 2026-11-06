import { formatWon } from '../../domain/menu'
import { BAKE_STEPS, STEP_LABEL, isTerminal, secondsLeft, timerStartOf, type AdminStatus, type Order } from '../../domain/order'
import type { Pause } from '../../domain/robot'
import { StatusChip } from '../../components/StatusChip'
import { clockFormat, fishCount, formatEta, itemLine, orderNo } from './orderFormat'

type Props = {
  order: Order
  status: AdminStatus
  now: Date
  pauses: readonly Pause[]
  paused: boolean
  selected: boolean
  onSelect: (order: Order) => void
  onChange: (order: Order, status: AdminStatus) => void
}

const DONE_TEXT: Record<'picked_up' | 'cancelled', string> = {
  picked_up: '손님이 가져갔어요',
  cancelled: '취소된 주문이에요',
}

function progressText(status: AdminStatus, paused: boolean): string {
  if (isTerminal(status)) return DONE_TEXT[status]
  if (status === 'ready') return '포장 완료! 손님을 기다려요'
  if (paused) return '붕봇 점검 중이라 잠깐 멈췄어요'
  const step = BAKE_STEPS.indexOf(status)
  return `${STEP_LABEL[status]} · ${step}/${BAKE_STEPS.length - 1}단계`
}

export function AdminOrderCard({ order, status, now, pauses, paused, selected, onSelect, onChange }: Props) {
  const done = isTerminal(status)
  const ready = status === 'ready'
  const baking = !done && !ready
  const tone = done ? 'done' : ready ? 'ready' : paused ? 'paused' : 'live'

  return (
    <li className={`card admin-order ${done ? 'admin-order--done' : ''} ${selected ? 'admin-order--on' : ''}`}>
      <button
        type="button"
        className="admin-order__select"
        aria-label={`${orderNo(order)} 주문 보기`}
        aria-pressed={selected}
        onClick={() => onSelect(order)}
      >
        <span className="admin-order__head">
          <strong className="admin-order__no">{orderNo(order)}</strong>
          <span className="admin-order__time">{clockFormat.format(new Date(order.createdAt))}</span>
        </span>
        <span className="admin-order__line">
          <b>[{fishCount(order)}마리] {formatWon(order.total)}</b> {itemLine(order)}
        </span>
        <span className="admin-order__progress">
          <span className={`admin-order__step admin-order__step--${tone}`}>
            <i aria-hidden="true" />
            {progressText(status, paused)}
          </span>
          {baking && (
            <span className="admin-order__eta">
              <small>픽업까지</small>
              <b>{formatEta(secondsLeft(timerStartOf(order), now, pauses))}</b>
            </span>
          )}
        </span>
      </button>
      <div className="admin-order__side">
        {ready ? (
          <button type="button" className="btn btn--primary admin-order__pickup" onClick={() => onChange(order, 'picked_up')}>
            픽업 완료
          </button>
        ) : (
          <StatusChip status={status} />
        )}
      </div>
    </li>
  )
}
