/** crypto.randomUUID only exists on https and localhost; a phone on http://<LAN-IP> has just getRandomValues. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16)).map((byte, i) => {
    if (i === 6) return (byte & 0x0f) | 0x40
    return i === 8 ? (byte & 0x3f) | 0x80 : byte
  })
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
