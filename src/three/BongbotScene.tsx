import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Sparkles } from '@react-three/drei'
import { MathUtils, type Group } from 'three'
import { Bag3D, Counter, Fish3D } from './models'
import { Bongbot } from './Bongbot'
import { BottleCaddy, type BottleKind } from './BottleCaddy'
import { KitchenBackdrop } from './KitchenBackdrop'
import { Grandma } from './Grandma'
import { CameraRig } from './CameraRig'
import { CAVITY_X, MOLD_FACE, MOLD_Y, MOLD_Z, MoldRig } from './MoldRig'
import { PACK, type GrandmaAction, type SceneMode } from './sceneMode'
import { StudioEnvironment } from './StudioEnvironment'

const SCENE_Y = -1.05
const BAG_X = 1.35
const GRANDMA_POS: [number, number, number] = [1.9, 0, -0.5]
const HOLD: [number, number, number] = [1.6, 0.6, 0.15]
const BAG_TOP: [number, number, number] = [BAG_X, 0.62, 0.55]
const MOLD_TOP: [number, number, number] = [CAVITY_X[0], MOLD_Y + MOLD_FACE + 0.1, MOLD_Z]
const FISH_SCALE = 0.6

function packedFishPosition(p: number): [number, number, number] {
  if (p < PACK.fly) {
    const k = p / PACK.fly
    return [
      MathUtils.lerp(MOLD_TOP[0], HOLD[0], k),
      MathUtils.lerp(MOLD_TOP[1], HOLD[1], k) + Math.sin(Math.PI * k) * 0.8,
      MathUtils.lerp(MOLD_TOP[2], HOLD[2], k),
    ]
  }
  if (p < PACK.hold) return [HOLD[0], HOLD[1] + Math.sin(p * 8) * 0.03, HOLD[2]]
  const k = Math.min((p - PACK.hold) / (PACK.drop - PACK.hold), 1)
  return [MathUtils.lerp(HOLD[0], BAG_TOP[0], k), MathUtils.lerp(HOLD[1], BAG_TOP[1], k), MathUtils.lerp(HOLD[2], BAG_TOP[2], k)]
}

/** The baked fish that leaves the mold: flies to grandma, goes into the bag, then pops out when ready. */
function TravellingFish({ mode, cue }: { mode: SceneMode; cue: number }) {
  const ref = useRef<Group>(null)
  const started = useRef({ mode, cue, since: -1 })

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const s = started.current
    if (s.mode !== mode || s.cue !== cue || s.since < 0) started.current = { mode, cue, since: t }
    if (!ref.current) return
    const p = t - started.current.since
    ref.current.visible = mode === 'packed' || mode === 'ready'
    if (mode === 'packed') {
      ref.current.position.set(...packedFishPosition(p))
      const k = Math.min(p / PACK.fly, 1)
      ref.current.rotation.set(MathUtils.lerp(-Math.PI / 2, 0, k), 0, Math.sin(k * Math.PI) * 0.6)
    } else if (mode === 'ready') {
      ref.current.position.set(BAG_TOP[0], 1.25 + Math.abs(Math.sin(t * 3)) * 0.3, BAG_TOP[2])
      ref.current.rotation.set(0, Math.sin(t * 2) * 0.4, Math.sin(t * 3) * 0.15)
    }
  })

  return (
    <group ref={ref} position={MOLD_TOP} scale={FISH_SCALE} visible={false}>
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
        <BottleCaddy filling={filling} held={held} />
        <group visible={mode !== 'ready'}>
          <MoldRig mode={mode} filling={filling} cue={cue} />
        </group>
        <TravellingFish mode={mode} cue={cue} />
        <group position={[BAG_X, 0, BAG_TOP[2]]} visible={grandmaOn}>
          <Bag3D />
        </group>
        {grandmaOn && (
          <group key={cue} position={GRANDMA_POS} scale={0.6}>
            <Grandma action={grandmaActionFor(mode)} />
          </group>
        )}
        {mode === 'ready' && (
          <Sparkles count={24} scale={[1.2, 1.2, 0.8]} position={[BAG_X, 1.2, BAG_TOP[2]]} size={6} speed={0.8} color="#FFD27A" />
        )}
        <ContactShadows position={[0, -0.04, 0]} opacity={0.35} scale={5} blur={2.4} far={2} />
      </group>
    </Canvas>
  )
}
