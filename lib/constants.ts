import {MarkedInputProps} from './components/MarkedInput'
import {EventKey, MarkStruct, NodeData, Option, OverlayMatch, State} from './types'
import LinkedList from './utils/classes/LinkedList/LinkedList'
import LinkedListNode from './utils/classes/LinkedList/LinkedListNode'

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

export const EmptyFunc = () => {
}

export const DefaultClass = 'mk-input'

export const DefaultOptions: Option[] = [{
	trigger: '@',
	markup: '@[__label__](__value__)',
	data: [],
}]


export const wordRegex = new RegExp(/^\w*/)

export const EmptyList = LinkedList.from([])

export const SystemEvent = {
	ClearTrigger: Symbol() as EventKey<undefined>,
	Change: Symbol() as EventKey<{ node: LinkedListNode<NodeData>, mark?: MarkStruct }>,
	Delete: Symbol() as EventKey<LinkedListNode<NodeData>>,
	CheckTrigger: Symbol() as EventKey<undefined>,
	Select: Symbol() as EventKey<{ mark: MarkStruct, match: OverlayMatch }>,
	State: Symbol() as EventKey<MarkedInputProps & State>,
}

export enum PLACEHOLDER {
	LABEL = '__label__',
	VALUE = '__value__',
}