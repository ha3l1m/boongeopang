import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { BongbotScene } from './BongbotScene'
import type { SceneMode } from '../three/sceneMode'

function activeFrame(container: HTMLElement): string | null | undefined {
  return container.querySelector('.bongbot__frame.is-on')?.getAttribute('href')
}

function hasImage(container: HTMLElement, name: string): boolean {
  return container.querySelector(`.bongbot__overlay image[href="/art/bongbot/${name}.webp"]`) !== null
}

describe('BongbotScene', () => {
  it.each([
    ['idle', 'received'],
    ['received', 'received'],
    ['batter', 'batter'],
    ['filling', 'filling'],
    ['baking', 'baking'],
    ['packed', 'packed'],
    ['ready', 'ready'],
  ] as [SceneMode, string][])('shows the %s frame', (mode, frame) => {
    const { container } = render(<BongbotScene mode={mode} cue={0} />)
    expect(activeFrame(container)).toBe(`/art/bongbot/${frame}.webp`)
    expect(container.querySelectorAll('.bongbot__frame.is-on')).toHaveLength(1)
  })

  it('pours batter: empty cavities that the spreading mask uncovers', () => {
    const { container } = render(<BongbotScene mode="batter" cue={0} />)
    expect(hasImage(container, 'batter-empty')).toBe(true)
    expect(container.querySelectorAll('#bongbot-batter-mask .bongbot__spread')).toHaveLength(2)
  })

  it('fills: starts on plain batter, then each bean pile grows as its own layer', () => {
    const { container } = render(<BongbotScene mode="filling" cue={0} />)
    expect(hasImage(container, 'filling-clean')).toBe(true)
    const column = container.querySelector('.bongbot__overlay image[href="/art/bongbot/beans-column.webp"]')
    expect(column?.getAttribute('clip-path')).toBe('url(#bongbot-column-clip)')
    expect(container.querySelectorAll('[clip-path="url(#bongbot-below-nozzle)"] .bongbot__falling-bean')).toHaveLength(
      3,
    )
    const piles = [...container.querySelectorAll('.bongbot__pile')].map((image) => image.getAttribute('href'))
    expect(piles).toEqual(['/art/bongbot/beans-0.webp', '/art/bongbot/beans-1.webp'])
  })

  it('bakes through the storyboard images as drawn: open, closing, closed, opened', () => {
    const { container } = render(<BongbotScene mode="baking" cue={0} />)
    const shots = [...container.querySelectorAll('.bongbot__bake-shot > img:first-child')].map((img) =>
      img.getAttribute('src'),
    )
    expect(shots).toEqual(['open', 'closing', 'closed', 'baked'].map((name) => `/art/bongbot/bake-${name}.webp`))
    expect(container.querySelectorAll('.bongbot__pan-glow')).toHaveLength(3)
  })

  it('packs (close-up): the app fish drops from behind the gripper pads into the pouch, behind its front lip', () => {
    const { container } = render(<BongbotScene mode="packed" cue={0} />)
    const layers = [...container.querySelectorAll('.bongbot__packing image')].map((image) => image.getAttribute('href'))
    expect(layers).toEqual([
      ...Array(3).fill('/art/fish.png'),
      '/art/fish.png',
      '/art/bongbot/packed-front.webp',
      '/art/bongbot/packed-fingers.webp',
    ])
    expect(container.querySelector('.bongbot__drop-fish image')?.getAttribute('href')).toBe('/art/fish.png')
    // Outside the overlay, so reduced motion still shows the held fish and the pile.
    expect(container.querySelector('.bongbot__overlay .bongbot__drop-fish')).toBeNull()
  })

  it('is ready: fish peek out of the clay pouch', () => {
    const { container } = render(<BongbotScene mode="ready" cue={0} />)
    const layers = [...container.querySelectorAll('.bongbot__pouch image')].map((image) => image.getAttribute('href'))
    expect(layers).toEqual([
      '/art/bag/empty.webp',
      ...[0, 1, 2].map((i) => `/art/bag/fish-${i}.webp`),
      '/art/bag/empty-front.webp',
    ])
  })

  it('powers up on received: status lights, warming cavities', () => {
    const { container } = render(<BongbotScene mode="received" cue={0} />)
    expect(container.querySelectorAll('.bongbot__overlay .bongbot__led')).toHaveLength(2)
    expect(container.querySelectorAll('.bongbot__overlay .bongbot__warm-cavity')).toHaveLength(2)
  })

  it.each(['received', 'baking'] as SceneMode[])('has no pouch while %s', (mode) => {
    const { container } = render(<BongbotScene mode={mode} cue={0} />)
    expect(container.querySelector('.bongbot__pouch')).toBeNull()
  })

  it('restarts the step animation when the same step is previewed again', () => {
    const { container, rerender } = render(<BongbotScene mode="batter" cue={1} />)
    const before = container.querySelector('.bongbot__overlay')
    rerender(<BongbotScene mode="batter" cue={2} />)
    expect(container.querySelector('.bongbot__overlay')).not.toBe(before)
  })
})
