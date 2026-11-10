import { BAKE_STEPS, type Order, type OrderRobot, type OrderStatus } from '../src/domain/order'

/** One row of the JSON array order_manager.py publishes on /boong/orders. */
export type RobotRow = {
  order_id: string
  flavor: string
  state: string
  step: string
  detail: string
  queue_position: number
}

function isRow(value: unknown): value is RobotRow {
  const v = value as RobotRow
  return (
    typeof v === 'object' && v !== null &&
    typeof v.order_id === 'string' && typeof v.flavor === 'string' && typeof v.state === 'string' &&
    typeof v.step === 'string' && typeof v.detail === 'string' && typeof v.queue_position === 'number'
  )
}

export function parseRows(data: string): RobotRow[] {
  try {
    const value: unknown = JSON.parse(data)
    return Array.isArray(value) ? value.filter(isRow) : []
  } catch {
    return []
  }
}

function stepOf(row: RobotRow, previous: OrderStatus | undefined): OrderStatus | undefined {
  if (row.state === 'waiting') return 'received'
  if (row.state === 'done') return 'ready'
  return row.state === 'baking' && BAKE_STEPS.includes(row.step as OrderStatus) ? (row.step as OrderStatus) : previous
}

function applyRow(robot: OrderRobot, row: RobotRow): OrderRobot {
  const flavor = row.flavor as keyof OrderRobot['sends']
  const steps = { ...robot.steps, [flavor]: stepOf(row, robot.steps[flavor]) }
  if (row.state !== 'failed') return { ...robot, steps }
  return { ...robot, steps, sends: { ...robot.sends, [flavor]: 'failed' }, failed: row.detail || '굽기 실패' }
}

function applyToOrder(order: Order, rows: readonly RobotRow[]): Order {
  const robot = order.robot
  if (!robot) return order
  // Rows list the live one before finished ones, so the first row per flavor is the newest.
  const latest = order.items.flatMap((item) => {
    const row = rows.find((r) => r.order_id === order.id && r.flavor === item.flavor)
    return row && robot.sends[item.flavor] === 'accepted' ? [row] : []
  })
  const { queue: _previous, ...base } = robot
  const updated = latest.reduce(applyRow, base as OrderRobot)
  const waiting = latest.filter((r) => r.state === 'waiting' && r.queue_position > 0).map((r) => r.queue_position)
  const baking = latest.some((r) => r.state === 'baking')
  const next: OrderRobot = waiting.length > 0 && !baking ? { ...updated, queue: Math.min(...waiting) } : updated
  return JSON.stringify(next) === JSON.stringify(robot) ? order : { ...order, robot: next }
}

/** Keeps the last known step when rows age out of the robot's short history. */
export function applyRows(orders: readonly Order[], rows: readonly RobotRow[]): Order[] {
  return orders.map((order) => applyToOrder(order, rows))
}
