import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { ExtrudeGeometry, MathUtils, type Group } from 'three'
import { fishOutline } from './Fish3D'
import { solveArm, type ArmAngles } from './armIk'
import { BATTER, BOTTLE_SPOT, Bottle, NOZZLE_REACH, type BottleKind } from './BottleCaddy'
import { POUR_POINTS, POUR_TOP } from './MoldRig'
import { armTarget, bottleFlip, holdingBottle, POUR_TIMELINE, type ArmTarget } from './pourTimeline'
import type { SceneMode } from './sceneMode'
import { useStepClock } from './useStepClock'

type Pose = ArmAngles & { headTilt: number }

const BASE: [number, number, number] = [-1.1, 0, 0.15]
const UPPER_ARM = 1.15
const FOREARM = 1.05
const SHOULDER_Y = 0.55
const ARM = { base: BASE, shoulderY: SHOULDER_Y, upper: UPPER_ARM, fore: FOREARM }
/** How far below the wrist pivot the held bottle's body centre sits. */
const GRIP_Y = 0.42
const HOVER = 0.3

function reach(target: [number, number, number]): Pose {
  return { ...solveArm(target, ARM), headTilt: 0 }
}

/** How far the gripper leans while pouring, so the bottle points its nozzle down toward the mold like a real squeeze. */
const POUR_TILT = 0.55

/** Wrist goal that puts the tilted bottle's nozzle exactly where MoldRig's stream starts above a cavity. */
function pourPose([x, y, z]: readonly [number, number, number]): Pose {
  const reachOut = GRIP_Y + NOZZLE_REACH
  const tip = y + POUR_TOP
  return { ...reach([x - reachOut * Math.sin(POUR_TILT), tip + reachOut * Math.cos(POUR_TILT), z]), headTilt: POUR_TILT }
}

function posesFor(kind: BottleKind): Record<ArmTarget, Pose> {
  const [x, y, z] = BOTTLE_SPOT[kind]
  return {
    above: reach([x, y + GRIP_Y + HOVER, z]),
    grab: reach([x, y + GRIP_Y, z]),
    cavityA: pourPose(POUR_POINTS[0]),
    cavityB: pourPose(POUR_POINTS[1]),
  }
}
const POUR_POSES: Record<BottleKind, Record<ArmTarget, Pose>> = { batter: posesFor('batter'), filling: posesFor('filling') }

const POSES: Record<Exclude<SceneMode, BottleKind>, Pose> = {
  idle: { yaw: 0, shoulder: -0.15, elbow: 0.35, headTilt: 0 },
  ordering: { yaw: 0, shoulder: -0.25, elbow: 0.1, headTilt: 0 },
  received: { yaw: 0, shoulder: 0.1, elbow: 0.9, headTilt: 0.15 },
  baking: { yaw: 0, shoulder: -0.1, elbow: -0.5, headTilt: -0.1 },
  packed: { yaw: 0, shoulder: -0.1, elbow: 0.4, headTilt: 0.15 },
  ready: { yaw: 0, shoulder: 0, elbow: 0.7, headTilt: 0.2 },
}

function bottleFor(mode: SceneMode): BottleKind | null {
  return mode === 'batter' || mode === 'filling' ? mode : null
}

/** Goal pose for this moment: the pick-pour-return routine for batter/filling, a fixed pose otherwise. */
function goalPose(mode: SceneMode, elapsed: number): Pose {
  const kind = bottleFor(mode)
  return kind ? POUR_POSES[kind][armTarget(elapsed)] : POSES[mode as keyof typeof POSES]
}

const ease = 6
const CREAM = '#F4DDB8'
const BROWN = '#7A4A2E'
const DECAL = '#F0A020'
const clay = { roughness: 0.82, metalness: 0 }

function useDecalFish(): ExtrudeGeometry {
  return useMemo(() => new ExtrudeGeometry(fishOutline(), { depth: 0.01, bevelEnabled: false, curveSegments: 24 }), [])
}

