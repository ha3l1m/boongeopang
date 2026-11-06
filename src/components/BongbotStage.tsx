import { BongbotScene } from './BongbotScene'
import type { SceneMode } from '../three/sceneMode'

const CAPTION: Record<SceneMode, string> = {
  idle: '붕봇이 틀을 데우며 기다리는 중',
  ordering: '붕봇이 주문서를 받는 중',
  received: '붕봇이 주문을 받았어요',
  batter: '붕봇이 반죽을 붓는 중',
  filling: '붕봇이 속을 넣는 중',
  baking: '틀 뚜껑이 닫히고 김이 모락모락 나다가, 열리면 노릇한 붕어빵 두 마리가 보여요',
  packed: '붕봇이 노릇한 붕어빵을 봉투에 쏙 담는 중',
  ready: '봉투에서 붕어빵이 고개를 내밀고 반짝반짝 빛나요',
}

type Props = { mode: SceneMode; height?: number; cue?: number }

/** Animated robot-kitchen illustration for the current step (see BongbotScene). */
export function BongbotStage({ mode, height = 240, cue = 0 }: Props) {
  return (
    <figure className="stage" style={{ height }}>
      <figcaption className="sr-only">{CAPTION[mode]}</figcaption>
      <BongbotScene mode={mode} cue={cue} />
    </figure>
  )
}
