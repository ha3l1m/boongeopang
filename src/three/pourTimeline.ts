/**
 * Seconds since the batter/filling step started. One shared clock so the arm, the mold and the camera stay in sync:
 * hover over the bottle in the caddy, grab it, lift, carry it over cavity A and pour, move to cavity B and pour,
 * then carry it back, set it down and let go. Everything finishes before the next live step (8s).
 */
export const POUR_TIMELINE = {
  hover: 0.8,
  grip: 1.1,
  lift: 1.4,
  carry: 1.8,
  pourA: [2.5, 4.1],
  moveB: 4.3,
  pourB: [4.9, 6.4],
  back: 6.6,
  place: 7.2,
  release: 7.55,
  rise: 7.7,
} as const

export type ArmTarget = 'above' | 'grab' | 'cavityA' | 'cavityB'

export function armTarget(elapsed: number): ArmTarget {
  const t = POUR_TIMELINE
  if (elapsed < t.hover) return 'above'
  if (elapsed < t.lift) return 'grab'
  if (elapsed < t.carry) return 'above'
  if (elapsed < t.moveB) return 'cavityA'
  if (elapsed < t.back) return 'cavityB'
  if (elapsed < t.place) return 'above'
  if (elapsed < t.rise) return 'grab'
  return 'above'
}

export function holdingBottle(elapsed: number): boolean {
  return elapsed >= POUR_TIMELINE.grip && elapsed < POUR_TIMELINE.release
}

const POURS = [POUR_TIMELINE.pourA, POUR_TIMELINE.pourB] as const

/** Which cavity the stream is falling into right now, if any. */
export function flowingCavity(elapsed: number): 0 | 1 | null {
  if (elapsed >= POURS[0][0] && elapsed < POURS[0][1]) return 0
  if (elapsed >= POURS[1][0] && elapsed < POURS[1][1]) return 1
  return null
}

/** How full a cavity is (0..1) at this moment of its pour. */
export function fillProgress(elapsed: number, cavity: 0 | 1): number {
  const [from, to] = POURS[cavity]
  return Math.min(Math.max((elapsed - from) / (to - from), 0), 1)
}

function smooth(x: number, from: number, to: number): number {
  const k = Math.min(Math.max((x - from) / (to - from), 0), 1)
  return k * k * (3 - 2 * k)
}

/** 0 = bottle upright (as it stands in the caddy), 1 = nozzle-down for pouring. */
export function bottleFlip(elapsed: number): number {
  const t = POUR_TIMELINE
  return smooth(elapsed, t.carry, t.pourA[0] - 0.1) - smooth(elapsed, t.back, t.place - 0.1)
}

/** The camera watches the caddy while the bottle is picked up or put back, and the mold while pouring. */
export function watchingCaddy(elapsed: number): boolean {
  return elapsed < POUR_TIMELINE.carry || elapsed >= POUR_TIMELINE.back + 0.2
}

/**
 * Still scenes: no clock runs. Every 3D scene shows the end state of its step, which is the moment after the whole
 * pour routine has finished (so the bottle is back in the caddy, the mold is full, and the bake is done).
 */
export const SETTLED_ELAPSED = POUR_TIMELINE.rise + 1
