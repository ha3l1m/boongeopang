// With VITE_ROBOT_MODE=ros the server holds the shared state. localStorage stays the read cache,
// so pages keep reading synchronously: polls fill it, and writes update it and then reach the server.
import { useSyncExternalStore } from 'react'
import { isFeedback, type Feedback } from '../domain/feedback'
import { ROBOT_FLAVORS, type Flavor } from '../domain/menu'
import type { AdminStatus, Cart, Order } from '../domain/order'
import { isRobotState, type RobotState } from '../domain/robot'
import { writeJson } from './storage'

export const ORDERS_KEY = 'boong:orders'
export const FEEDBACK_KEY = 'boong:feedback'
export const ROBOT_KEY = 'boong:robot'

const POLL_MS = 1000
const UNREACHABLE = '붕봇 서버에 닿지 못했어요. 잠시 후 다시 시도해 줘요'

export function remoteMode(): boolean {
  return import.meta.env.VITE_ROBOT_MODE === 'ros'
}

/** The robot only has bottles for some flavors; the mock can bake anything. */
export function canOrderFlavor(flavor: Flavor): boolean {
  return !remoteMode() || ROBOT_FLAVORS.includes(flavor)
}

// ---- connection state --------------------------------------------------
let linkUp = true
let listeners: readonly (() => void)[] = []

function setLinkUp(next: boolean) {
  if (next === linkUp) return
  linkUp = next
  listeners.forEach((listener) => listener())
}

function subscribeLink(listener: () => void) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function useRobotLinkUp(): boolean {
  return useSyncExternalStore(subscribeLink, () => linkUp)
}

// ---- writes -------------------------------------------------------------
let writesInFlight = 0

async function request(method: string, path: string, body: unknown): Promise<Response> {
  writesInFlight += 1
  try {
    return await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } finally {
    writesInFlight -= 1
  }
}

async function errorOf(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null
  return new Error(typeof body?.error === 'string' ? body.error : UNREACHABLE)
}

/** Status and stock changes keep working locally; a failure shows as the link banner, and the next poll restores the truth. */
function push(method: string, path: string, body: unknown): void {
  request(method, path, body).then(
    (res) => { if (res.status >= 500) setLinkUp(false) },
    () => setLinkUp(false),
  )
}

export function pushOrderPatch(id: string, patch: { manualStatus?: AdminStatus | null; timerStart?: string }): void {
  push('PATCH', `/api/orders/${encodeURIComponent(id)}`, patch)
}

export function pushFeedback(feedback: Feedback): void {
  push('POST', '/api/feedback', feedback)
}

export function pushRobot(state: RobotState): void {
  push('PUT', '/api/robot', state)
}

export async function requestOrder(userId: string, cart: Cart, memo: string): Promise<Order> {
  const res = await request('POST', '/api/orders', { userId, cart, memo }).catch(() => {
    throw new Error(UNREACHABLE)
  })
  if (!res.ok) throw await errorOf(res)
  return (await res.json()) as Order
}

export async function resendOrder(id: string): Promise<void> {
  const res = await request('POST', `/api/orders/${encodeURIComponent(id)}/resend`, {}).catch(() => {
    throw new Error(UNREACHABLE)
  })
  if (!res.ok) throw await errorOf(res)
}

// ---- reads --------------------------------------------------------------
function applySnapshot(value: unknown): boolean {
  const v = value as { orders?: unknown; feedback?: unknown; robot?: unknown; robotReady?: unknown } | null
  if (!v || !Array.isArray(v.orders) || !Array.isArray(v.feedback) || !isRobotState(v.robot)) return false
  writeJson(ORDERS_KEY, v.orders)
  writeJson(FEEDBACK_KEY, v.feedback.filter(isFeedback))
  writeJson(ROBOT_KEY, v.robot)
  return v.robotReady === true
}

async function poll(): Promise<void> {
  // A poll racing a write could bring back the state from before it.
  if (writesInFlight > 0) return
  try {
    const res = await fetch('/api/state', { cache: 'no-store' })
    if (writesInFlight > 0) return
    setLinkUp(res.ok && applySnapshot(await res.json()))
  } catch {
    setLinkUp(false)
  }
}

export function startSync(intervalMs: number = POLL_MS): () => void {
  void poll()
  const timer = setInterval(() => void poll(), intervalMs)
  return () => clearInterval(timer)
}
