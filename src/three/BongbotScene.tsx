import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Sparkles } from '@react-three/drei'
import { Bag3D, Counter, Fish3D } from './models'
import { Bongbot } from './Bongbot'
import { BottleCaddy, type BottleKind } from './BottleCaddy'
import { KitchenBackdrop } from './KitchenBackdrop'
import { Grandma } from './Grandma'
import { CameraRig } from './CameraRig'
import { MoldRig } from './MoldRig'
import { type GrandmaAction, type SceneMode } from './sceneMode'
import { StudioEnvironment } from './StudioEnvironment'

const SCENE_Y = -1.05
const BAG_X = 1.35
const GRANDMA_POS: [number, number, number] = [1.9, 0, -0.5]
const BAG_TOP: [number, number, number] = [BAG_X, 0.62, 0.55]
const FISH_SCALE = 0.6

/** The baked fish after it has gone into the bag (packed) or popped up out of it (ready). */
function TravellingFish({ mode }: { mode: SceneMode }) {
  const at: [number, number, number] = mode === 'ready' ? [BAG_TOP[0], 1.25, BAG_TOP[2]] : BAG_TOP
  return (
    <group position={at} scale={FISH_SCALE} visible={mode === 'packed' || mode === 'ready'}>
      <Fish3D />
    </group>
  )
}

function grandmaActionFor(mode: SceneMode): GrandmaAction {
  return mode === 'packed' ? 'pack' : 'cheer'
}

export default function BongbotScene({ mode, filling, cue = 0 }: { mode: SceneMode; filling: string; cue?: number }) {
  const grandmaOn = mode === 'packed' || mode === 'ready'
  const held = useRef<BottleKind | null>(null)
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.7, 6.2], fov: 38 }} gl={{ alpha: true, antialias: true }}>
      <CameraRig mode={mode} cue={cue} offsetY={SCENE_Y} />
      <ambientLight intensity={0.35} color="#FFF4E0" />
      <StudioEnvironment />
      <hemisphereLight args={['#FFE9D2', '#E8B88A', 0.8]} />
      <directionalLight position={[2.5, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <group position={[0, SCENE_Y, 0]}>
        <KitchenBackdrop />
        <Counter />
        <Bongbot mode={mode} cue={cue} filling={filling} held={held} />
        <BottleCaddy filling={filling} />
        <group visible={mode !== 'ready'}>
          <MoldRig mode={mode} filling={filling} cue={cue} />
        </group>
        <TravellingFish mode={mode} />
        <group position={[BAG_X, 0, BAG_TOP[2]]} visible={grandmaOn}>
          <Bag3D />
        </group>
        {grandmaOn && (
          <group key={cue} position={GRANDMA_POS} scale={0.6}>
            <Grandma action={grandmaActionFor(mode)} />
          </group>
        )}
        {mode === 'ready' && (
          <Sparkles count={24} scale={[1.2, 1.2, 0.8]} position={[BAG_X, 1.2, BAG_TOP[2]]} size={6} speed={0} color="#FFD27A" />
        )}
        <ContactShadows position={[0, -0.04, 0]} opacity={0.35} scale={5} blur={2.4} far={2} />
      </group>
    </Canvas>
  )
}
