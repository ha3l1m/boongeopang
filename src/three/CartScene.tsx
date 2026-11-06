import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Line, RoundedBox, Sparkles } from '@react-three/drei'
import type { Group } from 'three'
import { Fish3D } from './models'
import { Grandma } from './Grandma'

/** Snowy winter street: red fish-bread cart with a glass case, a giant snow-capped fish bread on the roof. */
const clay = { roughness: 0.8, metalness: 0 }
const RED = '#D5432A'
const RED_DEEP = '#B9371F'
const CREAM = '#FFF1DA'
const STEEL = '#E9E1D6'
const DARK = '#3A302B'
const SNOW = '#EEF1FA'
const GROUND = '#C9CFE3'

function SnowCap({ position, scale }: { position: [number, number, number]; scale: [number, number, number] }) {
  return (
    <mesh position={position} scale={scale} castShadow>
      <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={SNOW} roughness={1} />
    </mesh>
  )
}

const SIGN = '#E3703A'
const SIGN_DEEP = '#C85A2C'

/** Signboard roof: a tall orange board with a scalloped awning edge, the giant fish bread mounted on its face. */
function Roof() {
  const scallops = Array.from({ length: 7 }, (_, i) => -1.29 + i * 0.43)
  return (
    <group>
      <RoundedBox args={[3.0, 0.14, 1.7]} radius={0.05} position={[0, 2.62, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={RED} {...clay} />
      </RoundedBox>
      <RoundedBox args={[3.0, 0.12, 1.5]} radius={0.05} position={[0, 2.71, -0.05]}>
        <meshStandardMaterial color={SNOW} roughness={1} />
      </RoundedBox>
      <group position={[0, 3.08, 0.86]}>
        <RoundedBox args={[3.02, 1.0, 0.1]} radius={0.04} castShadow>
          <meshStandardMaterial color={SIGN} {...clay} />
        </RoundedBox>
        {scallops.map((x) => (
          <mesh key={x} position={[x, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.215, 0.215, 0.1, 24, 1, false, Math.PI, Math.PI]} />
            <meshStandardMaterial color={SIGN} {...clay} />
          </mesh>
        ))}
        <RoundedBox args={[3.02, 0.06, 0.12]} radius={0.02} position={[0, 0.5, 0]}>
          <meshStandardMaterial color={SIGN_DEEP} {...clay} />
        </RoundedBox>
        {/* the fish bread sits on the sign face, looking straight at the street */}
        <group position={[0.05, 0.25, 0.16]} rotation={[0, 0, 0.04]} scale={1.0}>
          <Fish3D />
        </group>
        <SnowCap position={[-0.9, 0.53, 0]} scale={[0.4, 0.1, 0.12]} />
        <SnowCap position={[1.1, 0.53, 0]} scale={[0.32, 0.08, 0.12]} />
      </group>
    </group>
  )
}

function Bulbs() {
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    group.current?.children.forEach((bulb, i) => {
      bulb.rotation.z = Math.sin(clock.elapsedTime * 1.6 + i) * 0.08
    })
  })
  return (
    <group ref={group}>
      {[-1.0, -0.34, 0.34, 1.0].map((x) => (
        <group key={x} position={[x, 2.58, 0.86]}>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.28, 6]} />
            <meshStandardMaterial color="#5A4A3A" roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.035, 0.03, 0.05, 10]} />
            <meshStandardMaterial color="#4A4040" roughness={0.6} metalness={0.2} />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <sphereGeometry args={[0.075, 16, 16]} />
            <meshStandardMaterial color="#FFE6A0" emissive="#FFC24A" emissiveIntensity={2.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Mold() {
  return (
    <group position={[-0.6, 1.33, 0.1]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.46, 0.48, 0.14, 40]} />
        <meshStandardMaterial color="#2E2926" roughness={0.5} metalness={0.3} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + 0.4
        return (
          <group key={i} position={[Math.cos(a) * 0.25, 0.09, Math.sin(a) * 0.25]} rotation={[-Math.PI / 2, 0, a]} scale={0.2}>
            <Fish3D />
          </group>
        )
      })}
      <Sparkles count={10} scale={[0.6, 0.8, 0.6]} position={[0, 0.45, 0]} size={4} speed={0.5} color="#ffffff" opacity={0.7} />
    </group>
  )
}

function Tray() {
  return (
    <group position={[0.7, 1.33, 0.1]}>
      <RoundedBox args={[0.95, 0.1, 0.62]} radius={0.03} position={[0, 0.03, 0]}>
        <meshStandardMaterial color={DARK} roughness={0.6} />
      </RoundedBox>
      {[-0.28, 0, 0.28].map((x, i) => (
        <group key={x} position={[x, 0.2, i === 1 ? 0.08 : -0.08]} rotation={[-0.3, i * 0.4 - 0.4, 0]} scale={0.26}>
          <Fish3D />
        </group>
      ))}
    </group>
  )
}

