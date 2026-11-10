import { useMemo } from 'react'
import { ExtrudeGeometry } from 'three'
import { BATTER } from './BottleCaddy'
import { Fish3D, fishOutline } from './Fish3D'
import { fillProgress, SETTLED_ELAPSED } from './pourTimeline'
import { BAKE_SPIN, type SceneMode } from './sceneMode'

/** Fish body centre in the fish's own x, where batter lands and filling piles up. */
export const BODY_CENTER_X = 0.22
const BEANS = 14

export function useFlatFish(depth = 0.02): ExtrudeGeometry {
  return useMemo(() => {
    const geometry = new ExtrudeGeometry(fishOutline(), { depth, bevelEnabled: false, curveSegments: 40 })
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [depth])
}

function batterLevel(mode: SceneMode, elapsed: number, cavity: 0 | 1): number {
  if (mode === 'batter') return fillProgress(elapsed, cavity)
  if (mode === 'filling') return 1
  if (mode === 'baking') return elapsed < BAKE_SPIN ? 1 : 0
  return 0
}

function beanLevel(mode: SceneMode, elapsed: number, cavity: 0 | 1): number {
  if (mode === 'filling') return fillProgress(elapsed, cavity)
  if (mode === 'baking') return elapsed < BAKE_SPIN ? 1 : 0
  return 0
}

function bakedShown(mode: SceneMode, elapsed: number, cavity: 0 | 1): boolean {
  if (mode === 'baking') return elapsed >= BAKE_SPIN
  // While packing, fish A is already flying to grandma; fish B waits in the mold.
  return mode === 'packed' && cavity === 1
}

/** Bean pile spots spread on a sunflower spiral so the pile looks hand-heaped. */
const BEAN_SPOTS = Array.from({ length: BEANS }, (_, i) => {
  const a = i * 2.4
  const r = Math.sqrt(i / BEANS)
  return { x: Math.cos(a) * r * 0.12, z: Math.sin(a) * r * 0.08, y: (1 - r) * 0.035, size: 0.026 + ((i * 7) % 5) * 0.003 }
})

/**
 * What sits in one cavity (in the cavity's mirrored fish space, face level at y=0), frozen at the step's end state:
 * batter filled to the rim, a heap of filling, and the baked fish after the bake.
 */
export function CavityContents({ cavity, mode, filling, scale }: { cavity: 0 | 1; mode: SceneMode; filling: string; scale: number }) {
  const flatFish = useFlatFish(0.03)
  const level = batterLevel(mode, SETTLED_ELAPSED, cavity)
  const batterScale = level > 0 ? 0.2 + level * 0.8 : 0.001
  const beanLevelNow = beanLevel(mode, SETTLED_ELAPSED, cavity)
  const bodyX = BODY_CENTER_X * scale
  return (
    <group>
      <group position={[bodyX, 0.004, 0]} scale={[batterScale, 1, batterScale]} visible={level > 0}>
        <mesh geometry={flatFish} position={[-bodyX, 0, 0]} scale={[scale, 1, scale]}>
          <meshStandardMaterial color={BATTER} roughness={0.55} />
        </mesh>
      </group>
      <group position={[bodyX, 0.045, 0]}>
        {BEAN_SPOTS.map((b, i) => (
          <mesh key={i} position={[b.x, b.y, b.z]} scale={beanLevelNow * BEANS > i ? 1 : 0.001}>
            <sphereGeometry args={[b.size, 12, 12]} />
            <meshStandardMaterial color={filling} roughness={0.45} />
          </mesh>
        ))}
      </group>
      <group position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={scale * 0.9} visible={bakedShown(mode, SETTLED_ELAPSED, cavity)}>
        <Fish3D />
      </group>
    </group>
  )
}
