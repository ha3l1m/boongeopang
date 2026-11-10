import { Canvas } from '@react-three/fiber'
import { Fish3D } from './Fish3D'

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

/** Still fish, turned slightly toward the light. */
function StillFish({ filling }: { filling: string }) {
  return (
    <group rotation={[0, 0.35, 0]}>
      <group position={[-0.02, 0, 0]}>
        <Fish3D tailScale={0.7} />
        <FillingBite color={filling} />
      </group>
    </group>
  )
}

type Props = { filling: string; hop?: number; phase?: number }

export default function MenuFishScene({ filling }: Props) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.1, 3], fov: 40 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={1.1} color="#FFF4E0" />
      <hemisphereLight args={['#FFFFFF', '#FFD9A0', 0.7]} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.6} />
      <StillFish filling={filling} />
    </Canvas>
  )
}