/** Glass case on the counter: thin steel frame, open at the back so the grandma stands inside it. */
function GlassCase() {
  const w = 2.5
  const h = 1.15
  const d = 1.25
  const y = 1.34 + h / 2
  const glass = <meshPhysicalMaterial color="#DDEEFF" transparent opacity={0.16} roughness={0.08} transmission={0} />
  return (
    <group position={[0, y, 0.05]}>
      <mesh position={[0, 0, d / 2]}>
        <boxGeometry args={[w, h, 0.02]} />
        {glass}
      </mesh>
      {[-w / 2, w / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.02, h, d]} />
          {glass}
        </mesh>
      ))}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, 0.02, d]} />
        {glass}
      </mesh>
      {[-w / 2, w / 2].flatMap((x) => [-d / 2, d / 2].map((z) => [x, z] as const)).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0, z]}>
          <boxGeometry args={[0.05, h, 0.05]} />
          <meshStandardMaterial color={STEEL} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {[-h / 2, h / 2].map((yy) => (
        <mesh key={yy} position={[0, yy, d / 2]}>
          <boxGeometry args={[w + 0.05, 0.05, 0.05]} />
          <meshStandardMaterial color={STEEL} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function MenuSigns() {
  return (
    <group position={[0.95, 0.86, 0.62]}>
      {[-0.2, 0.2].map((x, i) => (
        <RoundedBox key={x} args={[0.26, 0.5, 0.04]} radius={0.02} position={[x, 0, 0]}>
          <meshStandardMaterial color={i ? CREAM : '#F7D9A8'} {...clay} />
        </RoundedBox>
      ))}
    </group>
  )
}

function Cart() {
  return (
    <group>
      <RoundedBox args={[2.6, 0.95, 1.2]} radius={0.08} position={[0, 0.8, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={RED} {...clay} />
      </RoundedBox>
      <RoundedBox args={[1.1, 0.46, 0.06]} radius={0.05} position={[-0.45, 0.82, 0.62]}>
        <meshStandardMaterial color={CREAM} {...clay} />
      </RoundedBox>
      <group position={[-0.45, 0.82, 0.68]} scale={0.28}>
        <Fish3D />
      </group>
      <MenuSigns />
      <RoundedBox args={[2.75, 0.08, 1.35]} radius={0.03} position={[0, 1.3, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={STEEL} roughness={0.4} metalness={0.2} />
      </RoundedBox>
      {[-1.3, 1.3].flatMap((x) => [-0.6, 0.6].map((z) => [x, z] as const)).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 1.95, z]}>
          <cylinderGeometry args={[0.035, 0.035, 1.3, 10]} />
          <meshStandardMaterial color={STEEL} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {[-0.9, 0.9].map((x) => (
        <group key={x} position={[x, 0.26, 0.62]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.14, 28]} />
            <meshStandardMaterial color="#2B2B2B" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 20]} />
            <meshStandardMaterial color={RED_DEEP} {...clay} />
          </mesh>
        </group>
      ))}
      <Roof />
      <Bulbs />
      <Mold />
      <Tray />
      <GlassCase />
    </group>
  )
}

function Stool({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.2, 0.08, 24]} />
        <meshStandardMaterial color={RED} {...clay} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <mesh key={i} position={[Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15]} rotation={[Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12]}>
            <cylinderGeometry args={[0.025, 0.03, 0.4, 10]} />
            <meshStandardMaterial color={RED_DEEP} {...clay} />
          </mesh>
        )
      })}
      <SnowCap position={[0.08, 0.44, -0.04]} scale={[0.1, 0.03, 0.08]} />
    </group>
  )
}

