import type {Markup} from '../features/parsing/ParserV2/types'

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

export const DEFAULT_CLASS_NAME = 'mk-input'
