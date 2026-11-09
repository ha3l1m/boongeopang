import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { App } from '../App'
import { AuthProvider } from '../state/AuthContext'
import { CartProvider } from '../state/CartContext'

type Handler<T> = ((event: T) => void) | null

class FakeRecognition {
  static last: FakeRecognition | null = null
  static starts = 0
  lang = ''
  interimResults = false
  continuous = false
  maxAlternatives = 1
  onresult: Handler<{ results: { 0: { transcript: string; confidence: number }; isFinal: boolean; length: 1 }[] }> = null
  onerror: Handler<{ error: string }> = null
  onend: Handler<undefined> = null
  onaudiostart: Handler<undefined> = null
  onsoundstart: Handler<undefined> = null
  onspeechstart: Handler<undefined> = null
  onspeechend: Handler<undefined> = null
  constructor() {
    FakeRecognition.last = this
  }
  start() {
    FakeRecognition.starts += 1
  }
  stop() {
    this.onend?.(undefined)
  }
  abort() {
    this.onend?.(undefined)
  }
  say(transcript: string, isFinal = true, confidence = 0.92) {
    this.onresult?.({ results: [{ 0: { transcript, confidence }, isFinal, length: 1 }] })
  }
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderApp(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CartProvider>
          <App />
          <Where />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const signedIn = () => localStorage.setItem('boong:user', JSON.stringify({ id: 'u1', nickname: '손님' }))

beforeEach(() => {
  FakeRecognition.last = null
  FakeRecognition.starts = 0
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
})
afterEach(() => vi.unstubAllGlobals())

describe('voice order', () => {
  it('has a voice order button next to the touch order button on the splash', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    expect(screen.getByRole('button', { name: '붕어빵 주문' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '음성 주문' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/voice')
    expect(screen.getByRole('heading', { name: '음성 주문' })).toBeInTheDocument()
  })

  it('listens in Korean, shows what it heard, and carries the cart to the confirm page', async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    expect(FakeRecognition.last?.lang).toBe('ko-KR')
    expect(FakeRecognition.last?.interimResults).toBe(true)
    expect(screen.getByRole('button', { name: /듣는 중/ })).toHaveAttribute('aria-pressed', 'true')

    act(() => FakeRecognition.last?.say('팥붕 두 개 슈붕 하나'))
    expect(screen.getByText('팥붕 두 개 슈붕 하나')).toBeInTheDocument()
    expect(screen.getByLabelText('팥붕 2개')).toBeInTheDocument()
    expect(screen.getByLabelText('슈붕 1개')).toBeInTheDocument()
    expect(screen.getByText('3,000원')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이대로 주문 확인' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/confirm')
    expect(screen.getByText(/팥붕 × 2/)).toBeInTheDocument()
  })

  it('does not order by itself: nothing is sent until the confirm page is pressed', async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    act(() => FakeRecognition.last?.say('팥붕 하나'))
    expect(localStorage.getItem('boong:orders')).toBeNull()
  })

  it('shows the options only after something was said, right under the heard order', async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    expect(screen.queryByLabelText('팥붕 0개')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    act(() => FakeRecognition.last?.say('슈붕 하나'))
    expect(screen.getByLabelText('팥붕 0개')).toBeInTheDocument()
    expect(screen.getByLabelText('슈붕 1개')).toBeInTheDocument()
    expect(screen.getByLabelText('초코붕 0개')).toBeInTheDocument()
  })

  it('adjusts the order with the options on the same page, with one touch button and no fix-on-menu button', async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    act(() => FakeRecognition.last?.say('슈붕 세 개'))
    expect(screen.queryByRole('button', { name: '메뉴에서 고치기' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '터치로 주문하기' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '슈붕 빼기' }))
    await user.click(screen.getByRole('button', { name: '팥붕 더하기' }))
    expect(screen.getByLabelText('슈붕 2개')).toBeInTheDocument()
    expect(screen.getByLabelText('팥붕 1개')).toBeInTheDocument()
    expect(screen.getByText('3,000원')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이대로 주문 확인' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/confirm')
    expect(screen.getByText(/슈붕 × 2/)).toBeInTheDocument()
    expect(screen.getByText(/팥붕 × 1/)).toBeInTheDocument()
  })

  it('touch ordering keeps what was already picked', async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    act(() => FakeRecognition.last?.say('슈붕 세 개'))
    await user.click(screen.getByRole('button', { name: '터치로 주문하기' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/')
    expect(screen.getByRole('heading', { name: '오늘의 붕어빵' })).toBeInTheDocument()
    expect(screen.getByLabelText('슈붕 3개')).toBeInTheDocument()
  })

  it('keeps choco out and says it is not ready; the confirm button stays off with an empty cart', async () => {
    vi.stubEnv('VITE_ROBOT_MODE', 'ros')
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))))
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    act(() => FakeRecognition.last?.say('초코붕 두 개'))
    expect(screen.getByText(/초코붕은 아직 준비 중/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이대로 주문 확인' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '초코붕 더하기' }))
    expect(screen.getByText('초코붕은 아직 준비 중이에요')).toBeInTheDocument()
    expect(screen.getByLabelText('초코붕 0개')).toBeInTheDocument()
    vi.unstubAllEnvs()
  })

  it('says so when the words are not on the menu, and when nothing was heard', async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    act(() => FakeRecognition.last?.say('안녕하세요'))
    act(() => FakeRecognition.last?.stop()) // a real recogniser ends by itself after a final result
    expect(screen.getByText(/메뉴를 못 알아들었어요/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /다시 말하기/ }))
    act(() => FakeRecognition.last?.stop())
    expect(await screen.findByText('말씀이 들리지 않았어요')).toBeInTheDocument()
  })