/** Joint housing: a cream drum whose axis faces the camera, capped with brown discs. */
function Joint({ radius, depth }: { radius: number; depth: number }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, depth, 40]} />
        <meshStandardMaterial color={CREAM} {...clay} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, (side * (depth + 0.04)) / 2, 0]}>
          <cylinderGeometry args={[radius * 0.8, radius * 0.84, 0.04, 40]} />
          <meshStandardMaterial color={BROWN} {...clay} />
        </mesh>
      ))}
    </group>
  )
}

function Band({ y, radius, height = 0.07 }: { y: number; radius: number; height?: number }) {
  return (
    <mesh position={[0, y, 0]}>
      <cylinderGeometry args={[radius, radius, height, 32]} />
      <meshStandardMaterial color={BROWN} {...clay} />
    </mesh>
  )
}

/** Upright orange fish logo with three stripes below it, on a link's front face. */
function Decal({ y, z, fish }: { y: number; z: number; fish: ExtrudeGeometry }) {
  return (
    <group position={[0, y, z]}>
      <mesh geometry={fish} position={[0, 0.08, 0]} scale={0.15} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color={DECAL} {...clay} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, -0.1 - i * 0.045, 0.004]}>
          <boxGeometry args={[0.1, 0.022, 0.008]} />
          <meshStandardMaterial color={DECAL} {...clay} />
        </mesh>
      ))}
    </group>
  )
}

function Link({ length, width, fish }: { length: number; width: number; fish?: ExtrudeGeometry }) {
  return (
    <group>
      <RoundedBox args={[width, length, width * 0.9]} radius={width * 0.42} smoothness={5} position={[0, length / 2, 0]} castShadow>
        <meshStandardMaterial color={CREAM} {...clay} />
      </RoundedBox>
      {fish && <Decal y={length * 0.45} z={width * 0.45 + 0.002} fish={fish} />}
    </group>
  )
}

const RING_SEGMENTS = 12

/** Segmented brown foot ring with a round cream plate on top. */
function Base() {
  return (
    <group>
      {Array.from({ length: RING_SEGMENTS }, (_, i) => {
        const a = (i / RING_SEGMENTS) * Math.PI * 2
        return (
          <RoundedBox key={i} args={[0.25, 0.14, 0.14]} radius={0.03} smoothness={3} position={[Math.sin(a) * 0.46, 0.07, Math.cos(a) * 0.46]} rotation={[0, a, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={BROWN} {...clay} />
          </RoundedBox>
        )
      })}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.13, 40]} />
        <meshStandardMaterial color={BROWN} {...clay} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.42, 0.1, 48]} />
        <meshStandardMaterial color={CREAM} {...clay} />
      </mesh>
    </group>
  )
}

const FINGER_OPEN = 0.2
const FINGER_CLOSED = 0.135

/** Claw gripper hanging from the wrist: palm, bolted bridge, two fingers with brown pads. */
function Gripper({ fingers, bottle, liquid }: { fingers: MutableRefObject<Group | null>; bottle: MutableRefObject<Group | null>; liquid: string }) {
  return (
    <group>
      <Joint radius={0.12} depth={0.24} />
      <Band y={-0.12} radius={0.1} height={0.06} />
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.085, 0.09, 0.06, 24]} />
        <meshStandardMaterial color={CREAM} {...clay} />
      </mesh>
      <RoundedBox args={[0.44, 0.11, 0.2]} radius={0.05} smoothness={4} position={[0, -0.22, 0]} castShadow>
        <meshStandardMaterial color={CREAM} {...clay} />
      </RoundedBox>
      <group position={[0, -0.22, 0.105]}>
        <RoundedBox args={[0.18, 0.07, 0.02]} radius={0.01} smoothness={2}>
          <meshStandardMaterial color={BROWN} {...clay} />
        </RoundedBox>
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0, 0.012]}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshStandardMaterial color={DECAL} {...clay} />
          </mesh>
        ))}
      </group>
      <group ref={fingers}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * FINGER_OPEN, -0.22, 0]}>
            <RoundedBox args={[0.07, 0.26, 0.17]} radius={0.03} smoothness={3} position={[0, -0.13, 0]} castShadow>
              <meshStandardMaterial color={CREAM} {...clay} />
            </RoundedBox>
            <RoundedBox args={[0.035, 0.13, 0.13]} radius={0.015} smoothness={3} position={[-side * 0.045, -0.17, 0]}>
              <meshStandardMaterial color={BROWN} {...clay} />
            </RoundedBox>
          </group>
        ))}
      </group>
      <group ref={bottle} position={[0, -GRIP_Y, 0]} visible={false}>
        <Bottle liquid={liquid} />
      </group>
    </group>
  )
}

