import {NumberedOption} from './types'
import LinkedList from './utils/LinkedList'

export enum KEY {
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
	ESC = 'Escape'
}

export enum PLACEHOLDER {
	LABEL = '__label__',
	VALUE = '__value__',
}

export const EmptyFunc = () => {
}

export const DefaultClass = 'mk-input'

export const DefaultOptionProps: NumberedOption = {
	trigger: '@',
	markup: '@[__label__](__value__)',
	data: [],
	index: 0,
}


export const wordRegex = new RegExp(/^\w*/)

export const EmptyList = LinkedList.from([])

export enum SystemEvent {
	Change,
	Delete,
	CheckTrigger,
	ClearTrigger,
	Trigger,
	Select,
	State,
}