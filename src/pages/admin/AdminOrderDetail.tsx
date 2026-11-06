import { formatWon, menuItem } from '../../domain/menu'
import { BAKE_STEPS, STEP_LABEL, isTerminal, type AdminStatus, type Order } from '../../domain/order'
import { StatusChip } from '../../components/StatusChip'
import { fishCount, orderNo } from './orderFormat'

type Props = {
  row: { order: Order; status: AdminStatus } | null
  onChange: (order: Order, status: AdminStatus) => void
  onClose: () => void
}

const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', second: '2-digit' })

function stepState(status: AdminStatus, index: number): 'done' | 'now' | 'todo' {
  if (status === 'picked_up') return 'done'
  if (status === 'cancelled') return 'todo'
  const current = BAKE_STEPS.indexOf(status)
  if (index < current) return 'done'
  return index === current ? 'now' : 'todo'
}

export function AdminOrderDetail({ row, onChange, onClose }: Props) {
  if (!row) {
    return (
      <aside className="card admin-detail admin-detail--empty" aria-label="주문 상세">
        <p className="muted">주문을 누르면 여기서 자세히 볼 수 있어요</p>
      </aside>
    )
  }

  const { order, status } = row
  const done = isTerminal(status)

  return (
    <>
      <div className="admin-detail__backdrop" aria-hidden="true" onClick={onClose} />
      <aside className="card admin-detail" aria-label="주문 상세">
        <header className="admin-detail__head">
          <div>
            <h2>{orderNo(order)}</h2>
            <p className="muted">주문시간 {timeFormat.format(new Date(order.createdAt))}</p>
          </div>
          <StatusChip status={status} />
          <button type="button" className="btn btn--ghost admin-detail__close" onClick={onClose}>닫기</button>
        </header>

        {order.memo && <p className="admin-detail__memo">요청: {order.memo}</p>}

        {!done && (
          <ol className="admin-detail__steps" aria-label="진행 단계">
            {BAKE_STEPS.map((step, i) => (
              <li key={step} className={`admin-detail__stepitem admin-detail__stepitem--${stepState(status, i)}`}>
                {STEP_LABEL[step]}
              </li>
            ))}
          </ol>
        )}

        <table className="admin-detail__table">
          <thead>
            <tr><th scope="col">메뉴</th><th scope="col">수량</th><th scope="col">금액</th></tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.flavor}>
                <td>{menuItem(item.flavor).name}</td>
                <td>{item.qty}</td>
                <td>{formatWon(item.qty * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">주문금액</th><td>{fishCount(order)}</td><td>{formatWon(order.total)}</td></tr>
          </tfoot>
        </table>

        {!done && (
          <div className="admin-detail__actions">
            {status === 'ready' ? (
              <button type="button" className="btn btn--primary" onClick={() => onChange(order, 'picked_up')}>픽업 완료</button>
            ) : (
              <button type="button" className="btn btn--ghost admin-detail__cancel" onClick={() => onChange(order, 'cancelled')}>
                주문 취소
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
