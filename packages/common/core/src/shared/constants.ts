import type {Markup} from '../features/parsing/parser/types'
import type {CoreOption} from './types'

export interface DefaultOverlayConfig {
	trigger?: string
	data?: string[]
}

export interface DefaultOption extends CoreOption {
	overlay?: DefaultOverlayConfig
}

export enum KEYBOARD {
	// Navigation Keys
	UP = 'ArrowUp',
	DOWN = 'ArrowDown',
	LEFT = 'ArrowLeft',
	RIGHT = 'ArrowRight',
	END = 'End',
	HOME = 'Home',
	PAGE_DOWN = 'PageDown',
	PAGE_UP = 'PageUp',

	// Whitespace Keys
	ENTER = 'Enter',
	TAB = 'Tab',
	SPACE = ' ',

	// Editing Keys
	BACKSPACE = 'Backspace',
	DELETE = 'Delete',
	COMMA = ',',

	// UI Keys
	ESC = 'Escape',
}

export const DEFAULT_OVERLAY_TRIGGER = '@'

export const DEFAULT_MARKUP: Markup = '@[__value__](__meta__)'

export const DEFAULT_OPTIONS: DefaultOption[] = [
	{
		markup: DEFAULT_MARKUP,
		overlay: {
			trigger: DEFAULT_OVERLAY_TRIGGER,
			data: [],
		},
	},
]