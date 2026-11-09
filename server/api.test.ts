import { describe, expect, it } from 'vitest'
import type { Order } from '../src/domain/order'
import { createApi, EMPTY_STATE, recoverSending, type ServerState } from './api'
import { createRobotLink, type Bridge } from './robotLink'

const NOW = new Date('2026-11-09T03:00:00.000Z')

function setup(answer: (args: Record<string, unknown>) => unknown = () => ({ accepted: true, queue_position: 1, message: '' })) {
  let state: ServerState = EMPTY_STATE
  const store = { get: () => state, update: (fn: (s: ServerState) => ServerState) => { state = fn(state) } }
  const calls: Record<string, unknown>[] = []
  const bridge: Bridge = {
    isOpen: () => true,
    subscribe: () => undefined,
    callService: async (_s, _t, args) => {
      calls.push(args)
      return answer(args)
    },
  }
  const link = createRobotLink(bridge, store, () => NOW.getTime())
  link.onRows('[]')
  const api = createApi(store, link, () => NOW, () => `id-${calls.length}-${store.get().orders.length}`)
  return { api, store, link, calls }
}

const place = (api: ReturnType<typeof createApi>, cart: unknown = { redbean: 2, cream: 1 }) =>
  api('POST', '/api/orders', { userId: 'u1', cart, memo: '  덜 익게  ' })

describe('POST /api/orders', () => {
  it('assigns the number, prices from the menu, and sends one call per flavor', async () => {
    const { api, link, calls, store } = setup()
    const res = place(api)
    expect(res.status).toBe(201)
    const order = res.body as Order
    expect(order).toMatchObject({ number: 1, total: 3000, memo: '덜 익게', userId: 'u1' })
    expect(order.robot?.sends).toEqual({ redbean: 'sending', cream: 'sending' })
    expect((place(api).body as Order).number).toBe(2)

    await link.idle()
    expect(calls.slice(0, 2)).toEqual([
      { order_id: order.id, order_number: 1, flavor: 'redbean', qty: 2 },
      { order_id: order.id, order_number: 1, flavor: 'cream', qty: 1 },
    ])
    expect(store.get().orders[0].robot?.sends).toEqual({ redbean: 'accepted', cream: 'accepted' })
  })

  it('rejects a flavor the robot cannot make, bad carts, and bad bodies', () => {
    const { api, store } = setup()
    expect(place(api, { choco: 1 }).status).toBe(400)
    expect(place(api, {}).status).toBe(400)
    expect(place(api, { redbean: 0 }).status).toBe(400)
    expect(place(api, { redbean: 1.5 }).status).toBe(400)
    expect(place(api, { redbean: 11 }).status).toBe(400)
    expect(place(api, { redbean: 10, cream: 10 }).status).toBe(201)
    store.update((s) => ({ ...s, orders: [] }))
    expect(api('POST', '/api/orders', null).status).toBe(400)
    expect(api('POST', '/api/orders', { cart: { redbean: 1 } }).status).toBe(400)
  })

  it('refuses orders and saves nothing while the robot is unreachable', () => {
    const { store, link } = setup()
    const stale = createApi(store, { ...link, ready: () => false }, () => NOW, () => 'x')
    const res = place(stale)
    expect(res.status).toBe(503)
    expect((res.body as { error: string }).error).toMatch(/^붕봇/)
    expect(store.get().orders).toEqual([])
  })

  it('checks stock across every device', () => {
    const { api } = setup()
    for (let i = 0; i < 4; i++) expect(place(api, { redbean: 10 }).status).toBe(201)
    const res = place(api, { redbean: 1 })
    expect(res.status).toBe(409)
    expect((res.body as { error: string }).error).toMatch(/^재료가 부족해요/)
  })
})

