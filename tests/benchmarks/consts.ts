import path from 'path'
import {Markup} from 'rc-marked-input'
import {isEqual} from './_utils/analyzers/isEqual'
import {findSingleGap} from './_utils/analyzers/findSingleGap'
import {modifyOrigin} from './_utils/joiners/modifyOrigin'
import {mapStraight} from './_utils/joiners/mapStraight'
import {PEGParser} from './_utils/parsers/PEGParser'
import {RegexParser} from './_utils/parsers/RegexParser'
import {SymbolParser} from './_utils/parsers/SymbolParser'
import {Analyzer, JoinParameters, ParserConstructor} from './types'

export const Markups_16: Markup[] = [
	'<h1>__label__</h1>',
	'<h2>__label__</h2>',
	'<p>__label__</p>',
	'<a>__label__</a>',

	'<span>__label__</span>',
	'<b>__label__</b>',
	'<i>__label__</i>',
	'<abbr>__label__</abbr>',

	'<input>__label__</input>',
	'<button>__label__</button>',
	'<select>__label__</select>',
	'<section>__label__</section>',

	'<strong>__label__</strong>',
	'<article>__label__</article>',
	'<header>__label__</header>',
	'<footer>__label__</footer>',
]

export const Markups_1 = Markups_16.slice(0, 1)
export const Markups_2 = Markups_16.slice(0, 2)
export const Markups_4 = Markups_16.slice(0, 4)
export const Markups_8 = Markups_16.slice(0, 8)

export const AnnCountToMarkupMap: Record<string, Markup[]> = {
	'a1': Markups_1,
	'a2': Markups_2,
	'a4': Markups_4,
	'a8': Markups_8,
	'a16': Markups_16,
}

export const LineCountToDiff: Record<string, { count: number, speed: number }> = {
	2: {
		count: 10,
		speed: 1,
	},
	5: {
		count: 10,
		speed: 2,
	},
	10: {
		count: 10,
		speed: 5,
	},
	20: {
		count: 10,
		speed: 5,
	},
	50: {
		count: 10,
		speed: 10,
	},
	100: {
		count: 10,
		speed: 20,
	},
	1_000: {
		count: 10,
		speed: 50,
	},
	10_000: {
		count: 10,
		speed: 100,
	},
	100_000: {
		count: 10,
		speed: 1000,
	},
	500_000: {
		count: 10,
		speed: 5000,
	},
}

export const Analyzers: Analyzer[] = [isEqual, findSingleGap]
export const Parsers: ParserConstructor[] = [SymbolParser, RegexParser, PEGParser]
export const Joiners: ((params: JoinParameters) => string)[] = [mapStraight, modifyOrigin]

/**
* In kB
*/
export const SizeMap = {
	analyzer: {
		0: 0.05, //0.07 isEqual
		1: 0.34, //0.19 findSingleGap
	},
	parser: {
		0: 2.24, //1.02 symbol
		1: 2.16, //1.04 regex
	},
	joiner: {
		0: 0.44, //0.31 mapStraight
		1: 0.18, //0.17 modifyOrigin
	}
} as const

export const UtilsFolderPath = './benchmarks/_utils'
export const DataFolderPath = './benchmarks/data'
export const ResultFolderPath = './benchmarks/results'
export const RawPath = path.resolve(ResultFolderPath, '1-raw.json')
export const TargetPath = path.resolve(ResultFolderPath, '2-target.json')
export const NormalizedPath = path.resolve(ResultFolderPath, '3-normalized.json')
export const DataScoredPath = path.resolve(ResultFolderPath, '4-data-scored.json')
export const GroupScoredPath = path.resolve(ResultFolderPath, '5-group-scored.json')