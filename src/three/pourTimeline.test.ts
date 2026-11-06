import { describe, expect, it } from 'vitest'
import { STEP_SECONDS } from '../domain/order'
import { armTarget, bottleFlip, fillProgress, flowingCavity, holdingBottle, POUR_TIMELINE } from './pourTimeline'

describe('pour timeline', () => {
  it('fits inside one live order step', () => {
    expect(POUR_TIMELINE.release).toBeLessThan(STEP_SECONDS)
  })

  it('picks the bottle, pours cavity A then B, and puts the bottle back', () => {
    const order = [0.1, 1.2, 1.6, 3, 5, 6.8, 7.4, 7.9].map(armTarget)
    expect(order).toEqual(['above', 'grab', 'above', 'cavityA', 'cavityB', 'above', 'grab', 'above'])
  })

  it('only holds the bottle between grabbing and releasing it', () => {
    expect(holdingBottle(0.5)).toBe(false)
    expect(holdingBottle(POUR_TIMELINE.grip)).toBe(true)
    expect(holdingBottle(6)).toBe(true)
    expect(holdingBottle(POUR_TIMELINE.release)).toBe(false)
  })

  it('flows into one cavity at a time, never while moving', () => {
    expect(flowingCavity(1)).toBeNull()
    expect(flowingCavity(3)).toBe(0)
    expect(flowingCavity(4.5)).toBeNull()
    expect(flowingCavity(5.5)).toBe(1)
    expect(flowingCavity(7)).toBeNull()
  })

  it('fills each cavity from 0 to 1 over its own pour', () => {
    expect(fillProgress(0, 1)).toBe(0)
    expect(fillProgress(POUR_TIMELINE.pourA[1], 0)).toBe(1)
    expect(fillProgress(POUR_TIMELINE.pourA[1], 1)).toBe(0)
    expect(fillProgress(10, 1)).toBe(1)
  })

  it('turns the bottle nozzle-down on the way over and upright again before putting it back', () => {
    expect(bottleFlip(0)).toBe(0)
    expect(bottleFlip(3)).toBe(1)
    expect(bottleFlip(POUR_TIMELINE.place)).toBe(0)
  })
})
