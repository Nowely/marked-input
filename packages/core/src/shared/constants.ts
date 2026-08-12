import type {Markup} from '../features/tokens/parser/types'
import type {CoreOption} from './types'

export const KEYBOARD = {
	UP: 'ArrowUp',
	DOWN: 'ArrowDown',

	ENTER: 'Enter',

	BACKSPACE: 'Backspace',
	DELETE: 'Delete',

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