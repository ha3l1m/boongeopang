import { MENU, type Flavor } from './menu'
import type { AdminStatus, Order, OrderItem } from './order'

export type Ingredient = 'batter' | Flavor

export const INGREDIENTS: readonly { key: Ingredient; name: string; capacity: number }[] = [
  { key: 'batter', name: '반죽', capacity: 100 },
  ...MENU.map((m) => ({ key: m.flavor, name: m.fillingName, capacity: 40 })),
]

export const LOW_STOCK_RATIO = 0.2

export type RobotAlertKind = 'overpour' | 'missing_filling' | 'burnt' | 'gripper'

export const ALERT_LABEL: Record<RobotAlertKind, string> = {
  overpour: '반죽이 너무 많이 부어졌어요',
  missing_filling: '속이 안 들어갔어요',
  burnt: '붕어빵이 너무 탔어요',
  gripper: '그리퍼가 붕어빵을 놓쳤어요',
}

/** Alerts the robot can actually detect without extra sensors (see robot plan §3-1). */
export const ALERT_DETECTABLE: Record<RobotAlertKind, boolean> = {
  gripper: true,
  burnt: true,
  overpour: false,
  missing_filling: false,
}

export type Pause = { from: string; to?: string }
export type RobotAlert = { kind: RobotAlertKind; orderId: string; at: string }

export type RobotState = {
  estop: boolean
  alert?: RobotAlert
  pauses: Pause[]
  refilledAt: Partial<Record<Ingredient, string>>
}

export const INITIAL_ROBOT: RobotState = { estop: false, pauses: [], refilledAt: {} }

export function isRobotState(value: unknown): value is RobotState {
  const v = value as RobotState
  return typeof v === 'object' && v !== null && typeof v.estop === 'boolean' && Array.isArray(v.pauses) && typeof v.refilledAt === 'object'
}

export function findShortage(items: readonly OrderItem[], left: Record<Ingredient, number>): { name: string } | undefined {
  return INGREDIENTS.find(({ key }) => items.reduce((sum, i) => sum + (key === 'batter' || i.flavor === key ? i.qty : 0), 0) > left[key])
}

export function isPaused(state: RobotState): boolean {
  return state.estop || Boolean(state.alert)
}

export function pausedMsBetween(pauses: readonly Pause[], startIso: string, now: Date): number {
  const start = Date.parse(startIso)
  const end = now.getTime()
  return pauses.reduce((sum, p) => {
    const from = Math.max(Date.parse(p.from), start)
    const to = Math.min(p.to ? Date.parse(p.to) : end, end)
    return sum + Math.max(to - from, 0)
  }, 0)
}

function startOfDay(day: Date): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
}

function usedOf(order: Order, key: Ingredient): number {
  return order.items.reduce((sum, item) => sum + (key === 'batter' || item.flavor === key ? item.qty : 0), 0)
}

export function stockLeft(
  orders: readonly Order[],
  refilledAt: RobotState['refilledAt'],
  now: Date,
): Record<Ingredient, number> {
  const dayStart = startOfDay(now)
  const counted = orders.filter((o) => o.manualStatus !== 'cancelled')
  const entries = INGREDIENTS.map(({ key, capacity }) => {
    const since = Math.max(dayStart, refilledAt[key] ? Date.parse(refilledAt[key]) : 0)
    const used = counted
      .filter((o) => Date.parse(o.createdAt) >= since)
      .reduce((sum, o) => sum + usedOf(o, key), 0)
    return [key, Math.max(capacity - used, 0)] as const
  })
  return Object.fromEntries(entries) as Record<Ingredient, number>
}

const ROBOT_DONE: readonly AdminStatus[] = ['packed', 'ready', 'picked_up', 'cancelled']

export function currentJob(rows: readonly { order: Order; status: AdminStatus }[]): {
  current: Order | null
  waiting: number
} {
  const live = rows
    .filter((r) => !ROBOT_DONE.includes(r.status))
    .map((r) => r.order)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number)
  return { current: live[0] ?? null, waiting: Math.max(live.length - 1, 0) }
}
