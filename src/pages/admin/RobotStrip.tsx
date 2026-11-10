import { ALERT_LABEL, currentJob, type RobotState } from '../../domain/robot'
import { menuItem } from '../../domain/menu'
import { isTerminal, undelivered, type AdminStatus, type Order } from '../../domain/order'
import { restartOrder, setOrderStatus } from '../../services/orderService'
import { remoteMode, resendOrder } from '../../services/remoteSync'
import { emergencyStop, resolveAlert, resumeRobot } from '../../services/robotService'
import { runSafely, type Notify } from './runSafely'

type Props = Notify & {
  robot: RobotState
  rows: readonly { order: Order; status: AdminStatus }[]
}

type Resolution = 'retry' | 'continue' | 'cancel'

const no = (n: number) => `No.${String(n).padStart(3, '0')}`
const FAIL = '붕봇 제어에 실패했어요'

function stateLabel(robot: RobotState, busy: boolean): { text: string; tone: string } {
  if (robot.estop) return { text: '비상 정지', tone: 'stop' }
  if (robot.alert) return { text: '이상 발생', tone: 'alert' }
  return busy ? { text: '작업 중', tone: 'run' } : { text: '대기', tone: 'idle' }
}

export function RobotStrip({ robot, rows, ...notify }: Props) {
  const { current, waiting } = currentJob(rows)
  const state = stateLabel(robot, current !== null)
  const alertOrder = robot.alert ? rows.find((r) => r.order.id === robot.alert?.orderId)?.order : undefined
  const run = (action: () => void) => runSafely(action, notify, FAIL)
  const remote = remoteMode()
  const undeliveredRows = rows.filter((r) => !isTerminal(r.status) && undelivered(r.order).length > 0)

  const resend = async (id: string) => {
    try {
      await resendOrder(id)
      notify.onChanged()
    } catch (e) {
      notify.onError(e instanceof Error ? e.message : FAIL)
    }
  }

  const stop = () => {
    if (window.confirm('붕봇을 비상 정지할까요? 모든 주문 진행이 멈춰요.')) run(() => emergencyStop())
  }

  const resolve = (how: Resolution) => {
    const orderId = robot.alert?.orderId
    if (!orderId) return
    if (how === 'cancel' && !window.confirm('이 주문을 취소할까요? 되돌릴 수 없어요.')) return
    run(() => {
      if (how === 'retry') restartOrder(orderId)
      if (how === 'cancel') setOrderStatus(orderId, 'cancelled')
      resolveAlert()
    })
  }

  return (
    <section className="card strip" aria-label="붕봇 상태">
      <div className="strip__row">
        <span className={`robot__state robot__state--${state.tone}`} role="status">
          <i aria-hidden="true" />
          {state.text}
        </span>
        <p className="strip__job">
          {current ? <><strong>{no(current.number)}</strong> 굽는 중</> : '굽는 주문 없음'}
          <span className="muted"> · 대기 {waiting}건</span>
        </p>
        {remote ? (
          // No ROS stop service exists yet: a button here would claim a stop the robot never gets.
          <p className="strip__note muted">비상 정지는 티치펜던트로</p>
        ) : robot.estop ? (
          <button type="button" className="btn btn--primary strip__btn" onClick={() => run(() => resumeRobot())}>재개</button>
        ) : (
          <button type="button" className="btn robot__estop strip__btn" onClick={stop}>비상 정지</button>
        )}
      </div>

      {undeliveredRows.map(({ order }) => (
        <div key={order.id} className="robot__alert" role="alert">
          <p>
            <strong>{no(order.number)}</strong> {undelivered(order).map((i) => `${menuItem(i.flavor).name} ${i.qty}`).join(', ')} 전달 실패
            {order.robot?.failed && <span className="muted"> · {order.robot.failed}</span>}
          </p>
          <div className="robot__alert-actions">
            <button type="button" className="btn btn--primary" onClick={() => void resend(order.id)}>다시 보내기</button>
          </div>
        </div>
      ))}

      {robot.alert && (
        <div className="robot__alert" role="alert">
          <p>
            <strong>{alertOrder ? no(alertOrder.number) : '주문'}</strong> {ALERT_LABEL[robot.alert.kind]}
          </p>
          <div className="robot__alert-actions">
            <button type="button" className="btn btn--primary" onClick={() => resolve('retry')}>다시 굽기</button>
            <button type="button" className="btn btn--ghost" onClick={() => resolve('continue')}>그대로 진행</button>
            <button type="button" className="btn btn--ghost robot__danger" onClick={() => resolve('cancel')}>주문 취소</button>
          </div>
        </div>
      )}
    </section>
  )
}
