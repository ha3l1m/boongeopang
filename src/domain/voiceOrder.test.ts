import { describe, expect, it } from 'vitest'
import { parseFirstMatch, parseVoiceOrder } from './voiceOrder'

describe('parseVoiceOrder', () => {
  it('reads counts written as Korean number words', () => {
    expect(parseVoiceOrder('팥붕 두 개, 슈붕 하나')).toEqual({ redbean: 2, cream: 1 })
  })

  it('reads digits and counters without a space', () => {
    expect(parseVoiceOrder('초코붕3개')).toEqual({ choco: 3 })
  })

  it('counts a flavor said without a number as one', () => {
    expect(parseVoiceOrder('슈붕 주세요')).toEqual({ cream: 1 })
  })

  it('does not let one flavor name swallow the next', () => {
    expect(parseVoiceOrder('팥붕 슈붕')).toEqual({ redbean: 1, cream: 1 })
  })

  it('adds up repeated mentions of the same flavor', () => {
    expect(parseVoiceOrder('팥붕 두 개 그리고 팥붕 한 개')).toEqual({ redbean: 3 })
  })

  it('returns nothing when no flavor is mentioned', () => {
    expect(parseVoiceOrder('안녕하세요')).toEqual({})
  })

  it('ignores spaces the speech engine puts inside a name', () => {
    expect(parseVoiceOrder('팥 붕 두 개 슈 크림 하나')).toEqual({ redbean: 2, cream: 1 })
  })

  it('accepts common respellings of the flavor names', () => {
    expect(parseVoiceOrder('쥬붕 한 개, 초콜릿 두 개')).toEqual({ cream: 1, choco: 2 })
  })

  it('reads a count written as digits with a space', () => {
    expect(parseVoiceOrder('팥붕 2 개')).toEqual({ redbean: 2 })
  })
})

describe('parseFirstMatch', () => {
  it('takes the first alternative that names a flavor', () => {
    expect(parseFirstMatch(['안녕', '팥붕 두 개', '슈붕'])).toEqual({ text: '팥붕 두 개', order: { redbean: 2 } })
  })

  it('returns null when no alternative names a flavor', () => {
    expect(parseFirstMatch(['안녕', '네'])).toBeNull()
  })
})
