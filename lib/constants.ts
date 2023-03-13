import {EventName, OptionType} from './types'
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

export const DefaultOptionProps: OptionType = {
    trigger: '@',
    markup: '@[__label__](__value__)',
    data: [],
    index: 0
}

//TODO
export const PredefinedEvents: EventName[] = [
    'onFocus', 'onBlur', 'onKeyDown', 'onClick', 'onMouseDown', 'onMouseMove', 'onMouseUp', 'onMouseOver', 'onMouseLeave'
]

export const wordRegex = new RegExp(/^\w*/)

export const EmptyList = LinkedList.from([])