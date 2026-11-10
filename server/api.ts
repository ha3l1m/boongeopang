import { isFeedback, type Feedback } from '../src/domain/feedback'
import { MAX_PER_FLAVOR, MAX_TOTAL, ROBOT_FLAVORS, type Flavor } from '../src/domain/menu'
import { BAKE_STEPS, buildOrder, cartCount, isTerminal, undelivered, type AdminStatus, type Cart, type Order } from '../src/domain/order'
import { INITIAL_ROBOT, findShortage, isRobotState, stockLeft, type RobotState } from '../src/domain/robot'
import type { RobotLink, Store } from './robotLink'

export type ServerState = { orders: Order[]; feedback: Feedback[]; robot: RobotState }
export type ApiResponse = { status: number; body: unknown }

export const EMPTY_STATE: ServerState = { orders: [], feedback: [], robot: INITIAL_ROBOT }

const USER_ID_MAX = 64
const ROBOT_DOWN = '붕봇 연결 중이에요. 잠시 후 다시 주문해 줘요'
const STATUSES: readonly AdminStatus[] = [...BAKE_STEPS, 'picked_up', 'cancelled']

const fail = (status: number, error: string): ApiResponse => ({ status, body: { error } })

function parseCart(value: unknown): Cart | null {
  if (typeof value !== 'object' || value === null) return null
  const entries = Object.entries(value)
  const valid = entries.every(
    ([flavor, qty]) => ROBOT_FLAVORS.includes(flavor as Flavor) && Number.isInteger(qty) && qty >= 1 && qty <= MAX_PER_FLAVOR,
  )
  if (!valid || entries.length === 0) return null
  const cart = value as Cart
  return cartCount(cart) <= MAX_TOTAL ? cart : null
}

/** A send interrupted by a server restart may or may not have arrived: show it as resendable. */
export function recoverSending(state: ServerState): ServerState {
  const recover = (order: Order): Order => {
    if (!order.robot) return order
    const sends = Object.fromEntries(
      Object.entries(order.robot.sends).map(([flavor, send]) => [flavor, send === 'sending' ? 'failed' : send]),
    )
    return { ...order, robot: { ...order.robot, sends } }
  }
  return { ...state, orders: state.orders.map(recover) }
}

export function createApi(store: Store, link: RobotLink, now: () => Date, newId: () => string) {
  const placeOrder = (input: unknown): ApiResponse => {
    const { userId, cart: rawCart, memo } = (input ?? {}) as { userId?: unknown; cart?: unknown; memo?: unknown }
    const cart = parseCart(rawCart)
    if (typeof userId !== 'string' || !userId || userId.length > USER_ID_MAX || !cart) return fail(400, '주문 내용이 올바르지 않아요')
    if (!link.ready()) return fail(503, ROBOT_DOWN)

    const { orders, robot } = store.get()
    const at = now()
    const base = buildOrder({
      id: newId(),
      number: orders.reduce((max, o) => Math.max(max, o.number), 0) + 1,
      userId,
      cart,
      memo: typeof memo === 'string' ? memo : '',
      now: at,
    })
    const short = findShortage(base.items, stockLeft(orders, robot.refilledAt, at))
    if (short) return fail(409, `재료가 부족해요 (${short.name})`)

    const flavors = base.items.map((i) => i.flavor)
    const order: Order = {
      ...base,
      robot: { sends: Object.fromEntries(flavors.map((f) => [f, 'sending'])), steps: {} },
    }
    store.update((s) => ({ ...s, orders: [...s.orders, order] }))
    link.send(order.id, flavors)
    return { status: 201, body: order }
  }

  const replaceOrder = (next: Order) =>
    store.update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === next.id ? next : o)) }))

  const resend = (order: Order): ApiResponse => {
    const flavors = undelivered(order).map((i) => i.flavor)
    if (flavors.length === 0 || !order.robot || (order.manualStatus && isTerminal(order.manualStatus))) {
      return fail(409, '다시 보낼 맛이 없어요')
    }
    if (!link.ready()) return fail(503, ROBOT_DOWN)
    const { failed: _cleared, ...robot } = order.robot
    const sends = { ...robot.sends, ...Object.fromEntries(flavors.map((f) => [f, 'sending'])) }
    replaceOrder({ ...order, robot: { ...robot, sends } })
    link.send(order.id, flavors)
    return { status: 202, body: {} }
  }

  const patchOrder = (order: Order, input: unknown): ApiResponse => {
    const { manualStatus, timerStart } = (input ?? {}) as { manualStatus?: unknown; timerStart?: unknown }
    const validStatus = manualStatus === undefined || manualStatus === null || STATUSES.includes(manualStatus as AdminStatus)
    if (!validStatus || (timerStart !== undefined && typeof timerStart !== 'string')) return fail(400, '바꿀 수 없는 값이에요')
    const { manualStatus: previous, ...rest } = order
    const status = manualStatus === undefined ? previous : ((manualStatus ?? undefined) as AdminStatus | undefined)
    const next: Order = { ...rest, ...(status && { manualStatus: status }), ...(timerStart !== undefined && { timerStart: timerStart as string }) }
    replaceOrder(next)
    return { status: 200, body: next }
  }

  const addFeedback = (input: unknown): ApiResponse => {
    if (!isFeedback(input)) return fail(400, '피드백이 올바르지 않아요')
    const { orders, feedback } = store.get()
    if (!orders.some((o) => o.id === input.orderId)) return fail(404, '주문을 찾을 수 없어요')
    if (feedback.some((f) => f.orderId === input.orderId)) return fail(409, '이미 피드백을 보냈어요')
    store.update((s) => ({ ...s, feedback: [...s.feedback, input] }))
    return { status: 201, body: input }
  }

  const putRobot = (input: unknown): ApiResponse => {
    if (!isRobotState(input)) return fail(400, '붕봇 상태가 올바르지 않아요')
    store.update((s) => ({ ...s, robot: input }))
    return { status: 200, body: input }
  }

  const withOrder = (id: string, action: (order: Order) => ApiResponse): ApiResponse => {
    const order = store.get().orders.find((o) => o.id === id)
    return order ? action(order) : fail(404, '주문을 찾을 수 없어요')
  }

  return (method: string, path: string, body: unknown): ApiResponse => {
    const route = `${method} ${path}`
    if (route === 'GET /api/state') return { status: 200, body: { ...store.get(), robotReady: link.ready() } }
    if (route === 'POST /api/orders') return placeOrder(body)
    if (route === 'POST /api/feedback') return addFeedback(body)
    if (route === 'PUT /api/robot') return putRobot(body)
    const resendPath = /^POST \/api\/orders\/([^/]+)\/resend$/.exec(route)
    if (resendPath) return withOrder(resendPath[1], resend)
    const patchPath = /^PATCH \/api\/orders\/([^/]+)$/.exec(route)
    if (patchPath) return withOrder(patchPath[1], (order) => patchOrder(order, body))
    return fail(404, '없는 경로예요')
  }
}
