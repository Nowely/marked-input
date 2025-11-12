import {InnerOption} from './types'
import type {Markup as ParserV1Markup} from '../parsing/ParserV1/types'

export const DEFAULT_TRIGGER = '@'

export const DEFAULT_MARKUP: ParserV1Markup = '@[__label__](__value__)'

export const DEFAULT_OPTIONS: InnerOption[] = [
	{
		trigger: DEFAULT_TRIGGER,
		markup: DEFAULT_MARKUP,
		data: [],
	},
]

export const DEFAULT_CLASS_NAME = 'mk-input'
