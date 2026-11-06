// Mock robot control. Replace with rosbridge (/boong/orders topic, estop service) when the robot is wired up.
import { INITIAL_ROBOT, type Ingredient, type Pause, type RobotAlertKind, type RobotState } from '../domain/robot'
import { readJson, writeJson } from './storage'

const ROBOT_KEY = 'boong:robot'

function isRobotState(value: unknown): value is RobotState {
  const v = value as RobotState
  return typeof v === 'object' && v !== null && typeof v.estop === 'boolean' && Array.isArray(v.pauses) && typeof v.refilledAt === 'object'
}

export function readRobot(): RobotState {
  const value = readJson<unknown>(ROBOT_KEY, null)
  return isRobotState(value) ? value : INITIAL_ROBOT
}

function save(state: RobotState): RobotState {
  writeJson(ROBOT_KEY, state)
  return state
}

function openPause(pauses: readonly Pause[], now: Date): Pause[] {
  return pauses.some((p) => !p.to) ? [...pauses] : [...pauses, { from: now.toISOString() }]
}

function closePause(pauses: readonly Pause[], now: Date): Pause[] {
  return pauses.map((p) => (p.to ? p : { ...p, to: now.toISOString() }))
}

export function emergencyStop(now: Date = new Date()): RobotState {
  const state = readRobot()
  return save({ ...state, estop: true, pauses: openPause(state.pauses, now) })
}

export function resumeRobot(now: Date = new Date()): RobotState {
  const state = readRobot()
  return save({ ...state, estop: false, pauses: state.alert ? state.pauses : closePause(state.pauses, now) })
}

export function raiseAlert(kind: RobotAlertKind, orderId: string, now: Date = new Date()): RobotState {
  const state = readRobot()
  return save({ ...state, alert: { kind, orderId, at: now.toISOString() }, pauses: openPause(state.pauses, now) })
}

export function resolveAlert(now: Date = new Date()): RobotState {
  const { alert: _resolved, ...state } = readRobot()
  return save({ ...state, pauses: state.estop ? state.pauses : closePause(state.pauses, now) })
}

export function refill(ingredient: Ingredient, now: Date = new Date()): RobotState {
  const state = readRobot()
  return save({ ...state, refilledAt: { ...state.refilledAt, [ingredient]: now.toISOString() } })
}
