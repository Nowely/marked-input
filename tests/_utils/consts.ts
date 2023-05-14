import {Markup} from 'rc-marked-input'
import {Parser} from 'rc-marked-input/utils/Parser'
import {SymbolParser} from 'rc-marked-input/utils/SymbolParser'
import {analyzeSimple} from './analyzeSimple'
import {formalizeTear} from './formalizeTear'
import {joinExactly} from './joinExactly'
import {joinSimple} from './joinSimple'
import {Analyzer, JoinParameters, ParserConstructor} from './types'

export const Markups_16: Markup[] = [
	'@[__label__]',
	'@[__label__}',
	'@{__label__]',
	'@{__label__}',

	'/[__label__}',
	'/{__label__]',
	'/{__label__}',

	'@[__label__*',
	'@*__label__]',
	'@*__label__*',

	'_[__label__]_',
	'____label____',
	'**__label__**',
	'[^__label__^]',
	'[=^__label__^=]',
	'[[__label__]]',
]

export const Markups_1 = Markups_16.slice(0, 1)
export const Markups_2 = Markups_16.slice(0, 2)
export const Markups_4 = Markups_16.slice(0, 4)
export const Markups_8 = Markups_16.slice(0, 8)
export const Analyzers: Analyzer[] = [analyzeSimple, formalizeTear]
export const Parsers: ParserConstructor[] = [SymbolParser, Parser]
export const Joiners: ((params: JoinParameters) => string)[] = [joinSimple, joinExactly]