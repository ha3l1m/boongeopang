import { readJson, removeKey, writeJson } from './storage'

export type User = { id: string; nickname: string }

const USER_KEY = 'boong:user'
const NICK_PREFIXES = ['단팥러버', '슈크림요정', '초코대장', '꼬리부터', '머리부터', '따끈따끈']

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as User).id === 'string' &&
    typeof (value as User).nickname === 'string'
  )
}

export function currentUser(): User | null {
  const value = readJson<unknown>(USER_KEY, null)
  return isUser(value) ? value : null
}

export function loginAsGuest(): User {
  const prefix = NICK_PREFIXES[Math.floor(Math.random() * NICK_PREFIXES.length)]
  const user: User = { id: crypto.randomUUID(), nickname: `${prefix} 손님` }
  writeJson(USER_KEY, user)
  return user
}

export function logout(): void {
  removeKey(USER_KEY)
}
