import type {CoreOption} from '../../shared/types'
import type {Token} from '../parsing'

export interface Slot {
	use(): readonly unknown[]
	get(): readonly unknown[]
}

export interface MarkSlot {
	use(token: Token): readonly unknown[]
	get(token: Token): readonly unknown[]
}

export interface OverlaySlot {
	use(option?: CoreOption, defaultComponent?: unknown): readonly unknown[]
	get(option?: CoreOption, defaultComponent?: unknown): readonly unknown[]
}