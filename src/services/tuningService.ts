// Mock robot tuning store. Replace applyParam with a rosbridge parameter set when the robot is wired up.
import { recommend, type Recommendation } from '../domain/feedback'
import { DEFAULT_TUNING, PARAMS, clampParam, paramSpec, type ParamId, type Tuning } from '../domain/tuning'
import { listFeedback } from './feedbackService'
import { listAllOrders } from './orderService'
import { readJson, writeJson } from './storage'

const TUNING_KEY = 'boong:tuning'

export type TuningChange = { param: ParamId; from: number; to: number; at: string }
export type TuningState = { values: Tuning; history: TuningChange[] }

function isTuningState(value: unknown): value is TuningState {
  const v = value as TuningState
  return typeof v === 'object' && v !== null && typeof v.values === 'object' && v.values !== null && Array.isArray(v.history)
}

export function readTuning(): TuningState {
  const value = readJson<unknown>(TUNING_KEY, null)
  if (!isTuningState(value)) return { values: DEFAULT_TUNING, history: [] }
  // fill params added after the value was saved
  return { values: { ...DEFAULT_TUNING, ...value.values }, history: value.history }
}

export function applyParam(id: ParamId, value: number, now: Date = new Date()): TuningState {
  const state = readTuning()
  const to = clampParam(paramSpec(id), value)
  const change: TuningChange = { param: id, from: state.values[id], to, at: now.toISOString() }
  const next: TuningState = { values: { ...state.values, [id]: to }, history: [change, ...state.history] }
  writeJson(TUNING_KEY, next)
  return next
}

/** Marks feedback up to now as used without changing the value (사장님이 무시). */
export function dismissParam(id: ParamId, now: Date = new Date()): TuningState {
  const state = readTuning()
  return applyParam(id, state.values[id], now)
}

function lastAppliedAt(state: TuningState, id: ParamId): string | undefined {
  return state.history.find((c) => c.param === id)?.at
}

function orderCounts(): Record<string, number> {
  return listAllOrders()
    .filter((o) => o.manualStatus !== 'cancelled')
    .reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.userId]: (acc[o.userId] ?? 0) + 1 }), {})
}

export function recommendations(now: Date = new Date()): Recommendation[] {
  const state = readTuning()
  const feedback = listFeedback()
  const counts = orderCounts()
  return PARAMS.map((spec) => recommend(spec, feedback, state.values, lastAppliedAt(state, spec.id), now, counts))
}
