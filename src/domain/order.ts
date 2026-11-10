import { MAX_PER_FLAVOR, MAX_TOTAL, MENU, type Flavor } from './menu'
import { pausedMsBetween, type Pause } from './robot'

export type Cart = Partial<Record<Flavor, number>>

export type OrderItem = { flavor: Flavor; qty: number; unitPrice: number }

export const BAKE_STEPS = ['received', 'batter', 'filling', 'baking', 'packed', 'ready'] as const

export type OrderStatus = (typeof BAKE_STEPS)[number]

export type AdminStatus = OrderStatus | 'picked_up' | 'cancelled'

export type Order = {
  id: string
  number: number
  userId: string
  items: OrderItem[]
  memo: string
  total: number
  createdAt: string
  manualStatus?: AdminStatus
  timerStart?: string
  /** Set only when a real robot queue bakes this order; the mock timer is not used then. */
  robot?: OrderRobot
}

export type RobotSend = 'sending' | 'accepted' | 'failed'

export type OrderRobot = {
  sends: Partial<Record<Flavor, RobotSend>>
  steps: Partial<Record<Flavor, OrderStatus>>
  /** Place in the robot queue while waiting; absent once baking starts. */
  queue?: number
  failed?: string
}

export const MEMO_MAX = 50
export const STEP_SECONDS = 8

export const STEP_LABEL: Record<OrderStatus, string> = {
  received: '주문 접수',
  batter: '반죽 붓는 중',
  filling: '속 넣는 중',
  baking: '굽는 중',
  packed: '포장 완료',
  ready: '픽업 대기',
}

export const ADMIN_STATUS_LABEL: Record<AdminStatus, string> = {
  ...STEP_LABEL,
  picked_up: '픽업 완료',
  cancelled: '주문 취소',
}

export function isTerminal(status: AdminStatus): status is 'picked_up' | 'cancelled' {
  return status === 'picked_up' || status === 'cancelled'
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((sum, qty) => sum + (qty ?? 0), 0)
}

export function addToCart(cart: Cart, flavor: Flavor): Cart {
  const current = cart[flavor] ?? 0
  if (current >= MAX_PER_FLAVOR || cartCount(cart) >= MAX_TOTAL) return cart
  return { ...cart, [flavor]: current + 1 }
}

export function removeFromCart(cart: Cart, flavor: Flavor): Cart {
  const current = cart[flavor] ?? 0
  if (current <= 1) {
    const { [flavor]: _removed, ...rest } = cart
    return rest
  }
  return { ...cart, [flavor]: current - 1 }
}

export function canAdd(cart: Cart, flavor: Flavor): boolean {
  return (cart[flavor] ?? 0) < MAX_PER_FLAVOR && cartCount(cart) < MAX_TOTAL
}

export function toOrderItems(cart: Cart): OrderItem[] {
  return MENU.filter((m) => (cart[m.flavor] ?? 0) > 0).map((m) => ({
    flavor: m.flavor,
    qty: cart[m.flavor] ?? 0,
    unitPrice: m.price,
  }))
}

export function cartTotal(cart: Cart): number {
  return toOrderItems(cart).reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
}

function elapsedSeconds(start: string, now: Date, pauses: readonly Pause[]): number {
  return (now.getTime() - Date.parse(start) - pausedMsBetween(pauses, start, now)) / 1000
}

export function statusAt(createdAt: string, now: Date, pauses: readonly Pause[] = []): OrderStatus {
  const elapsed = elapsedSeconds(createdAt, now, pauses)
  const index = Math.min(Math.max(Math.floor(elapsed / STEP_SECONDS), 0), BAKE_STEPS.length - 1)
  return BAKE_STEPS[index]
}

export function secondsLeft(createdAt: string, now: Date, pauses: readonly Pause[] = []): number {
  const total = STEP_SECONDS * (BAKE_STEPS.length - 1)
  const elapsed = elapsedSeconds(createdAt, now, pauses)
  return Math.max(Math.ceil(total - elapsed), 0)
}

export function timerStartOf(order: Order): string {
  return order.timerStart ?? order.createdAt
}

/** One flavor bakes at a time, so an order follows that flavor and is ready only when all are. */
export function robotStep(items: readonly OrderItem[], robot: OrderRobot): OrderStatus {
  const steps = items.map((item) => robot.steps[item.flavor] ?? 'received')
  if (steps.every((step) => step === 'ready')) return 'ready'
  const active = steps.find((step) => step !== 'received' && step !== 'ready')
  if (active) return active
  return steps.includes('ready') ? 'baking' : 'received'
}

export function undelivered(order: Order): OrderItem[] {
  return order.items.filter((item) => order.robot?.sends[item.flavor] === 'failed')
}

export function effectiveStatus(order: Order, now: Date, pauses: readonly Pause[] = []): AdminStatus {
  if (order.manualStatus) return order.manualStatus
  return order.robot ? robotStep(order.items, order.robot) : statusAt(timerStartOf(order), now, pauses)
}

export function buildOrder(fields: { id: string; number: number; userId: string; cart: Cart; memo: string; now: Date }): Order {
  return {
    id: fields.id,
    number: fields.number,
    userId: fields.userId,
    items: toOrderItems(fields.cart),
    memo: fields.memo.trim().slice(0, MEMO_MAX),
    total: cartTotal(fields.cart),
    createdAt: fields.now.toISOString(),
  }
}

export function nextStatus(status: AdminStatus): AdminStatus {
  if (isTerminal(status)) return status
  if (status === 'ready') return 'picked_up'
  return BAKE_STEPS[BAKE_STEPS.indexOf(status) + 1]
}
