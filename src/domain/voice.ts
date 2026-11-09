import { menuItem, type Flavor } from './menu'
import { addToCart, type Cart } from './order'

export type VoiceResult = { cart: Cart; unavailable: Flavor[]; clipped: boolean }

type Token = { kind: 'flavor'; flavor: Flavor } | { kind: 'count'; value: number }

const WORD_COUNTS: Record<string, number> = {
  하나: 1, 둘: 2, 셋: 3, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9,
  한: 1, 두: 2, 세: 3, 네: 4, 석: 3, 넉: 4,
  일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 십: 10,
}

/**
 * Short forms (한/두/세/네) and sino numbers only count when a counter follows, so the 세 of "주세요"
 * and the 이 of "팥붕이" are not read as numbers.
 */
const TOKEN = new RegExp(
  [
    '(?<choco>초코붕|초콜릿|초코)',
    '(?<redbean>팥붕|단팥|팥)',
    '(?<cream>슈붕|슈크림|슈)',
    '(?<digits>\\d+)',
    '(?<tens>열|스물)\\s*(?<ones>하나|한|둘|두|셋|세|넷|네|다섯|여섯|일곱|여덟|아홉)?',
    '(?<word>하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉)',
    '(?<short>한|두|세|네|석|넉|일|이|삼|사|오|육|칠|팔|구|십)(?=\\s*(?:개|마리))',
  ].join('|'),
  'g',
)

const FLAVOR_GROUPS: readonly Flavor[] = ['choco', 'redbean', 'cream']

function toToken(groups: Record<string, string | undefined>): Token | null {
  const flavor = FLAVOR_GROUPS.find((f) => groups[f])
  if (flavor) return { kind: 'flavor', flavor }
  if (groups.digits) return { kind: 'count', value: Number(groups.digits) }
  if (groups.tens) return { kind: 'count', value: (groups.tens === '열' ? 10 : 20) + (WORD_COUNTS[groups.ones ?? ''] ?? 0) }
  const word = groups.word ?? groups.short
  return word ? { kind: 'count', value: WORD_COUNTS[word] } : null
}

type Spot = { token: Token; raw: string; start: number }

function scan(text: string): Spot[] {
  return [...text.matchAll(TOKEN)].flatMap((m) => {
    const token = toToken(m.groups ?? {})
    return token ? [{ token, raw: m[0].trim(), start: m.index ?? 0 }] : []
  })
}

function tokenize(text: string): Token[] {
  return scan(text).map((spot) => spot.token)
}

export type VoiceExplain = {
  /** Each spoken word that was read as a flavor or a count, with what it was read as. */
  matched: { text: string; meaning: string }[]
  /** Spoken words that were not used: a misheard flavor shows up here. */
  ignored: string[]
}

const COUNTERS = ['개', '마리']

/** For the on-screen recognition log: shows how a heard sentence was read, so a misheard word is easy to spot. */
export function explainVoiceOrder(text: string): VoiceExplain {
  const spots = scan(text)
  const matched = spots.map(({ token, raw }) => ({
    text: raw,
    meaning: token.kind === 'flavor' ? menuItem(token.flavor).name : String(token.value),
  }))
  const rest = spots.reduce((left, { raw, start }) => left.slice(0, start) + ' '.repeat(raw.length) + left.slice(start + raw.length), text)
  const ignored = rest.split(/\s+/).filter((word) => word !== '' && !COUNTERS.includes(word))
  return { matched, ignored }
}

/** "팥붕 두 개" counts after the flavor; a sentence that starts with a number ("두 개 팥붕") counts before it. */
function wantedFlavors(tokens: readonly Token[]): [Flavor, number][] {
  const countBefore = tokens[0]?.kind === 'count'
  const wanted: [Flavor, number][] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const here = tokens[i]
    const next = tokens[i + 1]
    if (countBefore && here.kind === 'count' && next?.kind === 'flavor') {
      wanted.push([next.flavor, here.value])
      i += 1
    } else if (!countBefore && here.kind === 'flavor') {
      const counted = next?.kind === 'count'
      wanted.push([here.flavor, counted ? next.value : 1])
      if (counted) i += 1
    } else if (here.kind === 'flavor') {
      wanted.push([here.flavor, 1])
    }
  }
  return wanted
}

export function parseVoiceOrder(text: string, canOrder: (flavor: Flavor) => boolean): VoiceResult {
  const unavailable: Flavor[] = []
  let cart: Cart = {}
  let clipped = false
  for (const [flavor, qty] of wantedFlavors(tokenize(text))) {
    if (!canOrder(flavor)) {
      if (!unavailable.includes(flavor)) unavailable.push(flavor)
      continue
    }
    for (let added = 0; added < qty; added += 1) {
      const next = addToCart(cart, flavor)
      if (next === cart) {
        clipped = true
        break
      }
      cart = next
    }
  }
  return { cart, unavailable, clipped }
}
