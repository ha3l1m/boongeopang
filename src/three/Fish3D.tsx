import { useMemo, type ReactNode } from 'react'
import { CatmullRomCurve3, ExtrudeGeometry, Shape, TubeGeometry, Vector3 } from 'three'

const BODY = '#F3A43A'
const FIN = '#EC9A30'
const GROOVE = '#D9821F'
const clay = { roughness: 0.72, metalness: 0 }

/** Puffy body: an ellipsoid. Details are laid onto its surface so they read as embossed ridges. */
const BODY_C = 0.1
const RX = 0.55
const RY = 0.45
const RZ = 0.26
/** Where the tail fin meets the body. */
const TAIL_ROOT = -0.36

function surfaceZ(x: number, y: number): number {
  const k = 1 - ((x - BODY_C) / RX) ** 2 - (y / RY) ** 2
  return RZ * Math.sqrt(Math.max(k, 0))
}

function arc(cx: number, cy: number, r: number, from: number, to: number, steps = 10): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
}

function ridge(points: [number, number][], radius: number, lift = 0.004): TubeGeometry {
  const curve = new CatmullRomCurve3(points.map(([x, y]) => new Vector3(x, y, surfaceZ(x, y) + lift)))
  return new TubeGeometry(curve, 24, radius, 8, false)
}

function finShape(points: [number, number][]): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(...points[0])
  for (let i = 1; i < points.length; i += 2) shape.quadraticCurveTo(...points[i], ...points[i + 1])
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.045,
    bevelSegments: 6,
    curveSegments: 24,
  })
  geometry.translate(0, 0, -0.03)
  return geometry
}

function buildGeometry() {
  const tail = finShape([
    [-0.38, 0.05],
    [-0.62, 0.42],
    [-0.88, 0.33],
    [-0.8, 0],
    [-0.88, -0.33],
    [-0.62, -0.42],
    [-0.38, -0.05],
  ])
  const dorsal = finShape([
    [-0.28, 0.33],
    [-0.12, 0.6],
    [0.12, 0.43],
  ])
  const belly = finShape([
    [0.08, -0.4],
    [-0.08, -0.6],
    [-0.24, -0.36],
  ])
  const sideRidges = [
    ridge(arc(0.02, 0, 0.32, -1.05, 1.05), 0.022),
    ridge(arc(-0.14, 0.13, 0.1, Math.PI + 0.35, Math.PI * 2 - 0.35, 8), 0.018),
    ridge(arc(-0.14, -0.12, 0.1, Math.PI + 0.35, Math.PI * 2 - 0.35, 8), 0.018),
    ridge(arc(-0.32, 0.01, 0.09, Math.PI + 0.4, Math.PI * 2 - 0.4, 8), 0.016),
  ]
  const tailRidges = [
    [[-0.5, 0.04], [-0.78, 0.24]],
    [[-0.52, 0], [-0.76, 0]],
    [[-0.5, -0.04], [-0.78, -0.24]],
  ].map(
    (line) => new TubeGeometry(new CatmullRomCurve3(line.map(([x, y]) => new Vector3(x, y, 0.085))), 6, 0.016, 6, false),
  )
  return { tail, dorsal, belly, sideRidges, tailRidges }
}

/** Flat fish silhouette (body + tail) in the fish's own x/y space, for mold cavities and batter. */
export function fishOutline(): Shape[] {
  const body = new Shape()
  body.absellipse(BODY_C + 0.12, 0, RX + 0.05, RY + 0.05, 0, Math.PI * 2, false, 0)
  const tail = new Shape()
  tail.moveTo(-0.22, 0.06)
  tail.quadraticCurveTo(-0.5, 0.47, -0.8, 0.36)
  tail.quadraticCurveTo(-0.7, 0, -0.8, -0.36)
  tail.quadraticCurveTo(-0.5, -0.47, -0.22, -0.06)
  return [body, tail]
}

let shared: ReturnType<typeof buildGeometry> | null = null
function geometry() {
  shared ??= buildGeometry()
  return shared
}

/** Scales tail parts around the tail root so the fin can shrink without detaching from the body. */
function TailPivot({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <group position={[TAIL_ROOT, 0, 0]} scale={scale}>
      <group position={[-TAIL_ROOT, 0, 0]}>{children}</group>
    </group>
  )
}

function Side({ tailScale }: { tailScale: number }) {
  const { sideRidges, tailRidges } = useMemo(geometry, [])
  return (
    <group>
      {sideRidges.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={GROOVE} {...clay} />
        </mesh>
      ))}
      <TailPivot scale={tailScale}>
        {tailRidges.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial color={GROOVE} {...clay} />
          </mesh>
        ))}
      </TailPivot>
      <mesh position={[0.36, 0.12, surfaceZ(0.36, 0.12) - 0.01]} scale={[1, 1, 0.35]}>
        <sphereGeometry args={[0.065, 20, 20]} />
        <meshStandardMaterial color="#C9701A" roughness={0.6} />
      </mesh>
    </group>
  )
}

export function Fish3D({ filling, tailScale = 1 }: { filling?: string; tailScale?: number }) {
  const { tail, dorsal, belly } = useMemo(geometry, [])
  return (
    <group position={[0.12, 0, 0]}>
      <mesh position={[BODY_C, 0, 0]} scale={[RX, RY, RZ]} castShadow receiveShadow>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial color={BODY} {...clay} />
      </mesh>
      <TailPivot scale={tailScale}>
        <mesh geometry={tail} castShadow>
          <meshStandardMaterial color={FIN} {...clay} />
        </mesh>
      </TailPivot>
      {[dorsal, belly].map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color={FIN} {...clay} />
        </mesh>
      ))}
      {[0.02, -0.12].map((y) => (
        <mesh key={y} position={[0.66, y, 0]} scale={[0.7, 0.6, 1.25]} castShadow>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshStandardMaterial color={FIN} {...clay} />
        </mesh>
      ))}
      <Side tailScale={tailScale} />
      <group scale={[1, 1, -1]}>
        <Side tailScale={tailScale} />
      </group>
      {filling && (
        <group position={[-0.22, 0.36, 0]} rotation={[0, 0, 0.45]}>
          <mesh>
            <cylinderGeometry args={[0.11, 0.11, 0.05, 28]} />
            <meshStandardMaterial color="#FFE7B8" {...clay} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 28]} />
            <meshStandardMaterial color={filling} roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  )
}
