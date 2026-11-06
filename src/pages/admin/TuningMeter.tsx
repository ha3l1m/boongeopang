import { AXES, MIN_SAMPLES, type Recommendation } from '../../domain/feedback'

/** Plain-language reason shown under the bar. */
function reason(rec: Recommendation, labels: readonly string[]): string {
  const { step, unit } = rec.spec
  const side = rec.median === null ? '' : labels[Math.round(rec.median) + 2]
  if (rec.direction === 'down') return `"${side}" 쪽 의견이 가장 가운데에 있어서 ${step}${unit} 줄여요`
  if (rec.direction === 'up') return `"${side}" 쪽 의견이 가장 가운데에 있어서 ${step}${unit} 늘려요`
  if (rec.direction === 'limit') return `"${side}" 쪽이지만 조정 범위 끝이라 더 바꾸지 않아요`
  if (rec.direction === 'keep') return '"딱 좋아요"가 가운데라 그대로 둬요'
  return `${MIN_SAMPLES}건이 모이면 추천해요`
}

const TONE = ['far', 'near', 'ok', 'near', 'far'] as const

export function TuningMeter({ rec }: { rec: Recommendation }) {
  const axis = AXES.find((a) => a.key === rec.spec.axis)
  if (!axis) return null
  const total = rec.counts.reduce((sum, n) => sum + n, 0)
  const summary = axis.scale.map((label, i) => `${label} ${rec.counts[i]}건`).join(', ')

  return (
    <div className="tmeter">
      {total > 0 && (
        <div className="tmeter__bar" role="img" aria-label={`${rec.spec.label} 피드백 분포: ${summary}`}>
          {axis.scale.map((label, i) =>
            rec.counts[i] > 0 ? (
              <i
                key={label}
                className={`tmeter__seg tmeter__seg--${TONE[i]}`}
                style={{ flexGrow: rec.counts[i] }}
                title={`${label} ${rec.counts[i]}건`}
              />
            ) : null,
          )}
        </div>
      )}
      <div className="tmeter__foot">
        <p className={`tmeter__reason ${rec.direction === 'up' || rec.direction === 'down' ? 'tmeter__reason--on' : ''}`}>
          {reason(rec, axis.scale)}
        </p>
        <span className="tmeter__count">
          {rec.direction === 'insufficient' ? `${rec.samples}/${MIN_SAMPLES}건` : `${rec.samples}건`}
        </span>
      </div>
    </div>
  )
}
