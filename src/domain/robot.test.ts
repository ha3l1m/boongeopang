import { describe, expect, it } from 'vitest'
import { currentJob, isPaused, pausedMsBetween, stockLeft, INITIAL_ROBOT } from './robot'
import { statusAt, secondsLeft, STEP_SECONDS, type Order } from './order'

const T0 = Date.parse('2026-11-05T10:00:00.000Z')
const iso = (sec: number) => new Date(T0 + sec * 1000).toISOString()
const at = (sec: number) => new Date(T0 + sec * 1000)

describe('pausedMsBetween', () => {
  it('is zero without pauses', () => {
    expect(pausedMsBetween([], iso(0), at(100))).toBe(0)
  })

  it('ignores pauses that ended before start', () => {
    expect(pausedMsBetween([{ from: iso(-50), to: iso(-10) }], iso(0), at(100))).toBe(0)
  })

  it('clips a pause that began before start', () => {
    expect(pausedMsBetween([{ from: iso(-50), to: iso(10) }], iso(0), at(100))).toBe(10_000)
  })

  it('counts an open pause up to now and sums several', () => {
    const pauses = [{ from: iso(5), to: iso(8) }, { from: iso(20) }]
    expect(pausedMsBetween(pauses, iso(0), at(30))).toBe(13_000)
  })
})

describe('statusAt with pauses', () => {
  it('freezes progress while paused', () => {
    const pauses = [{ from: iso(STEP_SECONDS - 1) }]
    expect(statusAt(iso(0), at(STEP_SECONDS * 4), pauses)).toBe('received')
    expect(secondsLeft(iso(0), at(STEP_SECONDS * 4), pauses)).toBe(STEP_SECONDS * 5 - (STEP_SECONDS - 1))
  })
})

describe('isPaused', () => {
  it('pauses on estop or alert', () => {
    expect(isPaused(INITIAL_ROBOT)).toBe(false)
    expect(isPaused({ ...INITIAL_ROBOT, estop: true })).toBe(true)
    expect(isPaused({ ...INITIAL_ROBOT, alert: { kind: 'burnt', orderId: 'o', at: iso(0) } })).toBe(true)
  })
})

function order(n: number, sec: number, items: Order['items'], extra: Partial<Order> = {}): Order {
  return { id: `o${n}`, number: n, userId: 'u', items, memo: '', total: 0, createdAt: iso(sec), ...extra }
}

describe('stockLeft', () => {
  const now = at(0)

  it('subtracts today non-cancelled orders since refill', () => {
    const orders = [
      order(1, -60, [{ flavor: 'redbean', qty: 3, unitPrice: 1000 }, { flavor: 'choco', qty: 2, unitPrice: 1200 }]),
      order(2, -30, [{ flavor: 'cream', qty: 5, unitPrice: 1000 }], { manualStatus: 'cancelled' }),
      order(3, -86_400 * 2, [{ flavor: 'redbean', qty: 9, unitPrice: 1000 }]),
    ]
    expect(stockLeft(orders, {}, now)).toEqual({ batter: 95, redbean: 37, cream: 40, choco: 38 })
  })

  it('resets an ingredient on refill and never goes negative', () => {
    const orders = [
      order(1, -60, [{ flavor: 'redbean', qty: 10, unitPrice: 1000 }]),
      order(2, -59, [{ flavor: 'redbean', qty: 10, unitPrice: 1000 }]),
      order(3, -58, [{ flavor: 'redbean', qty: 10, unitPrice: 1000 }]),
      order(4, -57, [{ flavor: 'redbean', qty: 10, unitPrice: 1000 }]),
      order(5, -10, [{ flavor: 'redbean', qty: 10, unitPrice: 1000 }]),
    ]
    expect(stockLeft(orders, {}, now).redbean).toBe(0)
    expect(stockLeft(orders, { redbean: iso(-20) }, now).redbean).toBe(30)
  })
})

describe('currentJob', () => {
  it('picks the oldest baking order and counts the rest as queue', () => {
    const rows = [
      { order: order(3, -1, []), status: 'received' as const },
      { order: order(1, -90, []), status: 'ready' as const },
      { order: order(2, -5, []), status: 'baking' as const },
    ]
    expect(currentJob(rows)).toEqual({ current: rows[2].order, waiting: 1 })
    expect(currentJob([rows[1]])).toEqual({ current: null, waiting: 0 })
  })
})
