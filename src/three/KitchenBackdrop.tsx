import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { DoubleSide, ExtrudeGeometry, Shape, type MeshStandardMaterial } from 'three'
import { Fish3D, fishOutline } from './Fish3D'

const WALL = '#F2CFAE'
const FLOOR = '#E3B994'
const TAN = '#E2B386'
const WOOD = '#B9784A'
const BROWN = '#7A4A2E'
const GLOW = '#FFB75E'
const WALL_Z = -2.6
const matte = { roughness: 0.95, metalness: 0 }

function archShape(width: number, height: number): Shape {
  const r = width / 2
  const shape = new Shape()
  shape.moveTo(-r, 0)
  shape.lineTo(-r, height - r)
  shape.absarc(0, height - r, r, Math.PI, 0, true)
  shape.lineTo(r, 0)
  shape.lineTo(-r, 0)
  return shape
}

/** Arched oven niche at the back left, glowing from inside, with a little lit jar on its sill. */
function ArchOven() {
  const frame = useMemo(() => new ExtrudeGeometry(archShape(1.5, 2.3), { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 32 }), [])
  const opening = useMemo(() => new ExtrudeGeometry(archShape(1.0, 1.6), { depth: 0.02, bevelEnabled: false, curveSegments: 32 }), [])
  return (
    <group position={[-2.75, -0.35, WALL_Z + 0.05]}>
      <mesh geometry={frame} receiveShadow>
        <meshStandardMaterial color="#EBC39C" {...matte} />
      </mesh>
      <mesh geometry={opening} position={[0, 0.35, 0.37]}>
        <meshStandardMaterial color="#FFC98A" emissive={GLOW} emissiveIntensity={0.9} {...matte} />
      </mesh>
      <pointLight position={[0, 1.0, 0.8]} color={GLOW} intensity={2.2} distance={3} />
      <group position={[0, 0.6, 0.55]}>
        <mesh>
          <cylinderGeometry args={[0.13, 0.13, 0.28, 24]} />
          <meshStandardMaterial color={BROWN} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 12]} />
          <meshStandardMaterial color="#FFE9B0" emissive="#FFC24A" emissiveIntensity={2} />
        </mesh>
      </group>
    </group>
  )
}

/** Hanging pendant lamp: cord, tan shade, warm bulb that gently breathes. */
function Pendant({ x, z }: { x: number; z: number }) {
  const bulb = useRef<MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (bulb.current) bulb.current.emissiveIntensity = 2.2 + Math.sin(clock.elapsedTime * 1.3 + x) * 0.25
  })
  return (
    <group position={[x, 3.15, z]}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 2.2, 8]} />
        <meshStandardMaterial color={BROWN} {...matte} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.12, 0.34, 0.26, 32, 1, true]} />
        <meshStandardMaterial color={WOOD} side={DoubleSide} {...matte} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial ref={bulb} color="#FFF1C9" emissive="#FFC873" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[0, -0.25, 0]} color="#FFC07A" intensity={2.5} distance={4.5} />
    </group>
  )
}

/** Brown plaque hanging from two rods with a glowing orange fish on it. */
function NeonSign() {
  const fish = useMemo(() => new ExtrudeGeometry(fishOutline(), { depth: 0.02, bevelEnabled: false, curveSegments: 32 }), [])
  return (
    <group position={[2.55, 2.35, WALL_Z + 0.25]}>
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 1.3, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 2.2, 8]} />
          <meshStandardMaterial color={BROWN} {...matte} />
        </mesh>
      ))}
      <RoundedBox args={[0.95, 0.12, 0.12]} radius={0.04} smoothness={3} position={[0, 0.48, 0]}>
        <meshStandardMaterial color={WOOD} {...matte} />
      </RoundedBox>
      <RoundedBox args={[1.05, 0.8, 0.1]} radius={0.12} smoothness={4}>
        <meshStandardMaterial color="#9A5A32" emissive="#FF9A3C" emissiveIntensity={0.25} {...matte} />
      </RoundedBox>
      <mesh geometry={fish} position={[0, 0, 0.055]} scale={0.6}>
        <meshStandardMaterial color="#FFD08A" emissive="#FFA640" emissiveIntensity={1.8} />
      </mesh>
      <pointLight position={[0, 0, 0.5]} color="#FFA640" intensity={1.2} distance={2.5} />
    </group>
  )
}

/** Wooden display tray of baked fish on a low shelf at the back right. */
function FishTray() {
  return (
    <group position={[2.85, -0.35, -1.95]}>
      <RoundedBox args={[1.2, 0.7, 0.8]} radius={0.06} smoothness={3} position={[0, 0.35, 0]} receiveShadow>
        <meshStandardMaterial color={TAN} {...matte} />
      </RoundedBox>
      <RoundedBox args={[1.0, 0.18, 0.6]} radius={0.04} smoothness={3} position={[0, 0.79, 0]}>
        <meshStandardMaterial color={WOOD} {...matte} />
      </RoundedBox>
      {[-0.28, 0, 0.28].map((x, i) => (
        <group key={x} position={[x, 0.95, 0.05 - i * 0.05]} rotation={[-0.5, 0.3, 0.2]} scale={0.32}>
          <Fish3D />
        </group>
      ))}
    </group>
  )
}

/** Cozy bakery corner around the counter: warm wall and floor, oven niche, pendant lamps, sign, fish tray. */
export function KitchenBackdrop() {
  return (
    <group>
      <mesh position={[0, 2.4, WALL_Z]}>
        <planeGeometry args={[18, 10]} />
        <meshStandardMaterial color={WALL} {...matte} />
      </mesh>
      <mesh position={[0, -0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color={FLOOR} {...matte} />
      </mesh>
      <ArchOven />
      <Pendant x={0.9} z={-1.5} />
      <Pendant x={1.75} z={-1.6} />
      <NeonSign />
      <FishTray />
    </group>
  )
}
