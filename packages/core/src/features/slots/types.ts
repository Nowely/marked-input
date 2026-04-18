import type {CoreOption, Slot} from '../../shared/types'
import type {Token} from '../parsing'

export type {Slot}

export interface MarkSlot {
	(): (token: Token) => readonly [Slot, Record<string, unknown>]
}

export interface OverlaySlot {
	(): (option?: CoreOption, defaultComponent?: Slot) => readonly [Slot, Record<string, unknown>]
}