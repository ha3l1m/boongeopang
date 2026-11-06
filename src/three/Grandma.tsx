import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { MathUtils, type Mesh, type Object3D } from 'three'
import { PACK, type GrandmaAction } from './sceneMode'
import { applyClayLook } from './clayTextures'

/** Built by tools/blender/build_halmae.py. Pivot nodes are posed in code below. */
export const HALMAE_URL = '/models/halmae.glb'

type ArmPose = { x: number; z: number }
type Pose = { left: ArmPose; right: ArmPose; headX: number }

const REST: ArmPose = { x: 0, z: 0.15 }

function poseFor(action: GrandmaAction, t: number, since: number): Pose {
  switch (action) {
    case 'wave':
      return { left: REST, right: { x: 0, z: 2.5 + Math.sin(t * 7) * 0.35 }, headX: 0 }
    case 'present': {
      const bob = Math.sin(t * 3) * 0.15
      return { left: { x: -0.35, z: -(1.85 + bob) }, right: { x: -0.35, z: 1.85 - bob }, headX: 0.03 }
    }
    case 'cheer':
      return { left: { x: 0, z: -2.4 - Math.sin(t * 6) * 0.25 }, right: { x: 0, z: 2.4 + Math.sin(t * 6) * 0.25 }, headX: -0.1 }
    case 'pack': {
      const p = t - since
      const reach = p < PACK.hold ? -1.35 : p < PACK.drop ? MathUtils.lerp(-1.35, -0.7, (p - PACK.hold) / (PACK.drop - PACK.hold)) : -0.5
      const pat = p > PACK.drop ? Math.abs(Math.sin(t * 6)) * 0.15 : 0
      const arm = { x: reach + pat, z: 0.35 }
      return { left: { x: arm.x, z: -arm.z }, right: arm, headX: p < PACK.drop ? 0.35 : 0.15 }
    }
    default:
      return { left: REST, right: REST, headX: 0.05 }
  }
}

export type Expression = 'basic' | 'happy' | 'surprise' | 'curious' | 'hoho' | 'wink'

const FACE_PARTS = ['EyesOpen', 'EyesHappy', 'EyesWink', 'EyesWide', 'MouthSmile', 'MouthO', 'MouthLaugh'] as const
const EXPR_PREFIX = 'EXPR_'
const PIVOT_PREFIX = 'PIVOT_'
type FacePart = (typeof FACE_PARTS)[number]

/** Which eye and mouth parts of the character sheet's six expressions are shown. */
const EXPRESSIONS: Record<Expression, readonly FacePart[]> = {
  basic: ['EyesOpen', 'MouthSmile'],
  happy: ['EyesHappy', 'MouthSmile'],
  surprise: ['EyesWide', 'MouthO'],
  curious: ['EyesOpen', 'MouthO'],
  hoho: ['EyesHappy', 'MouthLaugh'],
  wink: ['EyesWink', 'MouthSmile'],
}

const ACTION_EXPRESSION: Record<GrandmaAction, Expression> = {
  idle: 'basic',
  wave: 'happy',
  present: 'hoho',
  pack: 'basic',
  cheer: 'hoho',
}

type Rig = { head: Object3D; body: Object3D; armL: Object3D; armR: Object3D; face: Record<FacePart, Object3D> }

function findRig(root: Object3D): Rig {
  const get = (name: string) => {
    const node = root.getObjectByName(name)
    if (!node) throw new Error(`halmae.glb is missing node ${name}`)
    return node
  }
  const face = Object.fromEntries(FACE_PARTS.map((part) => [part, get(EXPR_PREFIX + part)])) as Record<FacePart, Object3D>
  const pivot = (name: string) => get(PIVOT_PREFIX + name)
  return { head: pivot('Head'), body: pivot('Body'), armL: pivot('ArmL'), armR: pivot('ArmR'), face }
}

export function Grandma({ action, expression }: { action: GrandmaAction; expression?: Expression }) {
  const { scene } = useGLTF(HALMAE_URL)
  const model = useMemo(() => {
    applyClayLook(scene)
    return scene.clone(true)
  }, [scene])
  const rig = useMemo(() => findRig(model), [model])
  const started = useRef({ action, since: -1 })

  useEffect(() => {
    model.traverse((node) => {
      if ((node as Mesh).isMesh) {
        node.castShadow = true
        node.receiveShadow = true
      }
    })
  }, [model])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (started.current.action !== action || started.current.since < 0) started.current = { action, since: t }
    const pose = poseFor(action, t, started.current.since)
    const { head, body, armL, armR, face } = rig
    armL.rotation.x = MathUtils.damp(armL.rotation.x, pose.left.x, 6, delta)
    armL.rotation.z = MathUtils.damp(armL.rotation.z, -Math.abs(pose.left.z), 6, delta)
    armR.rotation.x = MathUtils.damp(armR.rotation.x, pose.right.x, 6, delta)
    armR.rotation.z = MathUtils.damp(armR.rotation.z, Math.abs(pose.right.z), 6, delta)
    const shake = action === 'present' ? Math.sin(t * 1.2) * 0.25 : action === 'wave' ? Math.sin(t * 2) * 0.12 : 0
    const nod = action === 'present' ? Math.sin(t * 2.4) * 0.06 : 0
    head.rotation.x = MathUtils.damp(head.rotation.x, pose.headX + nod, 4, delta)
    head.rotation.y = MathUtils.damp(head.rotation.y, shake, 4, delta)
    head.rotation.z = Math.sin(t * 1.1) * (action === 'present' ? 0.12 : 0.05)
    body.scale.y = 1 + Math.sin(t * 2) * 0.015
    const shown = EXPRESSIONS[expression ?? ACTION_EXPRESSION[action]]
    for (const part of FACE_PARTS) face[part].visible = shown.includes(part)
    face.EyesOpen.scale.y = Math.sin(t * 0.9 + 1) > 0.985 ? 0.15 : 1
  })

  return <primitive object={model} />
}

useGLTF.preload(HALMAE_URL)
