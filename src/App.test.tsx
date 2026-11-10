import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './state/AuthContext'
import { CartProvider } from './state/CartContext'
import { createOrder, getOrder, setOrderStatus } from './services/orderService'
import { listFeedback } from './services/feedbackService'
import { FEEDBACK_DELAY_MS } from './domain/feedback'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ordering flow', () => {
  it('redirects to the night-cart login when signed out', () => {
    renderApp('/orders')
    expect(screen.getByRole('heading', { name: '호호붕어빵' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '붕어빵 주문' })).toBeInTheDocument()
  })

  it('shows the stamping factory splash without design tabs', () => {
    const { container } = renderApp('/login')
    expect(container.querySelector('.factory image[href="/art/factory/plate.webp"]')).toBeInTheDocument()
    expect(container.querySelectorAll('.factory__fish')).toHaveLength(4)
    expect(screen.getByRole('img', { name: '호호붕어빵' }).getAttribute('src')).toContain('logo-hoho-factory')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '붕어빵 주문' })).toBeInTheDocument()
  })

  it('blocks empty bag with a hint', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: '붕어빵 주문' }))
    await user.click(screen.getByRole('button', { name: '봉투 담기' }))
    expect(screen.getByRole('status')).toHaveTextContent('한 마리 이상 골라줘요')
  })

  it('logs in, orders, and shows the order in history', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderApp('/login')

    await user.click(screen.getByRole('button', { name: '붕어빵 주문' }))
    await user.click(screen.getByRole('button', { name: '팥붕 더하기' }))
    await user.click(screen.getByRole('button', { name: '팥붕 더하기' }))
    await user.click(screen.getByRole('button', { name: '초코붕 더하기' }))
    expect(screen.getByText('3,200원')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '봉투 담기' }))
    expect(screen.getByRole('heading', { name: '주문 확인' })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('바삭하게 구워 주세요'), '바삭하게')
    await user.click(screen.getByRole('button', { name: '주문하기' }))
    await act(() => vi.advanceTimersByTimeAsync(1500))

    expect(screen.getByText('No.001')).toBeInTheDocument()
    expect(screen.getByText('요청: 바삭하게')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('주문 접수')

    await user.click(screen.getByRole('button', { name: '굽는 중 애니메이션 보기' }))
    expect(screen.getByText('노릇노릇 바삭하게 굽고 있습니다')).toBeInTheDocument()
    expect(screen.getByText('미리보기 · 굽는 중')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '실시간으로 돌아가기' }))
    expect(screen.queryByText('미리보기 · 굽는 중')).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(screen.getByText('따끈할 때 가져가세요!')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '홈으로' }))
    await user.click(screen.getByRole('link', { name: '주문내역' }))
    expect(screen.getByText('팥붕 2 · 초코붕 1')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('admin', () => {
  it('redirects to admin login without session', () => {
    renderApp('/admin')
    expect(screen.getByRole('heading', { name: '붕붕 주문판' })).toBeInTheDocument()
    expect(screen.queryByAltText('호호붕어빵')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '오늘 요약' })).not.toBeInTheDocument()
  })

  it('shows orders board and cancels an order', async () => {
    sessionStorage.setItem('boong:admin', '1')
    const order = createOrder('u1', { redbean: 2 }, '바삭하게', new Date())
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/admin')
    await user.click(screen.getByRole('tab', { name: /^처리 중/ }))
    await user.click(screen.getByRole('button', { name: 'No.001 주문 보기' }))
    const detail = screen.getByRole('complementary', { name: '주문 상세' })
    expect(detail).toHaveTextContent('요청: 바삭하게')
    expect(detail).toHaveTextContent('주문금액')
    await user.click(screen.getByRole('button', { name: '주문 취소' }))
    expect(getOrder('u1', order.id)?.manualStatus).toBe('cancelled')
    sessionStorage.removeItem('boong:admin')
  })
})

