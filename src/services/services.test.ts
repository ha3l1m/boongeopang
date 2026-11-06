import { describe, expect, it } from 'vitest'
import { currentUser, loginAsGuest, logout } from './authService'
import { createOrder, getOrder, listAllOrders, listOrders, setOrderStatus, summarizeDay } from './orderService'
import { checkAdminPin, isAdminLoggedIn, adminLogout } from './adminAuth'

describe('authService', () => {
  it('logs in as guest and persists', () => {
    expect(currentUser()).toBeNull()
    const user = loginAsGuest()
    expect(user.nickname).toMatch(/손님$/)
    expect(currentUser()).toEqual(user)
  })

  it('logs out', () => {
    loginAsGuest()
    logout()
    expect(currentUser()).toBeNull()
  })

  it('ignores corrupted storage', () => {
    localStorage.setItem('boong:user', '{oops')
    expect(currentUser()).toBeNull()
  })
})

describe('orderService', () => {
  const now = new Date('2026-11-04T10:00:00.000Z')

  it('rejects empty cart', () => {
    expect(() => createOrder('u1', {}, '', now)).toThrow()
  })

  it('creates order with incrementing ticket number and trimmed memo', () => {
    const a = createOrder('u1', { redbean: 2 }, '  바삭하게  ', now)
    const b = createOrder('u1', { choco: 1 }, '', now)
    expect(a.total).toBe(2000)
    expect(a.memo).toBe('바삭하게')
    expect(b.number).toBe(a.number + 1)
  })

  it('caps memo length', () => {
    const order = createOrder('u1', { cream: 1 }, 'x'.repeat(80), now)
    expect(order.memo).toHaveLength(50)
  })

  it('lists only the user orders, newest first', () => {
    const first = createOrder('u1', { redbean: 1 }, '', now)
    createOrder('u2', { redbean: 1 }, '', now)
    const later = createOrder('u1', { cream: 1 }, '', new Date(now.getTime() + 1000))
    expect(listOrders('u1').map((o) => o.id)).toEqual([later.id, first.id])
  })

  it('gets order by id for owner only', () => {
    const order = createOrder('u1', { redbean: 1 }, '', now)
    expect(getOrder('u1', order.id)?.id).toBe(order.id)
    expect(getOrder('u2', order.id)).toBeNull()
  })
})

describe('orderService admin', () => {
  const now = new Date('2026-11-04T10:00:00.000Z')

  it('lists all users orders, newest first', () => {
    const a = createOrder('u1', { redbean: 1 }, '', now)
    const b = createOrder('u2', { cream: 1 }, '', new Date(now.getTime() + 1000))
    expect(listAllOrders().map((o) => o.id)).toEqual([b.id, a.id])
  })

  it('sets manual status immutably and persists', () => {
    const order = createOrder('u1', { redbean: 1 }, '', now)
    const updated = setOrderStatus(order.id, 'cancelled')
    expect(updated.manualStatus).toBe('cancelled')
    expect(order.manualStatus).toBeUndefined()
    expect(getOrder('u1', order.id)?.manualStatus).toBe('cancelled')
  })

  it('throws for unknown order id', () => {
    expect(() => setOrderStatus('nope', 'batter')).toThrow()
  })

  it('summarizes the day excluding cancelled and other days', () => {
    createOrder('u1', { redbean: 2, choco: 1 }, '', now)
    const cancelled = createOrder('u1', { cream: 5 }, '', now)
    setOrderStatus(cancelled.id, 'cancelled')
    createOrder('u1', { cream: 1 }, '', new Date('2026-11-02T10:00:00.000Z'))
    const summary = summarizeDay(listAllOrders(), now)
    expect(summary).toEqual({ orders: 1, cancelled: 1, sales: 3200, byFlavor: { redbean: 2, cream: 0, choco: 1 } })
  })
})

describe('adminAuth', () => {
  it('rejects wrong pin and missing config', () => {
    expect(checkAdminPin('0000', '1234')).toBe(false)
    expect(checkAdminPin('1234', undefined)).toBe(false)
    expect(checkAdminPin('', '')).toBe(false)
    expect(isAdminLoggedIn()).toBe(false)
  })

  it('accepts correct pin and logs out', () => {
    expect(checkAdminPin('1234', '1234')).toBe(true)
    expect(isAdminLoggedIn()).toBe(true)
    adminLogout()
    expect(isAdminLoggedIn()).toBe(false)
  })
})
