import { useState } from 'react'
import { ALERT_DETECTABLE, ALERT_LABEL, type RobotAlertKind, type RobotState } from '../../domain/robot'
import type { Order } from '../../domain/order'
import { raiseAlert } from '../../services/robotService'
import { runSafely, type Notify } from './runSafely'

type Props = Notify & { robot: RobotState; current: Order | null }

const ALERT_KINDS = Object.keys(ALERT_LABEL) as RobotAlertKind[]
const FIRST_DETECTABLE = ALERT_KINDS.find((k) => ALERT_DETECTABLE[k]) ?? 'gripper'

export function RobotDemo({ robot, current, ...notify }: Props) {
  const [kind, setKind] = useState<RobotAlertKind>(FIRST_DETECTABLE)
  const raise = () => current && runSafely(() => raiseAlert(kind, current.id), notify, '이상을 만들지 못했어요')

  return (
    <section className="card robot" aria-label="이상 발생 데모">
      <h2>이상 발생 시키기 (데모)</h2>
      <p className="muted">로봇 연동 전이라 지금 굽는 주문에 이상 신호를 직접 보내요. 반죽 과다·속 누락은 무게 센서가 있어야 감지할 수 있어 꺼 두었어요.</p>
      <div className="robot__demo">
        <label htmlFor="robot-demo" className="sr-only">이상 종류</label>
        <select id="robot-demo" value={kind} onChange={(e) => setKind(e.target.value as RobotAlertKind)}>
          {ALERT_KINDS.map((k) => (
            <option key={k} value={k} disabled={!ALERT_DETECTABLE[k]}>
              {ALERT_LABEL[k]}{ALERT_DETECTABLE[k] ? '' : ' (센서 필요)'}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--ghost" disabled={!current || Boolean(robot.alert)} onClick={raise}>
          발생
        </button>
      </div>
    </section>
  )
}
