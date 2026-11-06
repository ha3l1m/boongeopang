import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, MathUtils, type Group } from 'three'
import { BATTER } from './BottleCaddy'
import { Fish3D, fishOutline } from './Fish3D'
import { fillProgress, flowingCavity } from './pourTimeline'
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

type Clock = MutableRefObject<{ elapsed: number }>

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
 * What sits in one cavity (in the cavity's mirrored fish space, face level at y=0):
 * batter spreading out from where it lands, a heap of filling, and the baked fish after the bake.
 */
export function CavityContents({ cavity, mode, filling, clock, scale }: { cavity: 0 | 1; mode: SceneMode; filling: string; clock: Clock; scale: number }) {
  const flatFish = useFlatFish(0.03)
  const batter = useRef<Group>(null)
  const beans = useRef<Group>(null)
  const baked = useRef<Group>(null)

  useFrame((_, delta) => {
    const e = clock.current.elapsed
    if (batter.current) {
      const level = batterLevel(mode, e, cavity)
      const k = MathUtils.damp(batter.current.scale.x, level > 0 ? 0.2 + level * 0.8 : 0.001, 6, delta)
      batter.current.scale.set(k, 1, k)
      batter.current.visible = level > 0 || k > 0.01
    }
    if (beans.current) {
      const level = beanLevel(mode, e, cavity)
      beans.current.children.forEach((bean, i) => {
        const goal = level * BEANS > i ? 1 : 0.001
        bean.scale.setScalar(MathUtils.damp(bean.scale.x, goal, 10, delta))
      })
    }
    if (baked.current) baked.current.visible = bakedShown(mode, e, cavity)
  })

  const bodyX = BODY_CENTER_X * scale
  return (
    <group>
      <group ref={batter} position={[bodyX, 0.004, 0]} scale={[0.001, 1, 0.001]} visible={false}>
        <mesh geometry={flatFish} position={[-bodyX, 0, 0]} scale={[scale, 1, scale]}>
          <meshStandardMaterial color={BATTER} roughness={0.55} />
        </mesh>
      </group>
      <group ref={beans} position={[bodyX, 0.045, 0]}>
        {BEAN_SPOTS.map((b, i) => (
          <mesh key={i} position={[b.x, b.y, b.z]} scale={0.001}>
            <sphereGeometry args={[b.size, 12, 12]} />
            <meshStandardMaterial color={filling} roughness={0.45} />
          </mesh>
        ))}
      </group>
      <group ref={baked} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={scale * 0.9} visible={false}>
        <Fish3D />
      </group>
    </group>
  )
}

/** Stream from the nozzle down into whichever cavity is being poured; filling falls as chunky drops. */
export function PourStream({ mode, color, clock, points, height }: { mode: SceneMode; color: string; clock: Clock; points: readonly (readonly [number, number, number])[]; height: number }) {
  const group = useRef<Group>(null)
  const drops = mode === 'filling'
  useFrame(({ clock: { elapsedTime: t } }) => {
    if (!group.current) return
    const cavity = mode === 'batter' || mode === 'filling' ? flowingCavity(clock.current.elapsed) : null
    group.current.visible = cavity !== null
    if (cavity === null) return
    group.current.position.set(...points[cavity])
    group.current.children.forEach((child, i) => {
      if (drops) {
        const k = (t * 1.6 + i / 4) % 1
        child.position.y = MathUtils.lerp(height - 0.04, 0.04, k * k)
      } else {
        const wobble = 1 + Math.sin(t * 14 + i) * 0.15
        child.scale.set(wobble, 1, wobble)
      }
    })
  })
  return (
    <group ref={group} visible={false}>
      {drops ? (
        [0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.045, 14, 14]} />
            <meshStandardMaterial color={color} roughness={0.45} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, height / 2, 0]}>
          <cylinderGeometry args={[0.022, 0.034, height, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
      )}
    </group>
  )
}
