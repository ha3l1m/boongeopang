import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MAX_PER_FLAVOR, MAX_TOTAL, MENU, formatWon, menuItem, type Flavor } from '../domain/menu'
import { canAdd, cartCount, cartTotal } from '../domain/order'
import { explainVoiceOrder, parseVoiceOrder, type VoiceResult } from '../domain/voice'
import { canOrderFlavor } from '../services/remoteSync'
import { createListener, voiceBlocker, type Listener, type LogEntry } from '../services/speech'
import { readJson, writeJson } from '../services/storage'
import { useAuth } from '../state/AuthContext'
import { useCart } from '../state/CartContext'
import { Icon } from '../components/Icon'
import { QtyStepper } from '../components/QtyStepper'
import { useToast } from '../components/hooks'

const EXAMPLE = '팥붕 두 개, 슈붕 하나'
const NOT_HEARD = '말씀이 들리지 않았어요'
const LOG_KEY = 'boong:voice-log'
const LOG_MAX = 80

const formatLine = (e: LogEntry) => `${(e.at / 1000).toFixed(1)}s ${e.label} ${e.text}`.trimEnd()

/** The line that shows how the heard words were read: what became a menu or count, and what was left unused. */
function readingOf(text: string, at: number): LogEntry {
  const { matched, ignored } = explainVoiceOrder(text)
  const read = matched.length > 0 ? matched.map((m) => `“${m.text}”→${m.meaning}`).join(' · ') : '읽은 메뉴·수량 없음'
  return { at, label: '해석', text: ignored.length > 0 ? `${read} · 무시: ${ignored.join(', ')}` : read, tone: 'info' }
}

function warnings(result: VoiceResult, heard: string): string[] {
  const lines: string[] = []
  if (result.unavailable.length > 0) lines.push(`${result.unavailable.map((f) => menuItem(f).name).join(', ')}은 아직 준비 중이라 담지 못했어요`)
  if (result.clipped) lines.push(`한 맛은 ${MAX_PER_FLAVOR}마리, 한 번에 ${MAX_TOTAL}마리까지만 담았어요`)
  if (heard && Object.keys(result.cart).length === 0 && result.unavailable.length === 0) {
    lines.push(`메뉴를 못 알아들었어요. 예: “${EXAMPLE}”`)
  }
  return lines
}

