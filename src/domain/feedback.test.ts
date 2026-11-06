import { describe, expect, it } from 'vitest'
import { MIN_SAMPLES, feedbackWeight, recommend, weightedMedian, type Feedback, type Score } from './feedback'
import { DEFAULT_TUNING, paramSpec } from './tuning'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-11-06T12:00:00.000Z')

function fb(i: number, doneness: Score, extra: Partial<Feedback> = {}): Feedback {
  return {
    id: `f${i}`,
    orderId: `o${i}`,
    userId: `u${i}`,
    flavors: ['redbean'],
    scores: { doneness },
    createdAt: now.toISOString(),
    ...extra,
  }
}

describe('weightedMedian', () => {
  it('returns null for no entries', () => {
    expect(weightedMedian([])).toBeNull()
  })

  it('picks the middle value with equal weights', () => {
    expect(weightedMedian([2, -1, 0].map((value) => ({ value, weight: 1 })))).toBe(0)
  })

  it('averages the two middle values when weight splits exactly in half', () => {
    expect(weightedMedian([-2, 2].map((value) => ({ value, weight: 1 })))).toBe(0)
    expect(weightedMedian([0, 1, 1, 2].map((value) => ({ value, weight: 1 })))).toBe(1)
  })

  it('follows the heavier side', () => {
    expect(weightedMedian([{ value: -2, weight: 1 }, { value: 1, weight: 3 }])).toBe(1)
  })

  it('ignores zero-weight entries', () => {
    expect(weightedMedian([{ value: 2, weight: 0 }, { value: -1, weight: 1 }])).toBe(-1)
  })
})

describe('feedbackWeight', () => {
  it('is 1 for a fresh first-time customer', () => {
    expect(feedbackWeight(now.toISOString(), now, 1)).toBe(1)
  })

  it('halves every 3 days', () => {
    expect(feedbackWeight(new Date(now.getTime() - 3 * DAY).toISOString(), now, 1)).toBeCloseTo(0.5)
    expect(feedbackWeight(new Date(now.getTime() - 6 * DAY).toISOString(), now, 1)).toBeCloseTo(0.25)
  })

  it('gives regulars up to 2x', () => {
    expect(feedbackWeight(now.toISOString(), now, 3)).toBe(1.5)
    expect(feedbackWeight(now.toISOString(), now, 50)).toBe(2)
  })
})

describe('recommend', () => {
  const bake = paramSpec('bakeSec')
  const many = (score: Score, n = MIN_SAMPLES) => Array.from({ length: n }, (_, i) => fb(i, score))

  it('waits for enough samples', () => {
    const rec = recommend(bake, many(2, MIN_SAMPLES - 1), DEFAULT_TUNING, undefined, now, {})
    expect(rec.direction).toBe('insufficient')
    expect(rec.next).toBe(DEFAULT_TUNING.bakeSec)
  })

  it('shortens bake time one step when customers say burnt', () => {
    const rec = recommend(bake, many(2), DEFAULT_TUNING, undefined, now, {})
    expect(rec.direction).toBe('down')
    expect(rec.median).toBe(2)
    expect(rec.next).toBe(DEFAULT_TUNING.bakeSec - bake.step)
  })

  it('lengthens bake time when undercooked', () => {
    const rec = recommend(bake, many(-1), DEFAULT_TUNING, undefined, now, {})
    expect(rec.direction).toBe('up')
    expect(rec.next).toBe(DEFAULT_TUNING.bakeSec + bake.step)
  })

  it('keeps the value when the median is just right', () => {
    const rec = recommend(bake, [...many(0, 3), fb(8, 2), fb(9, -2)], DEFAULT_TUNING, undefined, now, {})
    expect(rec.direction).toBe('keep')
  })

  it('stops at the range limit', () => {
    const rec = recommend(bake, many(2), { ...DEFAULT_TUNING, bakeSec: bake.min }, undefined, now, {})
    expect(rec.direction).toBe('limit')
    expect(rec.next).toBe(bake.min)
  })

  it('only counts feedback after the last applied change', () => {
    const old = many(2).map((f) => ({ ...f, createdAt: new Date(now.getTime() - DAY).toISOString() }))
    const appliedAt = new Date(now.getTime() - DAY / 2).toISOString()
    expect(recommend(bake, old, DEFAULT_TUNING, appliedAt, now, {}).samples).toBe(0)
  })

  it('counts only feedback for the flavor of a filling param', () => {
    const cream = paramSpec('filling.cream')
    const list = Array.from({ length: MIN_SAMPLES }, (_, i) => fb(i, 0, { scores: { filling: 2 } }))
    expect(recommend(cream, list, DEFAULT_TUNING, undefined, now, {}).samples).toBe(0)
    const creamList = list.map((f) => ({ ...f, flavors: ['cream' as const] }))
    expect(recommend(cream, creamList, DEFAULT_TUNING, undefined, now, {}).direction).toBe('down')
  })

  it('reads per-flavor filling answers from mixed orders', () => {
    const mixed = Array.from({ length: MIN_SAMPLES }, (_, i) =>
      fb(i, 0, { flavors: ['redbean', 'cream'], scores: {}, fillingByFlavor: { redbean: 2, cream: -1 } }),
    )
    const red = recommend(paramSpec('filling.redbean'), mixed, DEFAULT_TUNING, undefined, now, {})
    const cream = recommend(paramSpec('filling.cream'), mixed, DEFAULT_TUNING, undefined, now, {})
    expect(red.direction).toBe('down')
    expect(cream.direction).toBe('up')
  })

  it('ignores a legacy single filling answer when the order had several flavors', () => {
    const legacy = Array.from({ length: MIN_SAMPLES }, (_, i) => fb(i, 0, { flavors: ['redbean', 'cream'], scores: { filling: 2 } }))
    expect(recommend(paramSpec('filling.redbean'), legacy, DEFAULT_TUNING, undefined, now, {}).samples).toBe(0)
  })

  it('lets a heavy regular minority lose to a fresh majority only by weight', () => {
    const regulars = [fb(1, -2), fb(2, -2)]
    const newcomers = [fb(3, 2), fb(4, 2), fb(5, 2)]
    const counts = { u1: 10, u2: 10 }
    const rec = recommend(bake, [...regulars, ...newcomers], DEFAULT_TUNING, undefined, now, counts)
    // regulars weigh 2 + 2 = 4 vs newcomers 3 → regulars win the median
    expect(rec.median).toBe(-2)
  })
})
