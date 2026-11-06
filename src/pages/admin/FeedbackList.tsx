import { AXES, type Feedback, type FeedbackAxis, type Score } from '../../domain/feedback'
import { menuItem, type Flavor } from '../../domain/menu'

const RECENT = 20

const timeFormat = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** 굽기·바삭함 are one answer per order; 앙금 is per flavor (legacy feedback had one answer, only clear for one-flavor orders). */
function scoreOf(f: Feedback, axis: FeedbackAxis, flavor: Flavor): Score | undefined {
  if (axis !== 'filling') return f.scores[axis]
  if (f.fillingByFlavor) return f.fillingByFlavor[flavor]
  return f.flavors.length === 1 ? f.scores.filling : undefined
}

type Row = { f: Feedback; flavor: Flavor; first: boolean; last: boolean }

export function FeedbackList({ feedback }: { feedback: readonly Feedback[] }) {
  const recent = [...feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT)
  const rows: Row[] = recent.flatMap((f) =>
    f.flavors.map((flavor, i) => ({ f, flavor, first: i === 0, last: i === f.flavors.length - 1 })),
  )

  return (
    <section className="card feedback" aria-label="최근 피드백">
      <h2>최근 피드백 <span className="muted">{feedback.length}건</span></h2>
      {rows.length === 0 ? (
        <p className="muted">아직 받은 피드백이 없어요</p>
      ) : (
        <table className="feedback__table">
          <thead>
            <tr>
              <th scope="col">맛</th>
              {AXES.map((a) => <th key={a.key} scope="col">{a.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, flavor, first, last }) => (
              <tr key={`${f.id}-${flavor}`} className={last ? 'feedback__last' : ''}>
                <th scope="row">
                  <strong>{menuItem(flavor).name}</strong>
                  {first && <span className="muted">{timeFormat.format(new Date(f.createdAt))}</span>}
                </th>
                {AXES.map((a) => {
                  const score = scoreOf(f, a.key, flavor)
                  if (score === undefined) return <td key={a.key} className="feedback__none">—</td>
                  return (
                    <td key={a.key}>
                      <span className={`feedback__score ${score === 0 ? 'feedback__score--ok' : ''}`}>{a.scale[score + 2]}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
