import { Environment, Lightformer } from '@react-three/drei'

/** Soft studio light built in-scene (no HDRI download): a big warm softbox above, cool fill, rim from behind. */
export function StudioEnvironment({ intensity = 0.6 }: { intensity?: number }) {
  return (
    <Environment resolution={256} environmentIntensity={intensity}>
      <Lightformer form="rect" intensity={3} color="#FFF2DE" position={[0, 6, 3]} scale={[10, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.2} color="#DCE8FF" position={[-6, 2, 2]} scale={[6, 6, 1]} target={[0, 1, 0]} />
      <Lightformer form="rect" intensity={1.5} color="#FFE3C2" position={[5, 3, -4]} scale={[5, 6, 1]} target={[0, 1, 0]} />
      <Lightformer form="circle" intensity={1} color="#FFFFFF" position={[0, 2, 7]} scale={3} target={[0, 1.5, 0]} />
    </Environment>
  )
}
