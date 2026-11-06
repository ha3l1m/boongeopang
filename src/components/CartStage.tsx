import { lazy } from 'react'
import { FishBread } from './FishBread'
import { Stage3D, StaticFallback } from './Stage3D'

const CartScene = lazy(() => import('../three/CartScene'))

export function CartStage({ height }: { height: number }) {
  return (
    <Stage3D
      caption="눈 내리는 밤, 따뜻한 불빛의 붕어빵 포장마차에서 할매가 손을 흔들어요"
      height={height}
      fallback={
        <StaticFallback>
          <FishBread size={140} className="bob" />
        </StaticFallback>
      }
    >
      <CartScene />
    </Stage3D>
  )
}
