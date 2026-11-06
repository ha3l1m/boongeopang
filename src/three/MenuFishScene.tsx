import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Fish3D } from './Fish3D'

const HOP_SECONDS = 0.45

/** Filling peeking out of the lower belly, near the tail, facing the camera. */
function FillingBite({ color }: { color: string }) {
  return (
    <group position={[-0.02, -0.24, 0.16]} rotation={[Math.PI / 2 - 0.75, 0, 0.3]}>
      <mesh>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 32]} />
        <meshStandardMaterial color="#FFE7B8" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.145, 0.145, 0.04, 32]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
    </group>
  )
}

function BobbingFish({ filling, hop, phase }: { filling: string; hop: number; phase: number }) {
  const ref = useRef<Group>(null)
  const lastHop = useRef(hop)
  const hopAt = useRef(-1)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (hop !== lastHop.current) {
      lastHop.current = hop
      hopAt.current = t
    }
    const g = ref.current
    if (!g) return
    const p = hopAt.current < 0 ? 1 : Math.min((t - hopAt.current) / HOP_SECONDS, 1)
    const jump = p < 1 ? Math.sin(p * Math.PI) : 0
    g.position.y = Math.sin(t * 1.8 + phase) * 0.035 + jump * 0.22
    g.rotation.y = 0.35 + Math.sin(t * 0.9 + phase) * 0.12
    g.rotation.z = Math.sin(t * 1.4 + phase) * 0.04 + jump * 0.25
  })

  return (
    <group ref={ref}>
      <group position={[-0.02, 0, 0]}>
        <Fish3D tailScale={0.7} />
        <FillingBite color={filling} />
      </group>
    </group>
  )
}

type Props = { filling: string; hop: number; phase?: number }

export default function MenuFishScene({ filling, hop, phase = 0 }: Props) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.1, 3], fov: 40 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={1.1} color="#FFF4E0" />
      <hemisphereLight args={['#FFFFFF', '#FFD9A0', 0.7]} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.6} />
      <BobbingFish filling={filling} hop={hop} phase={phase} />
    </Canvas>
  )
}
