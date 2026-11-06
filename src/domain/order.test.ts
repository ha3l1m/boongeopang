import { describe, expect, it } from 'vitest'
import {
  BAKE_STEPS,
  STEP_SECONDS,
  addToCart,
  cartCount,
  cartTotal,
  removeFromCart,
  statusAt,
  toOrderItems,
  effectiveStatus,
  nextStatus,
  ADMIN_STATUS_LABEL,
} from './order'
import { MAX_PER_FLAVOR, MAX_TOTAL } from './menu'

describe('cart', () => {
  it('adds and removes immutably', () => {
    const empty = {}
    const one = addToCart(empty, 'redbean')
    expect(empty).toEqual({})
    expect(one).toEqual({ redbean: 1 })
    expect(removeFromCart(one, 'redbean')).toEqual({})
  })

  it('never goes below zero', () => {
    expect(removeFromCart({}, 'choco')).toEqual({})
  })

  it('caps per flavor', () => {
    let cart = {}
    for (let i = 0; i < MAX_PER_FLAVOR + 3; i++) cart = addToCart(cart, 'cream')
    expect(cartCount(cart)).toBe(MAX_PER_FLAVOR)
  })

  it('caps total', () => {
    let cart = {}
    for (let i = 0; i < 30; i++) {
      cart = addToCart(cart, 'redbean')
      cart = addToCart(cart, 'cream')
      cart = addToCart(cart, 'choco')
    }
    expect(cartCount(cart)).toBe(MAX_TOTAL)
  })

  it('totals by flavor price', () => {
    expect(cartTotal({ redbean: 2, choco: 3 })).toBe(2 * 1000 + 3 * 1200)
  })

  it('converts to order items in menu order, skipping zero', () => {
    expect(toOrderItems({ choco: 1, redbean: 2, cream: 0 })).toEqual([
      { flavor: 'redbean', qty: 2, unitPrice: 1000 },
      { flavor: 'choco', qty: 1, unitPrice: 1200 },
    ])
  })
})

describe('statusAt', () => {
  const created = '2026-11-04T10:00:00.000Z'
  const at = (sec: number) => new Date(Date.parse(created) + sec * 1000)

  it('starts at received', () => {
    expect(statusAt(created, at(0))).toBe('received')
  })

  it('advances one step per STEP_SECONDS', () => {
    expect(statusAt(created, at(STEP_SECONDS))).toBe(BAKE_STEPS[1])
    expect(statusAt(created, at(STEP_SECONDS * 3 + 1))).toBe(BAKE_STEPS[3])
  })

  it('stops at ready', () => {
    expect(statusAt(created, at(99999))).toBe('ready')
  })

  it('treats clock skew as received', () => {
    expect(statusAt(created, at(-50))).toBe('received')
  })
})

describe('effectiveStatus / nextStatus', () => {
  const created = '2026-11-04T10:00:00.000Z'
  const base = { id: 'o1', number: 1, userId: 'u1', items: [], memo: '', total: 0, createdAt: created }
  const at = (sec: number) => new Date(Date.parse(created) + sec * 1000)

  it('falls back to timer without manual status', () => {
    expect(effectiveStatus(base, at(STEP_SECONDS))).toBe(BAKE_STEPS[1])
  })

  it('uses manual status over timer', () => {
    expect(effectiveStatus({ ...base, manualStatus: 'cancelled' }, at(0))).toBe('cancelled')
    expect(effectiveStatus({ ...base, manualStatus: 'batter' }, at(99999))).toBe('batter')
  })

  it('advances one step, ready goes to picked_up, terminal stays', () => {
    expect(nextStatus('received')).toBe('batter')
    expect(nextStatus('ready')).toBe('picked_up')
    expect(nextStatus('picked_up')).toBe('picked_up')
    expect(nextStatus('cancelled')).toBe('cancelled')
  })

  it('labels admin statuses', () => {
    expect(ADMIN_STATUS_LABEL.picked_up).toBe('픽업 완료')
    expect(ADMIN_STATUS_LABEL.cancelled).toBe('주문 취소')
  })
})
