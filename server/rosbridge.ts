/** Minimal rosbridge v2 client: service calls and topic subscriptions, reconnecting with backoff. */
export type SocketLike = {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
}

type Pending = { resolve: (values: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
type Subscription = { topic: string; type: string; onMessage: (msg: unknown) => void }
type Frame = { op?: string; id?: string; topic?: string; msg?: unknown; values?: unknown; result?: boolean }

const BACKOFF_FIRST_MS = 1000
const BACKOFF_MAX_MS = 10_000

export function createRosBridge({ url, createSocket }: { url: string; createSocket: (url: string) => SocketLike }) {
  const pending = new Map<string, Pending>()
  let subscriptions: readonly Subscription[] = []
  let socket: SocketLike | null = null
  let open = false
  let stopped = false
  let nextId = 0
  let backoff = BACKOFF_FIRST_MS
  let retry: ReturnType<typeof setTimeout> | undefined

  const sendSubscribe = (sub: Subscription) => socket?.send(JSON.stringify({ op: 'subscribe', topic: sub.topic, type: sub.type }))

  const settle = (id: string, finish: (p: Pending) => void) => {
    const call = pending.get(id)
    if (!call) return
    clearTimeout(call.timer)
    pending.delete(id)
    finish(call)
  }

  const onFrame = (raw: unknown) => {
    let frame: Frame
    try {
      frame = JSON.parse(String(raw)) as Frame
    } catch {
      return
    }
    if (frame.op === 'publish') {
      subscriptions.filter((s) => s.topic === frame.topic).forEach((s) => s.onMessage(frame.msg))
    } else if (frame.op === 'service_response' && frame.id) {
      settle(frame.id, (call) =>
        frame.result === false ? call.reject(new Error(String(frame.values))) : call.resolve(frame.values))
    }
  }

  const scheduleReconnect = () => {
    if (stopped) return
    retry = setTimeout(connect, backoff)
    backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
  }

  const onClosed = () => {
    open = false
    socket = null
    ;[...pending.keys()].forEach((id) => settle(id, (call) => call.reject(new Error('rosbridge 연결이 끊겼어요'))))
    scheduleReconnect()
  }

  function connect() {
    try {
      const next = createSocket(url)
      socket = next
      next.onopen = () => {
        open = true
        backoff = BACKOFF_FIRST_MS
        subscriptions.forEach(sendSubscribe)
      }
      next.onmessage = (event) => onFrame(event.data)
      // Node's WebSocket may report a failed attempt with an error and no close, or with both.
      let down = false
      const onDown = () => {
        if (down) return
        down = true
        onClosed()
      }
      next.onclose = onDown
      next.onerror = onDown
    } catch {
      scheduleReconnect()
    }
  }

  connect()

  return {
    isOpen: () => open,
    subscribe(topic: string, type: string, onMessage: (msg: unknown) => void) {
      const sub = { topic, type, onMessage }
      subscriptions = [...subscriptions, sub]
      if (open) sendSubscribe(sub)
    },
    callService(service: string, type: string, args: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
      const active = socket
      if (!open || !active) return Promise.reject(new Error('rosbridge에 연결되지 않았어요'))
      nextId += 1
      const id = `call:${nextId}`
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => settle(id, (call) => call.reject(new Error('응답 시간이 지났어요'))), timeoutMs)
        pending.set(id, { resolve, reject, timer })
        active.send(JSON.stringify({ op: 'call_service', id, service, type, args }))
      })
    },
    close() {
      stopped = true
      clearTimeout(retry)
      socket?.close()
    },
  }
}
