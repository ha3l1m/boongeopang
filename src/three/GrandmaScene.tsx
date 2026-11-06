import { Canvas } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { Grandma } from './Grandma'
import type { GrandmaAction } from './sceneMode'
import { StudioEnvironment } from './StudioEnvironment'

type Framing = 'bust'

const CAMERA: Record<Framing, { position: [number, number, number]; fov: number; target: number }> = {
  bust: { position: [0, 2.65, 4.4], fov: 34, target: 2.6 },
}

export default function GrandmaScene({ action, framing }: { action: GrandmaAction; framing: Framing }) {
  const { target, ...camera } = CAMERA[framing]
  return (
    <Canvas shadows dpr={[1, 2]} camera={camera} gl={{ alpha: true, antialias: true }} onCreated={({ camera: c }) => c.lookAt(0, target, 0)}>
      <ambientLight intensity={0.35} color="#FFF4E0" />
      <StudioEnvironment />
      <hemisphereLight args={['#DDEBFF', '#FFE3A8', 0.8]} />
      <directionalLight position={[2.5, 5, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <Grandma action={action} />
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
    </Canvas>
  )
}
