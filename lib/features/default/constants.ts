import {InnerOption} from './types'

export const DEFAULT_TRIGGER = '@'

export const DEFAULT_MARKUP = '@[__label__](__value__)'

//TODO collaps to parsed function
export const DEFAULT_OPTIONS: InnerOption[] = [{
	trigger: DEFAULT_TRIGGER,
	markup: DEFAULT_MARKUP,
	data: [],
}]

export const DEFAULT_CLASS_NAME = 'mk-input'