type Props = { mode: SceneMode; cue: number; filling: string; held: MutableRefObject<BottleKind | null> }

export function Bongbot({ mode, cue, filling, held }: Props) {
  const fish = useDecalFish()
  const yaw = useRef<Group>(null)
  const shoulder = useRef<Group>(null)
  const elbow = useRef<Group>(null)
  const head = useRef<Group>(null)
  const fingers = useRef<Group>(null)
  const bottle = useRef<Group>(null)
  const clock = useStepClock(mode, cue)
  const kind = bottleFor(mode)

  useFrame(({ clock: { elapsedTime: t } }, delta) => {
    if (!yaw.current || !shoulder.current || !elbow.current || !head.current) return
    const elapsed = clock.current.elapsed
    const pose = goalPose(mode, elapsed)
    const sway = mode === 'idle' ? Math.sin(t * 1.2) * 0.08 : 0
    const wave = mode === 'received' || mode === 'ready' ? Math.sin(t * 6) * 0.35 : 0
    yaw.current.rotation.y = MathUtils.damp(yaw.current.rotation.y, pose.yaw, ease, delta)
    shoulder.current.rotation.z = MathUtils.damp(shoulder.current.rotation.z, pose.shoulder + sway, ease, delta)
    elbow.current.rotation.z = MathUtils.damp(elbow.current.rotation.z, pose.elbow + wave, ease, delta)
    const upright = -(shoulder.current.rotation.z + elbow.current.rotation.z)
    const nod = kind ? 0 : mode === 'ordering' ? Math.sin(t * 7) * 0.25 : Math.sin(t * 1.6) * 0.05
    head.current.rotation.z = upright + pose.headTilt
    head.current.rotation.x = nod

    const holding = kind !== null && holdingBottle(elapsed)
    held.current = holding ? kind : null
    const closed = holding || (kind !== null && elapsed >= POUR_TIMELINE.grip - 0.15 && elapsed < POUR_TIMELINE.release)
    fingers.current?.children.forEach((finger, i) => {
      const side = i === 0 ? -1 : 1
      finger.position.x = MathUtils.damp(finger.position.x, side * (closed ? FINGER_CLOSED : FINGER_OPEN), 12, delta)
    })
    if (bottle.current) {
      bottle.current.visible = holding
      bottle.current.rotation.z = bottleFlip(elapsed) * Math.PI
    }
  })

  return (
    <group position={BASE}>
      <Base />
      <group ref={yaw} position={[0, 0.22, 0]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.24, 0.2, 40]} />
          <meshStandardMaterial color={CREAM} {...clay} />
        </mesh>
        <group ref={shoulder} position={[0, SHOULDER_Y - 0.22, 0]}>
          <Joint radius={0.22} depth={0.42} />
          <Link length={UPPER_ARM} width={0.32} fish={fish} />
          <group ref={elbow} position={[0, UPPER_ARM, 0]}>
            <Joint radius={0.19} depth={0.38} />
            <Link length={FOREARM} width={0.25} />
            <Band y={FOREARM - 0.22} radius={0.13} />
            <group ref={head} position={[0, FOREARM, 0]}>
              <Gripper fingers={fingers} bottle={bottle} liquid={kind === 'filling' ? filling : BATTER} />
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