describe('robot control', () => {
  it('emergency stop and resume from admin board', async () => {
    sessionStorage.setItem('boong:admin', '1')
    createOrder('u1', { redbean: 1 }, '', new Date())
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/admin')
    expect(screen.queryByRole('region', { name: '붕봇 상태' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^처리 중/ }))
    await user.click(screen.getByRole('button', { name: '비상 정지' }))
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('비상 정지')
    await user.click(screen.getByRole('tab', { name: '오늘 현황' }))
    expect(screen.getByRole('region', { name: '붕봇 상태' })).toHaveTextContent('비상 정지')
    await user.click(screen.getByRole('button', { name: '재개' }))
    expect(screen.queryByRole('region', { name: '붕봇 상태' })).not.toBeInTheDocument()
    sessionStorage.removeItem('boong:admin')
  })

  it('raises a demo alert and resolves it by retrying', async () => {
    sessionStorage.setItem('boong:admin', '1')
    const order = createOrder('u1', { cream: 1 }, '', new Date())
    const user = userEvent.setup()
    renderApp('/admin')
    await user.click(screen.getByRole('button', { name: '발생' }))
    expect(screen.getByRole('alert')).toHaveTextContent('붕어빵이 너무 탔어요')
    expect(screen.getByRole('option', { name: /반죽이 너무 많이 부어졌어요/ })).toBeDisabled()
    expect(screen.getByRole('option', { name: /속이 안 들어갔어요/ })).toBeDisabled()
    expect(screen.getByRole('option', { name: '그리퍼가 붕어빵을 놓쳤어요' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '다시 굽기' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getOrder('u1', order.id)?.timerStart).toBeDefined()
    sessionStorage.removeItem('boong:admin')
  })

  it('shows sold out flavor on the menu', () => {
    for (let i = 0; i < 4; i++) createOrder('u1', { choco: 10 }, '', new Date())
    localStorage.setItem('boong:user', JSON.stringify({ id: 'u1', nickname: '테스트 손님' }))
    renderApp('/')
    expect(screen.getByText('품절')).toBeInTheDocument()
  })
})

describe('admin tabs', () => {
  it('opens on today tab (summary + robot control) first, switches to orders, keeps estop visible', async () => {
    sessionStorage.setItem('boong:admin', '1')
    createOrder('u1', { redbean: 3 }, '', new Date())
    const user = userEvent.setup()
    renderApp('/admin')
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['오늘 현황', '처리 중1', '완료'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByAltText('호호붕어빵')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '오늘 요약' })).toHaveTextContent('3마리')
    expect(screen.getByRole('region', { name: '재료 잔량' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '이상 발생 데모' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^처리 중/ }))
    expect(screen.queryByRole('region', { name: '오늘 요약' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '재료 잔량' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '비상 정지' })).toBeInTheDocument()
    sessionStorage.removeItem('boong:admin')
  })
})

describe('admin order card actions', () => {
  it('keeps cancel in the detail pane and pickup on ready cards', async () => {
    sessionStorage.setItem('boong:admin', '1')
    const baking = createOrder('u1', { redbean: 1 }, '', new Date())
    const ready = createOrder('u1', { cream: 1 }, '', new Date())
    setOrderStatus(ready.id, 'ready')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderApp('/admin')
    await user.click(screen.getByRole('tab', { name: /^처리 중/ }))
    expect(screen.queryByRole('button', { name: /^다음/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /취소/ })).not.toBeInTheDocument()
    expect(screen.getByText('픽업까지')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^픽업 대기/ }))
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('admin-order'))).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '픽업 완료' }))
    expect(getOrder('u1', ready.id)?.manualStatus).toBe('picked_up')
    expect(getOrder('u1', baking.id)?.manualStatus).toBeUndefined()
    await user.click(screen.getByRole('tab', { name: '완료' }))
    expect(screen.getByRole('button', { name: /^픽업 완료 1/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^No\.\d+ 주문 보기$/ }))
    expect(screen.getByRole('complementary', { name: '주문 상세' })).toHaveTextContent('주문금액')
    expect(screen.queryByRole('list', { name: '진행 단계' })).not.toBeInTheDocument()
    sessionStorage.removeItem('boong:admin')
  })
})

