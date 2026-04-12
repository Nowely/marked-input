import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

// These interfaces are module-augmentation targets for framework packages (React, Vue).
// Core implements them via computed() and casts with `as unknown as Slot` etc.
// Call signatures use unknown for the component type because the actual type
// (ElementType in React, Component in Vue) is framework-specific.

export interface MarkSlot {
	(): (token: Token) => readonly [unknown, unknown]
}

export interface OverlaySlot {
	(): (option?: CoreOption, defaultComponent?: unknown) => readonly [unknown, unknown]
}