describe('partial failure and resend', () => {
  it('keeps the accepted flavor and resends only the failed one', async () => {
    let rejectCream = true
    const { api, link, calls, store } = setup((args) => ({ accepted: !(args.flavor === 'cream' && rejectCream), message: 'no' }))
    const order = place(api).body as Order
    await link.idle()
    expect(store.get().orders[0].robot?.sends).toEqual({ redbean: 'accepted', cream: 'failed' })

    rejectCream = false
    expect(api('POST', `/api/orders/${order.id}/resend`, {}).status).toBe(202)
    await link.idle()
    expect(calls.map((c) => c.flavor)).toEqual(['redbean', 'cream', 'cream'])
    expect(store.get().orders[0].robot?.sends.cream).toBe('accepted')
  })

  it('marks a flavor failed when the service call throws', async () => {
    const { api, link, store } = setup(() => { throw new Error('timeout') })
    place(api)
    await link.idle()
    expect(store.get().orders[0].robot?.sends).toEqual({ redbean: 'failed', cream: 'failed' })
  })

  it('will not resend a cancelled order or one with nothing failed', async () => {
    const { api, link } = setup()
    const order = place(api).body as Order
    await link.idle()
    expect(api('POST', `/api/orders/${order.id}/resend`, {}).status).toBe(409)
    expect(api('POST', '/api/orders/nope/resend', {}).status).toBe(404)
  })

  it('turns sends left unfinished by a restart into failures', () => {
    const order = { id: 'a', robot: { sends: { redbean: 'sending', cream: 'accepted' }, steps: {} } } as Order
    expect(recoverSending({ ...EMPTY_STATE, orders: [order] }).orders[0].robot?.sends).toEqual({ redbean: 'failed', cream: 'accepted' })
  })
})

describe('PATCH /api/orders/:id', () => {
  it('sets and clears the manual status and restarts the timer', () => {
    const { api, store } = setup()
    const order = place(api).body as Order
    expect(api('PATCH', `/api/orders/${order.id}`, { manualStatus: 'picked_up' }).status).toBe(200)
    expect(store.get().orders[0].manualStatus).toBe('picked_up')
    api('PATCH', `/api/orders/${order.id}`, { manualStatus: null, timerStart: NOW.toISOString() })
    expect(store.get().orders[0].manualStatus).toBeUndefined()
    expect(store.get().orders[0].timerStart).toBe(NOW.toISOString())
  })

  it('rejects unknown statuses, fields, and orders', () => {
    const { api, store } = setup()
    const order = place(api).body as Order
    expect(api('PATCH', `/api/orders/${order.id}`, { manualStatus: 'eaten' }).status).toBe(400)
    expect(api('PATCH', `/api/orders/${order.id}`, { timerStart: 5 }).status).toBe(400)
    expect(api('PATCH', '/api/orders/nope', { manualStatus: 'ready' }).status).toBe(404)
    api('PATCH', `/api/orders/${order.id}`, { total: 1, manualStatus: 'ready' })
    expect(store.get().orders[0].total).toBe(3000)
  })
})

describe('feedback, robot state, and reads', () => {
  const feedback = (orderId: string) => ({ id: 'f', orderId, userId: 'u1', flavors: ['redbean'], scores: { doneness: 0 }, createdAt: NOW.toISOString() })

  it('shares feedback once per order', () => {
    const { api, store } = setup()
    const order = place(api).body as Order
    expect(api('POST', '/api/feedback', feedback(order.id)).status).toBe(201)
    expect(store.get().feedback).toHaveLength(1)
    expect(api('POST', '/api/feedback', feedback(order.id)).status).toBe(409)
    expect(api('POST', '/api/feedback', feedback('nope')).status).toBe(404)
    expect(api('POST', '/api/feedback', { id: 'f' }).status).toBe(400)
  })

  it('shares robot state and validates its shape', () => {
    const { api, store } = setup()
    const robot = { estop: false, pauses: [], refilledAt: { batter: NOW.toISOString() } }
    expect(api('PUT', '/api/robot', robot).status).toBe(200)
    expect(store.get().robot).toEqual(robot)
    expect(api('PUT', '/api/robot', { estop: 'no' }).status).toBe(400)
  })

  it('returns the shared state with the robot link, and 404s unknown routes', () => {
    const { api } = setup()
    place(api)
    const res = api('GET', '/api/state', null)
    expect(res.body).toMatchObject({ robotReady: true })
    expect((res.body as ServerState).orders).toHaveLength(1)
    expect(api('DELETE', '/api/state', null).status).toBe(404)
  })
})

describe('robot link readiness', () => {
  it('needs an open socket and a recent /boong/orders message', () => {
    let time = 0
    const bridge: Bridge = { isOpen: () => true, subscribe: () => undefined, callService: async () => ({}) }
    let state = EMPTY_STATE
    const link = createRobotLink(bridge, { get: () => state, update: (fn) => { state = fn(state) } }, () => time)
    expect(link.ready()).toBe(false)
    link.onRows('[]')
    expect(link.ready()).toBe(true)
    time = 6000
    expect(link.ready()).toBe(false)
  })
})
