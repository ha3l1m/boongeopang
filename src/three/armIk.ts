export type ArmAngles = { yaw: number; shoulder: number; elbow: number }

export type ArmSpec = {
  /** Where the base sits on the counter. */
  base: readonly [number, number, number]
  /** Height of the shoulder pivot above the base. */
  shoulderY: number
  upper: number
  fore: number
}

/**
 * Joint angles that put the wrist on `target`, elbow up.
 * Conventions match the scene graph: yaw is the base's rotation.y (arm plane points along local +x),
 * shoulder/elbow are rotation.z, so leaning toward +x is a negative angle.
 */
export function solveArm(target: readonly [number, number, number], { base, shoulderY, upper, fore }: ArmSpec): ArmAngles {
  const dx = target[0] - base[0]
  const dz = target[2] - base[2]
  const yaw = Math.atan2(-dz, dx)
  const r = Math.hypot(dx, dz)
  const h = target[1] - base[1] - shoulderY
  const d = Math.hypot(r, h)
  const cos = (d * d - upper * upper - fore * fore) / (2 * upper * fore)
  const elbow = -Math.acos(Math.min(Math.max(cos, -1), 1))
  const reach = Math.atan2(-r, h)
  const bend = Math.atan2(fore * Math.sin(elbow), upper + fore * Math.cos(elbow))
  return { yaw, shoulder: reach - bend, elbow }
}
