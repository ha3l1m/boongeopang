import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import logoFactory from '../assets/logo-hoho-factory.svg'
import { FactoryScene } from './FactoryScene'

/** Splash doubles as login: the stamping factory illustration (FactoryScene) with one entry button. */
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const enter = () => {
    try {
      login()
      navigate('/', { replace: true })
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
        <h1 className="login__title">
          <img src={logoFactory} alt="호호붕어빵" className="login__logo" />
        </h1>
      </div>
      <div className="login__cta">
        {error && <p role="alert" className="error">{error}</p>}
        <button type="button" className="btn btn--primary btn--block" onClick={enter}>
          붕어빵 주문
        </button>
        <p className="login__note">MVP 체험용이라 누르면 바로 입장해요</p>
      </div>
    </main>
  )
}
