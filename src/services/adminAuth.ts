const ADMIN_KEY = 'boong:admin'

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_KEY) === '1'
  } catch {
    return false
  }
}

export function isAdminLoggedIn(): boolean {
  return readFlag()
}

export function checkAdminPin(input: string, expected: string | undefined): boolean {
  if (!expected || input !== expected) return false
  try {
    sessionStorage.setItem(ADMIN_KEY, '1')
  } catch {
    throw new Error('로그인 정보를 저장할 수 없어요')
  }
  return true
}

export function adminLogout(): void {
  try {
    sessionStorage.removeItem(ADMIN_KEY)
  } catch {
    // storage unavailable; nothing to clear
  }
}

export function adminPinConfigured(): boolean {
  return Boolean(import.meta.env.VITE_ADMIN_PIN)
}
