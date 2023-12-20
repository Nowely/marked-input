import {EventKey, MarkStruct, NodeData, Option, OverlayMatch} from './types'
import LinkedList from './utils/classes/LinkedList/LinkedList'
import LinkedListNode from './utils/classes/LinkedList/LinkedListNode'
import type {Store} from './utils/classes/Store'

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

export const DefaultClass = 'mk-input'

export const DefaultOptions: Option[] = [{
	trigger: '@',
	markup: '@[__label__](__value__)',
	data: [],
}]


export const wordRegex = new RegExp(/^\w*/)

export const EmptyList = LinkedList.from<NodeData>([])

export const SystemEvent = {
	STORE_UPDATED: Symbol() as EventKey<Store>,
	ClearTrigger: Symbol() as EventKey<undefined>,
	CheckTrigger: Symbol() as EventKey<undefined>,
	Change: Symbol() as EventKey<{ node: ChildNode | null, mark?: MarkStruct }>,
	Delete: Symbol() as EventKey<{ node: ChildNode | null}>,
	Select: Symbol() as EventKey<{ mark: MarkStruct, match: OverlayMatch }>,
}

export enum PLACEHOLDER {
	LABEL = '__label__',
	VALUE = '__value__',
}