  it('explains a denied microphone and offers touch ordering', async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    act(() => FakeRecognition.last?.onerror?.({ error: 'not-allowed' }))
    expect(screen.getByRole('alert')).toHaveTextContent('마이크')
    await user.click(screen.getByRole('button', { name: '터치로 주문하기' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/')
    expect(screen.getByRole('heading', { name: '오늘의 붕어빵' })).toBeInTheDocument()
  })

  it('falls back to touch ordering when the browser cannot recognise speech', async () => {
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    signedIn()
    renderApp('/voice')
    expect(screen.getByRole('alert')).toHaveTextContent('지원하지 않아요')
    expect(screen.queryByRole('button', { name: '눌러서 말하기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '터치로 주문하기' })).toBeInTheDocument()
  })

  it('refuses on an insecure address, where the microphone is blocked, like a phone over the LAN', () => {
    vi.stubGlobal('isSecureContext', false)
    signedIn()
    renderApp('/voice')
    expect(screen.getByRole('alert')).toHaveTextContent('https')
    expect(screen.queryByRole('button', { name: '눌러서 말하기' })).not.toBeInTheDocument()
  })

  it('stops listening when the page is left', async () => {
    signedIn()
    const user = userEvent.setup()
    const { unmount } = renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    const abort = vi.spyOn(FakeRecognition.last as FakeRecognition, 'abort')
    unmount()
    expect(abort).toHaveBeenCalled()
  })
})

describe('recognition log', () => {
  const open = async () => {
    signedIn()
    const user = userEvent.setup()
    renderApp('/voice')
    await user.click(screen.getByRole('button', { name: '눌러서 말하기' }))
    return user
  }
  const log = () => screen.getByRole('region', { name: '인식 로그' })

  it('is open by default and says so before anything was heard', () => {
    signedIn()
    renderApp('/voice')
    expect(log()).toHaveTextContent('아직 기록이 없어요')
  })

  it('shows the microphone events, interim and final transcripts with confidence, and how the words were read', async () => {
    await open()
    act(() => FakeRecognition.last?.onsoundstart?.(undefined))
    act(() => FakeRecognition.last?.onspeechstart?.(undefined))
    act(() => FakeRecognition.last?.say('팥붕 두', false, 0))
    act(() => FakeRecognition.last?.say('팥붕 두 개 주세요', true, 0.92))
    expect(log()).toHaveTextContent('듣기 시작')
    expect(log()).toHaveTextContent('소리 감지')
    expect(log()).toHaveTextContent('말소리 감지')
    expect(log()).toHaveTextContent('중간 “팥붕 두”')
    expect(log()).toHaveTextContent('확정 “팥붕 두 개 주세요” 92%')
    expect(log()).toHaveTextContent('해석 “팥붕”→팥붕 · “두”→2 · 무시: 주세요')
  })

  it('says when no menu or count was read from what was heard', async () => {
    await open()
    act(() => FakeRecognition.last?.say('안녕하세요'))
    expect(log()).toHaveTextContent('해석 읽은 메뉴·수량 없음 · 무시: 안녕하세요')
  })

  it('logs the raw error code and the end, even for the silent no-speech case', async () => {
    await open()
    act(() => FakeRecognition.last?.onerror?.({ error: 'no-speech' }))
    act(() => FakeRecognition.last?.stop())
    expect(log()).toHaveTextContent('오류 no-speech')
    expect(log()).toHaveTextContent('듣기 끝')
  })

  it('can be hidden, and the choice is remembered', async () => {
    const user = await open()
    expect(screen.getByRole('button', { name: '인식 로그 숨기기' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: '인식 로그 숨기기' }))
    expect(screen.queryByRole('region', { name: '인식 로그' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '인식 로그 보기' })).toHaveAttribute('aria-expanded', 'false')
    cleanup()
    renderApp('/voice')
    expect(screen.queryByRole('region', { name: '인식 로그' })).not.toBeInTheDocument()
  })

  it('can be cleared and copied', async () => {
    const user = await open()
    act(() => FakeRecognition.last?.say('슈붕 하나'))
    await user.click(screen.getByRole('button', { name: '로그 복사' }))
    const copied = await navigator.clipboard.readText()
    expect(copied).toContain('확정 “슈붕 하나” 92%')
    expect(copied.indexOf('확정')).toBeLessThan(copied.indexOf('해석')) // heard first, then how it was read
    expect(screen.getByText('로그를 복사했어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '로그 지우기' }))
    expect(log()).toHaveTextContent('아직 기록이 없어요')
  })
})
