import { startTransition, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { FactoryScene } from './FactoryScene'

const NEXT_KEY = 'boong:login-next'

/** Where to send the guest after signing in: the page the splash button chose, or the menu. */
export function loginDestination(): string {
  return sessionStorage.getItem(NEXT_KEY) ?? '/'
}

/** Splash doubles as login: the stamping factory illustration (FactoryScene) with one entry button. */
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const enter = (to: string) => {
    try {
      // One update for both: otherwise the signed-in /login route sends us to '/' before this navigation lands.
      startTransition(() => {
        login()
        navigate(to, { replace: true })
      })
    } catch {
      setError('입장이 안 됐어요. 다시 눌러 줘요')
    }
  }

  return (
    <main className="login login--factory">
      <div className="login__scene" aria-hidden="true">
        <FactoryScene />
      </div>
      <div className="login__sign">
        <h1 className="login__title login__wordmark">호호붕어빵</h1>
      </div>
      <div className="login__cta">
        {error && <p role="alert" className="error">{error}</p>}
        <div className="login__actions">
          <button type="button" className="btn btn--ghost" onClick={() => enter('/voice')}>
            음성 주문
          </button>
          <button type="button" className="btn btn--primary" onClick={() => enter('/')}>
            붕어빵 주문
          </button>
        </div>
        <p className="login__note">MVP 체험용이라 누르면 바로 입장해요</p>
      </div>
    </main>
  )
}
