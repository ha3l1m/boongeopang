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
}

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

export function effectiveStatus(order: Order, now: Date, pauses: readonly Pause[] = []): AdminStatus {
  return order.manualStatus ?? statusAt(timerStartOf(order), now, pauses)
}

export function nextStatus(status: AdminStatus): AdminStatus {
  if (isTerminal(status)) return status
  if (status === 'ready') return 'picked_up'
  return BAKE_STEPS[BAKE_STEPS.indexOf(status) + 1]
}
