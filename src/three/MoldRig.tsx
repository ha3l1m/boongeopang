import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { ExtrudeGeometry } from 'three'
import { fishOutline } from './Fish3D'
import { BODY_CENTER_X, CavityContents, useFlatFish } from './MoldContents'
import type { SceneMode } from './sceneMode'

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

function Flames() {
  return (
    <group position={[MOLD_X, 0.12, MOLD_Z]}>
      <pointLight position={[0, 0.3, 0.3]} color="#FF8A3D" intensity={3} distance={2.5} />
      <group>
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

function useReliefFish(): ExtrudeGeometry {
  return useMemo(() => {
    const geometry = new ExtrudeGeometry(fishOutline(), { depth: 0.025, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 32 })
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [])
}

/** Lid: plain inside, raised fish on the outside, hinged on the back edge. */
function Lid() {
  const relief = useReliefFish()
  return (
    <group position={[0, MOLD_FACE, -PLATE[2] / 2]} rotation={[LID_OPEN, 0, 0]}>
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
          <meshStandardMaterial color={MOLD} emissive="#FF7A1A" emissiveIntensity={0} />
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

/** Two-fish mold on an axle over the burner, frozen at the end of its step: full, and open on the baked fish once baking is done. */
export function MoldRig({ mode, filling }: { mode: SceneMode; filling: string; cue: number }) {
  const baking = mode === 'baking'
  return (
    <group>
      <Stand />
      {baking && <Flames />}
      <group position={[MOLD_X, MOLD_Y, MOLD_Z]}>
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
            <CavityContents cavity={i as 0 | 1} mode={mode} filling={filling} scale={FISH_SCALE} />
          </group>
        ))}
        <Lid />
      </group>
    </group>
  )
}
