import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { type Mesh, type Object3D } from 'three'
import type { GrandmaAction } from './sceneMode'
import { applyClayLook } from './clayTextures'

/** Built by tools/blender/build_halmae.py. Pivot nodes are posed in code below. */
export const HALMAE_URL = '/models/halmae.glb'

type ArmPose = { x: number; z: number }
type Pose = { left: ArmPose; right: ArmPose; headX: number }

const REST: ArmPose = { x: 0, z: 0.15 }

/** Still poses: each action's end state (for pack, the fish has already been lowered into the bag). */
function poseFor(action: GrandmaAction): Pose {
  switch (action) {
    case 'wave':
      return { left: REST, right: { x: 0, z: 2.5 }, headX: 0 }
    case 'present':
      return { left: { x: -0.35, z: -1.85 }, right: { x: -0.35, z: 1.85 }, headX: 0.03 }
    case 'cheer':
      return { left: { x: 0, z: -2.4 }, right: { x: 0, z: 2.4 }, headX: -0.1 }
    case 'pack':
      return { left: { x: -0.5, z: -0.35 }, right: { x: -0.5, z: 0.35 }, headX: 0.15 }
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
  useEffect(() => {
    model.traverse((node) => {
      if ((node as Mesh).isMesh) {
        node.castShadow = true
        node.receiveShadow = true
      }
    })
  }, [model])

  useEffect(() => {
    const pose = poseFor(action)
    const { head, armL, armR, face } = rig
    armL.rotation.x = pose.left.x
    armL.rotation.z = -Math.abs(pose.left.z)
    armR.rotation.x = pose.right.x
    armR.rotation.z = Math.abs(pose.right.z)
    head.rotation.set(pose.headX, 0, 0)
    const shown = EXPRESSIONS[expression ?? ACTION_EXPRESSION[action]]
    for (const part of FACE_PARTS) face[part].visible = shown.includes(part)
  }, [rig, action, expression])

  return <primitive object={model} />
}

useGLTF.preload(HALMAE_URL)
