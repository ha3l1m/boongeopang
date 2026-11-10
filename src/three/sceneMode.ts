import type { OrderStatus } from '../domain/order'

export type SceneMode = 'idle' | 'ordering' | OrderStatus

export type GrandmaAction = 'idle' | 'wave' | 'present' | 'pack' | 'cheer'

/** Seconds the closed mold spins over the fire before it opens to reveal the baked fish. */
export const BAKE_SPIN = 4.5