function Snowdrifts() {
  const drifts: [number, number, number, number][] = [
    [-2.3, 1.2, 0.9, 0.16], [2.4, 1.0, 0.8, 0.14], [1.6, 2.1, 0.7, 0.12], [-1.4, 2.3, 0.6, 0.1],
    [2.8, -0.9, 0.9, 0.14], [-2.7, -0.8, 0.8, 0.12], [0.3, 2.6, 0.9, 0.12],
    [-1.6, 3.6, 1.3, 0.18], [1.9, 3.9, 1.1, 0.16], [0.2, 4.6, 1.5, 0.2], [-3.4, 2.4, 1.0, 0.14], [3.6, 2.2, 1.1, 0.15],
  ]
  return (
    <group>
      {drifts.map(([x, z, r, h], i) => (
        <mesh key={i} position={[x, 0, z]} scale={[r, h, r * 0.8]} receiveShadow>
          <sphereGeometry args={[1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={SNOW} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Snowy row of houses behind the cart, windows glowing warm. Far enough back to sit under the title. */
const WALLS = ['#3F4270', '#4A4474', '#3A3D66', '#524A6E', '#434A78', '#3C3F6C']
const HOUSES: [number, number, number, number][] = [
  [-6.2, 2.0, 2.6, 2.2], [-3.6, 2.6, 3.4, 2.4], [-0.9, 2.2, 2.9, 2.0], [1.6, 2.8, 3.6, 2.3], [4.4, 2.2, 3.0, 2.1], [6.9, 2.5, 2.6, 2.2],
]

function House({ x, w, h, d, wall, lit }: { x: number; w: number; h: number; d: number; wall: string; lit: number }) {
  const cols = Math.max(2, Math.round(w / 0.9))
  const rows = Math.max(1, Math.round((h - 0.8) / 1.0))
  const windows: [number, number, boolean][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) windows.push([(-w / 2) + (c + 0.5) * (w / cols), 0.7 + r * 1.0, (r * 3 + c + lit) % 4 !== 0])
  return (
    <group position={[x, 0, -8.5]}>
      <RoundedBox args={[w, h, d]} radius={0.04} position={[0, h / 2, 0]}>
        <meshStandardMaterial color={wall} roughness={0.95} />
      </RoundedBox>
      <mesh position={[0, h + 0.45, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[w * 0.78, 0.9, 4]} />
        <meshStandardMaterial color="#5B4B63" roughness={0.95} />
      </mesh>
      <mesh position={[0, h + 0.56, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[w * 0.72, 0.5, 4]} />
        <meshStandardMaterial color={SNOW} roughness={1} />
      </mesh>
      <RoundedBox args={[w + 0.2, 0.14, d + 0.2]} radius={0.05} position={[0, h + 0.02, 0]}>
        <meshStandardMaterial color={SNOW} roughness={1} />
      </RoundedBox>
      {windows.map(([wx, wy, on], i) => (
        <mesh key={i} position={[wx, wy, d / 2 + 0.01]}>
          <planeGeometry args={[0.34, 0.44]} />
          <meshStandardMaterial color={on ? '#FFD27A' : '#2A2D52'} emissive={on ? '#FFB347' : '#000000'} emissiveIntensity={on ? 1.6 : 0} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function Town() {
  return (
    <group>
      {HOUSES.map(([x, w, h, d], i) => (
        <House key={i} x={x} w={w} h={h} d={d} wall={WALLS[i % WALLS.length]} lit={i} />
      ))}
      <pointLight position={[0, 2.2, -7]} color="#FFB85C" intensity={3} distance={9} />
    </group>
  )
}

/** Paper lanterns on a sagging string across the street, between the town and the cart. */
function LanternString() {
  const points: [number, number, number][] = []
  const n = 9
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = -5.2 + t * 10.4
    const sag = Math.sin(t * Math.PI) * 0.7
    points.push([x, 5.0 - sag, -4.5])
  }
  return (
    <group>
      <Line points={points} color="#6B5A4A" lineWidth={1.2} />
      {points.slice(1, -1).map(([x, y, z], i) => (
        <group key={i} position={[x, y - 0.22, z]}>
          <mesh>
            <sphereGeometry args={[0.16, 18, 14]} />
            <meshStandardMaterial color={i % 2 ? '#FF9E4A' : '#FFC46B'} emissive={i % 2 ? '#FF8A2A' : '#FFB347'} emissiveIntensity={1.4} roughness={1} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
            <meshStandardMaterial color={RED_DEEP} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function StreetLamp() {
  return (
    <group position={[3.6, 0, -2.6]}>
      <mesh position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 3.8, 10]} />
        <meshStandardMaterial color="#2E2A33" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 3.95, 0]}>
        <sphereGeometry args={[0.22, 18, 14]} />
        <meshStandardMaterial color="#FFE4A8" emissive="#FFC24A" emissiveIntensity={2.2} roughness={1} />
      </mesh>
      <SnowCap position={[0, 4.12, 0]} scale={[0.26, 0.1, 0.26]} />
      <pointLight position={[0, 3.9, 0]} color="#FFC27A" intensity={4} distance={6} />
    </group>
  )
}

function Scene() {
  const rig = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (rig.current) rig.current.rotation.y = -0.35 + Math.sin(clock.elapsedTime * 0.4) * 0.12
  })
  return (
    <group ref={rig}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>
      <Snowdrifts />
      <group position={[-0.2, 0.32, -0.7]} scale={0.6}>
        <Grandma action="wave" />
      </group>
      <Cart />
      <Stool x={1.9} z={1.3} />
      <Stool x={2.55} z={0.6} />
      <pointLight position={[0, 2.2, 0.3]} color="#FFB85C" intensity={10} distance={6} castShadow />
      <pointLight position={[0, 1.0, 1.8]} color="#FF9A45" intensity={4} distance={4.5} />
      <pointLight position={[0, 0.6, -0.4]} color="#FFC27A" intensity={2} distance={3} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={9} blur={2.5} far={3} />
    </group>
  )
}

export default function CartScene() {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 3.8, 13.5], fov: 40 }} gl={{ alpha: true, antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 1.3, 0)}>
      <fog attach="fog" args={['#1E2650', 17, 34]} />
      <ambientLight intensity={0.4} color="#9FB0E8" />
      <hemisphereLight args={['#5B6AAE', '#2B2F55', 0.6]} />
      <directionalLight position={[-3, 7, 4]} intensity={0.55} color="#BFD0FF" castShadow shadow-mapSize={[1024, 1024]} />
      <Town />
      <LanternString />
      <StreetLamp />
      <Scene />
      <Sparkles count={110} scale={[9, 7, 5]} position={[0, 3.2, 0]} size={3.5} speed={0.25} color="#FFFFFF" opacity={0.95} />
    </Canvas>
  )
}
