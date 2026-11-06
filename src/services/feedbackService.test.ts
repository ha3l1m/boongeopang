import { describe, expect, it } from 'vitest'
import { createOrder, setOrderStatus } from './orderService'
import { canGiveFeedback, listFeedback, markPickupSeen, shouldAskFeedback, skipFeedback, submitFeedback } from './feedbackService'
import { applyParam, readTuning, recommendations } from './tuningService'
import { DEFAULT_TUNING, paramSpec } from '../domain/tuning'
import { FEEDBACK_DELAY_MS, MIN_SAMPLES } from '../domain/feedback'

const now = new Date('2026-11-06T12:00:00.000Z')

function pickedUp(userId: string, flavor: 'redbean' | 'cream' = 'redbean') {
  const order = createOrder(userId, { [flavor]: 1 }, '', now)
  return setOrderStatus(order.id, 'picked_up')
}

describe('feedbackService', () => {
  const after = (ms: number) => new Date(now.getTime() + ms)

  it('can be given only after pickup and until answered', () => {
    const order = createOrder('u1', { redbean: 1 }, '', now)
    expect(canGiveFeedback(order)).toBe(false)
    const done = setOrderStatus(order.id, 'picked_up')
    expect(canGiveFeedback(done)).toBe(true)
    submitFeedback(done, { doneness: 1 }, now)
    expect(canGiveFeedback(done)).toBe(false)
  })

  it('asks automatically only after the customer had time to eat', () => {
    const order = pickedUp('u1')
    expect(shouldAskFeedback(order, now)).toBe(false)
    markPickupSeen(order.id, now)
    expect(shouldAskFeedback(order, after(FEEDBACK_DELAY_MS - 1))).toBe(false)
    expect(shouldAskFeedback(order, after(FEEDBACK_DELAY_MS))).toBe(true)
  })

  it('keeps the first time pickup was seen', () => {
    const order = pickedUp('u1')
    markPickupSeen(order.id, now)
    markPickupSeen(order.id, after(FEEDBACK_DELAY_MS))
    expect(shouldAskFeedback(order, after(FEEDBACK_DELAY_MS))).toBe(true)
  })

  it('stores flavors and scores and rejects duplicates or empty answers', () => {
    const order = pickedUp('u1', 'cream')
    expect(() => submitFeedback(order, {}, now)).toThrow()
    const saved = submitFeedback(order, { filling: { cream: -1 }, crisp: 0 }, now)
    expect(saved).toMatchObject({ orderId: order.id, userId: 'u1', flavors: ['cream'], scores: { crisp: 0 }, fillingByFlavor: { cream: -1 } })
    expect(saved.scores.filling).toBeUndefined()
    expect(() => submitFeedback(order, { crisp: 1 }, now)).toThrow()
    expect(listFeedback()).toHaveLength(1)
  })

  it('keeps filling answers only for flavors in the order', () => {
    const order = setOrderStatus(createOrder('u1', { redbean: 1, cream: 1 }, '', now).id, 'picked_up')
    const saved = submitFeedback(order, { filling: { redbean: 1, choco: 2 } }, now)
    expect(saved.fillingByFlavor).toEqual({ redbean: 1 })
  })

  it('rejects an answer that only names flavors outside the order', () => {
    const order = pickedUp('u1', 'cream')
    expect(() => submitFeedback(order, { filling: { choco: 2 } }, now)).toThrow()
  })

  it('stops asking after skip but still accepts feedback later', () => {
    const order = pickedUp('u1')
    markPickupSeen(order.id, now)
    skipFeedback(order.id)
    expect(shouldAskFeedback(order, after(FEEDBACK_DELAY_MS))).toBe(false)
    expect(canGiveFeedback(order)).toBe(true)
    submitFeedback(order, { crisp: 0 }, now)
    expect(listFeedback()).toHaveLength(1)
  })

  it('ignores corrupted storage', () => {
    localStorage.setItem('boong:feedback', '{oops')
    expect(listFeedback()).toEqual([])
    localStorage.setItem('boong:feedback', JSON.stringify([{ nope: 1 }]))
    expect(listFeedback()).toEqual([])
  })
})

describe('tuningService', () => {
  it('starts from defaults', () => {
    expect(readTuning().values).toEqual(DEFAULT_TUNING)
  })

  it('recommends from feedback and resets the count after applying', () => {
    for (let i = 0; i < MIN_SAMPLES; i++) submitFeedback(pickedUp(`u${i}`), { doneness: 2 }, now)
    const bake = recommendations(now).find((r) => r.spec.id === 'bakeSec')
    expect(bake?.direction).toBe('down')

    const later = new Date(now.getTime() + 1000)
    const state = applyParam('bakeSec', bake!.next, later)
    expect(state.values.bakeSec).toBe(DEFAULT_TUNING.bakeSec - paramSpec('bakeSec').step)
    expect(state.history[0]).toMatchObject({ param: 'bakeSec', from: DEFAULT_TUNING.bakeSec, to: state.values.bakeSec })
    expect(recommendations(later).find((r) => r.spec.id === 'bakeSec')?.samples).toBe(0)
  })

  it('clamps applied values to the param range', () => {
    expect(applyParam('bakeSec', 9999, now).values.bakeSec).toBe(paramSpec('bakeSec').max)
  })
})
