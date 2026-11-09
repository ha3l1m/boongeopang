import { describe, expect, it } from 'vitest'
import { effectiveStatus, robotStep, undelivered, type Order } from '../src/domain/order'
import { applyRows, parseRows, type RobotRow } from './rows'

const order = (robot: Order['robot'], over: Partial<Order> = {}): Order => ({
  id: 'a',
  number: 1,
  userId: 'u',
  memo: '',
  total: 3000,
  createdAt: '2026-11-09T00:00:00.000Z',
  items: [
    { flavor: 'redbean', qty: 2, unitPrice: 1000 },
    { flavor: 'cream', qty: 1, unitPrice: 1000 },
  ],
  robot,
  ...over,
})

const accepted = { redbean: 'accepted', cream: 'accepted' } as const
const row = (over: Partial<RobotRow>): RobotRow => ({
  order_id: 'a', flavor: 'redbean', state: 'waiting', step: 'received', detail: '', queue_position: 1, ...over,
})

describe('robotStep', () => {
  const items = order(undefined).items
  it('stays received until a flavor starts', () => {
    expect(robotStep(items, { sends: accepted, steps: {} })).toBe('received')
  })
  it('follows the flavor being baked', () => {
    expect(robotStep(items, { sends: accepted, steps: { redbean: 'filling' } })).toBe('filling')
    expect(robotStep(items, { sends: accepted, steps: { redbean: 'ready', cream: 'batter' } })).toBe('batter')
  })
  it('is not ready until every flavor is ready', () => {
    expect(robotStep(items, { sends: accepted, steps: { redbean: 'ready' } })).toBe('baking')
    expect(robotStep(items, { sends: accepted, steps: { redbean: 'ready', cream: 'ready' } })).toBe('ready')
  })
})

describe('effectiveStatus with a robot order', () => {
  const far = new Date('2030-01-01T00:00:00.000Z')
  it('uses the robot step instead of the timer', () => {
    expect(effectiveStatus(order({ sends: accepted, steps: {} }), far)).toBe('received')
  })
  it('still lets a manual status win', () => {
    expect(effectiveStatus(order({ sends: accepted, steps: {} }, { manualStatus: 'cancelled' }), far)).toBe('cancelled')
  })
  it('keeps the timer for mock orders', () => {
    expect(effectiveStatus(order(undefined), far)).toBe('ready')
  })
})

describe('parseRows', () => {
  it('reads the /boong/orders JSON and drops malformed rows', () => {
    const data = JSON.stringify([row({}), { order_id: 1 }, null])
    expect(parseRows(data)).toEqual([row({})])
  })
  it('returns nothing for invalid JSON or a non-array', () => {
    expect(parseRows('{')).toEqual([])
    expect(parseRows('{"a":1}')).toEqual([])
  })
})

describe('applyRows', () => {
  it('maps waiting, baking, and done rows to steps and the queue position', () => {
    const [next] = applyRows([order({ sends: accepted, steps: {} })], [
      row({ flavor: 'redbean', state: 'done', step: 'ready', queue_position: -1 }),
      row({ flavor: 'cream', state: 'waiting', queue_position: 2 }),
    ])
    expect(next.robot).toEqual({ sends: accepted, steps: { redbean: 'ready', cream: 'received' }, queue: 2 })

    const [done] = applyRows([next], [row({ state: 'done', step: 'ready', queue_position: -1 })])
    expect(done.robot?.steps.redbean).toBe('ready')
  })

  it('does not show the order as waiting while one of its flavors is baking', () => {
    const [next] = applyRows([order({ sends: accepted, steps: {} })], [
      row({ flavor: 'redbean', state: 'baking', step: 'filling', queue_position: 0 }),
      row({ flavor: 'cream', state: 'waiting', queue_position: 1 }),
    ])
    expect(next.robot?.queue).toBeUndefined()
  })

  it('marks a failed flavor undelivered with the robot message', () => {
    const [next] = applyRows([order({ sends: accepted, steps: { redbean: 'batter' } })], [
      row({ state: 'failed', step: 'batter', detail: '그리퍼 오류', queue_position: -1 }),
    ])
    expect(next.robot?.failed).toBe('그리퍼 오류')
    expect(undelivered(next).map((i) => i.flavor)).toEqual(['redbean'])
  })

  it('lets the newest row win when a resent flavor also has an old failed row', () => {
    const [next] = applyRows([order({ sends: accepted, steps: {} })], [
      row({ state: 'waiting', queue_position: 1 }),
      row({ state: 'failed', queue_position: -1 }),
    ])
    expect(next.robot?.sends.redbean).toBe('accepted')
    expect(next.robot?.failed).toBeUndefined()
  })

  it('ignores rows for a flavor still being sent', () => {
    const before = order({ sends: { redbean: 'sending', cream: 'accepted' }, steps: {} })
    expect(applyRows([before], [row({ state: 'baking', step: 'batter' })])[0]).toBe(before)
  })

  it('keeps the last known step when rows aged out, returning the same object', () => {
    const before = order({ sends: accepted, steps: { redbean: 'ready', cream: 'ready' } })
    expect(applyRows([before], [])[0]).toBe(before)
  })

  it('leaves mock orders alone', () => {
    const before = order(undefined)
    expect(applyRows([before], [row({ state: 'done' })])[0]).toBe(before)
  })
})
