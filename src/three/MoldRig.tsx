import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { ExtrudeGeometry, MathUtils, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { fishOutline } from './Fish3D'
import { BATTER } from './BottleCaddy'
import { BODY_CENTER_X, CavityContents, PourStream, useFlatFish } from './MoldContents'
import { BAKE_SPIN, type SceneMode } from './sceneMode'
import { useStepClock } from './useStepClock'

export const MOLD_X = 0.3
export const MOLD_Y = 0.55
export const MOLD_Z = 0.15
/** Height of the mold's top face above its axle. */
export const MOLD_FACE = 0.09
/** Height above the mold face where the pour stream starts: the bottle nozzle in the arm's pour pose. */
export const POUR_TOP = 0.42
const FISH_SCALE = 0.38
const CAVITY_DX = 0.37
/** Two fish cavities side by side, the one nearer the robot first. */
export const CAVITY_X = [MOLD_X - CAVITY_DX, MOLD_X + CAVITY_DX] as const
/** Where batter lands in each cavity (cavities are mirrored so the fish face left). */
export const POUR_POINTS = CAVITY_X.map((x) => [x - BODY_CENTER_X * FISH_SCALE, MOLD_Y + MOLD_FACE, MOLD_Z] as const)

const PLATE = [1.55, 0.18, 0.72] as const
const MOLD = '#5A3828'
const MOLD_LIGHT = '#6C4532'
const CAVITY = '#3A2318'
const GOLD = '#C9A05A'
const POST = '#6B4535'
const LID_OPEN = -1.95
/** Seconds into baking: lid shuts first, then the closed mold spins until BAKE_SPIN, then opens. */
const SPIN_FROM = 0.7

function Flames() {
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    group.current?.children.forEach((flame, i) => {
      flame.scale.y = 1 + Math.sin(clock.elapsedTime * 12 + i * 1.7) * 0.25
    })
  })
  return (
    <group position={[MOLD_X, 0.12, MOLD_Z]}>
      <pointLight position={[0, 0.3, 0.3]} color="#FF8A3D" intensity={3} distance={2.5} />
      <group ref={group}>
        {[-0.45, -0.22, 0, 0.22, 0.45].map((x, i) => (
          <mesh key={x} position={[x, 0.14, (i % 2) * 0.12 - 0.06]}>
            <coneGeometry args={[0.1, 0.36, 16]} />
            <meshStandardMaterial color={i % 2 ? '#FFC94A' : '#FF8A3D'} emissive={i % 2 ? '#FFB020' : '#FF6A1A'} emissiveIntensity={1.2} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const PUFFS = 8

/** Soft steam puffs rising off the mold while it bakes and right after it opens. */
function Steam({ active }: { active: boolean }) {
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    group.current?.children.forEach((puff, i) => {
      const k = (clock.elapsedTime * 0.45 + i / PUFFS) % 1
      puff.position.set(Math.sin(i * 2.1 + k * 3) * 0.35, 0.15 + k * 0.9, Math.cos(i * 1.3) * 0.15)
      puff.scale.setScalar(0.6 + k * 1.2)
      const material = (puff as Mesh).material as MeshStandardMaterial
      material.opacity = active ? Math.sin(k * Math.PI) * 0.45 : 0
    })
  })
  return (
    <group ref={group} position={[MOLD_X, MOLD_Y + MOLD_FACE, MOLD_Z]}>
      {Array.from({ length: PUFFS }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

function useReliefFish(): ExtrudeGeometry {
  return useMemo(() => {
    const geometry = new ExtrudeGeometry(fishOutline(), { depth: 0.025, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 32 })
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])
}

/** Lid: plain inside, raised fish on the outside, hinged on the back edge. */
function Lid({ lid, seam }: { lid: RefObject<Group | null>; seam: RefObject<MeshStandardMaterial | null> }) {
  const relief = useReliefFish()
  return (
    <group ref={lid} position={[0, MOLD_FACE, -PLATE[2] / 2]} rotation={[LID_OPEN, 0, 0]}>
      <group position={[0, 0, PLATE[2] / 2]}>
        <RoundedBox args={[PLATE[0], 0.14, PLATE[2]]} radius={0.06} smoothness={4} position={[0, 0.07, 0]} castShadow>
          <meshStandardMaterial color={MOLD} roughness={0.5} metalness={0.25} />
        </RoundedBox>
        {CAVITY_X.map((x) => (
          <mesh key={x} geometry={relief} position={[x - MOLD_X, 0.14, 0]} rotation={[0, Math.PI, 0]} scale={[FISH_SCALE, 1, FISH_SCALE]}>
            <meshStandardMaterial color={MOLD_LIGHT} roughness={0.5} metalness={0.25} />
          </mesh>
        ))}
        <mesh position={[0, -0.004, 0]}>
          <boxGeometry args={[PLATE[0] - 0.12, 0.006, PLATE[2] - 0.12]} />
          <meshStandardMaterial ref={seam} color={MOLD} emissive="#FF7A1A" emissiveIntensity={0} />
        </mesh>
      </group>
    </group>
  )
}

/** Fish-shaped hollow: a lighter rim with the dark recess inside it, plus a little eye. */
function Cavity() {
  const fish = useFlatFish()
  return (
    <group>
      <mesh geometry={fish} position={[0, -0.016, 0]} scale={[FISH_SCALE * 1.08, 1, FISH_SCALE * 1.12]}>
        <meshStandardMaterial color={MOLD_LIGHT} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh geometry={fish} position={[0, -0.012, 0]} scale={[FISH_SCALE, 1, FISH_SCALE]}>
        <meshStandardMaterial color={CAVITY} roughness={0.6} metalness={0.25} />
      </mesh>
      <mesh position={[0.62 * FISH_SCALE, 0.012, -0.08 * FISH_SCALE]} scale={[1, 0.4, 1]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshStandardMaterial color={MOLD_LIGHT} roughness={0.6} />
      </mesh>
    </group>
  )
}

function Stand() {
  return (
    <group>
      <mesh position={[MOLD_X, 0.06, MOLD_Z]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.66, 0.12, 48]} />
        <meshStandardMaterial color="#3E261C" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[MOLD_X + side * 0.88, 0, MOLD_Z]}>
          <RoundedBox args={[0.08, MOLD_Y, 0.12]} radius={0.025} smoothness={3} position={[0, MOLD_Y / 2, 0]} castShadow>
            <meshStandardMaterial color={POST} roughness={0.5} metalness={0.2} />
          </RoundedBox>
          <mesh position={[side * 0.02, MOLD_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.055, 0.055, 0.12, 20]} />
            <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[MOLD_X, MOLD_Y, MOLD_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 1.8, 12]} />
        <meshStandardMaterial color={POST} roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  )
}

/** Two-fish mold on an axle over the burner: batter, filling, lid shuts and spins over fire, then opens on golden fish. */
export function MoldRig({ mode, filling, cue }: { mode: SceneMode; filling: string; cue: number }) {
  const clock = useStepClock(mode, cue)
  const spin = useRef<Group>(null)
  const lid = useRef<Group>(null)
  const seam = useRef<MeshStandardMaterial>(null)

  useFrame(({ clock: { elapsedTime: t } }, delta) => {
    const e = clock.current.elapsed
    const baking = mode === 'baking'
    const closed = baking && e < BAKE_SPIN + 0.2
    const spinning = baking && e >= SPIN_FROM && e < BAKE_SPIN
    if (spin.current) {
      const rot = spin.current.rotation.x
      spin.current.rotation.x = spinning ? rot + delta * 3.4 : MathUtils.damp(rot, Math.round(rot / (Math.PI * 2)) * Math.PI * 2, 6, delta)
    }
    if (lid.current) lid.current.rotation.x = MathUtils.damp(lid.current.rotation.x, closed ? 0 : LID_OPEN, 7, delta)
    if (seam.current) seam.current.emissiveIntensity = closed && e > 0.4 ? 1.4 + Math.sin(t * 8) * 0.5 : 0
  })

  const baking = mode === 'baking'
  return (
    <group>
      <Stand />
      {baking && <Flames />}
      <group ref={spin} position={[MOLD_X, MOLD_Y, MOLD_Z]}>
        <RoundedBox args={[PLATE[0] + 0.05, 0.05, PLATE[2] + 0.04]} radius={0.02} smoothness={2} position={[0, -0.1, 0]}>
          <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.4} />
        </RoundedBox>
        <RoundedBox args={[PLATE[0], PLATE[1], PLATE[2]]} radius={0.07} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color={MOLD} roughness={0.5} metalness={0.25} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.4, MOLD_FACE, -PLATE[2] / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.14, 16]} />
            <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.4} />
          </mesh>
        ))}
        {CAVITY_X.map((x, i) => (
          <group key={x} position={[x - MOLD_X, MOLD_FACE, 0]} rotation={[0, Math.PI, 0]}>
            <Cavity />
            <CavityContents cavity={i as 0 | 1} mode={mode} filling={filling} clock={clock} scale={FISH_SCALE} />
          </group>
        ))}
        <Lid lid={lid} seam={seam} />
      </group>
      <PourStream key={`${mode}-${cue}`} mode={mode} color={mode === 'filling' ? filling : BATTER} clock={clock} points={POUR_POINTS} height={POUR_TOP} />
      <Steam active={baking} />
    </group>
  )
}
