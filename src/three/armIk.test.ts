import { describe, expect, it } from 'vitest'
import { solveArm, type ArmAngles } from './armIk'

const L1 = 1.15
const L2 = 1.05
const BASE: [number, number, number] = [-1.1, 0, 0.15]
const SHOULDER_Y = 0.55

/** Forward kinematics with the same conventions the scene uses (rotation.y then rotation.z). */
function wristOf({ yaw, shoulder, elbow }: ArmAngles): [number, number, number] {
  const r = -L1 * Math.sin(shoulder) - L2 * Math.sin(shoulder + elbow)
  const y = SHOULDER_Y + L1 * Math.cos(shoulder) + L2 * Math.cos(shoulder + elbow)
  return [BASE[0] + r * Math.cos(yaw), y, BASE[2] - r * Math.sin(yaw)]
}

const arm = { base: BASE, shoulderY: SHOULDER_Y, upper: L1, fore: L2 }

describe('solveArm', () => {
  it.each([
    [[0.3, 1.89, 0.15]],
    [[-1.6, 0.61, 0.95]],
    [[-1.9, 0.61, 1.15]],
    [[-0.2, 2.2, -0.6]],
  ] as [number, number, number][][])('reaches %j', (target) => {
    const angles = solveArm(target, arm)
    wristOf(angles).forEach((v, i) => expect(v).toBeCloseTo(target[i], 5))
  })

  it('bends elbow-up so the forearm reaches down to the target', () => {
    const { elbow } = solveArm([0.3, 1.89, 0.15], arm)
    expect(elbow).toBeLessThan(0)
  })

  it('stretches straight toward a target that is out of reach instead of returning NaN', () => {
    const angles = solveArm([5, 0.55, 0.15], arm)
    expect(Number.isFinite(angles.shoulder)).toBe(true)
    expect(angles.elbow).toBeCloseTo(0, 5)
  })
})
