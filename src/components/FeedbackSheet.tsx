import { useState, type FormEvent } from 'react'
import { AXES, SCORES, type FeedbackAxis, type FeedbackInput, type Score } from '../domain/feedback'
import { menuItem, type Flavor } from '../domain/menu'

type Props = {
  flavors: readonly Flavor[]
  onSubmit: (input: FeedbackInput) => void
  onSkip: () => void
  error: string | null
}

type Row = { id: string; label: string; scale: readonly string[]; color?: string; axis: FeedbackAxis; flavor?: Flavor }

function axis(key: FeedbackAxis) {
  const found = AXES.find((a) => a.key === key)
  if (!found) throw new Error(`Unknown axis: ${key}`)
  return found
}

/** 굽기 → one filling row per flavor (so mixed orders say which flavor) → 바삭함. */
function rowsFor(flavors: readonly Flavor[]): Row[] {
  const { scale: fillingScale } = axis('filling')
  const filling = flavors.map((flavor): Row => {
    const item = menuItem(flavor)
    return { id: `filling.${flavor}`, label: `${item.fillingName} 양`, scale: fillingScale, color: item.color, axis: 'filling', flavor }
  })
  const single = (key: FeedbackAxis): Row => ({ id: key, label: axis(key).label, scale: axis(key).scale, axis: key })
  return [single('doneness'), ...filling, single('crisp')]
}

function toInput(rows: readonly Row[], answers: Readonly<Record<string, Score>>): FeedbackInput {
  const answered = rows.filter((r) => answers[r.id] !== undefined)
  const filling = Object.fromEntries(answered.filter((r) => r.flavor).map((r) => [r.flavor, answers[r.id]]))
  const pick = (key: 'doneness' | 'crisp') => answers[key]
  return { doneness: pick('doneness'), crisp: pick('crisp'), filling }
}

export function FeedbackSheet({ flavors, onSubmit, onSkip, error }: Props) {
  const [answers, setAnswers] = useState<Record<string, Score>>({})
  const rows = rowsFor(flavors)
  const answered = Object.keys(answers).length > 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (answered) onSubmit(toInput(rows, answers))
  }

  return (
    <div className="sheet-backdrop">
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-title" onSubmit={submit}>
        <i className="sheet__grip" aria-hidden="true" />
        <h2 id="feedback-title" className="sheet__title">붕어빵 어땠어요?</h2>
        <p className="sheet__sub">알려 주시면 붕봇이 다음 붕어빵을 더 맛있게 구워요</p>
        {rows.map((row) => (
          <fieldset key={row.id} className="sheet__axis" role="radiogroup" aria-label={row.label}>
            <legend className="sheet__legend">
              {row.color && <i className="sheet__dot" style={{ background: row.color }} aria-hidden="true" />}
              {row.label}
            </legend>
            <div className="sheet__scale">
              {SCORES.map((score, i) => (
                <label key={score} className={`sheet__opt ${score === 0 ? 'sheet__opt--mid' : ''}`}>
                  <input
                    type="radio"
                    name={row.id}
                    value={score}
                    checked={answers[row.id] === score}
                    onChange={() => setAnswers((a) => ({ ...a, [row.id]: score }))}
                  />
                  <span>{row.scale[i]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={onSkip}>나중에</button>
          <button type="submit" className="btn btn--primary" disabled={!answered}>보내기</button>
        </div>
      </form>
    </div>
  )
}
