import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminPinConfigured, checkAdminPin } from '../../services/adminAuth'

const PIN_PATTERN = /^\d{4,8}$/

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const configured = adminPinConfigured()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!PIN_PATTERN.test(pin)) {
      setError('숫자 4~8자리로 입력해 주세요')
      return
    }
    try {
      if (checkAdminPin(pin, import.meta.env.VITE_ADMIN_PIN)) navigate('/admin', { replace: true })
      else setError('PIN이 맞지 않아요')
    } catch {
      setError('로그인 정보를 저장할 수 없어요')
    }
  }

  return (
    <main className="admin-login">
      <div className="admin-login__body">
        <form className="admin-login__form" onSubmit={submit}>
          <div className="admin-login__brand">
            <h1>붕붕 주문판</h1>
          </div>
          {configured ? (
            <>
              <label className="admin-login__label" htmlFor="admin-pin">관리자 PIN</label>
              <input
                id="admin-pin"
                className="admin-login__input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                placeholder="PIN 4~8자리를 입력해 주세요"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
              <p className="admin-login__hint">사장님 전용 PIN으로 로그인해 주세요. (MVP 데모용 임시 인증)</p>
              <button type="submit" className="btn btn--primary btn--block">로그인</button>
              {error && <p role="alert" className="error">{error}</p>}
            </>
          ) : (
            <p role="alert" className="error">VITE_ADMIN_PIN 환경변수를 설정해야 들어갈 수 있어요</p>
          )}
        </form>
      </div>
      <footer className="admin-login__footer">
        <span>호호붕어빵 · 붕봇 주문판</span>
        <Link to="/">손님 화면 보기</Link>
      </footer>
    </main>
  )
}
