import { useRobotLinkUp } from '../services/remoteSync'

export function RobotLinkBanner() {
  const up = useRobotLinkUp()
  return up ? null : <p className="robot-link" role="status">붕봇 연결 중…</p>
}
