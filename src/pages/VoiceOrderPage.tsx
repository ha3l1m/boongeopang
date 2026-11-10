import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { MENU, menuItem, formatWon, type Flavor } from '../domain/menu'
import { cartCount, cartTotal } from '../domain/order'
import { parseFirstMatch } from '../domain/voiceOrder'
import { useCart } from '../state/CartContext'

/** Minimal shape of the browser's speech recognizer (Web Speech API), which TypeScript's DOM lib does not ship. */
type RecognitionResult = { transcript: string }
type RecognitionResultList = ArrayLike<RecognitionResult> & { isFinal: boolean }
type RecognitionEvent = { results: ArrayLike<RecognitionResultList> }
type RecognitionError = { error: string }
type Recognizer = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: RecognitionError) => void) | null
  start: () => void
  stop: () => void
}
type RecognizerCtor = new () => Recognizer

function recognizerCtor(): RecognizerCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** What to tell the customer when the browser's recognizer gives up. */
const ERROR_TEXT: Record<string, string> = {
  'not-allowed': '마이크 권한이 꺼져 있어요. 주소창 옆에서 마이크를 허용해 주세요',
  'service-not-allowed': '마이크 권한이 꺼져 있어요. 주소창 옆에서 마이크를 허용해 주세요',
  'audio-capture': '마이크를 찾지 못했어요. 연결을 확인해 주세요',
  'no-speech': '말소리가 안 들렸어요. 다시 눌러서 말해 주세요',
  network: '음성 인식 서버에 연결하지 못했어요. 인터넷을 확인해 주세요',
  'language-not-supported': '한국어 음성 인식을 쓸 수 없는 브라우저예요. Chrome에서 열어 주세요',
}

function describe(parsed: Partial<Record<Flavor, number>>): string {
  return (Object.entries(parsed) as [Flavor, number][]).map(([flavor, qty]) => `${menuItem(flavor).name} ${qty}개`).join(', ')
}

/** Voice order: say the order, it lands in the cart, then either keep tapping or confirm. */
export function VoiceOrderPage() {
  const navigate = useNavigate()
  const { cart, add } = useCart()
  const Ctor = recognizerCtor()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [showLog, setShowLog] = useState(true)
  const recognizer = useRef<Recognizer | null>(null)
  const wantListening = useRef(false)
  const [typed, setTyped] = useState('')
  const count = cartCount(cart)

  useEffect(() => () => {
    wantListening.current = false
    recognizer.current?.stop()
  }, [])

  /** Takes the recognizer's alternatives for one final result, and adds the first one that names a flavor. */
  const heard = (alternatives: string[]) => {
    const match = parseFirstMatch(alternatives)
    if (!match) {
      setLog((lines) => [...lines, `${alternatives[0]} → 붕어빵 이름을 못 찾았어요`])
      return
    }
    const entries = Object.entries(match.order) as [Flavor, number][]
    setLog((lines) => [...lines, `${match.text} → 담음: ${describe(match.order)}`])
    for (const [flavor, qty] of entries) for (let i = 0; i < qty; i++) add(flavor)
  }

  /** Starts one recognition session. Chrome ends a session after a pause, so onend restarts it while the customer still wants to talk. */
  const startSession = () => {
    if (!Ctor) return
    const r = new Ctor()
    r.lang = 'ko-KR'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 3
    r.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      if (!last.isFinal) {
        setInterim(last[0].transcript)
        return
      }
      setInterim('')
      heard(Array.from({ length: last.length }, (_, i) => last[i].transcript))
    }
    r.onend = () => {
      setInterim('')
      if (!wantListening.current) {
        setListening(false)
        return
      }
      window.setTimeout(() => {
        if (wantListening.current) startSession()
      }, 150)
    }
    r.onerror = (event) => {
      // Silence and aborted sessions are normal; onend restarts them.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      wantListening.current = false
      setListening(false)
      setInterim('')
      setLog((lines) => [...lines, ERROR_TEXT[event.error] ?? `음성 인식 오류(${event.error}), 다시 눌러 주세요`])
    }
    recognizer.current = r
    try {
      r.start()
    } catch {
      wantListening.current = false
      setListening(false)
      setLog((lines) => [...lines, '음성 인식을 시작하지 못했어요. 다시 눌러 주세요'])
    }
  }

  const toggle = () => {
    if (wantListening.current) {
      wantListening.current = false
      recognizer.current?.stop()
      setListening(false)
      return
    }
    wantListening.current = true
    setListening(true)
    startSession()
  }

  /** Typed fallback: the same parser as speech, for when the mic is unavailable or noisy. */
  const submitTyped = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = typed.trim()
    if (!text) return
    heard([text])
    setTyped('')
  }

  const copyLog = () => {
    navigator.clipboard?.writeText(log.join('\n')).catch(() => undefined)
  }

  return (
    <main className="page voice">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={() => navigate(-1)}>
          <Icon name="back" size={22} />
        </button>
        <h1 className="topbar__title">음성 주문</h1>
      </header>

      <div className="voice__mic">
        <button
          type="button"
          className={`voice__button ${listening ? 'voice__button--on' : ''}`}
          aria-label={listening ? '듣는 중, 눌러서 멈추기' : '마이크 켜기'}
          onClick={toggle}
          disabled={!Ctor}
        >
          <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21 M9 21h6" />
          </svg>
        </button>
        <p className="voice__hint">
          {!Ctor && '이 브라우저는 음성 인식을 지원하지 않아요. Chrome에서 열어 주세요'}
          {Ctor && listening && (interim ? `듣는 중: ${interim}` : '듣는 중이에요. 말해 보세요')}
          {Ctor && !listening && '눌러서 말해 보세요. 예: "팥붕 두 개, 슈붕 하나"'}
        </p>
      </div>

      <form className="voice__typed" onSubmit={submitTyped}>
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder='직접 입력: "팥붕 두 개, 슈붕 하나"'
          aria-label="직접 주문 입력"
        />
        <button type="submit" className="btn btn--ghost" disabled={!typed.trim()}>담기</button>
      </form>

      <div className="voice__tools">
        <button type="button" className="voice__chip" onClick={() => setShowLog((v) => !v)}>
          인식 로그 {showLog ? '숨기기' : '보이기'}
        </button>
        <button type="button" className="voice__chip" onClick={copyLog}>로그 복사</button>
        <button type="button" className="voice__chip" onClick={() => setLog([])}>로그 지우기</button>
      </div>

      {showLog && (
        <ul className="voice__log" aria-label="인식 로그">
          {log.length === 0 ? <li className="voice__empty">아직 기록이 없어요. 마이크를 눌러 말해 보세요</li> : log.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}

      <section className="voice__cart" aria-label="담은 붕어빵">
        <p className="voice__count">담은 붕어빵 {count}개{count > 0 && ` · ${formatWon(cartTotal(cart))}`}</p>
        {count === 0 ? (
          <p className="voice__empty">아직 담은 게 없어요</p>
        ) : (
          <ul className="voice__items">
            {MENU.filter((item) => (cart[item.flavor] ?? 0) > 0).map((item) => (
              <li key={item.flavor}>
                <i className="dot" style={{ background: item.color }} aria-hidden="true" />
                {item.name} × {cart[item.flavor]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="voice__actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>터치로 주문하기</button>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/confirm')} disabled={count === 0}>
          이대로 주문 확인
        </button>
      </div>
    </main>
  )
}
