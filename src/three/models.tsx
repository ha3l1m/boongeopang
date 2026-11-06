import { RoundedBox } from '@react-three/drei'

export { Fish3D } from './Fish3D'

const clay = { roughness: 0.85, metalness: 0 }

export function Counter() {
  return (
    <group position={[0, -0.2, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[2.3, 2.3, 0.3, 64]} />
        <meshStandardMaterial color="#EBC9A4" {...clay} />
      </mesh>
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[2.25, 2.25, 0.02, 64]} />
        <meshStandardMaterial color="#F6E0C4" {...clay} />
      </mesh>
    </group>
  )
}

export function Bag3D() {
  return (
    <group>
      <RoundedBox args={[0.8, 0.85, 0.5]} radius={0.06} smoothness={4} position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color="#EDD4A6" {...clay} />
      </RoundedBox>
      <mesh position={[0, 0.45, 0.26]}>
        <torusGeometry args={[0.16, 0.02, 8, 32]} />
        <meshStandardMaterial color="#C8432B" {...clay} />
      </mesh>
    </group>
  )
}
