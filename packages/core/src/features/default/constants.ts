import {InnerOption} from './types'
import type {Markup} from '../parsing/ParserV2/types'

export const DEFAULT_TRIGGER = '@'

export const DEFAULT_MARKUP: Markup = '@[__value__](__meta__)'

export const DEFAULT_OPTIONS: InnerOption[] = [
	{
		trigger: DEFAULT_TRIGGER,
		markup: DEFAULT_MARKUP,
		data: [],
	},
]

export const DEFAULT_CLASS_NAME = 'mk-input'
