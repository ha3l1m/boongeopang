import type { Flavor } from './menu'

/**
 * Words a customer or the speech engine might use for each flavor. Speech recognition often splits or respells
 * 붕어빵 names (e.g. "팥 붕", "쥬붕"), so the matcher ignores spaces and reads any of these.
 */
const FLAVOR_WORDS: Record<Flavor, readonly string[]> = {
  redbean: ['팥붕어빵', '팥붕', '팥봉', '팥빵', '단팥', '팥'],
  cream: ['슈크림붕어빵', '슈크림', '슈붕', '쥬붕', '슈봉', '쥬크림', '슈'],
  choco: ['초코붕어빵', '초코붕', '초코봉', '초콜릿붕', '초콜릿', '초코'],
}

/** Korean count words (and digits) a customer might say, longest first so 하나 is read before 하. */
const COUNT_WORDS: Readonly<Record<string, number>> = {
  하나: 1, 한: 1, 일: 1, 둘: 2, 두: 2, 이: 2, 셋: 3, 세: 3, 삼: 3, 넷: 4, 네: 4, 사: 4,
  다섯: 5, 오: 5, 여섯: 6, 육: 6, 일곱: 7, 칠: 7, 여덟: 8, 팔: 8, 아홉: 9, 구: 9, 열: 10,
}

const byLengthDesc = (a: string, b: string) => b.length - a.length

const FLAVOR_PATTERN = (Object.keys(FLAVOR_WORDS) as Flavor[])
  .flatMap((flavor) => FLAVOR_WORDS[flavor])
  .sort(byLengthDesc)
  .join('|')

const COUNT_PATTERN = [...Object.keys(COUNT_WORDS), '\\d+'].sort(byLengthDesc).join('|')

const ORDER_PATTERN = new RegExp(`(${FLAVOR_PATTERN})(${COUNT_PATTERN})?(?:개|마리|잔)?`, 'g')

function flavorOf(word: string): Flavor | null {
  for (const flavor of Object.keys(FLAVOR_WORDS) as Flavor[]) {
    if (FLAVOR_WORDS[flavor].includes(word)) return flavor
  }
  return null
}

function countOf(word: string | undefined): number {
  if (!word) return 1
  if (/^\d+$/.test(word)) return Number(word)
  return COUNT_WORDS[word] ?? 1
}

/**
 * Reads a spoken order such as "팥붕 두 개, 슈붕 하나" into how many of each flavor were asked for.
 * Spaces and punctuation are ignored, a flavor said without a count means one, and repeated mentions add up.
 */
export function parseVoiceOrder(text: string): Partial<Record<Flavor, number>> {
  const squashed = text.replace(/[\s.,!?·]+/g, '')
  const result: Partial<Record<Flavor, number>> = {}
  for (const match of squashed.matchAll(ORDER_PATTERN)) {
    const flavor = flavorOf(match[1])
    if (!flavor) continue
    result[flavor] = (result[flavor] ?? 0) + countOf(match[2])
  }
  return result
}

/** Tries each recognition alternative in turn and returns the first that names at least one flavor. */
export function parseFirstMatch(alternatives: readonly string[]): { text: string; order: Partial<Record<Flavor, number>> } | null {
  for (const text of alternatives) {
    const order = parseVoiceOrder(text)
    if (Object.keys(order).length > 0) return { text, order }
  }
  return null
}
