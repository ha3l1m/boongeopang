import { describe, expect, it } from 'vitest'
import { explainVoiceOrder, parseVoiceOrder } from './voice'

const all = () => true
const noChoco = (flavor: string) => flavor !== 'choco'

describe('parseVoiceOrder', () => {
  it('reads native Korean counts after each flavor', () => {
    expect(parseVoiceOrder('팥붕 두 개 슈붕 하나', all).cart).toEqual({ redbean: 2, cream: 1 })
  })

  it('does not take the 세 of 주세요 for a count of three', () => {
    expect(parseVoiceOrder('팥붕 두개랑 슈붕 세 개 주세요', all).cart).toEqual({ redbean: 2, cream: 3 })
    expect(parseVoiceOrder('슈붕 주세요', all).cart).toEqual({ cream: 1 })
  })

  it('reads digits, sino counts with a counter, and flavor nicknames', () => {
    expect(parseVoiceOrder('팥붕 2개 슈크림 1개', all).cart).toEqual({ redbean: 2, cream: 1 })
    expect(parseVoiceOrder('단팥 삼 마리', all).cart).toEqual({ redbean: 3 })
    expect(parseVoiceOrder('열 마리 슈크림', all).cart).toEqual({ cream: 10 })
  })

  it('orders one when no count is spoken and adds repeated flavors together', () => {
    expect(parseVoiceOrder('팥붕', all).cart).toEqual({ redbean: 1 })
    expect(parseVoiceOrder('팥붕 하나 슈붕 팥붕 둘', all).cart).toEqual({ redbean: 3, cream: 1 })
  })

  it('reads the count before the flavor when the sentence starts with a number', () => {
    expect(parseVoiceOrder('두 개 팥붕 한 개 슈붕', all).cart).toEqual({ redbean: 2, cream: 1 })
  })

  it('keeps unavailable flavors out of the cart and reports them', () => {
    const result = parseVoiceOrder('팥붕 하나 초코붕 두 개', noChoco)
    expect(result.cart).toEqual({ redbean: 1 })
    expect(result.unavailable).toEqual(['choco'])
  })

  it('cuts to the menu limits and says so', () => {
    const per = parseVoiceOrder('팥붕 25개', all)
    expect(per.cart).toEqual({ redbean: 10 })
    expect(per.clipped).toBe(true)
    const total = parseVoiceOrder('팥붕 열 마리 슈붕 열 마리 초코붕 한 마리', all)
    expect(total.cart).toEqual({ redbean: 10, cream: 10 })
    expect(total.clipped).toBe(true)
    expect(parseVoiceOrder('팥붕 두 개', all).clipped).toBe(false)
  })

  it('returns an empty order when nothing is recognized', () => {
    expect(parseVoiceOrder('안녕하세요', all)).toEqual({ cart: {}, unavailable: [], clipped: false })
    expect(parseVoiceOrder('', all).cart).toEqual({})
  })
})

describe('explainVoiceOrder', () => {
  it('shows which spoken words were read as a flavor or a count', () => {
    expect(explainVoiceOrder('팥붕 두 개 슈붕 하나')).toEqual({
      matched: [
        { text: '팥붕', meaning: '팥붕' },
        { text: '두', meaning: '2' },
        { text: '슈붕', meaning: '슈붕' },
        { text: '하나', meaning: '1' },
      ],
      ignored: [],
    })
  })

  it('shows nicknames mapped to the menu name', () => {
    expect(explainVoiceOrder('단팥 3개').matched).toEqual([
      { text: '단팥', meaning: '팥붕' },
      { text: '3', meaning: '3' },
    ])
  })

  it('lists the words it did not use, so a misheard word is easy to spot', () => {
    expect(explainVoiceOrder('파붕 두 개 주세요')).toEqual({ matched: [{ text: '두', meaning: '2' }], ignored: ['파붕', '주세요'] })
    // 팥 alone is a nickname, so a slightly misheard 팥분 still counts and only the stray 분 is left over
    expect(explainVoiceOrder('팥분 하나')).toEqual({ matched: [{ text: '팥', meaning: '팥붕' }, { text: '하나', meaning: '1' }], ignored: ['분'] })
    expect(explainVoiceOrder('안녕하세요')).toEqual({ matched: [], ignored: ['안녕하세요'] })
    expect(explainVoiceOrder('')).toEqual({ matched: [], ignored: [] })
  })
})
