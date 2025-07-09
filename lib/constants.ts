import {EventKey, MarkStruct, OverlayMatch} from './types'

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
	ESC = 'Escape'
}


export const wordRegex = new RegExp(/^\w*/)

export const SystemEvent = {
	STORE_UPDATED: Symbol() as EventKey,
	ClearTrigger: Symbol() as EventKey,
	CheckTrigger: Symbol() as EventKey,
	Change: Symbol() as EventKey,
	Parse: Symbol() as EventKey,
	Delete: Symbol() as EventKey<{ token: MarkStruct }>,
	Select: Symbol() as EventKey<{ mark: MarkStruct, match: OverlayMatch }>,
}

export enum PLACEHOLDER {
	LABEL = '__label__',
	VALUE = '__value__',
}