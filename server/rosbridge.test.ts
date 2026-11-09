import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRosBridge, type SocketLike } from './rosbridge'

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = []
  sent: Record<string, unknown>[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  constructor(readonly url: string) {
    FakeSocket.all = [...FakeSocket.all, this]
  }
  send(data: string) {
    this.sent = [...this.sent, JSON.parse(data)]
  }
  close() {
    this.onclose?.()
  }
  open() {
    this.onopen?.()
  }
  receive(message: unknown) {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) })
  }
}

const latest = () => FakeSocket.all[FakeSocket.all.length - 1]
const make = () => createRosBridge({ url: 'ws://x', createSocket: (url) => new FakeSocket(url) })

beforeEach(() => {
  FakeSocket.all = []
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('rosbridge client', () => {
  it('rejects a service call while closed', async () => {
    const bridge = make()
    await expect(bridge.callService('/s', 'p/srv/S', {}, 100)).rejects.toThrow('rosbridge')
    bridge.close()
  })

  it('sends call_service and resolves with the matching response values', async () => {
    const bridge = make()
    latest().open()
    const call = bridge.callService('/boong/submit_order', 'p/srv/S', { qty: 1 }, 100)
    const sent = latest().sent[0]
    expect(sent).toMatchObject({ op: 'call_service', service: '/boong/submit_order', type: 'p/srv/S', args: { qty: 1 } })
    latest().receive({ op: 'service_response', id: 'other', values: {}, result: true })
    latest().receive({ op: 'service_response', id: sent.id, values: { accepted: true }, result: true })
    await expect(call).resolves.toEqual({ accepted: true })
    bridge.close()
  })

  it('rejects when the service reports failure, times out, or the socket drops', async () => {
    const bridge = make()
    latest().open()
    const failed = bridge.callService('/s', 'p/srv/S', {}, 100)
    latest().receive({ op: 'service_response', id: latest().sent[0].id, values: 'no service', result: false })
    await expect(failed).rejects.toThrow('no service')

    const timedOut = bridge.callService('/s', 'p/srv/S', {}, 100)
    const timedOutCheck = expect(timedOut).rejects.toThrow('시간')
    vi.advanceTimersByTime(101)
    await timedOutCheck

    const dropped = bridge.callService('/s', 'p/srv/S', {}, 100)
    latest().close()
    await expect(dropped).rejects.toThrow('rosbridge')
    bridge.close()
  })

  it('delivers topic messages, ignores bad frames, and resubscribes after reconnecting', () => {
    const bridge = make()
    const seen: unknown[] = []
    bridge.subscribe('/boong/orders', 'std_msgs/msg/String', (msg) => seen.push(msg))
    latest().open()
    expect(latest().sent[0]).toMatchObject({ op: 'subscribe', topic: '/boong/orders', type: 'std_msgs/msg/String' })
    latest().receive('not json')
    latest().receive({ op: 'publish', topic: '/other', msg: { data: 'x' } })
    latest().receive({ op: 'publish', topic: '/boong/orders', msg: { data: '[]' } })
    expect(seen).toEqual([{ data: '[]' }])

    latest().close()
    expect(bridge.isOpen()).toBe(false)
    expect(FakeSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.all).toHaveLength(2)
    latest().open()
    expect(bridge.isOpen()).toBe(true)
    expect(latest().sent[0]).toMatchObject({ op: 'subscribe', topic: '/boong/orders' })
    bridge.close()
  })

  it('reconnects once after a failed attempt that reports only an error, as Node WebSocket does', () => {
    const bridge = make()
    const first = latest()
    first.onerror?.()
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.all).toHaveLength(2)
    first.onclose?.() // a late close from the dead socket must not start a second retry or drop the new one
    latest().open()
    expect(bridge.isOpen()).toBe(true)
    vi.advanceTimersByTime(30_000)
    expect(FakeSocket.all).toHaveLength(2)
    bridge.close()
  })

  it('backs off between attempts up to the limit and stops after close', () => {
    const bridge = make()
    latest().close()
    vi.advanceTimersByTime(1000)
    latest().close()
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.all).toHaveLength(2)
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.all).toHaveLength(3)
    bridge.close()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(3)
  })
})