describe('pickup feedback', () => {
  const signIn = () => localStorage.setItem('boong:user', JSON.stringify({ id: 'u1', nickname: '테스트 손님' }))

  it('does not ask before pickup', () => {
    signIn()
    const order = createOrder('u1', { redbean: 1 }, '', new Date())
    setOrderStatus(order.id, 'ready')
    renderApp(`/orders/${order.id}`)
    expect(screen.queryByRole('dialog', { name: '붕어빵 어땠어요?' })).not.toBeInTheDocument()
  })

  const seenAgo = (orderId: string, ms: number) =>
    localStorage.setItem('boong:pickup-seen', JSON.stringify({ [orderId]: new Date(Date.now() - ms).toISOString() }))

  it('waits right after pickup but lets the customer rate now', async () => {
    signIn()
    const order = createOrder('u1', { cream: 2 }, '', new Date())
    setOrderStatus(order.id, 'picked_up')
    const user = userEvent.setup()
    renderApp(`/orders/${order.id}`)
    expect(screen.queryByRole('dialog', { name: '붕어빵 어땠어요?' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '맛 평가하기' }))
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: '탔어요' }))
    await user.click(screen.getByRole('radiogroup', { name: '커스터드 양' }).querySelector('input[value="-1"]') as HTMLElement)
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(screen.queryByRole('dialog', { name: '붕어빵 어땠어요?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '맛 평가하기' })).not.toBeInTheDocument()
    expect(listFeedback()[0]).toMatchObject({ orderId: order.id, flavors: ['cream'], scores: { doneness: 2 }, fillingByFlavor: { cream: -1 } })
    expect(screen.getByRole('status')).toHaveTextContent('고마워요')
  })

  it('asks filling amount per flavor for a mixed order', async () => {
    signIn()
    const order = createOrder('u1', { redbean: 1, choco: 1 }, '', new Date())
    setOrderStatus(order.id, 'picked_up')
    const user = userEvent.setup()
    renderApp(`/orders/${order.id}`)
    await user.click(screen.getByRole('button', { name: '맛 평가하기' }))
    expect(screen.getByRole('radiogroup', { name: '팥앙금 양' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: '초코크림 양' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: '커스터드 양' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radiogroup', { name: '팥앙금 양' }).querySelector('input[value="2"]') as HTMLElement)
    await user.click(screen.getByRole('radiogroup', { name: '초코크림 양' }).querySelector('input[value="0"]') as HTMLElement)
    await user.click(screen.getByRole('button', { name: '보내기' }))
    expect(listFeedback()[0].fillingByFlavor).toEqual({ redbean: 2, choco: 0 })
  })

  it('opens the sheet by itself once the customer had time to eat', () => {
    signIn()
    const order = createOrder('u1', { redbean: 1 }, '', new Date())
    setOrderStatus(order.id, 'picked_up')
    seenAgo(order.id, FEEDBACK_DELAY_MS)
    renderApp(`/orders/${order.id}`)
    expect(screen.getByRole('dialog', { name: '붕어빵 어땠어요?' })).toBeInTheDocument()
  })

  it('stops popping up after 나중에 but can still be rated from history', async () => {
    signIn()
    const order = createOrder('u1', { redbean: 1 }, '', new Date())
    setOrderStatus(order.id, 'picked_up')
    seenAgo(order.id, FEEDBACK_DELAY_MS)
    const user = userEvent.setup()
    const { unmount } = renderApp(`/orders/${order.id}`)
    await user.click(screen.getByRole('button', { name: '나중에' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    renderApp('/orders')
    await user.click(screen.getByRole('link', { name: '맛 평가 남기기' }))
    expect(screen.getByRole('dialog', { name: '붕어빵 어땠어요?' })).toBeInTheDocument()
  })
})
