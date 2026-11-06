import type { OrderStatus } from '../domain/order'

export type SceneMode = 'idle' | 'ordering' | OrderStatus

export type GrandmaAction = 'idle' | 'wave' | 'present' | 'pack' | 'cheer'

/** Seconds since the packed step started: fish flies to grandma, she holds it, then lowers it into the bag. */
export const PACK = { fly: 1.2, hold: 2.0, drop: 3.0 } as const

/** Seconds the closed mold spins over the fire before it opens to reveal the baked fish. */
export const BAKE_SPIN = 4.5
