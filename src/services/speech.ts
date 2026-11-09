// Thin wrapper over the browser's speech recognition (Chrome/Edge/Safari). The audio goes to the browser vendor's service.
type Alternative = { transcript: string; confidence?: number }
type RecognitionResult = { readonly [index: number]: Alternative; readonly isFinal: boolean; readonly length?: number }
type RecognitionEvent = { results: ArrayLike<RecognitionResult> }

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onaudiostart: (() => void) | null
  onsoundstart: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  onsoundend: (() => void) | null
  onaudioend: (() => void) | null
  onnomatch: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionCtor = new () => Recognition

/** One line of the on-screen recognition log, so a misheard word can be told apart from a silent microphone. */
export type LogEntry = { at: number; label: string; text: string; tone: 'info' | 'interim' | 'final' | 'error' }

export type SpeechHandlers = {
  onText: (text: string, final: boolean) => void
  onError: (message: string) => void
  onEnd: () => void
  onLog?: (entry: LogEntry) => void
}

export type Listener = { start(): void; stop(): void; abort(): void; elapsed(): number }

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': '마이크 권한이 필요해요. 주소창의 마이크 허용을 눌러 주세요',
  'service-not-allowed': '마이크 권한이 필요해요. 주소창의 마이크 허용을 눌러 주세요',
  'audio-capture': '마이크를 찾을 수 없어요',
  network: '음성 인식 서버에 닿지 못했어요. 인터넷 연결을 확인해 주세요',
}
const GENERIC_ERROR = '음성 인식에 실패했어요. 다시 말해 주세요'
const IGNORED_ERRORS = ['aborted', 'no-speech'] // no-speech ends silently; the page then says nothing was heard
const ALTERNATIVES = 3

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Why voice cannot be used here, or null when it can. The microphone only works on https or localhost. */
export function voiceBlocker(): string | null {
  if (!recognitionCtor()) return '이 브라우저는 음성 인식을 지원하지 않아요'
  if (window.isSecureContext === false) return '음성 주문은 https 또는 localhost 주소에서만 쓸 수 있어요'
  return null
}

const percent = (confidence: number | undefined) => (typeof confidence === 'number' ? ` ${Math.round(confidence * 100)}%` : '')

/** The best guess with its confidence, then the other candidates the engine considered. */
function describeFinal(result: RecognitionResult, text: string): string {
  const others = Array.from({ length: Math.min(result.length ?? 1, ALTERNATIVES) }, (_, i) => result[i]).slice(1)
  const extra = others.filter(Boolean).map((alt) => ` · 후보 “${alt.transcript}”${percent(alt.confidence)}`)
  return `“${text}”${percent(result[0]?.confidence)}${extra.join('')}`
}

export function createListener({ onText, onError, onEnd, onLog }: SpeechHandlers): Listener {
  const Ctor = recognitionCtor()
  if (!Ctor) throw new Error('음성 인식을 쓸 수 없어요')
  const recognition = new Ctor()
  let startedAt = Date.now()
  const elapsed = () => Date.now() - startedAt
  const log = (label: string, text = '', tone: LogEntry['tone'] = 'info') => onLog?.({ at: elapsed(), label, text, tone })

  recognition.lang = 'ko-KR'
  recognition.interimResults = true
  recognition.continuous = false
  recognition.maxAlternatives = ALTERNATIVES
  recognition.onaudiostart = () => log('마이크 켜짐')
  recognition.onsoundstart = () => log('소리 감지')
  recognition.onspeechstart = () => log('말소리 감지')
  recognition.onspeechend = () => log('말 끝남')
  recognition.onsoundend = () => log('소리 끝')
  recognition.onaudioend = () => log('마이크 꺼짐')
  recognition.onnomatch = () => log('인식 못 함')
  recognition.onresult = (event) => {
    const parts = Array.from(event.results, (r) => r[0].transcript)
    const last = event.results[event.results.length - 1]
    const text = parts.join(' ').trim()
    const final = last?.isFinal ?? false
    // log first: the page adds its own "해석" line when it gets the text, and that must come after this one
    log(final ? '확정' : '중간', final && last ? describeFinal(last, text) : `“${text}”`, final ? 'final' : 'interim')
    onText(text, final)
  }
  recognition.onerror = ({ error }) => {
    log('오류', error, 'error')
    if (!IGNORED_ERRORS.includes(error)) onError(ERROR_TEXT[error] ?? GENERIC_ERROR)
  }
  recognition.onend = () => {
    log('듣기 끝')
    onEnd()
  }
  return {
    start: () => {
      startedAt = Date.now()
      log('듣기 시작')
      recognition.start()
    },
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    elapsed,
  }
}
