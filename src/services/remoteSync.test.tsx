import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { AuthProvider } from '../state/AuthContext'
import { CartProvider } from '../state/CartContext'
import { newId } from './id'
import { listAllOrders, placeOrder, setOrderStatus } from './orderService'
import { listFeedback } from './feedbackService'
import { emergencyStop, readRobot } from './robotService'
import { startSync } from './remoteSync'
import { checkAdminPin } from './adminAuth'
import type { Order } from '../domain/order'

const remoteOrder: Order = {
  id: 'r1', number: 7, userId: 'u1', memo: '', total: 1000, createdAt: '2026-11-09T00:00:00.000Z',
  items: [{ flavor: 'cream', qty: 1, unitPrice: 1000 }],
  robot: { sends: { cream: 'failed' }, steps: {} },
}
const stateBody = { orders: [remoteOrder], feedback: [], robot: { estop: false, pauses: [], refilledAt: {} }, robotReady: true }

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

describe('remote mode', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('VITE_ROBOT_MODE', 'ros')
    fetchMock = vi.fn(() => respond(stateBody))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('copies the server state into the local read cache', async () => {
    const stop = startSync(10_000)
    await vi.waitFor(() => expect(listAllOrders().map((o) => o.number)).toEqual([7]))
    expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.anything())
    expect(listFeedback()).toEqual([])
    expect(readRobot().estop).toBe(false)
    stop()
  })

  it('places an order through the server and caches it for the status page', async () => {
    fetchMock.mockImplementation(() => respond(remoteOrder, 201))
    const order = await placeOrder('u1', { cream: 1 }, 'memo')
    expect(order.number).toBe(7)
    expect(listAllOrders().map((o) => o.id)).toEqual(['r1'])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/orders')
    expect(JSON.parse(init.body)).toEqual({ userId: 'u1', cart: { cream: 1 }, memo: 'memo' })
  })

  it('surfaces the server refusal without saving anything', async () => {
    fetchMock.mockImplementation(() => respond({ error: '붕봇 연결 중이에요' }, 503))
    await expect(placeOrder('u1', { cream: 1 }, '')).rejects.toThrow('붕봇 연결 중이에요')
    expect(listAllOrders()).toEqual([])
  })

  it('reports an unreachable server as a connection problem', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('fetch failed')))
    await expect(placeOrder('u1', { cream: 1 }, '')).rejects.toThrow(/^붕봇/)
  })

  it('sends status and robot changes to the server', async () => {
    localStorage.setItem('boong:orders', JSON.stringify([remoteOrder]))
    setOrderStatus('r1', 'cancelled')
    emergencyStop()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/orders/r1')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ manualStatus: 'cancelled' })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/robot')
  })

  it('does not let a poll overwrite a change still being sent', async () => {
    localStorage.setItem('boong:orders', JSON.stringify([remoteOrder]))
    let finishPatch = () => {}
    fetchMock.mockImplementation((url: string) =>
      url === '/api/state' ? respond(stateBody) : new Promise((resolve) => { finishPatch = () => resolve(new Response('{}')) }))
    setOrderStatus('r1', 'cancelled')
    const stop = startSync(10_000)
    await new Promise((r) => setTimeout(r, 20))
    expect(listAllOrders()[0].manualStatus).toBe('cancelled')
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/state')).toBe(false)
    finishPatch()
    stop()
  })

  it('shows choco as not yet available, refuses it, and warns when the robot link is down', async () => {
    fetchMock.mockImplementation(() => respond({ ...stateBody, orders: [], robotReady: false }))
    localStorage.setItem('boong:user', JSON.stringify({ id: 'u1', nickname: '손님' }))
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /팥붕/ })).not.toHaveTextContent('준비 중')
    expect(screen.getByRole('heading', { name: /초코붕/ })).not.toHaveTextContent('준비 중')
    expect(screen.getByText('초코붕 붕어빵').closest('figure')).toHaveTextContent('준비 중')
    expect(screen.getByText('팥붕 붕어빵').closest('figure')).not.toHaveTextContent('준비 중')
    await user.click(screen.getByRole('button', { name: '초코붕 더하기' }))
    expect(screen.getByText('초코붕은 아직 준비 중이에요')).toBeInTheDocument()
    expect(screen.getByLabelText('초코붕 0개')).toBeInTheDocument()
    expect(await screen.findByText('붕봇 연결 중…')).toBeInTheDocument()
  })

  it('replaces the fake emergency stop and offers resend for failed flavors', async () => {
    vi.stubEnv('VITE_ADMIN_PIN', '1234')
    localStorage.setItem('boong:orders', JSON.stringify([remoteOrder]))
    checkAdminPin('1234', '1234')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/admin']}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>)
    await user.click(screen.getByRole('tab', { name: /처리 중/ }))
    expect(screen.queryByRole('button', { name: '비상 정지' })).not.toBeInTheDocument()
    expect(screen.getByText(/티치펜던트/)).toBeInTheDocument()
    expect(screen.getByText(/슈붕 1 전달 실패/)).toBeInTheDocument()
    await act(async () => { await user.click(screen.getByRole('button', { name: '다시 보내기' })) })
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/orders/r1/resend')).toBe(true)
    sessionStorage.clear()
  })
})

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('works on plain http where crypto.randomUUID is missing, as on a phone over the LAN', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(171) })
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
