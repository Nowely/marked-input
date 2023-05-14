import {Markup} from 'rc-marked-input'
import {isEqual} from './analyzers/isEqual'
import {findSingleGap} from './analyzers/findSingleGap'
import {modifyOrigin} from './joiners/modifyOrigin'
import {mapStraight} from './joiners/mapStraight'
import {RegexParser} from './parsers/RegexParser'
import {SymbolParser} from './parsers/SymbolParser'
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

export const Analyzers: Analyzer[] = [isEqual, findSingleGap]
export const Parsers: ParserConstructor[] = [SymbolParser, RegexParser]
export const Joiners: ((params: JoinParameters) => string)[] = [mapStraight, modifyOrigin]