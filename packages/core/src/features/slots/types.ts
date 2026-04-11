import type {Computed} from '../../shared/signals'
import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

// These interfaces exist as module-augmentation targets for framework packages (React, Vue).
// Core implements them via computed() and casts with `as unknown as Slot` etc.

export interface Slot extends Computed<readonly [unknown, Record<string, unknown> | undefined]> {}

export interface MarkSlot extends Computed<(token: Token) => readonly [unknown, unknown]> {}

export interface OverlaySlot extends Computed<
	(option?: CoreOption, defaultComponent?: unknown) => readonly [unknown, unknown]
> {}