import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { watchingCaddy } from './pourTimeline'
import { BAKE_SPIN, type SceneMode } from './sceneMode'

type Shot = { pos: [number, number, number]; look: [number, number, number] }

/** Camera shots in scene space (before the scene's vertical offset). */
const SHOTS = {
  wide: { pos: [0, 2.75, 6.2], look: [0.2, 1.0, 0] },
  robot: { pos: [-0.4, 2.2, 4.4], look: [-0.5, 1.4, 0] },
  pick: { pos: [-0.9, 1.95, 4.1], look: [-1.35, 0.65, 0.6] },
  pour: { pos: [0.55, 2.3, 2.55], look: [0.25, 0.8, 0.1] },
  spin: { pos: [0.35, 1.7, 3.2], look: [0.3, 0.6, 0.15] },
  reveal: { pos: [0.3, 2.35, 1.55], look: [0.3, 0.62, 0.1] },
  pack: { pos: [1.15, 1.95, 4.0], look: [1.4, 0.95, 0.1] },
  ready: { pos: [1.68, 1.75, 3.5], look: [1.68, 1.6, 0.2] },
} satisfies Record<string, Shot>

function shotFor(mode: SceneMode, elapsed: number): Shot {
  switch (mode) {
    case 'received':
      return SHOTS.robot
    case 'batter':
    case 'filling':
      return watchingCaddy(elapsed) ? SHOTS.pick : SHOTS.pour
    case 'baking':
      return elapsed < BAKE_SPIN ? SHOTS.spin : SHOTS.reveal
    case 'packed':
      return SHOTS.pack
    case 'ready':
      return SHOTS.ready
    default:
      return SHOTS.wide
  }
}

export function CameraRig({ mode, cue, offsetY }: { mode: SceneMode; cue: number; offsetY: number }) {
  const look = useRef(new Vector3(...SHOTS.wide.look).setY(SHOTS.wide.look[1] + offsetY))
  const started = useRef({ mode, cue, since: -1 })
  const goal = useRef(new Vector3())
  const goalLook = useRef(new Vector3())

  useFrame(({ camera, clock }, delta) => {
    const t = clock.elapsedTime
    const s = started.current
    if (s.mode !== mode || s.cue !== cue || s.since < 0) started.current = { mode, cue, since: t }
    const shot = shotFor(mode, t - started.current.since)
    const k = 1 - Math.exp(-2.6 * delta)
    goal.current.set(shot.pos[0], shot.pos[1] + offsetY, shot.pos[2])
    goalLook.current.set(shot.look[0], shot.look[1] + offsetY, shot.look[2])
    camera.position.lerp(goal.current, k)
    look.current.lerp(goalLook.current, k)
    camera.lookAt(look.current)
  })
  return null
}
