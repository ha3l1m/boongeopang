import { MENU, type Flavor } from './menu'
import type { FeedbackAxis } from './feedback'

export type ParamId = 'bakeSec' | 'crispSec' | `filling.${Flavor}`

export type ParamSpec = {
  id: ParamId
  label: string
  unit: string
  base: number
  step: number
  min: number
  max: number
  axis: FeedbackAxis
  flavor?: Flavor
}

/** Placeholder robot values — re-measure on the real robot (see plan 2026-11-06). */
export const PARAMS: readonly ParamSpec[] = [
  { id: 'bakeSec', label: '굽기 시간', unit: '초', base: 90, step: 5, min: 60, max: 150, axis: 'doneness' },
  { id: 'crispSec', label: '마무리 굽기', unit: '초', base: 20, step: 3, min: 5, max: 45, axis: 'crisp' },
  ...MENU.map((m): ParamSpec => ({
    id: `filling.${m.flavor}`,
    label: `${m.fillingName} 양`,
    unit: 'g',
    base: 25,
    step: 2,
    min: 15,
    max: 40,
    axis: 'filling',
    flavor: m.flavor,
  })),
]

export type Tuning = Record<ParamId, number>

export const DEFAULT_TUNING = Object.fromEntries(PARAMS.map((p) => [p.id, p.base])) as Tuning

export function paramSpec(id: ParamId): ParamSpec {
  const spec = PARAMS.find((p) => p.id === id)
  if (!spec) throw new Error(`Unknown param: ${id}`)
  return spec
}

export function clampParam(spec: ParamSpec, value: number): number {
  return Math.min(Math.max(value, spec.min), spec.max)
}
