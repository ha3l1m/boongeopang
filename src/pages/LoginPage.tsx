import { useEffect, useState } from 'react'
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    sessionStorage.removeItem(NEXT_KEY)
  }, [])

  const enter = (path: string) => {
    try {
      sessionStorage.setItem(NEXT_KEY, path)
      login()
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
        <button type="button" className="btn btn--ghost btn--block" onClick={() => enter('/voice')}>
          음성 주문
        </button>
        <button type="button" className="btn btn--primary btn--block" onClick={() => enter('/')}>
          붕어빵 주문
        </button>
        <p className="login__note">MVP 체험용이라 누르면 바로 입장해요</p>
      </div>
    </main>
  )
}
