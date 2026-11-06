import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

export function useToast(durationMs = 1800): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback(
    (next: string) => {
      clearTimeout(timer.current)
      setMessage(next)
      timer.current = setTimeout(() => setMessage(null), durationMs)
    },
    [durationMs],
  )
  useEffect(() => () => clearTimeout(timer.current), [])
  return [message, show]
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Home goes to the splash, which only shows when signed out, so it signs out first. */
export function useGoHome(): () => void {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(() => {
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])
}
