import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { SETTLED_ELAPSED, watchingCaddy } from './pourTimeline'
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

/** Still camera: placed once on the settled shot for the mode, no easing between shots. */
export function CameraRig({ mode, offsetY }: { mode: SceneMode; cue: number; offsetY: number }) {
  const camera = useThree((state) => state.camera)
  const shot = shotFor(mode, SETTLED_ELAPSED)

  useEffect(() => {
    camera.position.set(shot.pos[0], shot.pos[1] + offsetY, shot.pos[2])
    camera.lookAt(shot.look[0], shot.look[1] + offsetY, shot.look[2])
  }, [camera, shot, offsetY])

  return null
}
