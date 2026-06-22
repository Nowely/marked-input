import type {Markup} from '../features/tokens/parser/types'
import type {CoreOption} from './types'

export const KEYBOARD = {
	UP: 'ArrowUp',
	DOWN: 'ArrowDown',
	LEFT: 'ArrowLeft',
	RIGHT: 'ArrowRight',
	END: 'End',
	HOME: 'Home',
	PAGE_DOWN: 'PageDown',
	PAGE_UP: 'PageUp',

	ENTER: 'Enter',
	TAB: 'Tab',
	SPACE: ' ',

	BACKSPACE: 'Backspace',
	DELETE: 'Delete',
	COMMA: ',',

	ESC: 'Escape',
} as const
export type KEYBOARD = (typeof KEYBOARD)[keyof typeof KEYBOARD]

export const DEFAULT_OPTIONS: (CoreOption & {overlay?: {trigger?: string; data?: string[]}})[] = [
	{
		markup: '@[__value__](__meta__)' satisfies Markup,
		overlay: {
			trigger: '@',
			data: [],
		},
	},
]