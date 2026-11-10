import type { Flavor } from '../src/domain/menu'
import type { Order, RobotSend } from '../src/domain/order'
import type { ServerState } from './api'
import { applyRows, parseRows } from './rows'

export type Bridge = {
  isOpen(): boolean
  subscribe(topic: string, type: string, onMessage: (msg: unknown) => void): void
  callService(service: string, type: string, args: Record<string, unknown>, timeoutMs: number): Promise<unknown>
}

export type Store = {
  get(): ServerState
  update(change: (state: ServerState) => ServerState): void
}

export type RobotLink = {
  ready(): boolean
  onRows(data: string): void
  send(orderId: string, flavors: readonly Flavor[]): void
  idle(): Promise<void>
}

const CALL_TIMEOUT_MS = 5000
/** order_manager publishes every second; a longer silence means the queue node is gone. */
const ROWS_FRESH_MS = 5000

function withSend(order: Order, flavor: Flavor, send: RobotSend): Order {
  return order.robot ? { ...order, robot: { ...order.robot, sends: { ...order.robot.sends, [flavor]: send } } } : order
}

export function createRobotLink(bridge: Bridge, store: Store, nowMs: () => number): RobotLink {
  let lastRowsAt: number | null = null
  // Orders go out one at a time so the robot queue keeps the order they arrived in.
  let chain: Promise<void> = Promise.resolve()

  const setSend = (orderId: string, flavor: Flavor, send: RobotSend) =>
    store.update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? withSend(o, flavor, send) : o)) }))

  const sendFlavor = async (orderId: string, flavor: Flavor) => {
    const order = store.get().orders.find((o) => o.id === orderId)
    const qty = order?.items.find((i) => i.flavor === flavor)?.qty
    if (!order || !qty) return
    try {
      const args = { order_id: order.id, order_number: order.number, flavor, qty }
      const answer = await bridge.callService('/boong/submit_order', 'boong_interfaces/srv/SubmitOrder', args, CALL_TIMEOUT_MS)
      setSend(orderId, flavor, (answer as { accepted?: unknown }).accepted === true ? 'accepted' : 'failed')
    } catch (e) {
      console.error(`No.${order.number} ${flavor} 전달 실패:`, e)
      setSend(orderId, flavor, 'failed')
    }
  }

  const onRows = (data: string) => {
    lastRowsAt = nowMs()
    const rows = parseRows(data)
    store.update((s) => {
      const orders = applyRows(s.orders, rows)
      return orders.every((o, i) => o === s.orders[i]) ? s : { ...s, orders }
    })
  }

  bridge.subscribe('/boong/orders', 'std_msgs/msg/String', (msg) => {
    const data = (msg as { data?: unknown } | null)?.data
    if (typeof data === 'string') onRows(data)
  })

  return {
    ready: () => bridge.isOpen() && lastRowsAt !== null && nowMs() - lastRowsAt < ROWS_FRESH_MS,
    onRows,
    send(orderId, flavors) {
      chain = flavors.reduce((next, flavor) => next.then(() => sendFlavor(orderId, flavor)), chain)
    },
    idle: () => chain,
  }
}
