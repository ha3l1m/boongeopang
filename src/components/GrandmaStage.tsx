import { lazy } from 'react'
import { FishBread } from './FishBread'
import { Stage3D, StaticFallback } from './Stage3D'
import type { GrandmaAction } from '../three/sceneMode'

const GrandmaScene = lazy(() => import('../three/GrandmaScene'))

type Props = { action: GrandmaAction; framing: 'bust'; caption: string; height: number }

export function GrandmaStage({ action, framing, caption, height }: Props) {
  return (
    <Stage3D
      caption={caption}
      height={height}
      fallback={
        <StaticFallback>
          <FishBread size={110} className="bob" />
        </StaticFallback>
      }
    >
      <GrandmaScene action={action} framing={framing} />
    </Stage3D>
  )
}
