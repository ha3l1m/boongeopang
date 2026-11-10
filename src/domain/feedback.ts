import type { Flavor } from './menu'
import { clampParam, type ParamSpec, type Tuning } from './tuning'

export type FeedbackAxis = 'doneness' | 'filling' | 'crisp'

/** Bipolar: 0 = just right, + = too much, - = too little. */
export type Score = -2 | -1 | 0 | 1 | 2

export const SCORES: readonly Score[] = [-2, -1, 0, 1, 2]

export const AXES: readonly { key: FeedbackAxis; label: string; scale: readonly [string, string, string, string, string] }[] = [
  { key: 'doneness', label: '굽기 정도', scale: ['덜 익음', '조금 덜', '딱 좋아요', '조금 더', '탔어요'] },
  { key: 'filling', label: '앙금 양', scale: ['너무 적음', '조금 적음', '딱 좋아요', '조금 많음', '너무 많음'] },
  { key: 'crisp', label: '바삭함', scale: ['눅눅해요', '조금 눅눅', '딱 좋아요', '조금 딱딱', '너무 딱딱'] },
]

export type Feedback = {
  id: string
  orderId: string
  userId: string
  flavors: Flavor[]
  /** doneness/crisp; `filling` only in legacy answers saved before per-flavor filling. */
  scores: Partial<Record<FeedbackAxis, Score>>
  fillingByFlavor?: Partial<Record<Flavor, Score>>
  createdAt: string
}

export function isFeedback(value: unknown): value is Feedback {
  const v = value as Feedback
  return (
    typeof v === 'object' && v !== null &&
    typeof v.orderId === 'string' && typeof v.userId === 'string' && typeof v.createdAt === 'string' &&
    Array.isArray(v.flavors) && typeof v.scores === 'object' && v.scores !== null
  )
}

/** What the sheet sends: filling is asked once per flavor in the order. */
export type FeedbackInput = { doneness?: Score; crisp?: Score; filling?: Partial<Record<Flavor, Score>> }

export const MIN_SAMPLES = 5
/** Ask automatically only after the customer had time to eat. */
export const FEEDBACK_DELAY_MS = 3 * 60 * 1000
export const HALF_LIFE_DAYS = 3
const KEEP_BAND = 0.5
const DAY_MS = 24 * 60 * 60 * 1000

type Weighted = { value: number; weight: number }

export function weightedMedian(entries: readonly Weighted[]): number | null {
  const sorted = entries.filter((e) => e.weight > 0).sort((a, b) => a.value - b.value)
  const total = sorted.reduce((sum, e) => sum + e.weight, 0)
  if (total === 0) return null
  let cumulative = 0
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i].weight
    if (Math.abs(cumulative - total / 2) < 1e-9 && i + 1 < sorted.length) return (sorted[i].value + sorted[i + 1].value) / 2
    if (cumulative > total / 2) return sorted[i].value
  }
  return sorted[sorted.length - 1].value
}

/** Recency halves every HALF_LIFE_DAYS; regulars get +25% per extra order, capped at 2x. */
export function feedbackWeight(createdAt: string, now: Date, userOrderCount: number): number {
  const ageDays = Math.max(now.getTime() - Date.parse(createdAt), 0) / DAY_MS
  const recency = 0.5 ** (ageDays / HALF_LIFE_DAYS)
  const loyalty = 1 + 0.25 * Math.min(Math.max(userOrderCount - 1, 0), 4)
  return recency * loyalty
}

export function scoreFor(feedback: Feedback, spec: ParamSpec): Score | undefined {
  if (spec.axis !== 'filling') return feedback.scores[spec.axis]
  if (!spec.flavor) return undefined
  const perFlavor = feedback.fillingByFlavor?.[spec.flavor]
  if (perFlavor !== undefined) return perFlavor
  // a legacy single filling answer is only unambiguous for a one-flavor order
  const only = feedback.flavors.length === 1 && feedback.flavors[0] === spec.flavor
  return only ? feedback.scores.filling : undefined
}

export type Direction = 'insufficient' | 'keep' | 'up' | 'down' | 'limit'

/** counts: how many answers landed on each score, index 0 = -2 … index 4 = +2 (unweighted, for display). */
export type Recommendation = {
  spec: ParamSpec
  current: number
  next: number
  median: number | null
  samples: number
  counts: readonly number[]
  direction: Direction
}

export function recommend(
  spec: ParamSpec,
  feedback: readonly Feedback[],
  tuning: Tuning,
  appliedAt: string | undefined,
  now: Date,
  orderCounts: Readonly<Record<string, number>>,
): Recommendation {
  const current = tuning[spec.id]
  const relevant = feedback.filter((f) => scoreFor(f, spec) !== undefined && (!appliedAt || f.createdAt > appliedAt))
  const counts = SCORES.map((score) => relevant.filter((f) => scoreFor(f, spec) === score).length)
  const base = { spec, current, next: current, samples: relevant.length, counts }
  if (relevant.length < MIN_SAMPLES) return { ...base, median: null, direction: 'insufficient' }
  const median = weightedMedian(
    relevant.map((f) => ({ value: scoreFor(f, spec) as Score, weight: feedbackWeight(f.createdAt, now, orderCounts[f.userId] ?? 1) })),
  )
  if (median === null || Math.abs(median) < KEEP_BAND) return { ...base, median, direction: 'keep' }
  const next = clampParam(spec, current - Math.sign(median) * spec.step)
  if (next === current) return { ...base, median, direction: 'limit' }
  return { ...base, median, next, direction: median > 0 ? 'down' : 'up' }
}
