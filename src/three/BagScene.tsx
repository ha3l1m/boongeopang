import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, RoundedBox, Sparkles } from '@react-three/drei'
import { MathUtils, type Group } from 'three'
import { Fish3D } from './models'
import { StudioEnvironment } from './StudioEnvironment'

const SACK = '#DDB07A'
const RIM = '#E8C08D'
const INSIDE = '#9E7442'
const SACK_W = 1.75
const SACK_H = 1.3
const SACK_D = 1.05
const RIM_R = 0.11
const DROP_GAP = 0.38
const FALL_TIME = 0.75
const START_Y = 3.8
const FISH_SCALE = 0.72
const clay = { roughness: 0.85, metalness: 0 }

/** Where each fish settles: back row first, then the front row that peeks over the rim. */
const SLOTS: { pos: [number, number, number]; tilt: number }[] = [
  { pos: [-0.42, 1.74, -0.26], tilt: 0.3 },
  { pos: [0.42, 1.78, -0.26], tilt: -0.25 },
  { pos: [-0.52, 1.46, 0.2], tilt: 0.35 },
  { pos: [0.02, 1.42, 0.26], tilt: 0.05 },
  { pos: [0.54, 1.46, 0.18], tilt: -0.3 },
  { pos: [0.0, 1.98, -0.36], tilt: 0.1 },
]

function bounce(k: number): number {
  if (k < 1 / 2.75) return 7.5625 * k * k
  if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75
  if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375
  return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375
}

function FallingFish({ index, filling, closing }: { index: number; filling: string; closing: boolean }) {
  const ref = useRef<Group>(null)
  const born = useRef(-1)
  const sink = useRef(0)
  const { pos, tilt } = SLOTS[index]

  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    if (born.current < 0) born.current = t
    const k = MathUtils.clamp((t - born.current - index * DROP_GAP) / FALL_TIME, 0, 1)
    sink.current = MathUtils.damp(sink.current, closing ? 0.9 : 0, 5, delta)
    const idle = k >= 1 ? Math.sin(t * 2 + index) * 0.02 : 0
    ref.current.visible = k > 0
    ref.current.position.y = MathUtils.lerp(START_Y, pos[1], bounce(k)) + idle - sink.current
    ref.current.rotation.z = tilt + (1 - k) * 1.6
    const squash = k >= 1 ? 1 : 1 + Math.sin(k * Math.PI) * 0.06
    ref.current.scale.set(FISH_SCALE * squash, FISH_SCALE / squash, FISH_SCALE)
  })

  return (
    <group ref={ref} position={[pos[0], START_Y, pos[2]]} visible={false}>
      <group rotation={[0, Math.PI, 0]}>
        <Fish3D filling={filling} />
      </group>
    </group>
  )
}

function RolledRim() {
  const y = SACK_H
  const halfW = SACK_W / 2
  const halfD = SACK_D / 2
  return (
    <group position={[0, y, 0]}>
      {[halfD, -halfD].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[RIM_R, SACK_W, 8, 20]} />
          <meshStandardMaterial color={RIM} {...clay} />
        </mesh>
      ))}
      {[halfW, -halfW].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[RIM_R, SACK_D, 8, 20]} />
          <meshStandardMaterial color={RIM} {...clay} />
        </mesh>
      ))}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SACK_W - 0.05, SACK_D - 0.05]} />
        <meshStandardMaterial color={INSIDE} roughness={1} />
      </mesh>
    </group>
  )
}

function Sack({ closing }: { closing: boolean }) {
  const body = useRef<Group>(null)
  useFrame(({ clock }, delta) => {
    if (!body.current) return
    const hop = closing ? Math.abs(Math.sin(clock.elapsedTime * 7)) * 0.14 : 0
    body.current.position.y = MathUtils.damp(body.current.position.y, hop, 12, delta)
    const breathe = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.01
    body.current.scale.set(breathe, 1 / breathe, breathe)
  })
  return (
    <group ref={body}>
      <RoundedBox args={[SACK_W, SACK_H, SACK_D]} radius={0.2} smoothness={6} position={[0, SACK_H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={SACK} {...clay} />
      </RoundedBox>
      {[-0.42, 0.1, 0.5].map((x, i) => (
        <mesh key={x} position={[x, 0.55 + i * 0.08, SACK_D / 2 + 0.01]} scale={[0.5, 3.2, 0.25]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={SACK} {...clay} />
        </mesh>
      ))}
      <RolledRim />
    </group>
  )
}

export default function BagScene({ fillings, closing }: { fillings: string[]; closing: boolean }) {
  const shown = fillings.slice(0, SLOTS.length)
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2.7, 4.7], fov: 34 }} gl={{ alpha: true, antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 1.25, 0)}>
      <ambientLight intensity={0.35} color="#FFF4E0" />
      <StudioEnvironment />
      <hemisphereLight args={['#FFF6E6', '#F2C27A', 0.7]} />
      <directionalLight position={[-2.5, 6, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <Sack closing={closing} />
      <group key={shown.join('|')}>
        {shown.map((filling, i) => (
          <FallingFish key={i} index={i} filling={filling} closing={closing} />
        ))}
      </group>
      {closing && <Sparkles count={20} scale={[2, 1.2, 1]} position={[0, 1.8, 0]} size={6} speed={0.8} color="#FFD27A" />}
      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
    </Canvas>
  )
}
