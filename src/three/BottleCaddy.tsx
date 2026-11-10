import { RoundedBox } from '@react-three/drei'

export type BottleKind = 'batter' | 'filling'

export const BATTER = '#FFE7B8'
const SCALE = 0.85
/** Body half-height and nozzle reach from the body centre, after scaling. */
const BODY_HALF = 0.16 * SCALE
export const NOZZLE_REACH = 0.33 * SCALE

/** Caddy on the counter, front-left of the robot, and where each bottle stands in it. */
const CADDY: [number, number, number] = [-1.75, 0, 1.05]
const SEAT_Y = 0.05
export const BOTTLE_CENTER_Y = SEAT_Y + BODY_HALF
export const BOTTLE_SPOT: Record<BottleKind, [number, number, number]> = {
  batter: [-1.6, BOTTLE_CENTER_Y, 0.95],
  filling: [-1.9, BOTTLE_CENTER_Y, 1.15],
}

/** Squeeze bottle drawn nozzle-up around its body centre; the liquid shows the batter or filling colour. */
export function Bottle({ liquid }: { liquid: string }) {
  return (
    <group scale={SCALE}>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.088, 0.088, 0.26, 8]} />
        <meshStandardMaterial color={liquid} roughness={0.5} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.1, 0.1, 0.32, 8]} />
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.3} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.05, 0.1, 0.06, 16]} />
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.45} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.05, 16]} />
        <meshStandardMaterial color="#FBF6EE" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <coneGeometry args={[0.03, 0.06, 16]} />
        <meshStandardMaterial color="#FBF6EE" roughness={0.8} />
      </mesh>
    </group>
  )
}

/** Rounded tan tray holding the batter and filling bottles, both in their seats (nothing is held in the still scene). */
export function BottleCaddy({ filling }: { filling: string }) {
  const dx = BOTTLE_SPOT.filling[0] - BOTTLE_SPOT.batter[0]
  const dz = BOTTLE_SPOT.filling[2] - BOTTLE_SPOT.batter[2]

  return (
    <group>
      <group position={CADDY} rotation={[0, -Math.atan2(dz, dx), 0]}>
        <RoundedBox args={[0.62, 0.1, 0.3]} radius={0.05} smoothness={4} position={[0, 0.05, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#D9A574" roughness={0.85} />
        </RoundedBox>
        <RoundedBox args={[0.54, 0.02, 0.22]} radius={0.01} smoothness={2} position={[0, 0.1, 0]}>
          <meshStandardMaterial color="#C48E5E" roughness={0.9} />
        </RoundedBox>
      </group>
      <group position={BOTTLE_SPOT.batter}>
        <Bottle liquid={BATTER} />
      </group>
      <group position={BOTTLE_SPOT.filling}>
        <Bottle liquid={filling} />
      </group>
    </group>
  )
}
