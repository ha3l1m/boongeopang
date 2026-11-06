import type { Recommendation } from '../../domain/feedback'
import { applyParam, dismissParam } from '../../services/tuningService'
import { runSafely, type Notify } from './runSafely'
import { TuningMeter } from './TuningMeter'

type Props = Notify & { recs: readonly Recommendation[] }

export function TuningCard({ recs, ...notify }: Props) {
  const apply = (rec: Recommendation) => {
    const { label, unit } = rec.spec
    if (!window.confirm(`${label}을 ${rec.current}${unit} → ${rec.next}${unit}로 바꿀까요?`)) return
    runSafely(() => applyParam(rec.spec.id, rec.next), notify, '보정값을 적용하지 못했어요')
  }
  const dismiss = (rec: Recommendation) => runSafely(() => dismissParam(rec.spec.id), notify, '추천을 넘기지 못했어요')

  return (
    <section className="card tuning" aria-label="피드백 보정">
      <div>
        <h2>피드백 보정</h2>
        <p className="muted">고객 피드백의 가중 중앙값이에요. 최근일수록, 단골일수록 크게 반영해요.</p>
      </div>
      <ul className="tuning__list">
        {recs.map((rec) => {
          const actionable = rec.direction === 'up' || rec.direction === 'down'
          const { label, unit } = rec.spec
          return (
            <li key={rec.spec.id} className={`tuning__row ${actionable ? 'tuning__row--on' : ''}`}>
              <div className="tuning__main">
                <span className="tuning__label">{label}</span>
                <strong className="tuning__value">
                  {actionable ? `${rec.current}${unit} → ${rec.next}${unit}` : `${rec.current}${unit}`}
                </strong>
              </div>
              {actionable && (
                <div className="tuning__actions">
                  <button type="button" className="btn btn--ghost" aria-label={`${label} 무시`} onClick={() => dismiss(rec)}>무시</button>
                  <button type="button" className="btn btn--primary" aria-label={`${label} 적용`} onClick={() => apply(rec)}>적용</button>
                </div>
              )}
              <TuningMeter rec={rec} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
