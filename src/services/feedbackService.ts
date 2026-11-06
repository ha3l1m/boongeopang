import { FEEDBACK_DELAY_MS, SCORES, type Feedback, type FeedbackInput, type Score } from '../domain/feedback'
import type { Flavor } from '../domain/menu'
import type { Order } from '../domain/order'
import { readJson, writeJson } from './storage'

const FEEDBACK_KEY = 'boong:feedback'
const SKIP_KEY = 'boong:feedback-skip'
const SEEN_KEY = 'boong:pickup-seen'

function isFeedback(value: unknown): value is Feedback {
  const v = value as Feedback
  return (
    typeof v === 'object' && v !== null &&
    typeof v.orderId === 'string' && typeof v.userId === 'string' && typeof v.createdAt === 'string' &&
    Array.isArray(v.flavors) && typeof v.scores === 'object' && v.scores !== null
  )
}

export function listFeedback(): Feedback[] {
  const value = readJson<unknown>(FEEDBACK_KEY, [])
  return Array.isArray(value) ? value.filter(isFeedback) : []
}

function skipped(): string[] {
  const value = readJson<unknown>(SKIP_KEY, [])
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function seenAt(): Record<string, string> {
  const value = readJson<unknown>(SEEN_KEY, {})
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string')) as Record<string, string>
}

/** Remembers the first moment the customer app saw this order picked up. */
export function markPickupSeen(orderId: string, now: Date = new Date()): void {
  const seen = seenAt()
  if (seen[orderId]) return
  writeJson(SEEN_KEY, { ...seen, [orderId]: now.toISOString() })
}

/** Picked up and not answered yet — the customer may rate it any time. */
export function canGiveFeedback(order: Order): boolean {
  return order.manualStatus === 'picked_up' && !listFeedback().some((f) => f.orderId === order.id)
}

/** Pop the sheet by itself only after FEEDBACK_DELAY_MS since pickup was seen, and never after 나중에. */
export function shouldAskFeedback(order: Order, now: Date = new Date()): boolean {
  const seen = seenAt()[order.id]
  if (!seen || !canGiveFeedback(order) || skipped().includes(order.id)) return false
  return now.getTime() - Date.parse(seen) >= FEEDBACK_DELAY_MS
}

const isScore = (value: unknown): value is Score => SCORES.includes(value as Score)

function pickScores<K extends string>(entries: readonly (readonly [K, unknown])[]): Partial<Record<K, Score>> {
  return Object.fromEntries(entries.filter(([, v]) => isScore(v))) as Partial<Record<K, Score>>
}

export function submitFeedback(order: Order, input: FeedbackInput, now: Date = new Date()): Feedback {
  const flavors = order.items.map((i) => i.flavor)
  const scores = pickScores([['doneness', input.doneness], ['crisp', input.crisp]] as const)
  const fillingByFlavor = pickScores(flavors.map((f): readonly [Flavor, unknown] => [f, input.filling?.[f]]))
  if (Object.keys(scores).length + Object.keys(fillingByFlavor).length === 0) throw new Error('하나 이상 골라 주세요')
  const all = listFeedback()
  if (all.some((f) => f.orderId === order.id)) throw new Error('이미 피드백을 보냈어요')
  const feedback: Feedback = {
    id: crypto.randomUUID(),
    orderId: order.id,
    userId: order.userId,
    flavors,
    scores,
    ...(Object.keys(fillingByFlavor).length > 0 && { fillingByFlavor }),
    createdAt: now.toISOString(),
  }
  writeJson(FEEDBACK_KEY, [...all, feedback])
  return feedback
}

export function skipFeedback(orderId: string): void {
  writeJson(SKIP_KEY, [...new Set([...skipped(), orderId])])
}
