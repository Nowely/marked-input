import type {Markup} from '../features/tokens/parser/types'
import type {CoreOption} from './types'

export const KEYBOARD = {
	UP: 'ArrowUp',
	DOWN: 'ArrowDown',

	ENTER: 'Enter',

	BACKSPACE: 'Backspace',
	DELETE: 'Delete',

	TAB: 'Tab',

	HOME: 'Home',
	END: 'End',

	ESC: 'Escape',
} as const
export type KEYBOARD = (typeof KEYBOARD)[keyof typeof KEYBOARD]

export const DEFAULT_OPTIONS: CoreOption[] = [
	{
		markup: '@[__value__](__meta__)' satisfies Markup,
		overlay: {
			trigger: '@',
			data: [],
		},
	},
]