export function VoicePage() {
  const { user } = useAuth()
  const { cart, add, remove, fill } = useCart()
  const navigate = useNavigate()
  const [toast, showToast] = useToast()
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [result, setResult] = useState<VoiceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(() => readJson<boolean>(LOG_KEY, true))
  const listener = useRef<Listener | null>(null)
  const logEnd = useRef<HTMLOListElement | null>(null)
  const heardRef = useRef('')
  const failed = useRef(false)
  const blocker = voiceBlocker()

  useEffect(() => () => listener.current?.abort(), [])
  useEffect(() => {
    const el = logEnd.current?.parentElement
    if (el) el.scrollTop = el.scrollHeight
  }, [log, logOpen])

  if (!user) return <Navigate to="/login" replace />

  const toMenu = () => navigate('/')

  const pushLog = (entry: LogEntry) => setLog((rows) => [...rows, entry].slice(-LOG_MAX))

  const toggleLog = () => {
    const next = !logOpen
    setLogOpen(next)
    try {
      writeJson(LOG_KEY, next)
    } catch {
      // the choice just is not remembered
    }
  }

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(log.map(formatLine).join('\n'))
      showToast('로그를 복사했어요')
    } catch {
      showToast('복사하지 못했어요')
    }
  }

  const start = () => {
    heardRef.current = ''
    failed.current = false
    setHeard('')
    setError(null)
    try {
      listener.current = createListener({
        onText: (text, final) => {
          const parsed = parseVoiceOrder(text, canOrderFlavor)
          heardRef.current = text
          setHeard(text)
          setResult(parsed)
          fill(parsed.cart)
          if (final) pushLog(readingOf(text, listener.current?.elapsed() ?? 0))
        },
        onLog: pushLog,
        onError: (message) => {
          failed.current = true
          setError(message)
        },
        onEnd: () => {
          setListening(false)
          if (!heardRef.current && !failed.current) setError(NOT_HEARD)
        },
      })
      listener.current.start()
      setListening(true)
    } catch {
      setError('음성 인식을 시작하지 못했어요. 다시 눌러 주세요')
    }
  }

  const toggle = () => (listening ? listener.current?.stop() : start())

  const blocked = (flavor: Flavor) => {
    if (!canOrderFlavor(flavor)) showToast(`${menuItem(flavor).name}은 아직 준비 중이에요`)
    else showToast((cart[flavor] ?? 0) >= MAX_PER_FLAVOR ? `한 맛은 ${MAX_PER_FLAVOR}마리까지예요` : `한 번에 ${MAX_TOTAL}마리까지예요`)
  }

  if (blocker) {
    return (
      <main className="page page--plain empty">
        <h1>음성 주문</h1>
        <p role="alert" className="error">{blocker}</p>
        <button type="button" className="btn btn--primary" onClick={toMenu}>터치로 주문하기</button>
      </main>
    )
  }

  const count = cartCount(cart)
  const showOptions = result !== null || count > 0
  const notes = result ? warnings(result, heard) : []

  return (
    <main className="page page--actions voice">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={toMenu}>
          <Icon name="back" size={22} />
        </button>
        <h1 className="topbar__title">음성 주문</h1>
      </header>

      <section className="voice__stage">
        <button
          type="button"
          className={`voice__mic ${listening ? 'voice__mic--on' : ''}`}
          aria-pressed={listening}
          aria-label={listening ? '듣는 중… 누르면 멈춰요' : result || error ? '다시 말하기' : '눌러서 말하기'}
          onClick={toggle}
        >
          <Icon name="mic" size={44} strokeWidth={2.2} />
        </button>
        <p className="voice__hint" aria-live="polite">
          {listening ? '듣는 중이에요…' : `눌러서 말해 보세요. 예: “${EXAMPLE}”`}
        </p>
        {heard && <p className="voice__heard" aria-live="polite">{heard}</p>}
        {error && <p role="alert" className="error">{error}</p>}
      </section>

      <div className="voice__logbar">
        <button type="button" aria-expanded={logOpen} onClick={toggleLog}>{logOpen ? '인식 로그 숨기기' : '인식 로그 보기'}</button>
        {logOpen && <button type="button" onClick={copyLog}>로그 복사</button>}
        {logOpen && <button type="button" onClick={() => setLog([])}>로그 지우기</button>}
      </div>
      {logOpen && (
        <section className="voice__log" aria-label="인식 로그">
          {log.length === 0 ? (
            <p className="voice__log-empty">아직 기록이 없어요. 마이크를 눌러 말해 보세요</p>
          ) : (
            <ol ref={logEnd}>
              {log.map((entry, i) => (
                <li key={i} className={`voice__log-${entry.tone}`}>{formatLine(entry)}</li>
              ))}
            </ol>
          )}
        </section>
      )}

      {notes.map((line) => (
        <p key={line} className="voice__note">{line}</p>
      ))}

      {showOptions && (
        <section className="receipt voice__options" aria-label="주문 확인">
          <ul>
            {MENU.map((item) => {
              const qty = cart[item.flavor] ?? 0
              const preparing = !canOrderFlavor(item.flavor)
              return (
                <li key={item.flavor} className={preparing ? 'voice__opt--off' : undefined}>
                  <span className="voice__opt-name">
                    <i className="dot" style={{ background: item.color }} aria-hidden="true" />
                    {item.name}
                    <small className="muted">{preparing ? '준비 중' : formatWon(item.price)}</small>
                  </span>
                  <QtyStepper
                    label={item.name}
                    qty={qty}
                    canAdd={!preparing && canAdd(cart, item.flavor)}
                    onAdd={() => add(item.flavor)}
                    onRemove={() => remove(item.flavor)}
                    onBlocked={() => blocked(item.flavor)}
                  />
                </li>
              )
            })}
          </ul>
          <div className="receipt__total">
            <span>합계</span>
            <strong>{formatWon(cartTotal(cart))}</strong>
          </div>
        </section>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <div className="bottom-actions">
        <button type="button" className="btn btn--ghost" onClick={toMenu}>터치로 주문하기</button>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/confirm')} disabled={count === 0}>
          이대로 주문 확인
        </button>
      </div>
    </main>
  )
}
