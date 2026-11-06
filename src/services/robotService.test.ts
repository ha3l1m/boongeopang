import { describe, expect, it } from 'vitest'
import { emergencyStop, raiseAlert, readRobot, refill, resolveAlert, resumeRobot } from './robotService'
import { createOrder, getOrder, restartOrder } from './orderService'

const t = (sec: number) => new Date(Date.parse('2026-11-05T10:00:00.000Z') + sec * 1000)

describe('robotService', () => {
  it('starts idle and survives corrupted storage', () => {
    localStorage.setItem('boong:robot', '{oops')
    expect(readRobot()).toEqual({ estop: false, pauses: [], refilledAt: {} })
  })

  it('estop opens one pause and resume closes it', () => {
    emergencyStop(t(0))
    emergencyStop(t(1))
    expect(readRobot().pauses).toEqual([{ from: t(0).toISOString() }])
    resumeRobot(t(5))
    expect(readRobot()).toMatchObject({ estop: false, pauses: [{ from: t(0).toISOString(), to: t(5).toISOString() }] })
  })

  it('alert pauses; resume keeps pause until alert resolved', () => {
    emergencyStop(t(0))
    raiseAlert('overpour', 'o1', t(1))
    resumeRobot(t(2))
    expect(readRobot().pauses[0].to).toBeUndefined()
    resolveAlert(t(3))
    expect(readRobot().alert).toBeUndefined()
    expect(readRobot().pauses).toEqual([{ from: t(0).toISOString(), to: t(3).toISOString() }])
  })

  it('refill records time per ingredient', () => {
    refill('choco', t(9))
    expect(readRobot().refilledAt).toEqual({ choco: t(9).toISOString() })
  })
})

describe('orderService robot integration', () => {
  it('restartOrder resets timer and clears manual status', () => {
    const now = new Date()
    const order = createOrder('u1', { redbean: 1 }, '', now)
    const later = new Date(now.getTime() + 30_000)
    restartOrder(order.id, later)
    expect(getOrder('u1', order.id)).toMatchObject({ timerStart: later.toISOString() })
    expect(getOrder('u1', order.id)?.manualStatus).toBeUndefined()
  })

  it('rejects orders when filling is sold out', () => {
    const now = new Date()
    for (let i = 0; i < 4; i++) createOrder('u1', { choco: 10 }, '', now)
    expect(() => createOrder('u1', { choco: 1 }, '', now)).toThrow('재료가 부족해요')
    refill('choco', new Date(now.getTime() + 1))
    expect(() => createOrder('u1', { choco: 1 }, '', new Date(now.getTime() + 2))).not.toThrow()
  })
})
