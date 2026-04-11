import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

// These interfaces exist as module-augmentation targets for framework packages (React, Vue).
// Core implements them via computed() and casts with `as unknown as Slot` etc.
// The `use()` method is intentionally typed as `unknown` so that framework augmentations
// (React returning a tuple, Vue returning a Ref) can override it without assignability conflicts.

export interface Slot {
	(): readonly [unknown, Record<string, unknown> | undefined]
	use(): unknown
}

export interface MarkSlot {
	(): (token: Token) => readonly [unknown, unknown]
	use(): unknown
}

export interface OverlaySlot {
	(): (option?: CoreOption, defaultComponent?: unknown) => readonly [unknown, unknown]
	use(): unknown
}