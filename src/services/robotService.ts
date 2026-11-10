// Mock robot control. Replace with rosbridge (/boong/orders topic, estop service) when the robot is wired up.
import { INITIAL_ROBOT, isRobotState, type Ingredient, type Pause, type RobotAlertKind, type RobotState } from '../domain/robot'
import { ROBOT_KEY, pushRobot, remoteMode } from './remoteSync'
import { readJson, writeJson } from './storage'

export function readRobot(): RobotState {
  const value = readJson<unknown>(ROBOT_KEY, null)
  return isRobotState(value) ? value : INITIAL_ROBOT
}

function save(state: RobotState): RobotState {
  writeJson(ROBOT_KEY, state)
  if (remoteMode()) pushRobot(state)
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
