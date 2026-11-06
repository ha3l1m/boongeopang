import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import * as auth from '../services/authService'

type AuthValue = {
  user: auth.User | null
  login: () => auth.User
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<auth.User | null>(() => auth.currentUser())

  const login = useCallback(() => {
    const next = auth.loginAsGuest()
    setUser(next)
    return next
  }, [])

  const logout = useCallback(() => {
    auth.logout()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
