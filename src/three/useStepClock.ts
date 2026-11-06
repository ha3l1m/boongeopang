import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { SceneMode } from './sceneMode'

/**
 * Seconds since the current step (or preview cue) began, kept in a ref and updated every frame.
 * Call it before your own useFrame so the value is fresh when you read it.
 */
export function useStepClock(mode: SceneMode, cue: number) {
  const clock = useRef({ mode, cue, since: -1, elapsed: 0 })
  useFrame(({ clock: { elapsedTime: t } }) => {
    const c = clock.current
    if (c.mode !== mode || c.cue !== cue || c.since < 0) clock.current = { mode, cue, since: t, elapsed: 0 }
    clock.current.elapsed = t - clock.current.since
  })
  return clock
}
