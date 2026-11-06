import { BAKE_STEPS, STEP_LABEL, type OrderStatus } from '../domain/order'
import { Icon } from './Icon'

/** Short names that fit under a dot on a phone-width horizontal track. */
const SHORT_LABEL: Record<OrderStatus, string> = {
  received: '접수',
  batter: '반죽',
  filling: '속 넣기',
  baking: '굽기',
  packed: '포장',
  ready: '픽업',
}

type Props = { status: OrderStatus; onSelect?: (step: OrderStatus) => void }

export function ProgressSteps({ status, onSelect }: Props) {
  const current = BAKE_STEPS.indexOf(status)
  return (
    <ol className="progress" aria-label="붕어빵 진행 단계">
      {BAKE_STEPS.map((step, i) => {
        const state = i < current || status === 'ready' ? 'done' : i === current ? 'current' : 'todo'
        const content = (
          <>
            <span className="progress__dot" aria-hidden="true">{state === 'done' ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
            <span aria-hidden="true">{SHORT_LABEL[step]}</span>
            <span className="sr-only">{STEP_LABEL[step]}</span>
          </>
        )
        return (
          <li key={step} data-state={state} aria-current={i === current ? 'step' : undefined} title={STEP_LABEL[step]}>
            {onSelect ? (
              <button type="button" className="progress__btn" onClick={() => onSelect(step)} aria-label={`${STEP_LABEL[step]} 애니메이션 보기`}>
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ol>
  )
}
