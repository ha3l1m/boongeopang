import { MENU, type Flavor } from '../domain/menu'
import { buildOrder, toOrderItems, type AdminStatus, type Cart, type Order } from '../domain/order'
import { findShortage, stockLeft } from '../domain/robot'
import { newId } from './id'
import { ORDERS_KEY, pushOrderPatch, remoteMode, requestOrder } from './remoteSync'
import { readJson, writeJson } from './storage'
import { readRobot } from './robotService'

function allOrders(): Order[] {
  const value = readJson<unknown>(ORDERS_KEY, [])
  return Array.isArray(value) ? (value as Order[]) : []
}

export function createOrder(userId: string, cart: Cart, memo: string, now: Date = new Date()): Order {
  const items = toOrderItems(cart)
  if (items.length === 0) throw new Error('한 마리 이상 골라줘요')
  const orders = allOrders()
  const left = stockLeft(orders, readRobot().refilledAt, now)
  const short = findShortage(items, left)
  if (short) throw new Error(`재료가 부족해요 (${short.name})`)
  const lastNumber = orders.reduce((max, o) => Math.max(max, o.number), 0)
  const order = buildOrder({ id: newId(), number: lastNumber + 1, userId, cart, memo, now })
  writeJson(ORDERS_KEY, [...orders, order])
  return order
}

/** The customer flow: the local mock, or the server that numbers the order and sends it to the robot. */
export async function placeOrder(userId: string, cart: Cart, memo: string): Promise<Order> {
  if (!remoteMode()) return createOrder(userId, cart, memo)
  const order = await requestOrder(userId, cart, memo)
  writeJson(ORDERS_KEY, [...allOrders(), order])
  return order
}

export function listOrders(userId: string): Order[] {
  return allOrders()
    .filter((o) => o.userId === userId)
    .sort(newestFirst)
}

export function getOrder(userId: string, id: string): Order | null {
  return allOrders().find((o) => o.id === id && o.userId === userId) ?? null
}

const newestFirst = (a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number

export function listAllOrders(): Order[] {
  return [...allOrders()].sort(newestFirst)
}

export function setOrderStatus(id: string, status: AdminStatus): Order {
  const orders = allOrders()
  const target = orders.find((o) => o.id === id)
  if (!target) throw new Error('주문을 찾을 수 없어요')
  const updated: Order = { ...target, manualStatus: status }
  writeJson(ORDERS_KEY, orders.map((o) => (o.id === id ? updated : o)))
  if (remoteMode()) pushOrderPatch(id, { manualStatus: status })
  return updated
}

export type DaySummary = { orders: number; cancelled: number; sales: number; byFlavor: Record<Flavor, number> }

function sameLocalDay(iso: string, day: Date): boolean {
  return new Date(iso).toDateString() === day.toDateString()
}

export function summarizeDay(orders: readonly Order[], day: Date): DaySummary {
  const today = orders.filter((o) => sameLocalDay(o.createdAt, day))
  const live = today.filter((o) => o.manualStatus !== 'cancelled')
  const emptyCounts = Object.fromEntries(MENU.map((m) => [m.flavor, 0])) as Record<Flavor, number>
  const byFlavor = live
    .flatMap((o) => o.items)
    .reduce((acc, item) => ({ ...acc, [item.flavor]: acc[item.flavor] + item.qty }), emptyCounts)
  return {
    orders: live.length,
    cancelled: today.length - live.length,
    sales: live.reduce((sum, o) => sum + o.total, 0),
    byFlavor,
  }
}

export function restartOrder(id: string, now: Date = new Date()): Order {
  const orders = allOrders()
  const target = orders.find((o) => o.id === id)
  if (!target) throw new Error('주문을 찾을 수 없어요')
  const { manualStatus: _cleared, ...rest } = target
  const updated: Order = { ...rest, timerStart: now.toISOString() }
  writeJson(ORDERS_KEY, orders.map((o) => (o.id === id ? updated : o)))
  if (remoteMode()) pushOrderPatch(id, { manualStatus: null, timerStart: now.toISOString() })
  return updated
}
