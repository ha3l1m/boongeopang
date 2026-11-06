import { Color, DataTexture, MeshPhysicalMaterial, NoColorSpace, RepeatWrapping, RGBAFormat, Vector2, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'

/**
 * Procedural, tileable normal maps that give the Blender-built character its fabric feel:
 * knit ribs on the sweater, felt fuzz on the hat, a fine weave on the apron.
 * Generated once on the client so the GLB stays small.
 */

type Kind = 'knit' | 'felt' | 'weave' | 'fluff'

const SIZE = 256

function hashGrid(cells: number, seed: number): Float32Array {
  const out = new Float32Array(cells * cells)
  let s = seed
  for (let i = 0; i < out.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    out[i] = s / 0xffffffff
  }
  return out
}

/** Tileable value noise in [0, 1]. */
function valueNoise(grid: Float32Array, cells: number, u: number, v: number): number {
  const x = u * cells
  const y = v * cells
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const at = (i: number, j: number) => grid[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)]
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
  return a + (b - a) * sy
}

const fine = hashGrid(64, 7)
const coarse = hashGrid(16, 11)

function height(kind: Kind, u: number, v: number): number {
  const fract = (n: number) => n - Math.floor(n)
  switch (kind) {
    case 'knit': {
      const col = fract(u * 8)
      const rib = 1 - Math.abs(2 * col - 1)
      const stitch = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * 16 + 2 * Math.abs(col - 0.5)))
      return 0.65 * rib + 0.35 * stitch
    }
    case 'felt':
      return 0.7 * valueNoise(fine, 64, u, v) + 0.3 * valueNoise(coarse, 16, u, v)
    case 'weave':
      return 0.5 + 0.25 * (Math.sin(2 * Math.PI * u * 32) + Math.sin(2 * Math.PI * v * 32)) * (0.8 + 0.2 * valueNoise(fine, 64, u, v))
    case 'fluff':
      return valueNoise(coarse, 16, u, v) * 0.6 + valueNoise(fine, 64, u, v) * 0.4
  }
}

const cache = new Map<Kind, DataTexture>()

function normalMap(kind: Kind): DataTexture {
  const hit = cache.get(kind)
  if (hit) return hit
  const h = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = height(kind, x / SIZE, y / SIZE)
  const data = new Uint8Array(SIZE * SIZE * 4)
  const at = (x: number, y: number) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2
      const len = Math.hypot(dx, dy, 1)
      const i = (y * SIZE + x) * 4
      data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }
  const texture = new DataTexture(data, SIZE, SIZE, RGBAFormat)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  cache.set(kind, texture)
  return texture
}

type Look = { kind?: Kind; repeat?: [number, number]; strength?: number; sheen?: number; roughness?: number }

/** Keyed by the Blender material names in halmae.glb. */
const LOOKS: Record<string, Look> = {
  Knit: { kind: 'knit', repeat: [3, 3], strength: 0.9, sheen: 0.6, roughness: 0.9 },
  HatFelt: { kind: 'felt', repeat: [4, 4], strength: 0.7, sheen: 0.45, roughness: 0.95 },
  HatFur: { kind: 'fluff', repeat: [6, 2], strength: 0.5, sheen: 1, roughness: 1 },
  Apron: { kind: 'weave', repeat: [2, 2], strength: 0.35, sheen: 0.4, roughness: 0.9 },
  Pants: { kind: 'knit', repeat: [3, 3], strength: 0.6, sheen: 0.4, roughness: 0.9 },
  Hair: { kind: 'fluff', repeat: [3, 3], strength: 0.4, sheen: 0.5, roughness: 0.75 },
  Skin: { sheen: 0.25, roughness: 0.6 },
}

function upgrade(material: Material): Material {
  const look = LOOKS[material.name]
  if (!look) return material
  const base = material as MeshStandardMaterial
  const physical = base instanceof MeshPhysicalMaterial ? base : new MeshPhysicalMaterial({ name: base.name, color: base.color.clone() })
  if (look.kind) {
    const map = normalMap(look.kind).clone()
    map.repeat.set(...(look.repeat ?? [1, 1]))
    map.needsUpdate = true
    physical.normalMap = map
    physical.normalScale = new Vector2(look.strength ?? 1, look.strength ?? 1)
  }
  physical.roughness = look.roughness ?? base.roughness
  physical.metalness = 0
  physical.sheen = look.sheen ?? 0
  physical.sheenRoughness = 0.8
  physical.sheenColor = new Color('#ffffff').lerp(physical.color, 0.75)
  physical.needsUpdate = true
  return physical
}

/** Apply fabric normal maps and soft sheen once per loaded GLB scene (shared by all clones). */
export function applyClayLook(root: Object3D): void {
  if (root.userData.clayLook) return
  root.userData.clayLook = true
  const done = new Map<Material, Material>()
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const swap = (m: Material) => {
      const hit = done.get(m)
      if (hit) return hit
      const next = upgrade(m)
      done.set(m, next)
      return next
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
  })
}
